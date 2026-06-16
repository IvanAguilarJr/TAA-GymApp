import { supabase } from "@/lib/supabase";

export interface UserProfile {
  displayName: string;
  photoURL: string | null;
  weightUnit: "kg" | "lbs";
  createdAt?: string;
  updatedAt?: string;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, photo_url, weight_unit, created_at, updated_at")
    .eq("id", userId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return {
    displayName: data.display_name ?? "",
    photoURL: data.photo_url ?? null,
    weightUnit: (data.weight_unit ?? "kg") as "kg" | "lbs",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>,
): Promise<void> {
  const mapped: Record<string, unknown> = {};
  if (updates.displayName !== undefined) mapped.display_name = updates.displayName;
  if (updates.photoURL !== undefined) mapped.photo_url = updates.photoURL;
  if (updates.weightUnit !== undefined) mapped.weight_unit = updates.weightUnit;

  const { error } = await supabase
    .from("profiles")
    .update(mapped)
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function updateWeightUnit(
  userId: string,
  unit: "kg" | "lbs",
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ weight_unit: unit })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}
