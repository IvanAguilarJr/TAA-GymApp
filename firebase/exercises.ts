import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { Exercise, WeightEntry, SetEntry, Day } from "@/firebase/types";

// VALIDATION LIMITS
export const MAX_SETS = 4;
export const MAX_WEIGHT_KG = 1000;
export const MAX_REPS = 100;

// Helper — returns the exercises collection path for a given user
const exercisesRef = (userId: string) =>
  collection(db, "users", userId, "exercises");

// ─── READ ────────────────────────────────────────────────────────────────────

/**
 * Fetch all exercises for a user, sorted by order within each day.
 */
export const getExercises = async (userId: string): Promise<Exercise[]> => {
  const q = query(exercisesRef(userId), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  const exercises = snapshot.docs.map((doc) => ({
    id: doc.id,
    order: 0,
    history: [],
    ...doc.data(),
  })) as Exercise[];

  return exercises.sort((a, b) => {
    if (a.day === b.day) return (a.order ?? 0) - (b.order ?? 0);
    return 0;
  });
};

/**
 * Fetch a single exercise by its document ID.
 */
export const getExerciseById = async (
  userId: string,
  exerciseId: string,
): Promise<Exercise | null> => {
  const ref = doc(db, "users", userId, "exercises", exerciseId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return {
    id: snapshot.id,
    order: 0,
    history: [],
    ...snapshot.data(),
  } as Exercise;
};

/**
 * Fetch all exercises for a specific day, sorted by order.
 */
export const getExercisesByDay = async (
  userId: string,
  day: Day,
): Promise<Exercise[]> => {
  const all = await getExercises(userId);
  return all.filter((e) => e.day === day);
};

// ─── CREATE ──────────────────────────────────────────────────────────────────

/**
 * Add a new exercise. Automatically assigns order within its day group.
 */
export const addExercise = async (
  userId: string,
  name: string,
  sets: number,
  reps: number,
  day: Day = "None",
): Promise<string> => {
  const existing = await getExercisesByDay(userId, day);
  const order = existing.length;

  const clampedSets = Math.min(sets, MAX_SETS);
  const clampedReps = Math.min(reps, MAX_REPS);

  const docRef = await addDoc(exercisesRef(userId), {
    name,
    sets: clampedSets,
    reps: clampedReps,
    day,
    order,
    maxWeight: 0,
    history: [],
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

// ─── UPDATE ──────────────────────────────────────────────────────────────────

/**
 * Update name, sets, reps, or day of an existing exercise.
 */
export const updateExercise = async (
  userId: string,
  exerciseId: string,
  updates: Partial<Pick<Exercise, "name" | "sets" | "reps" | "day">>,
): Promise<void> => {
  if (updates.sets !== undefined)
    updates.sets = Math.min(updates.sets, MAX_SETS);
  if (updates.reps !== undefined)
    updates.reps = Math.min(updates.reps, MAX_REPS);

  const ref = doc(db, "users", userId, "exercises", exerciseId);
  await updateDoc(ref, updates);
};

/**
 * Update only the day of an exercise.
 * Puts it at the end of the new day group.
 */
export const updateExerciseDay = async (
  userId: string,
  exerciseId: string,
  day: Day,
): Promise<void> => {
  const existing = await getExercisesByDay(userId, day);
  const order = existing.length;
  const ref = doc(db, "users", userId, "exercises", exerciseId);
  await updateDoc(ref, { day, order });
};

/**
 * Batch update the order of multiple exercises after drag-and-drop.
 */
export const updateExercisesOrder = async (
  userId: string,
  reorderedExercises: Exercise[],
): Promise<void> => {
  const batch = writeBatch(db);
  reorderedExercises.forEach((exercise, index) => {
    const ref = doc(db, "users", userId, "exercises", exercise.id);
    batch.update(ref, { order: index });
  });
  await batch.commit();
};

/**
 * Assigns initial order values to exercises that don't have one yet.
 */
export const initializeExerciseOrder = async (
  userId: string,
): Promise<void> => {
  const q = query(exercisesRef(userId), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);

  const byDay: Record<string, { id: string; hasOrder: boolean }[]> = {};
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const day = data.day ?? "None";
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({ id: doc.id, hasOrder: data.order !== undefined });
  });

  const batch = writeBatch(db);
  let needsWrite = false;

  Object.values(byDay).forEach((group) => {
    group.forEach((item, index) => {
      if (!item.hasOrder) {
        const ref = doc(db, "users", userId, "exercises", item.id);
        batch.update(ref, { order: index });
        needsWrite = true;
      }
    });
  });

  if (needsWrite) await batch.commit();
};

// ─── SESSION LOGGING ─────────────────────────────────────────────────────────

/**
 * Log a new session with per-set weight and reps.
 * Automatically updates maxWeight if any set beats the current record.
 *
 * @param userId  - current user
 * @param exercise - the exercise being logged
 * @param sets    - array of { setNumber, weight, reps } for each set
 */
export const logSession = async (
  userId: string,
  exercise: Exercise,
  sets: SetEntry[],
): Promise<void> => {
  const ref = doc(db, "users", userId, "exercises", exercise.id);

  const safeSets = sets.slice(0, MAX_SETS).map((s) => ({
    ...s,
    weight: Math.min(s.weight, MAX_WEIGHT_KG),
    reps: Math.min(s.reps, MAX_REPS),
  }));

  const newEntry: WeightEntry = {
    date: new Date().toISOString(),
    sets: safeSets,
  };

  const updatedHistory = [...exercise.history, newEntry];

  // maxWeight = highest weight across all sets in all sessions
  const newMax = Math.max(exercise.maxWeight, ...safeSets.map((s) => s.weight));

  await updateDoc(ref, {
    history: updatedHistory,
    maxWeight: newMax,
  });
};

// ─── HISTORY EDITING ─────────────────────────────────────────────────────────

/**
 * Edit a specific session entry — replaces its sets array.
 * Recalculates maxWeight across all remaining sessions.
 *
 * @param entryIndex - index in the ORIGINAL (non-reversed) history array
 * @param newSets    - the corrected sets for this session
 */
export const updateHistoryEntry = async (
  userId: string,
  exercise: Exercise,
  entryIndex: number,
  newSets: SetEntry[],
): Promise<void> => {
  const ref = doc(db, "users", userId, "exercises", exercise.id);

  const updatedHistory = exercise.history.map((entry, i) =>
    i === entryIndex ? { ...entry, sets: newSets } : entry,
  );

  const newMax = Math.max(
    0,
    ...updatedHistory.flatMap((e) => e.sets.map((s) => s.weight)),
  );

  await updateDoc(ref, {
    history: updatedHistory,
    maxWeight: newMax,
  });
};

/**
 * Delete a specific session entry.
 * Recalculates maxWeight after deletion.
 *
 * @param entryIndex - index in the ORIGINAL (non-reversed) history array
 */
export const deleteHistoryEntry = async (
  userId: string,
  exercise: Exercise,
  entryIndex: number,
): Promise<void> => {
  const ref = doc(db, "users", userId, "exercises", exercise.id);

  const updatedHistory = exercise.history.filter((_, i) => i !== entryIndex);

  const newMax =
    updatedHistory.length > 0
      ? Math.max(...updatedHistory.flatMap((e) => e.sets.map((s) => s.weight)))
      : 0;

  await updateDoc(ref, {
    history: updatedHistory,
    maxWeight: newMax,
  });
};

// DELETE
export const deleteExercise = async (
  userId: string,
  exerciseId: string,
): Promise<void> => {
  const ref = doc(db, "users", userId, "exercises", exerciseId);
  await deleteDoc(ref);
};
