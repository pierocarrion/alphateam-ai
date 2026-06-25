export type Locale = "es" | "en";

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Lightweight message dictionary for key pages. New strings can be added here
 * incrementally as more pages adopt the selector.
 */
export const MESSAGES: Record<Locale, Record<string, string>> = {
  es: {
    "login.back": "← Volver a AlphaLead",
    "login.eyebrow": "Hola, soy Mira",
    "login.title": "No es un gestor de tareas. Un empujoncito amable para empezar.",
    "login.subtitle":
      "Postergar no va de tiempo — va de cómo te sientes. Te ayudo a reducir esa sensación, un pasito a la vez.",
    "login.toggle.es": "ES",
    "login.toggle.en": "EN",
  },
  en: {
    "login.back": "← Back to AlphaLead",
    "login.eyebrow": "Hi, I'm Mira",
    "login.title": "Not a task manager. A gentle nudge to begin.",
    "login.subtitle":
      "Putting things off isn't about time — it's about the feeling. I'll help you shrink that feeling, one tiny step at a time.",
    "login.toggle.es": "ES",
    "login.toggle.en": "EN",
  },
};

export function t(locale: Locale, key: string): string {
  return MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "es" || value === "en";
}
