"use client";
import { AccountPage } from "../../../screens/AccountPage";
import { RouteGuard } from "../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard><AccountPage /></RouteGuard>;
}
