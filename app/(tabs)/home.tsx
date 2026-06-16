import { Image } from "expo-image";
import { supabase } from "@/lib/supabase";
import { getExercisesByDay, getExercises } from "@/supabase/exercises";
import { getCurrentStreak, getTodayCompletion } from "@/lib/streaks";
import { getDayNote, saveDayNote } from "@/supabase/notes";
import { DayNote } from "@/supabase/notes";
import { Exercise, DAY_MAP, Day } from "@/lib/types";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useState, useCallback, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { getUserProfile } from "@/supabase/profile";
import { useWeightUnit } from "../context/WeightUnitContext";
import * as Haptics from "expo-haptics";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AppBottomSheet from "@/components/AppBottomSheet";

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

function getRingColors(pct: number) {
  const on = "#FFD944";
  const off = "#222222";
  if (pct <= 0) return { borderTopColor: off, borderRightColor: off, borderBottomColor: off, borderLeftColor: off };
  if (pct <= 25) return { borderTopColor: on, borderRightColor: off, borderBottomColor: off, borderLeftColor: off };
  if (pct <= 50) return { borderTopColor: on, borderRightColor: on, borderBottomColor: off, borderLeftColor: off };
  if (pct <= 75) return { borderTopColor: on, borderRightColor: on, borderBottomColor: on, borderLeftColor: off };
  return { borderTopColor: on, borderRightColor: on, borderBottomColor: on, borderLeftColor: on };
}

const REST_MESSAGES = [
  "Your muscles grow when you rest. 💤",
  "Recovery is part of the grind. 🔄",
  "Rest hard. Train harder tomorrow. 🙌",
  "Even champions take rest days. 🏆",
  "Sleep. Eat. Recover. Repeat. 💪",
];

const todayStr = new Date().toISOString().split("T")[0];

