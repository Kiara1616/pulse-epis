import Link from "next/link";
export default function NotFound() {
  return <section className="surface-card mx-auto max-w-lg p-8"><h1 className="page-title">Esta dirección no está disponible</h1><p className="page-intro mt-3">Comprueba la dirección o vuelve a tu espacio.</p><Link href="/" className="mt-5 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Volver a mi espacio</Link></section>;
}
