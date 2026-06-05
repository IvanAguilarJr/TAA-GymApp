import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useState, useCallback, useRef } from "react";
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
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AppBottomSheet from "@/components/AppBottomSheet";
import * as Haptics from "expo-haptics";

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

  // Add sheet
  const addSheetRef = useRef<BottomSheetModal>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [selectedDay, setSelectedDay] = useState<Day>("None");
  const [nameFocused, setNameFocused] = useState(false);
  const [setsFocused, setSetsFocused] = useState(false);
  const [repsFocused, setRepsFocused] = useState(false);

  // Move day sheet
  const moveSheetRef = useRef<BottomSheetModal>(null);
  const [movingExercise, setMovingExercise] = useState<Exercise | null>(null);
  const [moving, setMoving] = useState(false);

  // Multi-select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Select mode animation (drives circle width + bottom bar) — useNativeDriver: false for layout
  const selectModeAnim = useRef(new Animated.Value(0)).current;
  // Per-item spring animations for the circle fill — useNativeDriver: true for transform
  const selectionAnims = useRef<Record<string, Animated.Value>>({});

  const circleContainerWidth = selectModeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 38],
  });
  const bottomBarTranslateY = selectModeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  const getSelectionAnim = (id: string) => {
    if (!selectionAnims.current[id]) {
      selectionAnims.current[id] = new Animated.Value(0);
    }
    return selectionAnims.current[id];
  };

  const insets = useSafeAreaInsets();
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeAddSheet();
      await fetchExercises();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", err.message);
    } finally {
      setAdding(false);
    }
  };

  const openAddSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setName("");
    setSets("");
    setReps("");
    setSelectedDay("None");
    addSheetRef.current?.present();
  };

  const closeAddSheet = () => {
    addSheetRef.current?.dismiss();
  };

  const handleDelete = (exercise: Exercise) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await fetchExercises();
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", err.message);
            }
          },
        },
      ],
    );
  };

  const openMoveSheet = (exercise: Exercise) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMovingExercise(exercise);
    moveSheetRef.current?.present();
  };

  const closeMoveSheet = () => {
    moveSheetRef.current?.dismiss();
  };

  const handleMoveDay = async (day: Day) => {
    if (!movingExercise) return;
    Haptics.selectionAsync();
    setMoving(true);
    try {
      await updateExerciseDay(userId, movingExercise.id, day);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeMoveSheet();
      setMovingExercise(null);
      await fetchExercises();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", err.message);
    } finally {
      setMoving(false);
    }
  };

  const handleDragEnd = async (day: Day, reordered: Exercise[]) => {
    setExercises((prev) => {
      const otherDays = prev.filter((e) => e.day !== day);
      return [...otherDays, ...reordered];
    });
    try {
      await updateExercisesOrder(userId, reordered);
    } catch (err: any) {
      Alert.alert("Error saving order", err.message);
      await fetchExercises();
    }
  };

  const enterSelectMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectMode(true);
    Animated.spring(selectModeAnim, {
      toValue: 1,
      useNativeDriver: false,
      tension: 180,
      friction: 14,
    }).start();
  };

  const exitSelectMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(selectModeAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 180,
      friction: 14,
    }).start(() => {
      setSelectMode(false);
      setSelectedIds(new Set());
      Object.values(selectionAnims.current).forEach((a) => a.setValue(0));
    });
  };

  const toggleSelect = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const anim = getSelectionAnim(id);
    const willBeSelected = !selectedIds.has(id);
    Animated.spring(anim, {
      toValue: willBeSelected ? 1 : 0,
      useNativeDriver: true,
      tension: 300,
      friction: 18,
    }).start();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Exercises",
      `Delete ${selectedIds.size} exercise${selectedIds.size !== 1 ? "s" : ""}? This will remove all their history.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await Promise.all(
                [...selectedIds].map((id) => deleteExercise(userId, id)),
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              exitSelectMode();
              await fetchExercises();
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", err.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const renderRightActions = (
    exercise: Exercise,
    progress: Animated.AnimatedInterpolation<number>,
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [160, 0],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        style={[styles.swipeActionsRow, { transform: [{ translateX }] }]}
      >
        <TouchableOpacity
          style={styles.swipeMoveBtn}
          onPress={() => openMoveSheet(exercise)}
          activeOpacity={0.85}
        >
          <Text style={styles.swipeActionIcon}>📅</Text>
          <Text style={styles.swipeActionLabel}>Move</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.swipeDeleteBtn}
          onPress={() => handleDelete(exercise)}
          activeOpacity={0.85}
        >
          <Text style={styles.swipeActionIcon}>🗑️</Text>
          <Text style={styles.swipeActionLabel}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderDraggableItem = (
    day: Day,
    { item, drag, isActive }: RenderItemParams<Exercise>,
  ) => {
    const selAnim = getSelectionAnim(item.id);
    const isSelected = selectedIds.has(item.id);

    const card = (
      <TouchableOpacity
        style={[
          styles.exerciseCard,
          isActive && styles.exerciseCardActive,
          isSelected && styles.exerciseCardSelected,
        ]}
        onPress={() => {
          if (selectMode) toggleSelect(item.id);
          else router.push(`/exercise/${item.id}`);
        }}
        onLongPress={() => {
          if (!selectMode) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            drag();
          }
        }}
        delayLongPress={200}
        activeOpacity={0.8}
      >
        {/* Animated circle — slides in from left in select mode */}
        <Animated.View
          style={[styles.circleContainer, { width: circleContainerWidth }]}
        >
          <View
            style={[
              styles.circleOuter,
              isSelected && styles.circleOuterSelected,
            ]}
          >
            <Animated.View
              style={[styles.circleFill, { transform: [{ scale: selAnim }] }]}
            >
              <Text style={styles.circleCheck}>✓</Text>
            </Animated.View>
          </View>
        </Animated.View>

        <View style={styles.exerciseLeft}>
          {!selectMode && (
            <TouchableOpacity
              onLongPress={drag}
              delayLongPress={200}
              style={styles.dragHandle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.dragHandleIcon}>⠿</Text>
            </TouchableOpacity>
          )}
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
        </View>
      </TouchableOpacity>
    );

    return (
      <ScaleDecorator activeScale={1.03}>
        {selectMode ? (
          card
        ) : (
          <Swipeable
            renderRightActions={(progress) =>
              renderRightActions(item, progress)
            }
            overshootRight={false}
          >
            {card}
          </Swipeable>
        )}
      </ScaleDecorator>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5F2" />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>
              {selectMode ? "Select Exercises" : "My Exercises"}
            </Text>
            <Text style={styles.headerSub}>
              {selectMode
                ? `${selectedIds.size} selected`
                : `${exercises.length} exercise${exercises.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {selectMode ? (
              <TouchableOpacity
                style={styles.cancelSelectBtn}
                onPress={exitSelectMode}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelSelectBtnText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <>
                {exercises.length > 0 && (
                  <TouchableOpacity
                    style={styles.selectBtn}
                    onPress={enterSelectMode}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.selectBtnText}>Select</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={openAddSheet}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Hint */}
        {exercises.length > 0 && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              {selectMode
                ? "Tap exercises to select · Tap Cancel to exit"
                : "⠿ Long press to reorder · Swipe left for actions"}
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
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: selectMode ? 120 : 32 }}
          >
            {sections.map((section) => (
              <View key={section.day}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{section.title}</Text>
                  <Text style={styles.sectionCount}>
                    {section.data.length} exercise
                    {section.data.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <DraggableFlatList
                  data={section.data}
                  keyExtractor={(item) => item.id}
                  renderItem={(params) =>
                    renderDraggableItem(section.day, params)
                  }
                  onDragEnd={({ data }) => handleDragEnd(section.day, data)}
                  scrollEnabled={false}
                  activationDistance={5}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Bottom Delete Bar — slides up in select mode */}
      <Animated.View
        style={[
          styles.selectBar,
          {
            transform: [{ translateY: bottomBarTranslateY }],
            opacity: selectModeAnim,
            bottom: insets.bottom + 50,
          },
        ]}
        pointerEvents={selectMode ? "auto" : "none"}
      >
        <TouchableOpacity
          style={[
            styles.deleteSelectedBtn,
            selectedIds.size === 0 && styles.deleteSelectedBtnDisabled,
          ]}
          onPress={handleDeleteSelected}
          disabled={selectedIds.size === 0 || deleting}
          activeOpacity={0.85}
        >
          <Text style={styles.deleteSelectedBtnText}>
            {deleting
              ? "Deleting…"
              : selectedIds.size > 0
                ? `Delete ${selectedIds.size} Exercise${selectedIds.size !== 1 ? "s" : ""}`
                : "Select exercises to delete"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Add Exercise Sheet ── */}
      <AppBottomSheet
        sheetRef={addSheetRef}
        snapPoints={["75%"]}
        onDismiss={() => {
          setName("");
          setSets("");
          setReps("");
          setSelectedDay("None");
        }}
      >
        <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
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
            <View style={{ flex: 1, marginRight: 10 }}>
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
            <View style={{ flex: 1, marginLeft: 10 }}>
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
            onPress={closeAddSheet}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>

      {/* ── Move Day Sheet ── */}
      <AppBottomSheet
        sheetRef={moveSheetRef}
        snapPoints={["70%"]}
        onDismiss={() => setMovingExercise(null)}
      >
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
          onPress={closeMoveSheet}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F5F2" },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },

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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  selectBtn: {
    backgroundColor: "#F7F5F2",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E8E4DF",
  },
  selectBtnText: {
    color: "#1A1714",
    fontWeight: "600",
    fontSize: 14,
  },
  cancelSelectBtn: {
    backgroundColor: "#F7F5F2",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E8E4DF",
  },
  cancelSelectBtnText: {
    color: "#1A1714",
    fontWeight: "600",
    fontSize: 14,
  },

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
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  exerciseCardActive: {
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    backgroundColor: "#FAFAF9",
  },
  exerciseCardSelected: {
    borderColor: "#1A1714",
  },

  // Select circle
  circleContainer: {
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  circleOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#C4BFB8",
    justifyContent: "center",
    alignItems: "center",
  },
  circleOuterSelected: {
    borderColor: "#1A1714",
  },
  circleFill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#1A1714",
    justifyContent: "center",
    alignItems: "center",
  },
  circleCheck: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 13,
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

  // Swipe actions
  swipeActionsRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  swipeMoveBtn: {
    backgroundColor: "#1A1714",
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    gap: 4,
  },
  swipeDeleteBtn: {
    backgroundColor: "#EF4444",
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    gap: 4,
  },
  swipeActionIcon: { fontSize: 20 },
  swipeActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  // Bottom select bar
  selectBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  deleteSelectedBtn: {
    backgroundColor: "#EF4444",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  deleteSelectedBtnDisabled: {
    backgroundColor: "#C4BFB8",
  },
  deleteSelectedBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1A1714" },
  emptySubtitle: {
    fontSize: 14,
    color: "#9E9890",
    textAlign: "center",
    marginTop: 4,
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

  dayScroll: { marginTop: 4 },
  dayScrollContent: { gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
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
