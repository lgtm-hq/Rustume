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
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  return (payload as { require_auth?: boolean }).require_auth === true;
}

function parseAuthUserPayload(payload: unknown): { user: AuthUser; requireAuth: boolean } {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Auth probe failed: invalid /auth/me response");
  }

  const record = payload as Record<string, unknown>;
  const id = record.id;
  const plan = record.plan;
  const username = record.username;

  if (typeof id !== "string" || typeof plan !== "string" || typeof username !== "string") {
    throw new Error("Auth probe failed: invalid /auth/me response");
  }

  const user: AuthUser = { id, plan, username };

  if (typeof record.email === "string") {
    user.email = record.email;
  }

  const subscription = record.subscription;
  // Malformed subscription payloads (missing or non-string status) are treated as
  // absent so /auth/me parsing stays tolerant of partial API responses.
  if (typeof subscription === "object" && subscription !== null) {
    const status = (subscription as { status?: unknown }).status;
    if (typeof status === "string") {
      user.subscription = { status };
      const expiresAt = (subscription as { expires_at?: unknown }).expires_at;
      if (typeof expiresAt === "string") {
        user.subscription.expires_at = expiresAt;
      }
    }
  }

  return { user, requireAuth: record.require_auth === true };
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
  const { user, requireAuth } = parseAuthUserPayload(payload);
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
