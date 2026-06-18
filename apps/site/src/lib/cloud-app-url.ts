/** Default hosted Rustume Cloud URL when `PUBLIC_CLOUD_APP_URL` is unset at build time. */
export const DEFAULT_CLOUD_APP_URL = "https://app.rustume.com";

/** Resolve a configured cloud app URL, falling back when unset or blank. */
export function resolveCloudAppUrl(configured: string | undefined): string {
  const trimmed = configured?.trim();
  return trimmed ? trimmed : DEFAULT_CLOUD_APP_URL;
}

/** Hosted Rustume Cloud application URL (OAuth callbacks, docs CTAs). */
export function cloudAppUrl(): string {
  return resolveCloudAppUrl(import.meta.env.PUBLIC_CLOUD_APP_URL);
}
