import { toast } from "../components/ui";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Sign-in was interrupted. Please try again.",
  authentication_failed: "We couldn't sign you in. Please try again.",
  server_error: "Something went wrong on our end. Please try again later.",
};

/** Show one-time auth toasts from OAuth redirect query params and clean the URL. */
export function handleAuthQueryParams(): void {
  const params = new URLSearchParams(window.location.search);
  const signedIn = params.get("signed_in");
  const authError = params.get("auth_error");

  if (!signedIn && !authError) {
    return;
  }

  params.delete("signed_in");
  params.delete("auth_error");
  const remaining = params.toString();
  const nextUrl = remaining ? `${window.location.pathname}?${remaining}` : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);

  if (signedIn === "1") {
    toast.success("You're signed in to Rustume Cloud.");
    return;
  }

  if (authError) {
    const message = AUTH_ERROR_MESSAGES[authError] ?? "Sign-in failed. Please try again.";
    toast.error(message);
  }
}

export function authErrorMessage(code: string): string {
  return AUTH_ERROR_MESSAGES[code] ?? "Sign-in failed. Please try again.";
}
