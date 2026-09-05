import { delJson, getBlob } from "./client";
import { downloadBlob } from "./export";
import { deleteAccountResponseSchema } from "./schemas";

export interface DeleteAccountResponse {
  deleted: boolean;
  message: string;
}

/**
 * What `GET /api/account/export` contains and omits, as shown to the user.
 * Mirrors the server's `AccountDataExport` allow-list (crates/server/src/db/models.rs)
 * and the cloud-endpoints docs; the page renders from this and its test asserts it.
 */
export const ACCOUNT_EXPORT_CONTENTS = {
  included: [
    "your profile",
    "policy acceptances",
    "billing subscriptions (including Paddle subscription and price ids)",
    "every resume with its retained version snapshots",
    "your account's audit trail (including the IP addresses recorded with each event)",
  ],
  excluded: ["sessions", "the WorkOS user id", "the Paddle customer id", "share password hashes"],
} as const;

/** Download a machine-readable copy of all account data as JSON. */
export async function downloadAccountExport(): Promise<void> {
  const blob = await getBlob("/account/export");
  downloadBlob(blob, "rustume-account-export.json");
}

/** Permanently delete the signed-in cloud account and all associated data. */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResponse> {
  return delJson("/account", { confirmation }, deleteAccountResponseSchema);
}
