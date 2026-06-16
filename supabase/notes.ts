import { supabase } from "@/lib/supabase";

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
  const { data, error } = await supabase
    .from("notes")
    .select("date, text, created_at, updated_at")
    .eq("user_id", userId)
    .eq("date", date)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return {
    date: data.date,
    text: data.text,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const saveDayNote = async (
  userId: string,
  date: string,
  text: string,
): Promise<void> => {
  const { error } = await supabase
    .from("notes")
    .upsert(
      { user_id: userId, date, text },
      { onConflict: "user_id,date" },
    );
  if (error) throw new Error(error.message);
};

export const getAllNotes = async (userId: string): Promise<DayNote[]> => {
  const { data, error } = await supabase
    .from("notes")
    .select("date, text, created_at, updated_at")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    date: row.date,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};
