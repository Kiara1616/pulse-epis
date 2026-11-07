"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="surface-card mx-auto max-w-lg p-8"><h1 className="page-title">No se pudo abrir esta sección</h1><p className="page-intro mt-3">Reintenta la consulta. Si el problema continúa, vuelve a iniciar sesión.</p><button onClick={reset} className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Reintentar</button></section>;
}
