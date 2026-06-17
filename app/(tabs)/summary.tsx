import { supabase } from "@/lib/supabase";
import { getExercises } from "@/supabase/exercises";
import { Exercise } from "@/lib/types";
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { C, getExerciseTileBg } from "@/lib/colors";

function CircularProgress({ percentage, size = 72 }: { percentage: number; size?: number }) {
  const sw = 5;
  const r = (size - sw * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(Math.max(percentage, 0), 100) / 100) * circ;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={C.bgSurface3} strokeWidth={sw} fill="none" />
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={C.accentYellow}
          strokeWidth={sw}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <View style={{
        position: "absolute", top: 0, left: 0, width: size, height: size,
        justifyContent: "center", alignItems: "center",
      }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: C.accentYellow }}>
          {percentage}%
        </Text>
        <Text style={{ fontSize: 9, color: C.textSecondary, fontWeight: "600" }}>today</Text>
      </View>
    </View>
  );
}

function getExerciseIcon(exercise: Exercise): keyof typeof MaterialCommunityIcons.glyphMap {
  const muscle = exercise.muscleTag?.toLowerCase() ?? "";
  if (muscle === "legs" || muscle === "glutes") return "run-fast";
  return "dumbbell";
}

function getDaysAgo(isoDate: string): number {
  const d = new Date(isoDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Summary() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const { format } = useWeightUnit();

  const fetchData = async () => {
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
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const totalSessions = exercises.reduce((sum, e) => sum + e.history.length, 0);
  const totalPRs = exercises.filter((e) => e.maxWeight > 0).length;
  const heaviestLift = exercises.reduce((max, e) => (e.maxWeight > max ? e.maxWeight : max), 0);

  const topPR = [...exercises]
    .filter((e) => e.maxWeight > 0)
    .sort((a, b) => b.maxWeight - a.maxWeight)[0] ?? null;

  const topPRLastDate = topPR?.history.length
    ? topPR.history[topPR.history.length - 1].date
    : null;

  const topPRDaysAgo = topPRLastDate !== null ? getDaysAgo(topPRLastDate) : null;

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
    new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

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

  const renderNotesContent = () => {
    if (notes.length === 0) {
      return (
        <Text style={styles.notesEmpty}>No notes yet. Add one from the Home tab.</Text>
      );
    }

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
        <TouchableOpacity style={styles.noteGroupHeader} onPress={() => toggleGroup(year)} activeOpacity={0.7}>
          <Text style={styles.noteGroupTitle}>{year}</Text>
          <MaterialCommunityIcons name={expandedGroups.has(year) ? "chevron-down" : "chevron-right"} size={16} color={C.textTertiary} />
        </TouchableOpacity>

        {expandedGroups.has(year) &&
          Object.entries(months).map(([monthKey, weeks]) => (
            <View key={monthKey} style={styles.noteMonthBlock}>
              <TouchableOpacity style={styles.noteMonthHeader} onPress={() => toggleGroup(monthKey)} activeOpacity={0.7}>
                <Text style={styles.noteMonthTitle}>{formatMonthLabel(monthKey)}</Text>
                <MaterialCommunityIcons name={expandedGroups.has(monthKey) ? "chevron-down" : "chevron-right"} size={14} color={C.textTertiary} />
              </TouchableOpacity>

              {expandedGroups.has(monthKey) &&
                Object.entries(weeks).map(([weekKey, dayNotes]) => (
                  <View key={weekKey} style={styles.noteWeekBlock}>
                    <TouchableOpacity style={styles.noteWeekHeader} onPress={() => toggleGroup(weekKey)} activeOpacity={0.7}>
                      <Text style={styles.noteWeekTitle}>{weekKey.replace("-", " · ")}</Text>
                      <MaterialCommunityIcons name={expandedGroups.has(weekKey) ? "chevron-down" : "chevron-right"} size={12} color={C.textTertiary} />
                    </TouchableOpacity>

                    {expandedGroups.has(weekKey) &&
                      dayNotes.map((note) => (
                        <View key={note.date} style={styles.noteDayCard}>
                          <Text style={styles.noteDayDate}>{formatDateLabel(note.date)}</Text>
                          <Text style={styles.noteDayText}>{note.text}</Text>
                        </View>
                      ))}
                  </View>
                ))}
            </View>
          ))}
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
          <Text style={styles.headerTitle}>Summary</Text>
          <Text style={styles.headerSub}>Your fitness overview</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.accentYellow} />
          </View>
        ) : (
          <>
            {/* Fused 2x2 stat grid — always visible */}
            <View style={styles.fusedGrid}>
              <View style={[styles.statCell, styles.statCellRight, styles.statCellBottom]}>
                <Text style={styles.statValue}>{exercises.length}</Text>
                <Text style={styles.statLabel}>Exercises</Text>
              </View>
              <View style={[styles.statCell, styles.statCellBottom]}>
                <Text style={styles.statValue}>{totalSessions}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
              <View style={[styles.statCell, styles.statCellRight]}>
                <Text style={styles.statValue}>{totalPRs}</Text>
                <Text style={styles.statLabel}>PRs Set</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>
                  {heaviestLift > 0 ? format(heaviestLift) : "—"}
                </Text>
                <Text style={styles.statLabel}>Heaviest Lift</Text>
              </View>
            </View>

            {/* Session-gated sections */}
            {totalSessions === 0 ? (
              <View style={styles.emptyStateCard}>
                <MaterialCommunityIcons name="dumbbell" size={40} color={C.textTertiary} />
                <Text style={styles.emptyStateTitle}>No sessions yet</Text>
                <Text style={styles.emptyStateText}>
                  Log your first workout to unlock streak tracking and personal records.
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateCta}
                  onPress={() => router.push("/(tabs)/exercises")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyStateCtaText}>Go to exercises</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Streak */}
                <View style={styles.streakCard}>
                  <View style={styles.streakCardTop}>
                    <MaterialCommunityIcons name="fire" size={16} color={C.accentOrange} />
                    <Text style={styles.streakCardLabel}>STREAK</Text>
                  </View>
                  <View style={styles.streakCardBody}>
                    <View style={styles.streakCountCol}>
                      <Text style={styles.streakBig}>{currentStreak}</Text>
                      <Text style={styles.streakUnit}>day streak</Text>
                      <Text style={styles.streakBest}>best: {longestStreak}d</Text>
                    </View>
                    <CircularProgress percentage={todayCompletion.percentage} size={80} />
                  </View>
                </View>

                {/* Top PR */}
                {topPR && (
                  <TouchableOpacity
                    style={styles.prCard}
                    onPress={() => router.push(`/exercise/${topPR.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.prCardTop}>
                      <MaterialCommunityIcons name="trophy-outline" size={14} color={C.textSecondary} />
                      <Text style={styles.prCardLabel}>TOP PR</Text>
                    </View>
                    <View style={styles.prCardRow}>
                      <View style={[styles.prIconTile, { backgroundColor: getExerciseTileBg(topPR.color ?? C.accentYellow) }]}>
                        <MaterialCommunityIcons
                          name="trophy-outline"
                          size={18}
                          color={topPR.color ?? C.accentYellow}
                        />
                      </View>
                      <View style={styles.prInfo}>
                        <Text style={styles.prName}>{topPR.name}</Text>
                        {topPRDaysAgo !== null && (
                          <Text style={styles.prDays}>
                            {topPRDaysAgo === 0 ? "today" : topPRDaysAgo === 1 ? "yesterday" : `${topPRDaysAgo}d ago`}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.prWeight, { color: topPR.color ?? C.accentYellow }]}>
                        {format(topPR.maxWeight)}
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={C.textQuaternary} />
                    </View>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Notes — always renders */}
            <View style={styles.notesSection}>
              <TouchableOpacity
                style={styles.notesRow}
                onPress={() => setNotesExpanded((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.notesIconTile, { backgroundColor: C.accentBlueBg }]}>
                  <MaterialCommunityIcons name="notebook-outline" size={18} color={C.accentBlue} />
                </View>
                <Text style={styles.notesLabel}>Notes</Text>
                {notes.length > 0 && (
                  <View style={styles.notesBadge}>
                    <Text style={styles.notesBadgeText}>{notes.length}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <MaterialCommunityIcons
                  name={notesExpanded ? "chevron-up" : "chevron-right"}
                  size={20}
                  color={C.textQuaternary}
                />
              </TouchableOpacity>

              {notesExpanded && (
                <View style={styles.notesContent}>
                  {renderNotesContent()}
                </View>
              )}
            </View>
          </>
        )}

        <View style={{ height: 16 }} />
        <Text style={styles.footer}>QINETIC · {new Date().getFullYear()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const HAIRLINE = 0.5;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBlack },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },

  header: { marginBottom: 24 },
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

  loadingBox: { paddingVertical: 60, alignItems: "center" },

  // Fused 2x2 stat grid
  fusedGrid: {
    backgroundColor: C.bgSurface1,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  statCell: {
    width: "50%",
    padding: 20,
    alignItems: "center",
  },
  statCellRight: {
    borderRightWidth: HAIRLINE,
    borderRightColor: C.bgSurface2,
  },
  statCellBottom: {
    borderBottomWidth: HAIRLINE,
    borderBottomColor: C.bgSurface2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: C.accentYellow,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },

  // Empty state
  emptyStateCard: {
    backgroundColor: C.bgSurface1,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.textPrimary,
    marginTop: 4,
  },
  emptyStateText: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
  },
  emptyStateCta: {
    backgroundColor: C.accentYellow,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  emptyStateCtaText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.accentYellowText,
  },

  // Streak card
  streakCard: {
    backgroundColor: C.bgSurface1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  streakCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  streakCardLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textSecondary,
    letterSpacing: 1.2,
  },
  streakCardBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streakCountCol: { flex: 1 },
  streakBig: {
    fontSize: 48,
    fontWeight: "700",
    color: C.textPrimary,
    letterSpacing: -2,
    lineHeight: 52,
  },
  streakUnit: {
    fontSize: 14,
    color: C.textSecondary,
    fontWeight: "500",
    marginTop: 4,
  },
  streakBest: {
    fontSize: 12,
    color: C.textTertiary,
    fontWeight: "500",
    marginTop: 4,
  },

  // Top PR card
  prCard: {
    backgroundColor: C.bgSurface1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  prCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  prCardLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textSecondary,
    letterSpacing: 1.2,
  },
  prCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  prIconTile: {
    width: 40,
    height: 40,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  prInfo: { flex: 1 },
  prName: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: 2,
  },
  prDays: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: "500",
  },
  prWeight: {
    fontSize: 15,
    fontWeight: "700",
  },

  // Notes section
  notesSection: {
    backgroundColor: C.bgSurface1,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  notesIconTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  notesLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textPrimary,
  },
  notesBadge: {
    backgroundColor: C.bgSurface3,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  notesBadgeText: {
    fontSize: 11,
    color: C.textSecondary,
    fontWeight: "600",
  },
  notesContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: HAIRLINE,
    borderTopColor: C.bgSurface2,
    paddingTop: 12,
  },
  notesEmpty: {
    fontSize: 13,
    color: C.textTertiary,
    fontWeight: "500",
    paddingVertical: 8,
  },

  // Notes hierarchy
  noteGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: C.bgSurface2,
  },
  noteGroupTitle: { fontSize: 15, fontWeight: "700", color: C.textPrimary },
  noteMonthBlock: { marginLeft: 8, marginTop: 4 },
  noteMonthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  noteMonthTitle: { fontSize: 13, fontWeight: "600", color: C.textPrimary },
  noteWeekBlock: { marginLeft: 8 },
  noteWeekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  noteWeekTitle: { fontSize: 11, fontWeight: "600", color: C.textSecondary, letterSpacing: 0.5 },
  noteDayCard: {
    backgroundColor: C.bgBlack,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    marginLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: C.accentBlue,
  },
  noteDayDate: { fontSize: 11, fontWeight: "700", color: C.textSecondary, marginBottom: 4 },
  noteDayText: { fontSize: 13, color: C.textPrimary, lineHeight: 18, fontWeight: "400" },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: C.textTertiary,
    letterSpacing: 1,
    fontWeight: "500",
  },
});
