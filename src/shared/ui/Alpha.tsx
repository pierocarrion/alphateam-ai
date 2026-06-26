"use client";

import { cn } from "@/shared/lib/cn";

export type AlphaMood = "calm" | "happy" | "thinking" | "cheer";

interface AlphaProps {
  size?: number;
  mood?: AlphaMood;
  ring?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Alpha({
  size = 64,
  mood = "calm",
  ring = false,
  className,
  style,
}: AlphaProps) {
  const isSmiling = mood === "happy" || mood === "cheer";
  const isThinking = mood === "thinking";

  const eyeShape: React.CSSProperties = isSmiling
    ? {
        height: "14%",
        borderRadius: "999px 999px 0 0",
        transform: "translateY(2px)",
      }
    : {};

  return (
    <div
      className={cn("relative flex-none", className)}
      style={{ width: size, height: size, ...style }}
    >
      {ring && (
        <>
          <span
            className="pulse-ring absolute inset-0 rounded-full border-[1.5px] border-glow opacity-0"
            style={{ animationDelay: "calc(1.7s * var(--m))" }}
          />
          <span className="pulse-ring absolute inset-0 rounded-full border-[1.5px] border-glow opacity-0" />
        </>
      )}
      <div className="alpha" style={{ width: size, height: size }}>
        <div className="alpha-eyes">
          <div className="alpha-eye" style={eyeShape} />
          <div className="alpha-eye" style={eyeShape} />
        </div>
        {isSmiling && (
          <div
            className="absolute left-1/2 top-[60%] -translate-x-1/2 rounded-b-full border-b-2 border-[#2a2030]"
            style={{ width: "24%", height: "12%" }}
          />
        )}
        {isThinking && (
          <div
            className="absolute left-1/2 top-[66%] h-[6%] w-[20%] -translate-x-1/2 rounded-full bg-[#2a2030]/80"
          />
        )}
      </div>
    </div>
  );
}
