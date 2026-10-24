import en from "../../messages/en.json";
import id from "../../messages/id.json";

export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];
export type MessageKey = keyof typeof id;

const messages: Record<Locale, Record<MessageKey, string>> = { id, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

// Cookie wins; otherwise the first supported language in Accept-Language; otherwise Indonesian.
export function resolveLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  for (const part of acceptLanguage?.split(",") ?? []) {
    const lang = part.split(";")[0]?.trim().slice(0, 2).toLowerCase();
    if (isLocale(lang)) return lang;
  }
  return "id";
}

export function t(locale: Locale, key: MessageKey): string {
  return messages[locale][key];
}
