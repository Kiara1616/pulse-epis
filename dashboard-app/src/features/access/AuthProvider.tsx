"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, apiUrl } from "@/shared/api/client";
import type { AuthenticatedUser } from "@/shared/api/types";

type AuthStatus = "loading" | "authenticated" | "anonymous" | "error";

type AuthContextValue = {
  user: AuthenticatedUser | null;
  status: AuthStatus;
  error: string | null;
  retry: () => void;
  login: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const loadUser = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
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

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUser(), 0);
    return () => window.clearTimeout(timer);
  }, [attempt, loadUser]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    error,
    retry: () => setAttempt((current) => current + 1),
    login: () => window.location.assign(apiUrl("/auth/google/login")),
    logout: async () => {
      try {
        await apiFetch<null>("/auth/logout", { method: "POST" });
      } finally {
        setUser(null);
        setStatus("anonymous");
      }
    },
  }), [error, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe utilizarse dentro de AuthProvider");
  return context;
}
