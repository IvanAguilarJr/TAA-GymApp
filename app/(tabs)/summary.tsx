import { supabase } from "@/lib/supabase";
import { getExercises } from "@/supabase/exercises";
import { Exercise, ALL_DAYS, Day } from "@/lib/types";
import { getAllNotes, DayNote } from "@/supabase/notes";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWeightUnit } from "../context/WeightUnitContext";
import { getCurrentStreak, getLongestStreak, getTodayCompletion } from "@/lib/streaks";

const DAY_LABELS: Record<Day, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
  None: "Unscheduled",
};

export default function Summary() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { format } = useWeightUnit();

  const fetchExercises = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [data, allNotes] = await Promise.all([
        getExercises(user.id),
        getAllNotes(user.id),
      ]);
      setExercises(data);
      setNotes(allNotes);
    } catch (err) {
      //fail silently
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchExercises();
    }, []),
  );

  const totalSessions = exercises.reduce((sum, e) => sum + e.history.length, 0);

  const totalPRs = exercises.filter((e) => e.maxWeight > 0).length;

  const heaviestLift = exercises.reduce(
    (max, e) => (e.maxWeight > max ? e.maxWeight : max),
    0,
  );

  // top 3 PRs by weight
  const topPRs = [...exercises]
    .filter((e) => e.maxWeight > 0)
    .sort((a, b) => b.maxWeight - a.maxWeight)
    .slice(0, 3);

  // Schedule breakdown - days that have at least one exercise
  const scheduledDays = ALL_DAYS.filter(
    (day) => day !== "None" && exercises.some((e) => e.days?.includes(day)),
  );

  const restDays = ALL_DAYS.filter(
    (day) => day !== "None" && !exercises.some((e) => e.days?.includes(day)),
  );

  const currentStreak = getCurrentStreak(exercises);
  const longestStreak = getLongestStreak(exercises);
  const todayCompletion = getTodayCompletion(exercises);

  const getWeekKey = (date: string) => {
    const d = new Date(date);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(
      ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
    );
    return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
  };

  const getMonthKey = (date: string) => date.slice(0, 7);
  const getYearKey = (date: string) => date.slice(0, 4);

  const formatDateLabel = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatMonthLabel = (key: string) => {
    const [year, month] = key.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
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
          <Text style={styles.headerTitle}>Summary</Text>
          <Text style={styles.headerSub}>Your fitness overview</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FFD944" />
          </View>
        ) : (
          <>
            {/* ── Key Stats ── */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, styles.statCardLarge]}>
                <Text style={styles.statCardValue}>{exercises.length}</Text>
                <Text style={styles.statCardLabel}>Total Exercises</Text>
              </View>
              <View style={[styles.statCard, styles.statCardLarge]}>
                <Text style={styles.statCardValue}>{totalSessions}</Text>
                <Text style={styles.statCardLabel}>Total Sessions</Text>
              </View>
              <View style={[styles.statCard, styles.statCardLarge]}>
                <Text style={styles.statCardValue}>{totalPRs}</Text>
                <Text style={styles.statCardLabel}>PRs Set</Text>
              </View>
              <View style={[styles.statCard, styles.statCardLarge]}>
                <Text style={styles.statCardValue}>
                  {heaviestLift > 0 ? format(heaviestLift) : "—"}
                </Text>
                <Text style={styles.statCardLabel}>Heaviest Lift</Text>
              </View>
            </View>

            {/* ── Streak ── */}
            <View style={styles.card}>
              <View style={styles.cardAccent} />
              <Text style={styles.cardTitle}>🔥 Streak</Text>
              <View style={styles.streakRow}>
                <View style={styles.streakStat}>
                  <Text style={styles.streakStatValue}>{currentStreak}</Text>
                  <Text style={styles.streakStatLabel}>day streak</Text>
                </View>
                <View style={styles.streakStatDivider} />
                <View style={styles.streakStat}>
                  <Text style={styles.streakStatValue}>{longestStreak}</Text>
                  <Text style={styles.streakStatLabel}>personal best</Text>
                </View>
                <View style={styles.streakStatDivider} />
                <View style={styles.streakStat}>
                  <Text style={styles.streakStatValue}>{todayCompletion.percentage}%</Text>
                  <Text style={styles.streakStatLabel}>today's completion</Text>
                </View>
              </View>
            </View>

            {/* ── Notes ── */}
            {notes.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardAccent} />
                <Text style={styles.cardTitle}>📝 Notes</Text>

                {(() => {
                  const byYear: Record<string, Record<string, Record<string, DayNote[]>>> = {};
                  notes.forEach((note) => {
                    const y = getYearKey(note.date);
                    const m = getMonthKey(note.date);
                    const w = getWeekKey(note.date);
                    if (!byYear[y]) byYear[y] = {};
                    if (!byYear[y][m]) byYear[y][m] = {};
                    if (!byYear[y][m][w]) byYear[y][m][w] = [];
                    byYear[y][m][w].push(note);
                  });

                  return Object.entries(byYear).map(([year, months]) => (
                    <View key={year}>
                      <TouchableOpacity
                        style={styles.noteGroupHeader}
                        onPress={() => toggleGroup(year)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.noteGroupTitle}>{year}</Text>
                        <Text style={styles.noteGroupChevron}>
                          {expandedGroups.has(year) ? "▾" : "▸"}
                        </Text>
                      </TouchableOpacity>

                      {expandedGroups.has(year) &&
                        Object.entries(months).map(([monthKey, weeks]) => (
                          <View key={monthKey} style={styles.noteMonthBlock}>
                            <TouchableOpacity
                              style={styles.noteMonthHeader}
                              onPress={() => toggleGroup(monthKey)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.noteMonthTitle}>
                                {formatMonthLabel(monthKey)}
                              </Text>
                              <Text style={styles.noteGroupChevron}>
                                {expandedGroups.has(monthKey) ? "▾" : "▸"}
                              </Text>
                            </TouchableOpacity>

                            {expandedGroups.has(monthKey) &&
                              Object.entries(weeks).map(([weekKey, dayNotes]) => (
                                <View key={weekKey} style={styles.noteWeekBlock}>
                                  <TouchableOpacity
                                    style={styles.noteWeekHeader}
                                    onPress={() => toggleGroup(weekKey)}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.noteWeekTitle}>
                                      {weekKey.replace("-", " · ")}
                                    </Text>
                                    <Text style={styles.noteGroupChevron}>
                                      {expandedGroups.has(weekKey) ? "▾" : "▸"}
                                    </Text>
                                  </TouchableOpacity>

                                  {expandedGroups.has(weekKey) &&
                                    dayNotes.map((note) => (
                                      <View key={note.date} style={styles.noteDayCard}>
                                        <Text style={styles.noteDayDate}>
                                          {formatDateLabel(note.date)}
                                        </Text>
                                        <Text style={styles.noteDayText}>{note.text}</Text>
                                      </View>
                                    ))}
                                </View>
                              ))}
                          </View>
                        ))}
                    </View>
                  ));
                })()}
              </View>
            )}

            {/* ── Top PRs ── */}
            <View style={styles.card}>
              <View style={styles.cardAccent} />
              <Text style={styles.cardTitle}>🏆 Top PRs</Text>

              {topPRs.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionIcon}>🏋️</Text>
                  <Text style={styles.emptySectionText}>
                    No PRs yet — log a session to set your first record!
                  </Text>
                  <TouchableOpacity
                    style={styles.linkBtn}
                    onPress={() => router.push("/(tabs)/exercises")}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.linkBtnText}>Go to Exercises →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                topPRs.map((exercise, index) => (
                  <TouchableOpacity
                    key={exercise.id}
                    style={[
                      styles.prRow,
                      index < topPRs.length - 1 && styles.prRowBorder,
                    ]}
                    onPress={() => router.push(`/exercise/${exercise.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.prRank}>
                      <Text style={styles.prRankText}>#{index + 1}</Text>
                    </View>
                    <View style={styles.prLeft}>
                      <Text style={styles.prName}>{exercise.name}</Text>
                      <Text style={styles.prMeta}>
                        {exercise.sets} sets · {exercise.reps} reps ·{" "}
                        {exercise.days?.join(", ") || "Unscheduled"}
                      </Text>
                    </View>
                    <View style={styles.prBadge}>
                      <Text style={styles.prBadgeText}>
                        {format(exercise.maxWeight)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* ── Weekly Schedule ── */}
            <View style={styles.card}>
              <View style={styles.cardAccent} />
              <Text style={styles.cardTitle}>📅 Weekly Schedule</Text>

              {exercises.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>
                    No exercises scheduled yet.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Training days */}
                  {scheduledDays.length > 0 && (
                    <>
                      <Text style={styles.scheduleSubtitle}>TRAINING</Text>
                      {scheduledDays.map((day, index) => {
                        const count = exercises.filter(
                          (e) => e.days?.includes(day),
                        ).length;
                        return (
                          <View
                            key={day}
                            style={[
                              styles.scheduleRow,
                              index < scheduledDays.length - 1 &&
                                styles.scheduleRowBorder,
                            ]}
                          >
                            <View style={styles.scheduleLeft}>
                              <View style={styles.trainingDot} />
                              <Text style={styles.scheduleDayText}>
                                {DAY_LABELS[day]}
                              </Text>
                            </View>
                            <Text style={styles.scheduleCount}>
                              {count} exercise{count !== 1 ? "s" : ""}
                            </Text>
                          </View>
                        );
                      })}
                    </>
                  )}

                  {/* Rest days */}
                  {restDays.length > 0 && (
                    <>
                      <Text
                        style={[styles.scheduleSubtitle, { marginTop: 16 }]}
                      >
                        REST
                      </Text>
                      <View style={styles.restDaysRow}>
                        {restDays.map((day) => (
                          <View key={day} style={styles.restDayChip}>
                            <Text style={styles.restDayChipText}>{day}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}
            </View>

            {/* ── All Exercises quick list ── */}
            {exercises.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardAccent} />
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>💪 All Exercises</Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/exercises")}
                  >
                    <Text style={styles.seeAllText}>See all →</Text>
                  </TouchableOpacity>
                </View>

                {exercises.map((exercise, index) => (
                  <TouchableOpacity
                    key={exercise.id}
                    style={[
                      styles.exerciseRow,
                      index < exercises.length - 1 && styles.exerciseRowBorder,
                    ]}
                    onPress={() => router.push(`/exercise/${exercise.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.exerciseLeft}>
                      <View style={styles.exerciseIconBox}>
                        <Text style={styles.exerciseIcon}>💪</Text>
                      </View>
                      <View>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          {exercise.days?.join(", ") || "Unscheduled"}
                        </Text>
                      </View>
                    </View>
                    {exercise.maxWeight > 0 && (
                      <View style={styles.prBadgeSmall}>
                        <Text style={styles.prBadgeSmallText}>
                          🏆 {format(exercise.maxWeight)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
        <Text style={styles.footer}>QINETIC • {new Date().getFullYear()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000000" },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },

  // Header
  header: { marginBottom: 24 },
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

  // Loading
  loadingBox: { paddingVertical: 60, alignItems: "center" },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: "#111111",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    alignItems: "center",
  },
  statCardLarge: {
    width: "47%",
  },
  statCardValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statCardLabel: {
    fontSize: 11,
    color: "#555555",
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },

  // Card
  card: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
    overflow: "hidden",
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "#000000",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 12,
    marginTop: 4,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 4,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555555",
  },

  // Empty section
  emptySection: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  emptySectionIcon: { fontSize: 32 },
  emptySectionText: {
    fontSize: 14,
    color: "#555555",
    textAlign: "center",
    fontWeight: "500",
  },
  linkBtn: {
    backgroundColor: "#000000",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  linkBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFD944",
  },

  // PR rows
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  prRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },
  prRank: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFD944",
    justifyContent: "center",
    alignItems: "center",
  },
  prRankText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000000",
  },
  prLeft: { flex: 1 },
  prName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 2,
  },
  prMeta: { fontSize: 12, color: "#555555", fontWeight: "500" },
  prBadge: {
    backgroundColor: "#FFD944",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  prBadgeText: { fontSize: 13, fontWeight: "700", color: "#000000" },

  // Schedule
  scheduleSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#555555",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  scheduleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
  },
  scheduleRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },
  scheduleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trainingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  scheduleDayText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFD944",
  },
  scheduleCount: {
    fontSize: 13,
    color: "#555555",
    fontWeight: "500",
  },
  restDaysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  restDayChip: {
    backgroundColor: "#000000",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  restDayChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555555",
  },

  // All exercises list
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  exerciseRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },
  exerciseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  exerciseIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  exerciseIcon: { fontSize: 16 },
  exerciseName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 2,
  },
  exerciseMeta: { fontSize: 12, color: "#555555", fontWeight: "500" },
  prBadgeSmall: {
    backgroundColor: "#FFD944",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prBadgeSmallText: { fontSize: 11, fontWeight: "700", color: "#000000" },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#555555",
    letterSpacing: 1,
    fontWeight: "500",
  },

  // Streak card
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
  },
  streakStat: {
    flex: 1,
    alignItems: "center",
  },
  streakStatValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  streakStatLabel: {
    fontSize: 11,
    color: "#555555",
    fontWeight: "600",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  streakStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#222222",
  },

  // Notes
  noteGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },
  noteGroupTitle: { fontSize: 15, fontWeight: "700", color: "#FFD944" },
  noteGroupChevron: { fontSize: 13, color: "#555555" },
  noteMonthBlock: { marginLeft: 8, marginTop: 4 },
  noteMonthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  noteMonthTitle: { fontSize: 13, fontWeight: "600", color: "#FFD944" },
  noteWeekBlock: { marginLeft: 8 },
  noteWeekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  noteWeekTitle: { fontSize: 11, fontWeight: "600", color: "#555555", letterSpacing: 0.5 },
  noteDayCard: {
    backgroundColor: "#000000",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    marginLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#FFD944",
  },
  noteDayDate: { fontSize: 11, fontWeight: "700", color: "#555555", marginBottom: 4 },
  noteDayText: { fontSize: 13, color: "#FFD944", lineHeight: 18, fontWeight: "400" },
});
