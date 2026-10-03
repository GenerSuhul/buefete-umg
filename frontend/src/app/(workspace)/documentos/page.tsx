"use client";
import { DocumentsPage } from "../../../screens/DocumentsPage";
import { RouteGuard } from "../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["documents.read"]}><DocumentsPage /></RouteGuard>;
}
