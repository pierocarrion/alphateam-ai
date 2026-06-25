"use client";

import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/cn";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-button font-display font-medium tracking-tight transition-all active:scale-[0.965] disabled:pointer-events-none disabled:opacity-50 aria-busy:opacity-80",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-ink shadow-[0_10px_30px_-8px_var(--color-accent-soft),inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:brightness-105",
        ghost:
          "bg-transparent text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-2)] hover:bg-white/[0.03] hover:text-ink",
        quiet: "bg-transparent text-ink-3 font-body text-[15px] font-semibold hover:text-ink-2",
      },
      size: {
        default: "px-6 py-4 text-lg",
        lg: "px-7 py-5 text-xl",
        sm: "px-4 py-2 text-sm",
        icon: "h-10 w-10 p-0",
      },
      full: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  icon?: IconName;
  iconSize?: number;
  href?: string;
  /** Muestra un spinner y bloquea la interacción mientras la acción viaja. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  full,
  icon,
  iconSize = 20,
  href,
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, full, className }));
  const content = (
    <>
      {loading && <Spinner size={iconSize - 2} />}
      {children}
      {!loading && icon && <Icon name={icon} size={iconSize} color="currentColor" />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-busy={loading || undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </button>
  );
}
