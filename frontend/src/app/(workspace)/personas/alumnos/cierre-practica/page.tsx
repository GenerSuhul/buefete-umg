"use client";
import { PracticeClosuresPage } from '../../../../../screens/PracticeClosuresPage';
import { RouteGuard } from '../../../../../routing/RouteGuard';
export default function Page() {
  return <RouteGuard permissions={['students.read']}><PracticeClosuresPage /></RouteGuard>;
}
