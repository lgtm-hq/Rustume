import * as i18n from "@solid-primitives/i18n";
import enUS from "./locales/en-US.json";

const baseDict = i18n.flatten(enUS);
type Dictionary = typeof baseDict;

let activeDict: Dictionary = baseDict;

const translator = i18n.translator(() => activeDict, i18n.resolveTemplate);

/** Sync the module-level translator used outside components (stores, libs). */
export function setActiveDictionary(dict: Dictionary): void {
  activeDict = dict;
}

/** Translate a key outside Solid components (e.g. store toasts). */
export function translate(
  key: keyof Dictionary & string,
  params?: Record<string, string | number>,
): string {
  const result = params ? translator(key, params as never) : translator(key);
  if (typeof result === "string") {
    return result;
  }
  const fallback = baseDict[key as keyof Dictionary];
  if (typeof fallback === "string") {
    return fallback;
  }
  return key;
}

export { baseDict };
