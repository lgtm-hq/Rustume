import { readApiErrorMessage } from "./errors";
import { downloadBlob } from "./export";

export interface DeleteAccountResponse {
  deleted: boolean;
  message: string;
}

/** Download a machine-readable copy of all account data as JSON. */
export async function downloadAccountExport(): Promise<void> {
  const response = await fetch("/api/account/export", { credentials: "include" });
  if (!response.ok) {
    const message = await readApiErrorMessage(response);
    throw new Error(message || `Account export failed (${response.status})`);
  }

  const blob = await response.blob();
  downloadBlob(blob, "rustume-account-export.json");
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
    const message = await readApiErrorMessage(response);
    throw new Error(message || `Account deletion failed (${response.status})`);
  }

  return (await response.json()) as DeleteAccountResponse;
}
