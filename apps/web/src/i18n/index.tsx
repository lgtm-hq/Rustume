import * as i18n from "@solid-primitives/i18n";
import {
  createContext,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onMount,
  useContext,
  type ParentComponent,
} from "solid-js";
import {
  DEFAULT_LOCALE,
  LOCALE_REGISTRY,
  LOCALE_STORAGE_KEY,
  detectLocale,
  getLocaleEntry,
  isRegisteredLocale,
} from "./config";
import enUS from "./locales/en-US.json";
import { setActiveDictionary } from "./translate";

const flattenedEnUS = i18n.flatten(enUS);
type Dictionary = typeof flattenedEnUS;

async function fetchDictionary(locale: string): Promise<Dictionary> {
  if (locale === DEFAULT_LOCALE) {
    return flattenedEnUS;
  }

  try {
    const module = await import(`./locales/${locale}.json`);
    const loaded = i18n.flatten(module.default) as Dictionary;
    return { ...flattenedEnUS, ...loaded };
  } catch {
    return flattenedEnUS;
  }
}

export interface I18nContextValue {
  t: (key: keyof Dictionary & string, params?: Record<string, string | number>) => string;
  locale: () => string;
  setLocale: (locale: string) => void;
  locales: typeof LOCALE_REGISTRY;
  dir: () => "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextValue>();

export const I18nProvider: ParentComponent = (props) => {
  const [locale, setLocaleState] = createSignal(detectLocale());

  const [dict] = createResource(locale, fetchDictionary, {
    initialValue: flattenedEnUS,
  });

  const translator = createMemo(() =>
    i18n.translator(() => dict() ?? flattenedEnUS, i18n.resolveTemplate),
  );

  createEffect(() => {
    const active = dict() ?? flattenedEnUS;
    setActiveDictionary(active);
  });

  createEffect(() => {
    const entry = getLocaleEntry(locale());
    const currentLocale = locale();
    document.documentElement.lang = currentLocale;
    document.documentElement.dir = entry?.dir ?? "ltr";

    const title = translator()("meta.title" as keyof Dictionary);
    if (typeof title === "string") {
      document.title = title;
    }

    const description = translator()("meta.description" as keyof Dictionary);
    if (typeof description === "string") {
      const meta = document.querySelector('meta[name="description"]');
      meta?.setAttribute("content", description);
    }
  });

  const setLocale = (id: string) => {
    if (!isRegisteredLocale(id)) {
      return;
    }
    setLocaleState(id);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, id);
    } catch {
      console.error("Failed to save locale preference");
    }
  };

  onMount(() => {
    setActiveDictionary(dict() ?? flattenedEnUS);
  });

  const value: I18nContextValue = {
    t: (key, params) => {
      const result = params ? translator()(key, params as never) : translator()(key);
      if (typeof result === "string") {
        return result;
      }
      const fallback = flattenedEnUS[key];
      return typeof fallback === "string" ? fallback : key;
    },
    locale,
    setLocale,
    locales: LOCALE_REGISTRY,
    dir: () => getLocaleEntry(locale())?.dir ?? "ltr",
  };

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

export { detectLocale, DEFAULT_LOCALE, LOCALE_STORAGE_KEY, LOCALE_REGISTRY } from "./config";
export { translate } from "./translate";
