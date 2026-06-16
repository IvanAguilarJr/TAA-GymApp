import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link, useRouter } from "expo-router";
import { signInWithGoogle } from "@/firebase/googleAuth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const router = useRouter();

  const login = async () => {
    if (!email || !password) {
      alert("Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          // Route to verify-email with the entered address so the user can resend
          router.replace({
            pathname: "/(auth)/verify-email",
            params: { email },
          });
        } else {
          alert(error.message);
        }
        return;
      }
      // onAuthStateChange in _layout.tsx will flip to (tabs) automatically;
      // this replace is the immediate navigation so there is no visible flash.
      router.replace("/(tabs)/home");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/(tabs)/home");
    } catch (err: any) {
      if (err.message !== "Sign in cancelled") {
        alert(err.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  //TODO: Add handleAppleSignIn Function

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.container}>
            {/* Top branding */}
            <View style={styles.brandBlock}>
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>TAA</Text>
              </View>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to continue</Text>
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
                placeholder="••••••••"
                placeholderTextColor="#555555"
                style={[styles.input, passwordFocused && styles.inputFocused]}
              />

              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                onPress={login}
                activeOpacity={0.85}
                disabled={loading}
              >
                <Text style={styles.loginBtnText}>
                  {loading ? "Signing in…" : "Sign in"}
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}> or </Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Sign-In button */}
              <TouchableOpacity
                style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
                onPress={handleGoogleSignIn}
                activeOpacity={0.85}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#FFD944" />
                ) : (
                  <>
                    <Text style={styles.googleIcon}>G</Text>
                    <Text style={styles.googleBtnText}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Apple Sign-In button — UI only, not wired up (no Apple Developer account yet) */}
              <TouchableOpacity
                style={[styles.appleBtn, appleLoading && styles.btnDisabled]}
                onPress={() => {}}
                disabled={appleLoading}
                activeOpacity={0.85}
              >
                {appleLoading ? (
                  <ActivityIndicator size="small" color="#FFD944" />
                ) : (
                  <>
                    <Text style={styles.appleIcon}>{"🍎"}</Text>
                    <Text style={styles.appleBtnText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer link */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/signup" style={styles.footerLink}>
                Sign up
              </Link>
            </View>

            <Text style={styles.copyright}>
              TAA • {new Date().getFullYear()}
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

  // Button
  loginBtn: {
    backgroundColor: "#FFD944",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  loginBtnDisabled: {
    backgroundColor: "#555555",
  },
  loginBtnText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#222222" },
  dividerText: { fontSize: 13, color: "#555555", fontWeight: "500" },

  // Google Button
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#222222",
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFD944",
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFD944",
  },

  appleBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#222222",
  },

  appleBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFD944",
  },

  appleIcon: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFD944",
  },

  btnDisabled: {
    opacity: 0.5,
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
