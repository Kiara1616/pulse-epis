"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { AppRole, roleLabels, useRole } from "./RoleProvider";

export function RoleGate({ allow, children }: { allow: AppRole[]; children: React.ReactNode }) {
  const { role } = useRole();
  if (allow.includes(role)) return children;

  return (
    <div className="surface-card mx-auto mt-16 max-w-xl p-10 text-center">
      <LockKeyhole className="mx-auto text-amber-500 mb-4" size={36} />
      <h2 className="section-title">Acceso restringido</h2>
      <p className="text-gray-500 mt-2">El rol {roleLabels[role]} no tiene permiso para abrir esta sección.</p>
      <Link href={role === "STUDENT" ? "/mi-perfil" : "/"} className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold">Volver a mi espacio</Link>
    </div>
  );
}
