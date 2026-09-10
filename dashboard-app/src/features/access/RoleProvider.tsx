"use client";

import { createContext, useContext, useState } from "react";

export type AppRole = "ADMIN" | "VALIDATOR" | "STUDENT";

export const roleLabels: Record<AppRole, string> = {
  ADMIN: "Administrador",
  VALIDATOR: "Validador académico",
  STUDENT: "Estudiante",
};

type RoleContextValue = { role: AppRole; setRole: (role: AppRole) => void };
const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<AppRole>("ADMIN");

  const setRole = (nextRole: AppRole) => {
    setRoleState(nextRole);
  };

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole debe utilizarse dentro de RoleProvider");
  return context;
}
