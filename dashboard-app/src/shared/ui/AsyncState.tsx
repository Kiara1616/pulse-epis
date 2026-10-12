"use client";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
type AsyncStateProps = {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  onRetry: () => void;
  children: React.ReactNode;
  loadingText?: string;
  emptyText?: string;
  emptyAction?: React.ReactNode;
};
export function AsyncState({
  loading,
  error,
  empty = false,
  onRetry,
  children,
  loadingText = "Cargando información…",
  emptyText = "No hay un snapshot publicado para los filtros seleccionados.",
  emptyAction,
}: AsyncStateProps) {
  if (loading)
    return (
      <div
        className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
        role="status"
        aria-live="polite"
      >
        <Loader2 aria-hidden="true" className="animate-spin" size={20} />
        {loadingText}
      </div>
    );
  if (error)
    return (
      <div
        role="alert"
        className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"
      >
        <AlertCircle aria-hidden="true" className="text-rose-500" size={28} />
        <h3 className="mt-3 font-bold text-rose-900">
          No se pudo cargar la información
        </h3>
        <p className="mt-1 max-w-lg break-words text-sm text-rose-800">
          {error}
        </p>
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <RefreshCw aria-hidden="true" size={16} />
          Reintentar
        </button>
      </div>
    );
  if (empty)
    return (
      <div
        role="status"
        className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500"
      >
        <p>{emptyText}</p>
        {emptyAction}
      </div>
    );
  return <>{children}</>;
}
