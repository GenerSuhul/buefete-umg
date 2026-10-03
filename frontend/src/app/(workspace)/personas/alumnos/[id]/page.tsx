"use client";
import { StudentDetailPage } from "../../../../../screens/StudentDetailPage";
import { RouteGuard } from "../../../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["students.read","students.self.read"]}><StudentDetailPage /></RouteGuard>;
}
