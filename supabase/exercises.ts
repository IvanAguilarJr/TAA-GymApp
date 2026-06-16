import { supabase } from "@/lib/supabase";
import { Exercise, WeightEntry, SetEntry, Day } from "@/firebase/types";

export const MAX_SETS = 4;
export const MAX_WEIGHT_KG = 1000;
export const MAX_REPS = 100;

type ExerciseRow = {
  id: string;
  user_id: string;
  name: string;
  target_sets: number;
  target_reps: number;
  max_weight: number;
  days: string[];
  order: number;
  muscle_tag: string | null;
  type_tag: string | null;
  emoji: string | null;
  created_at: string;
  set_entries: SetEntryRow[] | null;
};

type SetEntryRow = {
  set_number: number;
  weight: number;
  reps: number;
  logged_at: string;
};

function buildHistory(rows: SetEntryRow[]): WeightEntry[] {
  const sorted = [...rows].sort((a, b) =>
    a.logged_at < b.logged_at
      ? -1
      : a.logged_at > b.logged_at
        ? 1
        : a.set_number - b.set_number,
  );
  const groups = new Map<string, SetEntry[]>();
  for (const row of sorted) {
    if (!groups.has(row.logged_at)) groups.set(row.logged_at, []);
    groups.get(row.logged_at)!.push({
      setNumber: row.set_number,
      weight: row.weight,
      reps: row.reps,
    });
  }
  return Array.from(groups.entries()).map(([date, sets]) => ({ date, sets }));
}

function rowToExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    sets: row.target_sets,
    reps: row.target_reps,
    maxWeight: row.max_weight,
    history: buildHistory(row.set_entries ?? []),
    createdAt: row.created_at,
    days: (row.days ?? []) as Day[],
    order: row.order ?? 0,
    ...(row.muscle_tag != null && { muscleTag: row.muscle_tag }),
    ...(row.type_tag != null && { typeTag: row.type_tag }),
    ...(row.emoji != null && { emoji: row.emoji }),
  };
}

