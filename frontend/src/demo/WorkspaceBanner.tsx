import { Building2, BookOpen, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "../routing/navigation";
import { demoCall, type DemoWorkspace } from "./client";

export function WorkspaceBanner({
  onWorkspaceName,
}: {
  onWorkspaceName: (name: string) => void;
}) {
  const [workspace, setWorkspace] = useState<DemoWorkspace | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    demoCall<DemoWorkspace>("getWorkspace")
      .then((w) => {
        if (active) {
          setWorkspace(w);
          onWorkspaceName(w.current.name);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [onWorkspaceName]);
  return (
    <aside className="demo-banner" aria-label="Entorno de demostración">
      <div>
        <ShieldCheck size={20} />
        <span>
          <strong>DEMO · Sólo datos ficticios</strong>
          <small>
            {error
              ? "No se pudo verificar la sede. Recargue antes de continuar."
              : (workspace?.current.name ?? "Verificando sede…")}
          </small>
        </span>
      </div>
      <nav aria-label="Herramientas de demo">
        <Link to="/sedes">
          <Building2 size={17} /> Sedes
        </Link>
        <a href="/manual-demo.pdf" target="_blank" rel="noreferrer">
          <BookOpen size={17} /> Manual
        </a>
      </nav>
    </aside>
  );
}
