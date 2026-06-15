import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

export default function TabsLayout() {
  return (
    <NativeTabs
      screenOptions={{
        headerShown: false,
      }}
    >
      <NativeTabs.Trigger name="home">
        <Icon
          sf={{
            default: "house",
            selected: "house.fill",
          }}
        />
        <Label>Today</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="exercises">
        <Icon sf="figure.strengthtraining.traditional" />
        <Label>Exercises</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="schedule">
        <Icon
          sf={{
            default: "calendar",
            selected: "calendar.fill",
          }}
        />
        <Label>Schedule</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="summary">
        <Icon sf="chart.bar.fill" />
        <Label>Summary</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
