/** Parse a JSON or plain-text API error body into a user-facing message. */
export function parseApiErrorMessage(text: string): string {
  let message = text;
  try {
    const json = JSON.parse(text) as { error?: string };
    if (typeof json.error === "string") {
      message = json.error;
    }
  } catch {
    // Keep raw text when the body is not JSON.
  }
  return message;
}

/** Read and parse an error message from a failed fetch response. */
export async function readApiErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  return parseApiErrorMessage(text) || response.statusText;
}
