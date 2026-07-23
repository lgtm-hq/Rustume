import { A } from "@solidjs/router";

/** Browsewrap consent shown at sign-in entry points. */
export function PolicyConsent() {
  return (
    <p class="text-xs text-stone text-center max-w-sm" data-testid="policy-consent">
      By continuing, you agree to the{" "}
      <A href="/terms" class="underline hover:text-ink">
        Terms of Service
      </A>{" "}
      and{" "}
      <A href="/privacy" class="underline hover:text-ink">
        Privacy Policy
      </A>
      .
    </p>
  );
}
