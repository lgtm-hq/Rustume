import { toast } from "../components/ui";
import { translate } from "../i18n/translate";

const AUTH_ERROR_KEYS: Record<string, string> = {
  invalid_state: "auth.errors.invalidState",
  authentication_failed: "auth.errors.authenticationFailed",
  server_error: "auth.errors.serverError",
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
    toast.success(translate("auth.signedIn"));
    return;
  }

  if (authError) {
    const key = AUTH_ERROR_KEYS[authError] ?? "auth.errors.generic";
    toast.error(translate(key as "auth.errors.generic"));
  }
}

export function authErrorMessage(code: string): string {
  const key = AUTH_ERROR_KEYS[code] ?? "auth.errors.generic";
  return translate(key as "auth.errors.generic");
}
