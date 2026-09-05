import { delJson, getBlob } from "./client";
import { downloadBlob } from "./export";
import { deleteAccountResponseSchema } from "./schemas";

export interface DeleteAccountResponse {
  deleted: boolean;
  message: string;
}

/** Download a machine-readable copy of all account data as JSON. */
export async function downloadAccountExport(): Promise<void> {
  const blob = await getBlob("/account/export");
  downloadBlob(blob, "rustume-account-export.json");
}

/** Permanently delete the signed-in cloud account and all associated data. */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResponse> {
  return delJson("/account", { confirmation }, deleteAccountResponseSchema);
}
