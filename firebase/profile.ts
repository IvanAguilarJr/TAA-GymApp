import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

export interface UserProfile {
  displayName: string;
  photoURL: string | null;
  weightUnit: "kg" | "lbs";
  createdAt?: number;
  updatedAt?: number;
}

const DEFAULT_PROFILE: Omit<UserProfile, "displayName"> = {
  photoURL: null,
  weightUnit: "kg",
};

export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const ref = doc(db, "users", userId, "profile", "settings");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function createUserProfile(
  userId: string,
  displayName: string,
): Promise<void> {
  const ref = doc(db, "users", userId, "profile", "settings");
  await setDoc(ref, {
    ...DEFAULT_PROFILE,
    displayName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>,
): Promise<void> {
  const ref = doc(db, "users", userId, "profile", "settings");
  await updateDoc(ref, {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function updateWeightUnit(
  userId: string,
  unit: "kg" | "lbs",
): Promise<void> {
  const ref = doc(db, "users", userId, "profile", "settings");
  await updateDoc(ref, { weightUnit: unit });
}
