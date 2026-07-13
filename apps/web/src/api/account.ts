export interface DeleteAccountResponse {
  deleted: boolean;
  message: string;
}

export interface UpdateAccountResponse {
  username: string;
}

const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "auth",
  "account",
  "resume",
  "r",
  "rustume",
  "settings",
  "support",
  "help",
  "www",
  "root",
  "login",
  "logout",
  "signup",
  "register",
  "dashboard",
  "billing",
  "export",
  "import",
  "me",
]);

/** Client-side username validation mirroring the server rules. */
export function validateUsername(username: string): string | null {
  const normalized = username.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 32) {
    return "Username must be 3-32 characters";
  }
  if (normalized.startsWith("-") || normalized.endsWith("-") || normalized.includes("--")) {
    return "Username cannot start, end, or contain consecutive hyphens";
  }
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    return "Username may only contain lowercase letters, digits, and hyphens";
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return "Username is reserved";
  }
  return null;
}

/** Update the signed-in user's display username. */
export async function updateUsername(username: string): Promise<UpdateAccountResponse> {
  const response = await fetch("/api/account", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (typeof json.error === "string") {
        message = json.error;
      }
    } catch {
      // Keep raw text when the body is not JSON.
    }
    throw new Error(message || `Username update failed (${response.status})`);
  }

  return (await response.json()) as UpdateAccountResponse;
}

/** Permanently delete the signed-in cloud account and all associated data. */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResponse> {
  const response = await fetch("/api/account", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (typeof json.error === "string") {
        message = json.error;
      }
    } catch {
      // Keep raw text when the body is not JSON.
    }
    throw new Error(message || `Account deletion failed (${response.status})`);
  }

  return (await response.json()) as DeleteAccountResponse;
}
