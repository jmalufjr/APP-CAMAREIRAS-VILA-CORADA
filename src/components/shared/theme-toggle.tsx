"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sun, Moon, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const options: { value: string; label: string; swatch: string; border?: boolean }[] = [
  { value: "light", label: "Claro", swatch: "#F9F9F7", border: true },
  { value: "dark", label: "Escuro · Bordô", swatch: "#5A2025" },
  { value: "dark-blue", label: "Escuro · Azul", swatch: "#3B4564" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- required hydration guard for next-themes
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" className={className} aria-hidden />;
  }

  const isDark = theme !== "light";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className={className} aria-label="Alternar tema">
            {isDark ? <Moon size={18} /> : <Sun size={18} />}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => setTheme(opt.value)}>
            <span
              className={cn("size-3 rounded-full shrink-0", opt.border && "border border-border")}
              style={{ backgroundColor: opt.swatch }}
            />
            {opt.label}
            {theme === opt.value && <Check size={14} className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
