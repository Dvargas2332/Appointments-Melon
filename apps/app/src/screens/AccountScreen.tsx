import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  Linking,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { sharedStyles, palette } from "../styles/theme";
import { getErrorMessage } from "../utils";

const GOOGLE_PLAY_SUBSCRIPTIONS = "https://play.google.com/store/account/subscriptions";
const TERMS_URL = "https://68.233.124.190/legal/terms";
const PRIVACY_URL = "https://68.233.124.190/legal/privacy";

type Props = {
  onClose: () => void;
};

type Section = "main" | "delete";

export function AccountScreen({ onClose }: Props) {
  const { user, token, logout } = useAuth();
  const isBusiness = user?.kind === "business";

  const [section, setSection] = useState<Section>("main");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCancelMembership = () => {
    Alert.alert(
      "Cancelar membresía",
      "Serás redirigido a Google Play para cancelar tu suscripción. El acceso premium permanecerá activo hasta el fin del período pagado.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Ir a Google Play", onPress: () => Linking.openURL(GOOGLE_PLAY_SUBSCRIPTIONS) },
      ]
    );
  };

  const handleDeleteConfirm = async () => {
    if (!password.trim()) {
      Alert.alert("Contraseña requerida", "Ingresa tu contraseña para confirmar.");
      return;
    }
    if (!token) return;
    setDeleting(true);
    try {
      await api.users.deleteMe(token, password);
      await logout();
    } catch (err) {
      Alert.alert("Error", getErrorMessage(err, "No se pudo eliminar la cuenta."));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteRequest = () => {
    Alert.alert(
      "¿Eliminar cuenta?",
      "Esta acción es permanente. Se eliminarán todos tus datos, citas e historial. No se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () => setSection("delete"),
        },
      ]
    );
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          {section === "delete" ? (
            <Pressable onPress={() => { setSection("main"); setPassword(""); }} hitSlop={10}>
              <Ionicons name="arrow-back" size={20} color={palette.text} />
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}
          <Text style={styles.title}>
            {section === "delete" ? "Eliminar cuenta" : "Mi cuenta"}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={palette.text} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* ── Main section ── */}
          {section === "main" && (
            <>
              {/* User info */}
              <View style={styles.infoCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(user?.email?.[0] ?? "U").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.email}>{user?.email}</Text>
                  <Text style={styles.kind}>
                    {isBusiness ? "Cuenta Empresa" : "Cuenta Cliente"}
                  </Text>
                </View>
              </View>

              {/* Membership (business only) */}
              {isBusiness && (
                <>
                  <Text style={styles.sectionLabel}>MEMBRESÍA</Text>
                  <Pressable style={styles.row} onPress={handleCancelMembership}>
                    <View style={styles.rowLeft}>
                      <Ionicons name="card-outline" size={20} color={palette.accent} />
                      <Text style={styles.rowText}>Cancelar membresía</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={palette.muted} />
                  </Pressable>
                  <Text style={styles.hint}>
                    La cancelación se gestiona desde Google Play. El acceso premium sigue activo hasta el fin del período pagado.
                  </Text>
                </>
              )}

              {/* Legal */}
              <Text style={styles.sectionLabel}>LEGAL</Text>
              <Pressable style={styles.row} onPress={() => Linking.openURL(TERMS_URL)}>
                <View style={styles.rowLeft}>
                  <Ionicons name="document-text-outline" size={20} color={palette.muted} />
                  <Text style={styles.rowText}>Términos y Condiciones</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.muted} />
              </Pressable>
              <Pressable style={[styles.row, styles.rowLast]} onPress={() => Linking.openURL(PRIVACY_URL)}>
                <View style={styles.rowLeft}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={palette.muted} />
                  <Text style={styles.rowText}>Política de Privacidad</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.muted} />
              </Pressable>

              {/* Danger zone */}
              <Text style={styles.sectionLabel}>ZONA DE PELIGRO</Text>
              <Pressable style={[styles.row, styles.rowLast, styles.rowDanger]} onPress={handleDeleteRequest}>
                <View style={styles.rowLeft}>
                  <Ionicons name="trash-outline" size={20} color={palette.danger} />
                  <Text style={[styles.rowText, { color: palette.danger }]}>Eliminar mi cuenta</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.danger} />
              </Pressable>
              <Text style={styles.hint}>
                Eliminar tu cuenta borrará permanentemente todos tus datos. Esta acción no se puede deshacer.
              </Text>
            </>
          )}

          {/* ── Delete section ── */}
          {section === "delete" && (
            <>
              <View style={styles.warningCard}>
                <Ionicons name="warning-outline" size={28} color={palette.danger} />
                <Text style={styles.warningTitle}>Acción permanente</Text>
                <Text style={styles.warningText}>
                  Se eliminarán tu cuenta, perfil, historial de citas y todos tus datos. No podrás recuperarlos.
                </Text>
              </View>

              <Text style={sharedStyles.fieldLabel}>Confirma tu contraseña</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[sharedStyles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Tu contraseña actual"
                  autoCapitalize="none"
                />
                <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={palette.muted} />
                </Pressable>
              </View>

              <Pressable
                style={[styles.deleteBtn, (deleting || !password.trim()) && styles.deleteBtnDisabled]}
                onPress={handleDeleteConfirm}
                disabled={deleting || !password.trim()}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.deleteBtnText}>Eliminar cuenta definitivamente</Text>
                  </>
                )}
              </Pressable>

              <Pressable style={styles.cancelBtn} onPress={() => { setSection("main"); setPassword(""); }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9000,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: "85%",
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: palette.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    marginBottom: 4,
  },
  title: { fontSize: 16, fontWeight: "700", color: palette.text },
  content: { paddingTop: 12, paddingBottom: 8, gap: 2 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: palette.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: palette.accentSoft,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: palette.accent },
  email: { fontSize: 14, fontWeight: "600", color: palette.text },
  kind: { fontSize: 12, color: palette.muted, marginTop: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.muted,
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  rowLast: {
    borderBottomWidth: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  rowDanger: { borderColor: "#fde8e8" },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowText: { fontSize: 14, color: palette.text },
  hint: { fontSize: 12, color: palette.muted, lineHeight: 18, marginTop: 6, marginBottom: 4, paddingHorizontal: 2 },
  warningCard: {
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#fde8e8",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  warningTitle: { fontSize: 16, fontWeight: "700", color: palette.danger },
  warningText: { fontSize: 13, color: palette.text, textAlign: "center", lineHeight: 20 },
  passwordRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  passwordInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderColor: "#d7ddea",
    minHeight: 44,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  eyeBtn: {
    height: 44, paddingHorizontal: 12,
    justifyContent: "center",
    borderWidth: 1, borderLeftWidth: 0,
    borderColor: "#d7ddea",
    borderTopRightRadius: 8, borderBottomRightRadius: 8,
    backgroundColor: "#fff",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: palette.danger,
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 10,
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelBtnText: { fontSize: 14, color: palette.muted },
});
