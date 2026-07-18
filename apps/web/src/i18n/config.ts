export const LOCALE_STORAGE_KEY = "rustume-locale";
export const DEFAULT_LOCALE = "en-US";

export type TextDirection = "ltr" | "rtl";

export interface LocaleEntry {
  id: string;
  nativeName: string;
  dir: TextDirection;
}

/** Registered locales that ship a catalog in this PR. Additional locales land in #371. */
export const LOCALE_REGISTRY: readonly LocaleEntry[] = [
  { id: "en-US", nativeName: "English (US)", dir: "ltr" },
] as const;

/** Region → preferred locale when an exact match is unavailable. */
export const REGION_FALLBACKS: Record<string, string> = {
  "fr-CA": "fr-FR",
  "en-GB": "en-US",
  "en-AU": "en-US",
  "es-MX": "es-ES",
  "pt-BR": "pt-PT",
};

const REGISTERED_IDS = new Set(LOCALE_REGISTRY.map((entry) => entry.id));

export function isRegisteredLocale(id: string): boolean {
  return REGISTERED_IDS.has(id);
}

export function getLocaleEntry(id: string): LocaleEntry | undefined {
  return LOCALE_REGISTRY.find((entry) => entry.id === id);
}

/** Detection order: localStorage → navigator.language (with region fallback) → en-US. */
export function detectLocale(): string {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved && isRegisteredLocale(saved)) {
        return saved;
      }
    } catch {
      // fall through
    }
  }

  if (typeof navigator !== "undefined" && navigator.language) {
    const nav = navigator.language;
    if (isRegisteredLocale(nav)) {
      return nav;
    }

    const regionFallback = REGION_FALLBACKS[nav];
    if (regionFallback && isRegisteredLocale(regionFallback)) {
      return regionFallback;
    }

    const language = nav.split("-")[0];
    const languageMatch = LOCALE_REGISTRY.find((entry) => entry.id.startsWith(`${language}-`));
    if (languageMatch) {
      return languageMatch.id;
    }
  }

  return DEFAULT_LOCALE;
}
