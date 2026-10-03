"use client";
import { ClientDetailPage } from "../../../../../screens/ClientDetailPage";
import { RouteGuard } from "../../../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["clients.read"]}><ClientDetailPage /></RouteGuard>;
}
