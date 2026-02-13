import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Share,
  AppState,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { DateTime } from "luxon";
import * as Calendar from "expo-calendar";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";

import showIcon from "./assets/icons/show.png";
import hideIcon from "./assets/icons/hide.png";
import mainLogo from "./assets/brand/main3.png";

type UserKind = "client" | "business";

type AuthUser = {
  id: string;
  email: string;
  kind: UserKind;
  role?: string | null;
};

type Business = {
  id: string;
  name: string;
  category: string;
  timezone: string;
  phone?: string | null;
  country?: string | null;
  region?: string | null;
};
type Service = { id: string; name: string; durationMin: number; priceYen: number };
type Slot = { startAt: string; endAt: string };
type Appointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  business: Business;
  service: Service;
};
type Activity = {
  id: string;
  title: string;
  note?: string;
  startAt: string;
  endAt?: string;
  kind: "manual" | "cita";
  importance?: Importance;
  businessName?: string;
  calendarEventId?: string;
};
type Importance = "low" | "medium" | "high";
type ScheduleSource = "appointment" | "custom" | "device";
type NotificationKind = "upcoming" | "status" | "reminder";
type AppNotification = {
  key: string;
  kind: NotificationKind;
  title: string;
  body: string;
  whenISO: string;
  createdAt: number;
  source?: ScheduleSource;
  itemId?: string;
};

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
  (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000");

const STORAGE_PROFILE = "schedly_profile_v1";
const STORAGE_ACTIVITIES = "schedly_activities_v1";
const STORAGE_NOTIFICATIONS = "schedly_notifications_v1";

const palette = {
  background: "#f6f7fb",
  card: "#ffffff",
  border: "#e6e7ed",
  muted: "#6b7280",
  text: "#0f172a",
  accent: "#2c7be5",
  accentSoft: "#e8f1ff",
  secondary: "#16a34a",
  secondarySoft: "#e7f6ec",
  success: "#6bc48f",
  warning: "#f4c362",
  danger: "#f58c8a",
  brandPurple: "#7b5bff",
  brandTeal: "#07c3c9",
};

const nullIfBlank = (value: string) => (value.trim().length ? value : null);
const cleanOptionalText = (value: unknown) => {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!v) return "";
  if (v.toLowerCase() === "null") return "";
  return value;
};
const importanceColors: Record<Importance, string> = {
  low: "#10b981",
  medium: "#2563eb",
  high: "#f97316",
};
const importanceLabels: Record<Importance, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

const defaultTimezones = [
  "UTC",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Dubai",
  "Asia/Bangkok",
  "Asia/Kolkata",
  "Asia/Jakarta",
];

const asiaCountries = [
  "Japan",
  "Korea, Republic of",
  "Singapore",
  "China",
  "Hong Kong",
  "Taiwan",
  "United Arab Emirates",
  "Saudi Arabia",
  "Thailand",
  "Viet Nam",
  "Philippines",
  "Indonesia",
  "India",
];

const phoneCodes = ["+81", "+82", "+65", "+86", "+852", "+886", "+971", "+966", "+66", "+84", "+63", "+62", "+91"];

const serviceTemplates: { name: string; durationMin: number; priceYen: number }[] = [
  { name: "Consulta inicial", durationMin: 30, priceYen: 0 },
  { name: "Servicio estandar", durationMin: 60, priceYen: 5000 },
  { name: "Servicio premium", durationMin: 90, priceYen: 8000 },
  { name: "Seguimiento", durationMin: 45, priceYen: 3000 },
];

const isoToday = () => new Date().toISOString().slice(0, 10);

const formatTime = (iso: string, zone: string) => {
  const dt = DateTime.fromISO(iso, { zone });
  if (!dt.isValid) return "Hora";
  return dt.toFormat("HH:mm");
};

const formatDateTime = (iso: string, zone: string) => {
  const dt = DateTime.fromISO(iso, { zone });
  if (!dt.isValid) return "Fecha";
  return dt.toFormat("dd LLL At· HH:mm");
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  return fallback;
};

