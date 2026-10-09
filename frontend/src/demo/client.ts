import type { DataSource } from "../data/dataSource";
import type { TokenResponse } from "../types/domain";
import { readAuthSession, writeAuthSession } from "../data/authSession";

export const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export interface DemoTenant {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}
export interface DemoWorkspace {
  current: DemoTenant;
  tenants: DemoTenant[];
  platformAdmin: boolean;
}

async function encode(value: unknown): Promise<unknown> {
  if (value instanceof File) {
    if (value.size > 3 * 1024 * 1024)
      throw new Error("La demo admite archivos de hasta 3 MB.");
    const bytes = new Uint8Array(await value.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return {
      __file: true,
      name: value.name,
      type: value.type,
      data: btoa(binary),
    };
  }
  if (Array.isArray(value)) return Promise.all(value.map(encode));
  if (value && typeof value === "object")
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([k, v]) => [k, await encode(v)]),
      ),
    );
  return value;
}
export async function demoCall<T>(
  method: string,
  ...args: unknown[]
): Promise<T> {
  const token = readAuthSession()?.accessToken;
  const response = await fetch("/api/demo", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ method, args: await encode(args) }),
    signal: AbortSignal.timeout(60000),
  });
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401 && method !== "login") {
      writeAuthSession(null);
      window.dispatchEvent(new Event("bufete:session-expired"));
    }
    throw new Error(body.detail ?? "No se pudo completar la operación.");
  }
  if (method === "login" || method === "switchTenant")
    writeAuthSession(body as TokenResponse);
  if (method === "logout") writeAuthSession(null);
  if (body?.__blob)
    return new Blob(
      [Uint8Array.from(atob(body.data), (c) => c.charCodeAt(0))],
      { type: body.type },
    ) as T;
  if (body?.__html) return new Blob([body.__html], { type: "text/html" }) as T;
  return body as T;
}
export function createDemoSource(): DataSource {
  return new Proxy(
    { mode: "api" },
    {
      get(target, property) {
        if (property === "mode") return target.mode;
        if (typeof property === "string")
          return (...args: unknown[]) => demoCall(property, ...args);
      },
    },
  ) as DataSource;
}
