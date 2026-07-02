import { supabase } from "@/lib/supabase";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";

export async function uploadProfilePhoto(userId: string, uri: string): Promise<string> {
  if (__DEV__) console.log("[storage] upload started");

  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (e) {
    if (__DEV__) console.error("[storage] readAsStringAsync failed:", e instanceof Error ? e.message : e);
    throw e;
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = decode(base64);
  } catch (e) {
    if (__DEV__) console.error("[storage] decode() failed:", e instanceof Error ? e.message : e);
    throw e;
  }

  const path = `${userId}/photo.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("profile-pictures")
    .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });
  if (uploadError) {
    if (__DEV__) console.error("[storage] upload failed:", uploadError.message);
    throw new Error(uploadError.message);
  }
  if (__DEV__) console.log("[storage] upload succeeded");

  const { data, error: urlError } = await supabase.storage
    .from("profile-pictures")
    .createSignedUrl(path, 3600);
  if (urlError) {
    if (__DEV__) console.error("[storage] createSignedUrl failed:", urlError.message);
    throw new Error(urlError.message);
  }

  return data.signedUrl;
}
