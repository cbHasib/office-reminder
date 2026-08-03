import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { ArrowRight, Plus, Shield, Users } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../_layout";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/lib/theme";
import { useAppTheme, ColorPalette } from "../../src/lib/appearanceContext";

interface TeamWithRole {
  id: string;
  name: string;
  join_code: string;
  require_approval: boolean;
  role: "admin" | "member";
}

export default function TeamsScreen() {
  const { user } = useAuth();
  const { colors, resolvedTheme } = useAppTheme();
  const styles = getStyles(colors, resolvedTheme);

  const [teams, setTeams] = useState<TeamWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [teamNameInput, setTeamNameInput] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);


  async function loadTeams() {
    if (!user) return;
    try {
      const { data: memberData, error: memberErr } = await supabase
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", user.id);

      if (memberErr) throw memberErr;
      if (!memberData || memberData.length === 0) {
        setTeams([]);
        return;
      }

      const teamIds = memberData.map((m) => m.team_id);
      const roleMap = new Map<string, "admin" | "member">(memberData.map((m) => [m.team_id, m.role]));

      const { data: teamsData, error: teamsErr } = await supabase.from("teams").select("*").in("id", teamIds);
      if (teamsErr) throw teamsErr;

      setTeams((teamsData || []).map((team: any) => ({
        id: team.id,
        name: team.name,
        join_code: team.join_code,
        require_approval: team.require_approval,
        role: roleMap.get(team.id) || "member",
      })));
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load teams");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTeams();
  }, [user]);

  async function handleJoinTeam() {
    const code = joinCodeInput.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert("Invalid Code", "Please enter a valid 6-character team invite code.");
      return;
    }
    if (!user) return;

    setSubmittingJoin(true);
    try {
      // All validation (code lookup, membership, require_approval) happens
      // server-side — join codes are no longer client-readable.
      const { data, error: rpcErr } = await supabase.rpc("join_team_with_code", {
        p_code: code,
        p_message: "Please let me join the team via the mobile app.",
      });
      if (rpcErr) throw rpcErr;

      const result = data as { status: string; team_id?: string; team_name?: string };
      switch (result.status) {
        case "not_found":
          Alert.alert("Not Found", "No team was found matching this code.");
          return;
        case "rate_limited":
          Alert.alert("Too Many Attempts", "Please wait a few minutes and try again.");
          return;
        case "already_member":
          Alert.alert("Already a Member", "You are already a member of this team.");
          return;
        case "request_pending":
          Alert.alert("Request Pending", `Your request to join "${result.team_name}" is already awaiting approval.`);
          return;
        case "request_sent":
          Alert.alert("Request Sent", `Your request to join "${result.team_name}" is pending administrator approval.`);
          break;
        case "joined":
          Alert.alert("Joined", `You have joined "${result.team_name}".`);
          await loadTeams();
          break;
        default:
          Alert.alert("Join Error", "Unexpected response — please try again.");
          return;
      }
      setJoinCodeInput("");
    } catch (err: any) {
      Alert.alert("Join Error", err.message || "Failed to join team.");
    } finally {
      setSubmittingJoin(false);
    }
  }

  async function handleCreateTeam() {
    const name = teamNameInput.trim();
    if (!name) {
      Alert.alert("Invalid Name", "Please enter a team name.");
      return;
    }
    if (!user) return;

    setSubmittingCreate(true);
    try {
      // The join code is assigned server-side (DB trigger) — never sent by the client.
      const { data: created, error: createErr } = await supabase.from("teams").insert({
        name,
        created_by: user.id,
        require_approval: requireApproval,
      }).select().single();
      if (createErr) throw createErr;

      Alert.alert("Team Created", `"${name}" is ready. Invite code: ${created?.join_code ?? "—"}`);
      setTeamNameInput("");
      setRequireApproval(false);
      await loadTeams();
    } catch (err: any) {
      Alert.alert("Create Error", err.message || "Failed to create team.");
    } finally {
      setSubmittingCreate(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand} onRefresh={async () => { setRefreshing(true); await loadTeams(); }} />}
      >
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.eyebrow}>Workspace</Text>
            <Text style={styles.title}>Teams</Text>
            <Text style={styles.headerCaption}>Manage the groups that receive your reminders.</Text>
          </View>
          <View style={styles.summaryPill}>
            <Users size={15} color={colors.brand} />
            <Text style={styles.summaryText}>{teams.length}</Text>
          </View>
        </View>

        <SectionTitle title="My Teams" caption="Open a team to manage reminders and teammates." colors={colors} />
        {loading ? (
          <View style={styles.loadingCard}><ActivityIndicator size="large" color={colors.brand} /></View>
        ) : teams.length > 0 ? (
          <View style={styles.teamStack}>
            {teams.map((item) => {
              const isAdmin = item.role === "admin";
              return (
                <TouchableOpacity key={item.id} style={styles.teamCard} onPress={() => router.push(`/team/${item.id}`)} activeOpacity={0.78}>
                  <View style={styles.teamIcon}>
                    <Users size={19} color={colors.brand} />
                  </View>
                  <View style={styles.teamMain}>
                    <View style={styles.teamTitleRow}>
                      <Text style={styles.teamName} numberOfLines={1}>{item.name}</Text>
                      <View style={[styles.badge, isAdmin ? styles.badgeAdmin : styles.badgeMember]}>
                        <Text style={[styles.badgeText, isAdmin ? styles.badgeTextAdmin : styles.badgeTextMember]}>{isAdmin ? "Admin" : "Member"}</Text>
                      </View>
                    </View>
                    <View style={styles.detailsRow}>
                      <Text style={styles.codeText}>{item.join_code}</Text>
                      <View style={styles.dot} />
                      <Shield size={12} color={colors.subtle} />
                      <Text style={styles.approvalText}>{item.require_approval ? "Approval required" : "Open join"}</Text>
                    </View>
                  </View>
                  <ArrowRight size={18} color={colors.subtle} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Users size={30} color={colors.subtle} />
            <Text style={styles.emptyTitle}>No teams yet</Text>
            <Text style={styles.emptyText}>Join with an invite code or create a new team below.</Text>
          </View>
        )}

        <SectionTitle title="Join Team" caption="Use the 6-character invite code from an admin." colors={colors} />
        <View style={styles.actionCard}>
          <View style={styles.inlineRow}>
            <TextInput
              style={[styles.input, styles.codeField]}
              placeholder="ABCDEF"
              placeholderTextColor={colors.subtle}
              value={joinCodeInput}
              onChangeText={setJoinCodeInput}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity style={[styles.compactButton, submittingJoin && styles.disabled]} onPress={handleJoinTeam} disabled={submittingJoin} activeOpacity={0.8}>
              {submittingJoin ? <ActivityIndicator color={colors.brandFg} /> : <ArrowRight size={18} color={colors.brandFg} />}
            </TouchableOpacity>
          </View>
        </View>

        <SectionTitle title="Create Team" caption="Set up a team space and share the generated invite code." colors={colors} />
        <View style={styles.actionCard}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Engineering Team"
            placeholderTextColor={colors.subtle}
            value={teamNameInput}
            onChangeText={setTeamNameInput}
          />

          <View style={styles.toggleRow}>
            <View style={styles.toggleIcon}><Shield size={18} color={colors.success} /></View>
            <View style={styles.toggleTextBlock}>
              <Text style={styles.toggleLabel}>Require join approvals</Text>
              <Text style={styles.toggleSublabel}>Admins review new members before they see reminders.</Text>
            </View>
            <Switch
              value={requireApproval}
              onValueChange={setRequireApproval}
              trackColor={{ false: colors.muted, true: colors.brand }}
              thumbColor={requireApproval ? colors.brandFg : colors.subtle}
            />
          </View>

          <TouchableOpacity style={[styles.primaryButton, submittingCreate && styles.disabled]} onPress={handleCreateTeam} disabled={submittingCreate} activeOpacity={0.82}>
            {submittingCreate ? <ActivityIndicator color={colors.brandFg} /> : (
              <>
                <Plus size={18} color={colors.brandFg} />
                <Text style={styles.primaryButtonText}>Create Team</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title, caption, colors }: { title: string; caption: string; colors: ColorPalette }) {
  const styles = getSectionStyles(colors);
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <Text style={styles.sectionCaption}>{caption}</Text>
    </View>
  );
}

const getSectionStyles = (colors: ColorPalette) => StyleSheet.create({
  sectionTitle: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  sectionHeader: {
    color: colors.fg,
    fontSize: 16,
    fontWeight: "600",
  },
  sectionCaption: {
    color: colors.subtle,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});

const getStyles = (colors: ColorPalette, resolvedTheme: "light" | "dark") =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContainer: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: 120,
    },
    pageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.lg,
    },
    eyebrow: {
      color: colors.brand,
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    title: {
      color: colors.fg,
      fontSize: 28,
      fontWeight: "700",
      letterSpacing: 0,
    },
    headerCaption: {
      color: colors.subtle,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2,
      maxWidth: 250,
    },
    summaryPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    summaryText: {
      color: colors.fg,
      fontSize: 14,
      fontWeight: "600",
    },
    loadingCard: {
      minHeight: 120,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
    },
    teamStack: {
      gap: theme.spacing.sm,
    },
    teamCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      shadowColor: resolvedTheme === "dark" ? "#000" : "#64748B",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: resolvedTheme === "dark" ? 0.08 : 0.03,
      shadowRadius: 8,
      elevation: 1,
    },
    teamIcon: {
      width: 38,
      height: 38,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.elevated,
    },
    teamMain: {
      flex: 1,
      minWidth: 0,
    },
    teamTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    teamName: {
      flex: 1,
      color: colors.fg,
      fontSize: 16,
      fontWeight: "600",
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.full,
    },
    badgeAdmin: { backgroundColor: "rgba(124, 155, 255, 0.10)" },
    badgeMember: { backgroundColor: colors.elevated },
    badgeText: { fontSize: 10, fontWeight: "600" },
    badgeTextAdmin: { color: colors.brand },
    badgeTextMember: { color: colors.subtle },
    detailsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 5,
    },
    codeText: {
      color: colors.fg,
      fontSize: 12,
      fontWeight: "500",
      letterSpacing: 0.6,
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    approvalText: {
      color: colors.subtle,
      fontSize: 12,
      fontWeight: "500",
    },
    emptyCard: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.xl,
    },
    emptyTitle: {
      color: colors.fg,
      fontSize: 16,
      fontWeight: "600",
      marginTop: theme.spacing.md,
    },
    emptyText: {
      color: colors.subtle,
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 4,
    },
    actionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.lg,
    },
    inlineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    input: {
      minHeight: 50,
      backgroundColor: colors.elevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      color: colors.fg,
      paddingHorizontal: theme.spacing.lg,
      fontSize: 15,
      marginBottom: theme.spacing.md,
    },
    codeField: {
      flex: 1,
      marginBottom: 0,
      fontSize: 16,
      fontWeight: "600",
      letterSpacing: 1.4,
      textAlign: "center",
    },
    compactButton: {
      width: 52,
      height: 50,
      borderRadius: theme.radius.md,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    toggleIcon: {
      width: 38,
      height: 38,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(16, 185, 129, 0.12)",
    },
    toggleTextBlock: {
      flex: 1,
    },
    toggleLabel: {
      color: colors.fg,
      fontSize: 14,
      fontWeight: "600",
    },
    toggleSublabel: {
      color: colors.subtle,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    primaryButton: {
      minHeight: 50,
      borderRadius: theme.radius.md,
      backgroundColor: colors.brand,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
    },
    primaryButtonText: {
      color: colors.brandFg,
      fontSize: 15,
      fontWeight: "600",
    },
    disabled: { opacity: 0.68 },
  });
