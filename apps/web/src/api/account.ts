import { delJson } from "./client";
import { deleteAccountResponseSchema } from "./schemas";

export interface DeleteAccountResponse {
  deleted: boolean;
  message: string;
}

/** Permanently delete the signed-in cloud account and all associated data. */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResponse> {
  return delJson("/account", { confirmation }, deleteAccountResponseSchema);
}
