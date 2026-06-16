import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { supabase } from "@/lib/supabase";

// Configure Google Sign-In — call once when app starts
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
};

// Sign in with Google via Supabase (native ID-token exchange)
export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const { idToken } = userInfo.data!;

    if (!idToken) throw new Error("Google Sign-In did not return an ID token");

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Sign in cancelled");
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error("Sign in already in progress");
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Google Play Services not available");
    }
    throw error;
  }
};

// Sign out from the Google native session (not critical if it fails)
export const signOutFromGoogle = async () => {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Silently fail — not critical
  }
};

// Full sign-out: Supabase session + Google native session
export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut();
  await signOutFromGoogle();
};
