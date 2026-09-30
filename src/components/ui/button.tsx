import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--gold)] text-[#17130a] hover:bg-[var(--gold-bright)]",
        secondary:
          "border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--gold)] hover:text-[var(--gold-ink)]",
        ghost:
          "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
      },
      size: {
        default: "min-h-12 px-6",
        small: "min-h-10 px-4 text-xs",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}
