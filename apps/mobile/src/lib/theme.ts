import { StyleSheet } from "react-native";

export const theme = {
  colors: {
    bg: "#0A0E16",          // 10 14 22
    surface: "#121823",     // 18 24 35
    elevated: "#181F2C",    // 24 31 44
    border: "#252F40",      // 37 47 64
    muted: "#1B2332",       // 27 35 50
    fg: "#ECF0F7",          // 236 240 247
    subtle: "#94A3B8",      // 148 163 184
    brand: "#818CFA",       // 129 140 248
    brandFg: "#0A0E16",
    danger: "#F87171",      // 248 113 113
    success: "#34D399",     // 52 211 153
    warning: "#FBBF24",     // 251 191 36
    overlayBg: "rgba(10, 14, 22, 0.85)",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  },
};

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.elevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    color: theme.colors.fg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: 15,
    marginBottom: theme.spacing.md,
  },
  btn: {
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDanger: {
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondary: {
    backgroundColor: theme.colors.muted,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: theme.colors.brandFg,
    fontSize: 15,
    fontWeight: "600",
  },
  btnSecondaryText: {
    color: theme.colors.fg,
    fontSize: 15,
    fontWeight: "600",
  },
  title: {
    color: theme.colors.fg,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    color: theme.colors.subtle,
    fontSize: 15,
    lineHeight: 22,
  },
});
