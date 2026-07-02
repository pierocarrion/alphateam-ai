"use client";

export type IconName =
  | "home"
  | "chat"
  | "crew"
  | "spark"
  | "moon"
  | "check"
  | "arrow"
  | "back"
  | "close"
  | "plus"
  | "pause"
  | "play"
  | "send"
  | "heart"
  | "leaf"
  | "link"
  | "shield"
  | "clock"
  | "bell"
  | "doc"
  | "user"
  | "people"
  | "gear"
  | "chevron"
  | "mic"
  | "compass"
  | "brain"
  | "target"
  | "download"
  | "lock"
  | "alert"
  | "trend"
  | "grid"
  | "pulse"
  | "search"
  | "logout";

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
  className?: string;
}

export function Icon({
  name,
  size = 22,
  color = "currentColor",
  stroke = 2,
  className,
}: IconProps) {
  const p = {
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  const paths: Record<IconName, React.ReactNode> = {
    home: <path d="M3 11l9-7 9 7M5 10v9h5v-5h4v5h5v-9" {...p} />,
    chat: <path d="M4 5h16v11H9l-4 3v-3H4z" {...p} />,
    crew: (
      <>
        <circle cx="8" cy="9" r="3" {...p} />
        <circle cx="16" cy="9" r="3" {...p} />
        <path d="M3 19c0-2.5 2.2-4 5-4M21 19c0-2.5-2.2-4-5-4" {...p} />
      </>
    ),
    spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" {...p} />,
    moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" {...p} />,
    check: <path d="M5 12.5l4.5 4.5L19 7" {...p} />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" {...p} />,
    back: <path d="M19 12H5M11 6l-6 6 6 6" {...p} />,
    close: <path d="M6 6l12 12M18 6L6 18" {...p} />,
    plus: <path d="M12 5v14M5 12h14" {...p} />,
    pause: <path d="M9 5v14M15 5v14" {...p} />,
    play: <path d="M7 5l12 7-12 7z" {...p} />,
    send: <path d="M5 12l15-7-7 15-2-6-6-2z" {...p} />,
    heart: <path d="M12 20s-7-4.6-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.4 12 20 12 20z" {...p} />,
    leaf: <path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14-1 0-1-1-1-1zM6 18c4-4 7-7 9-9" {...p} />,
    link: <path d="M9 13a4 4 0 0 0 6 .5l2-2a4 4 0 0 0-6-6l-1 1M15 11a4 4 0 0 0-6-.5l-2 2a4 4 0 0 0 6 6l1-1" {...p} />,
    shield: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" {...p} />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" {...p} />
        <path d="M12 7.5V12l3 2" {...p} />
      </>
    ),
    bell: <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" {...p} />,
    doc: <path d="M7 3h7l4 4v14H7zM14 3v4h4" {...p} />,
    user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" {...p} />,
    people: (
      <>
        <circle cx="9" cy="8" r="3" {...p} />
        <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" {...p} />
        <path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 14.2c2.2.6 3.5 2.3 3.5 4.8" {...p} />
      </>
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3.2" {...p} />
        <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" {...p} />
      </>
    ),
    chevron: <path d="M9 6l6 6-6 6" {...p} />,
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" {...p} />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...p} />
      </>
    ),
    compass: (
      <>
        <circle cx="12" cy="12" r="9" {...p} />
        <path d="M15.5 8.5l-2 5-5 2 2-5z" {...p} />
      </>
    ),
    brain: (
      <path d="M9 4a2.5 2.5 0 0 0-2.5 2.5A2.5 2.5 0 0 0 5 9a2.2 2.2 0 0 0 .5 3.5A2.5 2.5 0 0 0 7 17a2.5 2.5 0 0 0 5 .5V4.5A2.5 2.5 0 0 0 9 4zM15 4a2.5 2.5 0 0 1 2.5 2.5A2.5 2.5 0 0 1 19 9a2.2 2.2 0 0 1-.5 3.5A2.5 2.5 0 0 1 17 17a2.5 2.5 0 0 1-5 .5" {...p} />
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="8.5" {...p} />
        <circle cx="12" cy="12" r="4.5" {...p} />
        <circle cx="12" cy="12" r="0.6" fill={color} stroke="none" />
      </>
    ),
    download: <path d="M12 3v12M7 11l5 5 5-5M5 20h14" {...p} />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2.5" {...p} />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" {...p} />
      </>
    ),
    alert: <path d="M12 3l9 16H3zM12 9v5M12 17v.5" {...p} />,
    trend: <path d="M4 16l5-5 3 3 7-8M16 6h4v4" {...p} />,
    grid: (
      <>
        <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" {...p} />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" {...p} />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" {...p} />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" {...p} />
      </>
    ),
    pulse: <path d="M3 12h4l2-6 4 14 2-8h6" {...p} />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" {...p} />
        <path d="M21 21l-4.5-4.5" {...p} />
      </>
    ),
    logout: (
      <>
        <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" {...p} />
        <path d="M10 17l-5-5 5-5M5 12h11" {...p} />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ display: "block" }}
    >
      {paths[name] ?? null}
    </svg>
  );
}
