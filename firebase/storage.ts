import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase/config";

export async function uploadProfilePhoto(userId: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, `users/${userId}/profile/photo.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
