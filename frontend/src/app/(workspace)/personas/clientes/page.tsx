"use client";
import { ClientsPage } from "../../../../screens/ClientsPage";
import { RouteGuard } from "../../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["clients.read"]}><ClientsPage /></RouteGuard>;
}