const initialsFromName = (name?: string) => {
  if (!name) return "B";
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "B";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const statusColor = (status?: string) => {
  const normalized = (status || "").toUpperCase();
  if (normalized === "BOOKED" || normalized === "CONFIRMED") return palette.accent;
  if (normalized === "PENDING") return palette.warning;
  if (normalized === "CANCELLED") return palette.danger;
  if (normalized === "COMPLETED") return palette.success;
  return palette.border;
};

const prettyStatus = (status?: string) => {
  if (!status) return "Sin estado";
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
};

const passwordStrength = (pwd: string) => {
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (pwd.length >= 10) score += 1;
  return score; // 0-4
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}



export default function App() {
  const [email, setEmail] = useState("cliente@yoyakuo.test");
  const [password, setPassword] = useState("1234");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterSheet, setShowRegisterSheet] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regCountry, setRegCountry] = useState("");
  const [regTimezone, setRegTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });
  const [isRegDetecting, setIsRegDetecting] = useState(false);
  const [isRegSubmitting, setIsRegSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [legalModal, setLegalModal] = useState<null | "terms" | "privacy">(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [myBusinesses, setMyBusinesses] = useState<Business[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(isoToday());
  const [accessKind, setAccessKind] = useState<UserKind>("client");
  const [selectedTimezone, setSelectedTimezone] = useState<string>("UTC");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [isServicesLoading, setIsServicesLoading] = useState(false);
  const [isAppointmentsLoading, setIsAppointmentsLoading] = useState(false);
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [availabilityDay, setAvailabilityDay] = useState<number>(1);
  const [availabilityStart, setAvailabilityStart] = useState<string>("09:00");
  const [availabilityEnd, setAvailabilityEnd] = useState<string>("18:00");
  const [serviceName, setServiceName] = useState<string>("Servicio");
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSelectedStartAt, setBookingSelectedStartAt] = useState<string | null>(null);
  const [bookingNote, setBookingNote] = useState("");
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false);
  const [showBookingDatePicker, setShowBookingDatePicker] = useState(false);
  const [bookingPickerMonth, setBookingPickerMonth] = useState(DateTime.now().startOf("month"));
  const [settingsName, setSettingsName] = useState<string>("");
  const [settingsCategory, setSettingsCategory] = useState<string>("");
  const [settingsTimezone, setSettingsTimezone] = useState<string>("UTC");
  const [settingsPhone, setSettingsPhone] = useState<string>("");
  const [settingsCountry, setSettingsCountry] = useState<string>("");
  const [settingsRegion, setSettingsRegion] = useState<string>("");
  const [settingsAvailabilityStart, setSettingsAvailabilityStart] = useState<string>("09:00");
  const [settingsAvailabilityEnd, setSettingsAvailabilityEnd] = useState<string>("18:00");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [businessName, setBusinessName] = useState("Mi negocio");
  const [businessCategory, setBusinessCategory] = useState("Servicios");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [isCreatingBusiness, setIsCreatingBusiness] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotForm, setShowForgotForm] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientTab, setClientTab] = useState<"home" | "agenda">("home");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | Importance>("all");
  const [customActivities, setCustomActivities] = useState<
    { id: string; title: string; note?: string; startAt: string; kind: "manual" | "cita"; businessName?: string; importance?: Importance }[]
  >([]);
  const [showNewActivityForm, setShowNewActivityForm] = useState(false);
  const [formSource, setFormSource] = useState<"custom" | "device">("custom");
  const [editingDeviceEventId, setEditingDeviceEventId] = useState<string | null>(null);
  const [editingDeviceDurationMin, setEditingDeviceDurationMin] = useState<number>(60);
  const [newActivityTitle, setNewActivityTitle] = useState("Actividad");
  const [newActivityDate, setNewActivityDate] = useState(isoToday());
  const [newActivityTime, setNewActivityTime] = useState("09:00");
  const [newActivityNote, setNewActivityNote] = useState("");
  const [newActivityImportance, setNewActivityImportance] = useState<Importance>("medium");
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [initialActivitySnapshot, setInitialActivitySnapshot] = useState<{
    title: string;
    date: string;
    time: string;
    note: string;
    importance: Importance;
  } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(DateTime.now().startOf("month"));
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showClientSettingsModal, setShowClientSettingsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notifReadKeys, setNotifReadKeys] = useState<string[]>([]);
  const [notifDeletedKeys, setNotifDeletedKeys] = useState<string[]>([]);
  const [eventNotifs, setEventNotifs] = useState<AppNotification[]>([]);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSnapshot, setProfileSnapshot] = useState<null | {
    name: string;
    status: string;
    email: string;
    phone: string;
    avatarUri: string | null;
  }>(null);
  const [clientSettingsSnapshot, setClientSettingsSnapshot] = useState<null | {
    notifyApp: boolean;
    notifyEmail: boolean;
    visibility: boolean;
  }>(null);
  const [profileName, setProfileName] = useState("");
  const [profileStatus, setProfileStatus] = useState("Disponible");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [showAvatarSheet, setShowAvatarSheet] = useState(false);
  const [isPersistingProfile, setIsPersistingProfile] = useState(false);
  const [notifyApp, setNotifyApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [visibility, setVisibility] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deviceEvents, setDeviceEvents] = useState<Activity[]>([]);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [agendaPreview, setAgendaPreview] = useState<null | { source: ScheduleSource; id: string }>(null);
  const prevApptStatusRef = useRef<Record<string, string>>({});
  const isKeyboardVisibleRef = useRef(false);
  const pendingAvatarSheetOpenRef = useRef(false);
  const openProfile = useCallback(() => {
    setIsProfileEditing(false);
    setCurrentPassword("");
    setNewPassword("");
    setProfileSnapshot({ name: profileName, status: profileStatus, email: newEmail, phone: profilePhone, avatarUri });
    setShowProfileModal(true);
  }, [avatarUri, newEmail, profileName, profilePhone, profileStatus]);

  const openClientSettings = useCallback(() => {
    setClientSettingsSnapshot({ notifyApp, notifyEmail, visibility });
    setShowClientSettingsModal(true);
  }, [notifyApp, notifyEmail, visibility]);

  useEffect(() => {
    const onShow = () => {
      isKeyboardVisibleRef.current = true;
    };
    const onHide = () => {
      isKeyboardVisibleRef.current = false;
      if (pendingAvatarSheetOpenRef.current) {
        pendingAvatarSheetOpenRef.current = false;
        setShowAvatarSheet(true);
      }
    };
    const subShow = Keyboard.addListener("keyboardDidShow", onShow);
    const subHide = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const displayProfileName = useMemo(() => {
    const v = cleanOptionalText(profileName);
    return v.trim().length ? v.trim() : "Cliente";
  }, [profileName]);

  const isProfileDirty = useMemo(() => {
    if (!profileSnapshot) return false;
    if ((currentPassword || "").trim().length) return true;
    if ((newPassword || "").trim().length) return true;
    return (
      profileName !== profileSnapshot.name ||
      profileStatus !== profileSnapshot.status ||
      newEmail !== profileSnapshot.email ||
      profilePhone !== profileSnapshot.phone ||
      avatarUri !== profileSnapshot.avatarUri
    );
  }, [avatarUri, currentPassword, newEmail, newPassword, profileName, profilePhone, profileSnapshot, profileStatus]);

  const isClientSettingsDirty = useMemo(() => {
    if (!clientSettingsSnapshot) return false;
    return (
      notifyApp !== clientSettingsSnapshot.notifyApp ||
      notifyEmail !== clientSettingsSnapshot.notifyEmail ||
      visibility !== clientSettingsSnapshot.visibility
    );
  }, [clientSettingsSnapshot, notifyApp, notifyEmail, visibility]);

  const authHeaders = useMemo<Record<string, string> | null>(
    () => (token ? { Authorization: `Bearer ${token}` } : null),
    [token],
  );
  const isClient = user?.kind === "client";
  const isBusiness = user?.kind === "business";
  const selectedBusinessData = useMemo(
    () => myBusinesses.find((b) => b.id === selectedBusiness) || myBusinesses[0],
    [myBusinesses, selectedBusiness],
  );
  const currentZone = selectedTimezone || "UTC";
  const activeBusinessId = useMemo(
    () => selectedBusiness || (isBusiness ? myBusinesses[0]?.id ?? null : null),
    [isBusiness, myBusinesses, selectedBusiness],
  );
  const isAsiaRegion = useMemo(() => {
    if (settingsCountry && asiaCountries.includes(settingsCountry)) return true;
    return currentZone.startsWith("Asia/");
  }, [currentZone, settingsCountry]);
  const socialProviders = useMemo(
    () =>
      isAsiaRegion
        ? [
            { key: "line", label: "LINE", color: "#06C755" },
            { key: "x", label: "X", color: "#000000" },
            { key: "ig", label: "IG", color: "#C13584" },
          ]
        : [
            { key: "whatsapp", label: "WA", color: "#25D366" },
            { key: "google", label: "G", color: "#DB4437" },
            { key: "x", label: "X", color: "#000000" },
          ],
    [isAsiaRegion],
  );
  const scheduleItems = useMemo(
    () => [
      ...appointments.map((a) => ({
        source: "appointment" as const,
        id: a.id,
        title: a.business?.name || "Negocio",
        subtitle: a.service?.name || "Servicio",
        startAt: a.startAt,
        status: a.status || "PENDING",
        kind: "cita" as const,
        importance: "medium" as Importance,
      })),
      ...customActivities.map((c) => ({
        source: "custom" as const,
        id: c.id,
        title: c.title,
        subtitle: c.businessName || c.note || "",
        note: c.note,
        startAt: c.startAt,
        status: c.kind === "cita" ? "CITA" : "MANUAL",
        kind: c.kind,
        importance: c.importance || "medium",
      })),
      ...deviceEvents.map((e) => ({
        source: "device" as const,
        id: e.id,
        title: e.title || "Evento calendario",
        subtitle: e.businessName || e.note || "Calendario del dispositivo",
        note: e.note,
        startAt: e.startAt,
        endAt: e.endAt,
        calendarEventId: e.calendarEventId,
        status: "CALENDARIO",
        kind: "manual" as const,
        importance: "low" as Importance,
      })),
    ],
    [appointments, customActivities, deviceEvents],
  );
  const orderedSchedule = useMemo(
    () =>
      [...scheduleItems].sort(
        (a, b) => DateTime.fromISO(a.startAt).toMillis() - DateTime.fromISO(b.startAt).toMillis(),
      ),
    [scheduleItems],
  );

  const DAY_SATURATED_THRESHOLD = 8;

  const busyCountByDate = useMemo(() => {
    const m = new Map<string, number>();
    scheduleItems.forEach((i) => {
      const d = DateTime.fromISO(i.startAt, { zone: currentZone }).toISODate();
      if (!d) return;
      m.set(d, (m.get(d) || 0) + 1);
    });
    return m;
  }, [currentZone, scheduleItems]);

  const isDateSaturated = useCallback(
    (isoDate: string) => (busyCountByDate.get(isoDate) || 0) >= DAY_SATURATED_THRESHOLD,
    [busyCountByDate],
  );

  const isTimeOccupied = useCallback(
    (isoDate: string, timeHHmm: string) => {
      const ignoreCustomId = formSource === "custom" ? editingActivityId : null;
      const ignoreCalId = formSource === "device" ? editingDeviceEventId : null;
      for (const i of scheduleItems) {
        const d = DateTime.fromISO(i.startAt, { zone: currentZone });
        if (!d.isValid) continue;
        if (d.toISODate() !== isoDate) continue;
        if (d.toFormat("HH:mm") !== timeHHmm) continue;
        if (ignoreCustomId && i.source === "custom" && i.id === ignoreCustomId) continue;
        if (ignoreCalId && i.source === "device" && (i.calendarEventId === ignoreCalId || i.id === `cal-${ignoreCalId}`)) continue;
        return true;
      }
      return false;
    },
    [currentZone, editingActivityId, editingDeviceEventId, formSource, scheduleItems],
  );

  const selectedTimeOccupied = useMemo(() => {
    if (!showNewActivityForm) return false;
    if (!newActivityDate || !newActivityTime) return false;
    return isTimeOccupied(newActivityDate, newActivityTime);
  }, [isTimeOccupied, newActivityDate, newActivityTime, showNewActivityForm]);
  const filteredSchedule = useMemo(() => {
    if (urgencyFilter === "all") return orderedSchedule;
    return orderedSchedule.filter((i) => (i.importance as Importance) === urgencyFilter);
  }, [orderedSchedule, urgencyFilter]);

  const upcomingNotifs = useMemo<AppNotification[]>(() => {
    const now = DateTime.now().setZone(currentZone);
    const cutoff = now.plus({ days: 7 });
    return scheduleItems
      .map((i) => {
        const dt = DateTime.fromISO(i.startAt, { zone: currentZone });
        if (!dt.isValid) return null;
        if (dt < now) return null;
        if (dt > cutoff) return null;
        const pretty = dt.toFormat("dd LLL · HH:mm");
        const source = i.source as ScheduleSource;
        const title =
          source === "appointment" ? "Cita próxima" : source === "device" ? "Evento próximo" : "Recordatorio próximo";
        const body = `${i.title}${i.subtitle ? ` · ${i.subtitle}` : ""} · ${pretty}`;
        const key = `upcoming:${source}:${i.id}:${dt.toISODate()}`;
        return {
          key,
          kind: "upcoming" as const,
          title,
          body,
          whenISO: dt.toISO() || i.startAt,
          createdAt: dt.toMillis(),
          source,
          itemId: i.id,
        } satisfies AppNotification;
      })
      .filter(Boolean) as AppNotification[];
  }, [currentZone, scheduleItems]);

  const notifications = useMemo<AppNotification[]>(() => {
    const deleted = new Set(notifDeletedKeys);
    const byKey = new Map<string, AppNotification>();
    [...eventNotifs, ...upcomingNotifs].forEach((n) => {
      if (deleted.has(n.key)) return;
      const prev = byKey.get(n.key);
      if (!prev || n.createdAt > prev.createdAt) byKey.set(n.key, n);
    });
    return [...byKey.values()].sort(
      (a, b) => DateTime.fromISO(b.whenISO).toMillis() - DateTime.fromISO(a.whenISO).toMillis(),
    );
  }, [eventNotifs, notifDeletedKeys, upcomingNotifs]);

  const unreadCount = useMemo(() => {
    const read = new Set(notifReadKeys);
    return notifications.reduce((acc, n) => acc + (read.has(n.key) ? 0 : 1), 0);
  }, [notifReadKeys, notifications]);

  const toggleNotificationRead = useCallback((key: string) => {
    setNotifReadKeys((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return [...s];
    });
  }, []);

  const deleteNotification = useCallback((key: string) => {
    setNotifDeletedKeys((prev) => {
      const s = new Set(prev);
      s.add(key);
      return [...s];
    });
  }, []);

  const openNotifications = useCallback(() => {
    setShowNotificationsModal(true);
  }, []);

  const deleteCustomReminder = useCallback((id: string) => {
    setCustomActivities((prev) => {
      const next = prev.filter((a) => a.id !== id);
      AsyncStorage.setItem(STORAGE_ACTIVITIES, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
    setAgendaPreview((p) => (p?.source === "custom" && p.id === id ? null : p));
  }, []);

  const confirmDeleteCustomReminder = useCallback(
    (id: string) => {
      Alert.alert("Eliminar", "¿Quieres eliminar este recordatorio?", [
        { text: "No", style: "cancel" },
        { text: "Sí", style: "destructive", onPress: () => deleteCustomReminder(id) },
      ]);
    },
    [deleteCustomReminder],
  );

  const openAgendaPreview = useCallback((source: ScheduleSource, id: string) => {
    setAgendaPreview({ source, id });
  }, []);

  const agendaPreviewData = useMemo(() => {
    if (!agendaPreview) return null;
    if (agendaPreview.source === "custom") {
      const a = customActivities.find((x) => x.id === agendaPreview.id);
      if (!a) return null;
      return {
        source: "custom" as const,
        id: a.id,
        title: a.title,
        subtitle: a.businessName || "",
        note: a.note || "",
        startAt: a.startAt,
        importance: a.importance || "medium",
        status: "MANUAL",
      };
    }
    if (agendaPreview.source === "appointment") {
      const appt = appointments.find((x) => x.id === agendaPreview.id);
      if (!appt) return null;
      return {
        source: "appointment" as const,
        id: appt.id,
        title: appt.business?.name || "Negocio",
        subtitle: appt.service?.name || "Servicio",
        note: "",
        startAt: appt.startAt,
        importance: "medium" as Importance,
        status: appt.status || "PENDING",
      };
    }
    const ev = deviceEvents.find((x) => x.id === agendaPreview.id);
    if (!ev) return null;
    return {
      source: "device" as const,
      id: ev.id,
      calendarEventId: ev.calendarEventId,
      title: ev.title || "Evento calendario",
      subtitle: ev.businessName || "",
      note: ev.note || "Calendario del dispositivo",
      startAt: ev.startAt,
      importance: "low" as Importance,
      status: "CALENDARIO",
    };
  }, [agendaPreview, appointments, customActivities, deviceEvents]);
  const monthDays = useMemo(() => {
    // 6-week grid starting Monday.
    const start = pickerMonth.startOf("month");
    const gridStart = start.minus({ days: start.weekday - 1 });
    return Array.from({ length: 42 }, (_, i) => gridStart.plus({ days: i }));
  }, [pickerMonth]);
  const bookingMonthDays = useMemo(() => {
    const start = bookingPickerMonth.startOf("month");
    const gridStart = start.minus({ days: start.weekday - 1 });
    return Array.from({ length: 42 }, (_, i) => gridStart.plus({ days: i }));
  }, [bookingPickerMonth]);
  const filteredBusinesses = useMemo(
    () =>
      businesses.filter((b) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return b.name.toLowerCase().includes(term) || (b.category || "").toLowerCase().includes(term);
      }),
    [businesses, searchTerm],
  );
  const businessStats = useMemo(() => {
    const zone = currentZone;
    const now = DateTime.now().setZone(zone);
    const today = now.toISODate();
    const parsed = appointments
      .map((a) => ({ appt: a, dt: DateTime.fromISO(a.startAt, { zone }) }))
      .filter((x) => x.dt.isValid);
    const upcoming = parsed.filter((x) => x.dt >= now);
    const todayAppointments = parsed.filter((x) => x.dt.toISODate() === today);
    const pending = parsed.filter((x) => (x.appt.status || "").toUpperCase() !== "CANCELLED");
    const next = upcoming.sort((a, b) => a.dt.toMillis() - b.dt.toMillis())[0];
    return {
      today: todayAppointments.length,
      pending: pending.length,
      upcoming: upcoming.length,
      nextStart: next?.appt.startAt,
      nextService: next?.appt.service?.name,
    };
  }, [appointments, currentZone]);

  const handleLogin = async (kind: UserKind) => {
    setIsAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, kind }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "No se pudo iniciar sesion");
      }
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "Fallo de login"));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRegisterFromForm = useCallback(
    async (kind: UserKind) => {
      const name = regName.trim();
      const em = regEmail.trim().toLowerCase();
      const pwd = regPassword;
      const country = regCountry.trim();
      const timezone = regTimezone.trim() || "UTC";

      if (!name || !em || !pwd || !country) {
        Alert.alert("Faltan datos", "Completa nombre, correo, contraseña y país.");
        return;
      }
      if (pwd.length < 4) {
        Alert.alert("Contraseña", "La contraseña debe tener al menos 4 caracteres.");
        return;
      }

      setIsRegSubmitting(true);
      try {
        const endpoint = kind === "client" ? "/users/client" : "/users/business";
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: em, password: pwd, name }),
        });
        if (!res.ok) throw new Error(await res.text());

        // Reuse login flow but with form credentials.
        const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: em, password: pwd, kind }),
        });
        if (!loginRes.ok) throw new Error(await loginRes.text());
        const data = await loginRes.json();
        setToken(data.token);
        setUser(data.user);

        // Use detected timezone for the app immediately and persist basic region info locally.
        setSelectedTimezone(timezone);
        AsyncStorage.setItem(
          STORAGE_PROFILE,
          JSON.stringify({
            name,
            status: profileStatus,
            avatarUri,
            notifyApp,
            notifyEmail,
            visibility,
            email: em,
            phone: profilePhone,
            country,
            timezone,
          }),
        ).catch(() => undefined);

        setProfileName(name);
        setNewEmail(em);
        setRegName("");
        setRegEmail("");
        setRegPassword("");
        setRegCountry("");
        setShowRegisterSheet(false);
      } catch (err: unknown) {
        Alert.alert("Error", getErrorMessage(err, "No se pudo crear la cuenta."));
      } finally {
        setIsRegSubmitting(false);
      }
    },
    [
      avatarUri,
      notifyApp,
      notifyEmail,
      profilePhone,
      profileStatus,
      regCountry,
      regEmail,
      regName,
      regPassword,
      regTimezone,
      visibility,
    ],
  );

  const detectRegionFromDevice = useCallback(async () => {
    setIsRegDetecting(true);
    try {
      let tz = "UTC";
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {
        tz = "UTC";
      }
      setRegTimezone(tz);

      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permiso requerido", "Activa la ubicación para detectar el país.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const rev = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const first = rev?.[0];
      if (first?.country) setRegCountry(first.country);
    } catch (err: unknown) {
      Alert.alert("Detección", getErrorMessage(err, "No se pudo detectar la región del dispositivo."));
    } finally {
      setIsRegDetecting(false);
    }
  }, []);

  const fetchBusinesses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/businesses`);
      if (!res.ok) return;
      const data = await res.json();
      setBusinesses(data);
      if (isClient && data.length && !selectedBusiness) {
        setSelectedBusiness(data[0].id);
        if (data[0].timezone) setSelectedTimezone(data[0].timezone);
      }
    } catch (err) {
      console.warn("Error cargando negocios", err);
    }
  }, [isClient, selectedBusiness]);

  const fetchMyBusinesses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/businesses/mine`, { headers: authHeaders ?? undefined });
      if (!res.ok) return;
      let data = await res.json();
      if (!Array.isArray(data)) data = [];

      setMyBusinesses(data);
      if (data.length) {
        setSelectedBusiness(data[0].id);
        if (data[0].timezone) setSelectedTimezone(data[0].timezone);
      }
    } catch (err) {
      console.warn("Error cargando negocios propios", err);
    }
  }, [authHeaders]);

  const createBusinessProfile = useCallback(async () => {
    if (!authHeaders) {
      Alert.alert("Sesion requerida", "Inicia sesion como negocio para crear perfil");
      return;
    }
    setIsCreatingBusiness(true);
    try {
      const res = await fetch(`${API_BASE_URL}/businesses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: businessName || "Mi negocio",
          category: businessCategory || "Servicios",
          phone: businessPhone || undefined,
          address: businessAddress || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created: Business = await res.json();
      setMyBusinesses([created, ...myBusinesses]);
      setSelectedBusiness(created.id);
      if (created.timezone) setSelectedTimezone(created.timezone);
      Alert.alert("Negocio creado", "Perfil de negocio listo");
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "No se pudo crear el negocio"));
    } finally {
      setIsCreatingBusiness(false);
    }
  }, [authHeaders, businessAddress, businessCategory, businessName, businessPhone, myBusinesses]);

  const fetchServices = useCallback(
    async (businessId: string) => {
      setIsServicesLoading(true);
      setServices([]);
      setSelectedService(null);
      const business = businesses.find((b) => b.id === businessId);
      if (business?.timezone) setSelectedTimezone(business.timezone);
      try {
        const res = await fetch(`${API_BASE_URL}/businesses/${businessId}/services`);
        if (!res.ok) throw new Error("No se pudieron cargar servicios");
        const data = await res.json();
        setServices(data);
        if (data.length) setSelectedService(data[0].id);
      } catch (err: unknown) {
        Alert.alert("Error", getErrorMessage(err, "Fallo al obtener servicios"));
      } finally {
        setIsServicesLoading(false);
      }
    },
    [businesses],
  );

  const fetchSlots = useCallback(async () => {
    if (!selectedBusiness || !selectedService) return;
    setIsSlotsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/businesses/${selectedBusiness}/availability?date=${selectedDate}&serviceId=${selectedService}`,
      );
      if (!res.ok) throw new Error("No hay disponibilidad");
      const data = await res.json();
      setSlots(data.slots || []);
    } catch (err: unknown) {
      Alert.alert("Sin slots", getErrorMessage(err, "No se pudo obtener disponibilidad"));
      setSlots([]);
    } finally {
      setIsSlotsLoading(false);
    }
  }, [selectedBusiness, selectedService, selectedDate]);

  const fetchAppointments = useCallback(
    async (businessId?: string) => {
      if (!token || !user) return;
      setIsAppointmentsLoading(true);
      try {
        const query = user.kind === "business" ? `?businessId=${businessId || selectedBusiness}` : "";
        const res = await fetch(`${API_BASE_URL}/appointments${query}`, { headers: authHeaders ?? undefined });
        if (res.ok) {
          setAppointments(await res.json());
        } else {
          setAppointments([]);
        }
      } catch (err) {
        console.warn("Error cargando citas", err);
        setAppointments([]);
      } finally {
        setIsAppointmentsLoading(false);
      }
    },
    [authHeaders, selectedBusiness, token, user],
  );

  const createAppointment = useCallback(async () => {
    if (!authHeaders || !selectedBusiness || !selectedService || !bookingSelectedStartAt) {
      Alert.alert("Faltan datos", "Selecciona servicio, fecha y horario.");
      return;
    }
    setIsCreatingAppointment(true);
    try {
      const res = await fetch(`${API_BASE_URL}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          businessId: selectedBusiness,
          serviceId: selectedService,
          startAt: bookingSelectedStartAt,
          customerNote: bookingNote.trim().length ? bookingNote.trim() : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
      await fetchAppointments();
      setShowBookingModal(false);
      setClientTab("agenda");
      setBookingSelectedStartAt(null);
      setBookingNote("");
      Alert.alert("Solicitud enviada", "Tu cita quedó pendiente hasta que el negocio la apruebe.");
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "No se pudo crear la cita."));
    } finally {
      setIsCreatingAppointment(false);
    }
  }, [authHeaders, bookingNote, bookingSelectedStartAt, fetchAppointments, selectedBusiness, selectedService]);

  useEffect(() => {
    if (!appointments.length) return;
    const next: Record<string, string> = {};
    const createdAt = Date.now();
    const newNotifs: AppNotification[] = [];

    appointments.forEach((a) => {
      const nextStatus = (a.status || "").toUpperCase();
      next[a.id] = nextStatus;
      const prevStatus = (prevApptStatusRef.current[a.id] || "").toUpperCase();
      if (prevStatus && prevStatus !== nextStatus) {
        const label =
          nextStatus === "CANCELLED"
            ? "Cita cancelada"
            : nextStatus === "REJECTED"
              ? "Cita rechazada"
              : nextStatus === "APPROVED" || nextStatus === "CONFIRMED"
                ? "Cita aprobada"
                : `Estado de cita: ${nextStatus}`;
        const dt = DateTime.fromISO(a.startAt, { zone: currentZone });
        const pretty = dt.isValid ? dt.toFormat("dd LLL · HH:mm") : a.startAt;
        newNotifs.push({
          key: `status:appointment:${a.id}:${nextStatus}`,
          kind: "status",
          title: label,
          body: `${a.business?.name || "Negocio"} · ${a.service?.name || "Servicio"} · ${pretty}`,
          whenISO: dt.isValid ? dt.toISO() || a.startAt : a.startAt,
          createdAt,
          source: "appointment",
          itemId: a.id,
        });
      }
    });

    prevApptStatusRef.current = next;
    if (newNotifs.length) {
      setEventNotifs((prev) => {
        const existing = new Set(prev.map((n) => n.key));
        const filtered = newNotifs.filter((n) => !existing.has(n.key));
        const merged = [...filtered, ...prev].slice(0, 200);
        return merged;
      });
    }
  }, [appointments, currentZone]);

  const fetchProfile = useCallback(async () => {
    if (!authHeaders) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users/me`, { headers: authHeaders });
      if (!res.ok) return;
      const data = await res.json();
      // Keep empty-string semantics (e.g. user cleared a field -> backend returns null).
      if ("name" in data) setProfileName(cleanOptionalText(data.name));
      if ("status" in data) setProfileStatus(cleanOptionalText(data.status));
      if ("avatarUrl" in data) setAvatarUri(typeof data.avatarUrl === "string" ? data.avatarUrl : null);
      if ("phone" in data) setProfilePhone(cleanOptionalText(data.phone));
      if (typeof data.notifyApp === "boolean") setNotifyApp(data.notifyApp);
      if (typeof data.notifyEmail === "boolean") setNotifyEmail(data.notifyEmail);
      if (typeof data.visibility === "boolean") setVisibility(data.visibility);
      if ("email" in data) setNewEmail(typeof data.email === "string" ? data.email : "");
      await AsyncStorage.setItem(
        STORAGE_PROFILE,
        JSON.stringify({
          name: cleanOptionalText(data.name),
          status: cleanOptionalText(data.status),
          avatarUri: typeof data.avatarUrl === "string" ? data.avatarUrl : null,
          phone: cleanOptionalText(data.phone),
          notifyApp: typeof data.notifyApp === "boolean" ? data.notifyApp : notifyApp,
          notifyEmail: typeof data.notifyEmail === "boolean" ? data.notifyEmail : notifyEmail,
          visibility: typeof data.visibility === "boolean" ? data.visibility : visibility,
          email: typeof data.email === "string" ? data.email : "",
        }),
      );
    } catch (err) {
      console.warn("No se pudo sincronizar perfil", err);
    }
  }, [authHeaders, notifyApp, notifyEmail, visibility]);

  const fetchActivitiesRemote = useCallback(async () => {
    if (!authHeaders || !isClient) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users/activities`, { headers: authHeaders });
      if (!res.ok) return;
      const data: { id: string; title?: string; note?: string; kind?: string; startAt: string; importance?: string }[] =
        await res.json();
      const mapped: Activity[] = Array.isArray(data)
        ? data.map<Activity>((a) => ({
            id: a.id,
            title: a.title || "Actividad",
            note: a.note || undefined,
            kind: a.kind === "cita" ? "cita" : "manual",
            startAt: a.startAt,
            importance:
              a.importance === "low" || a.importance === "high" || a.importance === "medium"
                ? (a.importance as Importance)
                : "medium",
            businessName: a.note || undefined,
          }))
        : [];
      setCustomActivities(mapped);
      await AsyncStorage.setItem(STORAGE_ACTIVITIES, JSON.stringify(mapped));
    } catch (err) {
      console.warn("No se pudo sincronizar actividades", err);
    }
  }, [authHeaders, isClient]);

  const syncDeviceCalendar = useCallback(
    async (silent = false) => {
      try {
        const perm = await Calendar.requestCalendarPermissionsAsync();
        if (perm.status !== "granted") {
          if (!silent) {
            Alert.alert("Permiso requerido", "Activa el acceso al calendario del dispositivo para sincronizar eventos.");
          }
          return;
        }
        setIsSyncingCalendar(true);
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const calendarIds = calendars.map((c) => c.id);
        if (!calendarIds.length) {
          setDeviceEvents([]);
          return;
        }
        const start = DateTime.now().minus({ days: 7 }).toJSDate();
        const end = DateTime.now().plus({ days: 60 }).toJSDate();
        const events = await Calendar.getEventsAsync(calendarIds, start, end);
        const mapped: Activity[] = (events || [])
          .map((ev) => {
            const startDate = ev.startDate ? new Date(ev.startDate) : null;
            if (!startDate) return null;
            const startISO = DateTime.fromJSDate(startDate).setZone(ev.timeZone || currentZone).toISO();
            if (!startISO) return null;
            const endDate = ev.endDate ? new Date(ev.endDate) : null;
            const endISO = endDate ? DateTime.fromJSDate(endDate).setZone(ev.timeZone || currentZone).toISO() : null;
            return {
              id: `cal-${ev.id}`,
              calendarEventId: ev.id,
              title: ev.title || "Evento calendario",
              note: (ev.notes as string) || (ev.location as string) || undefined,
              startAt: startISO,
              endAt: endISO || undefined,
              kind: "manual",
              businessName: "Calendario del dispositivo",
              importance: "low",
            };
        })
        .filter(Boolean) as Activity[];
      setDeviceEvents(mapped);
      } catch (err) {
        if (!silent) {
          Alert.alert("Calendario", getErrorMessage(err, "No se pudo sincronizar el calendario del celular."));
        }
      } finally {
        setIsSyncingCalendar(false);
      }
    },
    [currentZone],
  );

  const publishAvailability = useCallback(async () => {
    const businessId = activeBusinessId ?? myBusinesses[0]?.id ?? selectedBusiness;
    if (!businessId || !authHeaders) {
      Alert.alert("Selecciona negocio", "No se detecto negocio activo para publicar disponibilidad");
      return;
    }
    setIsSavingAvailability(true);
    try {
      const res = await fetch(`${API_BASE_URL}/businesses/${businessId}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ dayOfWeek: availabilityDay, startTime: availabilityStart, endTime: availabilityEnd }),
      });
      if (!res.ok) throw new Error(await res.text());
      Alert.alert("Disponibilidad", "Horario publicado");
      setShowAvailabilityForm(false);
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "No se pudo publicar"));
    } finally {
      setIsSavingAvailability(false);
    }
  }, [activeBusinessId, authHeaders, availabilityDay, availabilityEnd, availabilityStart, myBusinesses, selectedBusiness]);

  const createService = useCallback(async () => {
    const businessId = activeBusinessId ?? myBusinesses[0]?.id ?? selectedBusiness;
    if (!businessId || !authHeaders) {
      Alert.alert("Selecciona negocio", "No se detecto negocio activo para crear servicio");
      return;
    }
    setIsSavingService(true);
    try {
      const body = {
        name: serviceName || "Servicio",
        durationMin: 30,
        priceYen: 0,
      };
      const res = await fetch(`${API_BASE_URL}/businesses/${businessId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      Alert.alert("Servicio", "Servicio creado");
      setShowServiceForm(false);
      if (businessId) fetchServices(businessId);
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "No se pudo crear servicio"));
    } finally {
      setIsSavingService(false);
    }
  }, [activeBusinessId, authHeaders, fetchServices, myBusinesses, selectedBusiness, serviceName]);

  const addTemplateService = useCallback(
    async (template: (typeof serviceTemplates)[number]) => {
      const businessId = activeBusinessId ?? myBusinesses[0]?.id ?? selectedBusiness;
      if (!businessId || !authHeaders) {
        Alert.alert("Selecciona negocio", "No se detecto negocio activo para crear servicio");
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/businesses/${businessId}/services`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(template),
        });
        if (!res.ok) throw new Error(await res.text());
        fetchServices(businessId);
      } catch (err: unknown) {
        Alert.alert("Error", getErrorMessage(err, "No se pudo crear servicio"));
      }
    },
    [activeBusinessId, authHeaders, fetchServices, myBusinesses, selectedBusiness],
  );

  const saveSettings = useCallback(() => {
    const businessId = activeBusinessId ?? myBusinesses[0]?.id ?? selectedBusiness;
    if (!businessId) {
      Alert.alert("Selecciona negocio", "No se detecto negocio activo para actualizar perfil");
      return;
    }
    setIsSavingSettings(true);
    const updated = {
      id: businessId,
      name: settingsName || "Negocio",
      category: settingsCategory || "Categoria",
      timezone: settingsTimezone || "UTC",
      phone: settingsPhone || "",
      country: settingsCountry || "",
      region: settingsRegion || "",
      availabilityStart: settingsAvailabilityStart,
      availabilityEnd: settingsAvailabilityEnd,
    };
    setMyBusinesses((prev) => prev.map((b) => (b.id === businessId ? { ...b, ...updated } : b)));
    setBusinesses((prev) => prev.map((b) => (b.id === businessId ? { ...b, ...updated } : b)));
    setSelectedTimezone(updated.timezone);
    setShowSettingsForm(false);
    setShowMenu(false);
    Alert.alert("Configuracion", "Cambios guardados para esta sesion (se requiere endpoint PATCH para persistir).");
    setIsSavingSettings(false);
  }, [
    activeBusinessId,
    myBusinesses,
    selectedBusiness,
    settingsAvailabilityEnd,
    settingsAvailabilityStart,
    settingsCategory,
    settingsCountry,
    settingsName,
    settingsPhone,
    settingsRegion,
    settingsTimezone,
  ]);

  const cancelAppointment = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/appointments/${id}/cancel`, {
          method: "POST",
          headers: authHeaders ?? undefined,
        });
        if (!res.ok) throw new Error(await res.text());
        Alert.alert("Cancelada", "La cita fue cancelada");
        await fetchAppointments();
      } catch (err: unknown) {
        Alert.alert("Error", getErrorMessage(err, "No se pudo cancelar"));
      }
    },
    [authHeaders, fetchAppointments, token],
  );

  const confirmCancelAgendaAppointment = useCallback(
    (id: string) => {
      Alert.alert("Cancelar cita", "¿Quieres cancelar esta cita?", [
        { text: "No", style: "cancel" },
        { text: "Sí", style: "destructive", onPress: () => cancelAppointment(id) },
      ]);
    },
    [cancelAppointment],
  );

  useEffect(() => {
    if (!token) return;
    if (isClient) {
      fetchBusinesses();
    } else {
      setBusinesses([]);
      setServices([]);
      setSlots([]);
    }
    if (isBusiness) {
      fetchMyBusinesses();
    }
    if (token) {
      fetchProfile();
      fetchActivitiesRemote();
    }
  }, [fetchActivitiesRemote, fetchBusinesses, fetchMyBusinesses, fetchProfile, isBusiness, isClient, token]);

  useEffect(() => {
    const source = isBusiness ? myBusinesses : businesses;
    const found = source.find((b) => b.id === selectedBusiness) || source[0];
    if (found?.timezone) setSelectedTimezone(found.timezone);
    else setSelectedTimezone("UTC");
  }, [businesses, isBusiness, myBusinesses, selectedBusiness]);

  useEffect(() => {
    if (isClient && selectedBusiness) {
      fetchServices(selectedBusiness);
    }
  }, [fetchServices, isClient, selectedBusiness]);

  useEffect(() => {
    if (!selectedService) return;
    if (isClient) {
      setBookingSelectedStartAt(null);
      fetchSlots();
    }
  }, [fetchSlots, isClient, selectedService]);

  useEffect(() => {
    if ((isClient && clientTab === "agenda") || isBusiness) {
      syncDeviceCalendar(true);
    }
  }, [clientTab, isBusiness, isClient, syncDeviceCalendar]);

  useEffect(() => {
    if (!isBusiness || !selectedBusiness) return;
    fetchAppointments(selectedBusiness);
  }, [fetchAppointments, isBusiness, selectedBusiness]);

  useEffect(() => {
    if (!token || !isClient || clientTab !== "agenda") return;
    fetchAppointments();
  }, [clientTab, fetchAppointments, isClient, token]);

  useEffect(() => {
    if (!isClient) return;
    setBookingSelectedStartAt(null);
  }, [isClient, selectedDate]);

  // "Tiempo real" (sin sockets): polling + refresh al volver a la app.
  useEffect(() => {
    if (!token || !user) return;
    const isAgenda = isClient && clientTab === "agenda";
    const isBiz = isBusiness && Boolean(selectedBusiness);
    if (!isAgenda && !isBiz) return;

    const refresh = () => {
      if (isAgenda) {
        fetchAppointments();
        syncDeviceCalendar(true);
      } else if (isBiz) {
        fetchAppointments(selectedBusiness || undefined);
      }
    };

    // Initial refresh when effect starts.
    refresh();

    const apptTimer = setInterval(() => {
      // Avoid overlapping spinners too aggressively.
      refresh();
    }, 15000);

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => {
      clearInterval(apptTimer);
      appStateSub.remove();
    };
  }, [
    clientTab,
    fetchAppointments,
    isBusiness,
    isClient,
    selectedBusiness,
    syncDeviceCalendar,
    token,
    user,
  ]);

  useEffect(() => {
    if (!isClient || !orderedSchedule.length) return;
    const now = DateTime.now().setZone(currentZone);
    const timers: ReturnType<typeof setTimeout>[] = [];

    const schedule = (when: DateTime, msg: string) => {
      if (!when.isValid) return;
      const diff = when.toMillis() - now.toMillis();
      if (diff > 0 && diff < 7 * 24 * 60 * 60 * 1000) {
        const t = setTimeout(() => Alert.alert("Recordatorio", msg), diff);
        timers.push(t);
      }
    };

    orderedSchedule.forEach((item) => {
      const dt = DateTime.fromISO(item.startAt, { zone: currentZone });
      if (!dt.isValid) return;
      const startOfDay = dt.startOf("day");
      const oneHourBefore = dt.minus({ hours: 1 });
      const label = item.subtitle || item.title;
      schedule(
        startOfDay,
        `Hoy tienes ${item.kind === "cita" ? "una cita" : "una actividad"} de ${label} a las ${dt.toFormat("HH:mm")}.`,
      );
      schedule(
        oneHourBefore,
        `En 1 hora tienes ${item.kind === "cita" ? "cita" : "actividad"} de ${label} a las ${dt.toFormat("HH:mm")}.`,
      );
    });

    return () => timers.forEach((t) => clearTimeout(t));
  }, [currentZone, isClient, orderedSchedule]);

  useEffect(() => {
    (async () => {
      try {
        const rawProfile = await AsyncStorage.getItem(STORAGE_PROFILE);
        if (rawProfile) {
          const parsed = JSON.parse(rawProfile);
          if (typeof parsed.name === "string") setProfileName(cleanOptionalText(parsed.name));
          if (parsed.name === null) setProfileName("");
          if (typeof parsed.status === "string") setProfileStatus(cleanOptionalText(parsed.status));
          if (parsed.status === null) setProfileStatus("");
          if (typeof parsed.avatarUri === "string") setAvatarUri(parsed.avatarUri);
          if (parsed.avatarUri === null) setAvatarUri(null);
          if (typeof parsed.notifyApp === "boolean") setNotifyApp(parsed.notifyApp);
          if (typeof parsed.notifyEmail === "boolean") setNotifyEmail(parsed.notifyEmail);
          if (typeof parsed.visibility === "boolean") setVisibility(parsed.visibility);
          if (typeof parsed.email === "string") setNewEmail(parsed.email);
          if (parsed.email === null) setNewEmail("");
          if (typeof parsed.phone === "string") setProfilePhone(cleanOptionalText(parsed.phone));
          if (parsed.phone === null) setProfilePhone("");
        }
        const rawActivities = await AsyncStorage.getItem(STORAGE_ACTIVITIES);
        if (rawActivities) {
          const parsed = JSON.parse(rawActivities);
          if (Array.isArray(parsed)) {
            const normalized: Activity[] = parsed.map((a) => ({
              ...a,
              kind: a.kind === "cita" ? "cita" : "manual",
              importance:
                a.importance === "low" || a.importance === "high" || a.importance === "medium"
                  ? (a.importance as Importance)
                  : "medium",
            }));
            setCustomActivities(normalized);
          }
        }

        const rawNotifs = await AsyncStorage.getItem(STORAGE_NOTIFICATIONS);
        if (rawNotifs) {
          const parsed = JSON.parse(rawNotifs);
          if (Array.isArray(parsed.readKeys)) setNotifReadKeys(parsed.readKeys);
          if (Array.isArray(parsed.deletedKeys)) setNotifDeletedKeys(parsed.deletedKeys);
          if (Array.isArray(parsed.eventNotifs)) setEventNotifs(parsed.eventNotifs);
          if (parsed.prevApptStatus && typeof parsed.prevApptStatus === "object") {
            prevApptStatusRef.current = parsed.prevApptStatus;
          }
        }
      } catch (err) {
        console.warn("No se pudo cargar perfil/actividades locales", err);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      STORAGE_NOTIFICATIONS,
      JSON.stringify({
        readKeys: notifReadKeys,
        deletedKeys: notifDeletedKeys,
        eventNotifs,
        prevApptStatus: prevApptStatusRef.current,
      }),
    ).catch(() => undefined);
  }, [eventNotifs, notifDeletedKeys, notifReadKeys]);

  const logout = () => {
    setToken(null);
    setUser(null);
    setAppointments([]);
    setServices([]);
    setSlots([]);
    setSelectedBusiness(null);
    setSelectedService(null);
    setSelectedTimezone("UTC");
    setShowMenu(false);
    setShowSettingsForm(false);
    setShowAvailabilityForm(false);
    setShowServiceForm(false);
    setShowForgotForm(false);
    setShowNewActivityForm(false);
    setShowProfileModal(false);
  };

  const handleForgotPassword = useCallback(async () => {
    const targetEmail = forgotEmail || email;
    if (!targetEmail) {
      Alert.alert("Falta email", "Ingresa el correo para enviar el enlace de recuperación.");
      return;
    }
    setIsSendingForgot(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      if (!res.ok) throw new Error(await res.text());
      Alert.alert("Enlace enviado", "Revisa tu correo para restablecer la contraseña.");
      setShowForgotForm(false);
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "No se pudo enviar el correo. Intenta más tarde."));
    } finally {
      setIsSendingForgot(false);
    }
  }, [email, forgotEmail]);

  const handleSocialLogin = useCallback(
    (provider: string) => {
      // Integración OAuth real depende de las credenciales y deep links configurados.
      const pretty =
        provider === "line"
          ? "LINE"
          : provider === "whatsapp"
            ? "WhatsApp"
            : provider === "google"
              ? "Google"
              : provider === "ig"
                ? "Instagram"
                : "X";
      Alert.alert("Social", `OAuth pendiente para ${pretty}.`);
    },
    [],
  );

  const persistActivitiesLocal = useCallback((list: Activity[]) => {
    AsyncStorage.setItem(STORAGE_ACTIVITIES, JSON.stringify(list)).catch(() => undefined);
  }, []);

  const resetActivityForm = useCallback(() => {
    setNewActivityTitle("Actividad");
    setNewActivityDate(isoToday());
    setNewActivityTime("09:00");
    setNewActivityNote("");
    setNewActivityImportance("medium");
    setEditingActivityId(null);
    setFormSource("custom");
    setEditingDeviceEventId(null);
    setEditingDeviceDurationMin(60);
  }, []);

  const hasActivityChanges = useCallback(() => {
    if (!initialActivitySnapshot) return false;
    return (
      initialActivitySnapshot.title !== newActivityTitle ||
      initialActivitySnapshot.date !== newActivityDate ||
      initialActivitySnapshot.time !== newActivityTime ||
      (initialActivitySnapshot.note || "") !== (newActivityNote || "") ||
      initialActivitySnapshot.importance !== newActivityImportance
    );
  }, [initialActivitySnapshot, newActivityDate, newActivityImportance, newActivityNote, newActivityTime, newActivityTitle]);

  const openNewActivityForm = useCallback(() => {
    resetActivityForm();
    setFormSource("custom");
    const snapshot = {
      title: "Actividad",
      date: isoToday(),
      time: "09:00",
      note: "",
      importance: "medium" as Importance,
    };
    setInitialActivitySnapshot(snapshot);
    setShowNewActivityForm(true);
  }, [resetActivityForm]);

  const openEditActivity = useCallback(
    (activity: Activity) => {
      setFormSource("custom");
      setEditingDeviceEventId(null);
      const start = DateTime.fromISO(activity.startAt, { zone: currentZone });
      const date = start.isValid ? start.toISODate() || isoToday() : isoToday();
      const time = start.isValid ? start.toFormat("HH:mm") : "09:00";
      setNewActivityTitle(activity.title || "Actividad");
      setNewActivityDate(date);
      setNewActivityTime(time);
      setNewActivityNote(activity.note || "");
      setNewActivityImportance(activity.importance || "medium");
      setEditingActivityId(activity.id);
      setInitialActivitySnapshot({
        title: activity.title || "Actividad",
        date,
        time,
        note: activity.note || "",
        importance: activity.importance || "medium",
      });
      setShowNewActivityForm(true);
    },
    [currentZone],
  );

  const openEditDeviceEvent = useCallback(
    async (calEventId: string) => {
      try {
        const perm = await Calendar.requestCalendarPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert("Permiso requerido", "Activa el acceso al calendario del dispositivo para editar eventos.");
          return;
        }
        const ev = await Calendar.getEventAsync(calEventId);
        if (!ev?.startDate) return;
        const zone = ev.timeZone || currentZone;
        const start = DateTime.fromJSDate(new Date(ev.startDate)).setZone(zone);
        const end = ev.endDate ? DateTime.fromJSDate(new Date(ev.endDate)).setZone(zone) : start.plus({ minutes: 60 });
        const durationMin = Math.max(15, Math.round(end.diff(start, "minutes").minutes || 60));
        setEditingDeviceDurationMin(durationMin);

        setFormSource("device");
        setEditingDeviceEventId(calEventId);
        setEditingActivityId(null);

        const date = start.isValid ? start.toISODate() || isoToday() : isoToday();
        const time = start.isValid ? start.toFormat("HH:mm") : "09:00";
        setNewActivityTitle(ev.title || "Evento calendario");
        setNewActivityDate(date);
        setNewActivityTime(time);
        setNewActivityNote((ev.notes as string) || (ev.location as string) || "");
        setNewActivityImportance("low");
        setInitialActivitySnapshot({
          title: ev.title || "Evento calendario",
          date,
          time,
          note: ((ev.notes as string) || (ev.location as string) || "") as string,
          importance: "low",
        });
        setShowNewActivityForm(true);
      } catch (err: unknown) {
        Alert.alert("Calendario", getErrorMessage(err, "No se pudo abrir el evento para editar."));
      }
    },
    [currentZone],
  );

  const saveActivity = useCallback(async () => {
    const start = DateTime.fromISO(`${newActivityDate}T${newActivityTime}`, { zone: currentZone });
    if (!start.isValid) {
      Alert.alert("Fecha inválida", "Revisa la fecha y hora de la actividad.");
      return;
    }
    if (isDateSaturated(newActivityDate) && (!initialActivitySnapshot || initialActivitySnapshot.date !== newActivityDate)) {
      Alert.alert("Día saturado", "Ese día ya tiene demasiadas actividades/citas. Elige otra fecha.");
      return;
    }
    if (selectedTimeOccupied && (!initialActivitySnapshot || initialActivitySnapshot.time !== newActivityTime || initialActivitySnapshot.date !== newActivityDate)) {
      Alert.alert("Hora ocupada", "Esa hora ya está ocupada. Elige otra hora.");
      return;
    }

    if (formSource === "device") {
      if (!editingDeviceEventId) return;
      try {
        const perm = await Calendar.requestCalendarPermissionsAsync();
        if (perm.status !== "granted") {
          Alert.alert("Permiso requerido", "Activa el acceso al calendario del dispositivo para guardar cambios.");
          return;
        }
        const end = start.plus({ minutes: editingDeviceDurationMin || 60 });
        await Calendar.updateEventAsync(editingDeviceEventId, {
          title: newActivityTitle || "Evento calendario",
          notes: newActivityNote || undefined,
          startDate: start.toJSDate(),
          endDate: end.toJSDate(),
        });
        await syncDeviceCalendar(true);
        Alert.alert("Actualizado", "Evento del calendario actualizado.");
        setShowNewActivityForm(false);
        resetActivityForm();
        setInitialActivitySnapshot(null);
        return;
      } catch (err: unknown) {
        Alert.alert("Calendario", getErrorMessage(err, "No se pudo actualizar el evento."));
        return;
      }
    }
    const isEditing = Boolean(editingActivityId);
    const existing = editingActivityId ? customActivities.find((c) => c.id === editingActivityId) : null;
    const activityKind = existing?.kind || "manual";
    const startISO = start.toISO() || `${newActivityDate}T${newActivityTime}`;
    const tempId = editingActivityId || `local-${Date.now()}`;
    const payload: Activity = {
      id: tempId,
      title: newActivityTitle || "Actividad",
      note: newActivityNote || undefined,
      startAt: startISO,
      kind: activityKind,
      importance: newActivityImportance,
    };

    setCustomActivities((prev) => {
      const next = isEditing ? prev.map((p) => (p.id === tempId ? { ...payload, id: p.id } : p)) : [payload, ...prev];
      persistActivitiesLocal(next);
      return next;
    });

    if (authHeaders) {
      try {
        if (isEditing && editingActivityId && !editingActivityId.startsWith("local")) {
          await fetch(`${API_BASE_URL}/users/activities/${editingActivityId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              title: payload.title,
              note: payload.note,
              kind: payload.kind,
              startAt: payload.startAt,
              importance: payload.importance,
            }),
          });
        } else {
          const res = await fetch(`${API_BASE_URL}/users/activities`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              title: payload.title,
              note: payload.note,
              kind: payload.kind,
              startAt: payload.startAt,
              importance: payload.importance,
            }),
          });
          if (res.ok) {
            const created = await res.json();
            if (created?.id) {
              setCustomActivities((prev) => {
                const next = prev.map((p) => (p.id === tempId ? { ...p, id: created.id } : p));
                persistActivitiesLocal(next);
                return next;
              });
            }
          }
        }
      } catch (err) {
        console.warn("No se pudo persistir actividad", err);
      }
    }
    Alert.alert(isEditing ? "Actividad actualizada" : "Actividad creada", isEditing ? "Se guardaron los cambios." : "Tu recordatorio se agregó a la agenda.");
    setShowNewActivityForm(false);
    resetActivityForm();
    setInitialActivitySnapshot(null);
    setEditingActivityId(null);
  }, [
    authHeaders,
    currentZone,
    customActivities,
    editingActivityId,
    editingDeviceDurationMin,
    editingDeviceEventId,
    formSource,
    initialActivitySnapshot,
    isDateSaturated,
    newActivityDate,
    newActivityImportance,
    newActivityNote,
    newActivityTime,
    newActivityTitle,
    persistActivitiesLocal,
    resetActivityForm,
    selectedTimeOccupied,
    syncDeviceCalendar,
  ]);

  const handleCloseActivityForm = useCallback(() => {
    if (hasActivityChanges()) {
      Alert.alert("Salir sin guardar", "¿Quieres salir sin guardar?", [
        {
          text: "Descartar",
          style: "destructive",
          onPress: () => {
            resetActivityForm();
            setInitialActivitySnapshot(null);
            setShowNewActivityForm(false);
          },
        },
        { text: "Guardar", onPress: () => saveActivity() },
        { text: "Seguir editando", style: "cancel" },
      ]);
      return;
    }
    resetActivityForm();
    setInitialActivitySnapshot(null);
    setShowNewActivityForm(false);
  }, [hasActivityChanges, resetActivityForm, saveActivity]);

  const handleSelectScheduleItem = useCallback(
    (itemId: string, kind: string) => {
      if (kind !== "manual") {
        Alert.alert("Cita", "Las citas de empresa se editan desde el negocio.");
        return;
      }
      const activity = customActivities.find((a) => a.id === itemId);
      if (!activity) return;
      if (showNewActivityForm && hasActivityChanges() && editingActivityId && editingActivityId !== activity.id) {
        Alert.alert("Cambios sin guardar", "Guarda o descarta antes de abrir otra actividad.", [
          {
            text: "Descartar",
            style: "destructive",
            onPress: () => {
              resetActivityForm();
              setInitialActivitySnapshot(null);
              openEditActivity(activity);
            },
          },
          { text: "Guardar actual", onPress: () => saveActivity() },
          { text: "Seguir editando", style: "cancel" },
        ]);
        return;
      }
      openEditActivity(activity);
    },
    [
      customActivities,
      editingActivityId,
      hasActivityChanges,
      openEditActivity,
      resetActivityForm,
      saveActivity,
      showNewActivityForm,
    ],
  );

  const pickAvatar = useCallback(async () => {
    if (isKeyboardVisibleRef.current) {
      pendingAvatarSheetOpenRef.current = true;
      Keyboard.dismiss();
      return;
    }
    setShowAvatarSheet(true);
  }, []);



  if (token && isBusiness && showSettingsForm) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.safe}>
            <StatusBar style="dark" />
            <ScrollView contentContainerStyle={styles.container}>
              <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Configuraciones</Text>
                <Pressable onPress={() => setShowSettingsForm(false)}>
                  <Text style={styles.linkText}>Cerrar</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>
                Ajusta los datos visibles del negocio. (Persistencia real pendiente de endpoint PATCH en backend).
              </Text>
              <Text style={styles.fieldLabel}>Nombre del negocio</Text>
              <TextInput style={styles.input} value={settingsName} onChangeText={setSettingsName} placeholder="Nombre del negocio" />

              <Text style={styles.fieldLabel}>Categoria</Text>
              <TextInput style={styles.input} value={settingsCategory} onChangeText={setSettingsCategory} placeholder="Categoria" />

              <Text style={styles.fieldLabel}>Zona horaria (lista sugerida)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
                {defaultTimezones.map((tz) => (
                  <Pressable
                    key={tz}
                    style={[styles.chip, settingsTimezone === tz && styles.chipActive]}
                    onPress={() => setSettingsTimezone(tz)}
                  >
                    <Text style={[styles.chipText, settingsTimezone === tz && styles.chipTextActive]}>{tz}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                style={styles.input}
                value={settingsTimezone}
                onChangeText={setSettingsTimezone}
                placeholder="Zona horaria (e.g. Asia/Tokyo)"
              />

              <Text style={styles.fieldLabel}>Telefono (elige codigo y completa)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
                {phoneCodes.map((code) => (
                  <Pressable
                    key={code}
                    style={[styles.chip, settingsPhone?.startsWith(code) && styles.chipActive]}
                    onPress={() => setSettingsPhone(code)}
                  >
                    <Text style={[styles.chipText, settingsPhone?.startsWith(code) && styles.chipTextActive]}>{code}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput style={styles.input} value={settingsPhone} onChangeText={setSettingsPhone} placeholder="Telefono con codigo" keyboardType="phone-pad" />

              <Text style={styles.fieldLabel}>Pais (Asia)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
                {asiaCountries.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.chip, settingsCountry === c && styles.chipActive]}
                    onPress={() => setSettingsCountry(c)}
                  >
                    <Text style={[styles.chipText, settingsCountry === c && styles.chipTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput style={styles.input} value={settingsCountry} onChangeText={setSettingsCountry} placeholder="Pais" />

              <Text style={styles.fieldLabel}>Region/Estado</Text>
              <TextInput style={styles.input} value={settingsRegion} onChangeText={setSettingsRegion} placeholder="Region/Estado" />

              <Text style={styles.fieldLabel}>Horario de atencion</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={settingsAvailabilityStart}
                  onChangeText={setSettingsAvailabilityStart}
                  placeholder="HH:MM inicio"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={settingsAvailabilityEnd}
                  onChangeText={setSettingsAvailabilityEnd}
                  placeholder="HH:MM fin"
                />
              </View>
<Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                onPress={saveSettings}
                disabled={isSavingSettings}
              >
                <Text style={styles.primaryButtonText}>
                  {isSavingSettings ? "Guardando..." : "Guardar cambios"}
                </Text>
              </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (!token) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <LinearGradient colors={["#0da2ff", "#0c5be9"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.fullBackground}>
            <SafeAreaView style={styles.safeLogin}>
              <StatusBar style="light" />
              <ScrollView contentContainerStyle={styles.loginFull}>
                <View style={styles.loginWaveTop} />
                <View style={styles.loginWaveBottom} />
                <View style={styles.loginCardMock}>
                  <View style={styles.loginLogo}>
                    <Image source={mainLogo} style={styles.loginMainLogo} />
                  </View>
                  <Text style={styles.loginTitleCenter}>Schedly</Text>
                  <Text style={styles.loginSubtitleCenter}>Agenda tus Citas</Text>
                  <View style={styles.formGap}>
                  <View style={styles.inputPillWhite}>
                    <TextInput
                      placeholder="User Name"
                      placeholderTextColor="#1d4ed8"
                      style={styles.inputPillFieldWhite}
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                    <Text style={styles.inputPillIconBlue}>??</Text>
                  </View>
                  <View style={styles.inputPillWhite}>
                    <TextInput
                      placeholder="Password"
                      placeholderTextColor="#1d4ed8"
                      style={[styles.inputPillFieldWhite, { flex: 1 }]}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <Pressable
                      style={styles.passwordToggleButton}
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      <Image
                        source={showPassword ? hideIcon : showIcon}
                        style={styles.passwordToggleIcon}
                      />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.loginHelpers}>
                  <Pressable style={styles.rememberRow} onPress={() => setRememberMe((v) => !v)}>
                    <View style={[styles.rememberBox, rememberMe && styles.rememberBoxOn, { borderColor: "#1d4ed8" }]}>
                      {rememberMe && <Text style={styles.rememberCheck}>✓</Text>}
                    </View>
                    <Text style={[styles.loginHint, { color: "#FFFFFF" }]}>Remember Password</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowForgotForm((v) => !v)}>
                    <Text style={[styles.loginLink, { color: "#FFFFFF" }]}>Forget Password?</Text>
                  </Pressable>
                </View>
                {showForgotForm && (
                  <View style={styles.forgotCard}>
                    <Text style={styles.fieldLabel}>Correo de recuperacion</Text>
                    <TextInput
                      placeholder="tuemail@ejemplo.com"
                      placeholderTextColor="#9ca3af"
                      style={styles.input}
                      autoCapitalize="none"
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                    />
                    <Pressable
                      style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}
                      onPress={handleForgotPassword}
                      disabled={isSendingForgot}
                    >
                      <Text style={styles.loginButtonText}>{isSendingForgot ? "Enviando..." : "Enviar enlace"}</Text>
                    </Pressable>
                  </View>
                )}
                  <Pressable
                    style={({ pressed }) => [styles.loginCta, pressed && styles.pressed]}
                    onPress={() => {
                      // Ensure registration flow only happens from the "Crear" button in the register sheet.
                      setShowRegisterSheet(false);
                      handleLogin(accessKind);
                    }}
                    disabled={isAuthLoading}
                  >
                    <Text style={styles.loginCtaText}>{isAuthLoading ? "Starting..." : "Sign in"}</Text>
                  </Pressable>
                  <View style={[styles.tabRow, { marginTop: 6 }]}>
                    {(["client", "business"] as UserKind[]).map((kind) => (
                      <Pressable
                        key={kind}
                        style={[
                          styles.tabButton,
                          kind === "client" ? styles.tabClient : styles.tabBusiness,
                          accessKind === kind && styles.tabButtonActive,
                          accessKind === kind && (kind === "client" ? styles.tabClientActive : styles.tabBusinessActive),
                        ]}
                        onPress={() => setAccessKind(kind)}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            kind === "client" ? styles.tabClientText : styles.tabBusinessText,
                            accessKind === kind && styles.tabTextActive,
                          ]}
                        >
                          {kind === "client" ? "Cliente" : "Empresa"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={[styles.loginHint, { textAlign: "center", color: "#1d4ed8", marginTop: 160 }]}>Sign in with Social Media</Text>
                  <View style={styles.socialRowCircle}>
                    {socialProviders.map((s) => (
                      <Pressable
                        key={s.key}
                        style={[styles.socialCircle, { borderColor: s.color }]}
                        onPress={() => handleSocialLogin(s.key)}
                      >
                        <Text style={[styles.socialCircleText, { color: s.color }]}>{s.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                <Pressable
                  style={{ marginTop: 10 }}
                  onPress={() => {
                    setRegName("");
                    setRegEmail(email);
                    setRegPassword(password);
                    setRegCountry("");
                    try {
                      setRegTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
                    } catch {
                      setRegTimezone("UTC");
                    }
                    setShowRegisterSheet(true);
                  }}
                >
                  <Text style={[styles.loginLink, { color: "#0d6efd" }]}>
                    No tienes cuenta? Crea una
                  </Text>
                </Pressable>
                </View>
              </ScrollView>
            </SafeAreaView>
          </LinearGradient>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.container}>
          <View style={{ gap: 16 }}>
                <View style={styles.brandRow}>
                  <View style={styles.brandTitleRow}>
                    <Image source={mainLogo} style={styles.brandTitleLogo} />
                    <Text style={styles.brandTitle}>Schedly</Text>
                  </View>
                  <Text style={styles.brandSubtitle}>Agenda segura y separada por negocio</Text>
                </View>
                {token && isClient && (
                  <View style={[styles.card, showMenu ? styles.cardMenuOpen : null]}>
                <View style={styles.profileRow}>
                  <Pressable style={styles.avatar} onPress={openProfile}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{initialsFromName(user?.email)}</Text>
                    )}
                  </Pressable>
                <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.title}>{displayProfileName}</Text>
                </View>
                  <View style={styles.topRightButtons}>
                    <Pressable
                      style={styles.menuButton}
                      onPress={openNotifications}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Notificaciones"
                    >
                      <Ionicons name="notifications-outline" size={18} color={palette.accent} />
                      {unreadCount > 0 && (
                        <View style={styles.badgeDot}>
                          <Text style={styles.badgeDotText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text>
                        </View>
                      )}
                    </Pressable>
                    <View style={styles.menuAnchor}>
                      <Pressable style={styles.menuButton} onPress={() => setShowMenu((v) => !v)}>
                        <Ionicons name="settings-outline" size={18} color={palette.accent} />
                      </Pressable>
                    {showMenu && (
                      <View style={styles.menu}>
                        <Pressable
                          style={styles.menuItem}
                          onPress={() => {
                            setShowMenu(false);
                            openProfile();
                          }}
                        >
                          <View style={styles.menuItemRow}>
                            <Ionicons name="person-outline" size={16} color={palette.text} />
                            <Text style={styles.menuText}>Perfil</Text>
                          </View>
                        </Pressable>
                        <Pressable
                          style={styles.menuItem}
                          onPress={() => {
                            setShowMenu(false);
                            openClientSettings();
                          }}
                        >
                          <View style={styles.menuItemRow}>
                            <Ionicons name="settings-outline" size={16} color={palette.text} />
                            <Text style={styles.menuText}>Configuraciones</Text>
                          </View>
                        </Pressable>
                        <Pressable
                          style={styles.menuItem}
                          onPress={() => {
                            setShowMenu(false);
                            setLegalModal("terms");
                          }}
                        >
                          <View style={styles.menuItemRow}>
                            <Ionicons name="document-text-outline" size={16} color={palette.text} />
                            <Text style={styles.menuText}>Términos</Text>
                          </View>
                        </Pressable>
                        <Pressable
                          style={styles.menuItem}
                          onPress={() => {
                            setShowMenu(false);
                            setLegalModal("privacy");
                          }}
                        >
                          <View style={styles.menuItemRow}>
                            <Ionicons name="shield-checkmark-outline" size={16} color={palette.text} />
                            <Text style={styles.menuText}>Privacidad</Text>
                          </View>
                        </Pressable>
                        <Pressable
                          style={styles.menuItem}
                          onPress={() => {
                            setShowMenu(false);
                            logout();
                          }}
                        >
                          <Text style={styles.menuText}>Logout</Text>
                        </Pressable>
                      </View>
                    )}
                    </View>
                  </View>
                </View>
                <View style={styles.tabRow}>
                  {(["home", "agenda"] as const).map((tab) => (
                    <Pressable
                      key={tab}
                      style={[
                        styles.tabButton,
                        styles.tabClient,
                        clientTab === tab && [styles.tabButtonActive, styles.tabClientActive],
                      ]}
                      onPress={() => setClientTab(tab)}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {tab === "home" && (
                          <View style={styles.homeIcon}>
                            <Ionicons name="home-outline" size={16} color="#fff" />
                          </View>
                        )}
                        <Text
                          style={[
                            styles.tabText,
                            styles.tabClientText,
                            clientTab === tab && styles.tabTextActive,
                          ]}
                        >
                          {tab === "home" ? "Home" : "Mi agenda"}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {isClient && (
              <>
                {clientTab === "home" && (
                  <>
                    <View style={styles.card}>
                      <Section title="Buscar negocios">
                        <TextInput
                          style={styles.input}
                          value={searchTerm}
                          onChangeText={setSearchTerm}
                          placeholder="Busca por nombre de empresa o tipo de servicio"
                        />
                      </Section>
                    </View>

                    <View style={styles.card}>
                      <Section title="Destacados">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll} contentContainerStyle={{ gap: 12 }}>
                          {filteredBusinesses.slice(0, 5).map((b) => (
                            <Pressable
                              key={b.id}
                              style={styles.highlightCard}
                              onPress={() => {
                                setSelectedBusiness(b.id);
                                setSelectedDate(isoToday());
                                setBookingSelectedStartAt(null);
                                setBookingNote("");
                                setShowBookingModal(true);
                                if (b.timezone) setSelectedTimezone(b.timezone);
                              }}
                            >
                              <Text style={styles.highlightTitle}>{b.name}</Text>
                              <Text style={styles.subtitle}>{b.category || "Sin categoría"}</Text>
                              <Text style={styles.hint}>{b.timezone || "Zona horaria no definida"}</Text>
                            </Pressable>
                          ))}
                          {!filteredBusinesses.length && <Text style={styles.label}>Aún sin negocios destacados.</Text>}
                        </ScrollView>
                      </Section>
                    </View>

                    <View style={styles.card}>
                      <Section title="Explorar negocios">
                        <View style={styles.gridCards}>
                          {filteredBusinesses.map((b) => (
                            <Pressable
                              key={b.id}
                              style={styles.squareCard}
                              onPress={() => {
                                setSelectedBusiness(b.id);
                                setSelectedDate(isoToday());
                                setBookingSelectedStartAt(null);
                                setBookingNote("");
                                setShowBookingModal(true);
                                if (b.timezone) setSelectedTimezone(b.timezone);
                              }}
                            >
                              <Text style={styles.highlightTitle}>{b.name}</Text>
                              <Text style={styles.subtitle}>{b.category || "Sin categoría"}</Text>
                              <Text style={styles.hint} numberOfLines={1}>
                                {b.timezone || "Zona horaria"}
                              </Text>
                            </Pressable>
                          ))}
                          {!filteredBusinesses.length && <Text style={styles.label}>No se encontraron negocios.</Text>}
                        </View>
                      </Section>
                    </View>
                  </>
                )}

                {clientTab === "agenda" && (
                  <View style={styles.card}>
                    <Section title="Mi agenda">
                      <View style={styles.rowBetween}>
                        
                        <Pressable
                          style={[styles.button, { paddingVertical: 8, paddingHorizontal: 10 }]}
                          onPress={() => syncDeviceCalendar(false)}
                          disabled={isSyncingCalendar}
                        >
                          <Text style={styles.buttonText}>{isSyncingCalendar ? "Sincronizando..." : "Sincronizar"}</Text>
                        </Pressable>
                      </View>
                      <View style={[styles.row, { marginTop: 10 }]}>
                        {(
                          [
                            { key: "all", label: "Todas" },
                            { key: "high", label: "Alta" },
                            { key: "medium", label: "Media" },
                            { key: "low", label: "Baja" },
                          ] as const
                        ).map((opt) => {
                          const active = urgencyFilter === opt.key;
                          const tone =
                            opt.key === "high"
                              ? importanceColors.high
                              : opt.key === "medium"
                                ? importanceColors.medium
                                : opt.key === "low"
                                  ? importanceColors.low
                                  : palette.accent;
                          return (
                            <Pressable
                              key={opt.key}
                              style={[
                                styles.chip,
                                active && { backgroundColor: tone, borderColor: tone },
                              ]}
                              onPress={() => setUrgencyFilter(opt.key)}
                            >
                              <Text style={[styles.chipText, active && { color: "#fff", fontWeight: "800" }]}>{opt.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {isAppointmentsLoading && <ActivityIndicator color={palette.accent} />}
                      <ScrollView
                        style={styles.agendaListScroll}
                        contentContainerStyle={{ gap: 10, paddingBottom: 6 }}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                      >
                        {filteredSchedule.map((item) => {
                          const tone =
                            item.kind === "manual"
                              ? importanceColors[(item.importance as Importance) || "medium"]
                              : statusColor(item.status);
                          const importanceLabel = importanceLabels[(item.importance as Importance) || "medium"];
                          const isCustomReminder = item.source === "custom";
                          const isAppointment = item.source === "appointment";
                          const card = (
                            <Pressable
                              style={({ pressed }) => [
                                styles.sessionRow,
                                { borderLeftWidth: 6, borderLeftColor: tone },
                                pressed && styles.pressed,
                              ]}
                              onPress={() => openAgendaPreview(item.source as ScheduleSource, item.id)}
                              onLongPress={() => isCustomReminder && handleSelectScheduleItem(item.id, "manual")}
                            >
                              <View style={{ flex: 1, gap: 4 }}>
                                <View style={styles.rowBetween}>
                                  <Text style={styles.highlightTitle}>{item.title}</Text>
                                  <View style={[styles.importanceDot, { backgroundColor: tone }]} />
                                </View>
                                <Text style={styles.subtitle}>
                                  {item.subtitle || (item.kind === "cita" ? "Cita" : "Actividad")}
                                </Text>
                                <Text style={styles.hint}>{formatDateTime(item.startAt, currentZone)}</Text>
                              </View>
                              <View style={{ alignItems: "flex-end", gap: 6 }}>
                                {item.kind === "manual" && (
                                  <View style={[styles.tag, { borderColor: tone, backgroundColor: `${tone}22` }]}>
                                    <Text style={[styles.tagText, { color: tone }]}>{importanceLabel}</Text>
                                  </View>
                                )}
                                <View style={[styles.tag, { borderColor: statusColor(item.status) }]}>
                                  <Text style={[styles.tagText, { color: statusColor(item.status) }]}>
                                    {prettyStatus(item.status)}
                                  </Text>
                                </View>
                              </View>
                            </Pressable>
                          );
                          return (
                            <View key={item.id} style={styles.swipeRow}>
                              {isCustomReminder || isAppointment ? (
                                <Swipeable
                                  renderRightActions={() => (
                                    isAppointment ? (
                                      <Pressable
                                        style={({ pressed }) => [styles.swipeCancel, pressed && styles.pressed]}
                                        onPress={() => confirmCancelAgendaAppointment(item.id)}
                                      >
                                        <Ionicons name="close-circle-outline" size={22} color="#fff" />
                                        <Text style={styles.swipeDeleteText}>Cancelar</Text>
                                      </Pressable>
                                    ) : (
                                      <Pressable
                                        style={({ pressed }) => [styles.swipeDelete, pressed && styles.pressed]}
                                        onPress={() => confirmDeleteCustomReminder(item.id)}
                                      >
                                        <Ionicons name="trash-outline" size={22} color="#fff" />
                                        <Text style={styles.swipeDeleteText}>Eliminar</Text>
                                      </Pressable>
                                    )
                                  )}
                                  rightThreshold={12}
                                  friction={2}
                                  dragOffsetFromRightEdge={20}
                                  overshootRight={false}
                                >
                                  {card}
                                </Swipeable>
                              ) : (
                                card
                              )}
                            </View>
                          );
                        })}
                        {!filteredSchedule.length && !isAppointmentsLoading && (
                          <Text style={styles.label}>Sin actividades ni citas agendadas.</Text>
                        )}
                      </ScrollView>
                    </Section>
                  </View>
                )}
              </>
            )}

            {isBusiness && (
              <View style={[styles.card, showMenu ? styles.cardMenuOpen : null]}>
                {myBusinesses.length === 0 ? (
                  <Section title="Configurar negocio">
                    <Text style={styles.label}>Crea tu negocio para ofrecer servicios a los clientes.</Text>
                    <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="Nombre del negocio" />
                    <TextInput style={styles.input} value={businessCategory} onChangeText={setBusinessCategory} placeholder="Categoría" />
                    <TextInput style={styles.input} value={businessPhone} onChangeText={setBusinessPhone} placeholder="Teléfono (opcional)" />
                    <TextInput style={styles.input} value={businessAddress} onChangeText={setBusinessAddress} placeholder="Dirección (opcional)" />
                    <Pressable
                      style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                      onPress={createBusinessProfile}
                      disabled={isCreatingBusiness}
                    >
                      <Text style={styles.primaryButtonText}>{isCreatingBusiness ? "Creando..." : "Crear negocio"}</Text>
                    </Pressable>
                  </Section>
                ) : (
                  <>
                    <View style={styles.profileRow}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initialsFromName(selectedBusinessData?.name)}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.title}>{selectedBusinessData?.name || "Negocio"}</Text>
                        <Text style={styles.subtitle}>{selectedBusinessData?.category || "Categoria"}</Text>
                        <Text style={styles.hint}>{selectedBusinessData?.timezone || "Zona horaria"}</Text>
                      </View>
                      <View style={styles.menuAnchor}>
                        <Pressable style={styles.menuButton} onPress={() => setShowMenu((v) => !v)}>
                          <Text style={styles.menuButtonText}>?</Text>
                        </Pressable>
                        {showMenu && (
                          <View style={styles.menu}>
                            <Pressable
                              style={styles.menuItem}
                              onPress={() => {
                                setShowMenu(false);
                                Alert.alert("Publicidad", "Opción de anuncios se activará en la versión web.");
                              }}
                            >
                              <Text style={styles.menuText}>Publicidad</Text>
                            </Pressable>
                            <Pressable
                              style={styles.menuItem}
                              onPress={() => {
                                setShowMenu(false);
                                setSettingsName(selectedBusinessData?.name || "");
                                setSettingsCategory(selectedBusinessData?.category || "");
                                setSettingsTimezone(selectedBusinessData?.timezone || "UTC");
                                setSettingsPhone(selectedBusinessData?.phone || "");
                                setSettingsCountry(selectedBusinessData?.country || "");
                                setSettingsRegion(selectedBusinessData?.region || "");
                                setSettingsAvailabilityStart(availabilityStart);
                                setSettingsAvailabilityEnd(availabilityEnd);
                                setShowSettingsForm(true);
                              }}
                            >
                              <Text style={styles.menuText}>Configuraciones</Text>
                            </Pressable>
                            <Pressable
                              style={styles.menuItem}
                              onPress={() => {
                                setShowMenu(false);
                                logout();
                              }}
                            >
                              <Text style={styles.menuText}>Logout</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </View>

                    <Section title="Mis negocios">
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
                        {myBusinesses.map((b) => (
                          <Pressable
                            key={b.id}
                            style={[styles.chip, selectedBusiness === b.id && styles.chipActive]}
                            onPress={() => {
                              setSelectedBusiness(b.id);
                              if (b.timezone) setSelectedTimezone(b.timezone);
                              fetchAppointments(b.id);
                            }}
                          >
                            <Text style={[styles.chipText, selectedBusiness === b.id && styles.chipTextActive]}>{b.name}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </Section>

                    <Section title="Servicios predefinidos">
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
                        {serviceTemplates.map((tpl) => (
                          <Pressable
                            key={tpl.name + tpl.durationMin}
                            style={[styles.chip, styles.chipTemplate]}
                            onPress={() => addTemplateService(tpl)}
                          >
                            <Text style={styles.chipText}>{tpl.name} · {tpl.durationMin}m</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </Section>

                    <Section title="Mis servicios">
                      <Pressable
                        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                        onPress={() => setShowServiceForm((v) => !v)}
                      >
                        <Text style={styles.primaryButtonText}>{showServiceForm ? "Cerrar" : "Crear servicio"}</Text>
                      </Pressable>
                      {showServiceForm && (
                        <View style={{ gap: 8, marginTop: 8 }}>
                          <TextInput
                            style={styles.input}
                            value={serviceName}
                            onChangeText={setServiceName}
                            placeholder="Nombre del servicio"
                          />
                          <Text style={styles.hint}>Se creará con duración de 30 min y precio 0 por ahora.</Text>
                          <Pressable
                            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                            onPress={createService}
                            disabled={isSavingService}
                          >
                            <Text style={styles.primaryButtonText}>{isSavingService ? "Creando..." : "Guardar"}</Text>
                          </Pressable>
                        </View>
                      )}
                    </Section>

                    <View style={styles.metricsRow}>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Citas hoy</Text>
                        <Text style={styles.metricValue}>{businessStats.today}</Text>
                        <Text style={styles.metricHint}>Agendadas en la fecha actual</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Pendientes</Text>
                        <Text style={styles.metricValue}>{businessStats.pending}</Text>
                        <Text style={styles.metricHint}>Incluye no canceladas</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>Próximas</Text>
                        <Text style={styles.metricValue}>{businessStats.upcoming}</Text>
                        <Text style={styles.metricHint}>Ordenadas por hora</Text>
                      </View>
                    </View>

                    {businessStats.nextStart && (
                      <View style={styles.nextCard}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.sectionTitle}>Siguiente cita</Text>
                          <Text style={styles.nextTime}>{formatTime(businessStats.nextStart, currentZone)}</Text>
                        </View>
                        <Text style={styles.nextDetail}>{businessStats.nextService || "Servicio"}</Text>
                        <Text style={styles.nextSubdetail}>{formatDateTime(businessStats.nextStart, currentZone)}</Text>
                      </View>
                    )}

                    <View style={styles.actionsRow}>
                      <Pressable
                        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                        onPress={() => setShowAvailabilityForm((v) => !v)}
                      >
                        <Text style={styles.actionText}>Publicar disponibilidad</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                        onPress={() => setShowServiceForm((v) => !v)}
                      >
                        <Text style={styles.actionText}>Crear servicio</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                        onPress={() => fetchAppointments(activeBusinessId || undefined)}
                      >
                        <Text style={styles.actionText}>Ver agenda completa</Text>
                      </Pressable>
                    </View>

                    {showAvailabilityForm && (
                      <Section title="Publicar disponibilidad">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
                          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                            <Pressable
                              key={d}
                              style={[styles.chip, availabilityDay === d && styles.chipActive]}
                              onPress={() => setAvailabilityDay(d)}
                            >
                              <Text style={[styles.chipText, availabilityDay === d && styles.chipTextActive]}>
                                {["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"][d]}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                        <View style={styles.row}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={availabilityStart}
                            onChangeText={setAvailabilityStart}
                            placeholder="HH:MM inicio"
                          />
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={availabilityEnd}
                            onChangeText={setAvailabilityEnd}
                            placeholder="HH:MM fin"
                          />
                        </View>
                        <Pressable
                          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                          onPress={publishAvailability}
                          disabled={isSavingAvailability}
                        >
                          <Text style={styles.primaryButtonText}>
                            {isSavingAvailability ? "Publicando..." : "Publicar"}
                          </Text>
                        </Pressable>
                      </Section>
                    )}

                    <Section title="Agenda">
                      <View style={[styles.rowBetween, { gap: 8, flexWrap: "wrap" }]}>
                        <Text style={styles.label}>Citas y eventos del dispositivo</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable
                            style={[styles.button, { paddingVertical: 8, paddingHorizontal: 10 }]}
                            onPress={() => syncDeviceCalendar(false)}
                            disabled={isSyncingCalendar}
                          >
                            <Text style={styles.buttonText}>{isSyncingCalendar ? "Sincronizando..." : "Sincronizar"}</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.button, { paddingVertical: 8, paddingHorizontal: 10 }]}
                            onPress={() => fetchAppointments(activeBusinessId || undefined)}
                          >
                            <Text style={styles.buttonText}>Refrescar</Text>
                          </Pressable>
                        </View>
                      </View>
                      <Text style={styles.hint}>Pediremos permiso de calendario para leer eventos locales.</Text>

                      {isAppointmentsLoading && <ActivityIndicator color={palette.accent} />}
                      {appointments.map((a) => (
                        <View key={a.id} style={styles.appointmentRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.slotText}>{formatDateTime(a.startAt, currentZone)}</Text>
                            <Text style={styles.label}>{a.service?.name}</Text>
                          </View>
                          <View style={[styles.tag, { borderColor: statusColor(a.status) }]}>
                            <Text style={[styles.tagText, { color: statusColor(a.status) }]}>{prettyStatus(a.status)}</Text>
                          </View>
                          <Pressable onPress={() => cancelAppointment(a.id)} style={{ marginLeft: 8 }}>
                            <Text style={styles.linkText}>Cancelar</Text>
                          </Pressable>
                        </View>
                      ))}
                      {!appointments.length && !isAppointmentsLoading && <Text style={styles.label}>Sin citas cargadas.</Text>}

                      {!!deviceEvents.length && (
                        <View style={{ marginTop: 8, gap: 8 }}>
                          <Text style={styles.label}>Eventos del calendario del dispositivo</Text>
                          {deviceEvents.map((ev) => (
                            <View key={ev.id} style={styles.appointmentRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.slotText}>{formatDateTime(ev.startAt, currentZone)}</Text>
                                <Text style={styles.label}>{ev.title}</Text>
                              </View>
                              <View style={[styles.tag, { borderColor: statusColor("CALENDARIO") }]}>
                                <Text style={[styles.tagText, { color: statusColor("CALENDARIO") }]}>Calendario</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </Section>
                  </>
                )}
              </View>
            )}

            <Text style={styles.footer}>© By KazehanaCloud</Text>
          </View>
        </ScrollView>
        {token && isClient && clientTab === "agenda" && (
          <Pressable style={({ pressed }) => [styles.fab, pressed && styles.pressed]} onPress={openNewActivityForm}>
            <Text style={styles.fabText}>+</Text>
          </Pressable>
        )}
        <Modal
          visible={showBookingModal}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowBookingModal(false)}
          presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
        >
          <View style={styles.modalOverlayFlex}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowBookingModal(false)} />
            <View style={[styles.modalCard, { maxWidth: 420 }]}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Nueva cita</Text>
                <Pressable style={styles.modalClose} onPress={() => setShowBookingModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={palette.muted} />
                </Pressable>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={styles.label}>{businesses.find((b) => b.id === selectedBusiness)?.name || "Negocio"}</Text>
                <Text style={styles.hint}>Elige servicio, fecha y horario para enviar tu solicitud.</Text>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={styles.fieldLabel}>Servicio</Text>
                {isServicesLoading ? (
                  <ActivityIndicator color={palette.accent} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {services.map((s) => {
                      const active = selectedService === s.id;
                      return (
                        <Pressable
                          key={s.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setSelectedService(s.id)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.name}</Text>
                        </Pressable>
                      );
                    })}
                    {!services.length && <Text style={styles.label}>Sin servicios disponibles.</Text>}
                  </ScrollView>
                )}
              </View>

              <View style={{ gap: 8 }}>
                <Text style={styles.fieldLabel}>Fecha</Text>
                <Pressable
                  style={[styles.input, { justifyContent: "center" }]}
                  onPress={() => {
                    const parsed = DateTime.fromISO(selectedDate);
                    setBookingPickerMonth((parsed.isValid ? parsed : DateTime.now()).startOf("month"));
                    setShowBookingDatePicker(true);
                  }}
                >
                  <Text style={styles.label}>{selectedDate}</Text>
                </Pressable>
              </View>

              <View style={{ gap: 8 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.fieldLabel}>Horarios</Text>
                  {isSlotsLoading && <ActivityIndicator color={palette.accent} />}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 2 }}>
                  {slots.map((sl) => {
                    const active = bookingSelectedStartAt === sl.startAt;
                    const label = formatTime(sl.startAt, currentZone);
                    return (
                      <Pressable
                        key={sl.startAt}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setBookingSelectedStartAt(sl.startAt)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                  {!slots.length && !isSlotsLoading && <Text style={styles.label}>No hay horarios disponibles para esta fecha.</Text>}
                </ScrollView>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={styles.fieldLabel}>Nota (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={bookingNote}
                  onChangeText={setBookingNote}
                  placeholder="Ej. Llegaré 5 minutos tarde"
                />
              </View>

              <View style={styles.row}>
                <Pressable style={[styles.secondaryButtonFull, { flex: 1 }]} onPress={() => setShowBookingModal(false)}>
                  <Text style={styles.buttonText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, { flex: 1 }, (!bookingSelectedStartAt || !selectedService || isCreatingAppointment) && styles.buttonDisabled]}
                  onPress={createAppointment}
                  disabled={!bookingSelectedStartAt || !selectedService || isCreatingAppointment}
                >
                  <Text style={styles.primaryButtonText}>{isCreatingAppointment ? "Enviando..." : "Enviar solicitud"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        <DatePickerModal
          visible={showDatePicker}
          month={pickerMonth}
          onClose={() => setShowDatePicker(false)}
          onPrev={() => setPickerMonth((m) => m.minus({ months: 1 }))}
          onNext={() => setPickerMonth((m) => m.plus({ months: 1 }))}
          days={monthDays}
          onSelect={(iso) => {
            setNewActivityDate(iso);
            setShowDatePicker(false);
          }}
          selectedIso={newActivityDate}
          disabledIso={(iso) => isDateSaturated(iso)}
        />
        <DatePickerModal
          visible={showBookingDatePicker}
          month={bookingPickerMonth}
          onClose={() => setShowBookingDatePicker(false)}
          onPrev={() => setBookingPickerMonth((m) => m.minus({ months: 1 }))}
          onNext={() => setBookingPickerMonth((m) => m.plus({ months: 1 }))}
          days={bookingMonthDays}
          onSelect={(iso) => {
            setSelectedDate(iso);
            setShowBookingDatePicker(false);
          }}
          selectedIso={selectedDate}
          disabledIso={(iso) => isDateSaturated(iso)}
        />
        {showNewActivityForm && (
          <View style={styles.sheetOverlay}>
            <Pressable style={styles.sheetBackdrop} onPress={handleCloseActivityForm} />
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
              style={styles.sheetCard}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{editingActivityId ? "Editar cita" : "Nueva cita"}</Text>
                <Pressable onPress={handleCloseActivityForm} hitSlop={10}>
                  <Ionicons name="close" size={20} color={palette.muted} />
                </Pressable>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
              >
                <Text style={styles.fieldLabel}>Título</Text>
                <TextInput
                  style={styles.input}
                  value={newActivityTitle}
                  onChangeText={setNewActivityTitle}
                  placeholder="Nombre de la cita/recordatorio"
                />

                <Text style={styles.fieldLabel}>Fecha</Text>
                <Pressable
                  style={[styles.input, { justifyContent: "center" }]}
                  onPress={() => {
                    const parsed = DateTime.fromISO(newActivityDate);
                    setPickerMonth((parsed.isValid ? parsed : DateTime.now()).startOf("month"));
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={styles.label}>{newActivityDate}</Text>
                </Pressable>

                <Text style={styles.fieldLabel}>Hora</Text>
                <TextInput style={styles.input} value={newActivityTime} onChangeText={setNewActivityTime} placeholder="HH:MM" />
                {selectedTimeOccupied && (
                  <Text style={styles.errorText}>Esa hora ya está ocupada en tu agenda. Elige otra.</Text>
                )}

                <Text style={styles.fieldLabel}>Nota</Text>
                <TextInput
                  style={styles.input}
                  value={newActivityNote}
                  onChangeText={setNewActivityNote}
                  placeholder="Recordatorio breve"
                />

                <Text style={styles.fieldLabel}>Urgencia</Text>
                <View style={styles.row}>
                  {(["high", "medium", "low"] as Importance[]).map((level) => (
                    <Pressable
                      key={level}
                      style={[
                        styles.chip,
                        newActivityImportance === level && {
                          backgroundColor: importanceColors[level],
                          borderColor: importanceColors[level],
                        },
                      ]}
                      onPress={() => setNewActivityImportance(level)}
                    >
                      <Text style={[styles.chipText, newActivityImportance === level && { color: "#fff", fontWeight: "800" }]}>
                        {importanceLabels[level]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.row}>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryButtonFull, pressed && styles.pressed, { flex: 1 }]}
                    onPress={handleCloseActivityForm}
                  >
                    <Text style={styles.buttonText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, { flex: 1 }]}
                    onPress={saveActivity}
                    disabled={selectedTimeOccupied}
                  >
                    <Text style={styles.primaryButtonText}>{editingActivityId ? "Actualizar" : "Guardar"}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        )}
        {showRegisterSheet && (
          <View style={styles.sheetOverlay}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setShowRegisterSheet(false)} />
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
              style={styles.sheetCard}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Crear cuenta</Text>
                <Pressable onPress={() => setShowRegisterSheet(false)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={palette.muted} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
                <Text style={styles.fieldLabel}>Usuario</Text>
                <TextInput
                  style={styles.input}
                  value={regName}
                  onChangeText={setRegName}
                  placeholder="Tu nombre"
                />

                <Text style={styles.fieldLabel}>Correo</Text>
                <TextInput
                  style={styles.input}
                  value={regEmail}
                  onChangeText={setRegEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="correo@ejemplo.com"
                />

                <Text style={styles.fieldLabel}>Contraseña</Text>
                <TextInput
                  style={styles.input}
                  value={regPassword}
                  onChangeText={setRegPassword}
                  secureTextEntry
                  placeholder="Crea una contraseña"
                />

                <Text style={styles.fieldLabel}>País</Text>
                <TextInput
                  style={styles.input}
                  value={regCountry}
                  onChangeText={setRegCountry}
                  placeholder="Tu país"
                />

                <Text style={styles.fieldLabel}>Zona horaria</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>{regTimezone || "UTC"}</Text>
                  <Pressable
                    style={[styles.button, { paddingVertical: 8, paddingHorizontal: 10 }]}
                    onPress={detectRegionFromDevice}
                    disabled={isRegDetecting}
                  >
                    <Text style={styles.buttonText}>{isRegDetecting ? "Detectando..." : "Usar dispositivo"}</Text>
                  </Pressable>
                </View>

                <View style={styles.row}>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryButtonFull, pressed && styles.pressed, { flex: 1 }]}
                    onPress={() => setShowRegisterSheet(false)}
                    disabled={isRegSubmitting}
                  >
                    <Text style={styles.buttonText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, { flex: 1 }]}
                    onPress={() => handleRegisterFromForm(accessKind)}
                    disabled={isRegSubmitting}
                  >
                    <Text style={styles.primaryButtonText}>{isRegSubmitting ? "Creando..." : "Crear"}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        )}
        <Modal
          visible={showAvatarSheet}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAvatarSheet(false)}
          statusBarTranslucent
          presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
          hardwareAccelerated
          onShow={() => Keyboard.dismiss()}
        >
          <View style={styles.bottomSheetOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowAvatarSheet(false)} />
            <View style={styles.bottomSheet}>
              <Text style={styles.modalTitle}>Cambiar avatar</Text>
              <View style={styles.row}>
                <Pressable
                  style={[styles.actionButton, styles.sheetButton]}
                  onPress={async () => {
                    Keyboard.dismiss();
                    const perm = await ImagePicker.requestCameraPermissionsAsync();
                    if (!perm.granted) {
                      Alert.alert("Permiso requerido", "Activa la cámara para tomar una foto.");
                      return;
                    }
                    const res = await ImagePicker.launchCameraAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      quality: 0.7,
                      allowsEditing: true,
                      aspect: [1, 1],
                      base64: true,
                    });
                    if (!res.canceled) {
                      const asset = res.assets?.[0];
                      const base64 = asset?.base64;
                      const uri = asset?.uri;
                      const dataUri = base64 ? `data:image/jpeg;base64,${base64}` : uri;
                      if (dataUri) {
                        setAvatarUri(dataUri);
                        AsyncStorage.setItem(
                          STORAGE_PROFILE,
                          JSON.stringify({
                            name: profileName,
                            status: profileStatus,
                            avatarUri: dataUri,
                            notifyApp,
                            notifyEmail,
                            visibility,
                            email: newEmail,
                            phone: profilePhone,
                          }),
                        ).catch(() => undefined);
                        if (authHeaders) {
                          fetch(`${API_BASE_URL}/users/me`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", ...authHeaders },
                            body: JSON.stringify({ avatarUrl: dataUri }),
                          }).catch(() => undefined);
                        }
                      }
                      setShowAvatarSheet(false);
                    }
                  }}
                >
                  <Text style={styles.actionText}>Cámara</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.sheetButton]}
                  onPress={async () => {
                    Keyboard.dismiss();
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) {
                      Alert.alert("Permiso requerido", "Activa el permiso de fotos para cambiar tu avatar.");
                      return;
                    }
                    const res = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      quality: 0.7,
                      allowsEditing: true,
                      aspect: [1, 1],
                      base64: true,
                    });
                    if (!res.canceled) {
                      const asset = res.assets?.[0];
                      const base64 = asset?.base64;
                      const uri = asset?.uri;
                      const dataUri = base64 ? `data:image/jpeg;base64,${base64}` : uri;
                      if (dataUri) {
                        setAvatarUri(dataUri);
                        AsyncStorage.setItem(
                          STORAGE_PROFILE,
                          JSON.stringify({
                            name: profileName,
                            status: profileStatus,
                            avatarUri: dataUri,
                            notifyApp,
                            notifyEmail,
                            visibility,
                            email: newEmail,
                            phone: profilePhone,
                          }),
                        ).catch(() => undefined);
                        if (authHeaders) {
                          fetch(`${API_BASE_URL}/users/me`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", ...authHeaders },
                            body: JSON.stringify({ avatarUrl: dataUri }),
                          }).catch(() => undefined);
                        }
                      }
                      setShowAvatarSheet(false);
                    }
                  }}
                >
                  <Text style={styles.actionText}>Galería</Text>
                </Pressable>
              </View>
              <Pressable style={[styles.secondaryButtonFull, { marginTop: 8 }]} onPress={() => setShowAvatarSheet(false)}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        {showProfileModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Perfil</Text>
                <Pressable
                  style={styles.modalClose}
                  onPress={() => {
                    setIsProfileEditing(false);
                    setShowProfileModal(false);
                  }}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={20} color={palette.muted} />
                </Pressable>
              </View>

              <View style={{ alignItems: "center", gap: 12 }}>
                <View style={{ position: "relative" }}>
                  <View style={styles.avatarLarge}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImageLarge} />
                    ) : (
                      <Text style={styles.avatarText}>{initialsFromName(user?.email)}</Text>
                    )}
                  </View>
                  <Pressable style={styles.avatarEdit} onPress={pickAvatar} disabled={!isProfileEditing}>
                    <Text style={styles.avatarEditText}>?</Text>
                  </Pressable>
                </View>
                <Text style={styles.subtitle}>{profileStatus}</Text>
              </View>
              <Text style={styles.fieldLabel}>Nombre</Text>
              {!isProfileEditing ? (
                <View style={styles.readOnlyBox}>
                  <Text style={[styles.readOnlyText, !cleanOptionalText(profileName).trim() && styles.readOnlyPlaceholder]}>
                    {cleanOptionalText(profileName).trim() ? cleanOptionalText(profileName) : "Sin nombre"}
                  </Text>
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder="Nombre"
                  editable
                  returnKeyType="next"
                />
              )}
              <Text style={styles.fieldLabel}>Estado</Text>
              {!isProfileEditing ? (
                <View style={styles.readOnlyBox}>
                  <Text style={[styles.readOnlyText, !cleanOptionalText(profileStatus).trim() && styles.readOnlyPlaceholder]}>
                    {cleanOptionalText(profileStatus).trim() ? cleanOptionalText(profileStatus) : "Sin estado"}
                  </Text>
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={profileStatus}
                  onChangeText={setProfileStatus}
                  placeholder="Estado (opcional)"
                  editable
                  returnKeyType="next"
                />
              )}
              <Text style={styles.fieldLabel}>Correo electrónico</Text>
              {!isProfileEditing ? (
                <View style={styles.readOnlyBox}>
                  <Text style={[styles.readOnlyText, !newEmail.trim() && styles.readOnlyPlaceholder]}>
                    {newEmail.trim() ? newEmail : "Sin correo"}
                  </Text>
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Correo"
                  editable
                  returnKeyType="next"
                />
              )}
              <Text style={styles.fieldLabel}>Teléfono</Text>
              {!isProfileEditing ? (
                <View style={styles.readOnlyBox}>
                  <Text style={[styles.readOnlyText, !cleanOptionalText(profilePhone).trim() && styles.readOnlyPlaceholder]}>
                    {cleanOptionalText(profilePhone).trim() ? cleanOptionalText(profilePhone) : "Sin teléfono"}
                  </Text>
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={profilePhone}
                  onChangeText={setProfilePhone}
                  placeholder="Teléfono"
                  keyboardType={Platform.OS === "ios" ? "number-pad" : "phone-pad"}
                  editable
                  returnKeyType="done"
                />
              )}

              {isProfileEditing && (
                <>
                  <Text style={styles.fieldLabel}>Cambiar contraseña</Text>
                  <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Contraseña actual"
                    secureTextEntry
                  />
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Nueva contraseña (min 6, mayúscula y número)"
                    secureTextEntry
                  />
                  <View style={styles.strengthBar}>
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.strengthSegment,
                          passwordStrength(newPassword) > idx && { backgroundColor: palette.accent },
                        ]}
                      />
                    ))}
                  </View>
                </>
              )}

              <View style={styles.row}>
                {!isProfileEditing ? (
                  <Pressable style={[styles.primaryButton, { flex: 1 }]} onPress={() => setIsProfileEditing(true)}>
                    <Text style={styles.primaryButtonText}>Editar</Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      style={[styles.secondaryButtonFull, { flex: 1 }]}
                      onPress={() => {
                        if (profileSnapshot) {
                          setProfileName(profileSnapshot.name);
                          setProfileStatus(profileSnapshot.status);
                          setNewEmail(profileSnapshot.email);
                          setProfilePhone(profileSnapshot.phone);
                          setAvatarUri(profileSnapshot.avatarUri);
                        }
                        setCurrentPassword("");
                        setNewPassword("");
                        setIsProfileEditing(false);
                      }}
                    >
                      <Text style={styles.buttonText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.primaryButton, { flex: 1 }, (!isProfileDirty || isPersistingProfile) && styles.buttonDisabled]}
                      disabled={!isProfileDirty || isPersistingProfile}
                      onPress={async () => {
                        setIsPersistingProfile(true);
                        if (!newEmail.trim().length) {
                          Alert.alert("Error", "El correo electronico no puede quedar vacio.");
                          setIsPersistingProfile(false);
                          return;
                        }

                        // NOTE: send explicit null for blank optional fields so backend can clear them.
                        const payload = {
                          name: nullIfBlank(profileName),
                          status: nullIfBlank(profileStatus),
                          avatarUrl: avatarUri ?? null,
                          email: newEmail.trim(),
                          phone: nullIfBlank(profilePhone),
                          currentPassword: currentPassword.trim().length ? currentPassword : undefined,
                          newPassword: newPassword.trim().length ? newPassword : undefined,
                        };
                        // Persist what the user sees (including empty strings), independent of the PATCH payload.
                        AsyncStorage.setItem(
                          STORAGE_PROFILE,
                          JSON.stringify({
                            name: profileName,
                            status: profileStatus,
                            avatarUri,
                            email: newEmail,
                            phone: profilePhone,
                            notifyApp,
                            notifyEmail,
                            visibility,
                          }),
                        ).catch(() => Alert.alert("Aviso", "No se pudo guardar el perfil en disco."));
                        try {
                          if (!authHeaders) {
                            Alert.alert("Guardado local", "Tu perfil se guardo en este dispositivo. Inicia sesion para sincronizarlo.");
                            setIsProfileEditing(false);
                            setShowProfileModal(false);
                            return;
                          }
                          const res = await fetch(`${API_BASE_URL}/users/me`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", ...authHeaders },
                            body: JSON.stringify(payload),
                          });
                          if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
                          const data = (await res.json().catch(() => null)) as null | {
                            name?: string | null;
                            status?: string | null;
                            email?: string;
                            phone?: string | null;
                            avatarUrl?: string | null;
                          };
                          if (data) {
                            if (typeof data.name !== "undefined") setProfileName(data.name ?? "");
                            if (typeof data.status !== "undefined") setProfileStatus(data.status ?? "");
                            if (typeof data.email !== "undefined") setNewEmail(data.email ?? "");
                            if (typeof data.phone !== "undefined") setProfilePhone(data.phone ?? "");
                            if (typeof data.avatarUrl !== "undefined") setAvatarUri(data.avatarUrl ?? null);
                          }
                          Alert.alert("Guardado", "Perfil actualizado.");
                          setIsProfileEditing(false);
                          setShowProfileModal(false);
                        } catch (err: unknown) {
                          Alert.alert("Error", getErrorMessage(err, "No se pudo guardar el perfil."));
                        } finally {
                          setIsPersistingProfile(false);
                          setCurrentPassword("");
                          setNewPassword("");
                        }
                      }}
                    >
                      <Text style={styles.primaryButtonText}>{isPersistingProfile ? "Guardando..." : "Guardar"}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </View>
        )}
        {showClientSettingsModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={{ alignItems: "center", gap: 8 }}>
                <Ionicons name="settings-outline" size={22} color={palette.accent} />
                <Text style={styles.modalTitle}>Configuraciones</Text>
              </View>

              <Text style={styles.fieldLabel}>Notificaciones</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>En el celular</Text>
                <Pressable style={[styles.toggle, notifyApp && styles.toggleOn]} onPress={() => setNotifyApp((v) => !v)}>
                  <View style={[styles.toggleDot, notifyApp && styles.toggleDotOn]} />
                </Pressable>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Por correo electrónico</Text>
                <Pressable style={[styles.toggle, notifyEmail && styles.toggleOn]} onPress={() => setNotifyEmail((v) => !v)}>
                  <View style={[styles.toggleDot, notifyEmail && styles.toggleDotOn]} />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Privacidad</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Perfil visible para negocios</Text>
                <Pressable style={[styles.toggle, visibility && styles.toggleOn]} onPress={() => setVisibility((v) => !v)}>
                  <View style={[styles.toggleDot, visibility && styles.toggleDotOn]} />
                </Pressable>
              </View>

              <View style={[styles.row, { marginTop: 12 }]}>
                <Pressable
                  style={[styles.secondaryButtonFull, { flex: 1 }]}
                  onPress={() => setShowClientSettingsModal(false)}
                >
                  <Text style={styles.buttonText}>Cerrar</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, { flex: 1 }, !isClientSettingsDirty && styles.buttonDisabled]}
                  onPress={() => {
                    const payload = {
                      // Keep storage consistent with the rest of the app.
                      name: profileName,
                      status: profileStatus,
                      avatarUri: avatarUri,
                      notifyApp,
                      notifyEmail,
                      visibility,
                      email: newEmail,
                    };
                    AsyncStorage.setItem(STORAGE_PROFILE, JSON.stringify(payload)).catch(() =>
                      Alert.alert("Aviso", "No se pudo guardar la configuración en disco."),
                    );
                    if (authHeaders) {
                      fetch(`${API_BASE_URL}/users/me`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", ...authHeaders },
                        body: JSON.stringify({ notifyApp, notifyEmail, visibility }),
                      }).catch(() => undefined);
                    }
                    Alert.alert("Guardado", "Configuraciones actualizadas en esta sesión.");
                    setShowClientSettingsModal(false);
                  }}
                  disabled={!isClientSettingsDirty}
                >
                  <Text style={styles.primaryButtonText}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        {legalModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={{ alignItems: "center", gap: 8 }}>
                <Ionicons
                  name={legalModal === "terms" ? "document-text-outline" : "shield-checkmark-outline"}
                  size={22}
                  color={palette.accent}
                />
                <Text style={styles.modalTitle}>
                  {legalModal === "terms" ? "Términos y condiciones" : "Política de privacidad"}
                </Text>
              </View>
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {legalModal === "terms" ? (
                  <View style={{ gap: 10, marginTop: 10 }}>
                    <Text style={styles.legalText}>
                      Esta app se ofrece “tal cual”. Al usarla aceptas usarla de forma responsable y no realizar
                      actividades fraudulentas o que afecten a otros usuarios/negocios.
                    </Text>
                    <Text style={styles.legalText}>
                      Las citas y recordatorios dependen de la disponibilidad del servicio y del calendario del
                      dispositivo. Pueden existir cambios, retrasos o errores por conectividad.
                    </Text>
                    <Text style={styles.legalText}>
                      Podemos actualizar estos términos para mejorar la app. Si continuas usando la app después de una
                      actualización, se considera aceptación de los cambios.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 10, marginTop: 10 }}>
                    <Text style={styles.legalText}>
                      La app puede almacenar información local (por ejemplo tu perfil y preferencias) y comunicarse con
                      el backend para autenticarte y sincronizar datos.
                    </Text>
                    <Text style={styles.legalText}>
                      No compartimos tu información con terceros con fines publicitarios dentro de esta versión. Tu
                      información puede ser visible para negocios según tu configuración de visibilidad.
                    </Text>
                    <Text style={styles.legalText}>
                      Puedes solicitar cambios en tus datos desde la sección de Configuraciones del perfil.
                    </Text>
                  </View>
                )}
              </ScrollView>
              <Pressable style={[styles.secondaryButtonFull, { marginTop: 14 }]} onPress={() => setLegalModal(null)}>
                <Text style={styles.buttonText}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        )}
        {showNotificationsModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.modalTitle}>Notificaciones</Text>
                <Pressable onPress={() => setShowNotificationsModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={palette.muted} />
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator>
                <View style={{ gap: 10 }}>
                  {!notifications.length && <Text style={styles.label}>Sin notificaciones.</Text>}
                  {notifications.map((n) => {
                    const isUnread = !notifReadKeys.includes(n.key);
                    return (
                      <View key={n.key} style={styles.swipeRow}>
                        <Swipeable
                          renderRightActions={() => (
                            <Pressable
                              style={({ pressed }) => [styles.swipeDelete, pressed && styles.pressed]}
                              onPress={() => deleteNotification(n.key)}
                            >
                              <Ionicons name="trash-outline" size={22} color="#fff" />
                              <Text style={styles.swipeDeleteText}>Eliminar</Text>
                            </Pressable>
                          )}
                          rightThreshold={12}
                          overshootRight={false}
                        >
                          <Pressable
                            style={({ pressed }) => [styles.notifRow, pressed && styles.pressed]}
                            onPress={() => {
                              toggleNotificationRead(n.key);
                              if (n.source && n.itemId) {
                                setAgendaPreview({ source: n.source, id: n.itemId });
                                setShowNotificationsModal(false);
                              }
                            }}
                          >
                            <View style={{ width: 16, alignItems: "center" }}>
                              {isUnread ? <View style={styles.unreadDot} /> : <View style={{ width: 10, height: 10 }} />}
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={styles.notifTitle}>{n.title}</Text>
                              <Text style={styles.notifBody} numberOfLines={2}>
                                {n.body}
                              </Text>
                              <Text style={styles.notifMeta}>
                                {DateTime.fromISO(n.whenISO, { zone: currentZone }).toFormat("dd LLL · HH:mm")}
                              </Text>
                            </View>
                          </Pressable>
                        </Swipeable>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        )}
        {agendaPreviewData && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons
                    name={
                      agendaPreviewData.source === "custom"
                        ? "alarm-outline"
                        : agendaPreviewData.source === "appointment"
                          ? "calendar-outline"
                          : "phone-portrait-outline"
                    }
                    size={22}
                    color={palette.accent}
                  />
                  <View style={{ gap: 2 }}>
                    <Text style={styles.modalTitle}>Vista previa</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {agendaPreviewData.title}
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.modalClose} onPress={() => setAgendaPreview(null)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={palette.muted} />
                </Pressable>
              </View>

              <View style={{ gap: 8, marginTop: 12 }}>
                {!!agendaPreviewData.subtitle && (
                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>Detalle</Text>
                    <Text style={styles.buttonText}>{agendaPreviewData.subtitle}</Text>
                  </View>
                )}
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>Fecha y hora</Text>
                  <Text style={styles.buttonText}>{formatDateTime(agendaPreviewData.startAt, currentZone)}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>Estado</Text>
                  <Text style={styles.buttonText}>{prettyStatus(agendaPreviewData.status)}</Text>
                </View>
                {agendaPreviewData.source === "custom" && (
                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>Importancia</Text>
                    <Text style={styles.buttonText}>
                      {importanceLabels[(agendaPreviewData.importance as Importance) || "medium"]}
                    </Text>
                  </View>
                )}
                {!!agendaPreviewData.note && (
                  <View style={{ gap: 4 }}>
                    <Text style={styles.label}>Nota</Text>
                    <Text style={styles.buttonText}>{agendaPreviewData.note}</Text>
                  </View>
                )}
              </View>

              <View style={[styles.row, { marginTop: 14 }]}>
                <Pressable
                  style={[styles.secondaryButtonFull, { width: 56, alignItems: "center", justifyContent: "center" }]}
                  onPress={async () => {
                    const lines: string[] = [];
                    lines.push(agendaPreviewData.source === "appointment" ? "Cita" : "Recordatorio");
                    lines.push(agendaPreviewData.title);
                    if (agendaPreviewData.subtitle) lines.push(agendaPreviewData.subtitle);
                    lines.push(formatDateTime(agendaPreviewData.startAt, currentZone));
                    if (agendaPreviewData.note) lines.push(agendaPreviewData.note);
                    await Share.share({ message: lines.filter(Boolean).join("\n") });
                  }}
                >
                  <Ionicons name="share-social-outline" size={20} color={palette.text} />
                </Pressable>
                {agendaPreviewData.source === "custom" && (
                  <Pressable
                    style={[styles.primaryButton, { flex: 1 }]}
                    onPress={() => {
                      setAgendaPreview(null);
                      handleSelectScheduleItem(agendaPreviewData.id, "manual");
                    }}
                  >
                    <Text style={styles.primaryButtonText}>Editar</Text>
                  </Pressable>
                )}
                {agendaPreviewData.source === "device" && (
                  <Pressable
                    style={[styles.primaryButton, { flex: 1 }]}
                    onPress={() => {
                      setAgendaPreview(null);
                      const rawId =
                        ("calendarEventId" in agendaPreviewData && agendaPreviewData.calendarEventId) ||
                        agendaPreviewData.id.replace(/^cal-/, "");
                      openEditDeviceEvent(rawId);
                    }}
                  >
                    <Text style={styles.primaryButtonText}>Editar</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function DatePickerModal({
  visible,
  onClose,
  month,
  onPrev,
  onNext,
  days,
  onSelect,
  selectedIso,
  disabledIso,
}: {
  visible: boolean;
  onClose: () => void;
  month: DateTime;
  onPrev: () => void;
  onNext: () => void;
  days: DateTime[];
  onSelect: (iso: string) => void;
  selectedIso?: string;
  disabledIso?: (iso: string) => boolean;
}) {
  if (!visible) return null;
  const todayIso = DateTime.now().toISODate() || "";
  const monthLabelRaw = month.setLocale("es").toFormat("LLLL yyyy");
  const monthLabel = monthLabelRaw ? monthLabelRaw[0].toUpperCase() + monthLabelRaw.slice(1) : month.toFormat("LLLL yyyy");
  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.calendarBackdrop} onPress={onClose} />
      <View style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Pressable onPress={onPrev} style={styles.calendarNavBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={palette.text} />
          </Pressable>
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={styles.calendarTitle}>{monthLabel}</Text>
            <Text style={styles.calendarSubhead}>Selecciona una fecha</Text>
          </View>
          <Pressable onPress={onNext} style={styles.calendarNavBtn} hitSlop={10}>
            <Ionicons name="chevron-forward" size={20} color={palette.text} />
          </Pressable>
        </View>

        <View style={styles.calendarGrid}>
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <Text key={d} style={styles.calendarDow}>
              {d}
            </Text>
          ))}
          {days.map((d) => {
            const iso = d.toISODate() || "";
            const isSelected = !!selectedIso && iso === selectedIso;
            const isDisabled = !!disabledIso && !!iso && disabledIso(iso);
            const isToday = !!iso && iso === todayIso;
            const isOutside = d.month !== month.month || d.year !== month.year;
            return (
              <Pressable
                key={iso}
                style={({ pressed }) => [
                  styles.calendarDay,
                  isToday && !isSelected && !isDisabled && styles.calendarDayToday,
                  isOutside && !isSelected && !isDisabled && styles.calendarDayOutside,
                  isSelected && styles.calendarDaySelected,
                  isDisabled && styles.calendarDayDisabled,
                  pressed && !isDisabled && styles.pressed,
                ]}
                onPress={() => !isDisabled && onSelect(iso)}
                disabled={isDisabled}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    isOutside && !isSelected && !isDisabled && styles.calendarDayTextOutside,
                    isSelected && styles.calendarDayTextSelected,
                    isDisabled && styles.calendarDayTextDisabled,
                  ]}
                >
                  {String(d.day)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ alignItems: "center", marginTop: 12 }}>
          <Pressable
            style={({ pressed }) => [styles.calendarTodayBtn, pressed && styles.pressed]}
            onPress={() => {
              if (!todayIso) return;
              if (disabledIso && disabledIso(todayIso)) return;
              onSelect(todayIso);
            }}
          >
            <Ionicons name="today-outline" size={18} color={palette.accent} />
            <Text style={styles.calendarTodayText}>Hoy</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable onPress={onClose} style={[styles.secondaryButtonFull, { flex: 1 }]}>
            <Text style={styles.buttonText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  fullBackground: { flex: 1 },
  safeLogin: { flex: 1 },
  loginContainer: { flexGrow: 1, justifyContent: "center" },
  loginCenter: { alignItems: "center", paddingVertical: 60 },
  authRow: { flexDirection: "row", gap: 16, paddingVertical: 20 },
  authCard: {
    width: 320,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    padding: 16,
    justifyContent: "space-around",
    position: "relative",
  },
  authCardXL: { width: 360, maxWidth: 400 },
  authHeader: { alignItems: "flex-start", gap: 6, marginBottom: 8 },
  authHeaderCenter: { alignItems: "center", gap: 6, marginBottom: 12 },
  authTitle: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  authSub: { color: "#e5e7eb", fontSize: 12 },
  circleIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  circleIconText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  container: { padding: 20, gap: 16 },
  hero: {
    backgroundColor: palette.accentSoft,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    backgroundColor: palette.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  loginCard: {
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    marginBottom: 16,
  },
  loginGlass: {
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 20,
    gap: 12,
    borderRadius: 24,
  },
  loginIcon: { alignSelf: "center" },
  loginTitle: {
    textAlign: "center",
    color: "#fff",
    letterSpacing: 1.4,
    fontWeight: "700",
    fontSize: 18,
    textTransform: "uppercase",
  },
  loginSubtitle: { textAlign: "center", color: "#e5e7eb", fontSize: 13 },
  badgeText: { color: palette.text, fontWeight: "700", fontSize: 12 },
  title: { fontSize: 28, fontWeight: "700", color: palette.text },
  subtitle: { fontSize: 15, color: palette.text },
  hint: { fontSize: 12, color: palette.muted },
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
  cardMenuOpen: { zIndex: 1000, elevation: 10, position: "relative", overflow: "visible" },
  row: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowScroll: { flexGrow: 0 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { fontSize: 13, color: palette.muted },
  fieldLabel: { fontSize: 12, color: palette.text, fontWeight: "700", marginTop: 8 },
  mono: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 12, color: palette.text },
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
  socialRow: { flexDirection: "column", gap: 10, marginTop: 8 },
  socialRowCircle: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 6 },
  socialCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  socialCircleText: { fontWeight: "800", fontSize: 16 },
  socialButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    backgroundColor: palette.card,
  },
  googleButton: { borderColor: "#DB4437" },
  appleButton: { borderColor: "#000" },
  socialText: { fontWeight: "700", color: palette.text },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    backgroundColor: palette.card,
  },
  buttonText: { fontSize: 14, fontWeight: "600", color: palette.text },
  linkText: { fontSize: 13, fontWeight: "700", color: palette.accent },
  pressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.55 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: palette.text },
  metricsRow: { flexDirection: "row", gap: 10 },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: palette.card,
  },
  metricLabel: { fontSize: 11, color: palette.muted, textTransform: "uppercase", letterSpacing: 0.3 },
  metricValue: { fontSize: 22, fontWeight: "700", color: palette.text, marginTop: 4 },
  metricHint: { fontSize: 12, color: palette.muted, marginTop: 4 },
  nextCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: palette.accentSoft,
    gap: 4,
  },
  nextTime: { fontSize: 20, fontWeight: "700", color: palette.text },
  nextDetail: { fontSize: 15, fontWeight: "700", color: palette.text },
  nextSubdetail: { fontSize: 12, color: palette.muted },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    backgroundColor: palette.card,
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
  tabRowGlass: { flexDirection: "row", gap: 8 },
  tabGlass: { borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.1)" },
  tabGlassActive: { borderColor: "#fff", backgroundColor: "rgba(255,255,255,0.25)" },
  tabTextGlass: { fontWeight: "700", color: "#e5e7eb" },
  tabTextGlassActive: { color: "#0f172a" },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    marginRight: 8,
    marginBottom: 4,
    backgroundColor: palette.card,
  },
  chipTemplate: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  chipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  chipText: { color: palette.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    padding: 10,
    minWidth: 160,
    backgroundColor: "#fff",
  },
  inputGlass: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
  },
  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#0ea5e9",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    height: 54,
    gap: 10,
  },
  inputPillIcon: { color: "#0ea5e9", fontSize: 18 },
  inputPillField: { flex: 1, color: palette.text, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.secondary,
    backgroundColor: palette.secondarySoft,
  },
  slotText: { fontWeight: "700", color: palette.text },
  appointmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: palette.border,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.accent,
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 28 },
  avatarText: { fontSize: 18, fontWeight: "700", color: palette.text },
  sessionRow: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: palette.card,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  swipeRow: { borderRadius: 14, overflow: "hidden" },
  swipeDelete: {
    width: 96,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  swipeCancel: {
    width: 96,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  swipeDeleteText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  notifRow: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: palette.card,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  notifTitle: { fontSize: 14, fontWeight: "800", color: palette.text },
  notifBody: { fontSize: 12, color: palette.muted },
  notifMeta: { fontSize: 11, color: palette.muted, marginTop: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accent, marginTop: 4 },
  badgeDot: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: palette.card,
  },
  badgeDotText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  errorText: { color: palette.danger, fontSize: 12 },
  successText: { color: palette.success, fontSize: 12 },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: palette.muted,
    paddingVertical: 16,
  },
  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionButton: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: palette.card,
    flexGrow: 1,
    minWidth: 120,
    alignItems: "center",
  },
  actionText: { fontSize: 13, fontWeight: "700", color: palette.text },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: "700" },
  importanceDot: { width: 12, height: 12, borderRadius: 6, marginLeft: 8 },
  menuButton: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: palette.card,
  },
  menuButtonText: { fontSize: 14, fontWeight: "700", color: palette.accent },
  menuAnchor: { position: "relative", zIndex: 1000 },
  topRightButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  menu: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 8,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    minWidth: 190,
    zIndex: 1001,
    elevation: 20,
  },
  menuItem: { paddingVertical: 6 },
  menuItemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuText: { fontSize: 13, fontWeight: "600", color: palette.text },
  legalText: { fontSize: 13, lineHeight: 18, color: palette.text },
  loginHelpers: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 4 },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rememberBox: {
    width: 16,
    height: 17,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "transparent",
  },
  rememberBoxOn: { backgroundColor: "#0f52ba", borderColor: "#0f52ba" },
  rememberCheck: { color: "#fff", fontSize: 12, fontWeight: "800" },
  loginHint: { color: "#e5e7eb", fontSize: 12 },
  loginLink: { color: "#dbeafe", fontSize: 12, textDecorationLine: "underline" },
  loginButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(15,82,186,0.9)",
    alignItems: "center",
    marginTop: 4,
  },
  loginButtonText: { color: "#fff", fontWeight: "700", letterSpacing: 0.6 },
  forgotCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  pillButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    marginTop: 10,
  },
  pillButtonOutline: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fff",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "transparent",
  },
  pillButtonText: { fontWeight: "800", color: "#1e3a8a" },
  pillButtonTextAlt: { fontWeight: "800", color: "#fff" },
  fingerprint: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  fingerprintText: { fontSize: 26, color: "#fff" },
  waveTop: {
    position: "absolute",
    top: -40,
    left: -20,
    right: -20,
    height: 140,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
    opacity: 0.9,
  },
  waveTopOverlay: {
    position: "absolute",
    top: 40,
    left: -80,
    right: -80,
    height: 120,
    borderBottomLeftRadius: 140,
    borderBottomRightRadius: 140,
    opacity: 0.35,
  },
  waveBottom: {
    position: "absolute",
    bottom: -60,
    left: -60,
    right: -60,
    height: 180,
    borderTopLeftRadius: 160,
    borderTopRightRadius: 160,
    opacity: 0.9,
  },
  highlightCard: {
    width: 220,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  highlightTitle: { fontSize: 16, fontWeight: "700", color: palette.text },
  gridCards: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  squareCard: {
    width: "47%",
    minWidth: 150,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  fab: {
    position: "absolute",
    left: 20,
    bottom: 30,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 2000,
    elevation: 20,
  },
  fabText: { color: "#fff", fontSize: 34, fontWeight: "800", marginTop: -4 },
  homeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  homeIconText: { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: -1 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandTitle: { fontSize: 22, fontWeight: "800", color: palette.text },
  brandSubtitle: { color: palette.muted, fontSize: 12 },
  brandTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandTitleLogo: { width: 50, height: 50, resizeMode: "contain" },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 5000,
    elevation: 100,
  },
  modalOverlayFlex: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: palette.text },
  modalHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.card,
  },
  inputDisabled: { backgroundColor: palette.accentSoft, color: palette.muted },
  readOnlyBox: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    padding: 10,
    minWidth: 160,
    backgroundColor: palette.accentSoft,
  },
  readOnlyText: { color: palette.text, fontWeight: "600" },
  readOnlyPlaceholder: { color: palette.muted, fontWeight: "600" },
  sheetOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    elevation: 40,
    justifyContent: "center",
  },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.35)" },
  sheetCard: {
    maxHeight: "70%",
    minHeight: 340,
    backgroundColor: palette.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.border,
    alignSelf: "center",
    marginBottom: 10,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: palette.text },
  calendarCard: {
    width: "94%",
    maxWidth: 520,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    zIndex: 1,
  },
  calendarBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent", zIndex: 0 },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  calendarTitle: { fontSize: 18, fontWeight: "900", color: palette.text, letterSpacing: 0.2 },
  calendarSubhead: { fontSize: 12, color: palette.muted, fontWeight: "700" },
  calendarNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  calendarDow: {
    width: "13.6%",
    textAlign: "center",
    color: palette.muted,
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4,
  },
  calendarDay: {
    width: "13.6%",
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.card,
  },
  calendarDayToday: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  calendarDayOutside: { backgroundColor: "#fff", borderColor: palette.border, opacity: 0.55 },
  calendarDaySelected: { backgroundColor: palette.accent, borderColor: palette.accent },
  calendarDayDisabled: { backgroundColor: `${palette.danger}22`, borderColor: palette.danger, opacity: 0.65 },
  calendarDayText: { color: palette.text, fontWeight: "900", fontSize: 15, textAlign: "center", width: "100%" },
  calendarDayTextOutside: { color: palette.muted },
  calendarDayTextSelected: { color: "#fff" },
  calendarDayTextDisabled: { color: palette.muted },
  calendarTodayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  calendarTodayText: { color: palette.text, fontWeight: "900" },
  agendaListScroll: { maxHeight: 420, marginTop: 10 },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.accent,
  },
  avatarImageLarge: { width: "100%", height: "100%", borderRadius: 48 },
  avatarEdit: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarEditText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  toggle: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.border,
    padding: 3,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: palette.accent },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
  },
  toggleDotOn: { alignSelf: "flex-end" },
  strengthBar: { flexDirection: "row", gap: 6, marginTop: 6 },
  strengthSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.border,
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderTopWidth: 1,
    borderColor: palette.border,
    gap: 10,
    zIndex: 9001,
    elevation: 201,
  },
  sheetButton: { flex: 1 },
  bgWaveTop: {
    position: "absolute",
    top: -80,
    left: -60,
    right: -60,
    height: 200,
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
    opacity: 0.5,
    zIndex: -1,
  },
  bgWaveBottom: {
    position: "absolute",
    bottom: -120,
    left: -80,
    right: -80,
    height: 240,
    borderTopLeftRadius: 180,
    borderTopRightRadius: 180,
    opacity: 0.5,
    zIndex: -1,
  },
  loginFull: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  loginCardMock: { width: 360, gap: 14, alignItems: "center", paddingVertical: 10 },
  loginLogo: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  // Legacy: was used when logo was stacked above the title.
  MainLogocliente: { width: 100, height: 100, resizeMode: "contain" },
  loginMainLogo: { width: 100, height: 100, resizeMode: "contain" },
  loginLogoText: { color: "#fff", fontSize: 32, fontWeight: "800" },
  loginTitleCenter: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  loginSubtitleCenter: { color: "#e5e7eb", fontSize: 12, letterSpacing: 2 },
  loginWaveTop: {
    position: "absolute",
    top: -120,
    left: -120,
    right: -120,
    height: 250,
    borderBottomLeftRadius: 200,
    borderBottomRightRadius: 200,
    backgroundColor: "#fff",
    opacity: 0.9,
  },
  loginWaveBottom: {
    position: "absolute",
    bottom: -160,
    left: -140,
    right: -140,
    height: 320,
    borderTopLeftRadius: 220,
    borderTopRightRadius: 220,
    backgroundColor: "#fff",
    opacity: 0.9,
  },
  formGap: { width: "100%", gap: 12, marginTop: 8 },
  inputPillWhite: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#0d6efd",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    height: 56,
    gap: 10,
    width: "100%",
  },
  inputPillFieldWhite: { flex: 1, color: "#0f172a", fontWeight: "600" },
  inputPillIconBlue: { color: "#0d6efd", fontSize: 18 },
  passwordToggleButton: { padding: 8 },
  passwordToggleIcon: { width: 50, height: 50, resizeMode: "contain", tintColor: "#0d6efd" },
  loginCta: {
    backgroundColor: "#1262fa",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 8,
    width: "100%",
  },
  loginCtaText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  loginCardClean: {
    width: 360,
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 60,
    paddingBottom: 60,
  },

});


