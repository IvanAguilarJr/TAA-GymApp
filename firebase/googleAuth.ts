import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";

import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { createUserProfile } from "@/firebase/profile";

// Configure Google Sign-In - call this once when app starts
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
};

// Sign in with Google and return Firebase user
export const signInWithGoogle = async () => {
  try {
    // Check if device supports Google Play Services (Android) / Google Sign-In (iOS)
    await GoogleSignin.hasPlayServices();

    // Get Google user info
    const userInfo = await GoogleSignin.signIn();

    // Create Firebase credential from Google token
    const { idToken } = userInfo.data!;
    const googleCredential = GoogleAuthProvider.credential(idToken);

    // Sign in to Firebase with google credential
    const result = await signInWithCredential(auth, googleCredential);
    const user = result.user;

    // Bootstrap profile on first Google login
    const profileRef = doc(db, "users", user.uid, "profile", "settings");
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      await createUserProfile(user.uid, user.displayName ?? "");
    }

    return user;
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Sign in cancelled");
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error("Sign in already in progress");
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Google Play Services not avaible");
    } else {
      throw error;
    }
  }
};

// Sign out from Google (call alongside Firebase signOut)
export const signOutFromGoogle = async () => {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    // Silently fail - not critical.
  }
};
