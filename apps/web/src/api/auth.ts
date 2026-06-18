export interface AuthUser {
  id: string;
  plan: string;
  email?: string;
  first_name?: string;
  last_name?: string;
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

/** Build a display label from profile fields, falling back to email or a generic label. */
export function userDisplayName(
  user: Pick<AuthUser, "email" | "first_name" | "last_name">,
): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  if (user.email) {
    return user.email;
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

  const payload = (await response.json()) as AuthUser & { require_auth?: boolean };
  const { require_auth: requireAuthRaw, ...user } = payload;
  return {
    mode: "cloud",
    user: user as AuthUser,
    requireAuth: requireAuthRaw === true,
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
