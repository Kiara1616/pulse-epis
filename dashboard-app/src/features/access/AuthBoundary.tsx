"use client";

import { AlertCircle, Loader2, LogIn, RefreshCw } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { RoleProvider } from "./RoleProvider";

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { user, status, error, retry, login } = useAuth();

  if (status === "loading") {
    return <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-6 text-slate-600"><div className="flex items-center gap-2" role="status"><Loader2 className="animate-spin" size={20}/>Validando sesión...</div></main>;
  }

  if (status === "error") {
    return <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-6"><section className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm"><AlertCircle className="mx-auto text-rose-500" size={34}/><h1 className="mt-4 text-xl font-bold text-slate-950">No se pudo validar la sesión</h1><p className="mt-2 text-sm text-slate-600">{error}</p><button onClick={retry} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><RefreshCw size={16}/>Reintentar</button></section></main>;
  }

  if (!user) {
    return <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-6"><section className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><LogIn className="mx-auto text-blue-600" size={36}/><h1 className="mt-4 text-2xl font-black text-slate-950">Ingresa a Pulse EPIS</h1><p className="mt-2 text-sm leading-6 text-slate-600">Usa tu cuenta institucional para consultar indicadores o administrar tus certificaciones.</p><button onClick={login} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20"><LogIn size={17}/>Ingresar con Google institucional</button></section></main>;
  }

  return <RoleProvider>{children}</RoleProvider>;
}
