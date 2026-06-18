import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudAppUrl, DEFAULT_CLOUD_APP_URL, resolveCloudAppUrl } from "./cloud-app-url";

describe("resolveCloudAppUrl", () => {
  it("returns the configured URL when set", () => {
    expect(resolveCloudAppUrl("https://staging.example.com")).toBe("https://staging.example.com");
  });

  it("returns the default when unset", () => {
    expect(resolveCloudAppUrl(undefined)).toBe(DEFAULT_CLOUD_APP_URL);
  });

  it("returns the default when empty or whitespace", () => {
    expect(resolveCloudAppUrl("")).toBe(DEFAULT_CLOUD_APP_URL);
    expect(resolveCloudAppUrl("   ")).toBe(DEFAULT_CLOUD_APP_URL);
  });
});

describe("cloudAppUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the configured public URL from import.meta.env", () => {
    vi.stubEnv("PUBLIC_CLOUD_APP_URL", "https://staging.example.com");
    expect(cloudAppUrl()).toBe("https://staging.example.com");
  });

  it("returns the production default when import.meta.env is unset", () => {
    vi.stubEnv("PUBLIC_CLOUD_APP_URL", "");
    expect(cloudAppUrl()).toBe(DEFAULT_CLOUD_APP_URL);
  });
});
