"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, apiUrl } from "@/shared/api/client";
import type { AuthenticatedUser } from "@/shared/api/types";

type AuthStatus = "loading" | "authenticated" | "anonymous" | "error";
type AuthProviderKind = "google" | "local";

type AuthContextValue = {
  user: AuthenticatedUser | null;
  status: AuthStatus;
  error: string | null;
  authProvider: AuthProviderKind;
  retry: () => void;
  login: () => void;
  loginLocal: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProviderKind>("google");
  const [attempt, setAttempt] = useState(0);

  const loadUser = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const configuration = await apiFetch<{ provider: AuthProviderKind }>("/auth/config");
      setAuthProvider(configuration.provider);
      setUser(await apiFetch<AuthenticatedUser>("/auth/me"));
      setStatus("authenticated");
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        setUser(null);
        setStatus("anonymous");
      } else {
        setStatus("error");
        setError(loadError instanceof Error ? loadError.message : "No se pudo validar la sesión.");
      }
    }
  }, []);

  const loginLocal = useCallback(async (email: string, password: string) => {
    const authenticatedUser = await apiFetch<AuthenticatedUser>("/auth/local/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(authenticatedUser);
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUser(), 0);
    return () => window.clearTimeout(timer);
  }, [attempt, loadUser]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    error,
    authProvider,
    retry: () => setAttempt((current) => current + 1),
    login: () => window.location.assign(apiUrl("/auth/google/login")),
    loginLocal,
    logout: async () => {
      try {
        await apiFetch<null>("/auth/logout", { method: "POST" });
      } finally {
        setUser(null);
        setStatus("anonymous");
      }
    },
  }), [authProvider, error, loginLocal, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe utilizarse dentro de AuthProvider");
  return context;
}
