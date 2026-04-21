import React from "react";
import { View, Text, Pressable, Modal, Platform } from "react-native";
import { DateTime } from "luxon";
import { Ionicons } from "@expo/vector-icons";
import { sharedStyles, palette } from "../styles/theme";
import { expandDateRange } from "../utils";

type Props = {
  visible: boolean;
  onClose: () => void;
  month: DateTime;
  onPrev: () => void;
  onNext: () => void;
  days: DateTime[];
  startIso: string | null;
  endIso: string | null;
  onChange: (startIso: string | null, endIso: string | null) => void;
};

export function DateRangePickerModal({ visible, onClose, month, onPrev, onNext, days, startIso, endIso, onChange }: Props) {
  if (!visible) return null;
  const todayIso = DateTime.now().toISODate() || "";
  const rangeIsos = startIso && endIso ? new Set(expandDateRange(startIso, endIso)) : new Set(startIso ? [startIso] : []);
  const monthLabelRaw = month.setLocale("es").toFormat("LLLL yyyy");
  const monthLabel = monthLabelRaw ? monthLabelRaw[0].toUpperCase() + monthLabelRaw.slice(1) : month.toFormat("LLLL yyyy");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
    >
      <View style={sharedStyles.modalOverlay}>
        <Pressable style={sharedStyles.calendarBackdrop} onPress={onClose} />
        <View style={sharedStyles.calendarCard}>
          <View style={sharedStyles.calendarHeader}>
            <Pressable onPress={onPrev} style={sharedStyles.calendarNavBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={palette.text} />
            </Pressable>
            <View style={{ alignItems: "center", gap: 2 }}>
              <Text style={sharedStyles.calendarTitle}>{monthLabel}</Text>
              <Text style={sharedStyles.calendarSubhead}>Selecciona desde y hasta</Text>
            </View>
            <Pressable onPress={onNext} style={sharedStyles.calendarNavBtn} hitSlop={10}>
              <Ionicons name="chevron-forward" size={20} color={palette.text} />
            </Pressable>
          </View>

          <View style={sharedStyles.calendarGrid}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <Text key={d} style={sharedStyles.calendarDow}>{d}</Text>
            ))}
            {days.map((d) => {
              const iso = d.toISODate() || "";
              const isSelected = !!iso && rangeIsos.has(iso);
              const isToday = !!iso && iso === todayIso;
              const isOutside = d.month !== month.month || d.year !== month.year;
              return (
                <Pressable
                  key={iso}
                  style={({ pressed }) => [
                    sharedStyles.calendarDay,
                    isToday && !isSelected && sharedStyles.calendarDayToday,
                    isOutside && !isSelected && sharedStyles.calendarDayOutside,
                    isSelected && sharedStyles.calendarDaySelected,
                    pressed && sharedStyles.pressed,
                  ]}
                  onPress={() => {
                    if (!iso) return;
                    if (!startIso || (startIso && endIso)) {
                      onChange(iso, null);
                    } else {
                      const sorted = [startIso, iso].sort();
                      onChange(sorted[0], sorted[1]);
                    }
                  }}
                >
                  <Text
                    style={[
                      sharedStyles.calendarDayText,
                      isOutside && !isSelected && sharedStyles.calendarDayTextOutside,
                      isSelected && sharedStyles.calendarDayTextSelected,
                    ]}
                  >
                    {String(d.day)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[sharedStyles.hint, { textAlign: "center", marginTop: 12 }]}>
            {startIso && endIso
              ? `${startIso} a ${endIso}`
              : startIso
                ? `Desde ${startIso}`
                : "No hay rango seleccionado"}
          </Text>

          <View style={sharedStyles.row}>
            <Pressable onPress={() => onChange(null, null)} style={[sharedStyles.secondaryButtonFull, { flex: 1 }]}>
              <Text style={sharedStyles.buttonText}>Limpiar</Text>
            </Pressable>
            <Pressable onPress={onClose} style={[sharedStyles.primaryButton, { flex: 1 }]}>
              <Text style={sharedStyles.primaryButtonText}>Listo</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
