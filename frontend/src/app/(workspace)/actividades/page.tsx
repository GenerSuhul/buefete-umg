"use client";
import { ActivitiesPage } from "../../../screens/ActivitiesPage";
import { RouteGuard } from "../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["activities.read"]}><ActivitiesPage /></RouteGuard>;
}
