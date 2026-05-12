import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState, useCallback } from "react";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { auth } from "@/firebase/config";
import {
  getExerciseById,
  logWeight,
  updateExercise,
  updateHistoryEntry,
  deleteHistoryEntry,
} from "@/firebase/exercises";
import { Exercise, Day, ALL_DAYS } from "@/firebase/types";

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

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = auth.currentUser?.uid ?? "";

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  // Log weight modal
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [weightFocused, setWeightFocused] = useState(false);
  const [logging, setLogging] = useState(false);

  // Edit exercise modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSets, setEditSets] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editDay, setEditDay] = useState<Day>("None");
  const [editNameFocused, setEditNameFocused] = useState(false);
  const [editSetsFocused, setEditSetsFocused] = useState(false);
  const [editRepsFocused, setEditRepsFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit history entry modal
  const [editEntryModalVisible, setEditEntryModalVisible] = useState(false);
  const [editEntryIndex, setEditEntryIndex] = useState<number | null>(null);
  const [editEntryWeight, setEditEntryWeight] = useState("");
  const [editEntryFocused, setEditEntryFocused] = useState(false);
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

  const handleLogWeight = async () => {
    if (!weightInput.trim()) {
      Alert.alert("Missing value", "Please enter a weight.");
      return;
    }
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert("Invalid value", "Please enter a valid weight.");
      return;
    }
    setLogging(true);
    try {
      await logWeight(userId, exercise!, weight);
      setWeightInput("");
      setLogModalVisible(false);
      await fetchExercise();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLogging(false);
    }
  };

  const openEditModal = () => {
    if (!exercise) return;
    setEditName(exercise.name);
    setEditSets(String(exercise.sets));
    setEditReps(String(exercise.reps));
    setEditDay(exercise.day ?? "None");
    setEditModalVisible(true);
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
    setSaving(true);
    try {
      await updateExercise(userId, exercise!.id, {
        name: editName.trim(),
        sets: setsNum,
        reps: repsNum,
        day: editDay,
      });
      setEditModalVisible(false);
      await fetchExercise();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  // Long press on a history entry
  const handleHistoryLongPress = (originalIndex: number, weight: number) => {
    Alert.alert(
      "Edit entry",
      `What would you like to do with this ${weight} kg entry?`,
      [
        {
          text: "Edit weight",
          onPress: () => {
            setEditEntryIndex(originalIndex);
            setEditEntryWeight(String(weight));
            setEditEntryModalVisible(true);
          },
        },
        {
          text: "Delete entry",
          style: "destructive",
          onPress: () => handleDeleteEntry(originalIndex),
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const handleSaveEntryEdit = async () => {
    if (editEntryIndex === null) return;
    const newWeight = parseFloat(editEntryWeight);
    if (isNaN(newWeight) || newWeight <= 0) {
      Alert.alert("Invalid value", "Please enter a valid weight.");
      return;
    }
    setSavingEntry(true);
    try {
      await updateHistoryEntry(userId, exercise!, editEntryIndex, newWeight);
      setEditEntryModalVisible(false);
      setEditEntryIndex(null);
      setEditEntryWeight("");
      await fetchExercise();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDeleteEntry = (originalIndex: number) => {
    Alert.alert(
      "Delete entry",
      "Are you sure you want to delete this session entry?",
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

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A1714" />
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

  // Reverse for display but keep original index for Firestore operations
  const sortedHistory = exercise.history
    .map((entry, originalIndex) => ({ ...entry, originalIndex }))
    .reverse();

  const lastSession = sortedHistory[0];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5F2" />

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
            <Text style={styles.heroIcon}>💪</Text>
          </View>
          <Text style={styles.heroName}>{exercise.name}</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{exercise.sets} sets</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{exercise.reps} reps</Text>
            </View>
            <View style={[styles.metaPill, styles.metaPillDay]}>
              <Text style={[styles.metaPillText, styles.metaPillDayText]}>
                📅 {DAY_LABELS[exercise.day ?? "None"]}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {exercise.maxWeight > 0 ? `${exercise.maxWeight}` : "—"}
            </Text>
            <Text style={styles.statLabel}>PR (kg)</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{exercise.history.length}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {lastSession ? `${lastSession.weight}` : "—"}
            </Text>
            <Text style={styles.statLabel}>Last (kg)</Text>
          </View>
        </View>

        {/* Log button */}
        <TouchableOpacity
          style={styles.logBtn}
          onPress={() => setLogModalVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.logBtnText}>+ Log Session</Text>
        </TouchableOpacity>

        {/* History */}
        <View style={styles.sectionTitleRow}>
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
            const isPR = entry.weight === exercise.maxWeight;
            return (
              <TouchableOpacity
                key={entry.originalIndex}
                style={styles.historyCard}
                onLongPress={() =>
                  handleHistoryLongPress(entry.originalIndex, entry.weight)
                }
                delayLongPress={400}
                activeOpacity={0.8}
              >
                <View style={styles.historyLeft}>
                  <Text style={styles.historyDate}>
                    {formatDate(entry.date)}
                  </Text>
                  <Text style={styles.historyTime}>
                    {formatTime(entry.date)}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  {isPR && (
                    <View style={styles.prBadge}>
                      <Text style={styles.prText}>🏆 PR</Text>
                    </View>
                  )}
                  <Text style={styles.historyWeight}>{entry.weight} kg</Text>
                  <Text style={styles.longPressHint}>⋮</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ── Log Weight Modal ── */}
      <Modal
        visible={logModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setLogModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setLogModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Log Session</Text>
            <Text style={styles.modalSubtitle}>{exercise.name}</Text>

            {exercise.maxWeight > 0 && (
              <View style={styles.currentPRBox}>
                <Text style={styles.currentPRLabel}>Current PR</Text>
                <Text style={styles.currentPRValue}>
                  🏆 {exercise.maxWeight} kg
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>WEIGHT (KG)</Text>
            <TextInput
              value={weightInput}
              onChangeText={setWeightInput}
              onFocus={() => setWeightFocused(true)}
              onBlur={() => setWeightFocused(false)}
              placeholder="e.g. 80"
              placeholderTextColor="#C4BFB8"
              keyboardType="decimal-pad"
              style={[styles.input, weightFocused && styles.inputFocused]}
            />

            {weightInput !== "" &&
              parseFloat(weightInput) > exercise.maxWeight && (
                <Text style={styles.newPRText}>
                  🎉 New PR! That's{" "}
                  {(parseFloat(weightInput) - exercise.maxWeight).toFixed(1)} kg
                  more than your current best!
                </Text>
              )}

            <TouchableOpacity
              style={[styles.confirmBtn, logging && styles.confirmBtnDisabled]}
              onPress={handleLogWeight}
              activeOpacity={0.85}
              disabled={logging}
            >
              <Text style={styles.confirmBtnText}>
                {logging ? "Saving…" : "Save Session"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setWeightInput("");
                setLogModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Exercise Modal ── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setEditModalVisible(false)}
          />
          <ScrollView
            style={styles.modalScrollWrapper}
            contentContainerStyle={styles.modalSheet}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Exercise</Text>

            <Text style={styles.fieldLabel}>EXERCISE NAME</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              onFocus={() => setEditNameFocused(true)}
              onBlur={() => setEditNameFocused(false)}
              placeholder="e.g. Bench Press"
              placeholderTextColor="#C4BFB8"
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
                  placeholder="4"
                  placeholderTextColor="#C4BFB8"
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
                  placeholderTextColor="#C4BFB8"
                  keyboardType="number-pad"
                  style={[styles.input, editRepsFocused && styles.inputFocused]}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>WORKOUT DAY</Text>
            <View style={styles.dayGrid}>
              {ALL_DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayGridItem,
                    editDay === day && styles.dayGridItemSelected,
                  ]}
                  onPress={() => setEditDay(day)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayGridText,
                      editDay === day && styles.dayGridTextSelected,
                    ]}
                  >
                    {DAY_LABELS[day]}
                  </Text>
                </TouchableOpacity>
              ))}
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
              onPress={() => setEditModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit History Entry Modal ── */}
      <Modal
        visible={editEntryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditEntryModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setEditEntryModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Entry</Text>
            <Text style={styles.modalSubtitle}>
              Correct the weight for this session
            </Text>

            <Text style={styles.fieldLabel}>WEIGHT (KG)</Text>
            <TextInput
              value={editEntryWeight}
              onChangeText={setEditEntryWeight}
              onFocus={() => setEditEntryFocused(true)}
              onBlur={() => setEditEntryFocused(false)}
              placeholder="e.g. 80"
              placeholderTextColor="#C4BFB8"
              keyboardType="decimal-pad"
              style={[styles.input, editEntryFocused && styles.inputFocused]}
              autoFocus
            />

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                savingEntry && styles.confirmBtnDisabled,
              ]}
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
              onPress={() => {
                setEditEntryModalVisible(false);
                setEditEntryIndex(null);
                setEditEntryWeight("");
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F5F2" },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },

  // Top nav
  topNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: { paddingVertical: 8, paddingRight: 12 },
  backBtnText: { fontSize: 15, color: "#1A1714", fontWeight: "600" },
  editBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  editBtnText: { fontSize: 14, color: "#1A1714", fontWeight: "700" },

  // Hero card
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
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
  heroIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F7F5F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  heroIcon: { fontSize: 32 },
  heroName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1714",
    letterSpacing: -0.5,
    marginBottom: 12,
    textAlign: "center",
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  metaPill: {
    backgroundColor: "#F7F5F2",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  metaPillDay: { backgroundColor: "#EEF2FF" },
  metaPillText: { fontSize: 13, fontWeight: "600", color: "#1A1714" },
  metaPillDayText: { color: "#4338CA" },

  // Stats row
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 20,
    marginBottom: 16,
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1714",
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 11,
    color: "#9E9890",
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statDivider: { width: 1, backgroundColor: "#EEEBE6", marginVertical: 4 },

  // Log button
  logBtn: {
    backgroundColor: "#1A1714",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 28,
  },
  logBtnText: {
    color: "#F7F5F2",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Section title
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1714",
    letterSpacing: -0.3,
  },
  sectionHint: {
    fontSize: 11,
    color: "#C4BFB8",
    fontWeight: "500",
  },

  // History cards
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  historyLeft: { gap: 3 },
  historyDate: { fontSize: 14, fontWeight: "600", color: "#1A1714" },
  historyTime: { fontSize: 12, color: "#9E9890", fontWeight: "500" },
  historyRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  prBadge: {
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prText: { fontSize: 11, fontWeight: "700", color: "#854D0E" },
  historyWeight: { fontSize: 16, fontWeight: "700", color: "#1A1714" },
  longPressHint: { fontSize: 18, color: "#C4BFB8", fontWeight: "700" },

  // Empty history
  emptyHistory: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 6,
  },
  emptyHistoryIcon: { fontSize: 40, marginBottom: 4 },
  emptyHistoryText: { fontSize: 16, fontWeight: "700", color: "#1A1714" },
  emptyHistorySubtext: { fontSize: 13, color: "#9E9890", textAlign: "center" },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26, 23, 20, 0.4)",
  },
  modalScrollWrapper: { maxHeight: "90%" },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 48,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#EEEBE6",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1714",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#9E9890",
    fontWeight: "500",
    marginBottom: 8,
  },
  currentPRBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FEF9C3",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  currentPRLabel: { fontSize: 13, fontWeight: "600", color: "#854D0E" },
  currentPRValue: { fontSize: 15, fontWeight: "700", color: "#854D0E" },
  newPRText: {
    fontSize: 13,
    color: "#16A34A",
    fontWeight: "600",
    marginTop: 8,
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 10,
  },

  // Form
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9E9890",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#F7F5F2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1A1714",
    fontWeight: "500",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputFocused: { borderColor: "#1A1714", backgroundColor: "#FFFFFF" },
  row: { flexDirection: "row" },

  // Day grid
  dayGrid: { gap: 8, marginTop: 4 },
  dayGridItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F7F5F2",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  dayGridItemSelected: { backgroundColor: "#1A1714", borderColor: "#1A1714" },
  dayGridText: { fontSize: 15, fontWeight: "600", color: "#1A1714" },
  dayGridTextSelected: { color: "#F7F5F2" },

  // Buttons
  confirmBtn: {
    backgroundColor: "#1A1714",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  confirmBtnDisabled: { backgroundColor: "#9E9890" },
  confirmBtnText: {
    color: "#F7F5F2",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cancelBtn: { paddingVertical: 14, alignItems: "center", marginTop: 8 },
  cancelBtnText: { color: "#9E9890", fontSize: 15, fontWeight: "600" },
  backLink: { fontSize: 15, color: "#1A1714", fontWeight: "600" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1A1714" },
});
