"use client";

import { Mira } from "@/shared/ui";
import { AuthForm } from "@/features/auth/presentation/components/AuthForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center px-8 py-12 text-center">
      <Link
        href="/"
        className="absolute left-6 top-6 text-sm font-semibold text-ink-3 hover:text-ink"
      >
        ← Back to AlphaTeam
      </Link>
      <div className="relative mb-8">
        <Mira size={110} mood="happy" ring />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
        Hi, I&apos;m Mira
      </p>
      <h1 className="mt-3 max-w-xs font-display text-[32px] leading-tight text-ink">
        Not a task manager. A gentle nudge to begin.
      </h1>
      <p className="mt-4 max-w-[300px] text-lg leading-relaxed text-ink-2">
        Putting things off isn&apos;t about time — it&apos;s about the feeling.
        I&apos;ll help you shrink that feeling, one tiny step at a time.
      </p>
      <div className="mt-8 flex w-full justify-center">
        <AuthForm />
      </div>
    </div>
  );
}
