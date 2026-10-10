"use client";
import { roleLabels, useRole } from "@/features/access/RoleProvider";

export function Header(){
  const {role,email}=useRole();
  return <header className="min-h-20 border-b border-slate-200/80 bg-white/95 flex items-center justify-between gap-3 px-4 md:px-8 sticky top-0 z-10 backdrop-blur">
    <div className="hidden sm:block"><p className="text-sm font-semibold text-slate-800">{role === "STUDENT" ? "Portal del estudiante" : "Panel académico"}</p></div>
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-3 py-3">
        <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 grid place-items-center text-sm font-bold" title={email}>{roleLabels[role][0]}</div>
        <div className="hidden sm:block"><p className="text-xs font-bold text-slate-700">{roleLabels[role]}</p><p title={email} className="text-xs text-slate-500 max-w-48 truncate">{email}</p></div>
      </div>
    </div>
  </header>;
}
