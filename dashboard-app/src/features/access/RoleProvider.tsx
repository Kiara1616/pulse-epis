"use client";

import { createContext, useContext } from "react";
import { useAuth } from "./AuthProvider";
import type { AppRole } from "@/shared/api/types";

export type { AppRole } from "@/shared/api/types";

export const roleLabels: Record<AppRole, string> = {
  ADMIN: "Administrador",
  VALIDATOR: "Validador académico",
  STUDENT: "Estudiante",
};

type RoleContextValue = { role: AppRole; email: string };
const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;

  return <RoleContext.Provider value={{ role: user.role, email: user.email }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole debe utilizarse dentro de RoleProvider");
  return context;
}
