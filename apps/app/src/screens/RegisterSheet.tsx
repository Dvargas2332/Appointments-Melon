import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { sharedStyles, palette } from "../styles/theme";
import { getErrorMessage } from "../utils";
import { UserKind } from "../types";

const TERMS_URL = "https://68.233.124.190/legal/terms";
const PRIVACY_URL = "https://68.233.124.190/legal/privacy";

type Props = {
  onClose: () => void;
  onSuccess: () => void;
  socialProviders: { key: string; label: string; color: string }[];
  onSocialLogin: (provider: string) => void;
};

export function RegisterSheet({ onClose, onSuccess, socialProviders, onSocialLogin }: Props) {
  const { login } = useAuth();
  const [kind, setKind] = useState<UserKind | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const validate = () => {
    if (!kind) {
      Alert.alert("Tipo de cuenta", "Selecciona si quieres crear cuenta de Cliente o Empresa.");
      return false;
    }
    if (!name.trim()) {
      Alert.alert("Nombre requerido", "Por favor ingresa tu nombre.");
      return false;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Correo inválido", "Por favor ingresa un correo válido.");
      return false;
    }
    if (password.length < 4) {
      Alert.alert("Contraseña muy corta", "La contraseña debe tener al menos 4 caracteres.");
      return false;
    }
    if (kind === "business" && !businessName.trim()) {
      Alert.alert("Nombre de empresa requerido", "Por favor ingresa el nombre de tu empresa.");
      return false;
    }
    if (!termsAccepted) {
      Alert.alert("Términos requeridos", "Debes aceptar los Términos y Condiciones para continuar.");
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (kind === "client") {
        await api.users.registerClient({ name: name.trim(), email: normalizedEmail, password });
      } else {
        await api.users.registerBusiness({
          name: businessName.trim(),
          email: normalizedEmail,
          password,
          role: "BUSINESS_OWNER",
        });
      }
      await login(normalizedEmail, password, kind!);
      onSuccess();
    } catch (err: unknown) {
      Alert.alert("Error al registrar", getErrorMessage(err, "No se pudo crear la cuenta."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={sharedStyles.sheetOverlay}>
      <Pressable style={sharedStyles.sheetBackdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        style={[sharedStyles.sheetCard, styles.card]}
      >
        <View style={sharedStyles.sheetHandle} />

        <View style={sharedStyles.sheetHeader}>
          <Text style={sharedStyles.sheetTitle}>Crear cuenta</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={palette.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {/* Tipo de cuenta */}
          <View style={sharedStyles.tabRow}>
            {(["client", "business"] as UserKind[]).map((k) => (
              <Pressable
                key={k}
                style={[
                  sharedStyles.tabButton,
                  k === "client" ? sharedStyles.tabClient : sharedStyles.tabBusiness,
                  kind === k && sharedStyles.tabButtonActive,
                  kind === k && (k === "client" ? sharedStyles.tabClientActive : sharedStyles.tabBusinessActive),
                ]}
                onPress={() => setKind(k)}
              >
                <Text
                  style={[
                    sharedStyles.tabText,
                    k === "client" ? sharedStyles.tabClientText : sharedStyles.tabBusinessText,
                    kind === k && sharedStyles.tabTextActive,
                  ]}
                >
                  {k === "client" ? "🙋 Cliente" : "🏪 Empresa"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Social login */}
          {socialProviders.length > 0 && (
            <View style={styles.socialRow}>
              <Text style={styles.socialLabel}>O continúa con</Text>
              <View style={styles.socialBtns}>
                {socialProviders.map((s) => (
                  <Pressable
                    key={s.key}
                    style={[styles.socialCircle, { borderColor: s.color }]}
                    onPress={() => onSocialLogin(s.key)}
                  >
                    <Text style={[styles.socialCircleText, { color: s.color }]}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Nombre */}
          <Text style={sharedStyles.fieldLabel}>Nombre completo</Text>
          <TextInput
            style={[sharedStyles.input, styles.input]}
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            autoCapitalize="words"
          />

          {/* Nombre empresa (solo business) */}
          {kind === "business" && (
            <>
              <Text style={sharedStyles.fieldLabel}>Nombre de la empresa</Text>
              <TextInput
                style={[sharedStyles.input, styles.input]}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Ej. Barbería Central"
              />
            </>
          )}

          {/* Correo */}
          <Text style={sharedStyles.fieldLabel}>Correo electrónico</Text>
          <TextInput
            style={[sharedStyles.input, styles.input]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="correo@ejemplo.com"
          />

          {/* Contraseña */}
          <Text style={sharedStyles.fieldLabel}>Contraseña</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[sharedStyles.input, styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="Mínimo 4 caracteres"
            />
            <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={palette.muted} />
            </Pressable>
          </View>

          {/* T&C */}
          <Pressable style={styles.termsRow} onPress={() => setTermsAccepted((v) => !v)}>
            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
              {termsAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.termsText}>
              Acepto los{" "}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>
                Términos y Condiciones
              </Text>
              {" "}y la{" "}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
                Política de Privacidad
              </Text>
            </Text>
          </Pressable>

          {/* Botones */}
          <View style={[sharedStyles.row, styles.actions]}>
            <Pressable
              style={({ pressed }) => [sharedStyles.secondaryButtonFull, pressed && sharedStyles.pressed, { flex: 1 }]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={sharedStyles.buttonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [sharedStyles.primaryButton, pressed && sharedStyles.pressed, { flex: 1, opacity: submitting || !kind || !termsAccepted ? 0.6 : 1 }]}
              onPress={handleRegister}
              disabled={submitting || !kind || !termsAccepted}
            >
              <Text style={sharedStyles.primaryButtonText}>{submitting ? "Creando..." : "Crear cuenta"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 12, gap: 12 },
  scroll: { maxHeight: 480 },
  content: { gap: 10, paddingBottom: 16, paddingHorizontal: 2 },
  input: { backgroundColor: "#fff", borderColor: "#d7ddea", minHeight: 44 },
  passwordRow: { flexDirection: "row", alignItems: "center" },
  passwordInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    height: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: "#d7ddea",
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: "#fff",
  },
  socialRow: { alignItems: "center", gap: 8 },
  socialLabel: { fontSize: 12, color: palette.muted },
  socialBtns: { flexDirection: "row", gap: 12 },
  socialCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  socialCircleText: { fontWeight: "800", fontSize: 15 },
  actions: { marginTop: 4 },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: palette.accent },
  termsText: { flex: 1, fontSize: 12, color: palette.muted, lineHeight: 18 },
  termsLink: { color: palette.accent, textDecorationLine: "underline" },
});
