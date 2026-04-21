import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  ImageBackground,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { Section } from "../components/Section";
import { sharedStyles, palette } from "../styles/theme";
import { getErrorMessage, getCountryDisplayName, isoToday, initialsFromName } from "../utils";
import { Business, DeviceLocationInfo } from "../types";

type Props = {
  onBookBusiness: (business: Business) => void;
};

export function ClientHomeScreen({ onBookBusiness }: Props) {
  const { token } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocationInfo | null>(null);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<Location.PermissionStatus | "unknown">("unknown");
  const [locationError, setLocationError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBusinesses = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.businesses.list();
      setBusinesses(data as Business[]);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const detectLocation = useCallback(async () => {
    setIsLocating(true);
    setLocationError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionStatus(permission.status);
      if (permission.status !== "granted") throw new Error("Permiso de ubicación denegado.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      const first = geo[0];
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setDeviceLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        country: getCountryDisplayName(first?.isoCountryCode) || first?.country || "",
        region: first?.region || first?.subregion || "",
        city: first?.city || first?.district || "",
        timezone,
      });
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "No se pudo obtener la ubicación.");
      setLocationError(msg);
    } finally {
      setIsLocating(false);
    }
  }, []);

  const filteredBusinesses = useMemo(() => {
    if (!searchTerm.trim()) return businesses;
    const q = searchTerm.toLowerCase();
    return businesses.filter(
      (b) => b.name.toLowerCase().includes(q) || (b.category || "").toLowerCase().includes(q),
    );
  }, [businesses, searchTerm]);

  return (
    <>
      <View style={sharedStyles.card}>
        <Section title="Buscar negocios">
          <TextInput
            style={sharedStyles.input}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Busca por nombre de empresa o tipo de servicio"
          />
          <View style={styles.locationBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationBarTitle}>Ubicación actual</Text>
              <Text style={styles.locationBarText}>
                {deviceLocation
                  ? `${deviceLocation.region ? `${deviceLocation.region}, ` : ""}${deviceLocation.country || "Detectada"}`
                  : locationPermissionStatus === "denied"
                    ? "Permiso denegado"
                    : isLocating
                      ? "Detectando ubicación..."
                      : "Sin ubicación detectada"}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.locationRefreshButton, pressed && sharedStyles.pressed]}
              onPress={detectLocation}
            >
              <Ionicons name="locate-outline" size={16} color="#fff" />
              <Text style={styles.locationRefreshText}>{isLocating ? "Buscando" : "Actualizar"}</Text>
            </Pressable>
          </View>
          {!!locationError && <Text style={sharedStyles.errorText}>{locationError}</Text>}
        </Section>
      </View>

      <View style={sharedStyles.card}>
        <Section title="Destacados">
          <ScrollView
            horizontal
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {isLoading && <ActivityIndicator color={palette.accent} />}
            {filteredBusinesses.slice(0, 5).map((b) => (
              <Pressable
                key={b.id}
                style={styles.highlightCard}
                onPress={() => onBookBusiness(b)}
              >
                {b.owner?.avatarUrl ? (
                  <ImageBackground source={{ uri: b.owner.avatarUrl }} style={styles.businessCardBackground} imageStyle={styles.businessCardBackgroundImage}>
                    <View style={styles.businessCardOverlay} />
                    <View style={styles.businessCardContent}>
                      <Text style={styles.businessCardTitle}>{b.name}</Text>
                      <Text style={styles.businessCardSubtitle}>{b.category || "Sin categoría"}</Text>
                    </View>
                  </ImageBackground>
                ) : (
                  <View style={styles.businessCardContent}>
                    <View style={styles.businessLogoFallback}>
                      <Text style={styles.businessLogoText}>{initialsFromName(b.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightTitle}>{b.name}</Text>
                      <Text style={sharedStyles.hint}>{b.category || "Sin categoría"}</Text>
                    </View>
                  </View>
                )}
              </Pressable>
            ))}
            {!filteredBusinesses.length && !isLoading && <Text style={sharedStyles.label}>Aún sin negocios destacados.</Text>}
          </ScrollView>
        </Section>
      </View>

      <View style={sharedStyles.card}>
        <Section title="Explorar negocios">
          <View style={styles.gridCards}>
            {filteredBusinesses.map((b) => (
              <Pressable
                key={b.id}
                style={styles.squareCard}
                onPress={() => onBookBusiness(b)}
              >
                {b.owner?.avatarUrl ? (
                  <ImageBackground source={{ uri: b.owner.avatarUrl }} style={styles.squareCardBackground} imageStyle={styles.businessCardBackgroundImage}>
                    <View style={styles.businessCardOverlay} />
                    <View style={styles.squareCardContent}>
                      <Text style={styles.businessCardTitle} numberOfLines={1}>{b.name}</Text>
                      <Text style={styles.businessCardSubtitle} numberOfLines={1}>{b.category || "Sin categoría"}</Text>
                    </View>
                  </ImageBackground>
                ) : (
                  <View style={styles.squareCardContent}>
                    <View style={styles.businessLogoFallbackSm}>
                      <Text style={styles.businessLogoTextSm}>{initialsFromName(b.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightTitle} numberOfLines={1}>{b.name}</Text>
                      <Text style={sharedStyles.hint} numberOfLines={1}>{b.category || "Sin categoría"}</Text>
                    </View>
                  </View>
                )}
              </Pressable>
            ))}
            {!filteredBusinesses.length && !isLoading && <Text style={sharedStyles.label}>No se encontraron negocios.</Text>}
          </View>
        </Section>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  locationBar: {
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locationBarTitle: { fontSize: 12, fontWeight: "700", color: palette.text },
  locationBarText: { fontSize: 13, color: palette.muted, marginTop: 2 },
  locationRefreshButton: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    backgroundColor: palette.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  locationRefreshText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  highlightCard: {
    width: 160,
    height: 110,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  businessCardBackground: { flex: 1 },
  businessCardBackgroundImage: { borderRadius: 14 },
  businessCardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.38)", borderRadius: 14 },
  businessCardContent: { flex: 1, padding: 10, justifyContent: "flex-end", flexDirection: "row", alignItems: "center", gap: 10 },
  businessCardTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
  businessCardSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  businessLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  businessLogoText: { fontWeight: "700", color: palette.accent, fontSize: 16 },
  highlightTitle: { fontWeight: "700", fontSize: 13, color: palette.text },
  gridCards: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  squareCard: {
    width: "47%",
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  squareCardBackground: { flex: 1 },
  squareCardContent: { flex: 1, padding: 8, justifyContent: "flex-end", flexDirection: "row", alignItems: "center", gap: 8 },
  businessLogoFallbackSm: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  businessLogoTextSm: { fontWeight: "700", color: palette.accent, fontSize: 13 },
});
