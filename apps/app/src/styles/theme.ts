import { StyleSheet, Platform } from "react-native";

export const palette = {
  background: "#f6f7fb",
  card: "#ffffff",
  border: "#e6e7ed",
  muted: "#6b7280",
  text: "#0f172a",
  accent: "#3f9f57",
  accentSoft: "#e8f5ea",
  secondary: "#2f8f4e",
  secondarySoft: "#dff0e4",
  success: "#5fa874",
  warning: "#f4c362",
  danger: "#f58c8a",
  brandPurple: "#7b5bff",
  brandTeal: "#07c3c9",
};

export const importanceColors: Record<"low" | "medium" | "high", string> = {
  low: "#10b981",
  medium: "#2563eb",
  high: "#f97316",
};

export const importanceLabels: Record<"low" | "medium" | "high", string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const statusColor = (status?: string) => {
  const normalized = (status || "").toUpperCase();
  if (normalized === "BOOKED" || normalized === "CONFIRMED") return palette.accent;
  if (normalized === "PENDING") return palette.warning;
  if (normalized === "CANCELLED") return palette.danger;
  if (normalized === "COMPLETED") return palette.success;
  return palette.border;
};

export const prettyStatus = (status?: string) => {
  if (!status) return "Sin estado";
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
};

export const initialsFromName = (name?: string) => {
  if (!name) return "B";
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "B";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export const sharedStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  container: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    padding: 20,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    backgroundColor: palette.card,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  row: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: "center",
  },
  primaryButtonText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.accent,
    alignItems: "center",
    backgroundColor: palette.accentSoft,
  },
  secondaryButtonFull: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.accent,
    alignItems: "center",
    backgroundColor: palette.card,
  },
  buttonText: { fontSize: 14, fontWeight: "600", color: palette.accent },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: palette.text,
    backgroundColor: palette.card,
    minHeight: 44,
  },
  fieldLabel: { fontSize: 12, color: palette.text, fontWeight: "700", marginTop: 8 },
  hint: { fontSize: 12, color: palette.muted },
  errorText: { fontSize: 12, color: palette.danger, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: palette.text },
  section: { gap: 8 },
  linkText: { color: palette.accent, fontSize: 14, fontWeight: "600" },
  pressed: { opacity: 0.7 },
  mono: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 12, color: palette.text },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 10, position: "relative", zIndex: 1 },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  tabClient: { borderColor: palette.accentSoft, backgroundColor: palette.accentSoft },
  tabBusiness: { borderColor: palette.secondarySoft, backgroundColor: palette.secondarySoft },
  tabButtonActive: { borderColor: palette.text },
  tabClientActive: { backgroundColor: palette.accent },
  tabBusinessActive: { backgroundColor: palette.secondary },
  tabText: { fontWeight: "600", color: palette.text },
  tabClientText: { color: palette.accent },
  tabBusinessText: { color: palette.secondary },
  tabTextActive: { color: "#fff" },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  chipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { fontSize: 13, color: palette.muted },
  title: { fontSize: 28, fontWeight: "700", color: palette.text },
  subtitle: { fontSize: 15, color: palette.text },
  selectInput: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  selectInputText: { fontSize: 14, color: palette.text },
  selectInputPlaceholder: { color: palette.muted },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9000,
    elevation: 90,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetCard: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    gap: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: palette.text },
  inlinePickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  inlinePickerCard: {
    width: "88%",
    maxHeight: 420,
    backgroundColor: palette.card,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  inlinePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  inlinePickerScroll: { maxHeight: 340 },
  inlinePickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  inlinePickerItemActive: { backgroundColor: palette.accentSoft },
  inlinePickerItemText: { fontSize: 14, color: palette.text },
  inlinePickerItemTextActive: { color: palette.accent, fontWeight: "600" },
  calendarBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  calendarCard: {
    width: "92%",
    maxWidth: 360,
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  calendarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  calendarNavBtn: { padding: 4 },
  calendarTitle: { fontSize: 15, fontWeight: "700", color: palette.text },
  calendarSubhead: { fontSize: 11, color: palette.muted },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  calendarDow: { width: "14.28%", textAlign: "center", fontSize: 11, fontWeight: "600", color: palette.muted, paddingVertical: 4 },
  calendarDay: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  calendarDayToday: { borderWidth: 1.5, borderColor: palette.accent },
  calendarDayOutside: { opacity: 0.35 },
  calendarDaySelected: { backgroundColor: palette.accent },
  calendarDayDisabled: { opacity: 0.25 },
  calendarDayText: { fontSize: 13, color: palette.text },
  calendarDayTextOutside: { color: palette.muted },
  calendarDayTextSelected: { color: "#fff", fontWeight: "700" },
  calendarDayTextDisabled: { color: palette.muted },
  calendarTodayBtn: { flexDirection: "row", gap: 4, alignItems: "center", paddingVertical: 6, paddingHorizontal: 12 },
  calendarTodayText: { color: palette.accent, fontWeight: "600", fontSize: 13 },
});
