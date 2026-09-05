import usernameRules from "../../../../crates/server/src/auth/username_rules.json";
import { delJson, patch } from "./client";
import {
  type UpdateAccountResponse,
  deleteAccountResponseSchema,
  updateAccountResponseSchema,
} from "./schemas";

export type { UpdateAccountResponse } from "./schemas";

export interface DeleteAccountResponse {
  deleted: boolean;
  message: string;
}

// Shared with the server (crates/server/src/auth/username.rs includes the same
// file), so reserved names, length bounds, and the charset/hyphen pattern
// cannot drift between the two.
const RESERVED_USERNAMES: ReadonlySet<string> = new Set(usernameRules.reserved);
const USERNAME_MIN_LENGTH: number = usernameRules.min_length;
const USERNAME_MAX_LENGTH: number = usernameRules.max_length;
const USERNAME_PATTERN = new RegExp(usernameRules.pattern);
const USERNAME_CHARSET_PATTERN = new RegExp(usernameRules.charset_pattern);
const USERNAME_MESSAGES = usernameRules.messages;
const USERNAME_LENGTH_MESSAGE = USERNAME_MESSAGES.length
  .replace("{min}", String(USERNAME_MIN_LENGTH))
  .replace("{max}", String(USERNAME_MAX_LENGTH));

/** Client-side username validation mirroring the server rules. */
export function validateUsername(username: string): string | null {
  const normalized = username.trim().toLowerCase();
  if (normalized.length < USERNAME_MIN_LENGTH || normalized.length > USERNAME_MAX_LENGTH) {
    return USERNAME_LENGTH_MESSAGE;
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    // The pattern is the rule; the two messages only explain which part of it
    // failed. Same split as the server, driven by the shared charset_pattern.
    return USERNAME_CHARSET_PATTERN.test(normalized)
      ? USERNAME_MESSAGES.hyphens
      : USERNAME_MESSAGES.charset;
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return USERNAME_MESSAGES.reserved;
  }
  return null;
}

/** Update the signed-in user's display username. */
export async function updateUsername(username: string): Promise<UpdateAccountResponse> {
  return patch("/account", { username }, updateAccountResponseSchema);
}

/** Permanently delete the signed-in cloud account and all associated data. */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResponse> {
  return delJson("/account", { confirmation }, deleteAccountResponseSchema);
}
