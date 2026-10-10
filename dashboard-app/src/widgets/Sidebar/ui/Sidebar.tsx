"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, GraduationCap, Cpu, ScanSearch, Settings, BadgeCheck, UsersRound, Award, LogOut } from "lucide-react";
import type { AppRole } from "@/shared/api/types";
import { useRole } from "@/features/access/RoleProvider";
import { useAuth } from "@/features/access/AuthProvider";

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useRole();
  const { logout } = useAuth();
  const links: Array<{ href:string; label:string; icon:typeof LayoutDashboard; roles:AppRole[] }> = [
    { href:"/", label:"Resumen", icon:LayoutDashboard, roles:["ADMIN","VALIDATOR"] },
    { href:"/tecnologias", label:"Tecnologías", icon:Cpu, roles:["ADMIN","VALIDATOR"] },
    { href:"/estudiantes", label:"Estudiantes", icon:GraduationCap, roles:["ADMIN","VALIDATOR"] },
    { href:"/brechas", label:"Brechas", icon:ScanSearch, roles:["ADMIN"] },
    { href:"/admin", label:"Administrar", icon:Settings, roles:["ADMIN"] },
    { href:"/admin/estudiantes", label:"Padrón", icon:UsersRound, roles:["ADMIN"] },
    { href:"/admin/publicaciones", label:"Publicar indicadores", icon:LayoutDashboard, roles:["ADMIN"] },
    { href:"/validaciones", label:"Validar", icon:BadgeCheck, roles:["VALIDATOR"] },
    { href:"/mi-perfil", label:"Credenciales", icon:Award, roles:["STUDENT"] },
  ];
  return <aside className="fixed inset-y-0 left-0 z-20 w-20 md:w-56 bg-[#102c52] px-2 md:px-4 py-6 flex flex-col items-center border-r border-white/10 overflow-y-auto">
    <Link href={role === "STUDENT" ? "/mi-perfil" : "/"} className="flex items-center gap-3 md:w-full mb-2" aria-label="Pulse EPIS"><span className="h-12 w-12 shrink-0 rounded-xl bg-white p-1 grid place-items-center"><Image src="/epis-logo.png" alt="Logo de la Escuela Profesional de Ingeniería de Sistemas" width={48} height={48} priority className="h-full w-full object-contain"/></span><span className="hidden md:block"><span className="block text-base font-bold text-white">Pulse EPIS</span><span className="block mt-0.5 text-xs text-blue-200">Gestión de certificaciones</span></span></Link>
    <div className="h-px w-12 bg-white/20 my-4"/>
    <nav aria-label="Navegación principal" className="w-full space-y-2">{links.filter(link=>link.roles.includes(role)).map(link=>{const active=pathname===link.href||(link.href!=="/"&&pathname.startsWith(`${link.href}/`)&&!links.some(other=>other.href!==link.href&&other.href.startsWith(`${link.href}/`)&&pathname.startsWith(other.href)));return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} title={link.label} className={`group flex flex-col md:flex-row items-center gap-2 md:gap-3 rounded-xl px-1 md:px-3 py-3 text-[10px] md:text-sm font-semibold transition ${active?"bg-blue-600 text-white shadow-sm":"text-blue-100 hover:bg-white/10 hover:text-white"}`}><link.icon size={19} className="shrink-0"/><span>{link.label}</span></Link>})}</nav>
    <div className="mt-auto pt-8 w-full">
      <div className="border-t border-white/10 pt-3">
        <button onClick={() => void logout()} aria-label="Cerrar sesión" title="Cerrar sesión" className="flex w-full items-center justify-center md:justify-start gap-3 rounded-lg px-3 py-3 text-sm font-medium text-blue-200/70 transition hover:bg-white/5 hover:text-white"><LogOut size={18} className="shrink-0"/><span className="hidden md:inline">Cerrar sesión</span></button>
      </div>
      <p className="hidden md:block mt-3 px-3 text-xs text-blue-200/50">EPIS · UPT</p>
    </div>
  </aside>;
}
