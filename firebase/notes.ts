import { db } from "@/firebase/config";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

export type DayNote = {
  date: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export const getDayNote = async (
  userId: string,
  date: string,
): Promise<DayNote | null> => {
  const ref = doc(db, "users", userId, "notes", date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as DayNote;
};

export const saveDayNote = async (
  userId: string,
  date: string,
  text: string,
): Promise<void> => {
  const ref = doc(db, "users", userId, "notes", date);
  const now = new Date().toISOString();
  const existing = await getDoc(ref);
  await setDoc(ref, {
    date,
    text,
    createdAt: existing.exists() ? existing.data().createdAt : now,
    updatedAt: now,
  });
};

export const getAllNotes = async (userId: string): Promise<DayNote[]> => {
  const ref = collection(db, "users", userId, "notes");
  const q = query(ref, orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as DayNote);
};
