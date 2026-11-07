"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, GraduationCap, Cpu, ScanSearch, Settings, BadgeCheck, UsersRound, Award, Compass, LogOut, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Database, ChartNoAxesCombined, X } from "lucide-react";
import type { AppRole } from "@/shared/api/types";
import { roleLabels, useRole } from "@/features/access/RoleProvider";
import { useAuth } from "@/features/access/AuthProvider";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { role } = useRole();
  const { logout } = useAuth();
  const adminRouteActive = role === "ADMIN" && (pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/talleres");
  const [adminOpen, setAdminOpen] = useState(adminRouteActive);
  const links: Array<{ href: string; label: string; icon: typeof LayoutDashboard; roles: AppRole[] }> = [
    { href: "/", label: "Resumen", icon: LayoutDashboard, roles: ["ADMIN", "VALIDATOR"] },
    { href: "/tecnologias", label: "Tecnologías", icon: Cpu, roles: ["ADMIN", "VALIDATOR"] },
    { href: "/estudiantes", label: "Estudiantes", icon: GraduationCap, roles: ["ADMIN", "VALIDATOR"] },
    { href: "/brechas", label: "Brechas", icon: ScanSearch, roles: ["ADMIN"] },
    { href: "/reportes", label: "Reportes BI", icon: ChartNoAxesCombined, roles: ["ADMIN", "VALIDATOR"] },
    { href: "/validaciones", label: "Validar", icon: BadgeCheck, roles: ["VALIDATOR"] },
    { href: "/mi-perfil", label: "Credenciales", icon: Award, roles: ["STUDENT"] },
    { href: "/mi-ruta", label: "Mi ruta", icon: Compass, roles: ["STUDENT"] },
    { href: "/talleres", label: "Talleres", icon: CalendarDays, roles: ["ADMIN", "STUDENT"] },
  ];
  const visibleLinks = links.filter((link) => link.roles.includes(role));
  const adminLinks = [
    { href: "/admin", label: "Centro de administración", icon: Settings },
    { href: "/admin/catalogo", label: "Catálogo", icon: Award },
    { href: "/admin/estudiantes", label: "Padrón", icon: UsersRound },
    { href: "/admin/radar", label: "Radar de cursos", icon: ScanSearch },
    { href: "/admin/publicaciones", label: "Publicar indicadores", icon: Database },
    { href: "/talleres", label: "Talleres", icon: CalendarDays },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto rounded-r-3xl bg-gradient-to-b from-[#0b1b32] via-[#102c52] to-[#0b2342] px-2 py-3 text-white shadow-lg shadow-slate-900/15 transition-[transform,width] duration-200 ease-out ${mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full md:visible"} md:translate-x-0 ${collapsed ? "md:w-[76px]" : "md:w-64"}`}
    >
      <div className={`flex items-center ${collapsed ? "gap-2 md:flex-col md:gap-3" : "gap-2"}`}>
        <Link
          href={role === "STUDENT" ? "/mi-perfil" : "/"}
          onClick={onMobileClose}
          aria-label="Pulse EPIS"
          title="Pulse EPIS"
          className={`flex min-w-0 items-center rounded-2xl ${collapsed ? "flex-1 gap-3 px-1 md:justify-center md:px-0" : "flex-1 gap-3 px-1"}`}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white p-1">
            <Image
              src="/epis-logo.png"
              alt="Logo de la Escuela Profesional de Ingeniería de Sistemas"
              width={44}
              height={44}
              priority
              className="h-full w-full object-contain"
            />
          </span>
          <span className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
              <span className="block truncate text-base font-semibold tracking-tight text-white">Pulse EPIS</span>
              <span className="mt-0.5 block truncate text-xs text-blue-200">{roleLabels[role]}</span>
          </span>
        </Link>
        <button type="button" onClick={onMobileClose} aria-label="Cerrar menú lateral" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-blue-100 hover:bg-white/10 md:hidden">
          <X size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
          className={`hidden h-10 w-10 shrink-0 place-items-center rounded-full text-blue-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:grid ${collapsed ? "" : "ml-auto"}`}
        >
          {collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
        </button>
      </div>

      <p className={`mb-3 mt-7 px-3 text-[11px] font-semibold uppercase tracking-wider text-blue-200/70 ${collapsed ? "md:sr-only" : ""}`}>
        Espacio de trabajo
      </p>
      <nav id="primary-navigation" aria-label="Navegación principal" className="w-full space-y-1.5">
        {visibleLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)
            && !visibleLinks.some((other) => other.href !== href && other.href.startsWith(`${href}/`) && pathname.startsWith(other.href)));
          const activeLayout = collapsed
            ? "mr-[-0.5rem] w-[calc(100%+0.5rem)] gap-3 rounded-l-full rounded-r-none px-3 md:-mx-2 md:w-[calc(100%+1rem)] md:justify-center md:px-0"
            : "mr-[-0.5rem] w-[calc(100%+0.5rem)] gap-3 rounded-l-full rounded-r-none px-3";
          const inactiveLayout = collapsed
            ? "w-full gap-3 rounded-full px-3 md:mx-auto md:w-11 md:justify-center md:p-0"
            : "w-full gap-3 rounded-full px-3";
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={collapsed ? label : undefined}
              className={`relative z-10 flex min-h-11 items-center transition-colors ${active ? activeLayout : inactiveLayout} ${active ? "bg-white font-semibold text-blue-900 shadow-sm" : "font-medium text-blue-100 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon size={19} className="shrink-0" />
              <span className={`truncate text-sm ${collapsed ? "md:hidden" : ""}`}>{label}</span>
            </Link>
          );
        })}
        {role === "ADMIN" && <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setAdminOpen((open) => !open)}
            aria-expanded={adminOpen}
            aria-controls="admin-navigation"
            title={collapsed ? "Administrar" : undefined}
            className={`flex min-h-11 items-center transition-colors ${collapsed ? "w-full gap-3 rounded-full px-3 md:mx-auto md:w-11 md:justify-center md:p-0" : "w-full gap-3 rounded-full px-3"} ${adminRouteActive ? "bg-white font-semibold text-blue-900 shadow-sm" : "font-medium text-blue-100 hover:bg-white/10 hover:text-white"}`}
          >
            <Settings size={19} className="shrink-0" />
            <span className={`min-w-0 flex-1 truncate text-left text-sm ${collapsed ? "md:hidden" : ""}`}>Administrar</span>
            <ChevronDown size={17} aria-hidden="true" className={`shrink-0 transition-transform ${adminOpen ? "rotate-180" : ""} ${collapsed ? "md:hidden" : ""}`} />
          </button>
          {adminOpen && <div id="admin-navigation" className={`${collapsed ? "md:hidden" : ""} ml-4 space-y-1 border-l border-white/15 pl-2`}>
            {adminLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return <Link key={href} href={href} onClick={onMobileClose} aria-current={active ? "page" : undefined} className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${active ? "bg-blue-50 font-semibold text-blue-900" : "text-blue-100/90 hover:bg-white/10 hover:text-white"}`}>
                <Icon size={17} className="shrink-0" />
                <span className="truncate">{label}</span>
              </Link>;
            })}
          </div>}
        </div>}
      </nav>

      <div className="mt-auto border-t border-white/15 pt-3">
        <button
          type="button"
          onClick={() => { onMobileClose(); void logout(); }}
          aria-label="Cerrar sesión"
          title={collapsed ? "Cerrar sesión" : undefined}
          className={`flex min-h-11 items-center rounded-full text-sm font-medium text-blue-100/85 transition-colors hover:bg-white/10 hover:text-white ${collapsed ? "w-full gap-3 px-3 md:mx-auto md:w-11 md:justify-center md:p-0" : "w-full gap-3 px-3"}`}
        >
          <LogOut size={18} className="shrink-0" />
          <span className={collapsed ? "md:hidden" : ""}>Cerrar sesión</span>
        </button>
        <p className={`mt-3 px-3 text-xs text-blue-200/60 ${collapsed ? "md:hidden" : ""}`}>EPIS · UPT</p>
      </div>
    </aside>
  );
}
