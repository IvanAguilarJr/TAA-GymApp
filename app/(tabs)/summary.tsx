import { supabase } from "@/lib/supabase";
import { getExercises } from "@/supabase/exercises";
import { Exercise } from "@/lib/types";
import { getWeekNotes, deleteNote, cleanupOldNotes, WeekNote, getCurrentWeekRange } from "@/supabase/notes";
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
import * as Haptics from "expo-haptics";

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

function getDaysAgo(isoDate: string): number {
  const d = new Date(isoDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatNoteDay(isoString: string): string {
  const d = new Date(isoString);
  return `${WEEKDAYS_SHORT[d.getDay()].toUpperCase()}, ${MONTHS_SHORT[d.getMonth()].toUpperCase()} ${d.getDate()}`;
}

function formatWeekRange(start: Date, end: Date): string {
  const s = `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()}`;
  const e = `${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`;
  return `${s} – ${e}`;
}

export default function Summary() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState<WeekNote[]>([]);
  const [loading, setLoading] = useState(true);
  const { format } = useWeightUnit();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await cleanupOldNotes(user.id).catch(() => {});
      const [data, weekNotes] = await Promise.all([
        getExercises(user.id),
        getWeekNotes(user.id),
      ]);
      setExercises(data);
      setNotes(weekNotes);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

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

  const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
  const weekRangeLabel = formatWeekRange(weekStart, weekEnd);

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

            {/* Notes — always renders as one consolidated card */}
            <View style={styles.notesMegaCard}>
              {/* Header row */}
              <View style={styles.notesMegaHeader}>
                <View style={styles.notesHeaderIconTile}>
                  <MaterialCommunityIcons name="notebook-outline" size={16} color={C.accentBlue} />
                </View>
                <Text style={styles.notesSectionTitle}>Weekly Notes</Text>
              </View>

              <View style={styles.hairline} />

              {/* Week banner row */}
              <View style={styles.weekBannerRow}>
                <View>
                  <Text style={styles.weekBannerEyebrow}>THIS WEEK</Text>
                  <Text style={styles.weekBannerRange}>{weekRangeLabel}</Text>
                </View>
                <View style={styles.resetPill}>
                  <MaterialCommunityIcons name="refresh" size={11} color={C.textTertiary} />
                  <Text style={styles.resetPillText}>Resets Sun</Text>
                </View>
              </View>

              <View style={styles.hairline} />

              {/* Note rows or empty state */}
              {notes.length === 0 ? (
                <View style={styles.notesEmptyRow}>
                  <MaterialCommunityIcons name="notebook-outline" size={32} color={C.textQuaternary} />
                  <Text style={styles.notesEmptyText}>
                    No notes yet this week.{"\n"}Add one after your next session.
                  </Text>
                </View>
              ) : (
                notes.map((note, index) => (
                  <View key={note.id}>
                    <View style={styles.noteRow}>
                      <View style={styles.noteRowContent}>
                        <Text style={styles.noteCardDay}>{formatNoteDay(note.createdAt)}</Text>
                        <Text style={styles.noteCardText}>{note.text}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.noteDeleteBtn}
                        onPress={() => handleDeleteNote(note.id)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons name="close" size={14} color={C.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    {index < notes.length - 1 && <View style={styles.hairline} />}
                  </View>
                ))
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

  // Notes — single consolidated card
  notesMegaCard: {
    backgroundColor: C.bgSurface1,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
  },
  notesMegaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  notesHeaderIconTile: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.accentBlueBg,
    justifyContent: "center",
    alignItems: "center",
  },
  notesSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textPrimary,
  },
  hairline: {
    height: HAIRLINE,
    backgroundColor: C.bgSurface2,
  },
  weekBannerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  weekBannerEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  weekBannerRange: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textPrimary,
  },
  resetPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.bgSurface3,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resetPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textTertiary,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  noteRowContent: { flex: 1 },
  noteCardDay: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  noteCardText: {
    fontSize: 14,
    color: C.textPrimary,
    lineHeight: 20,
    fontWeight: "400",
  },
  noteDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.bgSurface3,
    justifyContent: "center",
    alignItems: "center",
  },
  notesEmptyRow: {
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  notesEmptyText: {
    fontSize: 14,
    color: C.textTertiary,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: C.textTertiary,
    letterSpacing: 1,
    fontWeight: "500",
  },
});
