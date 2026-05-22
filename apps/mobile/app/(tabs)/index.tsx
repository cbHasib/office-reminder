import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
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
import type { Reminder } from "../../src/lib/shared";
import { Bell, RefreshCw, AlertCircle, Clock, Calendar, Timer, Zap } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useAppTheme, ColorPalette } from "../../src/lib/appearanceContext";

interface DisplayReminder {
  id: string; // reminderId@occurrenceISO
  reminderId: string;
  teamId: string;
  title: string;
  description: string;
  occurrence: Date;
  fireAt: Date;
  leadMinutes: number;
}

// ── Smart time formatter ────────────────────────────────────────────
// Shows "7h 23m 05s", "23m 05s", or "45s" depending on magnitude
function formatSmartTime(totalMs: number): { text: string; segments: { value: string; unit: string }[] } {
  const totalSecs = Math.max(0, Math.floor(totalMs / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  const segments: { value: string; unit: string }[] = [];
  if (h > 0) segments.push({ value: String(h), unit: "h" });
  if (h > 0 || m > 0) segments.push({ value: h > 0 ? String(m).padStart(2, "0") : String(m), unit: "m" });
  segments.push({ value: (h > 0 || m > 0) ? String(s).padStart(2, "0") : String(s), unit: "s" });

  const text = segments.map((seg) => `${seg.value}${seg.unit}`).join(" ");
  return { text, segments };
}

// ── Progress Ring Component ─────────────────────────────────────────
const RING_SIZE = 200;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({
  progress,
  isWarning,
  colors,
  resolvedTheme,
}: {
  progress: number; // 0..1 where 1 = full, 0 = depleted
  isWarning: boolean;
  colors: ColorPalette;
  resolvedTheme: "light" | "dark";
}) {
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

  // Gradient colours: brand → danger as progress drops
  const startColor = isWarning ? colors.danger : colors.brand;
  const endColor = isWarning
    ? "#FF6B6B"
    : resolvedTheme === "dark"
      ? "#A78BFA"
      : "#818CF8";

  const trackColor = resolvedTheme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";

  return (
    <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
      <Defs>
        <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={startColor} />
          <Stop offset="100%" stopColor={endColor} />
        </LinearGradient>
      </Defs>
      {/* Track */}
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        stroke={trackColor}
        strokeWidth={RING_STROKE}
        fill="none"
      />
      {/* Progress arc */}
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        stroke="url(#ringGrad)"
        strokeWidth={RING_STROKE}
        fill="none"
        strokeDasharray={`${RING_CIRCUMFERENCE}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
    </Svg>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { colors, resolvedTheme } = useAppTheme();
  const styles = getStyles(colors, resolvedTheme);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<DisplayReminder[]>([]);
  const [nearestEvent, setNearestEvent] = useState<DisplayReminder | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [timeSegments, setTimeSegments] = useState<{ value: string; unit: string }[]>([]);
  const [countdownPhase, setCountdownPhase] = useState<"idle" | "pre" | "warning" | "active">("idle");
  const [ringProgress, setRingProgress] = useState(1);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Pulse animation for glow ring
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Core data fetcher
  async function loadData() {
    if (!user) return;
    try {
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
    const start = new Date(now.getTime() - 2 * 60_000);
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

    const events: DisplayReminder[] = [];

    for (const r of reminders) {
      if (isSilencedForUser(r, settings, user?.id || "")) continue;

      const occurrences = getUpcomingOccurrences(r, start, end);
      const lead = effectiveAdvanceMinutes(r, settings);

      for (const occ of occurrences) {
        const eventAtMs = occ.getTime();
        const fireAtMs = eventAtMs - lead * 60_000;

        if (eventAtMs + 5 * 60_000 > now.getTime()) {
          events.push({
            id: `${r.id}@${occ.toISOString()}`,
            reminderId: r.id,
            teamId: r.team_id,
            title: r.title,
            description: r.description || "",
            occurrence: occ,
            fireAt: new Date(fireAtMs),
            leadMinutes: lead,
          });
        }
      }
    }

    events.sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
    setUpcomingEvents(events);
    setNearestEvent(events.length > 0 ? events[0] : null);
  }, [reminders, settings, user]);

  // Realtime countdown ticker with smart formatting
  useEffect(() => {
    const timer = setInterval(() => {
      if (!nearestEvent) {
        setTimeRemaining("");
        setTimeSegments([]);
        setCountdownPhase("idle");
        setRingProgress(1);
        return;
      }

      const now = Date.now();
      const eventTime = nearestEvent.occurrence.getTime();
      const fireTime = nearestEvent.fireAt.getTime();

      if (now < fireTime) {
        // Pre-warning: count down to when warning fires
        const diff = fireTime - now;
        const { text, segments } = formatSmartTime(diff);
        setTimeRemaining(text);
        setTimeSegments(segments);
        setCountdownPhase("pre");

        // Progress: from now to fireTime (total window = eventTime - now at start)
        const totalWindow = eventTime - now;
        const warningWindow = eventTime - fireTime;
        setRingProgress(totalWindow > 0 ? Math.min(1, Math.max(0, (totalWindow - warningWindow) / totalWindow + (warningWindow / totalWindow) * (diff / (fireTime - (eventTime - nearestEvent.leadMinutes * 60_000 - (eventTime - fireTime)) > 0 ? eventTime - nearestEvent.leadMinutes * 60_000 : now)))) : 1);
        // Simplified: just use ratio of remaining-to-fire vs lead window
        const preTotal = fireTime - (eventTime - nearestEvent.leadMinutes * 60_000);
        setRingProgress(preTotal > 0 ? Math.min(1, diff / preTotal) : 1);
      } else if (now >= fireTime && now <= eventTime) {
        // Warning active: countdown to event start
        const diff = eventTime - now;
        const { text, segments } = formatSmartTime(diff);
        setTimeRemaining(text);
        setTimeSegments(segments);
        setCountdownPhase("warning");

        // Progress drains from 1 → 0 during warning window
        const warningWindow = eventTime - fireTime;
        setRingProgress(warningWindow > 0 ? Math.min(1, Math.max(0, diff / warningWindow)) : 0);
      } else {
        setTimeRemaining("Happening Now");
        setTimeSegments([]);
        setCountdownPhase("active");
        setRingProgress(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nearestEvent]);

  // Live activity sync (unchanged logic)
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

      if (now >= fireTime && now <= eventTime + 60_000) {
        const isHappeningNow = now > eventTime;

        let hours = nearestEvent.occurrence.getHours();
        const minutes = nearestEvent.occurrence.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const minStr = minutes < 10 ? '0' + minutes : minutes;
        const startsAtFormatted = isHappeningNow ? "Now" : `${hours}:${minStr} ${ampm}`;

        let wHours = nearestEvent.fireAt.getHours();
        const wMinutes = nearestEvent.fireAt.getMinutes();
        const wAmpm = wHours >= 12 ? 'PM' : 'AM';
        wHours = wHours % 12;
        wHours = wHours ? wHours : 12;
        const wMinStr = wMinutes < 10 ? '0' + wMinutes : wMinutes;
        const warningAtFormatted = `${wHours}:${wMinStr} ${wAmpm}`;

        await syncReminderLiveActivity({
          reminderId: nearestEvent.reminderId,
          teamId: nearestEvent.teamId,
          title: nearestEvent.title,
          description: isHappeningNow ? "Happening now!" : nearestEvent.description,
          startsAtISO: nearestEvent.occurrence.toISOString(),
          warningAtISO: nearestEvent.fireAt.toISOString(),
          leadMinutes: nearestEvent.leadMinutes,
          startsAtFormatted,
          warningAtFormatted,
        });
      } else if (now > eventTime + 60_000 && !disposed) {
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

  // Manual sync
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

  // ── Countdown Phase Styling ───────────────────────────────────────
  const isWarning = countdownPhase === "warning";
  const isActive = countdownPhase === "active";

  const circleAccent = isActive
    ? colors.success
    : isWarning
      ? colors.danger
      : colors.brand;

  const phaseLabel =
    isActive ? "HAPPENING NOW" : isWarning ? "STARTING SOON" : "UPCOMING";

  const phaseLabelColor =
    isActive ? colors.success : isWarning ? colors.danger : colors.subtle;

  // ── Render ────────────────────────────────────────────────────────
  function renderUpcomingItem({ item }: { item: DisplayReminder }) {
    const now = Date.now();
    const isItemWarning = now >= item.fireAt.getTime() && now <= item.occurrence.getTime();
    const isItemActive = now > item.occurrence.getTime();

    return (
      <View style={[styles.eventCard, isItemWarning && styles.eventCardWarning]}>
        {/* Left accent bar */}
        <View
          style={[
            styles.eventAccentBar,
            { backgroundColor: isItemActive ? colors.success : isItemWarning ? colors.danger : colors.brand },
          ]}
        />
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.eventDescription} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <View style={styles.eventTimeRow}>
            <Clock size={12} color={colors.subtle} />
            <Text style={styles.eventTimeText}>
              {item.occurrence.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
            <View style={styles.eventLeadBadge}>
              <Timer size={10} color={colors.subtle} />
              <Text style={styles.eventLeadText}>-{item.leadMinutes}m</Text>
            </View>
          </View>
        </View>

        {isItemWarning ? (
          <View style={styles.activePill}>
            <Zap size={10} color={colors.danger} />
            <Text style={styles.activePillText}>DUE</Text>
          </View>
        ) : isItemActive ? (
          <View style={[styles.activePill, { backgroundColor: "rgba(52, 211, 153, 0.12)", borderColor: "rgba(52, 211, 153, 0.25)" }]}>
            <Text style={[styles.activePillText, { color: colors.success }]}>LIVE</Text>
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
      {/* Compact Glass Header */}
      <BlurView
        intensity={85}
        tint={resolvedTheme === "dark" ? "dark" : "light"}
        style={[styles.headerBlur, { borderBottomColor: colors.border }]}
      >
        <SafeAreaView edges={["top", "left", "right"]} style={{ backgroundColor: "transparent" }}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>Hello, </Text>
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
                <RefreshCw size={16} color={colors.subtle} />
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
          contentContainerStyle={[styles.scrollContainer, { paddingTop: insets.top + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Premium Circular Countdown ──────────────────────── */}
          {nearestEvent ? (
            <View style={styles.countdownContainer}>
              {/* Animated outer glow */}
              <Animated.View
                style={[
                  styles.pulseGlow,
                  {
                    transform: [{ scale: pulseAnim }],
                    borderColor: isWarning
                      ? "rgba(248, 113, 113, 0.15)"
                      : isActive
                        ? "rgba(52, 211, 153, 0.15)"
                        : resolvedTheme === "dark"
                          ? "rgba(129, 140, 248, 0.10)"
                          : "rgba(99, 102, 241, 0.08)",
                    backgroundColor: isWarning
                      ? "rgba(248, 113, 113, 0.03)"
                      : isActive
                        ? "rgba(52, 211, 153, 0.03)"
                        : resolvedTheme === "dark"
                          ? "rgba(129, 140, 248, 0.03)"
                          : "rgba(99, 102, 241, 0.03)",
                  },
                ]}
              />

              {/* SVG progress ring */}
              <ProgressRing
                progress={ringProgress}
                isWarning={isWarning || isActive}
                colors={colors}
                resolvedTheme={resolvedTheme}
              />

              {/* Inner content circle */}
              <View style={[styles.countdownCircle, { borderColor: `${circleAccent}22` }]}>
                {/* Phase label */}
                <Text style={[styles.phaseLabel, { color: phaseLabelColor }]}>{phaseLabel}</Text>

                {/* Event title */}
                <Text style={styles.countdownTitle} numberOfLines={1}>
                  {nearestEvent.title}
                </Text>

                {/* Countdown digits */}
                {timeSegments.length > 0 ? (
                  <View style={styles.segmentRow}>
                    {timeSegments.map((seg, i) => (
                      <View key={i} style={styles.segmentBlock}>
                        <Text style={[styles.segmentValue, { color: circleAccent }]}>{seg.value}</Text>
                        <Text style={[styles.segmentUnit, { color: circleAccent }]}>{seg.unit}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.countdownTime, { color: circleAccent }]}>
                    {timeRemaining || "—"}
                  </Text>
                )}

                {/* Date pill */}
                <View style={styles.eventTimePill}>
                  <Calendar size={11} color={colors.subtle} style={{ marginRight: 4 }} />
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
                <Bell size={28} color={colors.subtle} />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySubtitle}>
                No scheduled reminders for the next 7 days. Add a reminder in your active Teams to get started.
              </Text>
            </View>
          )}

          {/* ── Upcoming Event List ────────────────────────────── */}
          <View style={[styles.listSection, { marginTop: 20 }]}>
            <Text style={styles.sectionHeader}>Upcoming</Text>
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

// ── Styles ────────────────────────────────────────────────────────────
const getStyles = (colors: ColorPalette, resolvedTheme: "light" | "dark") =>
  StyleSheet.create({
    rootContainer: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContainer: {
      paddingBottom: 120,
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
      paddingTop: 12,
      paddingBottom: 10,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "baseline",
      flex: 1,
    },
    greeting: {
      color: colors.subtle,
      fontSize: 15,
      fontWeight: "500",
    },
    username: {
      color: colors.fg,
      fontSize: 17,
      fontWeight: "700",
      letterSpacing: -0.3,
    },
    syncBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    syncAlert: {
      position: "absolute",
      top: 70,
      left: 0,
      right: 0,
      zIndex: 9,
      paddingVertical: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    syncAlertText: {
      fontSize: 13,
      fontWeight: "600",
    },
    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
    },

    // ── Countdown Circle ──
    countdownContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.xl,
      position: "relative",
    },
    pulseGlow: {
      position: "absolute",
      width: RING_SIZE + 24,
      height: RING_SIZE + 24,
      borderRadius: (RING_SIZE + 24) / 2,
      borderWidth: 1.5,
    },
    countdownCircle: {
      width: RING_SIZE - RING_STROKE * 2 - 12,
      height: RING_SIZE - RING_STROKE * 2 - 12,
      borderRadius: (RING_SIZE - RING_STROKE * 2 - 12) / 2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.md,
      elevation: 12,
      shadowColor: resolvedTheme === "dark" ? colors.brand : "#6366F1",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: resolvedTheme === "dark" ? 0.35 : 0.18,
      shadowRadius: 28,
    },
    phaseLabel: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.5,
      marginBottom: 4,
    },
    countdownTitle: {
      color: colors.fg,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 1,
      textAlign: "center",
      maxWidth: 130,
    },
    segmentRow: {
      flexDirection: "row",
      alignItems: "baseline",
      marginVertical: 6,
      gap: 1,
    },
    segmentBlock: {
      flexDirection: "row",
      alignItems: "baseline",
    },
    segmentValue: {
      fontSize: 24,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
      letterSpacing: -1,
    },
    segmentUnit: {
      fontSize: 11,
      fontWeight: "600",
      marginRight: 5,
      opacity: 0.7,
    },
    countdownTime: {
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center",
      marginVertical: theme.spacing.sm,
      letterSpacing: -0.3,
    },
    eventTimePill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.elevated,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.radius.sm,
      marginTop: 3,
    },
    eventTimePillText: {
      color: colors.subtle,
      fontSize: 9,
      fontWeight: "500",
    },

    // ── Empty State ──
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.xxl + 24,
      paddingHorizontal: theme.spacing.xxl,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.lg,
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

    // ── Upcoming List ──
    listSection: {
      paddingHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.sm,
    },
    sectionHeader: {
      color: colors.fg,
      fontSize: 17,
      fontWeight: "700",
      marginBottom: theme.spacing.md,
      letterSpacing: -0.3,
    },
    noEventsText: {
      color: colors.subtle,
      fontSize: 14,
      textAlign: "center",
      marginVertical: theme.spacing.lg,
    },

    // ── Event Cards ──
    eventCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingRight: theme.spacing.lg,
      paddingLeft: 0,
      marginBottom: theme.spacing.sm,
      overflow: "hidden",
    },
    eventCardWarning: {
      borderColor: "rgba(248, 113, 113, 0.25)",
      backgroundColor: resolvedTheme === "dark" ? "rgba(248, 113, 113, 0.04)" : "rgba(248, 113, 113, 0.03)",
    },
    eventAccentBar: {
      width: 3.5,
      alignSelf: "stretch",
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
      marginRight: 14,
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
      fontSize: 12,
      marginTop: 2,
    },
    eventTimeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
      gap: 4,
    },
    eventTimeText: {
      color: colors.subtle,
      fontSize: 12,
      fontWeight: "500",
    },
    eventLeadBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.elevated,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 4,
      gap: 2,
    },
    eventLeadText: {
      color: colors.subtle,
      fontSize: 10,
      fontWeight: "600",
    },
    activePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "rgba(248, 113, 113, 0.12)",
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.radius.sm,
      borderColor: "rgba(248, 113, 113, 0.25)",
      borderWidth: 1,
    },
    activePillText: {
      color: colors.danger,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    upcomingPill: {
      backgroundColor: colors.elevated,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
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
