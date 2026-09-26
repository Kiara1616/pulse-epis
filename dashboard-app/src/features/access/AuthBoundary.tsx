"use client";

import { AlertCircle, Loader2, LogIn, RefreshCw } from "lucide-react";
import { useState } from "react";
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

    return <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-6"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><LogIn className="mx-auto text-blue-600" size={36}/><h1 className="mt-4 text-2xl font-black text-slate-950">Ingresa a Pulse EPIS</h1>{authProvider === "local" ? <><p className="mt-2 text-sm leading-6 text-slate-600">Modo local de desarrollo. Usa una cuenta demo sintética para recorrer el dashboard.</p><form onSubmit={submitLocalLogin} className="mt-6 space-y-4 text-left"><label className="block text-sm font-semibold text-slate-700" htmlFor="local-email">Correo demo<input id="local-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label><label className="block text-sm font-semibold text-slate-700" htmlFor="local-password">Contraseña<input id="local-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label>{localError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{localError}</p>}<button type="submit" disabled={localSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60"><LogIn size={17}/>{localSubmitting ? "Ingresando..." : "Ingresar con cuenta local"}</button></form><p className="mt-4 text-xs text-slate-500">Demo: admin, validator o student con la contraseña local configurada.</p></> : <><p className="mt-2 text-sm leading-6 text-slate-600">Usa tu cuenta institucional para consultar indicadores o administrar tus certificaciones.</p><button onClick={login} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20"><LogIn size={17}/>Ingresar con Google institucional</button></>}</section></main>;
  }

  return <RoleProvider>{children}</RoleProvider>;
}
