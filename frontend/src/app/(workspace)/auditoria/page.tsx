"use client";
import { AuditPage } from "../../../screens/AdminPages";
import { RouteGuard } from "../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["audit.read"]}><AuditPage /></RouteGuard>;
}
