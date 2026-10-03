import Link from "next/link";
export default function NotFound() {
  return <main className="empty-state"><h1>Página no encontrada</h1><p>El enlace no corresponde a una sección disponible.</p><Link href="/">Volver al inicio</Link></main>;
}
