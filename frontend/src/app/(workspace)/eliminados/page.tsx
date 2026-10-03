"use client";
import { DeletedRecordsPage } from "../../../screens/DeletedRecordsPage";
import { RouteGuard } from "../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["records.deleted.read"]}><DeletedRecordsPage /></RouteGuard>;
}
