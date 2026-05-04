import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#EEEBE6",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#1A1714",
        tabBarInactiveTintColor: "#C4BFB8",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Today",
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: "Exercises",
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: "Summary",
        }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return (
    <Text style={{ fontSize: 20, opacity: color === "#1A1714" ? 1 : 0.35 }}>
      {emoji}
    </Text>
  );
}
