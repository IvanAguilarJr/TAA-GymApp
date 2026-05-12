import { auth } from "@/firebase/config";
import { getExercises } from "@/firebase/exercises";
import { Exercise, ALL_DAYS, Day } from "@/firebase/types";
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
  const user = auth.currentUser;
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExercises = async () => {
    setLoading(true);
    try {
      const data = await getExercises(user!.uid);
      setExercises(data);
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
    (day) => day !== "None" && exercises.some((e) => e.day === day),
  );

  const restDays = ALL_DAYS.filter(
    (day) => day !== "None" && !exercises.some((e) => e.day === day),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5F2" />

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
            <ActivityIndicator size="large" color="#1A1714" />
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
                  {heaviestLift > 0 ? `${heaviestLift}kg` : "—"}
                </Text>
                <Text style={styles.statCardLabel}>Heaviest Lift</Text>
              </View>
            </View>

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
                        {DAY_LABELS[exercise.day ?? "None"]}
                      </Text>
                    </View>
                    <View style={styles.prBadge}>
                      <Text style={styles.prBadgeText}>
                        {exercise.maxWeight} kg
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
                          (e) => e.day === day,
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
                          {DAY_LABELS[exercise.day ?? "None"]}
                        </Text>
                      </View>
                    </View>
                    {exercise.maxWeight > 0 && (
                      <View style={styles.prBadgeSmall}>
                        <Text style={styles.prBadgeSmallText}>
                          🏆 {exercise.maxWeight} kg
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
        <Text style={styles.footer}>TAA • {new Date().getFullYear()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F5F2" },
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
    color: "#1A1714",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: "#9E9890",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#1A1714",
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
    color: "#1A1714",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statCardLabel: {
    fontSize: 11,
    color: "#9E9890",
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#1A1714",
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
    backgroundColor: "#1A1714",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1714",
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
    color: "#9E9890",
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
    color: "#9E9890",
    textAlign: "center",
    fontWeight: "500",
  },
  linkBtn: {
    backgroundColor: "#F7F5F2",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  linkBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1714",
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
    borderBottomColor: "#EEEBE6",
  },
  prRank: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FEF9C3",
    justifyContent: "center",
    alignItems: "center",
  },
  prRankText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#854D0E",
  },
  prLeft: { flex: 1 },
  prName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1714",
    marginBottom: 2,
  },
  prMeta: { fontSize: 12, color: "#9E9890", fontWeight: "500" },
  prBadge: {
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  prBadgeText: { fontSize: 13, fontWeight: "700", color: "#854D0E" },

  // Schedule
  scheduleSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9E9890",
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
    borderBottomColor: "#EEEBE6",
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
    color: "#1A1714",
  },
  scheduleCount: {
    fontSize: 13,
    color: "#9E9890",
    fontWeight: "500",
  },
  restDaysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  restDayChip: {
    backgroundColor: "#F7F5F2",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  restDayChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9E9890",
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
    borderBottomColor: "#EEEBE6",
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
    backgroundColor: "#F7F5F2",
    justifyContent: "center",
    alignItems: "center",
  },
  exerciseIcon: { fontSize: 16 },
  exerciseName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1714",
    marginBottom: 2,
  },
  exerciseMeta: { fontSize: 12, color: "#9E9890", fontWeight: "500" },
  prBadgeSmall: {
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prBadgeSmallText: { fontSize: 11, fontWeight: "700", color: "#854D0E" },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#C4BFB8",
    letterSpacing: 1,
    fontWeight: "500",
  },
});
