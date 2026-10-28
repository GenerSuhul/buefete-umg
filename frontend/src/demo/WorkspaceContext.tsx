import { useEffect } from "react";
import { demoCall, type DemoWorkspace } from "./client";

export function WorkspaceContext({
  onWorkspaceName,
  onPlatformAdmin,
}: {
  onWorkspaceName: (name: string) => void;
  onPlatformAdmin: (value: boolean) => void;
}) {
  useEffect(() => {
    let active = true;
    demoCall<DemoWorkspace>("getWorkspace")
      .then((w) => {
        if (active) {
          onWorkspaceName(w.current.name);
          onPlatformAdmin(w.platformAdmin);
        }
      })
      .catch(() => {
        if (active) {
          onWorkspaceName("No se pudo verificar la sede. Recargue la página.");
          onPlatformAdmin(false);
        }
      });
    return () => {
      active = false;
    };
  }, [onWorkspaceName, onPlatformAdmin]);
  return null;
}
