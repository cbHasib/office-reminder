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
import { globalStyles, theme } from "../../src/lib/theme";
import {
  SOUND_LABELS,
  DEVELOPER,
  APP_NAME,
  SOURCE_REPO_URL,
  type SoundName,
  type Theme as ThemeType,
} from "@office-reminder/shared";
import {
  Settings,
  Volume2,
  Clock,
  LogOut,
  Github,
  Heart,
  ChevronRight,
  Info,
  Sliders,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ADVANCE_OPTIONS = [
  { label: "Reminder Default", value: null },
  { label: "1 minute before", value: 1 },
  { label: "3 minutes before", value: 3 },
  { label: "5 minutes before", value: 5 },
  { label: "10 minutes before", value: 10 },
  { label: "15 minutes before", value: 15 },
];

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { settings, refreshSettings } = useSettings();
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

  // Previews sound selection (simulates native alert sounds in Go Client)
  function testSound(soundName: SoundName) {
    Alert.alert(
      "Test Sound",
      `Previewing "${SOUND_LABELS[soundName]}". Standard device alert sounds will trigger when notifications arrive.`
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.profileHeader}>
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

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Notification Preferences</Text>

          <View style={[globalStyles.card, styles.settingCard]}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextContent}>
                <View style={styles.rowTitleContainer}>
                  <Volume2 size={18} color={theme.colors.brand} style={{ marginRight: 8 }} />
                  <Text style={styles.settingLabel}>Warning Alerts Sound</Text>
                </View>
                <Text style={styles.settingDesc}>
                  Play high-priority warning chimes when events approach.
                </Text>
              </View>
              <Host style={styles.nativeSwitchHost}>
                <NativeSwitch
                  value={settings?.sound_enabled ?? false}
                  onValueChange={(val) => updateSetting({ sound_enabled: val })}
                  disabled={updating}
                />
              </Host>
            </View>

            {settings?.sound_enabled ? (
              <View style={styles.soundListContainer}>
                <Text style={styles.subHeader}>Sound Profile</Text>
                {Object.entries(SOUND_LABELS).map(([value, label]) => {
                  const isSelected = settings?.sound_name === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.soundOption,
                        isSelected ? { borderColor: theme.colors.brand, backgroundColor: theme.colors.elevated } : {},
                      ]}
                      onPress={() => updateSetting({ sound_name: value })}
                      disabled={updating}
                    >
                      <Text
                        style={[
                          styles.soundOptionText,
                          isSelected && { color: theme.colors.brand, fontWeight: "700" },
                        ]}
                      >
                        {label}
                      </Text>
                      <Host>
                        <Button
                          variant="outlined"
                          onPress={() => testSound(value as SoundName)}
                          label="Test"
                        />
                      </Host>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Timing Offsets</Text>
          <View style={[globalStyles.card, styles.settingCard]}>
            <View style={styles.rowTitleContainer}>
              <Clock size={18} color={theme.colors.brand} style={{ marginRight: 8 }} />
              <Text style={styles.settingLabel}>Advance Warnings Lead Time</Text>
            </View>
            <Text style={[styles.settingDesc, { marginBottom: theme.spacing.md }]}>
              Override the team default warning times to trigger earlier notifications.
            </Text>

            <View style={styles.advanceGrid}>
              {ADVANCE_OPTIONS.map((opt) => {
                const isSelected = settings?.advance_minutes_override === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[
                      styles.advanceBtn,
                      isSelected ? { borderColor: theme.colors.brand, backgroundColor: theme.colors.elevated } : {},
                    ]}
                    onPress={() => updateSetting({ advance_minutes_override: opt.value })}
                    disabled={updating}
                  >
                    <Text
                      style={[
                        styles.advanceBtnText,
                        isSelected ? { color: theme.colors.brand, fontWeight: "700" } : {},
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

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>About App</Text>
          <View style={[globalStyles.card, styles.creditCard]}>
            <View style={styles.logoRow}>
              <View style={styles.logoCircle}>
                <Settings size={22} color={theme.colors.brand} />
              </View>
              <View>
                <Text style={styles.appName}>{APP_NAME}</Text>
                <Text style={styles.versionText}>Mobile Version 0.1.18 · SDK 56</Text>
              </View>
            </View>

            <Text style={styles.creditText}>
              A high-performance offline push-notification utility that maps recurring events
              and issues warnings natively without centralized cloud server push overhead.
            </Text>

            <View style={styles.divider} />

            <View style={styles.authorSection}>
              <Heart size={14} color={theme.colors.danger} style={{ marginRight: 6 }} />
              <Text style={styles.authorLabel}>Developed with passion by</Text>
            </View>
            <TouchableOpacity
              style={styles.authorLink}
              onPress={() => Linking.openURL(DEVELOPER.website)}
            >
              <Text style={styles.authorName}>{DEVELOPER.name}</Text>
              <Text style={styles.authorHandle}>{DEVELOPER.handle}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.repoLink}
              onPress={() => Linking.openURL(SOURCE_REPO_URL)}
            >
              <Github size={16} color={theme.colors.subtle} style={{ marginRight: 8 }} />
              <Text style={styles.repoText}>View Source on GitHub</Text>
              <ChevronRight size={14} color={theme.colors.subtle} style={{ marginLeft: "auto" }} />
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

const styles = StyleSheet.create({
  scrollContainer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
  },
  avatarText: {
    color: theme.colors.brandFg,
    fontSize: 24,
    fontWeight: "800",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: theme.colors.fg,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  profileEmail: {
    color: theme.colors.subtle,
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    color: theme.colors.fg,
    fontSize: 15,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: theme.spacing.sm,
  },
  settingCard: {
    paddingVertical: theme.spacing.md,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingTextContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  rowTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  settingLabel: {
    color: theme.colors.fg,
    fontSize: 15,
    fontWeight: "700",
  },
  settingDesc: {
    color: theme.colors.subtle,
    fontSize: 12,
    lineHeight: 16,
  },
  nativeSwitchHost: {
    width: 52,
    height: 32,
  },
  subHeader: {
    color: theme.colors.fg,
    fontSize: 13,
    fontWeight: "700",
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  soundListContainer: {
    marginTop: theme.spacing.md,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: theme.spacing.sm,
  },
  soundOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  soundOptionText: {
    color: theme.colors.fg,
    fontSize: 13,
    fontWeight: "500",
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
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  advanceBtnText: {
    color: theme.colors.fg,
    fontSize: 12,
    fontWeight: "600",
  },
  creditCard: {
    padding: theme.spacing.md,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.elevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.sm,
  },
  appName: {
    color: theme.colors.fg,
    fontSize: 16,
    fontWeight: "800",
  },
  versionText: {
    color: theme.colors.brand,
    fontSize: 11,
    fontWeight: "600",
  },
  creditText: {
    color: theme.colors.subtle,
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  authorSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  authorLabel: {
    color: theme.colors.subtle,
    fontSize: 11,
    fontWeight: "500",
  },
  authorLink: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  authorName: {
    color: theme.colors.fg,
    fontSize: 14,
    fontWeight: "700",
  },
  authorHandle: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  repoLink: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.elevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  repoText: {
    color: theme.colors.fg,
    fontSize: 12,
    fontWeight: "600",
  },
  logoutHost: {
    marginBottom: theme.spacing.xl,
    height: 48,
  },
});
