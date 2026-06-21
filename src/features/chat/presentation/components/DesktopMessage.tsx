"use client";

import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui";
import { ChatMessageData } from "./ChatMessage";

interface DesktopMessageProps {
  message: ChatMessageData;
  highlight?: boolean;
  isYou?: boolean;
}

export function DesktopMessage({ message, highlight, isYou }: DesktopMessageProps) {
  const name = isYou
    ? `${message.name || "You"} (you)`
    : message.name
    ? message.name
    : message.who
    ? message.who.charAt(0).toUpperCase() + message.who.slice(1)
    : "Mira";

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl px-2 py-1.5 transition-colors",
        highlight ? "bg-glow-soft" : "bg-transparent"
      )}
    >
      <Avatar who={message.who || "daniel"} size={38} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[14.5px] font-bold text-ink">{name}</span>
          <span className="text-xs text-ink-3">{message.time}</span>
        </div>
        <div className="mt-0.5 text-[15px] leading-relaxed text-ink-2">
          {message.text}
        </div>
      </div>
    </div>
  );
}
