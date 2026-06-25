"use client";

import { useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./messages";

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
  const value = match?.split("=")[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Reads the locale from the NEXT_LOCALE cookie on the client and exposes a
 * setter that persists the cookie and refreshes the route so server components
 * pick up the new locale.
 */
export function useLocale(): [Locale, (next: Locale) => void] {
  const [locale, setLocale] = useState<Locale>(readCookieLocale);

  const change = (next: Locale) => {
    setLocale(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // A hard reload is the most reliable way to guarantee every server
    // component re-reads the locale cookie. `router.refresh()` alone can serve
    // cached RSC payloads and leave stale translated text behind.
    window.location.reload();
  };

  return [locale, change];
}
