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
import { Exercise, WeightEntry, Day } from "@/firebase/types";

// All data lives under: users/{userId}/exercises/{exerciseId}

const exercisesRef = (userId: string) =>
  collection(db, "users", userId, "exercises");

// READ

export const getExercises = async (userId: string): Promise<Exercise[]> => {
  const q = query(exercisesRef(userId), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  const exercises = snapshot.docs.map((doc) => ({
    id: doc.id,
    order: 0,
    ...doc.data(),
  })) as Exercise[];

  // Sort by order within each day group

  return exercises.sort((a, b) => {
    if (a.day === b.day) return (a.order ?? 0) - (b.order ?? 0);
    return 0;
  });
};

export const getExerciseById = async (
  userId: string,
  exerciseId: string,
): Promise<Exercise | null> => {
  const ref = doc(db, "users", userId, "exercises", exerciseId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Exercise;
};

export const getExercisesByDay = async (
  userId: string,
  day: Day,
): Promise<Exercise[]> => {
  const all = await getExercises(userId);
  return all.filter((e) => e.day === day);
};

// CREATE

export const addExercise = async (
  userId: string,
  name: string,
  sets: number,
  reps: number,
  day: Day = "None",
): Promise<string> => {
  const existing = await getExercisesByDay(userId, day);
  const order = existing.length;

  const docRef = await addDoc(exercisesRef(userId), {
    name,
    sets,
    reps,
    day,
    order,
    maxWeight: 0,
    history: [],
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

// UPDATE

export const updateExercise = async (
  userId: string,
  exerciseId: string,
  updates: Partial<Pick<Exercise, "name" | "sets" | "reps" | "day">>,
): Promise<void> => {
  const ref = doc(db, "users", userId, "exercises", exerciseId);
  await updateDoc(ref, updates);
};

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

// Log a new weight entry for an exercise. And automatically updates maxWeight if the new weight is a personal record.

export const logWeight = async (
  userId: string,
  exercise: Exercise,
  weight: number,
): Promise<void> => {
  const ref = doc(db, "users", userId, "exercises", exercise.id);

  const newEntry: WeightEntry = {
    date: new Date().toISOString(),
    weight,
  };

  const updatedHistory = [...exercise.history, newEntry];
  const newMax = weight > exercise.maxWeight ? weight : exercise.maxWeight;

  await updateDoc(ref, {
    history: updatedHistory,
    maxWeight: newMax,
  });
};

// DELTE

export const deleteExercise = async (
  userId: string,
  exerciseId: string,
): Promise<void> => {
  const ref = doc(db, "users", userId, "exercises", exerciseId);
  await deleteDoc(ref);
};

// Assigns initial order values to exercises that don't have one yet.
// Only writes to Firestore if needed.

export const initializeExerciseOrder = async (
  userId: string,
): Promise<void> => {
  const q = query(exercisesRef(userId), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);

  // Group by day
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

// Edit a specific weight entry in an exercise's history.
export const updateHistoryEntry = async (
  userId: string,
  exercise: Exercise,
  entryIndex: number,
  newWeight: number,
): Promise<void> => {
  const ref = doc(db, "users", userId, "exercises", exercise.id);

  const updatedHistory = exercise.history.map((entry, i) =>
    i === entryIndex ? { ...entry, weight: newWeight } : entry,
  );

  const newMax = Math.max(...updatedHistory.map((e) => e.weight), 0);

  await updateDoc(ref, {
    history: updatedHistory,
    maxWeight: newMax,
  });
};

// Delete a specific weight entry from an exercise's history.
export const deleteHistoryEntry = async (
  userId: string,
  exercise: Exercise,
  entryIndex: number, // index in the ORIGINAL (non-reversed) history array.
): Promise<void> => {
  const ref = doc(db, "users", userId, "exercises", exercise.id);

  const updatedHistory = exercise.history.filter((_, i) => i !== entryIndex);
  const newMax =
    updatedHistory.length > 0
      ? Math.max(...updatedHistory.map((e) => e.weight))
      : 0;

  await updateDoc(ref, {
    history: updatedHistory,
    maxWeight: newMax,
  });
};
