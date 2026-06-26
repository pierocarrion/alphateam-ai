"use client";

import { useLocaleContext } from "./LocaleProvider";
import type { Locale } from "./messages";

/**
 * Reads the shared locale (provided by `LocaleProvider`) and exposes a setter
 * that persists the cookie and updates every subscribed component without a
 * page reload.
 */
export function useLocale(): [Locale, (next: Locale) => void] {
  const { locale, setLocale } = useLocaleContext();
  return [locale, setLocale];
}
