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
    { href:"/validaciones", label:"Validar", icon:BadgeCheck, roles:["VALIDATOR"] },
    { href:"/mi-perfil", label:"Credenciales", icon:Award, roles:["STUDENT"] },
  ];
  return <aside className="fixed inset-y-0 left-0 z-20 w-28 bg-[#1a73e8] rounded-r-3xl px-3 py-5 flex flex-col items-center shadow-lg">
    <Link href="/" className="h-16 w-16 rounded-2xl bg-white p-1.5 shadow-md grid place-items-center mb-2" aria-label="Pulse EPIS"><Image src="/epis-logo.png" alt="Logo de la Escuela Profesional de Ingeniería de Sistemas" width={58} height={58} priority className="h-full w-full object-contain"/></Link>
    <div className="h-px w-12 bg-white/20 my-4"/>
    <nav className="w-full space-y-2">{links.filter(link=>link.roles.includes(role)).map(link=>{const active=pathname===link.href||(link.href!=="/"&&pathname.startsWith(`${link.href}/`));return <Link key={link.href} href={link.href} title={link.label} className={`group flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[10px] font-semibold transition ${active?"bg-white text-[#1a73e8] shadow-md":"text-blue-100 hover:bg-white/10 hover:text-white"}`}><link.icon size={19}/><span>{link.label}</span></Link>})}</nav>
    <button onClick={() => void logout()} title="Cerrar sesión" aria-label="Cerrar sesión" className="mt-auto h-11 w-11 rounded-xl grid place-items-center text-blue-100 hover:bg-white/20 hover:text-white"><LogOut size={19}/></button>
  </aside>;
}
