import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { MelonLogo } from "../components/MelonLogo";
import { palette } from "../styles/theme";
import { getErrorMessage, resolveTimezone, COUNTRY_OPTIONS, asiaCountries } from "../utils";
import { api } from "../api/client";
import { UserKind } from "../types";
import { RegisterSheet } from "./RegisterSheet";

WebBrowser.maybeCompleteAuthSession();

type OAuthProviderKey = "google" | "apple" | "line" | "x" | "kazehana";

const OAUTH_ISSUER = process.env.EXPO_PUBLIC_OAUTH_ISSUER as string | undefined;
const OAUTH_CLIENT_ID = process.env.EXPO_PUBLIC_OAUTH_CLIENT_ID as string | undefined;
const OAUTH_SCOPES = ((process.env.EXPO_PUBLIC_OAUTH_SCOPES as string | undefined) || "openid profile email").split(/\s+/).filter(Boolean);
const OAUTH_AUDIENCE = process.env.EXPO_PUBLIC_OAUTH_AUDIENCE as string | undefined;
const OAUTH_EXCHANGE_URL = process.env.EXPO_PUBLIC_OAUTH_EXCHANGE_URL as string | undefined;

export function LoginScreen() {
  const { login, loginWithTokens } = useAuth();
  const [email, setEmail] = useState("cliente@melon.test");
  const [password, setPassword] = useState("1234");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotForm, setShowForgotForm] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showRegisterSheet, setShowRegisterSheet] = useState(false);

  const oauthRedirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: "melon", path: "oauth" }),
    [],
  );

  const oauthEnabled = Boolean(OAUTH_ISSUER && OAUTH_CLIENT_ID);

  const isAsiaRegion = useMemo(() => {
    const tz = resolveTimezone();
    return tz.startsWith("Asia/");
  }, []);

  const socialProviders = useMemo(
    () =>
      isAsiaRegion
        ? [
            { key: "line", label: "LINE", color: "#06C755" },
            { key: "google", label: "G", color: "#DB4437" },
            { key: "x", label: "X", color: "#000000" },
          ]
        : [
            { key: "google", label: "G", color: "#DB4437" },
            { key: "apple", label: "A", color: "#111111" },
            { key: "x", label: "X", color: "#000000" },
          ],
    [isAsiaRegion],
  );

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Faltan datos", "Ingresa tu correo y contraseña.");
      return;
    }
    setIsAuthLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "No se pudo iniciar sesión."));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const targetEmail = (forgotEmail || email).trim();
    if (!targetEmail) {
      Alert.alert("Falta email", "Ingresa el correo para enviar el enlace de recuperación.");
      return;
    }
    setIsSendingForgot(true);
    try {
      await api.auth.forgotPassword(targetEmail);
      Alert.alert("Enlace enviado", "Revisa tu correo para restablecer la contraseña.");
      setShowForgotForm(false);
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "No se pudo enviar el correo. Intenta más tarde."));
    } finally {
      setIsSendingForgot(false);
    }
  };

  const handleOAuthLogin = async (providerKey: OAuthProviderKey = "kazehana") => {
    if (!OAUTH_ISSUER || !OAUTH_CLIENT_ID) {
      Alert.alert("OAuth", "Proveedor no configurado.");
      return;
    }
    setIsAuthLoading(true);
    try {
      const discovery = await AuthSession.fetchDiscoveryAsync(OAUTH_ISSUER);
      const request = new AuthSession.AuthRequest({
        clientId: OAUTH_CLIENT_ID,
        redirectUri: oauthRedirectUri,
        responseType: AuthSession.ResponseType.Code,
        scopes: OAUTH_SCOPES,
        usePKCE: true,
        extraParams: OAUTH_AUDIENCE ? { audience: OAUTH_AUDIENCE } : undefined,
      });
      const result = await request.promptAsync(discovery);
      if (result.type !== "success") return;
      const code = (result as AuthSession.AuthSessionResult & { params?: Record<string, string> }).params?.code;
      if (!code || !request.codeVerifier) throw new Error("OAuth: datos incompletos");
      const tokenRes = await AuthSession.exchangeCodeAsync(
        { clientId: OAUTH_CLIENT_ID, code, redirectUri: oauthRedirectUri, extraParams: { code_verifier: request.codeVerifier } },
        discovery,
      );
      const accessToken = tokenRes.accessToken;
      if (!accessToken) throw new Error("OAuth: no se recibio access_token");

      if (OAUTH_EXCHANGE_URL) {
        const data = await api.auth.oauthExchange({ provider: providerKey, accessToken, idToken: tokenRes.idToken });
        await loginWithTokens(data.token, data.refreshToken);
        return;
      }
      await loginWithTokens(accessToken);
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err, "No se pudo iniciar sesión."));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    if (provider === "google" || provider === "apple" || provider === "line" || provider === "x") {
      await handleOAuthLogin(provider as OAuthProviderKey);
      return;
    }
    Alert.alert("Social", "Proveedor no soportado.");
  };

  return (
    <>
      <LinearGradient colors={["#75cf84", "#2f8f4e"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.fullBackground}>
        <SafeAreaView style={styles.safeLogin}>
          <StatusBar style="light" />
          <ScrollView contentContainerStyle={styles.loginFull} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            <View style={styles.loginCardMock}>
              <View style={styles.loginLogo}>
                <MelonLogo size={86} />
              </View>
              <Text style={styles.loginTitleCenter}>Melon</Text>
              <Text style={styles.loginSubtitleCenter}>Agenda tus Citas</Text>

              <View style={styles.formGap}>
                <View style={styles.inputPillWhite}>
                  <TextInput
                    placeholder="User Name"
                    placeholderTextColor="#2f8f4e"
                    style={styles.inputPillFieldWhite}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
                <View style={styles.inputPillWhite}>
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#2f8f4e"
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
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#2f8f4e" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.loginHelpers}>
                <Pressable style={styles.rememberRow} onPress={() => setRememberMe((v) => !v)}>
                  <View style={[styles.rememberBox, rememberMe && styles.rememberBoxOn]}>
                    {rememberMe && <Text style={styles.rememberCheck}>✓</Text>}
                  </View>
                  <Text style={styles.loginHint}>Remember Password</Text>
                </Pressable>
                <Pressable onPress={() => setShowForgotForm((v) => !v)}>
                  <Text style={styles.loginLink}>Forget Password?</Text>
                </Pressable>
              </View>

              {showForgotForm && (
                <View style={styles.forgotCard}>
                  <Text style={styles.fieldLabel}>Correo de recuperación</Text>
                  <TextInput
                    placeholder="tuemail@ejemplo.com"
                    placeholderTextColor="#9ca3af"
                    style={styles.forgotInput}
                    autoCapitalize="none"
                    keyboardType="email-address"
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
                onPress={handleLogin}
                disabled={isAuthLoading}
              >
                <Text style={styles.loginCtaText}>{isAuthLoading ? "Starting..." : "Sign in"}</Text>
              </Pressable>

              {oauthEnabled && (
                <Pressable
                  style={({ pressed }) => [styles.oauthButton, pressed && styles.pressed]}
                  onPress={() => handleOAuthLogin("kazehana")}
                  disabled={isAuthLoading}
                >
                  <View style={styles.oauthButtonRow}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                    <Text style={styles.oauthButtonText}>Continuar con KazehanaCloud</Text>
                  </View>
                </Pressable>
              )}

              <View style={styles.loginSocialBlock}>
                <Text style={[styles.loginHint, { textAlign: "center" }]}>Sign in with Social Media</Text>
                <View style={styles.socialRowCircle}>
                  {socialProviders.map((s) => (
                    <Pressable
                      key={s.key}
                      style={[styles.socialCircle, { borderColor: s.color }]}
                      onPress={() => handleSocialLogin(s.key)}
                    >
                      <Text style={[styles.socialCircleText, { color: "#FFFFFF" }]}>{s.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  style={{ marginTop: 10 }}
                  onPress={() => setShowRegisterSheet(true)}
                >
                  <Text style={styles.loginLink}>No tienes cuenta? Crea una</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {showRegisterSheet && (
        <RegisterSheet
          onClose={() => setShowRegisterSheet(false)}
          onSuccess={() => setShowRegisterSheet(false)}
          socialProviders={socialProviders}
          onSocialLogin={handleSocialLogin}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fullBackground: { flex: 1 },
  safeLogin: { flex: 1 },
  loginFull: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40, paddingHorizontal: 20 },
  loginCardMock: {
    width: "100%",
    maxWidth: 380,
    gap: 14,
    alignItems: "stretch",
  },
  loginLogo: { alignItems: "center", marginBottom: 8 },
  loginTitleCenter: { textAlign: "center", color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: 1 },
  loginSubtitleCenter: { textAlign: "center", color: "#e5e7eb", fontSize: 14, marginBottom: 4 },
  formGap: { gap: 12 },
  inputPillWhite: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 4,
    minHeight: 52,
  },
  inputPillFieldWhite: { flex: 1, fontSize: 15, color: "#0f172a" },
  passwordToggleButton: { padding: 4 },
  loginHelpers: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rememberBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#2f8f4e",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  rememberBoxOn: { backgroundColor: "#2f8f4e" },
  rememberCheck: { color: "#fff", fontSize: 11, fontWeight: "700" },
  loginHint: { fontSize: 12, color: "#e5e7eb" },
  loginLink: { fontSize: 13, color: "#FFFFFF", fontWeight: "600" },
  forgotCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  fieldLabel: { fontSize: 12, color: "#e5e7eb", fontWeight: "700" },
  forgotInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  loginButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  loginButtonText: { color: "#2f8f4e", fontWeight: "700", fontSize: 14 },
  loginCta: {
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  loginCtaText: { color: "#2f8f4e", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
  oauthButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  oauthButtonRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  oauthButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  loginSocialBlock: { gap: 10, alignItems: "center" },
  socialRowCircle: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 6 },
  socialCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  socialCircleText: { fontWeight: "800", fontSize: 16 },
  pressed: { opacity: 0.7 },
});
