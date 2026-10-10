"use client";

import { AlertCircle, Loader2, LogIn, RefreshCw } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { useAuth } from "./AuthProvider";
import { RoleProvider } from "./RoleProvider";

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { user, status, error, retry, login, loginLocal, authProvider } = useAuth();
  const [email, setEmail] = useState("admin@local.pulse-epis.test");
  const [password, setPassword] = useState("pulse-local-demo");
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  if (status === "loading") {
    return <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-6 text-slate-600"><div className="flex items-center gap-2" role="status"><Loader2 className="animate-spin" size={20}/>Validando sesión...</div></main>;
  }

  if (status === "error") {
    return <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-6"><section className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm"><AlertCircle className="mx-auto text-rose-500" size={34}/><h1 className="mt-4 text-xl font-bold text-slate-950">No se pudo validar la sesión</h1><p className="mt-2 text-sm text-slate-600">{error}</p><button onClick={retry} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><RefreshCw size={16}/>Reintentar</button></section></main>;
  }

  if (!user) {
    async function submitLocalLogin(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setLocalError(null);
      setLocalSubmitting(true);
      try {
        await loginLocal(email, password);
      } catch (loginError) {
        setLocalError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión.");
      } finally {
        setLocalSubmitting(false);
      }
    }

    return <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-6"><section className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-6 py-10 text-center sm:px-10"><Image src="/epis-logo.png" alt="Escuela Profesional de Ingeniería de Sistemas" width={64} height={64} priority className="mx-auto"/><h1 className="mt-6 text-[22px] font-semibold tracking-tight text-[#102c52]">Ingresa a Pulse EPIS</h1>{authProvider === "local" ? <><p className="mt-3 text-sm leading-6 text-slate-500">Modo local de desarrollo. Usa una cuenta demo sintética para recorrer el dashboard.</p><form onSubmit={submitLocalLogin} className="mt-6 space-y-4 text-left"><label className="block text-sm font-semibold text-slate-700" htmlFor="local-email">Correo demo<input id="local-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label><label className="block text-sm font-semibold text-slate-700" htmlFor="local-password">Contraseña<input id="local-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label>{localError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{localError}</p>}<button type="submit" disabled={localSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60"><LogIn size={17}/>{localSubmitting ? "Ingresando..." : "Ingresar con cuenta local"}</button></form><p className="mt-4 text-xs text-slate-500">Demo: admin, validator o student con la contraseña local configurada.</p></> : <><p className="mt-3 text-sm leading-6 text-slate-500">Usa tu cuenta institucional para consultar indicadores o administrar tus certificaciones.</p><button onClick={login} className="mt-7 inline-flex w-full justify-center items-center gap-3 rounded-md bg-[#102c52] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0c2240] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#102c52]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor"><path d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.88-1.73 2.99-4.28 2.99-7.36Z"/><path d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.22-2.51c-.9.6-2.04.97-3.39.97-2.6 0-4.81-1.76-5.6-4.12H3.08v2.59A10 10 0 0 0 12 22Z"/><path d="M6.4 13.93a6 6 0 0 1 0-3.86V7.48H3.08a10 10 0 0 0 0 9.04l3.32-2.59Z"/><path d="M12 5.95c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.92 5.48l3.32 2.59C7.19 7.71 9.4 5.95 12 5.95Z"/></svg>Ingresar con Google institucional</button></>}</section></main>;
  }

  return <RoleProvider>{children}</RoleProvider>;
}
