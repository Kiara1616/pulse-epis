import Link from "next/link";
export default function NotFound() {
  return <section className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8"><p className="text-sm font-semibold text-blue-600">Página no encontrada · 404</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Esta dirección no está disponible</h1><p className="mt-3 text-sm text-slate-500">Comprueba la dirección o vuelve a tu espacio para continuar.</p><Link href="/" className="mt-5 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Volver a mi espacio</Link></section>;
}
