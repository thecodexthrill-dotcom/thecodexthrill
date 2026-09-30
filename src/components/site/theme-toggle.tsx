"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      aria-label="Toggle color theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      size="icon"
      variant="ghost"
    >
      <Sun aria-hidden="true" className="theme-icon-light" size={18} />
      <Moon aria-hidden="true" className="theme-icon-dark" size={18} />
    </Button>
  );
}
