import accountExportContents from "../../../../crates/server/src/db/account_export_contents.json";
import { delJson, getBlob } from "./client";
import { downloadBlob } from "./export";
import { deleteAccountResponseSchema } from "./schemas";

export interface DeleteAccountResponse {
  deleted: boolean;
  message: string;
}

/**
 * What `GET /api/account/export` contains and omits, as shown to the user.
 * The wording lives in a JSON file shared with the server, whose test pins it to
 * the `AccountDataExport` allow-list and the cloud-endpoints docs.
 */
export const ACCOUNT_EXPORT_CONTENTS = {
  included: accountExportContents.included.map((item) => item.text),
  excluded: accountExportContents.excluded.map((item) => item.text),
};

/** Download a machine-readable copy of all account data as JSON. */
export async function downloadAccountExport(): Promise<void> {
  const blob = await getBlob("/account/export");
  downloadBlob(blob, "rustume-account-export.json");
}

/** Permanently delete the signed-in cloud account and all associated data. */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResponse> {
  return delJson("/account", { confirmation }, deleteAccountResponseSchema);
}
