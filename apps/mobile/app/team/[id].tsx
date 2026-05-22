import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "../_layout";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/lib/theme";
import { useAppTheme, ColorPalette } from "../../src/lib/appearanceContext";
import {
  Users,
  Shield,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Clock,
  Calendar,
  ChevronLeft,
  UserPlus,
  Square,
  CheckSquare,
} from "lucide-react-native";
import type { Reminder, Team, TeamMember, User, JoinRequest } from "../../src/lib/shared";
import { SafeAreaView } from "react-native-safe-area-context";

const WEEKDAYS = [
  { label: "Su", value: "SU" },
  { label: "Mo", value: "MO" },
  { label: "Tu", value: "TU" },
  { label: "We", value: "WE" },
  { label: "Th", value: "TH" },
  { label: "Fr", value: "FR" },
  { label: "Sa", value: "SA" },
];

export default function TeamDetailScreen() {
  const { id: teamId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = getStyles(colors);

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<(TeamMember & { user: User })[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [joinRequests, setJoinRequests] = useState<(JoinRequest & { user: User })[]>([]);
  const [activeTab, setActiveTab] = useState<"reminders" | "members" | "requests">("reminders");

  // Edit / Create Reminder Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDesc, setReminderDesc] = useState("");
  const [reminderDate, setReminderDate] = useState(""); // YYYY-MM-DD
  const [reminderTime, setReminderTime] = useState(""); // HH:MM
  const [reminderLead, setReminderLead] = useState("5");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [reminderAudience, setReminderAudience] = useState<"all" | "specific">("all");
  const [targetUsers, setTargetUsers] = useState<string[]>([]);
  const [savingReminder, setSavingReminder] = useState(false);

  async function loadTeamData() {
    if (!user || !teamId) return;
    try {
      // 1. Fetch team info
      const { data: teamData, error: teamErr } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (teamErr) throw teamErr;
      setTeam(teamData as Team);

      // 2. Fetch members of the team with profile fields
      const { data: memData, error: memErr } = await supabase
        .from("team_members")
        .select(`
          team_id,
          user_id,
          role,
          joined_at,
          user:users (
            id,
            email,
            display_name,
            created_at
          )
        `)
        .eq("team_id", teamId);

      if (memErr) throw memErr;
      setMembers(memData as any);

      // Determine if current user is admin
      const selfMember = memData?.find((m) => m.user_id === user.id);
      const userIsAdmin = selfMember?.role === "admin";
      setIsAdmin(userIsAdmin);

      // 3. Fetch reminders
      const { data: remData, error: remErr } = await supabase
        .from("reminders")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });

      if (remErr) throw remErr;
      setReminders(remData as Reminder[]);

      // 4. Fetch pending join requests (only if admin)
      if (userIsAdmin) {
        const { data: reqData, error: reqErr } = await supabase
          .from("join_requests")
          .select(`
            id,
            team_id,
            user_id,
            status,
            message,
            created_at,
            resolved_at,
            resolved_by,
            user:users (
              id,
              email,
              display_name,
              created_at
            )
          `)
          .eq("team_id", teamId)
          .eq("status", "pending");

        if (!reqErr && reqData) {
          setJoinRequests(reqData as any);
        }
      }
    } catch (err: any) {
      Alert.alert("Load Error", err.message || "Failed to load team details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeamData();
  }, [user, teamId]);

  // Approve / Reject join request
  async function handleResolveRequest(requestId: string, status: "approved" | "rejected") {
    try {
      const { error } = await supabase
        .from("join_requests")
        .update({
          status,
          resolved_by: user?.id,
        })
        .eq("id", requestId);

      if (error) throw error;
      Alert.alert("Success", `Request has been ${status}.`);
      await loadTeamData();
    } catch (err: any) {
      Alert.alert("Resolve Error", err.message || "Failed to resolve join request.");
    }
  }

  // Delete Reminder
  function confirmDeleteReminder(reminder: Reminder) {
    Alert.alert(
      "Delete Reminder",
      `Are you sure you want to permanently delete "${reminder.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("reminders")
                .delete()
                .eq("id", reminder.id);

              if (error) throw error;
              Alert.alert("Success", "Reminder deleted successfully.");
              await loadTeamData();
            } catch (err: any) {
              Alert.alert("Delete Error", err.message || "Failed to delete reminder.");
            }
          },
        },
      ]
    );
  }

  // Edit / Add Reminder Modal Open
  function openReminderModal(reminder: Reminder | null = null) {
    if (reminder) {
      // Edit mode
      setEditingReminder(reminder);
      setReminderTitle(reminder.title);
      setReminderDesc(reminder.description || "");

      const d = new Date(reminder.scheduled_at);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const date = String(d.getDate()).padStart(2, "0");
      const hrs = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");

      setReminderDate(`${year}-${month}-${date}`);
      setReminderTime(`${hrs}:${mins}`);
      setReminderLead(String(reminder.advance_minutes));
      setReminderAudience(reminder.audience);
      setTargetUsers(reminder.target_user_ids || []);

      // Extract days from RRULE (e.g. BYDAY=MO,TU)
      if (reminder.rrule) {
        const bydayMatch = reminder.rrule.match(/BYDAY=([A-Z,]+)/);
        if (bydayMatch && bydayMatch[1]) {
          setSelectedDays(bydayMatch[1].split(","));
        } else {
          setSelectedDays([]);
        }
      } else {
        setSelectedDays([]);
      }
    } else {
      // Create mode
      setEditingReminder(null);
      setReminderTitle("");
      setReminderDesc("");

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const date = String(now.getDate()).padStart(2, "0");
      setReminderDate(`${year}-${month}-${date}`);
      setReminderTime("09:00");
      setReminderLead("5");
      setSelectedDays([]);
      setReminderAudience("all");
      setTargetUsers([]);
    }
    setModalVisible(true);
  }

  // Save Reminder (Create or Update)
  async function handleSaveReminder() {
    const title = reminderTitle.trim();
    if (!title) {
      Alert.alert("Invalid Input", "Please enter a reminder title.");
      return;
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const timePattern = /^\d{2}:\d{2}$/;
    if (!datePattern.test(reminderDate.trim()) || !timePattern.test(reminderTime.trim())) {
      Alert.alert("Invalid Format", "Use YYYY-MM-DD for Date and HH:MM for Time.");
      return;
    }

    if (!user || !teamId) return;

    setSavingReminder(true);
    try {
      const scheduledAt = new Date(`${reminderDate.trim()}T${reminderTime.trim()}:00`).toISOString();

      // Build RRULE
      let rrule: string | null = null;
      if (selectedDays.length > 0) {
        rrule = `FREQ=WEEKLY;BYDAY=${selectedDays.join(",")}`;
      }

      const reminderPayload = {
        team_id: teamId,
        title,
        description: reminderDesc.trim(),
        scheduled_at: scheduledAt,
        rrule,
        advance_minutes: parseInt(reminderLead, 10) || 5,
        audience: reminderAudience,
        target_user_ids: reminderAudience === "specific" ? targetUsers : [],
        created_by: user.id,
      };

      if (editingReminder) {
        const { error } = await supabase
          .from("reminders")
          .update(reminderPayload)
          .eq("id", editingReminder.id);

        if (error) throw error;
        Alert.alert("Success", "Reminder updated successfully!");
      } else {
        const { error } = await supabase
          .from("reminders")
          .insert(reminderPayload);

        if (error) throw error;
        Alert.alert("Success", "New reminder created successfully!");
      }

      setModalVisible(false);
      await loadTeamData();
    } catch (err: any) {
      Alert.alert("Save Error", err.message || "Failed to save reminder.");
    } finally {
      setSavingReminder(false);
    }
  }

  function toggleDay(day: string) {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  }

  // Specific audience teammates logic
  function toggleTargetUser(userId: string) {
    if (targetUsers.includes(userId)) {
      setTargetUsers(targetUsers.filter((id) => id !== userId));
    } else {
      setTargetUsers([...targetUsers, userId]);
    }
  }

  function renderReminderItem({ item }: { item: Reminder }) {
    return (
      <View style={[styles.card, styles.reminderCard]}>
        <View style={styles.remContent}>
          <Text style={styles.remTitle}>{item.title}</Text>
          {item.description ? <Text style={styles.remDesc}>{item.description}</Text> : null}

          <View style={styles.remTimeRow}>
            <Calendar size={14} color={colors.subtle} style={{ marginRight: 4 }} />
            <Text style={styles.remMetaText}>
              Starts: {new Date(item.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
            {item.rrule ? (
              <View style={styles.rruleBadge}>
                <Text style={styles.rruleBadgeText}>Recurring</Text>
              </View>
            ) : (
              <View style={[styles.rruleBadge, { backgroundColor: "rgba(148, 163, 184, 0.12)" }]}>
                <Text style={[styles.rruleBadgeText, { color: colors.subtle }]}>One-off</Text>
              </View>
            )}
          </View>

          <View style={styles.remLeadRow}>
            <Clock size={14} color={colors.subtle} style={{ marginRight: 4 }} />
            <Text style={styles.remMetaText}>Warning: -{item.advance_minutes}m</Text>
            <View style={{ width: 12 }} />
            <Users size={14} color={colors.subtle} style={{ marginRight: 4 }} />
            <Text style={styles.remMetaText}>
              Audience: {item.audience === "all" ? "Whole Team" : `Specific (${item.target_user_ids?.length || 0})`}
            </Text>
          </View>
        </View>

        {isAdmin && (
          <View style={styles.remActions}>
            <TouchableOpacity style={styles.remActionBtn} onPress={() => openReminderModal(item)}>
              <Edit size={16} color={colors.brand} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.remActionBtn} onPress={() => confirmDeleteReminder(item)}>
              <Trash2 size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  function renderMemberItem({ item }: { item: any }) {
    const isMemberAdmin = item.role === "admin";
    const profile = item.user;

    return (
      <View style={[styles.card, styles.memberCard]}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {profile?.display_name ? profile.display_name[0].toUpperCase() : (profile?.email ? profile.email[0].toUpperCase() : "?")}
          </Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {profile?.display_name || profile?.email?.split("@")[0] || "Unknown Teammate"}
          </Text>
          <Text style={styles.memberEmail}>{profile?.email}</Text>
        </View>
        <View style={[styles.roleBadge, isMemberAdmin ? styles.roleBadgeAdmin : styles.roleBadgeMember]}>
          <Text style={[styles.roleBadgeText, isMemberAdmin ? styles.roleBadgeTextAdmin : styles.roleBadgeTextMember]}>
            {isMemberAdmin ? "Admin" : "Member"}
          </Text>
        </View>
      </View>
    );
  }

  function renderJoinRequestItem({ item }: { item: any }) {
    const profile = item.user;
    return (
      <View style={[styles.card, styles.requestCard]}>
        <View style={styles.requestMain}>
          <Text style={styles.requestName}>
            {profile?.display_name || profile?.email?.split("@")[0]}
          </Text>
          <Text style={styles.requestEmail}>{profile?.email}</Text>
          {item.message ? <Text style={styles.requestMsg}>"{item.message}"</Text> : null}
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.requestBtn, styles.approveBtn]}
            onPress={() => handleResolveRequest(item.id, "approved")}
          >
            <Check size={16} color={colors.brandFg} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.requestBtn, styles.rejectBtn]}
            onPress={() => handleResolveRequest(item.id, "rejected")}
          >
            <X size={16} color={colors.fg} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.fg} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTeamName} numberOfLines={1}>{team?.name}</Text>
          <Text style={styles.headerTeamCode}>Invite Code: {team?.join_code}</Text>
        </View>
        {isAdmin && activeTab === "reminders" ? (
          <TouchableOpacity style={styles.addReminderBtn} onPress={() => openReminderModal(null)}>
            <Plus size={22} color={colors.brandFg} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* Tabs Row */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "reminders" && styles.tabActive]}
          onPress={() => setActiveTab("reminders")}
        >
          <Text style={[styles.tabText, activeTab === "reminders" && styles.tabTextActive]}>
            Reminders ({reminders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "members" && styles.tabActive]}
          onPress={() => setActiveTab("members")}
        >
          <Text style={[styles.tabText, activeTab === "members" && styles.tabTextActive]}>
            Teammates ({members.length})
          </Text>
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity
            style={[styles.tab, activeTab === "requests" && styles.tabActive]}
            onPress={() => setActiveTab("requests")}
          >
            <Text style={[styles.tabText, activeTab === "requests" && styles.tabTextActive]}>
              Requests ({joinRequests.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Primary Display */}
      <View style={styles.contentContainer}>
        {activeTab === "reminders" && (
          reminders.length > 0 ? (
            <FlatList
              data={reminders}
              keyExtractor={(item) => item.id}
              renderItem={renderReminderItem}
              contentContainerStyle={styles.listPadding}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Clock size={36} color={colors.subtle} style={{ marginBottom: theme.spacing.md }} />
              <Text style={styles.emptyTitle}>No Reminders</Text>
              <Text style={styles.emptyText}>
                No scheduled reminders inside this team. Admins can tap the plus icon to add one!
              </Text>
            </View>
          )
        )}

        {activeTab === "members" && (
          <FlatList
            data={members}
            keyExtractor={(item) => item.user_id}
            renderItem={renderMemberItem}
            contentContainerStyle={styles.listPadding}
          />
        )}

        {activeTab === "requests" && (
          joinRequests.length > 0 ? (
            <FlatList
              data={joinRequests}
              keyExtractor={(item) => item.id}
              renderItem={renderJoinRequestItem}
              contentContainerStyle={styles.listPadding}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <UserPlus size={36} color={colors.subtle} style={{ marginBottom: theme.spacing.md }} />
              <Text style={styles.emptyTitle}>All Clean</Text>
              <Text style={styles.emptyText}>No pending user join requests at this moment.</Text>
            </View>
          )
        )}
      </View>

      {/* Reminder Editor Modal Form Overlay */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBg}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingReminder ? "Edit Reminder" : "New Reminder"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={colors.fg} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormScroll}>
              <Text style={styles.fieldLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Daily Standup"
                placeholderTextColor={colors.subtle}
                value={reminderTitle}
                onChangeText={setReminderTitle}
              />

              <Text style={styles.fieldLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: "top" }]}
                placeholder="Details or link to call"
                placeholderTextColor={colors.subtle}
                value={reminderDesc}
                onChangeText={setReminderDesc}
                multiline
              />

              {/* Date & Time Fields */}
              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.fieldLabel}>Date (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2026-05-22"
                    placeholderTextColor={colors.subtle}
                    value={reminderDate}
                    onChangeText={setReminderDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Time (HH:MM) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="14:30"
                    placeholderTextColor={colors.subtle}
                    value={reminderTime}
                    onChangeText={setReminderTime}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Warning Lead Time (Minutes before) *</Text>
              <TextInput
                style={styles.input}
                placeholder="5"
                placeholderTextColor={colors.subtle}
                value={reminderLead}
                onChangeText={setReminderLead}
                keyboardType="number-pad"
              />

              {/* Weekday Recurrence Selection */}
              <Text style={styles.fieldLabel}>Weekly Recurrence Days (Select to make recurring)</Text>
              <View style={styles.weekGrid}>
                {WEEKDAYS.map((day) => {
                  const isChecked = selectedDays.includes(day.value);
                  return (
                    <TouchableOpacity
                      key={day.value}
                      style={[
                        styles.dayBtn,
                        isChecked && { backgroundColor: colors.brand, borderColor: colors.brand },
                      ]}
                      onPress={() => toggleDay(day.value)}
                    >
                      <Text style={[styles.dayBtnText, isChecked && { color: colors.brandFg }]}>
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Audience Selection */}
              <Text style={styles.fieldLabel}>Audience</Text>
              <View style={styles.audienceSelectorRow}>
                <TouchableOpacity
                  style={[styles.audienceBtn, reminderAudience === "all" && styles.audienceBtnActive]}
                  onPress={() => setReminderAudience("all")}
                >
                  <Text style={[styles.audienceBtnText, reminderAudience === "all" && styles.audienceBtnTextActive]}>
                    Whole Team
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.audienceBtn, reminderAudience === "specific" && styles.audienceBtnActive]}
                  onPress={() => setReminderAudience("specific")}
                >
                  <Text style={[styles.audienceBtnText, reminderAudience === "specific" && styles.audienceBtnTextActive]}>
                    Specific Teammates
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Teammates Selection list for Specific Audience */}
              {reminderAudience === "specific" && (
                <View style={styles.teammatesSelectBox}>
                  <Text style={styles.fieldSublabel}>Target Members:</Text>
                  {members.map((member) => {
                    const isChecked = targetUsers.includes(member.user_id);
                    return (
                      <TouchableOpacity
                        key={member.user_id}
                        style={styles.teammateSelectItem}
                        onPress={() => toggleTargetUser(member.user_id)}
                        activeOpacity={0.7}
                      >
                        {isChecked ? (
                          <CheckSquare size={18} color={colors.brand} style={{ marginRight: 8 }} />
                        ) : (
                          <Square size={18} color={colors.border} style={{ marginRight: 8 }} />
                        )}
                        <Text style={styles.teammateSelectName}>
                          {member.user?.display_name || member.user?.email}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Save Controls */}
              <TouchableOpacity
                style={[styles.btn, styles.modalSaveBtn, savingReminder && { opacity: 0.7 }]}
                onPress={handleSaveReminder}
                disabled={savingReminder}
              >
                {savingReminder ? (
                  <ActivityIndicator color={colors.brandFg} />
                ) : (
                  <Text style={styles.btnText}>
                    {editingReminder ? "Save Changes" : "Create Reminder"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
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
    btn: {
      backgroundColor: colors.brand,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: {
      color: colors.brandFg,
      fontSize: 15,
      fontWeight: "600",
    },
    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      backgroundColor: colors.surface,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitleContainer: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: theme.spacing.sm,
    },
    headerTeamName: {
      color: colors.fg,
      fontSize: 16,
      fontWeight: "800",
    },
    headerTeamCode: {
      color: colors.subtle,
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    addReminderBtn: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.sm,
      backgroundColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    tabsContainer: {
      flexDirection: "row",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      backgroundColor: colors.surface,
    },
    tab: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: {
      borderBottomColor: colors.brand,
    },
    tabText: {
      color: colors.subtle,
      fontSize: 13,
      fontWeight: "600",
    },
    tabTextActive: {
      color: colors.brand,
    },
    contentContainer: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    listPadding: {
      padding: theme.spacing.lg,
      paddingBottom: 120, // space to ensure content is fully readable and scrollable above the glassy bottom tabs!
    },
    reminderCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    remContent: {
      flex: 1,
      marginRight: theme.spacing.md,
    },
    remTitle: {
      color: colors.fg,
      fontSize: 16,
      fontWeight: "700",
    },
    remDesc: {
      color: colors.subtle,
      fontSize: 13,
      marginTop: 2,
      lineHeight: 18,
    },
    remTimeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: theme.spacing.sm,
    },
    remLeadRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },
    remMetaText: {
      color: colors.subtle,
      fontSize: 11,
      fontWeight: "500",
    },
    rruleBadge: {
      marginLeft: 8,
      backgroundColor: "rgba(129, 140, 248, 0.15)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    rruleBadgeText: {
      color: colors.brand,
      fontSize: 9,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    remActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    remActionBtn: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.sm,
      backgroundColor: colors.elevated,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: theme.spacing.xs,
    },
    memberCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.spacing.md,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.elevated,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing.md,
    },
    memberAvatarText: {
      color: colors.fg,
      fontSize: 16,
      fontWeight: "700",
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      color: colors.fg,
      fontSize: 15,
      fontWeight: "700",
    },
    memberEmail: {
      color: colors.subtle,
      fontSize: 12,
      marginTop: 2,
    },
    roleBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    roleBadgeAdmin: {
      backgroundColor: "rgba(129, 140, 248, 0.15)",
    },
    roleBadgeMember: {
      backgroundColor: "rgba(148, 163, 184, 0.15)",
    },
    roleBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    roleBadgeTextAdmin: {
      color: colors.brand,
    },
    roleBadgeTextMember: {
      color: colors.subtle,
    },
    requestCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
    },
    requestMain: {
      flex: 1,
      marginRight: theme.spacing.md,
    },
    requestName: {
      color: colors.fg,
      fontSize: 15,
      fontWeight: "700",
    },
    requestEmail: {
      color: colors.subtle,
      fontSize: 12,
      marginTop: 2,
    },
    requestMsg: {
      color: colors.brand,
      fontSize: 12,
      fontStyle: "italic",
      marginTop: 4,
    },
    requestActions: {
      flexDirection: "row",
    },
    requestBtn: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 6,
    },
    approveBtn: {
      backgroundColor: colors.brand,
    },
    rejectBtn: {
      backgroundColor: colors.muted,
      borderColor: colors.border,
      borderWidth: 1,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xxl,
      paddingTop: 80,
    },
    emptyTitle: {
      color: colors.fg,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: theme.spacing.sm,
    },
    emptyText: {
      color: colors.subtle,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    modalBg: {
      flex: 1,
      backgroundColor: colors.overlayBg,
      justifyContent: "flex-end",
    },
    modalContent: {
      height: "85%",
      backgroundColor: colors.bg,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.lg,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    modalTitle: {
      color: colors.fg,
      fontSize: 18,
      fontWeight: "800",
    },
    modalFormScroll: {
      padding: theme.spacing.lg,
      paddingBottom: 40,
    },
    fieldLabel: {
      color: colors.fg,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 6,
      marginTop: theme.spacing.sm,
    },
    fieldSublabel: {
      color: colors.fg,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 6,
    },
    formRow: {
      flexDirection: "row",
    },
    weekGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginVertical: theme.spacing.sm,
    },
    dayBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    dayBtnText: {
      color: colors.fg,
      fontSize: 12,
      fontWeight: "700",
    },
    audienceSelectorRow: {
      flexDirection: "row",
      backgroundColor: colors.elevated,
      borderRadius: theme.radius.md,
      padding: 3,
      marginVertical: theme.spacing.sm,
    },
    audienceBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: theme.radius.sm,
    },
    audienceBtnActive: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    audienceBtnText: {
      color: colors.subtle,
      fontSize: 12,
      fontWeight: "600",
    },
    audienceBtnTextActive: {
      color: colors.brand,
      fontWeight: "700",
    },
    teammatesSelectBox: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginVertical: theme.spacing.sm,
    },
    teammateSelectItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    teammateSelectName: {
      color: colors.fg,
      fontSize: 13,
      fontWeight: "500",
    },
    modalSaveBtn: {
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
  });
