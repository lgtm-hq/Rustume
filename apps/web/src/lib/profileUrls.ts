/**
 * Profile-link derivation and consistency checks (#820).
 *
 * A profile row draws its `username` but navigates to its stored `url.href`;
 * nothing else keeps the two in agreement. These helpers derive the href for
 * well-known networks and detect when the text and the destination have
 * drifted apart, so the edit surfaces can repair or flag it instead of
 * shipping a link that goes somewhere other than where it says.
 */

/** Profile-page prefixes for networks whose URLs are `<prefix><username>`. */
const NETWORK_URL_PREFIXES: Readonly<Record<string, string>> = {
  github: "https://github.com/",
  gitlab: "https://gitlab.com/",
  bitbucket: "https://bitbucket.org/",
  linkedin: "https://www.linkedin.com/in/",
  twitter: "https://twitter.com/",
  x: "https://x.com/",
  dribbble: "https://dribbble.com/",
  behance: "https://www.behance.net/",
  medium: "https://medium.com/@",
  youtube: "https://www.youtube.com/@",
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  twitch: "https://www.twitch.tv/",
  codepen: "https://codepen.io/",
  telegram: "https://t.me/",
};

/** `username` as it would appear in a profile URL path. */
function usernameSlug(username: string): string {
  return username.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * The canonical profile URL for a known network and username, or `null` when
 * the network is unknown or the username is empty or not a plausible URL path
 * segment (display names with slashes stay manual).
 */
export function profileUrlFor(network: string, username: string): string | null {
  const prefix = NETWORK_URL_PREFIXES[network.trim().toLowerCase()];
  const user = username.trim();
  if (prefix === undefined || user === "" || /[\\/?#%]/.test(user)) return null;
  return prefix + usernameSlug(user);
}

/**
 * Whether an href is safe to render as a live anchor: http(s) only, so a
 * stored `javascript:` or `data:` URL can never become a clickable link.
 */
export function isHttpHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

/**
 * Whether a stored href plausibly points at the given username's profile.
 * Only meaningful for known networks; unknown networks never mismatch (the
 * username there is free text, not a URL fragment).
 */
/** Hosts that serve the same profiles, so either one matches the network. */
const EQUIVALENT_HOSTS: Readonly<Record<string, readonly string[]>> = {
  "twitter.com": ["x.com"],
  "x.com": ["twitter.com"],
};

/** `hostname` without a leading `www.`, lowercased. */
function bareHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function profileHrefMatches(network: string, username: string, href: string): boolean {
  const prefix = NETWORK_URL_PREFIXES[network.trim().toLowerCase()];
  if (prefix === undefined) return true;
  const slug = usernameSlug(username);
  if (slug === "" || href.trim() === "") return true;
  let parsed: URL;
  try {
    parsed = new URL(withHttps(href));
  } catch {
    // Not a parseable URL at all — it cannot point at the profile.
    return false;
  }
  // The host must belong to the network (regional/mobile subdomains count).
  const expected = bareHost(new URL(prefix).hostname);
  const host = bareHost(parsed.hostname);
  const hosts = [expected, ...(EQUIVALENT_HOSTS[expected] ?? [])];
  if (!hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return false;
  // The username must be a whole path segment, not a substring of one —
  // `/not-turbocoder13` is a different profile than `/turbocoder13`. A
  // `slug-`-prefixed segment stays a match for LinkedIn-style ID suffixes.
  return parsed.pathname
    .toLowerCase()
    .split("/")
    .map((segment) => (segment.startsWith("@") ? segment.slice(1) : segment))
    .some((segment) => segment === slug || segment.startsWith(`${slug}-`));
}

/**
 * Whether inline-edited text reads as a URL or bare domain rather than a
 * label. Bare domains need an alphabetic TLD of 2+ letters, so version-like
 * labels ("v1.2", "1.0.0") and bare IPs never rewrite a stored href.
 */
export function looksLikeUrl(value: string): boolean {
  const text = value.trim();
  if (text === "" || /\s/.test(text)) return false;
  return /^https?:\/\//i.test(text) || /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}([/?#]|$)/i.test(text);
}

/** `value` as an href: untouched with a scheme, `https://`-prefixed without. */
export function withHttps(value: string): string {
  const text = value.trim();
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}
