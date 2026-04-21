import React from "react";
import { View, Text, Pressable, Modal, Platform } from "react-native";
import { DateTime } from "luxon";
import { Ionicons } from "@expo/vector-icons";
import { sharedStyles, palette } from "../styles/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  month: DateTime;
  onPrev: () => void;
  onNext: () => void;
  days: DateTime[];
  onSelect: (iso: string) => void;
  selectedIso?: string;
  disabledIso?: (iso: string) => boolean;
};

export function DatePickerModal({ visible, onClose, month, onPrev, onNext, days, onSelect, selectedIso, disabledIso }: Props) {
  if (!visible) return null;
  const todayIso = DateTime.now().toISODate() || "";
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
              <Text style={sharedStyles.calendarSubhead}>Selecciona una fecha</Text>
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
              const isSelected = !!selectedIso && iso === selectedIso;
              const isDisabled = !!disabledIso && !!iso && disabledIso(iso);
              const isToday = !!iso && iso === todayIso;
              const isOutside = d.month !== month.month || d.year !== month.year;
              return (
                <Pressable
                  key={iso}
                  style={({ pressed }) => [
                    sharedStyles.calendarDay,
                    isToday && !isSelected && !isDisabled && sharedStyles.calendarDayToday,
                    isOutside && !isSelected && !isDisabled && sharedStyles.calendarDayOutside,
                    isSelected && sharedStyles.calendarDaySelected,
                    isDisabled && sharedStyles.calendarDayDisabled,
                    pressed && !isDisabled && sharedStyles.pressed,
                  ]}
                  onPress={() => !isDisabled && onSelect(iso)}
                  disabled={isDisabled}
                >
                  <Text
                    style={[
                      sharedStyles.calendarDayText,
                      isOutside && !isSelected && !isDisabled && sharedStyles.calendarDayTextOutside,
                      isSelected && sharedStyles.calendarDayTextSelected,
                      isDisabled && sharedStyles.calendarDayTextDisabled,
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
              style={({ pressed }) => [sharedStyles.calendarTodayBtn, pressed && sharedStyles.pressed]}
              onPress={() => {
                if (!todayIso) return;
                if (disabledIso && disabledIso(todayIso)) return;
                onSelect(todayIso);
              }}
            >
              <Ionicons name="today-outline" size={18} color={palette.accent} />
              <Text style={sharedStyles.calendarTodayText}>Hoy</Text>
            </Pressable>
          </View>

          <View style={sharedStyles.row}>
            <Pressable onPress={onClose} style={[sharedStyles.secondaryButtonFull, { flex: 1 }]}>
              <Text style={sharedStyles.buttonText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
