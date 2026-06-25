"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui";
import { fetchJson, ApiError } from "@/shared/lib/api";

const NEXTAUTH_ERROR_MAP: Record<string, string> = {
  CredentialsSignin: "That email or password doesn't match. Try again.",
  OAuthSignin: "We couldn't start sign-in. Please try again.",
  OAuthCallback: "We couldn't complete sign-in. Please try again.",
  OAuthCreateAccount: "We couldn't create your account with that provider. Please try again.",
  EmailCreateAccount: "We couldn't create your account. Please try again.",
  Callback: "Something went wrong during sign-in. Please try again.",
  AccessDenied: "You don't have access. Please contact support if this seems wrong.",
  Configuration: "Our sign-in service isn't configured correctly. Please contact support.",
  Verification: "We couldn't verify your sign-in. Please try again.",
  Default: "We couldn't sign you in right now. Please try again.",
};

function friendlyNextAuthError(code: string | undefined): string {
  if (!code) return "We couldn't sign you in right now. Please try again.";
  return NEXTAUTH_ERROR_MAP[code] ?? "We couldn't sign you in right now. Please try again.";
}

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "signup") {
        try {
          await fetchJson("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
          });
        } catch (err) {
          const message =
            err instanceof ApiError || err instanceof Error
              ? err.message
              : "We couldn't create your account right now. Please try again.";
          setError(message);
          setLoading(false);
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        mode: "login",
        redirect: false,
      });

      if (result?.error) {
        const message = friendlyNextAuthError(result.error);
        setError(message);
        setLoading(false);
        return;
      }

      // Decide el destino según el rol del usuario. Si es super-admin, va
      // directo al panel de administración.
      try {
        const session = await fetch("/api/auth/session").then((r) => r.json());
        const globalRole = session?.user?.globalRole;
        if (globalRole === "superadmin") {
          router.push("/admin");
        } else {
          router.push("/onboarding");
        }
      } catch {
        router.push("/onboarding");
      }
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please check your connection.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-xs space-y-4">
      {mode === "signup" && (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
          className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
        />
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        minLength={6}
        className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" full size="lg" disabled={loading}>
        {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        className="w-full text-center text-sm text-ink-3 hover:text-ink"
      >
        {mode === "signup"
          ? "Already have an account? Sign in"
          : "Need an account? Sign up"}
      </button>
    </form>
  );
}
