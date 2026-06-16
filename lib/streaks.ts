import { Exercise, DAY_MAP, Day } from "@/lib/types";

function dateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function isTrainingComplete(
  exercises: Exercise[],
  dayKey: Day,
  date: string,
): boolean {
  const assigned = exercises.filter((e) => e.days.includes(dayKey));
  if (assigned.length === 0) return true;
  return assigned.every((e) =>
    e.history.some((entry) => entry.date.split("T")[0] === date),
  );
}

export function getTodayCompletion(exercises: Exercise[]): {
  completed: number;
  total: number;
  percentage: number;
  isRestDay: boolean;
} {
  const today = new Date().toISOString().split("T")[0];
  const dayKey = DAY_MAP[new Date().getDay()];
  const todayExercises = exercises.filter((e) => e.days?.includes(dayKey));

  if (todayExercises.length === 0) {
    return { completed: 0, total: 0, percentage: 100, isRestDay: true };
  }

  const completed = todayExercises.filter((e) =>
    e.history.some((entry) => entry.date.split("T")[0] === today),
  ).length;

  return {
    completed,
    total: todayExercises.length,
    percentage: Math.round((completed / todayExercises.length) * 100),
    isRestDay: false,
  };
}

export function getCurrentStreak(exercises: Exercise[]): number {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  let streak = 0;

  for (let i = 1; i <= 365; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const dayKey = DAY_MAP[d.getDay()];

    if (exercises.filter((e) => e.days.includes(dayKey)).length === 0) continue;

    if (isTrainingComplete(exercises, dayKey, dateStr(d))) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function getLongestStreak(exercises: Exercise[]): number {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  let max = 0;
  let current = 0;

  for (let i = 364; i >= 1; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const dayKey = DAY_MAP[d.getDay()];

    if (exercises.filter((e) => e.days.includes(dayKey)).length === 0) continue;

    if (isTrainingComplete(exercises, dayKey, dateStr(d))) {
      current++;
      if (current > max) max = current;
    } else {
      current = 0;
    }
  }

  return max;
}
