import { authRequireAuthSchema, parseAuthMePayload } from "./schemas";

export interface SubscriptionInfo {
  status: string;
  expires_at?: string;
}

export interface AuthUser {
  id: string;
  plan: string;
  email?: string;
  username: string;
  subscription?: SubscriptionInfo;
}

export type AuthProbeResult =
  | { mode: "self-hosted" }
  | { mode: "cloud"; user: AuthUser | null; requireAuth: boolean };

function parseRequireAuth(payload: unknown): boolean {
  const result = authRequireAuthSchema.safeParse(payload);
  return result.success && result.data.require_auth === true;
}

/** Build a display label from the username, falling back to a generic label. */
export function userDisplayName(user: Pick<AuthUser, "username">): string {
  if (user.username) {
    return user.username;
  }
  return "Account";
}

/** Detect cloud mode and current session via `/auth/me`. */
export async function probeAuth(): Promise<AuthProbeResult> {
  const response = await fetch("/auth/me", { credentials: "include" });

  if (response.status === 404) {
    return { mode: "self-hosted" };
  }

  if (response.status === 401) {
    const payload = await response.json().catch(() => ({}));
    return { mode: "cloud", user: null, requireAuth: parseRequireAuth(payload) };
  }

  if (!response.ok) {
    throw new Error(`Auth probe failed (${response.status})`);
  }

  const payload = await response.json();
  const { user, requireAuth } = parseAuthMePayload(payload);
  return {
    mode: "cloud",
    user,
    requireAuth,
  };
}

export function login(): void {
  window.location.href = "/auth/login";
}

export async function logout(): Promise<void> {
  const response = await fetch("/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Logout failed (${response.status})`);
  }
}
