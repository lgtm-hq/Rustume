import { describe, expect, it } from "vitest";
import {
  isHttpHref,
  looksLikeUrl,
  profileHrefMatches,
  profileUrlFor,
  withHttps,
} from "../profileUrls";

describe("profileUrlFor", () => {
  it.each([
    ["GitHub", "TurboCoder13", "https://github.com/turbocoder13"],
    ["github", "TurboCoder13", "https://github.com/turbocoder13"],
    ["LinkedIn", "Eitel Dagnin", "https://www.linkedin.com/in/eitel-dagnin"],
    ["GitLab", "someone", "https://gitlab.com/someone"],
    ["Medium", "writer", "https://medium.com/@writer"],
  ])("derives %s/%s", (network, username, expected) => {
    expect(profileUrlFor(network, username)).toBe(expected);
  });

  it("returns null for unknown networks", () => {
    expect(profileUrlFor("Portfolio", "someone")).toBeNull();
  });

  it("returns null for empty or delimiter-carrying usernames", () => {
    expect(profileUrlFor("GitHub", "")).toBeNull();
    expect(profileUrlFor("GitHub", "  ")).toBeNull();
    expect(profileUrlFor("GitHub", "org/repo")).toBeNull();
    expect(profileUrlFor("GitHub", "user?query")).toBeNull();
    expect(profileUrlFor("GitHub", "user#frag")).toBeNull();
    expect(profileUrlFor("GitHub", "user%2e")).toBeNull();
    expect(profileUrlFor("GitHub", "user\\path")).toBeNull();
  });
});

describe("profileHrefMatches", () => {
  it("flags an href that does not mention the username", () => {
    expect(profileHrefMatches("GitHub", "TurboCoder13", "https://github.com/lgtm-hq")).toBe(false);
  });

  it("accepts an href containing the username slug", () => {
    expect(profileHrefMatches("GitHub", "TurboCoder13", "https://github.com/TurboCoder13")).toBe(
      true,
    );
    expect(
      profileHrefMatches(
        "LinkedIn",
        "Eitel Dagnin",
        "https://www.linkedin.com/in/eitel-dagnin-b72439132",
      ),
    ).toBe(true);
  });

  it("rejects the username as a substring of a different path segment", () => {
    expect(
      profileHrefMatches("GitHub", "TurboCoder13", "https://github.com/not-turbocoder13"),
    ).toBe(false);
  });

  it("rejects the username appearing only in another path or query value", () => {
    expect(
      profileHrefMatches("GitHub", "TurboCoder13", "https://github.com/lgtm-hq?ref=turbocoder13"),
    ).toBe(false);
    expect(
      profileHrefMatches("GitHub", "TurboCoder13", "https://github.com/lgtm-hq#turbocoder13"),
    ).toBe(false);
  });

  it("rejects a matching username on the wrong host", () => {
    expect(profileHrefMatches("GitHub", "TurboCoder13", "https://example.com/turbocoder13")).toBe(
      false,
    );
  });

  it("accepts network subdomains and www variants", () => {
    expect(
      profileHrefMatches("GitHub", "TurboCoder13", "https://www.github.com/turbocoder13"),
    ).toBe(true);
    expect(
      profileHrefMatches("LinkedIn", "Eitel Dagnin", "https://de.linkedin.com/in/eitel-dagnin"),
    ).toBe(true);
  });

  it("treats twitter.com and x.com as the same network", () => {
    expect(profileHrefMatches("Twitter", "someone", "https://x.com/someone")).toBe(true);
    expect(profileHrefMatches("X", "someone", "https://twitter.com/someone")).toBe(true);
  });

  it("never mismatches for unknown networks or empty inputs", () => {
    expect(profileHrefMatches("Portfolio", "Some Name", "https://example.com")).toBe(true);
    expect(profileHrefMatches("GitHub", "", "https://github.com/lgtm-hq")).toBe(true);
    expect(profileHrefMatches("GitHub", "TurboCoder13", "")).toBe(true);
  });
});

describe("looksLikeUrl", () => {
  it.each([
    ["https://github.com/TurboCoder13", true],
    ["github.com/TurboCoder13", true],
    ["example.com", true],
    ["My portfolio", false],
    ["", false],
    ["plainword", false],
    ["v1.2", false],
    ["1.0.0", false],
    ["192.168.1.1", false],
  ])("%s -> %s", (value, expected) => {
    expect(looksLikeUrl(value)).toBe(expected);
  });
});

describe("isHttpHref", () => {
  it("accepts only http(s) URLs", () => {
    expect(isHttpHref("https://github.com/TurboCoder13")).toBe(true);
    expect(isHttpHref("http://example.com")).toBe(true);
    expect(isHttpHref("javascript:alert(1)")).toBe(false);
    expect(isHttpHref("data:text/html,hi")).toBe(false);
    expect(isHttpHref("")).toBe(false);
  });
});

describe("withHttps", () => {
  it("prefixes bare domains and keeps schemes", () => {
    expect(withHttps("github.com/TurboCoder13")).toBe("https://github.com/TurboCoder13");
    expect(withHttps("http://example.com")).toBe("http://example.com");
    expect(withHttps("https://example.com")).toBe("https://example.com");
  });
});
