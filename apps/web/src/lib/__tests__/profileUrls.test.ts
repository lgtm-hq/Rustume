import { describe, expect, it } from "vitest";
import { looksLikeUrl, profileHrefMatches, profileUrlFor, withHttps } from "../profileUrls";

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

  it("returns null for empty or path-carrying usernames", () => {
    expect(profileUrlFor("GitHub", "")).toBeNull();
    expect(profileUrlFor("GitHub", "  ")).toBeNull();
    expect(profileUrlFor("GitHub", "org/repo")).toBeNull();
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
  ])("%s -> %s", (value, expected) => {
    expect(looksLikeUrl(value)).toBe(expected);
  });
});

describe("withHttps", () => {
  it("prefixes bare domains and keeps schemes", () => {
    expect(withHttps("github.com/TurboCoder13")).toBe("https://github.com/TurboCoder13");
    expect(withHttps("http://example.com")).toBe("http://example.com");
    expect(withHttps("https://example.com")).toBe("https://example.com");
  });
});
