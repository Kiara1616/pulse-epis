"use client";

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

type AsyncStateProps = {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  onRetry: () => void;
  children: React.ReactNode;
};

export function AsyncState({ loading, error, empty = false, onRetry, children }: AsyncStateProps) {
  if (loading) {
    return <div className="flex min-h-64 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500" role="status"><Loader2 className="animate-spin" size={20}/>Cargando datos oficiales...</div>;
  }

  if (error) {
    return <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center"><AlertCircle className="text-rose-500" size={28}/><h3 className="mt-3 font-bold text-rose-900">No se pudo cargar la información</h3><p className="mt-1 max-w-lg text-sm text-rose-800">{error}</p><button onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white"><RefreshCw size={16}/>Reintentar</button></div>;
  }

  if (empty) {
    return <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No hay un snapshot publicado para los filtros seleccionados.</div>;
  }

  return <>{children}</>;
}
