"use client";

import { useState } from "react";
import { Button } from "@/shared/ui";
import { fetchJson, ApiError } from "@/shared/lib/api";

export function WaitlistForm({ buttonText = "Join the waitlist" }: { buttonText?: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await fetchJson("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, teamSize }),
      });
      setSuccess(true);
      setEmail("");
      setRole("");
      setTeamSize("");
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "We couldn't add you to the list right now.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-sage/30 bg-sage-soft px-6 py-5 text-center">
        <p className="text-[17px] font-bold text-sage">You&apos;re on the list.</p>
        <p className="mt-1 text-sm text-ink-2">
          Alpha will reach out soon with early access.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Work email"
        required
        className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3.5 text-ink placeholder:text-ink-3 outline-none focus:border-accent"
      />
      <div className="grid grid-cols-2 gap-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
          className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3.5 text-ink outline-none focus:border-accent"
        >
          <option value="" disabled>
            Your role
          </option>
          <option value="founder">Founder</option>
          <option value="manager">Team Lead / Manager</option>
          <option value="operator">Operations</option>
          <option value="other">Other</option>
        </select>
        <select
          value={teamSize}
          onChange={(e) => setTeamSize(e.target.value)}
          required
          className="w-full rounded-2xl border border-line-2 bg-surface px-4 py-3.5 text-ink outline-none focus:border-accent"
        >
          <option value="" disabled>
            Team size
          </option>
          <option value="1-5">1–5</option>
          <option value="6-20">6–20</option>
          <option value="21-50">21–50</option>
          <option value="50+">50+</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" full size="lg" disabled={loading}>
        {loading ? "Joining..." : buttonText}
      </Button>
      <p className="text-center text-xs text-ink-3">
        No spam. Join 50+ teams already on the list.
      </p>
    </form>
  );
}
