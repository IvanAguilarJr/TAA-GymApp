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
  Linking,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { useFocusEffect } from "expo-router";
import { signOut } from "@/lib/googleAuth";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import {
  getUserProfile,
  updateUserProfile,
  UserProfile,
} from "@/supabase/profile";
import { uploadProfilePhoto } from "@/supabase/storage";
import { useWeightUnit } from "./context/WeightUnitContext";

export default function Settings() {
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setUserEmail(user.email ?? null);
      const data = await getUserProfile(user.id);
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

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setUploadingPhoto(true);
    try {
      const url = await uploadProfilePhoto(userId, uri);
      await updateUserProfile(userId, { photoURL: url });
      setProfile((prev) => (prev ? { ...prev, photoURL: url } : prev));
    } catch {
      Alert.alert("Error", "Could not upload photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const getInitials = () => {
    if (profile?.displayName) return profile.displayName.charAt(0).toUpperCase();
    if (userEmail) return userEmail.charAt(0).toUpperCase();
    return "?";
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert("Display name can't be empty.");
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(userId, {
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
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      Alert.alert(
        "Verification sent",
        `A confirmation link has been sent to ${newEmail.trim()}. Please check your email.`,
      );
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert("Done", "Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not update password.");
    }
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL("https://quackquick.org");
  };

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
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
            setDeleting(true);
            try {
              const { data, error } = await supabase.functions.invoke("delete-account");
              if (error) throw error;
              if (!data?.success) throw new Error("Unexpected response from server.");
              // Clear the local session — the server already deleted the auth record.
              await supabase.auth.signOut();
              router.replace("/");
            } catch (e: any) {
              // Do NOT sign out — let the user know what failed so they can retry.
              Alert.alert(
                "Could not delete account",
                e?.message ?? "Something went wrong. Please try again.",
              );
            } finally {
              setDeleting(false);
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
          <ActivityIndicator size="large" color="#FFD944" />
        </View>
      </SafeAreaView>
    );
  }

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
          <TouchableOpacity
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
            activeOpacity={0.8}
            style={styles.avatarWrapper}
          >
            {profile?.photoURL ? (
              <Image
                source={{ uri: profile.photoURL }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
            )}
            <View style={styles.avatarCameraBtn}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#FFD944" />
              ) : (
                <Text style={styles.avatarCameraIcon}>📷</Text>
              )}
            </View>
          </TouchableOpacity>
          <View>
            <Text style={styles.previewName}>
              {profile?.displayName || userEmail?.split("@")[0] || "User"}
            </Text>
            <Text style={styles.previewEmail}>{userEmail}</Text>
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
            placeholderTextColor="#555555"
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
              <ActivityIndicator size="small" color="#000000" />
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
            placeholder={userEmail ?? "New email address"}
            placeholderTextColor="#555555"
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
            placeholderTextColor="#555555"
            secureTextEntry
          />
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor="#555555"
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
            style={[styles.secondaryBtn, { marginBottom: 10 }]}
            onPress={handlePrivacyPolicy}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleSignOut}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
            onPress={handleDeleteAccount}
            activeOpacity={0.85}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text style={styles.deleteBtnText}>Delete account</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>QINETIC • {new Date().getFullYear()}</Text>
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
    backgroundColor: "#000000",
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
    color: "#555555",
    lineHeight: 28,
    marginRight: 4,
  },
  backText: {
    fontSize: 15,
    color: "#555555",
    fontWeight: "600",
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFD944",
    letterSpacing: -0.5,
  },

  // Profile preview
  profilePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarWrapper: {
    width: 56,
    height: 56,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarText: {
    color: "#FFD944",
    fontSize: 22,
    fontWeight: "700",
  },
  avatarCameraBtn: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarCameraIcon: {
    fontSize: 11,
  },
  previewName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFD944",
    letterSpacing: -0.3,
  },
  previewEmail: {
    fontSize: 13,
    color: "#555555",
    fontWeight: "500",
    marginTop: 2,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#555555",
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
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

  // Fields
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#555555",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#000000",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#FFD944",
    fontWeight: "500",
  },

  // Segment control (kg / lbs)
  segmentRow: {
    flexDirection: "row",
    backgroundColor: "#000000",
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
    backgroundColor: "#000000",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555555",
  },
  segmentTextActive: {
    color: "#FFD944",
  },

  // Save button
  saveBtn: {
    backgroundColor: "#FFD944",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Secondary button
  secondaryBtn: {
    backgroundColor: "#000000",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryBtnText: {
    color: "#FFD944",
    fontSize: 14,
    fontWeight: "700",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: "#222222",
    marginVertical: 20,
  },

  // Sign out / delete
  logoutBtn: {
    backgroundColor: "#FFD944",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  logoutText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  deleteBtn: {
    backgroundColor: "#1A0000",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
  deleteBtnText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "700",
  },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#555555",
    letterSpacing: 1,
    fontWeight: "500",
    marginTop: 8,
  },
});
