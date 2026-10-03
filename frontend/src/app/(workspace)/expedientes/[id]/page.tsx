"use client";
import { CaseDetailPage } from "../../../../screens/CaseDetailPage";
import { RouteGuard } from "../../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["cases.read","cases.assigned.read"]}><CaseDetailPage /></RouteGuard>;
}
