"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { DashboardPage } from "../../screens/DashboardPage";
import { LoadingState } from "../../components/ui";
export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const ownCasesOnly = !!user?.permissions.includes("cases.assigned.read") && !user.permissions.includes("cases.read") && !user.permissions.includes("*");
  useEffect(() => { if (ownCasesOnly) router.replace("/expedientes"); }, [ownCasesOnly, router]);
  return ownCasesOnly ? <LoadingState label="Abriendo expedientes" /> : <DashboardPage />;
}
