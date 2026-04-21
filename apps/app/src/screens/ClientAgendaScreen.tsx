import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DateTime } from "luxon";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import * as Calendar from "expo-calendar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { Section } from "../components/Section";
import { sharedStyles, palette, importanceColors, importanceLabels, statusColor, prettyStatus } from "../styles/theme";
import { formatDateTime, getErrorMessage, isoToday } from "../utils";
import { Activity, Appointment, Importance, ScheduleItem, ScheduleSource } from "../types";

const STORAGE_ACTIVITIES = "melon_activities_v1";

type Props = {
  currentZone: string;
  onOpenPreview: (source: ScheduleSource, id: string) => void;
};

export function ClientAgendaScreen({ currentZone, onOpenPreview }: Props) {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customActivities, setCustomActivities] = useState<Activity[]>([]);
  const [deviceEvents, setDeviceEvents] = useState<Activity[]>([]);
  const [deviceCalendarEnabled, setDeviceCalendarEnabled] = useState(true);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [isAppointmentsLoading, setIsAppointmentsLoading] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | Importance>("all");

  const fetchAppointments = useCallback(async () => {
    if (!token) return;
    setIsAppointmentsLoading(true);
    try {
      const data = await api.appointments.list(token);
      setAppointments(data as Appointment[]);
    } catch {
      // silently fail
    } finally {
      setIsAppointmentsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Load saved activities
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_ACTIVITIES).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCustomActivities(parsed as Activity[]);
      } catch {
        // ignore
      }
    });
  }, []);

  const syncDeviceCalendar = useCallback(async (silent = false) => {
    if (!deviceCalendarEnabled) return;
    setIsSyncingCalendar(true);
    try {
      const perm = await Calendar.requestCalendarPermissionsAsync();
      if (perm.status !== "granted") {
        if (!silent) Alert.alert("Permiso requerido", "Activa el acceso al calendario del dispositivo.");
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const now = new Date();
      const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const events: Activity[] = [];
      for (const cal of calendars) {
        const calEvents = await Calendar.getEventsAsync([cal.id], now, future);
        calEvents.forEach((ev) => {
          if (!ev.startDate) return;
          events.push({
            id: `cal-${ev.id}`,
            title: ev.title || "Evento calendario",
            note: (ev.notes as string) || (ev.location as string) || undefined,
            startAt: new Date(ev.startDate).toISOString(),
            endAt: ev.endDate ? new Date(ev.endDate).toISOString() : undefined,
            kind: "manual",
            importance: "low",
            calendarEventId: ev.id,
          });
        });
      }
      setDeviceEvents(events);
    } catch {
      if (!silent) Alert.alert("Calendario", "No se pudo sincronizar el calendario.");
    } finally {
      setIsSyncingCalendar(false);
    }
  }, [deviceCalendarEnabled]);

  const scheduleItems = useMemo<ScheduleItem[]>(
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
        subtitle: c.note || "",
        note: c.note,
        startAt: c.startAt,
        status: c.kind === "cita" ? "CITA" : "MANUAL",
        kind: c.kind,
        importance: c.importance || ("medium" as Importance),
      })),
      ...(deviceCalendarEnabled
        ? deviceEvents.map((e) => ({
            source: "device" as const,
            id: e.id,
            title: e.title || "Evento calendario",
            subtitle: e.note || "Calendario del dispositivo",
            note: e.note,
            startAt: e.startAt,
            endAt: e.endAt,
            calendarEventId: e.calendarEventId,
            status: "CALENDARIO",
            kind: "manual" as const,
            importance: "low" as Importance,
          }))
        : []),
    ],
    [appointments, customActivities, deviceCalendarEnabled, deviceEvents],
  );

  const filteredSchedule = useMemo(() => {
    const ordered = [...scheduleItems].sort(
      (a, b) => DateTime.fromISO(a.startAt).toMillis() - DateTime.fromISO(b.startAt).toMillis(),
    );
    if (urgencyFilter === "all") return ordered;
    return ordered.filter((i) => i.importance === urgencyFilter);
  }, [scheduleItems, urgencyFilter]);

  const confirmCancelAppointment = useCallback(
    (id: string) => {
      Alert.alert("Cancelar cita", "¿Quieres cancelar esta cita?", [
        { text: "No", style: "cancel" },
        {
          text: "Sí",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            try {
              await api.appointments.cancel(token, id);
              await fetchAppointments();
            } catch (err: unknown) {
              Alert.alert("Error", getErrorMessage(err, "No se pudo cancelar la cita."));
            }
          },
        },
      ]);
    },
    [fetchAppointments, token],
  );

  const confirmDeleteCustomReminder = useCallback(
    (id: string) => {
      Alert.alert("Eliminar actividad", "¿Quieres eliminar esta actividad?", [
        { text: "No", style: "cancel" },
        {
          text: "Sí",
          style: "destructive",
          onPress: () => {
            setCustomActivities((prev) => {
              const next = prev.filter((a) => a.id !== id);
              AsyncStorage.setItem(STORAGE_ACTIVITIES, JSON.stringify(next)).catch(() => undefined);
              return next;
            });
          },
        },
      ]);
    },
    [],
  );

  return (
    <View style={sharedStyles.card}>
      <Section title="Mi agenda">
        <View style={sharedStyles.rowBetween}>
          <Pressable
            style={({ pressed }) => [styles.syncButton, pressed && sharedStyles.pressed]}
            onPress={() => syncDeviceCalendar(false)}
            disabled={isSyncingCalendar || !deviceCalendarEnabled}
          >
            <Text style={sharedStyles.buttonText}>
              {!deviceCalendarEnabled ? "Calendario desactivado" : isSyncingCalendar ? "Sincronizando..." : "Sincronizar"}
            </Text>
          </Pressable>
        </View>

        <View style={[sharedStyles.row, { marginTop: 10 }]}>
          {([
            { key: "all", label: "Todas" },
            { key: "high", label: "Alta" },
            { key: "medium", label: "Media" },
            { key: "low", label: "Baja" },
          ] as const).map((opt) => {
            const active = urgencyFilter === opt.key;
            const tone =
              opt.key === "high" ? importanceColors.high
              : opt.key === "medium" ? importanceColors.medium
              : opt.key === "low" ? importanceColors.low
              : palette.accent;
            return (
              <Pressable
                key={opt.key}
                style={[sharedStyles.chip, active && { backgroundColor: tone, borderColor: tone }]}
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
            const isDevice = item.source === "device";
            const urgencyTone =
              item.kind === "manual" ? importanceColors[item.importance || "medium"] : statusColor(item.status);
            const tone = isDevice ? "#9ca3af" : urgencyTone;
            const isCustomReminder = item.source === "custom";
            const isAppointment = item.source === "appointment";

            const card = (
              <Pressable
                style={({ pressed }) => [
                  styles.sessionRow,
                  { borderLeftWidth: 6, borderLeftColor: tone },
                  pressed && sharedStyles.pressed,
                ]}
                onPress={() => onOpenPreview(item.source, item.id)}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={sharedStyles.rowBetween}>
                    <Text style={styles.sessionTitle}>{item.title}</Text>
                    <View style={[styles.importanceDot, { backgroundColor: tone }]} />
                  </View>
                  <Text style={sharedStyles.hint}>{item.subtitle}</Text>
                  <Text style={sharedStyles.hint}>{formatDateTime(item.startAt, currentZone)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  {item.kind === "manual" && (
                    <View style={[styles.tag, { borderColor: tone, backgroundColor: `${tone}22` }]}>
                      <Text style={[styles.tagText, { color: tone }]}>{importanceLabels[item.importance || "medium"]}</Text>
                    </View>
                  )}
                  <View style={[styles.tag, { borderColor: statusColor(item.status) }]}>
                    <Text style={[styles.tagText, { color: statusColor(item.status) }]}>{prettyStatus(item.status)}</Text>
                  </View>
                </View>
              </Pressable>
            );

            return (
              <View key={item.id}>
                {isCustomReminder || isAppointment ? (
                  <Swipeable
                    renderRightActions={() =>
                      isAppointment ? (
                        <Pressable
                          style={({ pressed }) => [styles.swipeCancel, pressed && sharedStyles.pressed]}
                          onPress={() => confirmCancelAppointment(item.id)}
                        >
                          <Ionicons name="close-circle-outline" size={22} color="#fff" />
                          <Text style={styles.swipeActionText}>Cancelar</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={({ pressed }) => [styles.swipeDelete, pressed && sharedStyles.pressed]}
                          onPress={() => confirmDeleteCustomReminder(item.id)}
                        >
                          <Ionicons name="trash-outline" size={22} color="#fff" />
                          <Text style={styles.swipeActionText}>Eliminar</Text>
                        </Pressable>
                      )
                    }
                    rightThreshold={12}
                    friction={2}
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
            <Text style={sharedStyles.label}>Sin actividades ni citas agendadas.</Text>
          )}
        </ScrollView>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  syncButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.card,
  },
  chipText: { fontSize: 12, color: palette.text },
  agendaListScroll: { maxHeight: 500 },
  sessionRow: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
  },
  sessionTitle: { fontSize: 14, fontWeight: "700", color: palette.text },
  importanceDot: { width: 10, height: 10, borderRadius: 5 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tagText: { fontSize: 11, fontWeight: "600" },
  swipeDelete: {
    backgroundColor: palette.danger,
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    borderRadius: 12,
    gap: 4,
    padding: 8,
  },
  swipeCancel: {
    backgroundColor: palette.warning,
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    borderRadius: 12,
    gap: 4,
    padding: 8,
  },
  swipeActionText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
