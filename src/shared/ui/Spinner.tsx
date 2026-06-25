"use client";

interface SpinnerProps {
  size?: number;
  color?: string;
  stroke?: number;
  className?: string;
  label?: string;
}

export function Spinner({
  size = 18,
  color = "currentColor",
  stroke = 2.5,
  className,
  label = "Loading",
}: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ display: "inline-block", animation: "ui-spin 0.7s linear infinite" }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth={stroke}
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
  );
}
