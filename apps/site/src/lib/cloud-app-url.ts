/** Default hosted Rustume Cloud URL when `PUBLIC_CLOUD_APP_URL` is unset at build time. */
export const DEFAULT_CLOUD_APP_URL = "https://app.rustume.com";

/** Hosted Rustume Cloud application URL (OAuth callbacks, docs CTAs). */
export function cloudAppUrl(): string {
  return import.meta.env.PUBLIC_CLOUD_APP_URL ?? DEFAULT_CLOUD_APP_URL;
}
