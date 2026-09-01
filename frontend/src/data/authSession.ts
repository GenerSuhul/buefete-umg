import type { AuthenticatedUser, TokenResponse } from "../types/domain";

const TOKEN_KEY = "bufete_umg_session";
let memorySession: TokenResponse | null = null;

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isAuthenticatedUser = (value: unknown): value is AuthenticatedUser => {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<AuthenticatedUser>;
  return isString(user.id) &&
    isString(user.username) &&
    isString(user.email) &&
    isString(user.fullName) &&
    Array.isArray(user.roles) &&
    user.roles.every(isString) &&
    Array.isArray(user.permissions) &&
    user.permissions.every(isString);
};

const isTokenResponse = (value: unknown): value is TokenResponse => {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<TokenResponse>;
  return isString(session.accessToken) &&
    isString(session.accessTokenExpiresAtUtc) &&
    isString(session.refreshToken) &&
    isString(session.refreshTokenExpiresAtUtc) &&
    isAuthenticatedUser(session.user);
};

export function readAuthSession(): TokenResponse | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return memorySession;
    const parsed: unknown = JSON.parse(raw);
    if (isTokenResponse(parsed)) {
      memorySession = parsed;
      return parsed;
    }
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* Storage may be unavailable. */ }
  }
  memorySession = null;
  return null;
}

export function writeAuthSession(value: TokenResponse | null) {
  memorySession = value;
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // The in-memory session keeps the current tab usable when storage is blocked.
  }
}

export function updateAuthSessionUser(
  summary: Pick<AuthenticatedUser, "fullName" | "email" | "photoDocumentId">,
) {
  const session = readAuthSession();
  if (!session) return;
  writeAuthSession({
    ...session,
    user: { ...session.user, ...summary },
  });
}
