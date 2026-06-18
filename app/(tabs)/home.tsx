import { Image } from "expo-image";
import { supabase } from "@/lib/supabase";
import { getExercises, getExercisesByDay } from "@/supabase/exercises";
import { getCurrentStreak, getTodayCompletion } from "@/lib/streaks";
import { getWeekNotes, saveNote, cleanupOldNotes, WeekNote } from "@/supabase/notes";
import { Exercise, DAY_MAP, Day } from "@/lib/types";
import { C, getExerciseTileBg } from "@/lib/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday", None: "Unscheduled",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatNoteWeekday(isoString: string): string {
  return WEEKDAYS[new Date(isoString).getDay()];
}

function getTodaySetsCount(exercise: Exercise): number {
  const todayStr = new Date().toISOString().split("T")[0];
  return exercise.history
    .filter((e) => e.date.split("T")[0] === todayStr)
    .reduce((sum, e) => sum + e.sets.length, 0);
}

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
  const [latestNote, setLatestNote] = useState<WeekNote | null>(null);
  const [todayNote, setTodayNote] = useState<WeekNote | null>(null);
  const noteSheetRef = useRef<BottomSheetModal>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const today: Day = DAY_MAP[new Date().getDay()];
  const { format } = useWeightUnit();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!userId) setUserId(user.id);
      if (!userEmail) setUserEmail(user.email ?? null);
      const uid = user.id;
      await cleanupOldNotes(uid).catch(() => {});
      const [data, profile, allExercises, weekNotes] = await Promise.all([
        getExercisesByDay(uid, today),
        getUserProfile(uid),
        getExercises(uid),
        getWeekNotes(uid),
      ]);
      setExercises(data);
      if (profile?.displayName) setDisplayName(profile.displayName);
      setPhotoURL(profile?.photoURL ?? null);
      setStreakData({
        currentStreak: getCurrentStreak(allExercises),
        todayCompletion: getTodayCompletion(allExercises),
      });
      const todayStr = new Date().toISOString().split("T")[0];
      setLatestNote(weekNotes[0] ?? null);
      setTodayNote(weekNotes.find((n) => n.noteDate === todayStr) ?? null);
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
    // Prefill with today's existing note text if one already exists (edit mode)
    setNoteText(todayNote?.text ?? "");
    noteSheetRef.current?.present();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const saved = await saveNote(userId, noteText.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLatestNote(saved);
      setTodayNote(saved);
      noteSheetRef.current?.dismiss();
    } catch (err) {
      console.error("[home] saveNote failed:", err);
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

  const getDateSubtitle = () => {
    const now = new Date();
    const dayName = DAY_FULL[today];
    const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    return `${dayName} · ${dateStr}`;
  };

  const progressPct = streakData?.todayCompletion.isRestDay
    ? 0
    : (streakData?.todayCompletion.percentage ?? 0);

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
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.dateSubtitle}>{getDateSubtitle()}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            activeOpacity={0.8}
            style={styles.avatar}
          >
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarPhoto} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{getInitials()}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Stat tiles */}
        {streakData && (
          <View style={styles.statTilesRow}>
            {/* Streak tile */}
            <View style={styles.statTile}>
              <View style={styles.statTileHeader}>
                <MaterialCommunityIcons name="fire" size={16} color={C.accentOrange} />
                <Text style={styles.statTileLabel}>STREAK</Text>
              </View>
              <Text style={styles.statTileValue}>{streakData.currentStreak}</Text>
              <Text style={styles.statTileUnit}>day streak</Text>
            </View>

            {/* Completion tile */}
            <View style={styles.statTile}>
              <View style={styles.statTileHeader}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={16} color={C.accentBlue} />
                <Text style={styles.statTileLabel}>TODAY</Text>
              </View>
              {streakData.todayCompletion.isRestDay ? (
                <>
                  <Text style={styles.statTileValue}>—</Text>
                  <Text style={styles.statTileUnit}>rest day</Text>
                </>
              ) : (
                <>
                  <Text style={styles.statTileValue}>
                    {streakData.todayCompletion.completed} of {streakData.todayCompletion.total}
                  </Text>
                  <Text style={styles.statTileUnit}>exercises done</Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* Progress bar */}
        {streakData && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
        )}

        {/* Exercises section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          <Text style={styles.sectionCount}>
            {exercises.length} scheduled
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.accentYellow} />
          </View>
        ) : exercises.length === 0 ? (
          <View style={styles.restDayRow}>
            <MaterialCommunityIcons name="sleep" size={18} color={C.textTertiary} />
            <Text style={styles.restDayText}>
              {today === "None" ? "No exercises scheduled" : "Rest day — nothing planned"}
            </Text>
          </View>
        ) : (
          exercises.map((exercise) => {
            const todaySets = getTodaySetsCount(exercise);
            const exColor = exercise.color ?? C.accentYellow;
            const isNotStarted = todaySets === 0;
            return (
              <TouchableOpacity
                key={exercise.id}
                style={[styles.exerciseRow, isNotStarted && styles.exerciseRowDimmed]}
                onPress={() => router.push(`/exercise/${exercise.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.exerciseColorBar, { backgroundColor: exColor }]} />
                <View style={styles.exerciseInner}>
                  <View style={[styles.exerciseIconTile, { backgroundColor: getExerciseTileBg(exColor) }]}>
                    <MaterialCommunityIcons
                      name={exercise.muscleTag?.toLowerCase() === "legs" || exercise.muscleTag?.toLowerCase() === "glutes" ? "run-fast" : "dumbbell"}
                      size={16}
                      color={exColor}
                    />
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseName, isNotStarted && styles.exerciseNameDimmed]} numberOfLines={1}>
                      {exercise.name}
                    </Text>
                    <Text style={styles.exerciseSub}>
                      {isNotStarted
                        ? "not started"
                        : `${todaySets} of ${exercise.sets} sets logged`}
                    </Text>
                  </View>
                  <View style={styles.exerciseRight}>
                    {exercise.maxWeight > 0 ? (
                      <Text style={[styles.exerciseMaxWeight, { color: exColor }]}>
                        {format(exercise.maxWeight)}
                      </Text>
                    ) : (
                      <Text style={styles.exerciseNoData}>—</Text>
                    )}
                    <MaterialCommunityIcons name="chevron-right" size={16} color={C.textQuaternary} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Add more pill */}
        <TouchableOpacity
          style={styles.addMorePill}
          onPress={() => router.push("/(tabs)/exercises")}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="plus" size={16} color={C.accentBlue} />
          <Text style={styles.addMorePillText}>Add more exercises</Text>
        </TouchableOpacity>

        {/* Latest note card — only renders if there are notes this week */}
        {latestNote && (
          <View style={styles.noteCard}>
            <View style={styles.noteColorBar} />
            <View style={styles.noteCardInner}>
              <View style={styles.noteCardContent}>
                <Text style={styles.noteCardEyebrow}>
                  LATEST NOTE · {formatNoteWeekday(latestNote.createdAt)}
                </Text>
                <Text style={styles.noteCardText} numberOfLines={2}>
                  {latestNote.text}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.noteAddBtn}
                onPress={openNoteModal}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="plus" size={18} color={C.accentYellowText} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.footer}>QINETIC · {new Date().getFullYear()}</Text>
      </ScrollView>

      <AppBottomSheet
        sheetRef={noteSheetRef}
        snapPoints={["50%", "85%"]}
        onDismiss={() => setNoteText("")}
      >
        <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          <Text style={styles.modalTitle}>
            {todayNote ? "Edit today's note" : "New note"}
          </Text>
          <Text style={styles.modalSub}>
            How did the session go? What to improve?
          </Text>
          <TextInput
            style={styles.noteInput}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Write your notes here…"
            placeholderTextColor={C.textTertiary}
            multiline
            autoFocus
            maxLength={500}
          />
          <Text style={styles.noteCharCount}>{noteText.length}/500</Text>
          <TouchableOpacity
            style={[styles.noteSaveBtn, (!noteText.trim() || savingNote) && styles.noteSaveBtnDisabled]}
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
  safe: { flex: 1, backgroundColor: C.bgBlack },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "700",
    color: C.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  dateSubtitle: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "500",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.bgSurface2,
    borderWidth: 1,
    borderColor: C.bgSurface3,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarPhoto: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: C.accentYellow, fontSize: 18, fontWeight: "700" },

  // Stat tiles
  statTilesRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statTile: {
    flex: 1,
    backgroundColor: C.bgSurface1,
    borderRadius: 16,
    padding: 16,
  },
  statTileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  statTileLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textSecondary,
    letterSpacing: 1.2,
  },
  statTileValue: {
    fontSize: 22,
    fontWeight: "700",
    color: C.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statTileUnit: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: "500",
  },

  // Progress bar
  progressTrack: {
    height: 6,
    backgroundColor: C.bgSurface2,
    borderRadius: 3,
    marginBottom: 24,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: C.accentYellow,
    borderRadius: 3,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.textPrimary,
  },
  sectionCount: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "500",
  },

  loadingBox: { paddingVertical: 40, alignItems: "center" },

  // Rest day
  restDayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.bgSurface1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  restDayText: {
    fontSize: 14,
    color: C.textSecondary,
    fontWeight: "500",
  },

  // Exercise rows
  exerciseRow: {
    flexDirection: "row",
    backgroundColor: C.bgSurface1,
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  exerciseRowDimmed: { opacity: 0.55 },
  exerciseColorBar: {
    width: 4,
  },
  exerciseInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 12,
  },
  exerciseIconTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  exerciseInfo: { flex: 1 },
  exerciseName: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: 2,
  },
  exerciseNameDimmed: { color: C.textLightGray },
  exerciseSub: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: "500",
  },
  exerciseRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  exerciseMaxWeight: {
    fontSize: 13,
    fontWeight: "700",
  },
  exerciseNoData: {
    fontSize: 16,
    color: C.textTertiary,
    fontWeight: "500",
  },

  // Add more pill
  addMorePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.bgSurface1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.accentBlueBg,
  },
  addMorePillText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.accentBlue,
  },

  // Note card — inset yellow bar sits inside padded card
  noteCard: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: C.bgSurface1,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
    padding: 14,
    gap: 12,
  },
  noteColorBar: {
    width: 3,
    backgroundColor: C.accentYellow,
    borderRadius: 2,
    alignSelf: "stretch",
  },
  noteCardInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  noteCardContent: { flex: 1 },
  noteCardEyebrow: {
    fontSize: 11,
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
  noteAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: C.accentYellow,
    justifyContent: "center",
    alignItems: "center",
  },

  // Note sheet
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: C.accentYellow,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "500",
    marginBottom: 16,
  },
  noteInput: {
    backgroundColor: C.bgBlack,
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: C.textPrimary,
    fontWeight: "400",
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1.5,
    borderColor: C.bgSurface3,
  },
  noteCharCount: {
    fontSize: 11,
    color: C.textTertiary,
    textAlign: "right",
    marginTop: 6,
    marginBottom: 16,
  },
  noteSaveBtn: {
    backgroundColor: C.accentYellow,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  noteSaveBtnDisabled: { backgroundColor: C.bgSurface3 },
  noteSaveBtnText: { color: C.accentYellowText, fontSize: 16, fontWeight: "700" },
  modalCancelBtn: { paddingVertical: 12, alignItems: "center" },
  modalCancelText: { fontSize: 15, color: C.textSecondary, fontWeight: "600" },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: C.textTertiary,
    letterSpacing: 1,
    fontWeight: "500",
    marginTop: 16,
  },
});
