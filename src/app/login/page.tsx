"use client";

import { Mira } from "@/shared/ui";
import { AuthForm } from "@/features/auth/presentation/components/AuthForm";
import Link from "next/link";
import { LanguageToggle } from "@/i18n/LanguageToggle";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";

export default function LoginPage() {
  const [locale] = useLocale();
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center px-8 py-12 text-center">
      <div className="absolute left-6 top-6 flex items-center gap-3">
        <Link
          href="/"
          className="text-sm font-semibold text-ink-3 hover:text-ink"
        >
          {t(locale, "login.back")}
        </Link>
      </div>
      <div className="absolute right-6 top-6">
        <LanguageToggle />
      </div>
      <div className="relative mb-8">
        <Mira size={110} mood="happy" ring />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
        {t(locale, "login.eyebrow")}
      </p>
      <h1 className="mt-3 max-w-xs font-display text-[32px] leading-tight text-ink">
        {t(locale, "login.title")}
      </h1>
      <p className="mt-4 max-w-[300px] text-lg leading-relaxed text-ink-2">
        {t(locale, "login.subtitle")}
      </p>
      <div className="mt-8 flex w-full justify-center">
        <AuthForm />
      </div>
    </div>
  );
}
