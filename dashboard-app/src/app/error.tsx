"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="mx-auto max-w-lg rounded-xl border border-rose-200 bg-white p-8"><h1 className="text-2xl font-bold text-slate-950">No se pudo abrir esta sección</h1><p className="mt-3 text-sm text-slate-500">Reintenta la consulta. Si el problema continúa, vuelve a iniciar sesión.</p><button onClick={reset} className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Reintentar</button></section>;
}
