import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthUser, UserKind } from "../types";
import { api } from "../api/client";
import { decodeJwtPayload } from "../utils";

const STORAGE_TOKEN = "melon_token_v1";
const STORAGE_REFRESH = "melon_refresh_v1";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, kind?: UserKind) => Promise<void>;
  loginWithTokens: (token: string, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTokenRef = useRef<string | null>(null);

  const hydrateUser = useCallback(async (nextToken: string) => {
    try {
      const data = await api.users.me(nextToken);
      const kind = data?.kind === "client" || data?.kind === "business" ? (data.kind as UserKind) : null;
      if (kind) {
        setUser({
          id: data.id,
          email: data.email,
          kind,
          role: typeof data.role === "string" ? data.role : null,
        });
        return;
      }
    } catch {
      // fallback to JWT decode
    }
    const claims = decodeJwtPayload(nextToken);
    const kindClaim = claims?.kind;
    const kind = kindClaim === "client" || kindClaim === "business" ? (kindClaim as UserKind) : null;
    if (kind) {
      setUser({
        id: typeof claims?.sub === "string" ? claims.sub : "me",
        email: typeof claims?.email === "string" ? claims.email : "",
        kind,
        role: null,
      });
    }
  }, []);

  const persistTokens = useCallback(async (accessToken: string, refreshToken?: string) => {
    setToken(accessToken);
    await AsyncStorage.setItem(STORAGE_TOKEN, accessToken);
    if (refreshToken) {
      refreshTokenRef.current = refreshToken;
      await AsyncStorage.setItem(STORAGE_REFRESH, refreshToken);
    }
  }, []);

  const loginWithTokens = useCallback(
    async (accessToken: string, refreshToken?: string) => {
      await persistTokens(accessToken, refreshToken);
      await hydrateUser(accessToken);
    },
    [hydrateUser, persistTokens],
  );

  const login = useCallback(
    async (email: string, password: string, kind?: UserKind) => {
      const res = await api.auth.login(email, password, kind);
      await loginWithTokens(res.token, res.refreshToken);
    },
    [loginWithTokens],
  );

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    refreshTokenRef.current = null;
    await AsyncStorage.multiRemove([STORAGE_TOKEN, STORAGE_REFRESH]);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const rt = refreshTokenRef.current || (await AsyncStorage.getItem(STORAGE_REFRESH));
    if (!rt) return false;
    try {
      const res = await api.auth.refresh(rt);
      await persistTokens(res.token, res.refreshToken);
      return true;
    } catch {
      await logout();
      return false;
    }
  }, [logout, persistTokens]);

  // Restore session from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedRefresh] = await AsyncStorage.multiGet([STORAGE_TOKEN, STORAGE_REFRESH]);
        const accessToken = storedToken[1];
        const refreshToken = storedRefresh[1];
        if (refreshToken) refreshTokenRef.current = refreshToken;
        if (accessToken) {
          setToken(accessToken);
          await hydrateUser(accessToken);
        }
      } catch {
        // ignore storage errors
      } finally {
        setIsLoading(false);
      }
    })();
  }, [hydrateUser]);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, loginWithTokens, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
