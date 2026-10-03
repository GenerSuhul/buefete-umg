"use client";
import { UsersPage } from "../../../screens/AdminPages";
import { RouteGuard } from "../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["users.read"]}><UsersPage /></RouteGuard>;
}
