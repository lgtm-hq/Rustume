import { describe, expect, it } from "vitest";
import { cloudAppUrl, DEFAULT_CLOUD_APP_URL } from "./cloud-app-url";

describe("cloudAppUrl", () => {
  it("returns the configured public URL or the production default", () => {
    expect(cloudAppUrl()).toBe(import.meta.env.PUBLIC_CLOUD_APP_URL ?? DEFAULT_CLOUD_APP_URL);
    expect(DEFAULT_CLOUD_APP_URL).toBe("https://app.rustume.com");
  });
});
