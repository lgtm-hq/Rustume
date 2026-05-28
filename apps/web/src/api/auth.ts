export interface AuthUser {
  id: string;
  plan: string;
}

export type AuthProbeResult = { mode: "self-hosted" } | { mode: "cloud"; user: AuthUser | null };

/** Detect cloud mode and current session via `/auth/me`. */
export async function probeAuth(): Promise<AuthProbeResult> {
  const response = await fetch("/auth/me", { credentials: "include" });

  if (response.status === 404) {
    return { mode: "self-hosted" };
  }

  if (response.status === 401) {
    return { mode: "cloud", user: null };
  }

  if (!response.ok) {
    throw new Error(`Auth probe failed (${response.status})`);
  }

  const user = (await response.json()) as AuthUser;
  return { mode: "cloud", user };
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
