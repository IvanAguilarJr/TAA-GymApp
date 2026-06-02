import { useState, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { useFocusEffect } from "expo-router";
import { signOut, updateEmail, updatePassword } from "firebase/auth";
import { router } from "expo-router";
import { auth } from "@/firebase/config";
import {
  getUserProfile,
  updateUserProfile,
  UserProfile,
} from "@/firebase/profile";
import { useWeightUnit } from "./context/WeightUnitContext";

export default function Settings() {
  const user = auth.currentUser;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");

  // Change email / password
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { setUnit } = useWeightUnit();

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await getUserProfile(user!.uid);
      if (data) {
        setProfile(data);
        setDisplayName(data.displayName ?? "");
        setWeightUnit(data.weightUnit ?? "kg");
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, []),
  );

  const getInitials = () => {
    if (profile?.displayName)
      return profile.displayName.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return "?";
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert("Display name can't be empty.");
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(user!.uid, {
        displayName: displayName.trim(),
        weightUnit,
      });
      await setUnit(weightUnit);
      setProfile((prev) =>
        prev ? { ...prev, displayName: displayName.trim(), weightUnit } : prev,
      );
      Alert.alert("Saved", "Your profile has been updated.");
    } catch {
      Alert.alert("Error", "Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return;
    try {
      await updateEmail(user!, newEmail.trim());
      Alert.alert("Done", "Email updated successfully.");
      setNewEmail("");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not update email.");
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords don't match.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Password must be at least 6 characters.");
      return;
    }
    try {
      await updatePassword(user!, newPassword);
      Alert.alert("Done", "Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not update password.");
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut(auth);
          router.replace("/");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This will permanently delete your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await user!.delete();
              router.replace("/");
            } catch (e: any) {
              Alert.alert(
                "Error",
                e.message ??
                  "Could not delete account. You may need to re-login first.",
              );
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#1A1714" />
        </View>
      </SafeAreaView>
    );
  }

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
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={styles.backBtn}
          >
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>

        {/* Avatar + name preview */}
        <View style={styles.profilePreview}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <View>
            <Text style={styles.previewName}>
              {profile?.displayName || user?.email?.split("@")[0] || "User"}
            </Text>
            <Text style={styles.previewEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* ── Section: Profile ── */}
        <SectionLabel label="PROFILE" />
        <View style={styles.card}>
          <View style={styles.cardAccent} />

          <Text style={styles.fieldLabel}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#C4BFB8"
            autoCorrect={false}
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
            Weight Unit
          </Text>
          <View style={styles.segmentRow}>
            {(["kg", "lbs"] as const).map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[
                  styles.segmentBtn,
                  weightUnit === unit && styles.segmentBtnActive,
                ]}
                onPress={() => setWeightUnit(unit)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentText,
                    weightUnit === unit && styles.segmentTextActive,
                  ]}
                >
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSaveProfile}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#F7F5F2" />
            ) : (
              <Text style={styles.saveBtnText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Section: Account ── */}
        <SectionLabel label="ACCOUNT" />
        <View style={styles.card}>
          <View style={styles.cardAccent} />

          <Text style={styles.fieldLabel}>New Email</Text>
          <TextInput
            style={styles.input}
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder={user?.email ?? "New email address"}
            placeholderTextColor="#C4BFB8"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleChangeEmail}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Update email</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>New Password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            placeholderTextColor="#C4BFB8"
            secureTextEntry
          />
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor="#C4BFB8"
            secureTextEntry
          />
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleChangePassword}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Update password</Text>
          </TouchableOpacity>
        </View>

        {/* ── Section: Danger Zone ── */}
        <SectionLabel label="DANGER ZONE" />
        <View style={styles.card}>
          <View style={[styles.cardAccent, { backgroundColor: "#EF4444" }]} />

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleSignOut}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteAccount}
            activeOpacity={0.85}
          >
            <Text style={styles.deleteBtnText}>Delete account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>TAA • {new Date().getFullYear()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
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
    paddingBottom: 40,
  },
  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    marginBottom: 24,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backArrow: {
    fontSize: 28,
    color: "#9E9890",
    lineHeight: 28,
    marginRight: 4,
  },
  backText: {
    fontSize: 15,
    color: "#9E9890",
    fontWeight: "600",
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1A1714",
    letterSpacing: -0.5,
  },

  // Profile preview
  profilePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1A1714",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#F7F5F2",
    fontSize: 22,
    fontWeight: "700",
  },
  previewName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1714",
    letterSpacing: -0.3,
  },
  previewEmail: {
    fontSize: 13,
    color: "#9E9890",
    fontWeight: "500",
    marginTop: 2,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9E9890",
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
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

  // Fields
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9E9890",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#F7F5F2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#1A1714",
    fontWeight: "500",
  },

  // Segment control (kg / lbs)
  segmentRow: {
    flexDirection: "row",
    backgroundColor: "#F7F5F2",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: "#1A1714",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9E9890",
  },
  segmentTextActive: {
    color: "#F7F5F2",
  },

  // Save button
  saveBtn: {
    backgroundColor: "#1A1714",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: "#F7F5F2",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Secondary button
  secondaryBtn: {
    backgroundColor: "#F7F5F2",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryBtnText: {
    color: "#1A1714",
    fontSize: 14,
    fontWeight: "700",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: "#EEEBE6",
    marginVertical: 20,
  },

  // Sign out / delete
  logoutBtn: {
    backgroundColor: "#1A1714",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  logoutText: {
    color: "#F7F5F2",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  deleteBtn: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteBtnText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "700",
  },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#C4BFB8",
    letterSpacing: 1,
    fontWeight: "500",
    marginTop: 8,
  },
});
