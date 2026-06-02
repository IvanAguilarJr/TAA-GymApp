import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getUserProfile,
  updateWeightUnit as saveWeightUnit,
} from "@/firebase/profile";

type WeightUnit = "kg" | "lbs";

interface WeightUnitContextValue {
  unit: WeightUnit;
  setUnit: (unit: WeightUnit) => Promise<void>;
  toDisplay: (kg: number) => number;
  toStorage: (display: number) => number;
  format: (kg: number, decimals?: number) => string;
}

const KG_TO_LBS = 2.20462;

const WeightUnitContext = createContext<WeightUnitContextValue | null>(null);

export function WeightUnitProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string | null;
}) {
  const [unit, setUnitState] = useState<WeightUnit>("kg");

  useEffect(() => {
    if (!userId) return;
    getUserProfile(userId).then((profile) => {
      if (profile?.weightUnit) setUnitState(profile.weightUnit);
    });
  }, [userId]);

  const toDisplay = (kg: number) =>
    unit === "lbs" ? Math.round(kg * KG_TO_LBS * 100) / 100 : kg;

  const toStorage = (display: number) =>
    unit === "lbs" ? Math.round((display / KG_TO_LBS) * 100) / 100 : display;

  const format = (kg: number, decimals = 1) =>
    `${toDisplay(kg).toFixed(decimals)} ${unit}`;

  const setUnit = async (newUnit: WeightUnit) => {
    setUnitState(newUnit);
    if (userId) await saveWeightUnit(userId, newUnit);
  };

  return (
    <WeightUnitContext.Provider
      value={{ unit, setUnit, toDisplay, toStorage, format }}
    >
      {children}
    </WeightUnitContext.Provider>
  );
}

export function useWeightUnit() {
  const ctx = useContext(WeightUnitContext);
  if (!ctx)
    throw new Error("useWeightUnit must be used inside WeightUnitProvider");
  return ctx;
}
