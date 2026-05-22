import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { useAuth, useSettings } from "../_layout";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/lib/theme";
import {
  effectiveAdvanceMinutes,
  getUpcomingOccurrences,
  isSilencedForUser,
  syncMobileScheduler,
} from "../../src/lib/notificationScheduler";
import { syncReminderLiveActivity } from "../../src/lib/reminderLiveActivity";
import type { Reminder } from "@office-reminder/shared";
import { Bell, RefreshCw, AlertCircle, Clock, Calendar } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useAppTheme, ColorPalette } from "../../src/lib/appearanceContext";

interface DisplayReminder {
  id: string; // reminderId@occurrenceISO
  reminderId: string;
  title: string;
  description: string;
  occurrence: Date;
  fireAt: Date;
  leadMinutes: number;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { colors, resolvedTheme } = useAppTheme();
  const styles = getStyles(colors, resolvedTheme);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<DisplayReminder[]>([]);
  const [nearestEvent, setNearestEvent] = useState<DisplayReminder | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Core data fetcher
  async function loadData() {
    if (!user) return;
    try {
      // 1. Get user's active teams
      const { data: memberData } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id);

      if (!memberData || memberData.length === 0) {
        setReminders([]);
        setUpcomingEvents([]);
        setNearestEvent(null);
        return;
      }

      const teamIds = memberData.map((m) => m.team_id);

      // 2. Get active reminders for those teams
      const { data: remindersData } = await supabase
        .from("reminders")
        .select("*")
        .in("team_id", teamIds);

      if (remindersData) {
        setReminders(remindersData as Reminder[]);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Home loading error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Trigger loading on mount
  useEffect(() => {
    loadData();

    // Subscribe to realtime database updates for reminders
    const channel = supabase
      .channel("home-reminders-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders" }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Compute occurrences & nearest event
  useEffect(() => {
    if (reminders.length === 0) {
      setUpcomingEvents([]);
      setNearestEvent(null);
      return;
    }

    const now = new Date();
    const start = new Date(now.getTime() - 2 * 60_000); // 2 mins buffer
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60_000); // 7-day future window

    const events: DisplayReminder[] = [];

    for (const r of reminders) {
      if (isSilencedForUser(r, settings, user?.id || "")) continue;

      const occurrences = getUpcomingOccurrences(r, start, end);
      const lead = effectiveAdvanceMinutes(r, settings);

      for (const occ of occurrences) {
        const eventAtMs = occ.getTime();
        const fireAtMs = eventAtMs - lead * 60_000;

        // Keep occurrences that haven't concluded yet
        if (eventAtMs + 5 * 60_000 > now.getTime()) {
          events.push({
            id: `${r.id}@${occ.toISOString()}`,
            reminderId: r.id,
            title: r.title,
            description: r.description || "",
            occurrence: occ,
            fireAt: new Date(fireAtMs),
            leadMinutes: lead,
          });
        }
      }
    }

    // Sort chronologically
    events.sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());

    setUpcomingEvents(events);

    // Set the very nearest event
    if (events.length > 0) {
      setNearestEvent(events[0]);
    } else {
      setNearestEvent(null);
    }
  }, [reminders, settings, user]);

  // Realtime countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      if (!nearestEvent) {
        setTimeRemaining("");
        return;
      }

      const now = new Date().getTime();
      const eventTime = nearestEvent.occurrence.getTime();
      const fireTime = nearestEvent.fireAt.getTime();

      if (now < fireTime) {
        // Countdown to warning lead
        const diff = fireTime - now;
        const totalSecs = Math.floor(diff / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        setTimeRemaining(`Warning in ${mins}m ${secs.toString().padStart(2, "0")}s`);
      } else if (now >= fireTime && now <= eventTime) {
        // Warning is active! Countdown to actual event start
        const diff = eventTime - now;
        const totalSecs = Math.floor(diff / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        setTimeRemaining(`EVENT STARTS IN ${mins}m ${secs.toString().padStart(2, "0")}s`);
      } else {
        // Event has started / active
        setTimeRemaining("Event Active!");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nearestEvent]);

  useEffect(() => {
    let disposed = false;

    async function syncActiveCountdown() {
      if (!nearestEvent) {
        await syncReminderLiveActivity(null);
        return;
      }

      const now = Date.now();
      const fireTime = nearestEvent.fireAt.getTime();
      const eventTime = nearestEvent.occurrence.getTime();

      if (now >= fireTime && now <= eventTime) {
        await syncReminderLiveActivity({
          reminderId: nearestEvent.reminderId,
          title: nearestEvent.title,
          description: nearestEvent.description,
          startsAtISO: nearestEvent.occurrence.toISOString(),
          warningAtISO: nearestEvent.fireAt.toISOString(),
          leadMinutes: nearestEvent.leadMinutes,
        });
      } else if (now > eventTime && !disposed) {
        await syncReminderLiveActivity(null);
      }
    }

    syncActiveCountdown();
    const timer = setInterval(syncActiveCountdown, 15_000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [nearestEvent]);

  // Run manual sync scheduler
  async function triggerManualSync() {
    if (!user) return;
    setRefreshing(true);
    setSyncStatus("Synchronising...");
    try {
      const count = await syncMobileScheduler(user.id);
      setSyncStatus(`Scheduled ${count} alerts!`);
      await loadData();
    } catch {
      setSyncStatus("Sync failed.");
    } finally {
      setTimeout(() => setSyncStatus(null), 3000);
    }
  }

  function renderUpcomingItem({ item }: { item: DisplayReminder }) {
    const isWarningActive = new Date().getTime() >= item.fireAt.getTime() && new Date().getTime() <= item.occurrence.getTime();
    
    return (
      <View style={[styles.card, styles.eventCard]}>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.eventDescription} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <View style={styles.eventTimeRow}>
            <Clock size={14} color={colors.subtle} />
            <Text style={styles.eventTimeText}>
              {item.occurrence.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (Warning: -{item.leadMinutes}m)
            </Text>
          </View>
        </View>
        
        {isWarningActive ? (
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>DUE NOW</Text>
          </View>
        ) : (
          <View style={styles.upcomingPill}>
            <Text style={styles.upcomingPillText}>
              {item.occurrence.toLocaleDateString([], { month: "short", day: "numeric" })}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.rootContainer}>
      {/* Absolute Translucent Glass Header */}
      <BlurView
        intensity={85}
        tint={resolvedTheme === "dark" ? "dark" : "light"}
        style={[styles.headerBlur, { borderBottomColor: colors.border }]}
      >
        <SafeAreaView edges={["top", "left", "right"]} style={{ backgroundColor: "transparent" }}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.username}>
                {user?.display_name || user?.email?.split("@")[0] || "Teammate"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={triggerManualSync}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <RefreshCw size={20} color={colors.fg} />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </BlurView>

      {syncStatus && (
        <View style={[styles.syncAlert, { backgroundColor: colors.brand }]}>
          <Text style={[styles.syncAlertText, { color: colors.brandFg }]}>{syncStatus}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={[styles.scrollContainer, { paddingTop: 110 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Circular Countdown Panel */}
          {nearestEvent ? (
            <View style={styles.countdownContainer}>
              <View style={styles.pulseGlow} />
              <View style={styles.countdownCircle}>
                <Clock size={28} color={colors.brand} style={{ marginBottom: theme.spacing.xs }} />
                <Text style={styles.countdownTitle} numberOfLines={1}>
                  {nearestEvent.title}
                </Text>
                <Text
                  style={[
                    styles.countdownTime,
                    timeRemaining.includes("EVENT STARTS") && { color: colors.danger },
                  ]}
                >
                  {timeRemaining || "Calculating..."}
                </Text>
                <View style={styles.eventTimePill}>
                  <Calendar size={12} color={colors.subtle} style={{ marginRight: 4 }} />
                  <Text style={styles.eventTimePillText}>
                    {nearestEvent.occurrence.toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    at {nearestEvent.occurrence.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <AlertCircle size={32} color={colors.subtle} />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySubtitle}>
                No scheduled reminders for the next 7 days. Add a reminder in your active Teams to get started.
              </Text>
            </View>
          )}

          {/* Upcoming Event List */}
          <View style={styles.listSection}>
            <Text style={styles.sectionHeader}>Upcoming Warnings</Text>
            {upcomingEvents.length > 0 ? (
              <FlatList
                data={upcomingEvents}
                keyExtractor={(item) => item.id}
                renderItem={renderUpcomingItem}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.noEventsText}>No pending alerts</Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (colors: ColorPalette, resolvedTheme: "light" | "dark") =>
  StyleSheet.create({
    rootContainer: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContainer: {
      paddingBottom: 120, // ample space at bottom for transparent tabs
    },
    headerBlur: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      borderBottomWidth: 1,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    greeting: {
      color: colors.subtle,
      fontSize: 14,
      fontWeight: "500",
    },
    username: {
      color: colors.fg,
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: -0.5,
    },
    syncBtn: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    syncAlert: {
      position: "absolute",
      top: 90,
      left: 0,
      right: 0,
      zIndex: 9,
      paddingVertical: theme.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    syncAlertText: {
      fontSize: 14,
      fontWeight: "600",
    },
    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
    },
    countdownContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.xxl,
      position: "relative",
    },
    pulseGlow: {
      position: "absolute",
      width: 250,
      height: 250,
      borderRadius: 125,
      backgroundColor: resolvedTheme === "dark" ? "rgba(129, 140, 248, 0.04)" : "rgba(99, 102, 241, 0.04)",
      borderColor: resolvedTheme === "dark" ? "rgba(129, 140, 248, 0.08)" : "rgba(99, 102, 241, 0.08)",
      borderWidth: 2,
    },
    countdownCircle: {
      width: 230,
      height: 230,
      borderRadius: 115,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.lg,
      elevation: 4,
      shadowColor: resolvedTheme === "dark" ? "#000" : "#64748B",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: resolvedTheme === "dark" ? 0.25 : 0.1,
      shadowRadius: 10,
    },
    countdownTitle: {
      color: colors.fg,
      fontSize: 16,
      fontWeight: "700",
      marginBottom: theme.spacing.xs,
      textAlign: "center",
    },
    countdownTime: {
      color: colors.brand,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
      marginVertical: theme.spacing.sm,
      letterSpacing: -0.2,
    },
    eventTimePill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.elevated,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      marginTop: theme.spacing.xs,
    },
    eventTimePillText: {
      color: colors.subtle,
      fontSize: 11,
      fontWeight: "500",
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.xxl,
      paddingHorizontal: theme.spacing.xxl,
      marginTop: 20,
    },
    emptyIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.md,
      borderColor: colors.border,
      borderWidth: 1,
    },
    emptyTitle: {
      color: colors.fg,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: theme.spacing.sm,
    },
    emptySubtitle: {
      color: colors.subtle,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    listSection: {
      paddingHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md,
    },
    sectionHeader: {
      color: colors.fg,
      fontSize: 16,
      fontWeight: "700",
      marginBottom: theme.spacing.md,
      letterSpacing: -0.2,
    },
    noEventsText: {
      color: colors.subtle,
      fontSize: 14,
      textAlign: "center",
      marginVertical: theme.spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    eventCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing.md,
    },
    eventInfo: {
      flex: 1,
      marginRight: theme.spacing.md,
    },
    eventTitle: {
      color: colors.fg,
      fontSize: 15,
      fontWeight: "700",
    },
    eventDescription: {
      color: colors.subtle,
      fontSize: 13,
      marginTop: 2,
    },
    eventTimeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: theme.spacing.sm,
    },
    eventTimeText: {
      color: colors.subtle,
      fontSize: 12,
      marginLeft: 4,
      fontWeight: "500",
    },
    activePill: {
      backgroundColor: "rgba(248, 113, 113, 0.15)",
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      borderColor: "rgba(248, 113, 113, 0.3)",
      borderWidth: 1,
    },
    activePillText: {
      color: colors.danger,
      fontSize: 10,
      fontWeight: "700",
    },
    upcomingPill: {
      backgroundColor: colors.elevated,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      borderColor: colors.border,
      borderWidth: 1,
    },
    upcomingPillText: {
      color: colors.fg,
      fontSize: 10,
      fontWeight: "600",
    },
  });
