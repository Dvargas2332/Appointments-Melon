import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { Section } from "../components/Section";
import { sharedStyles, palette, prettyStatus, statusColor } from "../styles/theme";
import { getErrorMessage, isoToday, defaultTimezones, phoneCodes, COUNTRY_OPTIONS } from "../utils";
import { Business, Appointment } from "../types";

export function BusinessScreen() {
  const { token, user } = useAuth();
  const [myBusinesses, setMyBusinesses] = useState<Business[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettingsForm, setShowSettingsForm] = useState(false);

  // Settings form state
  const [settingsName, setSettingsName] = useState("");
  const [settingsCategory, setSettingsCategory] = useState("");
  const [settingsTimezone, setSettingsTimezone] = useState("UTC");
  const [settingsPhoneCode, setSettingsPhoneCode] = useState("");
  const [settingsPhoneNumber, setSettingsPhoneNumber] = useState("");
  const [settingsCountry, setSettingsCountry] = useState("");
  const [settingsRegion, setSettingsRegion] = useState("");
  const [settingsAvailabilityStart, setSettingsAvailabilityStart] = useState("09:00");
  const [settingsAvailabilityEnd, setSettingsAvailabilityEnd] = useState("18:00");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showPicker, setShowPicker] = useState<null | "timezone" | "phoneCode" | "country">(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [biz, appts] = await Promise.all([
        api.businesses.mine(token),
        api.appointments.list(token),
      ]);
      setMyBusinesses(biz as Business[]);
      setAppointments(appts as Appointment[]);

      const first = (biz as Business[])[0];
      if (first) {
        setSettingsName(first.name || "");
        setSettingsCategory(first.category || "");
        setSettingsTimezone(first.timezone || "UTC");
        setSettingsCountry(first.country || "");
        setSettingsRegion(first.region || "");
        if (first.phone) {
          const code = phoneCodes.find((c) => first.phone!.startsWith(c)) || "";
          setSettingsPhoneCode(code);
          setSettingsPhoneNumber(code ? first.phone!.slice(code.length).trim() : first.phone!);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveSettings = async () => {
    if (!token) return;
    if (!settingsName.trim()) {
      Alert.alert("Falta nombre", "Escribe el nombre del negocio.");
      return;
    }
    setIsSavingSettings(true);
    try {
      const businessData = {
        name: settingsName.trim(),
        category: settingsCategory.trim() || undefined,
        timezone: settingsTimezone || "UTC",
        phone: settingsPhoneCode && settingsPhoneNumber ? `${settingsPhoneCode} ${settingsPhoneNumber}` : settingsPhoneNumber || undefined,
        country: settingsCountry || undefined,
        region: settingsRegion || undefined,
      };

      if (myBusinesses.length === 0) {
        await api.businesses.create(token, businessData);
        if (settingsAvailabilityStart && settingsAvailabilityEnd) {
          const created = await api.businesses.mine(token);
          const newBiz = (created as Business[])[0];
          if (newBiz) {
            for (let day = 1; day <= 5; day++) {
              await api.businesses.setRules(token, newBiz.id, {
                dayOfWeek: day,
                startTime: settingsAvailabilityStart,
                endTime: settingsAvailabilityEnd,
              });
            }
          }
        }
      } else {
        await api.businesses.update(token, myBusinesses[0].id, businessData);
      }

      await fetchData();
      setShowSettingsForm(false);
      Alert.alert("Guardado", "Configuración actualizada.");
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "No se pudo guardar."));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const pickerTitle =
    showPicker === "timezone" ? "Selecciona la zona horaria"
    : showPicker === "phoneCode" ? "Selecciona el código"
    : showPicker === "country" ? "Selecciona el país"
    : "";

  const pickerOptions =
    showPicker === "timezone" ? defaultTimezones
    : showPicker === "phoneCode" ? phoneCodes
    : showPicker === "country" ? COUNTRY_OPTIONS
    : [];

  if (showSettingsForm) {
    return (
      <ScrollView contentContainerStyle={sharedStyles.container} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        <View style={sharedStyles.card}>
          <View style={sharedStyles.rowBetween}>
            <Text style={sharedStyles.sectionTitle}>{myBusinesses.length === 0 ? "Crear negocio" : "Configuraciones"}</Text>
            <Pressable onPress={() => setShowSettingsForm(false)}>
              <Text style={sharedStyles.linkText}>Cerrar</Text>
            </Pressable>
          </View>

          {/* Fields */}
          <Text style={sharedStyles.fieldLabel}>Nombre del negocio</Text>
          <TextInput style={sharedStyles.input} value={settingsName} onChangeText={setSettingsName} placeholder="Nombre del negocio" />

          <Text style={sharedStyles.fieldLabel}>Categoría</Text>
          <TextInput style={sharedStyles.input} value={settingsCategory} onChangeText={setSettingsCategory} placeholder="Categoría" />

          <Text style={sharedStyles.fieldLabel}>Zona horaria</Text>
          <Pressable style={[sharedStyles.input, sharedStyles.selectInput]} onPress={() => setShowPicker("timezone")}>
            <Text style={[sharedStyles.selectInputText, !settingsTimezone && sharedStyles.selectInputPlaceholder]}>
              {settingsTimezone || "Selecciona la zona horaria"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={palette.muted} />
          </Pressable>

          <Text style={sharedStyles.fieldLabel}>Código telefónico</Text>
          <Pressable style={[sharedStyles.input, sharedStyles.selectInput]} onPress={() => setShowPicker("phoneCode")}>
            <Text style={[sharedStyles.selectInputText, !settingsPhoneCode && sharedStyles.selectInputPlaceholder]}>
              {settingsPhoneCode || "Selecciona el código"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={palette.muted} />
          </Pressable>

          <Text style={sharedStyles.fieldLabel}>Teléfono</Text>
          <TextInput style={sharedStyles.input} value={settingsPhoneNumber} onChangeText={setSettingsPhoneNumber} placeholder="Número de teléfono" keyboardType="phone-pad" />

          <Text style={sharedStyles.fieldLabel}>País</Text>
          <Pressable style={[sharedStyles.input, sharedStyles.selectInput]} onPress={() => setShowPicker("country")}>
            <Text style={[sharedStyles.selectInputText, !settingsCountry && sharedStyles.selectInputPlaceholder]}>
              {settingsCountry || "Selecciona el país"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={palette.muted} />
          </Pressable>

          <Text style={sharedStyles.fieldLabel}>Región/Estado</Text>
          <TextInput style={sharedStyles.input} value={settingsRegion} onChangeText={setSettingsRegion} placeholder="Región/Estado" />

          <Text style={sharedStyles.fieldLabel}>Horario de atención</Text>
          <View style={styles.timeRow}>
            <TextInput style={[sharedStyles.input, { flex: 1 }]} value={settingsAvailabilityStart} onChangeText={setSettingsAvailabilityStart} placeholder="HH:MM inicio" />
            <TextInput style={[sharedStyles.input, { flex: 1 }]} value={settingsAvailabilityEnd} onChangeText={setSettingsAvailabilityEnd} placeholder="HH:MM fin" />
          </View>

          <Pressable
            style={({ pressed }) => [sharedStyles.primaryButton, pressed && sharedStyles.pressed]}
            onPress={saveSettings}
            disabled={isSavingSettings}
          >
            <Text style={sharedStyles.primaryButtonText}>
              {isSavingSettings ? "Guardando..." : myBusinesses.length === 0 ? "Crear negocio" : "Guardar cambios"}
            </Text>
          </Pressable>
        </View>

        {showPicker && (
          <View style={sharedStyles.inlinePickerOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowPicker(null)} />
            <View style={sharedStyles.inlinePickerCard}>
              <View style={sharedStyles.inlinePickerHeader}>
                <Text style={sharedStyles.sheetTitle}>{pickerTitle}</Text>
                <Pressable onPress={() => setShowPicker(null)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              </View>
              <ScrollView style={sharedStyles.inlinePickerScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {pickerOptions.map((option) => {
                  const active =
                    showPicker === "timezone" ? settingsTimezone === option
                    : showPicker === "country" ? settingsCountry === option
                    : settingsPhoneCode === option;
                  return (
                    <Pressable
                      key={option}
                      style={({ pressed }) => [
                        sharedStyles.inlinePickerItem,
                        active && sharedStyles.inlinePickerItemActive,
                        pressed && sharedStyles.pressed,
                      ]}
                      onPress={() => {
                        if (showPicker === "timezone") setSettingsTimezone(option);
                        else if (showPicker === "country") setSettingsCountry(option);
                        else setSettingsPhoneCode(option);
                        setShowPicker(null);
                      }}
                    >
                      <Text style={[sharedStyles.inlinePickerItemText, active && sharedStyles.inlinePickerItemTextActive]}>{option}</Text>
                      {active && <Ionicons name="checkmark" size={18} color={palette.accent} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <>
      <View style={sharedStyles.card}>
        <View style={sharedStyles.rowBetween}>
          <Text style={sharedStyles.sectionTitle}>
            {myBusinesses.length === 0 ? "Sin negocio configurado" : myBusinesses[0]?.name || "Mi negocio"}
          </Text>
          <Pressable onPress={() => setShowSettingsForm(true)}>
            <Ionicons name="settings-outline" size={20} color={palette.accent} />
          </Pressable>
        </View>
        {myBusinesses.length === 0 && (
          <Pressable
            style={({ pressed }) => [sharedStyles.primaryButton, pressed && sharedStyles.pressed]}
            onPress={() => setShowSettingsForm(true)}
          >
            <Text style={sharedStyles.primaryButtonText}>Crear negocio</Text>
          </Pressable>
        )}
        {myBusinesses[0] && (
          <Text style={sharedStyles.hint}>
            {myBusinesses[0].category || "Sin categoría"} · {myBusinesses[0].timezone}
          </Text>
        )}
      </View>

      <View style={sharedStyles.card}>
        <Section title="Citas del negocio">
          {isLoading && <ActivityIndicator color={palette.accent} />}
          {appointments.map((a) => (
            <View key={a.id} style={styles.appointmentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.appointmentTitle}>{a.service?.name || "Servicio"}</Text>
                <Text style={sharedStyles.hint}>{new Date(a.startAt).toLocaleString("es")}</Text>
              </View>
              <View style={[styles.tag, { borderColor: statusColor(a.status) }]}>
                <Text style={[styles.tagText, { color: statusColor(a.status) }]}>{prettyStatus(a.status)}</Text>
              </View>
            </View>
          ))}
          {!appointments.length && !isLoading && (
            <Text style={sharedStyles.label}>Sin citas registradas.</Text>
          )}
        </Section>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  timeRow: { flexDirection: "row", gap: 8 },
  appointmentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    gap: 8,
  },
  appointmentTitle: { fontWeight: "700", fontSize: 13, color: palette.text },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: { fontSize: 11, fontWeight: "600" },
});
