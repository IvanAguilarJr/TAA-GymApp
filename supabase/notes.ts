import { supabase } from "@/lib/supabase";

export type WeekNote = {
  id: string;
  text: string;
  createdAt: string;
  noteDate: string; // "YYYY-MM-DD" — the canonical calendar day for this note
};

export function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getTodayStr(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const getWeekNotes = async (userId: string): Promise<WeekNote[]> => {
  const { start, end } = getCurrentWeekRange();
  const { data, error } = await supabase
    .from("notes")
    .select("id, text, created_at, note_date")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    noteDate: row.note_date,
  }));
};

// Upsert: inserts a new note for today, or updates the existing one if already present.
// One note per calendar day — enforced by the UNIQUE(user_id, note_date) constraint.
export const saveNote = async (userId: string, text: string): Promise<WeekNote> => {
  const noteDate = getTodayStr();
  const { data, error } = await supabase
    .from("notes")
    .upsert(
      { user_id: userId, note_date: noteDate, text },
      { onConflict: "user_id,note_date" },
    )
    .select("id, text, created_at, note_date")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    text: data.text,
    createdAt: data.created_at,
    noteDate: data.note_date,
  };
};

export const deleteNote = async (noteId: string): Promise<void> => {
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId);
  if (error) throw new Error(error.message);
};

export const cleanupOldNotes = async (userId: string): Promise<void> => {
  const { start } = getCurrentWeekRange();
  const weekStartStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("user_id", userId)
    .lt("note_date", weekStartStr);
  if (error) throw new Error(error.message);
};
