"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

// Pede uma avaliação nova (a anterior fica guardada até lá; só gasta a IA quando a pessoa pede).
export function RegenerateButton({ occurrenceId }: { occurrenceId: string }) {
  return (
    <Button variant="outline" size="sm" render={<Link href={`/manutencao/ocorrencias/${occurrenceId}/avaliacao-ia?nova=1`} />}>
      Gerar avaliação novamente
    </Button>
  );
}
