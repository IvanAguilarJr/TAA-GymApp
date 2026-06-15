import { collection, getDocs, doc, deleteDoc, writeBatch } from "firebase/firestore";
import { deleteUser, User } from "firebase/auth";
import { db } from "@/firebase/config";

export async function deleteUserAccount(userId: string, user: User): Promise<void> {
  // Batch-delete all exercise documents
  const exercisesSnap = await getDocs(collection(db, "users", userId, "exercises"));
  if (!exercisesSnap.empty) {
    const batch = writeBatch(db);
    exercisesSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // Delete profile/settings document
  await deleteDoc(doc(db, "users", userId, "profile", "settings"));

  // Delete the user root document (no-op if it doesn't exist)
  await deleteDoc(doc(db, "users", userId));

  // Remove Firebase Auth account — may require recent login
  try {
    await deleteUser(user);
  } catch (e: any) {
    if (e.code === "auth/requires-recent-login") {
      throw new Error("REAUTH_REQUIRED");
    }
    throw e;
  }
}
