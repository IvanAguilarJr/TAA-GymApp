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
import { Exercise } from "@/lib/types";
import { useRouter, useFocusEffect } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AppBottomSheet from "@/components/AppBottomSheet";
import * as Haptics from "expo-haptics";
import { useWeightUnit } from "@/app/context/WeightUnitContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, PRESET_COLORS, getExerciseTileBg } from "@/lib/colors";

const MUSCLE_TAGS = ["Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps", "Glutes", "Core"];
const TYPE_TAGS = ["Push", "Pull", "Compound", "Bodyweight", "Cardio"];

function getExerciseIcon(exercise: Exercise): keyof typeof MaterialCommunityIcons.glyphMap {
  const muscle = exercise.muscleTag?.toLowerCase() ?? "";
  if (muscle === "legs" || muscle === "glutes") return "run-fast";
  return "dumbbell";
}

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const { format } = useWeightUnit();

  const addSheetRef = useRef<BottomSheetModal>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [muscleTag, setMuscleTag] = useState("");
  const [typeTag, setTypeTag] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(C.accentYellow);
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
    setSelectedColor(C.accentYellow);
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
        undefined,
        selectedColor,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addSheetRef.current?.dismiss();
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

  const renderGridCard = ({ item }: { item: Exercise }) => {
    const exColor = item.color ?? C.accentYellow;
    return (
      <TouchableOpacity
        style={styles.gridCard}
        onPress={() => router.push(`/exercise/${item.id}`)}
        onLongPress={() => handleLongPressDelete(item)}
        delayLongPress={500}
        activeOpacity={0.75}
      >
        <View style={[styles.gridCardTop, { backgroundColor: getExerciseTileBg(exColor) }]}>
          <View style={[styles.cardIconTile, { backgroundColor: getExerciseTileBg(exColor) }]}>
            <MaterialCommunityIcons name={getExerciseIcon(item)} size={28} color={exColor} />
          </View>
        </View>
        <View style={styles.gridCardBody}>
          <Text style={styles.gridCardName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.gridCardMeta}>{item.sets} sets · {item.reps} reps</Text>
          {(item.muscleTag || item.typeTag) && (
            <View style={styles.tagRow}>
              {item.muscleTag && (
                <View style={[styles.tagChip, { backgroundColor: exColor + "22" }]}>
                  <Text style={[styles.tagChipText, { color: exColor }]}>{item.muscleTag}</Text>
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
            <View style={[styles.prBadge, { backgroundColor: exColor + "22" }]}>
              <MaterialCommunityIcons name="trophy-outline" size={10} color={exColor} />
              <Text style={[styles.prText, { color: exColor }]}>{format(item.maxWeight)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderListRow = ({ item }: { item: Exercise }) => {
    const exColor = item.color ?? C.accentYellow;
    return (
      <TouchableOpacity
        style={styles.listRow}
        onPress={() => router.push(`/exercise/${item.id}`)}
        onLongPress={() => handleLongPressDelete(item)}
        delayLongPress={500}
        activeOpacity={0.75}
      >
        <View style={[styles.listIconTile, { backgroundColor: getExerciseTileBg(exColor) }]}>
          <MaterialCommunityIcons name={getExerciseIcon(item)} size={18} color={exColor} />
        </View>
        <View style={styles.listInfo}>
          <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.listTagRow}>
            {item.muscleTag && (
              <View style={[styles.tagChip, { backgroundColor: exColor + "22" }]}>
                <Text style={[styles.tagChipText, { color: exColor }]}>{item.muscleTag}</Text>
              </View>
            )}
            {item.typeTag && (
              <View style={styles.tagChipAlt}>
                <Text style={styles.tagChipTextAlt}>{item.typeTag}</Text>
              </View>
            )}
          </View>
        </View>
        {item.maxWeight > 0 && (
          <Text style={[styles.listMaxWeight, { color: exColor }]}>{format(item.maxWeight)}</Text>
        )}
        <MaterialCommunityIcons name="chevron-right" size={18} color={C.textQuaternary} />
      </TouchableOpacity>
    );
  };

  const renderCard = layout === "grid" ? renderGridCard : renderListRow;

  const ListEmptyComponent = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="dumbbell" size={48} color={C.textTertiary} />
      <Text style={styles.emptyTitle}>No exercises yet</Text>
      <Text style={styles.emptySubtitle}>Tap "Add exercise" below to get started</Text>
    </View>
  );

  const ListFooterComponent = () => (
    <TouchableOpacity style={styles.addCard} onPress={openAddSheet} activeOpacity={0.7}>
      <MaterialCommunityIcons name="plus" size={20} color={C.textTertiary} />
      <Text style={styles.addCardText}>Add exercise</Text>
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
            style={styles.layoutToggleBtn}
            onPress={() => setLayout((l) => (l === "grid" ? "list" : "grid"))}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={layout === "grid" ? "view-list" : "view-grid"}
              size={22}
              color={C.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Hint */}
        {exercises.length > 0 && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>Tap to view · Long press to delete</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.accentYellow} />
          </View>
        ) : (
          <FlatList
            key={layout}
            data={exercises}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            numColumns={layout === "grid" ? 2 : 1}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={ListEmptyComponent}
            ListFooterComponent={ListFooterComponent}
          />
        )}
      </View>

      {/* ── Add Exercise Sheet ── */}
      <AppBottomSheet
        sheetRef={addSheetRef}
        snapPoints={["90%"]}
        onDismiss={resetAddSheet}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
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
            placeholderTextColor={C.textTertiary}
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
                placeholderTextColor={C.textTertiary}
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
                placeholderTextColor={C.textTertiary}
                keyboardType="number-pad"
                style={[styles.input, repsFocused && styles.inputFocused]}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>COLOR</Text>
          <View style={styles.swatchRow}>
            {PRESET_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => setSelectedColor(color)}
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  selectedColor === color && styles.swatchSelected,
                ]}
                activeOpacity={0.8}
              />
            ))}
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
                style={[styles.dayChip, muscleTag === tag && styles.dayChipSelected]}
                onPress={() => setMuscleTag(muscleTag === tag ? "" : tag)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayChipText, muscleTag === tag && styles.dayChipTextSelected]}>
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
                style={[styles.dayChip, typeTag === tag && styles.dayChipSelected]}
                onPress={() => setTypeTag(typeTag === tag ? "" : tag)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayChipText, typeTag === tag && styles.dayChipTextSelected]}>
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
            <Text style={styles.confirmBtnText}>{adding ? "Adding…" : "Add Exercise"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => addSheetRef.current?.dismiss()} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBlack },
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
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  layoutToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.bgSurface1,
    justifyContent: "center",
    alignItems: "center",
  },

  hintBox: {
    backgroundColor: C.bgSurface1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  hintText: { fontSize: 12, color: C.textSecondary, fontWeight: "500" },

  grid: { paddingBottom: 32 },

  // Grid cards
  gridCard: {
    backgroundColor: C.bgSurface1,
    borderRadius: 16,
    margin: 6,
    flex: 1,
    overflow: "hidden",
  },
  gridCardTop: {
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  cardIconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  gridCardBody: { padding: 12 },
  gridCardName: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: 4,
  },
  gridCardMeta: { fontSize: 11, color: C.textSecondary, fontWeight: "500" },

  // List rows
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.bgSurface1,
    borderRadius: 12,
    margin: 6,
    padding: 12,
    gap: 12,
    flex: 1,
  },
  listIconTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  listInfo: { flex: 1 },
  listName: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: 4,
  },
  listTagRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  listMaxWeight: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Shared tags
  tagRow: { flexDirection: "row", gap: 4, flexWrap: "wrap", marginTop: 6 },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tagChipAlt: {
    backgroundColor: C.bgSurface3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tagChipText: { fontSize: 9, fontWeight: "700" },
  tagChipTextAlt: { fontSize: 9, fontWeight: "700", color: C.textSecondary },
  prBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  prText: { fontSize: 10, fontWeight: "700" },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: C.textPrimary },
  emptySubtitle: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },

  // Add card (footer)
  addCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.bgSurface3,
    borderStyle: "dashed",
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  addCardText: {
    fontSize: 14,
    color: C.textTertiary,
    fontWeight: "600",
  },

  // Sheet form
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: C.accentYellow,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: C.bgBlack,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: C.textPrimary,
    fontWeight: "500",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputFocused: { borderColor: C.accentYellow, backgroundColor: C.bgSurface1 },
  row: { flexDirection: "row" },

  // Color swatches
  swatchRow: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 8,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: C.textPrimary,
  },

  chipScroll: { marginTop: 4 },
  chipScrollContent: { gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.bgBlack,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  dayChipSelected: { borderColor: C.accentYellow },
  dayChipText: { fontSize: 14, fontWeight: "600", color: C.textSecondary },
  dayChipTextSelected: { color: C.accentYellow },
  confirmBtn: {
    backgroundColor: C.accentYellow,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  confirmBtnDisabled: { backgroundColor: C.bgSurface3 },
  confirmBtnText: {
    color: C.accentYellowText,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cancelBtn: { paddingVertical: 14, alignItems: "center", marginTop: 8 },
  cancelBtnText: { color: C.textSecondary, fontSize: 15, fontWeight: "600" },
});
