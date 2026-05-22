import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Host, Button } from "@expo/ui";
import { supabase } from "../src/lib/supabase";
import { theme } from "../src/lib/theme";
import { useAppTheme, ColorPalette } from "../src/lib/appearanceContext";
import { Bell } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { colors } = useAppTheme();
  const styles = getStyles(colors);

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
          options: {
            data: {
              display_name: displayName || null,
            },
          },
        });
        if (signUpErr) throw signUpErr;
        setError("Account created! Please log in.");
        setIsSignUp(false);
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Bell size={36} color={colors.brand} />
            </View>
            <Text style={styles.brandTitle}>Office Reminder</Text>
            <Text style={styles.brandSubtitle}>
              Stay synchronized with your team events
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.formTitle}>
              {isSignUp ? "Create an account" : "Welcome Back"}
            </Text>
            <Text style={[styles.subtitle, { marginBottom: theme.spacing.lg }]}>
              {isSignUp
                ? "Register a new user account below."
                : "Log in to your Office Reminder account."}
            </Text>

            {isSignUp && (
              <View>
                <Text style={styles.label}>Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={colors.subtle}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@company.com"
              placeholderTextColor={colors.subtle}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.subtle}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
            />

            {error && (
              <View style={styles.errorContainer}>
                <Text
                  style={[
                    styles.errorText,
                    error.includes("created") && { color: colors.success },
                  ]}
                >
                  {error}
                </Text>
              </View>
            )}

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <Host style={styles.authBtnHost}>
                <Button
                  variant="filled"
                  onPress={handleAuth}
                  label={isSignUp ? "Sign Up" : "Log In"}
                />
              </Host>
            )}

            <TouchableOpacity
              style={styles.toggleContainer}
              onPress={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>
                {isSignUp
                  ? "Already have an account? Log In"
                  : "New user? Create an account"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    subtitle: {
      color: colors.subtle,
      fontSize: 15,
      lineHeight: 22,
    },
    scrollContainer: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: 40,
    },
    header: {
      alignItems: "center",
      marginBottom: theme.spacing.xxl,
    },
    iconContainer: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.xl,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.md,
    },
    brandTitle: {
      color: colors.fg,
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    brandSubtitle: {
      color: colors.subtle,
      fontSize: 14,
      marginTop: theme.spacing.xs,
    },
    formTitle: {
      color: colors.fg,
      fontSize: 20,
      fontWeight: "700",
      marginBottom: theme.spacing.xs,
    },
    label: {
      color: colors.fg,
      fontSize: 14,
      fontWeight: "600",
      marginBottom: theme.spacing.xs,
    },
    errorContainer: {
      marginBottom: theme.spacing.md,
      backgroundColor: "rgba(248, 113, 113, 0.1)",
      borderColor: "rgba(248, 113, 113, 0.2)",
      borderWidth: 1,
      padding: theme.spacing.md,
      borderRadius: theme.radius.sm,
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: "500",
      textAlign: "center",
    },
    authBtnHost: {
      height: 48,
      marginBottom: theme.spacing.xs,
    },
    loadingContainer: {
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.xs,
    },
    toggleContainer: {
      marginTop: theme.spacing.lg,
      alignItems: "center",
    },
    toggleText: {
      color: colors.brand,
      fontSize: 14,
      fontWeight: "500",
      textDecorationLine: "underline",
    },
  });
