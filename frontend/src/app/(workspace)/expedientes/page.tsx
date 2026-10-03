"use client";
import { CasesPage } from "../../../screens/CasesPage";
import { RouteGuard } from "../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["cases.read","cases.assigned.read"]}><CasesPage /></RouteGuard>;
}
