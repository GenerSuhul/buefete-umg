"use client";
import { ReportsPage } from "../../../screens/ReportsPage";
import { RouteGuard } from "../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["reports.generate"]}><ReportsPage /></RouteGuard>;
}
