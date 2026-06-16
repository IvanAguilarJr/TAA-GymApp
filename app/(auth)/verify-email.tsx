import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { router, useLocalSearchParams } from "expo-router";

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) throw error;
      Alert.alert("Sent", "Verification email resent. Check your inbox.");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not resend verification email. Try again.");
    } finally {
      setResending(false);
    }
  };

  const handleContinueToSignIn = () => {
    // After the user clicks the confirmation link in their email, their account
    // is active. They return here and tap this to go sign in normally.
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        {/* Branding */}
        <View style={styles.brandBlock}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>Q</Text>
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>One more step to get started</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.cardAccent} />

          <Text style={styles.message}>
            We sent a verification email to{" "}
            <Text style={styles.emailHighlight}>{email}</Text>. Click the link
            in that email, then come back here to sign in.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleContinueToSignIn}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Continue to sign in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, resending && styles.secondaryBtnDisabled]}
            onPress={handleResend}
            activeOpacity={0.85}
            disabled={resending}
          >
            <Text style={styles.secondaryBtnText}>
              {resending ? "Sending…" : "Resend email"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.copyright}>
          QINETIC • {new Date().getFullYear()}
        </Text>
      </View>
    </SafeAreaView>
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
    backgroundColor: "#FFD944",
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
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1,
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
    backgroundColor: "#FFD944",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  message: {
    fontSize: 15,
    color: "#555555",
    fontWeight: "500",
    lineHeight: 22,
    marginBottom: 24,
    marginTop: 8,
  },
  emailHighlight: {
    color: "#FFD944",
    fontWeight: "700",
  },

  // Buttons
  primaryBtn: {
    backgroundColor: "#FFD944",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    backgroundColor: "#000000",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryBtnDisabled: {
    opacity: 0.5,
  },
  secondaryBtnText: {
    color: "#FFD944",
    fontSize: 15,
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
