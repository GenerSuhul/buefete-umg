"use client";
import { RetentionPage } from "../../../screens/AdminPages";
import { RouteGuard } from "../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["retention.preview"]}><RetentionPage /></RouteGuard>;
}
