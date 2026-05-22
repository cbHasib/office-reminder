import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Mail, LockKeyhole, UserRound, ArrowRight, ShieldCheck } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";
import { theme } from "../src/lib/theme";
import { useAppTheme, ColorPalette } from "../src/lib/appearanceContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { colors, resolvedTheme } = useAppTheme();
  const styles = getStyles(colors, resolvedTheme);

  async function handleAuth() {
    if (!email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || null } },
        });
        if (signUpErr) throw signUpErr;
        setError("Account created. Log in to continue.");
        setIsSignUp(false);
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
      }
    } catch (err: any) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <Image source={require("../assets/icon.png")} style={styles.logo} resizeMode="cover" />
            <Text style={styles.brandTitle}>Office Reminder</Text>
            <Text style={styles.brandSubtitle}>Team reminders that stay visible when timing matters.</Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.formTitle}>{isSignUp ? "Create Account" : "Welcome Back"}</Text>
                <Text style={styles.subtitle}>{isSignUp ? "Start coordinating reminders with your team." : "Log in to manage your schedule."}</Text>
              </View>
              <View style={styles.statusPill}>
                <ShieldCheck size={13} color={colors.success} />
                <Text style={styles.statusPillText}>Secure</Text>
              </View>
            </View>

            {isSignUp && (
              <InputRow
                icon={<UserRound size={18} color={colors.subtle} />}
                placeholder="Name"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                colors={colors}
              />
            )}

            <InputRow
              icon={<Mail size={18} color={colors.subtle} />}
              placeholder="you@company.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              colors={colors}
            />

            <InputRow
              icon={<LockKeyhole size={18} color={colors.subtle} />}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              colors={colors}
            />

            {error && (
              <View style={[styles.feedback, error.includes("created") && styles.feedbackSuccess]}>
                <Text style={[styles.feedbackText, error.includes("created") && { color: colors.success }]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.primaryButton, loading && styles.disabled]} onPress={handleAuth} disabled={loading} activeOpacity={0.82}>
              {loading ? <ActivityIndicator color={colors.brandFg} /> : (
                <>
                  <Text style={styles.primaryButtonText}>{isSignUp ? "Create Account" : "Log In"}</Text>
                  <ArrowRight size={18} color={colors.brandFg} />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>{isSignUp ? "I already have an account" : "Create a new account"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InputRow({ icon, colors, ...props }: React.ComponentProps<typeof TextInput> & { icon: React.ReactNode; colors: ColorPalette }) {
  const styles = getInputStyles(colors);
  return (
    <View style={styles.inputShell}>
      <View style={styles.inputIcon}>{icon}</View>
      <TextInput {...props} style={styles.input} placeholderTextColor={colors.subtle} />
    </View>
  );
}

const getInputStyles = (colors: ColorPalette) => StyleSheet.create({
  inputShell: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.elevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  inputIcon: {
    width: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    color: colors.fg,
    fontSize: 15,
    paddingVertical: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
});

const getStyles = (colors: ColorPalette, resolvedTheme: "light" | "dark") =>
  StyleSheet.create({
    flex: { flex: 1 },
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContainer: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xl,
      paddingBottom: 48,
    },
    brandBlock: {
      alignItems: "center",
      marginBottom: theme.spacing.xl,
    },
    logo: {
      width: 86,
      height: 86,
      borderRadius: 22,
      marginBottom: theme.spacing.md,
      borderColor: colors.border,
      borderWidth: 1,
    },
    brandTitle: {
      color: colors.fg,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: 0,
    },
    brandSubtitle: {
      color: colors.subtle,
      fontSize: 14,
      lineHeight: 20,
      marginTop: theme.spacing.xs,
      maxWidth: 280,
      textAlign: "center",
    },
    panel: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: theme.spacing.lg,
      shadowColor: resolvedTheme === "dark" ? "#000" : "#475569",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: resolvedTheme === "dark" ? 0.24 : 0.08,
      shadowRadius: 22,
      elevation: 4,
    },
    panelHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    formTitle: {
      color: colors.fg,
      fontSize: 21,
      fontWeight: "800",
      letterSpacing: 0,
    },
    subtitle: {
      color: colors.subtle,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 3,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(16, 185, 129, 0.12)",
      borderColor: "rgba(16, 185, 129, 0.22)",
      borderWidth: 1,
      borderRadius: theme.radius.full,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    statusPillText: {
      color: colors.success,
      fontSize: 11,
      fontWeight: "800",
    },
    feedback: {
      marginBottom: theme.spacing.md,
      backgroundColor: "rgba(239, 68, 68, 0.10)",
      borderColor: "rgba(239, 68, 68, 0.22)",
      borderWidth: 1,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
    },
    feedbackSuccess: {
      backgroundColor: "rgba(16, 185, 129, 0.10)",
      borderColor: "rgba(16, 185, 129, 0.22)",
    },
    feedbackText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: theme.radius.md,
      backgroundColor: colors.brand,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
    },
    disabled: { opacity: 0.7 },
    primaryButtonText: {
      color: colors.brandFg,
      fontSize: 16,
      fontWeight: "800",
    },
    toggleButton: {
      alignItems: "center",
      paddingTop: theme.spacing.lg,
    },
    toggleText: {
      color: colors.brand,
      fontSize: 14,
      fontWeight: "700",
    },
  });
