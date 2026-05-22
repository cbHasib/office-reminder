import React, { useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { Host, Button, Switch as NativeSwitch } from "@expo/ui";
import { useAuth, useSettings } from "../_layout";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/lib/theme";
import { useAppTheme, ThemeMode, ColorPalette } from "../../src/lib/appearanceContext";
import {
  SOUND_LABELS,
  DEVELOPER,
  APP_NAME,
  SOURCE_REPO_URL,
  type SoundName,
} from "../../src/lib/shared";
import {
  Settings as SettingsIcon,
  Volume2,
  Clock,
  Github,
  Heart,
  ChevronRight,
  Sun,
  Moon,
  Laptop,
  User,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ADVANCE_OPTIONS = [
  { label: "Reminder Default", value: null },
  { label: "1 min before", value: 1 },
  { label: "3 min before", value: 3 },
  { label: "5 min before", value: 5 },
  { label: "10 min before", value: 10 },
  { label: "15 min before", value: 15 },
];

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { settings, refreshSettings } = useSettings();
  const { themeMode, resolvedTheme, colors, setThemeMode } = useAppTheme();
  const styles = getStyles(colors, resolvedTheme);

  const [updating, setUpdating] = useState(false);

  async function updateSetting(updates: any) {
    if (!user) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          ...updates,
        });

      if (error) throw error;
      await refreshSettings();
    } catch (err: any) {
      Alert.alert("Update Error", err.message || "Failed to update setting.");
    } finally {
      setUpdating(false);
    }
  }

  function testSound(soundName: SoundName) {
    Alert.alert(
      "Test Sound",
      `Previewing "${SOUND_LABELS[soundName]}". Standard device alert sounds will trigger when notifications arrive.`
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Sleek User Profile Box */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.display_name ? user.display_name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : "U")}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.display_name || user?.email?.split("@")[0]}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Premium Appearance Switch Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Appearance</Text>
          <View style={styles.themeGrid}>
            {([
              { mode: "system", label: "Auto", Icon: Laptop },
              { mode: "light", label: "Light", Icon: Sun },
              { mode: "dark", label: "Dark", Icon: Moon },
            ] as const).map(({ mode, label, Icon }) => {
              const isActive = themeMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.themeBtn,
                    isActive && {
                      backgroundColor: colors.brand,
                      borderColor: colors.brand,
                    },
                  ]}
                  onPress={() => setThemeMode(mode)}
                  activeOpacity={0.7}
                >
                  <Icon
                    size={18}
                    color={isActive ? colors.brandFg : colors.subtle}
                    style={{ marginBottom: 6 }}
                  />
                  <Text
                    style={[
                      styles.themeBtnText,
                      { color: isActive ? colors.brandFg : colors.fg },
                      isActive && { fontWeight: "700" },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* iOS-styled list group container for Timing & Sound preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Timing & Preferences</Text>
          <View style={styles.groupCard}>
            
            {/* Sound Toggle Row */}
            <View style={styles.groupRow}>
              <View style={[styles.iconCircle, { backgroundColor: "rgba(129, 140, 248, 0.12)" }]}>
                <Volume2 size={18} color={colors.brand} />
              </View>
              <View style={styles.groupRowText}>
                <Text style={styles.groupRowLabel}>Warning Alerts Sound</Text>
                <Text style={styles.groupRowDesc}>Play high-priority warning chimes</Text>
              </View>
              <Host style={styles.nativeSwitchHost}>
                <NativeSwitch
                  value={settings?.sound_enabled ?? false}
                  onValueChange={(val) => updateSetting({ sound_enabled: val })}
                  disabled={updating}
                />
              </Host>
            </View>

            {settings?.sound_enabled && (
              <>
                <View style={styles.groupDivider} />
                <View style={styles.soundProfileContainer}>
                  <Text style={styles.groupRowLabelSub}>Select Sound Profile</Text>
                  <View style={styles.soundGrid}>
                    {Object.entries(SOUND_LABELS).map(([value, label]) => {
                      const isSelected = settings?.sound_name === value;
                      return (
                        <View key={value} style={styles.soundOptionRow}>
                          <TouchableOpacity
                            style={[
                              styles.soundSelectBtn,
                              isSelected && {
                                borderColor: colors.brand,
                                backgroundColor: colors.elevated,
                              },
                            ]}
                            onPress={() => updateSetting({ sound_name: value })}
                            disabled={updating}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.soundOptionText,
                                { color: isSelected ? colors.brand : colors.fg },
                                isSelected && { fontWeight: "700" },
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.testSoundBtn, { backgroundColor: colors.muted }]}
                            onPress={() => testSound(value as SoundName)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.testSoundText, { color: colors.fg }]}>Test</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            <View style={styles.groupDivider} />

            {/* Timing Lead Grid Container */}
            <View style={[styles.groupRow, { flexDirection: "column", alignItems: "stretch", paddingVertical: theme.spacing.lg }]}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.md }}>
                <View style={[styles.iconCircle, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                  <Clock size={18} color={colors.success} />
                </View>
                <View style={[styles.groupRowText, { marginLeft: theme.spacing.md }]}>
                  <Text style={styles.groupRowLabel}>Advance Warnings Lead Time</Text>
                  <Text style={styles.groupRowDesc}>Override the team default alert leads</Text>
                </View>
              </View>

              <View style={styles.advanceGrid}>
                {ADVANCE_OPTIONS.map((opt) => {
                  const isSelected = settings?.advance_minutes_override === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[
                        styles.advanceBtn,
                        isSelected && { borderColor: colors.brand, backgroundColor: colors.elevated },
                      ]}
                      onPress={() => updateSetting({ advance_minutes_override: opt.value })}
                      disabled={updating}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.advanceBtnText,
                          { color: isSelected ? colors.brand : colors.fg },
                          isSelected && { fontWeight: "700" },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Grouped App Information section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>About App</Text>
          <View style={styles.groupCard}>
            {/* Row 1: App Identity */}
            <View style={[styles.groupRow, { paddingVertical: theme.spacing.lg }]}>
              <View style={styles.logoRow}>
                <View style={[styles.logoCircle, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                  <SettingsIcon size={22} color={colors.brand} />
                </View>
                <View>
                  <Text style={[styles.appName, { color: colors.fg }]}>{APP_NAME}</Text>
                  <Text style={[styles.versionText, { color: colors.brand }]}>Mobile Version 0.1.18 · SDK 56</Text>
                </View>
              </View>
            </View>

            <View style={styles.groupDivider} />

            {/* Row 2: Description & Developer */}
            <View style={[styles.groupRow, { paddingVertical: theme.spacing.lg, flexDirection: "column", alignItems: "stretch" }]}>
              <Text style={[styles.creditText, { color: colors.subtle }]}>
                A high-performance offline push-notification utility that maps recurring events
                and issues warnings natively without centralized cloud server push overhead.
              </Text>

              <View style={styles.authorSection}>
                <Heart size={14} color={colors.danger} style={{ marginRight: 6 }} />
                <Text style={[styles.authorLabel, { color: colors.subtle }]}>Developed with passion by</Text>
              </View>
              <TouchableOpacity
                style={styles.authorLink}
                onPress={() => Linking.openURL(DEVELOPER.website)}
                activeOpacity={0.7}
              >
                <Text style={[styles.authorName, { color: colors.fg }]}>{DEVELOPER.name}</Text>
                <Text style={[styles.authorHandle, { color: colors.brand }]}>{DEVELOPER.handle}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.groupDivider} />

            {/* Row 3: Repository Link */}
            <TouchableOpacity
              style={[styles.groupRow, { paddingVertical: theme.spacing.lg }]}
              onPress={() => Linking.openURL(SOURCE_REPO_URL)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: "rgba(100, 116, 139, 0.12)" }]}>
                <Github size={18} color={colors.subtle} />
              </View>
              <View style={[styles.groupRowText, { marginLeft: theme.spacing.md }]}>
                <Text style={styles.groupRowLabel}>View Source on GitHub</Text>
              </View>
              <ChevronRight size={16} color={colors.subtle} />
            </TouchableOpacity>
          </View>
        </View>

        <Host style={styles.logoutHost}>
          <Button
            variant="outlined"
            onPress={signOut}
            label="Log Out Account"
          />
        </Host>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ColorPalette, resolvedTheme: "light" | "dark") =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContainer: {
      padding: theme.spacing.lg,
      paddingBottom: 120, // space to flow under glassy bottom tabs
    },
    profileCard: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius.xl,
      borderColor: colors.border,
      borderWidth: 1,
      padding: theme.spacing.xl,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.xl,
      elevation: 3,
      shadowColor: resolvedTheme === "dark" ? "#000" : "#64748B",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: resolvedTheme === "dark" ? 0.25 : 0.08,
      shadowRadius: 10,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing.lg,
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
    },
    avatarText: {
      color: colors.brandFg,
      fontSize: 24,
      fontWeight: "800",
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      color: colors.fg,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: -0.4,
    },
    profileEmail: {
      color: colors.subtle,
      fontSize: 13,
      marginTop: 2,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionHeader: {
      color: colors.subtle,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: theme.spacing.sm,
      paddingLeft: 4,
    },
    themeGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      padding: 6,
    },
    themeBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: "transparent",
      marginHorizontal: 3,
    },
    themeBtnText: {
      fontSize: 13,
      fontWeight: "600",
    },
    groupCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.xl,
      paddingHorizontal: theme.spacing.lg,
      elevation: 2,
      shadowColor: resolvedTheme === "dark" ? "#000" : "#64748B",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: resolvedTheme === "dark" ? 0.15 : 0.05,
      shadowRadius: 6,
    },
    groupRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing.lg,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    groupRowText: {
      flex: 1,
      marginLeft: theme.spacing.md,
      marginRight: theme.spacing.md,
    },
    groupRowLabel: {
      color: colors.fg,
      fontSize: 15,
      fontWeight: "700",
    },
    groupRowDesc: {
      color: colors.subtle,
      fontSize: 12,
      marginTop: 2,
      lineHeight: 16,
    },
    nativeSwitchHost: {
      width: 52,
      height: 32,
    },
    groupDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    soundProfileContainer: {
      paddingBottom: theme.spacing.lg,
    },
    groupRowLabelSub: {
      color: colors.subtle,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: theme.spacing.sm,
      paddingLeft: 4,
    },
    soundGrid: {
      marginHorizontal: -4,
    },
    soundOptionRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    soundSelectBtn: {
      flex: 1,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: colors.surface,
      marginRight: theme.spacing.sm,
      justifyContent: "center",
    },
    soundOptionText: {
      fontSize: 13,
      fontWeight: "500",
    },
    testSoundBtn: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    testSoundText: {
      fontSize: 12,
      fontWeight: "600",
    },
    advanceGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: -4,
    },
    advanceBtn: {
      width: "48%",
      marginHorizontal: "1%",
      marginVertical: 4,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    advanceBtnText: {
      fontSize: 12,
      fontWeight: "600",
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    logoCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing.md,
    },
    appName: {
      fontSize: 16,
      fontWeight: "800",
    },
    versionText: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },
    creditText: {
      fontSize: 12,
      lineHeight: 18,
      marginBottom: theme.spacing.md,
    },
    authorSection: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    authorLabel: {
      fontSize: 11,
      fontWeight: "500",
    },
    authorLink: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.md,
    },
    authorName: {
      fontSize: 14,
      fontWeight: "700",
    },
    authorHandle: {
      fontSize: 12,
      fontWeight: "500",
      marginTop: 1,
    },
    logoutHost: {
      marginTop: theme.spacing.xl,
      height: 48,
    },
  });
