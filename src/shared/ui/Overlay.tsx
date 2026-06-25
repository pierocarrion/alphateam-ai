"use client";

interface OverlayProps {
  children: React.ReactNode;
  className?: string;
}

export function Overlay({ children, className }: OverlayProps) {
  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(140% 70% at 50% -8%, #241d2e 0%, var(--color-bg) 52%, #110f16 100%)",
      }}
    >
      {children}
    </div>
  );
}
