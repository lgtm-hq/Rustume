export interface DeleteAccountResponse {
  deleted: boolean;
  message: string;
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
    throw new Error(text || `Account deletion failed (${response.status})`);
  }

  return (await response.json()) as DeleteAccountResponse;
}
