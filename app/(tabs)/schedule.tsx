import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/lib/supabase";
import { getExercises, updateExerciseDays } from "@/supabase/exercises";
import { Exercise, Day } from "@/lib/types";
import { useFocusEffect } from "expo-router";
import { useWeightUnit } from "@/app/context/WeightUnitContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, getExerciseTileBg } from "@/lib/colors";

const TRAINING_DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MUSCLE_FILTERS = ["All", "Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Glutes", "Core"];
const MAX_SLOTS = 12;

type CardAnim = { opacity: Animated.Value; scale: Animated.Value; translateY: Animated.Value };

const VALID_EXERCISE_ICONS = new Set(["dumbbell", "weight-lifter", "arm-flex", "kettlebell", "bench"]);

function getExerciseIcon(exercise: Exercise): keyof typeof MaterialCommunityIcons.glyphMap {
  const stored = exercise.emoji;
  if (stored && VALID_EXERCISE_ICONS.has(stored)) return stored as keyof typeof MaterialCommunityIcons.glyphMap;
  return "dumbbell";
}

export default function Schedule() {
  const [userId, setUserId] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<Day>("Mon");
  const [muscleFilter, setMuscleFilter] = useState("All");
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [dayNames, setDayNames] = useState<Record<string, string>>({});
  const [restDays, setRestDays] = useState<Set<Day>>(new Set());

  const { format } = useWeightUnit();
  const cardAnims = useRef<Record<string, CardAnim>>({});

  const getCardAnim = (id: string): CardAnim => {
    if (!cardAnims.current[id]) {
      cardAnims.current[id] = {
        opacity: new Animated.Value(1),
        scale: new Animated.Value(1),
        translateY: new Animated.Value(0),
      };
    }
    return cardAnims.current[id];
  };

  const fetchExercises = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!userId) setUserId(user.id);
      const data = await getExercises(user.id);
      setExercises(data);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchExercises(); }, []));

  const scheduledForDay = (day: Day) => exercises.filter((e) => e.days?.includes(day));

  const toggleRestDay = () => {
    setRestDays((prev) => {
      const next = new Set(prev);
      if (next.has(activeDay)) {
        next.delete(activeDay);
      } else {
        next.add(activeDay);
        scheduledForDay(activeDay).forEach((ex) => removeFromDay(ex));
      }
      return next;
    });
  };

  const assignToDay = (exercise: Exercise) => {
    if (animatingId) return;
    setAnimatingId(exercise.id);
    const anim = getCardAnim(exercise.id);

    Animated.parallel([
      Animated.sequence([
        Animated.spring(anim.scale, { toValue: 1.08, useNativeDriver: true, tension: 300, friction: 10 }),
        Animated.timing(anim.scale, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]),
      Animated.timing(anim.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(anim.translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
    ]).start(async () => {
      const newDays = [...(exercise.days ?? []), activeDay];
      await updateExerciseDays(userId, exercise.id, newDays);
      await fetchExercises();
      anim.scale.setValue(1);
      anim.opacity.setValue(1);
      anim.translateY.setValue(0);
      setAnimatingId(null);
    });
  };

  const removeFromDay = async (exercise: Exercise) => {
    await updateExerciseDays(
      userId,
      exercise.id,
      (exercise.days ?? []).filter((d) => d !== activeDay),
    );
    await fetchExercises();
  };

  const scheduledExercises = scheduledForDay(activeDay);
  const slotsFull = scheduledExercises.length >= MAX_SLOTS;

  const bankExercises = exercises.filter(
    (e) => muscleFilter === "All" || e.muscleTag === muscleFilter,
  );

  const renderSlots = () => {
    const filled = scheduledExercises;
    const totalSlots = Math.min(filled.length + (filled.length < MAX_SLOTS ? 1 : 0), MAX_SLOTS);
    const slots: React.ReactElement[] = [];

    for (let i = 0; i < totalSlots; i++) {
      const exercise = filled[i];
      if (exercise) {
        const exColor = exercise.color ?? C.accentYellow;
        slots.push(
          <TouchableOpacity
            key={exercise.id}
            style={[
              styles.slotFilled,
              { borderColor: exColor, backgroundColor: getExerciseTileBg(exColor) },
            ]}
            onPress={() => removeFromDay(exercise)}
            activeOpacity={0.7}
          >
            <View style={[styles.slotIconTile, { backgroundColor: getExerciseTileBg(exColor) }]}>
              <MaterialCommunityIcons name={getExerciseIcon(exercise)} size={14} color={exColor} />
            </View>
            <Text style={[styles.slotName, { color: exColor }]} numberOfLines={1}>
              {exercise.name.length > 8 ? exercise.name.slice(0, 8) + "…" : exercise.name}
            </Text>
            {exercise.muscleTag ? (
              <View style={[styles.slotTag, { backgroundColor: exColor + "22" }]}>
                <Text style={[styles.slotTagText, { color: exColor }]}>{exercise.muscleTag}</Text>
              </View>
            ) : null}
          </TouchableOpacity>,
        );
      } else {
        slots.push(
          <View key="empty-next" style={styles.slotEmpty}>
            <MaterialCommunityIcons name="plus" size={18} color={C.bgSurface3} />
          </View>,
        );
      }
    }

    const rows: React.ReactElement[][] = [];
    for (let i = 0; i < slots.length; i += 4) rows.push(slots.slice(i, i + 4));

    return (
      <>
        {rows.map((row, i) => (
          <View key={i} style={styles.slotRow}>
            {row}
            {row.length < 4 &&
              Array.from({ length: 4 - row.length }).map((_, j) => (
                <View key={`pad-${j}`} style={styles.slotPadding} />
              ))}
          </View>
        ))}
      </>
    );
  };

  const renderBankCard = (exercise: Exercise) => {
    const anim = getCardAnim(exercise.id);
    const isAssigned = exercise.days?.includes(activeDay) ?? false;
    const disabled = isAssigned || slotsFull;
    const exColor = exercise.color ?? C.accentYellow;

    return (
      <Animated.View
        key={exercise.id}
        style={[
          styles.bankCardWrapper,
          {
            opacity: anim.opacity,
            transform: [{ scale: anim.scale }, { translateY: anim.translateY }],
          },
          isAssigned && styles.bankCardWrapperAssigned,
        ]}
        pointerEvents={disabled ? "none" : "auto"}
      >
        <TouchableOpacity
          style={styles.bankCard}
          onPress={() => !disabled && assignToDay(exercise)}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <View style={[styles.bankCardTop, { backgroundColor: getExerciseTileBg(exColor) }]}>
            <View style={[styles.bankIconTile, { backgroundColor: getExerciseTileBg(exColor) }]}>
              <MaterialCommunityIcons name={getExerciseIcon(exercise)} size={26} color={exColor} />
            </View>
          </View>
          <View style={styles.bankCardBody}>
            <Text style={styles.bankCardName} numberOfLines={2}>{exercise.name}</Text>
            <View style={styles.bankTagRow}>
              {exercise.muscleTag && (
                <View style={[styles.bankTagChip, { backgroundColor: exColor + "22" }]}>
                  <Text style={[styles.bankTagText, { color: exColor }]}>{exercise.muscleTag}</Text>
                </View>
              )}
              {exercise.typeTag && (
                <View style={styles.bankTagChipAlt}>
                  <Text style={styles.bankTagTextAlt}>{exercise.typeTag}</Text>
                </View>
              )}
            </View>
            {exercise.maxWeight > 0 && (
              <View style={[styles.bankPrBadge, { backgroundColor: exColor + "22" }]}>
                <MaterialCommunityIcons name="trophy-outline" size={9} color={exColor} />
                <Text style={[styles.bankPrText, { color: exColor }]}>
                  {format(exercise.maxWeight)} · {exercise.sets}×{exercise.reps}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderBankGrid = () => {
    const pairs: [Exercise, Exercise | undefined][] = [];
    for (let i = 0; i < bankExercises.length; i += 2) {
      pairs.push([bankExercises[i], bankExercises[i + 1]]);
    }
    return pairs.map(([a, b], i) => (
      <View key={i} style={styles.bankRow}>
        {renderBankCard(a)}
        {b ? renderBankCard(b) : <View style={styles.bankCardPlaceholder} />}
      </View>
    ));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Schedule</Text>
          <Text style={styles.headerSub}>Build your training week</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.accentYellow} />
          </View>
        ) : (
          <>
            {/* Day selector — compact horizontal pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsRow}
            >
              {TRAINING_DAYS.map((day) => {
                const isActive = day === activeDay;
                const count = scheduledForDay(day).length;
                const isRest = restDays.has(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayPill,
                      isActive && styles.dayPillActive,
                      isRest && !isActive && styles.dayPillRest,
                    ]}
                    onPress={() => setActiveDay(day)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayPillText,
                      isActive && styles.dayPillTextActive,
                      isRest && !isActive && styles.dayPillTextRest,
                    ]}>
                      {day}
                    </Text>
                    <View style={[
                      styles.dayPillDot,
                      count > 0 && !isActive && styles.dayPillDotFilled,
                      isActive && styles.dayPillDotActive,
                    ]} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Day panel — gradient focal card with yellow glow */}
            <View style={styles.dayPanelShadow}>
              <LinearGradient
                colors={["#111111", "#0d0d0d"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dayPanel}
              >
                <TextInput
                  style={styles.dayNameInput}
                  value={dayNames[activeDay] ?? ""}
                  onChangeText={(text) => setDayNames((prev) => ({ ...prev, [activeDay]: text }))}
                  placeholder="Name this day (e.g. Chest Day)"
                  placeholderTextColor={C.textTertiary}
                />

                <View style={styles.slotsPanelHeader}>
                  <View>
                    <Text style={styles.slotsLabel}>SLOTS</Text>
                    <Text style={styles.slotsHint}>Tap a slot to remove it</Text>
                  </View>
                  <TouchableOpacity
                    onPress={toggleRestDay}
                    style={[
                      styles.restDayBtn,
                      restDays.has(activeDay) && styles.restDayBtnActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.restDayBtnText,
                      restDays.has(activeDay) && styles.restDayBtnTextActive,
                    ]}>
                      {restDays.has(activeDay) ? "✓ Rest day" : "Rest day"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {restDays.has(activeDay) ? (
                  <View style={styles.restDayInfo}>
                    <MaterialCommunityIcons name="sleep" size={18} color={C.textTertiary} />
                    <Text style={styles.restDayInfoText}>Marked as rest day — no exercises needed</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.slotsGrid}>{renderSlots()}</View>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>FILLED</Text>
                      <View style={styles.progressTrack}>
                        <View style={[
                          styles.progressFill,
                          { width: `${Math.round((scheduledExercises.length / MAX_SLOTS) * 100)}%` as any },
                        ]} />
                      </View>
                      <Text style={styles.progressCount}>
                        {scheduledExercises.length}/{MAX_SLOTS}
                      </Text>
                    </View>
                  </>
                )}
              </LinearGradient>
            </View>

            {/* Section divider */}
            <LinearGradient
              colors={["transparent", "rgba(255,255,255,0.08)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionDivider}
            />

            {/* Exercise bank */}
            <View style={styles.bankHeader}>
              <View>
                <Text style={styles.bankEyebrow}>EXERCISE BANK</Text>
                <Text style={styles.bankHint}>Tap an exercise to add it to this day</Text>
              </View>
              <Text style={styles.bankCount}>{bankExercises.length} exercises</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterChips}
              contentContainerStyle={styles.filterChipsContent}
            >
              {MUSCLE_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, muscleFilter === f && styles.filterChipSelected]}
                  onPress={() => setMuscleFilter(f)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, muscleFilter === f && styles.filterChipTextSelected]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {exercises.length === 0 ? (
              <View style={styles.emptyBank}>
                <MaterialCommunityIcons name="dumbbell" size={36} color={C.textTertiary} />
                <Text style={styles.emptyBankText}>
                  No exercises yet. Add some in the Exercises tab.
                </Text>
              </View>
            ) : bankExercises.length === 0 ? (
              <View style={styles.emptyBank}>
                <Text style={styles.emptyBankText}>No exercises match this filter.</Text>
              </View>
            ) : (
              <View>{renderBankGrid()}</View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBlack },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  loadingBox: { paddingVertical: 60, alignItems: "center" },

  header: { marginBottom: 20 },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },

  // ── Day selector pills ────────────────────────────────────────────────────
  pillsRow: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 14,
  },
  dayPill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 100,
    backgroundColor: C.bgSurface1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dayPillActive: {
    backgroundColor: C.accentYellow,
    borderColor: C.accentYellow,
  },
  dayPillRest: {
    backgroundColor: "transparent",
    borderStyle: "dashed",
    borderColor: C.bgSurface3,
  },
  dayPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSecondary,
  },
  dayPillTextActive: {
    color: C.bgBlack,
  },
  dayPillTextRest: {
    color: C.textTertiary,
  },
  dayPillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.bgSurface3,
  },
  dayPillDotFilled: {
    backgroundColor: "#3DCC88",
  },
  dayPillDotActive: {
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  // ── Day panel — gradient focal card ──────────────────────────────────────
  // Outer wrapper carries the shadow/glow; inner LinearGradient clips content.
  dayPanelShadow: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.accentYellow,
    marginBottom: 8,
    shadowColor: C.accentYellow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  dayPanel: {
    borderRadius: 14,
    overflow: "hidden",
    padding: 16,
  },
  dayNameInput: {
    backgroundColor: C.bgBlack,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: C.textPrimary,
    marginBottom: 14,
  },
  slotsPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  slotsLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textSecondary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  slotsHint: {
    fontSize: 10,
    color: C.textTertiary,
    marginTop: 3,
    fontWeight: "500",
  },
  restDayBtn: {
    backgroundColor: C.bgBlack,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.bgSurface3,
  },
  restDayBtnActive: { backgroundColor: "#1a0000", borderColor: "#EF4444" },
  restDayBtnText: { fontSize: 11, color: C.textTertiary, fontWeight: "600" },
  restDayBtnTextActive: { color: "#EF4444" },

  restDayInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.bgBlack,
    borderRadius: 10,
    padding: 14,
  },
  restDayInfoText: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "500",
    flex: 1,
  },

  // ── Slots grid ────────────────────────────────────────────────────────────
  slotsGrid: { gap: 8 },
  slotRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  slotFilled: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 8,
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  slotIconTile: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  slotName: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 3,
  },
  slotTag: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  slotTagText: { fontSize: 8, fontWeight: "700" },
  slotEmpty: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.bgSurface3,
    borderStyle: "dashed",
    minHeight: 72,
    justifyContent: "center",
    alignItems: "center",
  },
  slotPadding: { flex: 1 },

  // ── Progress bar ──────────────────────────────────────────────────────────
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  progressLabel: {
    fontSize: 10,
    color: C.textTertiary,
    letterSpacing: 1.5,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: C.bgSurface3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: C.accentYellow,
    borderRadius: 2,
  },
  progressCount: {
    fontSize: 12,
    color: C.accentYellow,
    fontWeight: "700",
    minWidth: 28,
    textAlign: "right",
  },

  // ── Section divider ───────────────────────────────────────────────────────
  sectionDivider: {
    height: 1,
    marginVertical: 20,
    marginHorizontal: -20,
  },

  // ── Exercise bank ─────────────────────────────────────────────────────────
  bankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  bankEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textTertiary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  bankHint: {
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 4,
    fontWeight: "600",
  },
  bankCount: { fontSize: 11, color: C.textSecondary },
  filterChips: { marginBottom: 12 },
  filterChipsContent: { gap: 8, paddingHorizontal: 2 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.bgSurface1,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  filterChipSelected: { borderColor: C.accentYellow },
  filterChipText: { fontSize: 13, fontWeight: "600", color: C.textTertiary },
  filterChipTextSelected: { color: C.accentYellow },

  // ── Bank cards — matching exercises.tsx grid card proportions ─────────────
  bankRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  bankCardWrapper: { flex: 1 },
  bankCardWrapperAssigned: { opacity: 0.45 },
  bankCard: {
    flex: 1,
    backgroundColor: C.bgSurface1,
    borderRadius: 16,
    overflow: "hidden",
  },
  bankCardPlaceholder: { flex: 1 },
  bankCardTop: {
    height: 72,
    justifyContent: "center",
    alignItems: "center",
  },
  bankIconTile: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  bankCardBody: { padding: 10 },
  bankCardName: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: 6,
  },
  bankTagRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  bankTagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bankTagText: { fontSize: 9, fontWeight: "700" },
  bankTagChipAlt: {
    backgroundColor: C.bgSurface3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bankTagTextAlt: { fontSize: 9, fontWeight: "700", color: C.textSecondary },
  bankPrBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 5,
    alignSelf: "flex-start",
  },
  bankPrText: { fontSize: 9, fontWeight: "700" },

  emptyBank: { paddingVertical: 32, alignItems: "center", gap: 8 },
  emptyBankText: {
    fontSize: 14,
    color: C.textSecondary,
    fontWeight: "500",
    textAlign: "center",
  },
});
