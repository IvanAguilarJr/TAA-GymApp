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
import { supabase } from "@/lib/supabase";
import { getExercises, updateExerciseDays } from "@/supabase/exercises";
import { Exercise, Day } from "@/lib/types";
import { useFocusEffect } from "expo-router";
import { useWeightUnit } from "@/app/context/WeightUnitContext";

const TRAINING_DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MUSCLE_FILTERS = [
  "All", "Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Glutes", "Core",
];
const MAX_SLOTS = 12;

type CardAnim = { opacity: Animated.Value; scale: Animated.Value; translateY: Animated.Value };

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

  useFocusEffect(
    useCallback(() => {
      fetchExercises();
    }, []),
  );

  const scheduledForDay = (day: Day) =>
    exercises.filter((e) => e.days?.includes(day));

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
        Animated.spring(anim.scale, {
          toValue: 1.08,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(anim.scale, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(anim.opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(anim.translateY, {
        toValue: -20,
        duration: 300,
        useNativeDriver: true,
      }),
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

    const slots: JSX.Element[] = [];

    for (let i = 0; i < totalSlots; i++) {
      const exercise = filled[i];
      if (exercise) {
        slots.push(
          <View key={exercise.id} style={styles.slotFilled}>
            <Text style={styles.slotEmoji}>
              {exercise.emoji ?? exercise.name.charAt(0).toUpperCase()}
            </Text>
            <Text style={styles.slotName} numberOfLines={1}>
              {exercise.name.length > 8 ? exercise.name.slice(0, 8) + "…" : exercise.name}
            </Text>
            {exercise.muscleTag ? (
              <View style={styles.slotTag}>
                <Text style={styles.slotTagText}>{exercise.muscleTag}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => removeFromDay(exercise)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.slotRemoveBtn}
            >
              <Text style={styles.slotRemove}>×</Text>
            </TouchableOpacity>
          </View>,
        );
      } else {
        slots.push(
          <View key="empty-next" style={styles.slotEmpty}>
            <Text style={styles.slotPlus}>+</Text>
          </View>,
        );
      }
    }

    const rows: JSX.Element[][] = [];
    for (let i = 0; i < slots.length; i += 4) {
      rows.push(slots.slice(i, i + 4));
    }

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
    const initial = exercise.name.charAt(0).toUpperCase();

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
          <View style={styles.bankCardTop}>
            {exercise.emoji ? (
              <Text style={{ fontSize: 28 }}>{exercise.emoji}</Text>
            ) : (
              <Text style={styles.bankCardInitial}>{initial}</Text>
            )}
          </View>
          <View style={styles.bankCardBody}>
            <Text style={styles.bankCardName} numberOfLines={2}>
              {exercise.name}
            </Text>
            <View style={styles.bankTagRow}>
              {exercise.muscleTag && (
                <View style={styles.bankTagChip}>
                  <Text style={styles.bankTagText}>{exercise.muscleTag}</Text>
                </View>
              )}
              {exercise.typeTag && (
                <View style={styles.bankTagChipAlt}>
                  <Text style={styles.bankTagTextAlt}>{exercise.typeTag}</Text>
                </View>
              )}
            </View>
            {exercise.maxWeight > 0 && (
              <Text style={{ fontSize: 9, color: "#555555", marginTop: 5 }}>
                PR: {format(exercise.maxWeight)} · {exercise.sets}×{exercise.reps}
              </Text>
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
            <ActivityIndicator size="large" color="#FFD944" />
          </View>
        ) : (
          <>
            {/* Day folder tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsRow}
            >
              {TRAINING_DAYS.map((day) => {
                const isActive = day === activeDay;
                const count = scheduledForDay(day).length;
                const isRest = restDays.has(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayTab, isActive && styles.dayTabActive]}
                    onPress={() => setActiveDay(day)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayTabText,
                        isActive && styles.dayTabTextActive,
                      ]}
                    >
                      {day}
                      {isRest ? " 😴" : count > 0 ? ` · ${count}` : ""}
                    </Text>
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor:
                          count > 0 || isRest ? "#FFD944" : "#1e1e1e",
                        marginTop: 4,
                        alignSelf: "center",
                      }}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Day panel */}
            <View style={styles.dayPanel}>
              <TextInput
                style={styles.dayNameInput}
                value={dayNames[activeDay] ?? ""}
                onChangeText={(text) =>
                  setDayNames((prev) => ({ ...prev, [activeDay]: text }))
                }
                placeholder="Name this day (e.g. Chest Day)"
                placeholderTextColor="#333333"
              />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <Text style={styles.slotsLabel}>SLOTS</Text>
                <TouchableOpacity
                  onPress={toggleRestDay}
                  style={{
                    backgroundColor: restDays.has(activeDay) ? "#1a0000" : "#000000",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderWidth: 1,
                    borderColor: restDays.has(activeDay) ? "#EF4444" : "#222222",
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 11, color: restDays.has(activeDay) ? "#EF4444" : "#555555", fontWeight: "600" }}>
                    {restDays.has(activeDay) ? "✓ Rest day" : "Rest day"}
                  </Text>
                </TouchableOpacity>
              </View>

              {restDays.has(activeDay) ? (
                <View style={{ backgroundColor: "#1a0000", borderRadius: 10, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 20 }}>😴</Text>
                  <Text style={{ fontSize: 13, color: "#EF4444", fontWeight: "500" }}>Marked as rest day — no exercises needed</Text>
                </View>
              ) : (
                <>
                  <View style={styles.slotsGrid}>{renderSlots()}</View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <Text style={{ fontSize: 10, color: "#555555", letterSpacing: 0.5, fontWeight: "600" }}>FILLED</Text>
                    <View style={{ flex: 1, height: 3, backgroundColor: "#222222", borderRadius: 2, overflow: "hidden" }}>
                      <View style={{
                        height: 3,
                        backgroundColor: "#FFD944",
                        borderRadius: 2,
                        width: `${Math.round((scheduledExercises.length / MAX_SLOTS) * 100)}%`,
                      }} />
                    </View>
                    <Text style={{ fontSize: 10, color: "#FFD944", fontWeight: "600", minWidth: 28, textAlign: "right" }}>
                      {scheduledExercises.length}/{MAX_SLOTS}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Exercise bank */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={styles.bankLabel}>EXERCISE BANK</Text>
              <Text style={{ fontSize: 11, color: "#555555" }}>{bankExercises.length} exercises</Text>
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
                  style={[
                    styles.filterChip,
                    muscleFilter === f && styles.filterChipSelected,
                  ]}
                  onPress={() => setMuscleFilter(f)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      muscleFilter === f && styles.filterChipTextSelected,
                    ]}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {exercises.length === 0 ? (
              <View style={styles.emptyBank}>
                <Text style={styles.emptyBankIcon}>🏋️</Text>
                <Text style={styles.emptyBankText}>
                  No exercises yet. Add some in the Exercises tab.
                </Text>
              </View>
            ) : bankExercises.length === 0 ? (
              <View style={styles.emptyBank}>
                <Text style={styles.emptyBankText}>
                  No exercises match this filter.
                </Text>
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
  safe: { flex: 1, backgroundColor: "#000000" },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  loadingBox: { paddingVertical: 60, alignItems: "center" },

  header: { marginBottom: 20 },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFD944",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: "#555555",
    fontWeight: "500",
    marginTop: 2,
  },

  // Day folder tabs
  tabsRow: { gap: 3, paddingBottom: 0 },
  dayTab: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: "#222222",
    borderBottomWidth: 0,
    marginRight: 3,
  },
  dayTabActive: { borderColor: "#FFD944" },
  dayTabText: { fontSize: 13, fontWeight: "600", color: "#555555" },
  dayTabTextActive: { color: "#FFD944" },

  // Day panel
  dayPanel: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FFD944",
    borderTopWidth: 0,
    padding: 16,
    marginBottom: 20,
  },
  dayNameInput: {
    backgroundColor: "#000000",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#FFD944",
    marginBottom: 14,
  },
  slotsLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#555555",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  slotsGrid: { gap: 8 },
  slotRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  slotFilled: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FFD944",
    padding: 8,
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  slotEmoji: {
    fontSize: 20,
    marginBottom: 4,
    textAlign: "center",
  },
  slotName: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFD944",
    textAlign: "center",
    marginBottom: 3,
  },
  slotTag: {
    backgroundColor: "#FFD944",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  slotTagText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#000000",
  },
  slotRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 6,
  },
  slotRemove: {
    fontSize: 13,
    color: "#555555",
    fontWeight: "700",
    lineHeight: 16,
  },
  slotEmpty: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#2a2a2a",
    borderStyle: "dashed",
    minHeight: 72,
    justifyContent: "center",
    alignItems: "center",
  },
  slotPlus: {
    fontSize: 20,
    color: "#2a2a2a",
    fontWeight: "700",
  },
  slotPadding: {
    flex: 1,
  },

  // Exercise bank
  bankLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#555555",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  filterChips: { marginBottom: 12 },
  filterChipsContent: { gap: 8, paddingHorizontal: 2 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#111111",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  filterChipSelected: { borderColor: "#FFD944" },
  filterChipText: { fontSize: 13, fontWeight: "600", color: "#555555" },
  filterChipTextSelected: { color: "#FFD944" },

  bankRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  bankCardWrapper: { flex: 1 },
  bankCardWrapperAssigned: { opacity: 0.35 },
  bankCard: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  bankCardPlaceholder: { flex: 1 },
  bankCardTop: {
    backgroundColor: "#000000",
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  bankCardInitial: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFD944",
  },
  bankCardBody: { padding: 10 },
  bankCardName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 6,
  },
  bankTagRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  bankTagChip: {
    backgroundColor: "#FFD944",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bankTagText: { fontSize: 9, fontWeight: "700", color: "#000000" },
  bankTagChipAlt: {
    backgroundColor: "#222222",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bankTagTextAlt: { fontSize: 9, fontWeight: "700", color: "#FFD944" },

  emptyBank: { paddingVertical: 32, alignItems: "center", gap: 8 },
  emptyBankIcon: { fontSize: 36 },
  emptyBankText: {
    fontSize: 14,
    color: "#555555",
    fontWeight: "500",
    textAlign: "center",
  },
});
