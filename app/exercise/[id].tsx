import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState, useCallback, useRef } from "react";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { auth } from "@/firebase/config";
import {
  getExerciseById,
  logSession,
  updateExercise,
  updateHistoryEntry,
  deleteHistoryEntry,
  MAX_REPS,
  MAX_SETS,
  MAX_WEIGHT_KG,
} from "@/firebase/exercises";
import { Exercise, SetEntry } from "@/firebase/types";

const EXERCISE_EMOJIS = [
  "💪","🏋️","🦵","🔝","🙌","📐","🦿","💀","🏃","🚴",
  "🤸","⚡","🔥","🥊","🎯","🏊","🧘","⛹️","🤼","🏇",
  "🦾","🧗","🥋","🎽","🏅","🛡️","⚔️","🌊","🏔️","🎪",
];
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { useWeightUnit } from "@/app/context/WeightUnitContext";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AppBottomSheet from "@/components/AppBottomSheet";


type SetInputRow = {
  weight: string;
  reps: string;
};

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = auth.currentUser?.uid ?? "";

  const { unit, toDisplay, toStorage, format } = useWeightUnit();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Log session sheet ────────────────────────────────────────────────────
  const logSheetRef = useRef<BottomSheetModal>(null);
  const [setInputs, setSetInputs] = useState<SetInputRow[]>([]);
  const [logging, setLogging] = useState(false);

  // ── Edit exercise sheet ──────────────────────────────────────────────────
  const editSheetRef = useRef<BottomSheetModal>(null);
  const [editName, setEditName] = useState("");
  const [editSets, setEditSets] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editEmoji, setEditEmoji] = useState<string>("💪");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editNameFocused, setEditNameFocused] = useState(false);
  const [editSetsFocused, setEditSetsFocused] = useState(false);
  const [editRepsFocused, setEditRepsFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Edit history entry sheet ─────────────────────────────────────────────
  const editEntrySheetRef = useRef<BottomSheetModal>(null);
  const [editEntryIndex, setEditEntryIndex] = useState<number | null>(null);
  const [editEntryInputs, setEditEntryInputs] = useState<SetInputRow[]>([]);
  const [savingEntry, setSavingEntry] = useState(false);

  const fetchExercise = async () => {
    setLoading(true);
    try {
      const found = await getExerciseById(userId, id);
      if (found) setExercise(found);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchExercise();
    }, [id]),
  );

  // ── Log session ──────────────────────────────────────────────────────────
  const openLogModal = () => {
    if (!exercise) return;
    setSetInputs(
      Array.from({ length: exercise.sets }, () => ({
        weight: "",
        reps: String(exercise.reps),
      })),
    );
    logSheetRef.current?.present();
  };

  const updateSetInput = (
    index: number,
    field: "weight" | "reps",
    value: string,
  ) => {
    setSetInputs((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const handleLogSession = async () => {
    for (let i = 0; i < setInputs.length; i++) {
      const w = parseFloat(setInputs[i].weight);
      const r = parseInt(setInputs[i].reps);
      if (isNaN(w) || w <= 0) {
        Alert.alert(
          "Missing weight",
          `Please enter a weight for Set ${i + 1}.`,
        );
        return;
      }
      if (toStorage(w) > MAX_WEIGHT_KG) {
        Alert.alert(
          "Too heavy",
          `Max weight is ${toDisplay(MAX_WEIGHT_KG)} ${unit}.`,
        );
        return;
      }
      if (isNaN(r) || r <= 0) {
        Alert.alert("Missing reps", `Please enter reps for Set ${i + 1}.`);
        return;
      }
      if (r > MAX_REPS) {
        Alert.alert("Too many reps", `Max reps per set is ${MAX_REPS}.`);
        return;
      }
    }

    const sets: SetEntry[] = setInputs.map((row, i) => ({
      setNumber: i + 1,
      weight: toStorage(parseFloat(row.weight)),
      reps: parseInt(row.reps),
    }));

    setLogging(true);
    try {
      await logSession(userId, exercise!, sets);
      logSheetRef.current?.dismiss();
      setSetInputs([]);
      await fetchExercise();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLogging(false);
    }
  };

  const hasNewPR = () => {
    if (!exercise) return false;
    return setInputs.some(
      (row) => toStorage(parseFloat(row.weight)) > exercise.maxWeight,
    );
  };

  const newPRAmount = () => {
    if (!exercise) return 0;
    const maxKg = Math.max(
      ...setInputs.map((r) => toStorage(parseFloat(r.weight) || 0)),
    );
    return toDisplay(maxKg - exercise.maxWeight).toFixed(1);
  };

  // ── Edit exercise ────────────────────────────────────────────────────────
  const openEditModal = () => {
    if (!exercise) return;
    setEditName(exercise.name);
    setEditSets(String(exercise.sets));
    setEditReps(String(exercise.reps));
    setEditEmoji(exercise.emoji ?? "💪");
    setShowEmojiPicker(false);
    editSheetRef.current?.present();
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editSets.trim() || !editReps.trim()) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    const setsNum = parseInt(editSets);
    const repsNum = parseInt(editReps);
    if (isNaN(setsNum) || isNaN(repsNum) || setsNum <= 0 || repsNum <= 0) {
      Alert.alert("Invalid values", "Sets and reps must be positive numbers.");
      return;
    }
    if (setsNum > MAX_SETS) {
      Alert.alert("Too many sets", `Max sets is ${MAX_SETS}.`);
      return;
    }
    if (repsNum > MAX_REPS) {
      Alert.alert("Too many reps", `Max reps is ${MAX_REPS}.`);
      return;
    }
    setSaving(true);
    try {
      await updateExercise(userId, exercise!.id, {
        name: editName.trim(),
        sets: setsNum,
        reps: repsNum,
        emoji: editEmoji,
      });
      editSheetRef.current?.dismiss(); // ← was incorrectly .present() before
      await fetchExercise();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit history entry ───────────────────────────────────────────────────
  const handleHistoryLongPress = (originalIndex: number) => {
    const entry = exercise!.history[originalIndex];
    Alert.alert(
      "Edit session",
      "What would you like to do with this session?",
      [
        {
          text: "Edit session",
          onPress: () => {
            setEditEntryIndex(originalIndex);
            setEditEntryInputs(
              entry.sets.map((s) => ({
                weight: String(toDisplay(s.weight)),
                reps: String(s.reps),
              })),
            );
            editEntrySheetRef.current?.present();
          },
        },
        {
          text: "Delete session",
          style: "destructive",
          onPress: () => handleDeleteEntry(originalIndex),
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const updateEditEntryInput = (
    index: number,
    field: "weight" | "reps",
    value: string,
  ) => {
    setEditEntryInputs((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const handleSaveEntryEdit = async () => {
    if (editEntryIndex === null) return;
    for (let i = 0; i < editEntryInputs.length; i++) {
      const w = parseFloat(editEntryInputs[i].weight);
      const r = parseInt(editEntryInputs[i].reps);
      if (isNaN(w) || w <= 0) {
        Alert.alert("Invalid weight", `Check weight for Set ${i + 1}.`);
        return;
      }
      if (toStorage(w) > MAX_WEIGHT_KG) {
        Alert.alert(
          "Too heavy",
          `Max weight is ${toDisplay(MAX_WEIGHT_KG)} ${unit} for Set ${i + 1}.`,
        );
        return;
      }
      if (isNaN(r) || r <= 0) {
        Alert.alert("Invalid reps", `Check reps for Set ${i + 1}.`);
        return;
      }
      if (r > MAX_REPS) {
        Alert.alert(
          "Too many reps",
          `Max reps is ${MAX_REPS} for Set ${i + 1}.`,
        );
        return;
      }
    }

    const newSets: SetEntry[] = editEntryInputs.map((row, i) => ({
      setNumber: i + 1,
      weight: toStorage(parseFloat(row.weight)),
      reps: parseInt(row.reps),
    }));

    setSavingEntry(true);
    try {
      await updateHistoryEntry(userId, exercise!, editEntryIndex, newSets);
      editEntrySheetRef.current?.dismiss();
      setEditEntryIndex(null);
      setEditEntryInputs([]);
      await fetchExercise();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDeleteEntry = (originalIndex: number) => {
    Alert.alert(
      "Delete session",
      "Are you sure you want to delete this session?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteHistoryEntry(userId, exercise!, originalIndex);
              await fetchExercise();
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ],
    );
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FFD944" />
        </View>
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Exercise not found.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sortedHistory = exercise.history
    .map((entry, originalIndex) => ({ ...entry, originalIndex }))
    .reverse();

  const lastSession = sortedHistory[0];

  const progressData = exercise.history
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((entry, index) => ({
      x: index + 1,
      y: toDisplay(Math.max(...entry.sets.map((s) => s.weight))),
      label: new Date(entry.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top nav */}
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openEditModal} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.cardAccent} />
          <View style={styles.heroIconBox}>
            <Text style={styles.heroIcon}>{exercise.emoji ?? "💪"}</Text>
          </View>
          <Text style={styles.heroName}>{exercise.name}</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{exercise.sets} sets</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{exercise.reps} reps</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                📅 {exercise.days?.join(" · ") || "Unscheduled"}
              </Text>
            </View>
          </View>

          {lastSession && lastSession.sets && lastSession.sets.length > 0 && (
            <View style={styles.lastSessionBox}>
              <Text style={styles.lastSessionLabel}>Last session</Text>
              <View style={styles.setsGrid}>
                {lastSession.sets.map((set) => (
                  <View key={set.setNumber} style={styles.setCol}>
                    <View style={styles.setHead}>
                      <Text style={styles.setNum}>Set {set.setNumber}</Text>
                    </View>
                    <View style={styles.setBody}>
                      <View style={styles.setStat}>
                        <Text style={styles.setVal}>{format(set.weight)}</Text>
                        <Text style={styles.setLbl}>Weight</Text>
                      </View>
                      <View style={styles.setStat}>
                        <Text style={styles.setVal}>{set.reps}</Text>
                        <Text style={styles.setLbl}>Reps</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* PR bar */}
        {exercise.maxWeight > 0 && (
          <View style={styles.prBar}>
            <Text style={styles.prBarLeft}>🏆 Personal record</Text>
            <Text style={styles.prBarRight}>{format(exercise.maxWeight)}</Text>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{exercise.history.length}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {exercise.maxWeight > 0 ? format(exercise.maxWeight) : "—"}
            </Text>
            <Text style={styles.statLabel}>PR</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {lastSession
                ? format(Math.max(...lastSession.sets.map((s) => s.weight)))
                : "—"}
            </Text>
            <Text style={styles.statLabel}>Last</Text>
          </View>
        </View>

        {progressData.length > 1 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Progress</Text>
              <Text style={styles.chartRange}>
                {new Date(exercise.history[0].date).toLocaleDateString(
                  "en-US",
                  {
                    month: "long",
                    year: "numeric",
                  },
                )}
              </Text>
            </View>
            <LineChart
              data={{
                labels: progressData.map((_, i) => `${i + 1}`),
                datasets: [{ data: progressData.map((p) => p.y) }],
              }}
              width={Dimensions.get("window").width - 80}
              height={200}
              yAxisSuffix={` ${unit}`}
              chartConfig={{
                backgroundColor: "#111111",
                backgroundGradientFrom: "#111111",
                backgroundGradientTo: "#111111",
                decimalPlaces: 0,
                color: () => "#FFD944",
                labelColor: () => "#555555",
                style: { borderRadius: 12 },
                propsForDots: { r: "5", strokeWidth: "2", stroke: "#FFD944" },
                propsForBackgroundLines: {
                  stroke: "#222222",
                  strokeDasharray: "4",
                },
              }}
              bezier
              style={{ borderRadius: 12, marginTop: 8 }}
              fromZero={false}
            />
            <Text style={styles.chartXLabel}>Sessions</Text>
          </View>
        )}

        {/* Log button */}
        <TouchableOpacity
          style={styles.logBtn}
          onPress={openLogModal}
          activeOpacity={0.85}
        >
          <Text style={styles.logBtnText}>+ Log Session</Text>
        </TouchableOpacity>

        {/* History */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>History</Text>
          {sortedHistory.length > 0 && (
            <Text style={styles.sectionHint}>Long press to edit or delete</Text>
          )}
        </View>

        {sortedHistory.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryIcon}>📋</Text>
            <Text style={styles.emptyHistoryText}>No sessions logged yet</Text>
            <Text style={styles.emptyHistorySubtext}>
              Tap "Log Session" to record your first lift
            </Text>
          </View>
        ) : (
          sortedHistory.map((entry) => {
            const entryMax =
              entry.sets && entry.sets.length > 0
                ? Math.max(...entry.sets.map((s) => s.weight))
                : 0;
            const isPR =
              entryMax === exercise.maxWeight && exercise.maxWeight > 0;

            return (
              <TouchableOpacity
                key={entry.originalIndex}
                style={styles.historyCard}
                onLongPress={() => handleHistoryLongPress(entry.originalIndex)}
                delayLongPress={400}
                activeOpacity={0.8}
              >
                <View style={styles.historyTop}>
                  <View>
                    <Text style={styles.historyDate}>
                      {formatDate(entry.date)}
                    </Text>
                    <Text style={styles.historyTime}>
                      {formatTime(entry.date)}
                    </Text>
                  </View>
                  <View style={styles.historyTopRight}>
                    {isPR && (
                      <View style={styles.prBadge}>
                        <Text style={styles.prBadgeText}>🏆 PR</Text>
                      </View>
                    )}
                    <Text style={styles.dots}>⋮</Text>
                  </View>
                </View>

                {entry.sets && entry.sets.length > 0 && (
                  <View style={styles.historySetsGrid}>
                    {entry.sets.map((set) => {
                      const isSetPR =
                        set.weight === exercise.maxWeight &&
                        exercise.maxWeight > 0;
                      return (
                        <View
                          key={set.setNumber}
                          style={[
                            styles.historySetCol,
                            isSetPR && styles.historySetColPR,
                          ]}
                        >
                          <Text
                            style={[
                              styles.historySetNum,
                              isSetPR && styles.historySetNumPR,
                            ]}
                          >
                            Set {set.setNumber}
                          </Text>
                          <Text
                            style={[
                              styles.historySetVal,
                              isSetPR && styles.historySetValPR,
                            ]}
                          >
                            {format(set.weight)}
                          </Text>
                          <Text
                            style={[
                              styles.historySetReps,
                              isSetPR && styles.historySetRepsPR,
                            ]}
                          >
                            {set.reps} reps
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ── Log Session Sheet ── */}
      <AppBottomSheet
        sheetRef={logSheetRef}
        snapPoints={["60%", "90%"]}
        onDismiss={() => setSetInputs([])}
        scrollable
      >
        <Text style={styles.modalTitle}>Log Session</Text>
        <Text style={styles.modalSub}>
          {exercise.name} · {exercise.sets} sets
          {exercise.maxWeight > 0 ? ` · PR: ${format(exercise.maxWeight)}` : ""}
        </Text>

        <View style={styles.inputGridHeader}>
          <View style={styles.inputSetLabelBox} />
          <Text style={styles.inputGridHeaderText}>Weight ({unit})</Text>
          <Text style={styles.inputGridHeaderText}>Reps</Text>
        </View>

        {setInputs.map((row, i) => (
          <View key={i} style={styles.inputRow}>
            <View style={styles.inputSetLabelBox}>
              <Text style={styles.inputSetLabel}>Set {i + 1}</Text>
            </View>
            <TextInput
              style={styles.setInput}
              value={row.weight}
              onChangeText={(v) => updateSetInput(i, "weight", v)}
              placeholder={
                lastSession?.sets?.[i]
                  ? String(toDisplay(lastSession.sets[i].weight))
                  : "0"
              }
              placeholderTextColor="#555555"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.setInput}
              value={row.reps}
              onChangeText={(v) => updateSetInput(i, "reps", v)}
              placeholder={String(exercise.reps)}
              placeholderTextColor="#555555"
              keyboardType="number-pad"
            />
          </View>
        ))}

        {hasNewPR() && (
          <View style={styles.prHint}>
            <Text style={styles.prHintText}>
              🎉 New PR! That's {newPRAmount()} {unit} more than your current
              best!
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.confirmBtn, logging && styles.confirmBtnDisabled]}
          onPress={handleLogSession}
          activeOpacity={0.85}
          disabled={logging}
        >
          <Text style={styles.confirmBtnText}>
            {logging ? "Saving…" : "Save Session"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => logSheetRef.current?.dismiss()}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </AppBottomSheet>

      {/* ── Edit Exercise Sheet ── */}
      <AppBottomSheet sheetRef={editSheetRef} snapPoints={["85%"]} scrollable>
        <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          <Text style={styles.modalTitle}>Edit Exercise</Text>

          {/* Emoji picker */}
          <TouchableOpacity
            onPress={() => setShowEmojiPicker((p) => !p)}
            activeOpacity={0.8}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: "#000000",
                justifyContent: "center",
                alignItems: "center",
                alignSelf: "center",
                borderWidth: 1.5,
                borderColor: showEmojiPicker ? "#FFD944" : "#222222",
                marginBottom: 4,
                marginTop: 8,
              }}
            >
              <Text style={{ fontSize: 30 }}>{editEmoji}</Text>
            </View>
            <Text
              style={{
                textAlign: "center",
                fontSize: 11,
                color: "#555555",
                marginBottom: 12,
              }}
            >
              Tap to change icon
            </Text>
          </TouchableOpacity>

          {showEmojiPicker && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {EXERCISE_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={{
                    width: 44,
                    height: 44,
                    backgroundColor: editEmoji === emoji ? "#FFD944" : "#000000",
                    borderRadius: 12,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                  onPress={() => {
                    setEditEmoji(emoji);
                    setShowEmojiPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.fieldLabel}>EXERCISE NAME</Text>
          <TextInput
            value={editName}
            onChangeText={setEditName}
            onFocus={() => setEditNameFocused(true)}
            onBlur={() => setEditNameFocused(false)}
            placeholder="e.g. Bench Press"
            placeholderTextColor="#555555"
            style={[styles.input, editNameFocused && styles.inputFocused]}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.fieldLabel}>SETS</Text>
              <TextInput
                value={editSets}
                onChangeText={setEditSets}
                onFocus={() => setEditSetsFocused(true)}
                onBlur={() => setEditSetsFocused(false)}
                placeholder="3"
                placeholderTextColor="#555555"
                keyboardType="number-pad"
                style={[styles.input, editSetsFocused && styles.inputFocused]}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.fieldLabel}>REPS</Text>
              <TextInput
                value={editReps}
                onChangeText={setEditReps}
                onFocus={() => setEditRepsFocused(true)}
                onBlur={() => setEditRepsFocused(false)}
                placeholder="8"
                placeholderTextColor="#555555"
                keyboardType="number-pad"
                style={[styles.input, editRepsFocused && styles.inputFocused]}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
            onPress={handleSaveEdit}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Text style={styles.confirmBtnText}>
              {saving ? "Saving…" : "Save Changes"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => editSheetRef.current?.dismiss()}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>

      {/* ── Edit History Entry Sheet ── */}
      <AppBottomSheet
        sheetRef={editEntrySheetRef}
        snapPoints={["60%", "90%"]}
        onDismiss={() => {
          setEditEntryIndex(null);
          setEditEntryInputs([]);
        }}
        scrollable
      >
        <Text style={styles.modalTitle}>Edit Session</Text>
        <Text style={styles.modalSub}>Correct the weights or reps</Text>

        <View style={styles.inputGridHeader}>
          <View style={styles.inputSetLabelBox} />
          <Text style={styles.inputGridHeaderText}>Weight ({unit})</Text>
          <Text style={styles.inputGridHeaderText}>Reps</Text>
        </View>

        {editEntryInputs.map((row, i) => (
          <View key={i} style={styles.inputRow}>
            <View style={styles.inputSetLabelBox}>
              <Text style={styles.inputSetLabel}>Set {i + 1}</Text>
            </View>
            <TextInput
              style={styles.setInput}
              value={row.weight}
              onChangeText={(v) => updateEditEntryInput(i, "weight", v)}
              placeholderTextColor="#555555"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.setInput}
              value={row.reps}
              onChangeText={(v) => updateEditEntryInput(i, "reps", v)}
              placeholderTextColor="#555555"
              keyboardType="number-pad"
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.confirmBtn, savingEntry && styles.confirmBtnDisabled]}
          onPress={handleSaveEntryEdit}
          activeOpacity={0.85}
          disabled={savingEntry}
        >
          <Text style={styles.confirmBtnText}>
            {savingEntry ? "Saving…" : "Save Changes"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => editEntrySheetRef.current?.dismiss()}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000000" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: { paddingVertical: 8, paddingRight: 12 },
  backBtnText: { fontSize: 15, color: "#FFD944", fontWeight: "600" },
  editBtn: {
    backgroundColor: "#111111",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  editBtnText: { fontSize: 14, color: "#FFD944", fontWeight: "700" },
  heroCard: {
    backgroundColor: "#111111",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  cardAccent: { height: 4, backgroundColor: "#000000" },
  heroIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 20,
    alignSelf: "center",
  },
  heroIcon: { fontSize: 30, lineHeight: 30 },
  heroName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFD944",
    textAlign: "center",
    marginBottom: 10,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 15,
  },
  metaPill: {
    backgroundColor: "#000000",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  metaPillText: { fontSize: 12, fontWeight: "600", color: "#FFD944" },
  lastSessionBox: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 16,
    width: "100%",
  },
  lastSessionLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#555555",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  setsGrid: { flexDirection: "row", gap: 8 },
  setCol: {
    flex: 1,
    backgroundColor: "#000000",
    borderRadius: 12,
    overflow: "hidden",
  },
  setHead: {
    paddingVertical: 7,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },
  setNum: {
    fontSize: 10,
    color: "#555555",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  setBody: { padding: 8, gap: 6 },
  setStat: {
    backgroundColor: "#111111",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#222222",
  },
  setVal: { fontSize: 13, fontWeight: "600", color: "#FFD944" },
  setLbl: { fontSize: 10, color: "#555555", marginTop: 2 },
  prBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFD944",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  prBarLeft: { fontSize: 13, color: "#000000", fontWeight: "600" },
  prBarRight: { fontSize: 15, fontWeight: "700", color: "#000000" },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#111111",
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 10,
    color: "#555555",
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statDivider: { width: 1, backgroundColor: "#222222", marginVertical: 4 },
  logBtn: {
    backgroundColor: "#FFD944",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  logBtnText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#FFD944" },
  sectionHint: { fontSize: 11, color: "#555555" },
  historyCard: {
    backgroundColor: "#111111",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTopRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyDate: { fontSize: 14, fontWeight: "600", color: "#FFD944" },
  historyTime: { fontSize: 11, color: "#555555", marginTop: 2 },
  prBadge: {
    backgroundColor: "#FFD944",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  prBadgeText: { fontSize: 11, fontWeight: "700", color: "#000000" },
  dots: { fontSize: 20, color: "#555555", fontWeight: "700" },
  historySetsGrid: { flexDirection: "row", gap: 6 },
  historySetCol: {
    flex: 1,
    backgroundColor: "#000000",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
  },
  historySetColPR: { backgroundColor: "#FFD944" },
  historySetNum: {
    fontSize: 10,
    color: "#555555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
    marginBottom: 4,
  },
  historySetNumPR: { color: "#000000" },
  historySetVal: { fontSize: 13, fontWeight: "700", color: "#FFD944" },
  historySetValPR: { color: "#000000" },
  historySetReps: { fontSize: 11, color: "#555555", marginTop: 2 },
  historySetRepsPR: { color: "#000000" },
  emptyHistory: { alignItems: "center", paddingVertical: 32, gap: 6 },
  emptyHistoryIcon: { fontSize: 40, marginBottom: 4 },
  emptyHistoryText: { fontSize: 16, fontWeight: "700", color: "#FFD944" },
  emptyHistorySubtext: { fontSize: 13, color: "#555555", textAlign: "center" },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 13,
    color: "#555555",
    fontWeight: "500",
    marginBottom: 16,
  },
  inputGridHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  inputSetLabelBox: { width: 48 },
  inputGridHeaderText: {
    flex: 1,
    fontSize: 10,
    fontWeight: "600",
    color: "#555555",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  inputSetLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555555",
    textAlign: "center",
  },
  setInput: {
    flex: 1,
    backgroundColor: "#000000",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 15,
    color: "#FFD944",
    fontWeight: "500",
    textAlign: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  prHint: {
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  prHintText: { fontSize: 13, color: "#16A34A", fontWeight: "600" },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#555555",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#000000",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#FFD944",
    fontWeight: "500",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputFocused: { borderColor: "#FFD944", backgroundColor: "#111111" },
  row: { flexDirection: "row" },
  confirmBtn: {
    backgroundColor: "#FFD944",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  confirmBtnDisabled: { backgroundColor: "#555555" },
  confirmBtnText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cancelBtn: { paddingVertical: 14, alignItems: "center", marginTop: 8 },
  cancelBtnText: { color: "#555555", fontSize: 15, fontWeight: "600" },
  backLink: { fontSize: 15, color: "#FFD944", fontWeight: "600" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#FFD944" },
  chartCard: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  chartTitle: { fontSize: 17, fontWeight: "700", color: "#FFD944" },
  chartRange: { fontSize: 12, color: "#555555", fontWeight: "500" },
  chartXLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#555555",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
    marginTop: 4,
  },
});
