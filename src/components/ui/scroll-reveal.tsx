"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type RevealVariant =
  | "fade-up"
  | "fade-in"
  | "fade-slide-left"
  | "fade-slide-right"
  | "zoom-in";

export function ScrollReveal({
  children,
  className = "",
  variant = "fade-up",
  delayMs = 0,
  threshold = 0.1,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  variant?: RevealVariant;
  delayMs?: number;
  threshold?: number;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("reveal-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("reveal-visible");
            if (once) observer.unobserve(el);
          } else if (!once) {
            el.classList.remove("reveal-visible");
          }
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  return (
    <div
      ref={ref}
      className={`reveal-init reveal-${variant} ${className}`}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

