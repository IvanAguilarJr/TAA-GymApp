import { Redirect } from "expo-router";

// Root layout (_layout.tsx) gates session-vs-no-session routing.
// By the time this renders, we know there is no active session,
// so always redirect to the login screen.
export default function Index() {
  return <Redirect href="/login" />;
}
