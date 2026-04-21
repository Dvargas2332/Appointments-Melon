import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { MelonLogo } from "../components/MelonLogo";
import { ClientHomeScreen } from "./ClientHomeScreen";
import { ClientAgendaScreen } from "./ClientAgendaScreen";
import { BusinessScreen } from "./BusinessScreen";
import { sharedStyles, palette } from "../styles/theme";
import { initialsFromName, resolveTimezone } from "../utils";
import { Business, ScheduleSource } from "../types";

type ClientTab = "home" | "agenda";

export function MainApp() {
  const { user, logout, isLoading } = useAuth();
  const [clientTab, setClientTab] = useState<ClientTab>("home");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const currentZone = resolveTimezone();

  const isClient = user?.kind === "client";
  const isBusiness = user?.kind === "business";

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  const handleBookBusiness = (_business: Business) => {
    // Booking modal handled inline — placeholder for future navigation
  };

  const handleOpenPreview = (_source: ScheduleSource, _id: string) => {
    // Preview modal handled inline — placeholder for future navigation
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={sharedStyles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={sharedStyles.container} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <View style={{ gap: 16 }}>
            {/* Brand header */}
            <View style={styles.brandRow}>
              <View style={styles.brandTitleRow}>
                <MelonLogo size={50} />
                <Text style={styles.brandTitle}>Melon</Text>
              </View>
              <Text style={styles.brandSubtitle}>Agenda segura y separada por negocio</Text>
            </View>

            {/* Client profile + tabs */}
            {isClient && (
              <View style={[sharedStyles.card, showMenu ? styles.cardMenuOpen : null]}>
                <View style={styles.profileRow}>
                  <Pressable style={styles.avatar}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{initialsFromName(user?.email)}</Text>
                    )}
                  </Pressable>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={sharedStyles.title}>{user?.email || "Cliente"}</Text>
                  </View>
                  <View style={styles.topRightButtons}>
                    <View style={styles.menuAnchor}>
                      <Pressable style={styles.menuButton} onPress={() => setShowMenu((v) => !v)}>
                        <Ionicons name="settings-outline" size={18} color={palette.accent} />
                      </Pressable>
                      {showMenu && (
                        <View style={styles.menu}>
                          <Pressable
                            style={styles.menuItem}
                            onPress={() => { setShowMenu(false); logout(); }}
                          >
                            <Text style={styles.menuText}>Log out</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Client tabs */}
                <View style={sharedStyles.tabRow}>
                  {(["home", "agenda"] as ClientTab[]).map((tab) => (
                    <Pressable
                      key={tab}
                      style={[
                        sharedStyles.tabButton,
                        sharedStyles.tabClient,
                        clientTab === tab && [sharedStyles.tabButtonActive, sharedStyles.tabClientActive],
                      ]}
                      onPress={() => setClientTab(tab)}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {tab === "home" && (
                          <Ionicons name="home-outline" size={16} color={clientTab === tab ? "#fff" : palette.accent} />
                        )}
                        <Text
                          style={[
                            sharedStyles.tabText,
                            sharedStyles.tabClientText,
                            clientTab === tab && sharedStyles.tabTextActive,
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

            {/* Business header */}
            {isBusiness && (
              <View style={sharedStyles.card}>
                <View style={sharedStyles.rowBetween}>
                  <Text style={sharedStyles.sectionTitle}>Panel de negocio</Text>
                  <Pressable
                    style={styles.menuButton}
                    onPress={() => { logout(); }}
                  >
                    <Ionicons name="log-out-outline" size={20} color={palette.danger} />
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* Screens */}
          {isClient && clientTab === "home" && (
            <ClientHomeScreen onBookBusiness={handleBookBusiness} />
          )}
          {isClient && clientTab === "agenda" && (
            <ClientAgendaScreen
              currentZone={currentZone}
              onOpenPreview={handleOpenPreview}
            />
          )}
          {isBusiness && <BusinessScreen />}
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.background },
  brandRow: { gap: 4 },
  brandTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandTitle: { fontSize: 22, fontWeight: "800", color: palette.text },
  brandSubtitle: { fontSize: 12, color: palette.muted },
  cardMenuOpen: { zIndex: 6000, elevation: 60, position: "relative", overflow: "visible" },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontWeight: "700", color: palette.accent, fontSize: 16 },
  topRightButtons: { flexDirection: "row", gap: 8, alignItems: "center" },
  menuAnchor: { position: "relative" },
  menuButton: { padding: 6 },
  menu: {
    position: "absolute",
    top: 32,
    right: 0,
    backgroundColor: palette.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    minWidth: 160,
    zIndex: 9000,
    elevation: 90,
    overflow: "visible",
  },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.border },
  menuText: { fontSize: 14, color: palette.text },
});
