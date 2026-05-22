import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Alert,
} from "react-native";
import { Host, Button, Switch as NativeSwitch } from "@expo/ui";
import { useAuth } from "../_layout";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/lib/theme";
import { useAppTheme, ColorPalette } from "../../src/lib/appearanceContext";
import { generateJoinCode } from "@office-reminder/shared";
import { Users, Plus, Shield, ArrowRight } from "lucide-react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

interface TeamWithRole {
  id: string;
  name: string;
  join_code: string;
  require_approval: boolean;
  role: "admin" | "member";
}

export default function TeamsScreen() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = getStyles(colors);

  const [teams, setTeams] = useState<TeamWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Forms
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [teamNameInput, setTeamNameInput] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  async function loadTeams() {
    if (!user) return;
    try {
      // 1. Fetch team members to get team ids and roles
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
      const roleMap = new Map<string, "admin" | "member">(
        memberData.map((m) => [m.team_id, m.role])
      );

      // 2. Fetch team details
      const { data: teamsData, error: teamsErr } = await supabase
        .from("teams")
        .select("*")
        .in("id", teamIds);

      if (teamsErr) throw teamsErr;

      const structuredTeams = (teamsData || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        join_code: t.join_code,
        require_approval: t.require_approval,
        role: roleMap.get(t.id) || "member",
      }));

      setTeams(structuredTeams);
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
      // 1. Find the team by code
      const { data: team, error: findErr } = await supabase
        .from("teams")
        .select("*")
        .eq("join_code", code)
        .single();

      if (findErr || !team) {
        Alert.alert("Not Found", "No team was found matching this code.");
        setSubmittingJoin(false);
        return;
      }

      // Check if user is already a member
      const isAlreadyIn = teams.some((t) => t.id === team.id);
      if (isAlreadyIn) {
        Alert.alert("Already a Member", "You are already a member of this team.");
        setSubmittingJoin(false);
        return;
      }

      if (team.require_approval) {
        // Send a join request
        const { error: reqErr } = await supabase.from("join_requests").insert({
          team_id: team.id,
          user_id: user.id,
          status: "pending",
          message: "Please let me join the team via the mobile app.",
        });

        if (reqErr) throw reqErr;
        Alert.alert(
          "Request Sent",
          `Your request to join "${team.name}" is pending administrator approval.`
        );
      } else {
        // Join immediately
        const { error: joinErr } = await supabase.from("team_members").insert({
          team_id: team.id,
          user_id: user.id,
          role: "member",
        });

        if (joinErr) throw joinErr;
        Alert.alert("Success", `You have successfully joined "${team.name}"!`);
        await loadTeams();
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
      const code = generateJoinCode();

      // Create the team
      const { data: newTeam, error: createErr } = await supabase
        .from("teams")
        .insert({
          name,
          join_code: code,
          created_by: user.id,
          require_approval: requireApproval,
        })
        .select()
        .single();

      if (createErr) throw createErr;

      Alert.alert("Success", `Team "${name}" created! Join Code: ${code}`);
      setTeamNameInput("");
      setRequireApproval(false);
      await loadTeams();
    } catch (err: any) {
      Alert.alert("Create Error", err.message || "Failed to create team.");
    } finally {
      setSubmittingCreate(false);
    }
  }

  function renderTeamItem({ item }: { item: TeamWithRole }) {
    const isAdmin = item.role === "admin";
    return (
      <TouchableOpacity
        style={[styles.card, styles.teamCard]}
        onPress={() => router.push(`/team/${item.id}`)}
      >
        <View style={styles.teamMain}>
          <View style={styles.teamHeaderRow}>
            <Text style={styles.teamName}>{item.name}</Text>
            <View style={[styles.badge, isAdmin ? styles.badgeAdmin : styles.badgeMember]}>
              <Text style={[styles.badgeText, isAdmin ? styles.badgeTextAdmin : styles.badgeTextMember]}>
                {isAdmin ? "Admin" : "Member"}
              </Text>
            </View>
          </View>
          <Text style={styles.codeText}>Join Code: {item.join_code}</Text>
          <View style={styles.detailsRow}>
            <Shield size={12} color={colors.subtle} style={{ marginRight: 4 }} />
            <Text style={styles.approvalText}>
              {item.require_approval ? "Requires Join Approvals" : "Open Join"}
            </Text>
          </View>
        </View>
        <ArrowRight size={20} color={colors.subtle} style={styles.chevron} />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.mainContainer}>
        {/* Teams List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionHeader}>My Teams</Text>
          {loading ? (
            <ActivityIndicator size="large" color={colors.brand} style={{ marginVertical: 30 }} />
          ) : teams.length > 0 ? (
            <FlatList
              data={teams}
              keyExtractor={(item) => item.id}
              renderItem={renderTeamItem}
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadTeams();
              }}
              style={styles.list}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Users size={32} color={colors.subtle} style={{ marginBottom: theme.spacing.sm }} />
              <Text style={styles.emptyText}>You haven't joined any teams yet.</Text>
            </View>
          )}
        </View>

        {/* Join / Create Section */}
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <View style={styles.actionContainer}>
              {/* Join Team */}
              <View style={[styles.card, styles.actionCard]}>
                <View style={styles.actionHeader}>
                  <Users size={20} color={colors.brand} style={{ marginRight: 8 }} />
                  <Text style={styles.actionTitle}>Join a Team</Text>
                </View>
                <Text style={styles.actionDesc}>
                  Enter the 6-character invite code provided by your team administrator.
                </Text>
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
                  <Host style={styles.joinBtnHost}>
                    <Button
                      variant="filled"
                      onPress={handleJoinTeam}
                      disabled={submittingJoin}
                      label="Join" />
                  </Host>
                </View>
              </View>

              {/* Create Team */}
              <View style={[styles.card, styles.actionCard]}>
                <View style={styles.actionHeader}>
                  <Plus size={20} color={colors.brand} style={{ marginRight: 8 }} />
                  <Text style={styles.actionTitle}>Create a Team</Text>
                </View>
                <Text style={styles.actionDesc}>
                  Establish a new team and generate custom scheduled warnings for teammates.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="e.g. Engineering Team"
                  placeholderTextColor={colors.subtle}
                  value={teamNameInput}
                  onChangeText={setTeamNameInput}
                />

                <View style={styles.toggleApproval}>
                  <Host style={styles.approvalSwitchHost}>
                    <NativeSwitch
                      value={requireApproval}
                      onValueChange={(val) => setRequireApproval(val)}
                    />
                  </Host>
                  <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                    <Text style={styles.toggleLabel}>Require join approvals</Text>
                    <Text style={styles.toggleSublabel}>
                      Admins must verify new members before they can view reminders.
                    </Text>
                  </View>
                </View>

                <Host style={styles.createBtnHost}>
                  <Button
                    variant="filled"
                    onPress={handleCreateTeam}
                    disabled={submittingCreate}
                    label="Create Team"
                  />
                </Host>
              </View>
            </View>
          }
          style={styles.formsList}
        />
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    mainContainer: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
    },
    listSection: {
      maxHeight: "45%",
      marginBottom: theme.spacing.md,
    },
    list: {
      marginTop: theme.spacing.sm,
    },
    formsList: {
      flex: 1,
    },
    sectionHeader: {
      color: colors.fg,
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: -0.4,
      marginBottom: theme.spacing.xs,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    input: {
      backgroundColor: colors.elevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      color: colors.fg,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      fontSize: 15,
      marginBottom: theme.spacing.md,
    },
    teamCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
    },
    teamMain: {
      flex: 1,
    },
    teamHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.xs,
    },
    teamName: {
      color: colors.fg,
      fontSize: 16,
      fontWeight: "700",
      marginRight: theme.spacing.sm,
    },
    codeText: {
      color: colors.subtle,
      fontSize: 13,
      fontWeight: "500",
      marginBottom: theme.spacing.xs,
    },
    detailsRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    approvalText: {
      color: colors.subtle,
      fontSize: 11,
      fontWeight: "500",
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: theme.radius.sm,
    },
    badgeAdmin: {
      backgroundColor: "rgba(129, 140, 248, 0.15)",
    },
    badgeMember: {
      backgroundColor: "rgba(148, 163, 184, 0.15)",
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    badgeTextAdmin: {
      color: colors.brand,
    },
    badgeTextMember: {
      color: colors.subtle,
    },
    chevron: {
      marginLeft: theme.spacing.sm,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.xl,
      marginTop: theme.spacing.sm,
    },
    emptyText: {
      color: colors.subtle,
      fontSize: 14,
      textAlign: "center",
    },
    actionContainer: {
      paddingTop: theme.spacing.xs,
      paddingBottom: 100, // Ensure content has room to scroll above the glassy bottom tabs!
    },
    actionCard: {
      marginBottom: theme.spacing.lg,
    },
    actionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.xs,
    },
    actionTitle: {
      color: colors.fg,
      fontSize: 16,
      fontWeight: "700",
    },
    actionDesc: {
      color: colors.subtle,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: theme.spacing.md,
    },
    inlineRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    codeField: {
      flex: 1,
      marginBottom: 0,
      marginRight: theme.spacing.sm,
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 2,
      textAlign: "center",
    },
    joinBtnHost: {
      width: 72,
      height: 48,
    },
    toggleApproval: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.lg,
    },
    approvalSwitchHost: {
      width: 52,
      height: 32,
    },
    toggleLabel: {
      color: colors.fg,
      fontSize: 14,
      fontWeight: "600",
    },
    toggleSublabel: {
      color: colors.subtle,
      fontSize: 11,
      marginTop: 2,
    },
    createBtnHost: {
      height: 48,
    },
  });
