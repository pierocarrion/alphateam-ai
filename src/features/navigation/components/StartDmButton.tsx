"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/shared/lib/cn";
import { fetchJson } from "@/shared/lib/api";
import { Icon, type IconName } from "@/shared/ui";

interface StartDmButtonProps {
  partnerId: string;
  workspaceId: string;
  label: string;
  errorLabel: string;
  variant?: "primary" | "ghost";
  size?: "default" | "sm";
  icon?: IconName;
  full?: boolean;
  className?: string;
}

export function StartDmButton({
  partnerId,
  workspaceId,
  label,
  errorLabel,
  variant = "primary",
  size = "default",
  icon = "send",
  full,
  className,
}: StartDmButtonProps) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  const handleOpen = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const data = await fetchJson<{ channel: { id: string } }>("/api/dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, workspaceId }),
      });
      if (data.channel?.id) {
        router.push(`/chat/${data.channel.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : errorLabel);
    } finally {
      setOpening(false);
    }
  };

  const base =
    "inline-flex items-center justify-center gap-2 rounded-button font-display font-medium tracking-tight transition-all active:scale-[0.965] disabled:pointer-events-none disabled:opacity-50";
  const variantClass =
    variant === "primary"
      ? "bg-accent text-accent-ink shadow-[0_10px_30px_-8px_var(--color-accent-soft),inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:brightness-105"
      : "bg-transparent text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-2)] hover:bg-white/[0.03] hover:text-ink";
  const sizeClass = size === "sm" ? "px-4 py-2 text-sm" : "px-6 py-4 text-lg";

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={opening}
      aria-busy={opening || undefined}
      className={cn(base, variantClass, sizeClass, full && "w-full", className)}
    >
      {opening ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Icon name={icon} size={size === "sm" ? 16 : 20} color="currentColor" />
      )}
      <span>{label}</span>
    </button>
  );
}
