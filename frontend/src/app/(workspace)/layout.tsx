"use client";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { LoadingState } from "../../components/ui";
import { RouteGuard } from "../../routing/RouteGuard";
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <RouteGuard><AppShell><Suspense fallback={<LoadingState label="Cargando sección" />}>{children}</Suspense></AppShell></RouteGuard>;
}
