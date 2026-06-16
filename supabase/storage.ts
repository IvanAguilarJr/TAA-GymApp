import { supabase } from "@/lib/supabase";

export async function uploadProfilePhoto(userId: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `${userId}/photo.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("profile-pictures")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error: urlError } = await supabase.storage
    .from("profile-pictures")
    .createSignedUrl(path, 3600);
  if (urlError) throw new Error(urlError.message);

  return data.signedUrl;
}
