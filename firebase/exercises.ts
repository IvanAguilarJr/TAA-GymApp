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
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Exercise[];
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
  const docRef = await addDoc(exercisesRef(userId), {
    name,
    sets,
    reps,
    day,
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
  updates: Partial<Pick<Exercise, "name" | "sets" | "reps">>,
): Promise<void> => {
  const ref = doc(db, "users", userId, "exercises", exerciseId);
  await updateDoc(ref, updates);
};

export const updateExerciseDay = async (
  userId: string,
  exerciseId: string,
  day: Day,
): Promise<void> => {
  const ref = doc(db, "users", userId, "exercises", exerciseId);
  await updateDoc(ref, { day });
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
