import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link, useRouter } from "expo-router";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const router = useRouter();

  const signup = async () => {
    if (!email || !password || !confirmPassword) {
      alert("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // Supabase sends the confirmation email automatically.
      // A profiles row will be created by the DB trigger once the user is confirmed.
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email },
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.container}>
            {/* Branding */}
            <View style={styles.brandBlock}>
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>Q</Text>
              </View>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>Sign up to get started</Text>
            </View>

            {/* Form card */}
            <View style={styles.card}>
              <View style={styles.cardAccent} />

              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="you@example.com"
                placeholderTextColor="#555555"
                style={[styles.input, emailFocused && styles.inputFocused]}
              />

              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <TextInput
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="Min. 6 characters"
                placeholderTextColor="#555555"
                style={[styles.input, passwordFocused && styles.inputFocused]}
              />

              <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
              <TextInput
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                placeholder="Re-enter password"
                placeholderTextColor="#555555"
                style={[
                  styles.input,
                  confirmFocused && styles.inputFocused,
                  passwordsMatch && styles.inputValid,
                  passwordsMismatch && styles.inputInvalid,
                ]}
              />
              {passwordsMismatch && (
                <Text style={styles.errorText}>Passwords do not match</Text>
              )}
              {passwordsMatch && (
                <Text style={styles.successText}>Passwords match ✓</Text>
              )}

              <TouchableOpacity
                style={[styles.signupBtn, loading && styles.signupBtnDisabled]}
                onPress={signup}
                activeOpacity={0.85}
                disabled={loading}
              >
                <Text style={styles.signupBtnText}>
                  {loading ? "Creating account…" : "Create account"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/login" style={styles.footerLink}>
                Sign in
              </Link>
            </View>

            <Text style={styles.copyright}>
              QINETIC • {new Date().getFullYear()}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    justifyContent: "center",
  },

  // Branding
  brandBlock: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  logoText: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFD944",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#555555",
    fontWeight: "500",
    letterSpacing: 0.2,
  },

  // Card
  card: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
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
  inputFocused: {
    borderColor: "#FFD944",
    backgroundColor: "#111111",
  },
  inputValid: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
  },
  inputInvalid: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "500",
    marginTop: 6,
  },
  successText: {
    fontSize: 12,
    color: "#16A34A",
    fontWeight: "500",
    marginTop: 6,
  },

  // Button
  signupBtn: {
    backgroundColor: "#FFD944",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  signupBtnDisabled: {
    backgroundColor: "#555555",
  },
  signupBtnText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Footer
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  footerText: {
    fontSize: 14,
    color: "#555555",
    fontWeight: "500",
  },
  footerLink: {
    fontSize: 14,
    color: "#FFD944",
    fontWeight: "700",
  },
  copyright: {
    textAlign: "center",
    fontSize: 11,
    color: "#555555",
    letterSpacing: 1,
    fontWeight: "500",
  },
});
