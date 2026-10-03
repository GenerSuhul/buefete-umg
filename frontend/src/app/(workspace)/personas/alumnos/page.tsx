"use client";
import { StudentsPage } from "../../../../screens/StudentsPage";
import { RouteGuard } from "../../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["students.read","students.self.read"]}><StudentsPage /></RouteGuard>;
}
