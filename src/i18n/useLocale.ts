"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(readCookieLocale);

  const change = (next: Locale) => {
    setLocale(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  };

  return [locale, change];
}
