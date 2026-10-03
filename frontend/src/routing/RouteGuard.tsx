"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { LoadingState, ErrorState } from "../components/ui";
export function RouteGuard({ permissions, children }: { permissions?: string[]; children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!user) router.replace("/acceso"); }, [user, router]);
  if (!user) return <LoadingState label="Abriendo acceso" />;
  const allowed = !permissions || user.permissions.includes("*") || permissions.some(p => user.permissions.includes(p));
  if (!allowed) return <ErrorState error={new Error("No tienes permiso para consultar esta sección.")} />;
  return children;
}
