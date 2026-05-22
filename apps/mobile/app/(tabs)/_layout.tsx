import React from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useAppTheme } from "../../src/lib/appearanceContext";

export default function TabsLayout() {
  const { colors, resolvedTheme } = useAppTheme();

  return (
    <NativeTabs
      tintColor={colors.brand}
      backgroundColor="transparent"
      blurEffect={resolvedTheme === "dark" ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
      iconColor={{
        default: colors.subtle,
        selected: colors.brand,
      }}
      labelStyle={{
        default: {
          color: colors.subtle,
          fontSize: 10,
          fontWeight: "500",
        },
        selected: {
          color: colors.brand,
          fontSize: 10,
          fontWeight: "600",
        },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="teams">
        <NativeTabs.Trigger.Label>Teams</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.2", selected: "person.2.fill" }}
          md={{ default: "group", selected: "group" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          md={{ default: "settings", selected: "settings" }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

