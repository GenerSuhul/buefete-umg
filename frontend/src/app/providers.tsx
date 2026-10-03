"use client";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider } from "../context/AuthContext";
import { FeedbackProvider } from "../components/ui/Feedback";
import { AppErrorBoundary } from "../components/ui/AppErrorBoundary";
import { LoadingState } from "../components/ui";

export function Providers({ children }: { children: ReactNode }) {
  // The API session is tab-scoped; never share session-dependent server markup.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <LoadingState label="Preparando acceso seguro" />;
  return <AppErrorBoundary><FeedbackProvider><AuthProvider>{children}</AuthProvider></FeedbackProvider></AppErrorBoundary>;
}
