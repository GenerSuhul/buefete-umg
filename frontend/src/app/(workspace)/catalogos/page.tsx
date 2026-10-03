"use client";
import { CatalogsPage } from "../../../screens/AdminPages";
import { RouteGuard } from "../../../routing/RouteGuard";
export default function Page() {
  return <RouteGuard permissions={["catalogs.manage"]}><CatalogsPage /></RouteGuard>;
}
