"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function DateSwitcher({ current }: { current: "hoje" | "amanha" }) {
  return (
    <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
      <Button
        size="sm"
        variant={current === "hoje" ? "default" : "ghost"}
        render={<Link href="/planejamento?date=hoje">Hoje</Link>}
        nativeButton={false}
      />
      <Button
        size="sm"
        variant={current === "amanha" ? "default" : "ghost"}
        render={<Link href="/planejamento?date=amanha">Amanhã</Link>}
        nativeButton={false}
      />
    </div>
  );
}
