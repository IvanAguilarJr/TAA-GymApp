import { Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { configureGoogleSignIn } from "@/firebase/googleAuth";
import { WeightUnitProvider } from "@/app/context/WeightUnitContext";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

// Configure Google Sign-In once when app starts
configureGoogleSignIn();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Seed the initial session from AsyncStorage before the listener fires
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // React to all subsequent auth events (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Hold the splash/blank screen while the stored session is being read
  if (loading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <WeightUnitProvider userId={session?.user?.id ?? null}>
          <Stack screenOptions={{ headerShown: false }}>
            {session ? (
              <>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="exercise/[id]" />
                <Stack.Screen name="settings" />
              </>
            ) : (
              <Stack.Screen name="(auth)" />
            )}
          </Stack>
        </WeightUnitProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