export default function Home() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [streakData, setStreakData] = useState<{
    currentStreak: number;
    todayCompletion: { completed: number; total: number; percentage: number; isRestDay: boolean };
  } | null>(null);
  const [todayNote, setTodayNote] = useState<DayNote | null>(null);
  const noteSheetRef = useRef<BottomSheetModal>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const today: Day = DAY_MAP[new Date().getDay()];
  const restMessage = REST_MESSAGES[new Date().getDay() % REST_MESSAGES.length];

  const { format } = useWeightUnit();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!userId) setUserId(user.id);
      if (!userEmail) setUserEmail(user.email ?? null);
      const uid = user.id;
      const [data, profile, allExercises, note] = await Promise.all([
        getExercisesByDay(uid, today),
        getUserProfile(uid),
        getExercises(uid),
        getDayNote(uid, todayStr),
      ]);
      setExercises(data);
      if (profile?.displayName) setDisplayName(profile.displayName);
      setPhotoURL(profile?.photoURL ?? null);
      setStreakData({
        currentStreak: getCurrentStreak(allExercises),
        todayCompletion: getTodayCompletion(allExercises),
      });
      setTodayNote(note);
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

  const openNoteModal = () => {
    setNoteText(todayNote?.text ?? "");
    noteSheetRef.current?.present();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await saveDayNote(userId, todayStr, noteText.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTodayNote({
        date: todayStr,
        text: noteText.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      noteSheetRef.current?.dismiss();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSavingNote(false);
    }
  };

  const getInitials = () => {
    if (displayName) return displayName.charAt(0).toUpperCase();
    if (userEmail) return userEmail.charAt(0).toUpperCase();
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
    return userEmail?.split("@")[0] ?? "User";
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
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.emailName}>{getName()}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            activeOpacity={0.8}
            style={styles.avatar}
          >
            {photoURL ? (
              <Image
                source={{ uri: photoURL }}
                style={styles.avatarPhoto}
                contentFit="cover"
              />
            ) : (
              <Text style={styles.avatarText}>{getInitials()}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Streak banner */}
        {streakData && (
          <View style={styles.streakBanner}>
            <Text style={styles.streakFireEmoji}>🔥</Text>
            <View style={styles.streakInfo}>
              <Text style={styles.streakLabel}>STREAK</Text>
              <Text style={styles.streakDays}>{streakData.currentStreak} days</Text>
            </View>
            {streakData.todayCompletion.isRestDay ? (
              <View style={styles.streakRingBox}>
                <Text style={styles.streakRingEmoji}>😴</Text>
                <Text style={styles.streakRingSmall}>rest day</Text>
              </View>
            ) : (
              <View style={[styles.streakRing, getRingColors(streakData.todayCompletion.percentage)]}>
                <Text style={styles.streakRingPct}>
                  {streakData.todayCompletion.percentage === 100 ? "✓" : `${streakData.todayCompletion.percentage}%`}
                </Text>
                <Text style={styles.streakRingSmall}>today</Text>
              </View>
            )}
          </View>
        )}

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
            <ActivityIndicator size="large" color="#FFD944" />
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
          <>
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
                    <View style={styles.exerciseEmojiBox}>
                      <Text style={styles.exerciseEmoji}>{exercise.emoji ?? "💪"}</Text>
                    </View>
                    <View>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {exercise.sets} sets · {exercise.reps} reps
                      </Text>
                      {(exercise.muscleTag || exercise.typeTag) && (
                        <View style={styles.exerciseTagRow}>
                          {exercise.muscleTag && (
                            <View style={styles.exTagMuscle}>
                              <Text style={styles.exTagMuscleText}>{exercise.muscleTag}</Text>
                            </View>
                          )}
                          {exercise.typeTag && (
                            <View style={styles.exTagType}>
                              <Text style={styles.exTagTypeText}>{exercise.typeTag}</Text>
                            </View>
                          )}
                        </View>
                      )}
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

              {(() => {
                const muscles = [
                  ...new Set(exercises.map((e) => e.muscleTag).filter(Boolean)),
                ] as string[];
                if (muscles.length === 0) return null;
                return (
                  <View style={styles.musclesSection}>
                    <Text style={styles.musclesLabel}>MUSCLES TODAY</Text>
                    <View style={styles.muscleChips}>
                      {muscles.map((m) => (
                        <View key={m} style={styles.muscleChip}>
                          <Text style={styles.muscleChipText}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })()}

              <TouchableOpacity
                style={styles.addMoreBtn}
                onPress={() => router.push("/(tabs)/exercises")}
                activeOpacity={0.85}
              >
                <Text style={styles.addMoreBtnText}>+ Add more exercises</Text>
              </TouchableOpacity>
            </View>

            {/* Note card or add note button */}
            {todayNote ? (
              <View style={styles.noteCard}>
                <View style={styles.noteCardHeader}>
                  <Text style={styles.noteCardTitle}>📝 Today's note</Text>
                  <TouchableOpacity onPress={openNoteModal} activeOpacity={0.7}>
                    <Text style={styles.noteEditBtn}>Edit</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.noteCardText}>{todayNote.text}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addNoteBtn}
                onPress={openNoteModal}
                activeOpacity={0.85}
              >
                <Text style={styles.addNoteBtnText}>📝 Add note for today</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <Text style={styles.footer}>QINETIC • {new Date().getFullYear()}</Text>
      </ScrollView>

      <AppBottomSheet
        sheetRef={noteSheetRef}
        snapPoints={["50%", "85%"]}
        onDismiss={() => setNoteText("")}
      >
        <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          <Text style={styles.modalTitle}>
            {todayNote ? "Edit note" : "Add note"}
          </Text>
          <Text style={styles.modalSub}>
            How did today's workout go? What to improve?
          </Text>
          <TextInput
            style={styles.noteInput}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Write your notes here…"
            placeholderTextColor="#333333"
            multiline
            autoFocus
            maxLength={500}
          />
          <Text style={styles.noteCharCount}>{noteText.length}/500</Text>
          <TouchableOpacity
            style={[
              styles.noteSaveBtn,
              (!noteText.trim() || savingNote) && styles.noteSaveBtnDisabled,
            ]}
            onPress={handleSaveNote}
            disabled={!noteText.trim() || savingNote}
            activeOpacity={0.85}
          >
            <Text style={styles.noteSaveBtnText}>
              {savingNote ? "Saving…" : "Save note"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalCancelBtn}
            onPress={() => noteSheetRef.current?.dismiss()}
            activeOpacity={0.7}
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000000",
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
    color: "#555555",
    fontWeight: "500",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  emailName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFD944",
    letterSpacing: -0.5,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    color: "#FFD944",
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
    backgroundColor: "#000000",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todayBadgeText: {
    color: "#FFD944",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  todayDay: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFD944",
    letterSpacing: -0.3,
  },

  // Loading
  loadingBox: {
    paddingVertical: 60,
    alignItems: "center",
  },

  // Rest day card
  restCard: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000000",
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
    color: "#FFD944",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  restMessage: {
    fontSize: 15,
    color: "#555555",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  scheduleBtn: {
    backgroundColor: "#000000",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scheduleBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFD944",
  },

  // Workout card
  workoutCard: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 20,
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
    color: "#FFD944",
  },
  workoutCountBadge: {
    backgroundColor: "#000000",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  workoutCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555555",
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
    borderBottomColor: "#222222",
  },
  exerciseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  exerciseEmojiBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  exerciseEmoji: { fontSize: 18 },
  exerciseName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 2,
  },
  exerciseMeta: {
    fontSize: 12,
    color: "#555555",
    fontWeight: "500",
  },
  exerciseTagRow: { flexDirection: "row", gap: 4, marginTop: 3 },
  exTagMuscle: {
    backgroundColor: "#FFD944",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  exTagMuscleText: { fontSize: 9, fontWeight: "700", color: "#000000" },
  exTagType: {
    backgroundColor: "#222222",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  exTagTypeText: { fontSize: 9, fontWeight: "700", color: "#FFD944" },
  exerciseRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  prBadge: {
    backgroundColor: "#FFD944",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000000",
  },
  chevron: {
    fontSize: 22,
    color: "#555555",
    fontWeight: "300",
  },

  // Muscles today
  musclesSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#222222",
  },
  musclesLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#555555",
    letterSpacing: 1,
    marginBottom: 8,
  },
  muscleChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  muscleChip: {
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#222222",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  muscleChipText: { fontSize: 11, fontWeight: "600", color: "#FFD944" },

  // Add more button
  addMoreBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#000000",
    alignItems: "center",
  },
  addMoreBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFD944",
  },

  // Note card
  noteCard: {
    backgroundColor: "#111111",
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#FFD944",
  },
  noteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  noteCardTitle: { fontSize: 13, fontWeight: "700", color: "#FFD944" },
  noteEditBtn: { fontSize: 12, fontWeight: "600", color: "#555555" },
  noteCardText: { fontSize: 14, color: "#FFD944", lineHeight: 20, fontWeight: "400" },
  addNoteBtn: {
    backgroundColor: "#111111",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: "#222222",
    borderStyle: "dashed",
  },
  addNoteBtnText: { fontSize: 14, fontWeight: "600", color: "#555555" },

  // Note sheet
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: "#555555",
    fontWeight: "500",
    marginBottom: 16,
  },
  noteInput: {
    backgroundColor: "#000000",
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: "#FFD944",
    fontWeight: "400",
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1.5,
    borderColor: "#222222",
  },
  noteCharCount: {
    fontSize: 11,
    color: "#333333",
    textAlign: "right",
    marginTop: 6,
    marginBottom: 16,
  },
  noteSaveBtn: {
    backgroundColor: "#FFD944",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  noteSaveBtnDisabled: { backgroundColor: "#333333" },
  noteSaveBtnText: { color: "#000000", fontSize: 16, fontWeight: "700" },
  modalCancelBtn: { paddingVertical: 12, alignItems: "center" },
  modalCancelText: { fontSize: 15, color: "#555555", fontWeight: "600" },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#555555",
    letterSpacing: 1,
    fontWeight: "500",
    marginTop: 16,
  },

  // Streak banner
  streakBanner: {
    backgroundColor: "#111111",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  streakFireEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  streakInfo: {
    flex: 1,
  },
  streakLabel: {
    fontSize: 11,
    color: "#555555",
    fontWeight: "700",
    letterSpacing: 1,
  },
  streakDays: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFD944",
  },
  streakRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  streakRingPct: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFD944",
  },
  streakRingSmall: {
    fontSize: 10,
    color: "#555555",
  },
  streakRingBox: {
    width: 52,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  streakRingEmoji: {
    fontSize: 22,
  },
});
