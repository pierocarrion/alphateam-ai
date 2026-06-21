"use client";

import { cn } from "@/shared/lib/cn";

export type PersonId = string;

interface Person {
  name: string;
  initials: string;
  color: string;
  you: boolean;
}

const PALETTE = [
  "#E6AC73",
  "#9FB8E0",
  "#E6A0B0",
  "#93C2A2",
  "#C7A6E0",
  "#E6C773",
  "#73B8E6",
  "#A0E6C7",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function generatePerson(id: string): Person {
  const name = id.charAt(0).toUpperCase() + id.slice(1);
  const initials = id.charAt(0).toUpperCase() || "?";
  const color = PALETTE[hashString(id) % PALETTE.length];
  return { name, initials, color, you: false };
}

export function getPerson(id: string): Person {
  return generatePerson(id);
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amount;
  let g = ((n >> 8) & 255) + amount;
  let b = (n & 255) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

interface AvatarProps {
  who?: PersonId;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Avatar({ who, size = 38, className, style }: AvatarProps) {
  const person = who ? getPerson(who) : generatePerson("?");
  return (
    <div
      className={cn(
        "flex flex-none items-center justify-center rounded-full font-display font-semibold text-[#1a1620]",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(150deg, ${person.color}, ${shade(person.color, -18)})`,
        ...style,
      }}
    >
      {person.initials}
    </div>
  );
}
