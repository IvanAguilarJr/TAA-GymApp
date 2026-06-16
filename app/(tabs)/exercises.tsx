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
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getExercises, addExercise, deleteExercise } from "@/supabase/exercises";
import { Exercise } from "@/firebase/types";
import { useRouter, useFocusEffect } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AppBottomSheet from "@/components/AppBottomSheet";
import * as Haptics from "expo-haptics";
import { useWeightUnit } from "@/app/context/WeightUnitContext";

const MUSCLE_TAGS = [
  "Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Glutes", "Core",
];
const TYPE_TAGS = ["Push", "Pull", "Compound", "Bodyweight", "Cardio"];

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const { format } = useWeightUnit();

  const addSheetRef = useRef<BottomSheetModal>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [muscleTag, setMuscleTag] = useState("");
  const [typeTag, setTypeTag] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [setsFocused, setSetsFocused] = useState(false);
  const [repsFocused, setRepsFocused] = useState(false);

  const router = useRouter();
  const [userId, setUserId] = useState("");

  const fetchExercises = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!userId) setUserId(user.id);
      const data = await getExercises(user.id);
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

  const resetAddSheet = () => {
    setName("");
    setSets("");
    setReps("");
    setMuscleTag("");
    setTypeTag("");
  };

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
      await addExercise(
        userId,
        name.trim(),
        setsNum,
        repsNum,
        [],
        muscleTag || undefined,
        typeTag || undefined,
      );
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
    resetAddSheet();
    addSheetRef.current?.present();
  };

  const closeAddSheet = () => {
    addSheetRef.current?.dismiss();
  };

  const handleLongPressDelete = (exercise: Exercise) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete exercise",
      `Delete "${exercise.name}"? This will remove all its history.`,
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
              Alert.alert("Error", err.message);
            }
          },
        },
      ],
    );
  };

  const renderCard = ({ item }: { item: Exercise }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/exercise/${item.id}`)}
      onLongPress={() => handleLongPressDelete(item)}
      delayLongPress={500}
      activeOpacity={0.75}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardEmoji}>{item.emoji ?? "💪"}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.cardMeta}>{item.sets} sets · {item.reps} reps</Text>
        {(item.muscleTag || item.typeTag) && (
          <View style={styles.tagRow}>
            {item.muscleTag && (
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>{item.muscleTag}</Text>
              </View>
            )}
            {item.typeTag && (
              <View style={styles.tagChipAlt}>
                <Text style={styles.tagChipTextAlt}>{item.typeTag}</Text>
              </View>
            )}
          </View>
        )}
        {item.maxWeight > 0 && (
          <View style={styles.prBadge}>
            <Text style={styles.prText}>🏆 {format(item.maxWeight)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

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
            onPress={openAddSheet}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Hint */}
        {exercises.length > 0 && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>Tap to view · Long press to delete</Text>
          </View>
        )}

        {/* Grid */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#FFD944" />
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
          <FlatList
            data={exercises}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            numColumns={2}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* ── Add Exercise Sheet ── */}
      <AppBottomSheet
        sheetRef={addSheetRef}
        snapPoints={["85%"]}
        onDismiss={resetAddSheet}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.modalTitle}>New Exercise</Text>

          <Text style={styles.fieldLabel}>EXERCISE NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="e.g. Bench Press"
            placeholderTextColor="#555555"
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
                placeholderTextColor="#555555"
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
                placeholderTextColor="#555555"
                keyboardType="number-pad"
                style={[styles.input, repsFocused && styles.inputFocused]}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>MUSCLE GROUP</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipScrollContent}
          >
            {MUSCLE_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.dayChip,
                  muscleTag === tag && styles.dayChipSelected,
                ]}
                onPress={() => setMuscleTag(muscleTag === tag ? "" : tag)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    muscleTag === tag && styles.dayChipTextSelected,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>TYPE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipScrollContent}
          >
            {TYPE_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.dayChip,
                  typeTag === tag && styles.dayChipSelected,
                ]}
                onPress={() => setTypeTag(typeTag === tag ? "" : tag)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    typeTag === tag && styles.dayChipTextSelected,
                  ]}
                >
                  {tag}
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
        </ScrollView>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000000" },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 20 },
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
    color: "#FFD944",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: "#555555",
    fontWeight: "500",
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: "#FFD944",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtnText: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.3,
  },

  hintBox: {
    backgroundColor: "#111111",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  hintText: { fontSize: 12, color: "#555555", fontWeight: "500" },

  grid: { paddingBottom: 32 },

  // 2-col cards
  card: {
    backgroundColor: "#111111",
    borderRadius: 16,
    margin: 6,
    flex: 1,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  cardTop: {
    backgroundColor: "#000000",
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  cardEmoji: { fontSize: 32 },
  cardBody: { padding: 12 },
  cardName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 4,
  },
  cardMeta: { fontSize: 11, color: "#555555", fontWeight: "500" },
  tagRow: { flexDirection: "row", gap: 4, flexWrap: "wrap", marginTop: 6 },
  tagChip: {
    backgroundColor: "#FFD944",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tagChipAlt: {
    backgroundColor: "#222222",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tagChipText: { fontSize: 9, fontWeight: "700", color: "#000000" },
  tagChipTextAlt: { fontSize: 9, fontWeight: "700", color: "#FFD944" },
  prBadge: {
    backgroundColor: "#FFD944",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  prText: { fontSize: 10, fontWeight: "700", color: "#000000" },

  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#FFD944" },
  emptySubtitle: {
    fontSize: 14,
    color: "#555555",
    textAlign: "center",
    marginTop: 4,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFD944",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
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
  chipScroll: { marginTop: 4 },
  chipScrollContent: { gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#000000",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  dayChipSelected: { backgroundColor: "#000000", borderColor: "#FFD944" },
  dayChipText: { fontSize: 14, fontWeight: "600", color: "#555555" },
  dayChipTextSelected: { color: "#FFD944" },
  confirmBtn: {
    backgroundColor: "#FFD944",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  confirmBtnDisabled: { backgroundColor: "#555555" },
  confirmBtnText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  cancelBtnText: { color: "#555555", fontSize: 15, fontWeight: "600" },
});
