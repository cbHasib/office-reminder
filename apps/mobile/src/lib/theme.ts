import { StyleSheet } from "react-native";

export const theme = {
  colors: {
    bg: "#090B10",
    surface: "#121720",
    elevated: "#1A202B",
    border: "#2A3240",
    muted: "#202734",
    fg: "#F5F7FB",
    subtle: "#9AA6B8",
    brand: "#7C9BFF",
    brandFg: "#07101F",
    danger: "#FF6B6B",
    success: "#34D399",
    warning: "#F5B84B",
    overlayBg: "rgba(9, 11, 16, 0.88)",
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
    md: 8,
    lg: 8,
    xl: 10,
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
