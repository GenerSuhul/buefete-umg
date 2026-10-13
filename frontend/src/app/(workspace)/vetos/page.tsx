"use client";
import { ClientRestrictionsPage } from '../../../screens/ClientRestrictionsPage';
import { RouteGuard } from '../../../routing/RouteGuard';
export default function Page() {
  return <RouteGuard permissions={['clients.write']}><ClientRestrictionsPage /></RouteGuard>;
}