export const getExercises = async (userId: string): Promise<Exercise[]> => {
  const { data, error } = await supabase
    .from("exercises")
    .select("*, set_entries(set_number, weight, reps, logged_at)")
    .eq("user_id", userId)
    .order("order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ExerciseRow[]).map(rowToExercise);
};

export const getExerciseById = async (
  userId: string,
  exerciseId: string,
): Promise<Exercise | null> => {
  const { data, error } = await supabase
    .from("exercises")
    .select("*, set_entries(set_number, weight, reps, logged_at)")
    .eq("id", exerciseId)
    .eq("user_id", userId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return rowToExercise(data as ExerciseRow);
};

export const getExercisesByDay = async (
  userId: string,
  day: Day,
): Promise<Exercise[]> => {
  const all = await getExercises(userId);
  return all.filter((e) => e.days.includes(day));
};

export const addExercise = async (
  userId: string,
  name: string,
  sets: number,
  reps: number,
  days: Day[] = [],
  muscleTag?: string,
  typeTag?: string,
  emoji?: string,
): Promise<string> => {
  const { data: existing } = await supabase
    .from("exercises")
    .select("id")
    .eq("user_id", userId);
  const order = existing?.length ?? 0;

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: userId,
      name,
      target_sets: Math.min(sets, MAX_SETS),
      target_reps: Math.min(reps, MAX_REPS),
      days,
      order,
      max_weight: 0,
      ...(muscleTag !== undefined && { muscle_tag: muscleTag }),
      ...(typeTag !== undefined && { type_tag: typeTag }),
      ...(emoji !== undefined && { emoji }),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
};

export const updateExercise = async (
  userId: string,
  exerciseId: string,
  updates: Partial<Pick<Exercise, "name" | "sets" | "reps" | "emoji">>,
): Promise<void> => {
  const mapped: Record<string, unknown> = {};
  if (updates.name !== undefined) mapped.name = updates.name;
  if (updates.sets !== undefined) mapped.target_sets = Math.min(updates.sets, MAX_SETS);
  if (updates.reps !== undefined) mapped.target_reps = Math.min(updates.reps, MAX_REPS);
  if (updates.emoji !== undefined) mapped.emoji = updates.emoji;

  const { error } = await supabase
    .from("exercises")
    .update(mapped)
    .eq("id", exerciseId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
};

export const updateExerciseDays = async (
  userId: string,
  exerciseId: string,
  days: Day[],
): Promise<void> => {
  const { error } = await supabase
    .from("exercises")
    .update({ days })
    .eq("id", exerciseId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
};

export const updateExercisesOrder = async (
  userId: string,
  reorderedExercises: Exercise[],
): Promise<void> => {
  const results = await Promise.all(
    reorderedExercises.map((exercise, index) =>
      supabase
        .from("exercises")
        .update({ order: index })
        .eq("id", exercise.id)
        .eq("user_id", userId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
};

// No-op: Supabase always maintains order via the order column
export const initializeExerciseOrder = async (_userId: string): Promise<void> => {};

export const logSession = async (
  userId: string,
  exercise: Exercise,
  sets: SetEntry[],
): Promise<void> => {
  const safeSets = sets.slice(0, MAX_SETS).map((s) => ({
    ...s,
    weight: Math.min(s.weight, MAX_WEIGHT_KG),
    reps: Math.min(s.reps, MAX_REPS),
  }));

  const sessionTime = new Date().toISOString();
  const rows = safeSets.map((s) => ({
    exercise_id: exercise.id,
    set_number: s.setNumber,
    weight: s.weight,
    reps: s.reps,
    logged_at: sessionTime,
  }));

  const { error: insertError } = await supabase.from("set_entries").insert(rows);
  if (insertError) throw new Error(insertError.message);

  const newMax = Math.max(exercise.maxWeight, ...safeSets.map((s) => s.weight));
  const { error: updateError } = await supabase
    .from("exercises")
    .update({ max_weight: newMax })
    .eq("id", exercise.id)
    .eq("user_id", userId);
  if (updateError) throw new Error(updateError.message);
};

// entryIndex is the position in exercise.history (oldest-first).
// exercise.history[entryIndex].date is the exact logged_at stored in set_entries.
export const updateHistoryEntry = async (
  userId: string,
  exercise: Exercise,
  entryIndex: number,
  newSets: SetEntry[],
): Promise<void> => {
  const sessionLoggedAt = exercise.history[entryIndex].date;

  const { error: deleteError } = await supabase
    .from("set_entries")
    .delete()
    .eq("exercise_id", exercise.id)
    .eq("logged_at", sessionLoggedAt);
  if (deleteError) throw new Error(deleteError.message);

  const rows = newSets.map((s) => ({
    exercise_id: exercise.id,
    set_number: s.setNumber,
    weight: s.weight,
    reps: s.reps,
    logged_at: sessionLoggedAt,
  }));
  const { error: insertError } = await supabase.from("set_entries").insert(rows);
  if (insertError) throw new Error(insertError.message);

  const updatedHistory = exercise.history.map((entry, i) =>
    i === entryIndex ? { ...entry, sets: newSets } : entry,
  );
  const newMax = Math.max(
    0,
    ...updatedHistory.flatMap((e) => e.sets.map((s) => s.weight)),
  );
  const { error: updateError } = await supabase
    .from("exercises")
    .update({ max_weight: newMax })
    .eq("id", exercise.id)
    .eq("user_id", userId);
  if (updateError) throw new Error(updateError.message);
};

export const deleteHistoryEntry = async (
  userId: string,
  exercise: Exercise,
  entryIndex: number,
): Promise<void> => {
  const sessionLoggedAt = exercise.history[entryIndex].date;

  const { error: deleteError } = await supabase
    .from("set_entries")
    .delete()
    .eq("exercise_id", exercise.id)
    .eq("logged_at", sessionLoggedAt);
  if (deleteError) throw new Error(deleteError.message);

  const remainingHistory = exercise.history.filter((_, i) => i !== entryIndex);
  const newMax =
    remainingHistory.length > 0
      ? Math.max(...remainingHistory.flatMap((e) => e.sets.map((s) => s.weight)))
      : 0;
  const { error: updateError } = await supabase
    .from("exercises")
    .update({ max_weight: newMax })
    .eq("id", exercise.id)
    .eq("user_id", userId);
  if (updateError) throw new Error(updateError.message);
};

export const deleteExercise = async (
  userId: string,
  exerciseId: string,
): Promise<void> => {
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", exerciseId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
};
