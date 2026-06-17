export type Day =
  | "Mon"
  | "Tue"
  | "Wed"
  | "Thu"
  | "Fri"
  | "Sat"
  | "Sun"
  | "None";

export const ALL_DAYS: Day[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
  "None",
];

// Maps JS getDay() (0=Sunday) to the Day type
export const DAY_MAP: Record<number, Day> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

// A single set within a session
export type SetEntry = {
  setNumber: number; // 1-indexed
  weight: number;
  reps: number;
};

// A full session log - contains one SetEntry per set
export type WeightEntry = {
  date: string; // ISO string e.g. "2026-04-22"
  sets: SetEntry[]; // one per set logged
};

export type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  maxWeight: number;
  history: WeightEntry[];
  createdAt: string;
  days: Day[];
  order: number;
  muscleTag?: string;
  typeTag?: string;
  emoji?: string;
  color?: string;
};
