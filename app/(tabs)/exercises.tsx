import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { auth } from "@/firebase/config";
import {
  getExercises,
  addExercise,
  deleteExercise,
  updateExerciseDay,
  updateExercisesOrder,
  initializeExerciseOrder,
} from "@/firebase/exercises";
import { Exercise, Day, ALL_DAYS } from "@/firebase/types";
import { useRouter, useFocusEffect } from "expo-router";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import Swipeable from "react-native-gesture-handler/Swipeable";

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

type Section = {
  day: Day;
  title: string;
  data: Exercise[];
};

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [selectedDay, setSelectedDay] = useState<Day>("None");
  const [nameFocused, setNameFocused] = useState(false);
  const [setsFocused, setSetsFocused] = useState(false);
  const [repsFocused, setRepsFocused] = useState(false);

  // Move day modal
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [movingExercise, setMovingExercise] = useState<Exercise | null>(null);
  const [moving, setMoving] = useState(false);

  const router = useRouter();
  const userId = auth.currentUser?.uid ?? "";

  const fetchExercises = async () => {
    setLoading(true);
    try {
      await initializeExerciseOrder(userId);
      const data = await getExercises(userId);
      setExercises(data);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchExercises();
    }, []),
  );

  // Build sections — only days with exercises, in ALL_DAYS order
  const sections: Section[] = ALL_DAYS.reduce<Section[]>((acc, day) => {
    const dayExercises = exercises.filter((e) => e.day === day);
    if (dayExercises.length > 0) {
      acc.push({ day, title: DAY_LABELS[day], data: dayExercises });
    }
    return acc;
  }, []);

  const handleAdd = async () => {
    if (!name.trim() || !sets.trim() || !reps.trim()) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    const setsNum = parseInt(sets);
    const repsNum = parseInt(reps);
    if (isNaN(setsNum) || isNaN(repsNum) || setsNum <= 0 || repsNum <= 0) {
      Alert.alert("Invalid values", "Sets and reps must be positive numbers.");
      return;
    }
    setAdding(true);
    try {
      await addExercise(userId, name.trim(), setsNum, repsNum, selectedDay);
      closeAddModal();
      await fetchExercises();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setAdding(false);
    }
  };

  const closeAddModal = () => {
    setName("");
    setSets("");
    setReps("");
    setSelectedDay("None");
    setAddModalVisible(false);
  };

  const handleDelete = (exercise: Exercise) => {
    Alert.alert(
      "Delete exercise",
      `Are you sure you want to delete "${exercise.name}"? This will remove all its history.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteExercise(userId, exercise.id);
              await fetchExercises();
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ],
    );
  };

  const handleOpenMoveModal = (exercise: Exercise) => {
    setMovingExercise(exercise);
    setMoveModalVisible(true);
  };

  const handleMoveDay = async (day: Day) => {
    if (!movingExercise) return;
    setMoving(true);
    try {
      await updateExerciseDay(userId, movingExercise.id, day);
      setMoveModalVisible(false);
      setMovingExercise(null);
      await fetchExercises();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setMoving(false);
    }
  };

  const handleDragEnd = async (day: Day, reordered: Exercise[]) => {
    // Optimistically update UI
    setExercises((prev) => {
      const otherDays = prev.filter((e) => e.day !== day);
      return [...otherDays, ...reordered];
    });
    // Persist to Firestore
    try {
      await updateExercisesOrder(userId, reordered);
    } catch (err: any) {
      Alert.alert("Error saving order", err.message);
      await fetchExercises(); // revert on failure
    }
  };

  // Swipe left action — reveals "Move Day" button
  const renderRightActions = (exercise: Exercise) => (
    <TouchableOpacity
      style={styles.swipeAction}
      onPress={() => handleOpenMoveModal(exercise)}
      activeOpacity={0.85}
    >
      <Text style={styles.swipeActionText}>📅</Text>
      <Text style={styles.swipeActionLabel}>Move Day</Text>
    </TouchableOpacity>
  );

  const renderDraggableItem = (
    day: Day,
    { item, drag, isActive }: RenderItemParams<Exercise>,
  ) => (
    <ScaleDecorator activeScale={1.03}>
      <Swipeable
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
      >
        <TouchableOpacity
          style={[styles.exerciseCard, isActive && styles.exerciseCardActive]}
          onPress={() => router.push(`/exercise/${item.id}`)}
          onLongPress={drag}
          delayLongPress={200}
          activeOpacity={0.8}
        >
          <View style={styles.exerciseLeft}>
            <TouchableOpacity
              onLongPress={drag}
              delayLongPress={200}
              style={styles.dragHandle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.dragHandleIcon}>⠿</Text>
            </TouchableOpacity>
            <View style={styles.exerciseIconBox}>
              <Text style={styles.exerciseIcon}>💪</Text>
            </View>
            <View>
              <Text style={styles.exerciseName}>{item.name}</Text>
              <Text style={styles.exerciseMeta}>
                {item.sets} sets · {item.reps} reps
              </Text>
            </View>
          </View>
          <View style={styles.exerciseRight}>
            {item.maxWeight > 0 && (
              <View style={styles.prBadge}>
                <Text style={styles.prText}>🏆 {item.maxWeight} kg</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={styles.deleteBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Swipeable>
    </ScaleDecorator>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5F2" />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>My Exercises</Text>
            <Text style={styles.headerSub}>
              {exercises.length} exercise{exercises.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Hint */}
        {exercises.length > 0 && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              ⠿ Long press to reorder · Swipe left to move day
            </Text>
          </View>
        )}

        {/* List */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#1A1714" />
          </View>
        ) : exercises.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "+ Add" to create your first exercise
            </Text>
          </View>
        ) : (
          // Outer ScrollView for the whole page
          // Each day section gets its own DraggableFlatList
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {sections.map((section) => (
              <View key={section.day}>
                {/* Section header */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{section.title}</Text>
                  <Text style={styles.sectionCount}>
                    {section.data.length} exercise
                    {section.data.length !== 1 ? "s" : ""}
                  </Text>
                </View>

                {/* Draggable list for this day */}
                <DraggableFlatList
                  data={section.data}
                  keyExtractor={(item) => item.id}
                  renderItem={(params) =>
                    renderDraggableItem(section.day, params)
                  }
                  onDragEnd={({ data }) => handleDragEnd(section.day, data)}
                  scrollEnabled={false} // outer ScrollView handles scrolling
                  activationDistance={5}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Add Exercise Modal ── */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeAddModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeAddModal}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Exercise</Text>

            <Text style={styles.fieldLabel}>EXERCISE NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              placeholder="e.g. Bench Press"
              placeholderTextColor="#C4BFB8"
              style={[styles.input, nameFocused && styles.inputFocused]}
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>SETS</Text>
                <TextInput
                  value={sets}
                  onChangeText={setSets}
                  onFocus={() => setSetsFocused(true)}
                  onBlur={() => setSetsFocused(false)}
                  placeholder="4"
                  placeholderTextColor="#C4BFB8"
                  keyboardType="number-pad"
                  style={[styles.input, setsFocused && styles.inputFocused]}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.fieldLabel}>REPS</Text>
                <TextInput
                  value={reps}
                  onChangeText={setReps}
                  onFocus={() => setRepsFocused(true)}
                  onBlur={() => setRepsFocused(false)}
                  placeholder="8"
                  placeholderTextColor="#C4BFB8"
                  keyboardType="number-pad"
                  style={[styles.input, repsFocused && styles.inputFocused]}
                />
              </View>
            </View>

            {/* Day picker */}
            <Text style={styles.fieldLabel}>WORKOUT DAY</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dayScroll}
              contentContainerStyle={styles.dayScrollContent}
            >
              {ALL_DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayChip,
                    selectedDay === day && styles.dayChipSelected,
                  ]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      selectedDay === day && styles.dayChipTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.confirmBtn, adding && styles.confirmBtnDisabled]}
              onPress={handleAdd}
              activeOpacity={0.85}
              disabled={adding}
            >
              <Text style={styles.confirmBtnText}>
                {adding ? "Adding…" : "Add Exercise"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={closeAddModal}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Move Day Modal ── */}
      <Modal
        visible={moveModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMoveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setMoveModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Move to Day</Text>
            {movingExercise && (
              <Text style={styles.modalSubtitle}>{movingExercise.name}</Text>
            )}

            <View style={styles.dayGrid}>
              {ALL_DAYS.map((day) => {
                const isCurrent = movingExercise?.day === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayGridItem,
                      isCurrent && styles.dayGridItemCurrent,
                      moving && styles.dayGridItemDisabled,
                    ]}
                    onPress={() => handleMoveDay(day)}
                    activeOpacity={0.7}
                    disabled={moving || isCurrent}
                  >
                    <Text
                      style={[
                        styles.dayGridText,
                        isCurrent && styles.dayGridTextCurrent,
                      ]}
                    >
                      {DAY_LABELS[day]}
                    </Text>
                    {isCurrent && (
                      <Text style={styles.currentDayBadge}>current</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setMoveModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F5F2" },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
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
  addBtn: {
    backgroundColor: "#1A1714",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtnText: {
    color: "#F7F5F2",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.3,
  },

  // Hint
  hintBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  hintText: { fontSize: 12, color: "#9E9890", fontWeight: "500" },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1714",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionCount: { fontSize: 12, color: "#9E9890", fontWeight: "500" },

  // Exercise card
  exerciseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  exerciseCardActive: {
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    backgroundColor: "#FAFAF9",
  },
  exerciseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dragHandle: {
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  dragHandleIcon: {
    fontSize: 18,
    color: "#C4BFB8",
    letterSpacing: -2,
  },
  exerciseIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F7F5F2",
    justifyContent: "center",
    alignItems: "center",
  },
  exerciseIcon: { fontSize: 20 },
  exerciseName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1714",
    marginBottom: 3,
  },
  exerciseMeta: { fontSize: 12, color: "#9E9890", fontWeight: "500" },
  exerciseRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  prBadge: {
    backgroundColor: "#FEF9C3",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prText: { fontSize: 11, fontWeight: "700", color: "#854D0E" },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtnText: { fontSize: 12, color: "#EF4444", fontWeight: "700" },

  // Swipe action
  swipeAction: {
    backgroundColor: "#1A1714",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 16,
    marginBottom: 10,
    gap: 4,
  },
  swipeActionText: { fontSize: 20 },
  swipeActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F7F5F2",
    letterSpacing: 0.3,
  },

  // Empty state
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1A1714" },
  emptySubtitle: {
    fontSize: 14,
    color: "#9E9890",
    textAlign: "center",
    marginTop: 4,
  },

  // Modal shared
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26, 23, 20, 0.4)",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
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

  // Day picker chips
  dayScroll: { marginTop: 4 },
  dayScrollContent: { gap: 8, paddingVertical: 4 },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F7F5F2",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  dayChipSelected: { backgroundColor: "#1A1714", borderColor: "#1A1714" },
  dayChipText: { fontSize: 14, fontWeight: "600", color: "#9E9890" },
  dayChipTextSelected: { color: "#F7F5F2" },

  // Day grid (move modal)
  dayGrid: { gap: 10, marginTop: 8 },
  dayGridItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F7F5F2",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  dayGridItemCurrent: { borderColor: "#1A1714", backgroundColor: "#FFFFFF" },
  dayGridItemDisabled: { opacity: 0.5 },
  dayGridText: { fontSize: 15, fontWeight: "600", color: "#1A1714" },
  dayGridTextCurrent: { fontWeight: "700" },
  currentDayBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9E9890",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

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
  cancelBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  cancelBtnText: { color: "#9E9890", fontSize: 15, fontWeight: "600" },
});
