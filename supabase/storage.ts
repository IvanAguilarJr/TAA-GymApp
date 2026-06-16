import { supabase } from "@/lib/supabase";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";

export async function uploadProfilePhoto(userId: string, uri: string): Promise<string> {
  console.log("[storage] step 1 — uri:", uri);

  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log("[storage] step 2 — base64 length:", base64.length, "sample:", base64.slice(0, 40));
  } catch (e) {
    console.error("[storage] step 2 FAILED — readAsStringAsync threw:", e);
    throw e;
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = decode(base64);
    console.log("[storage] step 3 — arrayBuffer byteLength:", arrayBuffer.byteLength);
  } catch (e) {
    console.error("[storage] step 3 FAILED — decode() threw:", e);
    throw e;
  }

  const path = `${userId}/photo.jpg`;
  console.log("[storage] step 4 — checking auth session before upload...");
  const { data: userCheck, error: userCheckError } = await supabase.auth.getUser();
  console.log(
    "[storage] step 4 — getUser result: uid =",
    userCheck?.user?.id ?? "null",
    "| error =",
    userCheckError?.message ?? "none"
  );

  console.log("[storage] step 4 — uploading to path:", path);
  const { error: uploadError } = await supabase.storage
    .from("profile-pictures")
    .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });
  if (uploadError) {
    console.error("[storage] step 4 FAILED — uploadError.message:", uploadError.message);
    console.error("[storage] step 4 FAILED — uploadError.name:", (uploadError as any).name);
    console.error("[storage] step 4 FAILED — uploadError full:", JSON.stringify(uploadError));
    throw new Error(uploadError.message);
  }
  console.log("[storage] step 4 — upload succeeded");

  const { data, error: urlError } = await supabase.storage
    .from("profile-pictures")
    .createSignedUrl(path, 3600);
  if (urlError) {
    console.error("[storage] step 5 FAILED — urlError.message:", urlError.message);
    console.error("[storage] step 5 FAILED — urlError full:", JSON.stringify(urlError));
    throw new Error(urlError.message);
  }
  console.log("[storage] step 5 — signedUrl:", data.signedUrl);

  return data.signedUrl;
}
