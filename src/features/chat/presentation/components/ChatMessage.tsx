"use client";

import { Avatar, getPerson, type PersonId } from "@/shared/ui";

export interface ChatMessageData {
  id: string;
  who: PersonId;
  name?: string | null;
  time: string;
  text: string;
  userId?: string;
}

interface ChatMessageProps {
  message: ChatMessageData;
  highlight?: boolean;
  isYou?: boolean;
}

export function ChatMessage({ message, highlight, isYou }: ChatMessageProps) {
  const person = getPerson(message.who);
  const you = isYou ?? false;

  return (
    <div
      className={`mb-3.5 flex gap-3 ${
        you ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {!you && <Avatar who={message.who} size={38} className="mt-0.5" />}
      <div className="max-w-[78%]">
        {!you && (
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-sm font-bold text-ink">{message.name || person.name}</span>
            <span className="text-xs text-ink-3">{message.time}</span>
          </div>
        )}
        <div
          className="text-[15.5px] leading-relaxed"
          style={{
            padding: "11px 15px",
            borderRadius: you ? "18px 18px 6px 18px" : "6px 18px 18px 18px",
            background: you ? "var(--color-accent-soft)" : "var(--color-surface)",
            border: "1px solid",
            borderColor: highlight
              ? "var(--color-glow)"
              : you
              ? "transparent"
              : "var(--color-line)",
            color: "var(--color-ink)",
            boxShadow: highlight ? "0 0 0 4px var(--color-glow-soft)" : "none",
            transition: "box-shadow 0.3s ease, border-color 0.3s ease",
          }}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}
