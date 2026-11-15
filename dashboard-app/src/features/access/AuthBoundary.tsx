"use client";

import { AlertCircle, Loader2, LogIn, RefreshCw } from "lucide-react";
import Image from "next/image";
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
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-6 text-slate-600">
        <div className="flex items-center gap-2" role="status">
          <Loader2 className="animate-spin" size={20} />
          Validando sesión...
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-6">
        <section className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto text-rose-500" size={34} />
          <h1 className="mt-4 text-xl font-bold text-slate-950">No se pudo validar la sesión</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button onClick={retry} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">
            <RefreshCw size={16} />
            Reintentar
          </button>
        </section>
      </main>
    );
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

    if (authProvider === "local") {
      return (
        <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-6">
          <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
            <Image src="/epis-logo.png" alt="Escuela Profesional de Ingeniería de Sistemas" width={64} height={64} priority className="mx-auto" />
            <p className="eyebrow mt-6">Entorno de desarrollo</p>
            <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-[#102c52]">Ingresa a Pulse EPIS</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Acceso local habilitado únicamente para pruebas.</p>
            <form onSubmit={submitLocalLogin} className="mt-6 space-y-4 text-left">
              <label className="block text-sm font-semibold text-slate-700" htmlFor="local-email">
                Correo
                <input id="local-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="local-password">
                Contraseña
                <input id="local-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              {localError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{localError}</p>}
              <button type="submit" disabled={localSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60">
                <LogIn size={17} />
                {localSubmitting ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          </section>
        </main>
      );
    }

    return <GoogleLoginView onLogin={login} />;
  }

  return <RoleProvider>{children}</RoleProvider>;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor">
      <path d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.88-1.73 2.99-4.28 2.99-7.36Z" />
      <path d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.22-2.51c-.9.6-2.04.97-3.39.97-2.6 0-4.81-1.76-5.6-4.12H3.08v2.59A10 10 0 0 0 12 22Z" />
      <path d="M6.4 13.93a6 6 0 0 1 0-3.86V7.48H3.08a10 10 0 0 0 0 9.04l3.32 2.59Z" />
      <path d="M12 5.95c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.92 5.48l3.32 2.59C7.19 7.71 9.4 5.95 12 5.95Z" />
    </svg>
  );
}

function GoogleLoginView({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="min-h-screen bg-[#eef3fa] p-4 sm:p-6 lg:p-10">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(15,49,95,0.14)] sm:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden min-h-[680px] overflow-hidden bg-[#0d315f] lg:block">
          <Image src="/login-lab.png" alt="Laboratorio de cómputo" fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(5,34,71,.84)_0%,rgba(11,67,126,.62)_48%,rgba(7,28,61,.88)_100%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white xl:p-14">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/95 p-2 shadow-lg shadow-slate-950/20">
                <Image src="/epis-logo.png" alt="" width={40} height={42} priority />
              </span>
              <div>
                <p className="text-lg font-semibold tracking-tight">Pulse EPIS</p>
                <p className="text-xs text-blue-100">Inteligencia para la formación profesional</p>
              </div>
            </div>
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Escuela Profesional de Ingeniería de Sistemas</p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white xl:text-5xl">Convierte tus certificaciones en decisiones.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-blue-100">Un espacio institucional para consultar indicadores, validar evidencias y descubrir oportunidades de formación.</p>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-white/20 pt-5 text-xs text-blue-100">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/95 p-1.5 shadow-lg shadow-slate-950/20">
                <Image src="/upt-logo.png" alt="Universidad Privada de Tacna" width={26} height={35} className="h-8 w-auto object-contain" />
              </span>
              <span className="rounded-full border border-white/20 px-3 py-1.5">Acceso seguro</span>
            </div>
          </div>
        </section>

        <section className="flex min-h-[620px] items-center justify-center px-6 py-12 sm:px-12 lg:min-h-[680px] lg:px-16">
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-3 lg:hidden">
              <Image src="/epis-logo.png" alt="Escuela Profesional de Ingeniería de Sistemas" width={48} height={50} priority />
              <div>
                <p className="font-semibold tracking-tight text-[#102c52]">Pulse EPIS</p>
                <p className="text-xs text-slate-500">Acceso institucional</p>
              </div>
            </div>
            <p className="eyebrow mt-10 lg:mt-0">Acceso institucional</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#102c52]">Ingresa a Pulse EPIS</h2>
            <p className="mt-4 text-[15px] leading-7 text-slate-600">Accede con tu cuenta Google institucional.</p>
            <button onClick={onLogin} className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#123866] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(18,56,102,.2)] transition hover:bg-[#0d2c54] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#123866]">
              <GoogleMark />
              Continuar con Google
            </button>
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-[#31527f]">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">✓</span>
              <p>Solo para cuentas autorizadas.</p>
            </div>
            <p className="mt-6 text-center text-xs leading-5 text-slate-400">Inicio de sesión seguro con Google.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
