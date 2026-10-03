"use client";
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams as useNextSearchParams, useParams as useNextParams } from "next/navigation";
import { useCallback, useMemo, type ComponentProps } from "react";

type LinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & { to: string };
export function Link({ to, ...props }: LinkProps) {
  return <NextLink href={to} prefetch={false} {...props} />;
}
type NavLinkProps = Omit<LinkProps, "className"> & { end?: boolean; className?: string | ((state: { isActive: boolean }) => string) };
export function NavLink({ to, end, className, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === to || (!end && to !== "/" && pathname.startsWith(to + "/"));
  return <Link to={to} aria-current={isActive ? "page" : undefined}
    className={typeof className === "function" ? className({ isActive }) : className} {...props} />;
}
export function useNavigate() {
  const router = useRouter();
  return useCallback((to: string, options?: { replace?: boolean }) => {
    if (options?.replace) router.replace(to); else router.push(to);
  }, [router]);
}
export function useLocation() {
  const pathname = usePathname();
  return useMemo(() => ({ pathname }), [pathname]);
}
export function useParams() { return useNextParams<{ id?: string }>(); }
export function useSearchParams() { return [useNextSearchParams()] as const; }
