"use client";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { roleLabels, useRole } from "@/features/access/RoleProvider";

const genericAccountNames = new Set(["admin", "administrator", "student", "validator", "user", "usuario"]);

function greetingName(email: string, role: keyof typeof roleLabels, displayName: string | null) {
  if (displayName?.trim()) return displayName.trim();
  const localPart = email.trim().split("@")[0] ?? "";
  const words = localPart.split(/[._-]+/).filter(Boolean);
  const looksLikeName = words.length > 0
    && words.length <= 3
    && words.every((word) => /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]{2,}$/.test(word))
    && !genericAccountNames.has(localPart.toLowerCase());

  return looksLikeName
    ? words.map((word) => word.charAt(0).toLocaleUpperCase("es-PE") + word.slice(1).toLocaleLowerCase("es-PE")).join(" ")
    : roleLabels[role];
}

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { email, role, displayName } = useRole();
  const name = greetingName(email, role, displayName);
  const firstName = name.split(/\s+/)[0] || name;

  return (
    <header className={`flex min-h-16 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8 ${pathname === "/" ? "justify-between" : "justify-end"}`}>
      <button type="button" onClick={onOpenMenu} aria-label="Abrir menú lateral" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden">
        <Menu size={21} aria-hidden="true" />
      </button>
      {pathname === "/" && <p className="mr-auto text-base font-semibold tracking-tight text-slate-900 sm:text-xl">Hola, {firstName}</p>}
      <div className="min-w-0 text-left sm:text-right" aria-label={`Cuenta vinculada a ${email}`}>
        <span className="block truncate text-sm font-semibold leading-5 text-slate-900">{name}</span>
        <span title={email} className="block truncate text-xs leading-4 text-slate-500 sm:text-sm">{email}</span>
      </div>
    </header>
  );
}
