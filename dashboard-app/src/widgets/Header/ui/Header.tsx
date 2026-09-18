"use client";
import { LogOut, Search } from "lucide-react";
import { roleLabels, useRole } from "@/features/access/RoleProvider";
import { useAuth } from "@/features/access/AuthProvider";

export function Header(){
  const {role,email}=useRole();
  const {logout}=useAuth();
  return <header className="h-20 border-b border-slate-200/80 bg-white flex items-center justify-between px-8 sticky top-0 z-10">
    <div></div>
    <div className="flex items-center gap-4">
      <label className="hidden lg:flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 w-64">
        <Search size={16} className="text-slate-400"/><input aria-label="Buscar en el panel" className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400" placeholder="Buscar en el panel"/>
      </label>
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-2">
        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 grid place-items-center text-sm font-bold" title={email}>{roleLabels[role][0]}</div>
        <div className="hidden sm:block text-right"><p className="text-xs font-bold text-slate-700">{roleLabels[role]}</p><p className="text-[11px] text-slate-400 max-w-40 truncate">{email}</p></div>
        <button onClick={() => void logout()} aria-label="Cerrar sesión" title="Cerrar sesión" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><LogOut size={16}/></button>
      </div>
    </div>
  </header>;
}
