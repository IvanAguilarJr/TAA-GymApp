import { signOut } from "firebase/auth";
import { auth } from "@/firebase/config";
import { getExercisesByDay } from "@/firebase/exercises";
import { Exercise, DAY_MAP, Day } from "@/firebase/types";
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
import { getUserProfile } from "@/firebase/profile";
import { useWeightUnit } from "../context/WeightUnitContext";

const DAY_FULL: Record<Day, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
  None: "Unscheduled",
};

const REST_MESSAGES = [
  "Your muscles grow when you rest. 💤",
  "Recovery is part of the grind. 🔄",
  "Rest hard. Train harder tomorrow. 🙌",
  "Even champions take rest days. 🏆",
  "Sleep. Eat. Recover. Repeat. 💪",
];

export default function Home() {
  const user = auth.currentUser;
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const today: Day = DAY_MAP[new Date().getDay()];
  const restMessage = REST_MESSAGES[new Date().getDay() % REST_MESSAGES.length];

  const { format } = useWeightUnit();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [data, profile] = await Promise.all([
        getExercisesByDay(user!.uid, today),
        getUserProfile(user!.uid),
      ]);
      setExercises(data);
      if (profile?.displayName) setDisplayName(profile.displayName);
    } catch {
      // fail silently on home screen
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, []),
  );

  const logout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const getInitials = () => {
    if (displayName) return displayName.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return "?";
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getName = () => {
    if (displayName) return displayName;
    return user?.email?.split("@")[0] ?? "User";
  };

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
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.emailName}>{getName()}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push("/settings")}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </TouchableOpacity>
        </View>

        {/* Today label */}
        <View style={styles.todayRow}>
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>TODAY</Text>
          </View>
          <Text style={styles.todayDay}>{DAY_FULL[today]}</Text>
        </View>

        {/* Workout content */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#1A1714" />
          </View>
        ) : exercises.length === 0 ? (
          /* ── Rest Day ── */
          <View style={styles.restCard}>
            <View style={styles.cardAccent} />
            <Text style={styles.restEmoji}>😴</Text>
            <Text style={styles.restTitle}>Rest Day</Text>
            <Text style={styles.restMessage}>{restMessage}</Text>
            <TouchableOpacity
              style={styles.scheduleBtn}
              onPress={() => router.push("/(tabs)/exercises")}
              activeOpacity={0.85}
            >
              <Text style={styles.scheduleBtnText}>
                Schedule exercises for {DAY_FULL[today]} →
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Today's Workout ── */
          <View style={styles.workoutCard}>
            <View style={styles.cardAccent} />
            <View style={styles.workoutCardHeader}>
              <Text style={styles.workoutCardTitle}>Today's Workout</Text>
              <View style={styles.workoutCountBadge}>
                <Text style={styles.workoutCountText}>
                  {exercises.length} exercise{exercises.length !== 1 ? "s" : ""}
                </Text>
              </View>
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
                  <View style={styles.exerciseNumberBox}>
                    <Text style={styles.exerciseNumber}>{index + 1}</Text>
                  </View>
                  <View>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {exercise.sets} sets · {exercise.reps} reps
                    </Text>
                  </View>
                </View>
                <View style={styles.exerciseRight}>
                  {exercise.maxWeight > 0 && (
                    <View style={styles.prBadge}>
                      <Text style={styles.prText}>
                        🏆 {format(exercise.maxWeight)}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.addMoreBtn}
              onPress={() => router.push("/(tabs)/exercises")}
              activeOpacity={0.85}
            >
              <Text style={styles.addMoreBtnText}>+ Add more exercises</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 24 }} />

        {/* Sign out */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={logout}
          activeOpacity={0.85}
        >
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>TAA • {new Date().getFullYear()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F7F5F2",
  },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  greeting: {
    fontSize: 14,
    color: "#9E9890",
    fontWeight: "500",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  emailName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1A1714",
    letterSpacing: -0.5,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1A1714",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#F7F5F2",
    fontSize: 20,
    fontWeight: "700",
  },

  // Today row
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  todayBadge: {
    backgroundColor: "#1A1714",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todayBadgeText: {
    color: "#F7F5F2",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  todayDay: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1714",
    letterSpacing: -0.3,
  },

  // Loading
  loadingBox: {
    paddingVertical: 60,
    alignItems: "center",
  },

  // Rest day card
  restCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
    overflow: "hidden",
  },
  restEmoji: {
    fontSize: 52,
    marginBottom: 12,
    marginTop: 8,
  },
  restTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1714",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  restMessage: {
    fontSize: 15,
    color: "#9E9890",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  scheduleBtn: {
    backgroundColor: "#F7F5F2",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scheduleBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1714",
  },

  // Workout card
  workoutCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
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
  workoutCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  workoutCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1714",
  },
  workoutCountBadge: {
    backgroundColor: "#F7F5F2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  workoutCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9E9890",
  },

  // Exercise rows inside workout card
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
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
  exerciseNumberBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#1A1714",
    justifyContent: "center",
    alignItems: "center",
  },
  exerciseNumber: {
    color: "#F7F5F2",
    fontSize: 13,
    fontWeight: "700",
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1714",
    marginBottom: 2,
  },
  exerciseMeta: {
    fontSize: 12,
    color: "#9E9890",
    fontWeight: "500",
  },
  exerciseRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  prBadge: {
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#854D0E",
  },
  chevron: {
    fontSize: 22,
    color: "#C4BFB8",
    fontWeight: "300",
  },

  // Add more button
  addMoreBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F7F5F2",
    alignItems: "center",
  },
  addMoreBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1714",
  },

  // Sign out
  logoutBtn: {
    backgroundColor: "#1A1714",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  logoutText: {
    color: "#F7F5F2",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#C4BFB8",
    letterSpacing: 1,
    fontWeight: "500",
  },
});
