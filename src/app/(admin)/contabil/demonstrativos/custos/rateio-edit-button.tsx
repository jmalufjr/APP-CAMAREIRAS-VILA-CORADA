"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCostItemCenterLinks } from "@/lib/actions/cost-plan";
import { PctLinksEditor, type LinkRow } from "@/components/shared/pct-links-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

// Edita o rateio (centros + %) de um produto/despesa — o MESMO dado dos
// cadastros de produtos e de despesas (fonte única). Vale pros próximos
// lançamentos; o que já foi lançado fica como foi contabilizado.
export function RateioEditButton({
  costItemId,
  name,
  initial,
  centerOptions,
}: {
  costItemId: string;
  name: string;
  initial: LinkRow[];
  centerOptions: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>(initial);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      const result = await updateCostItemCenterLinks(
        costItemId,
        links.map((l) => ({ center_id: l.id, alloc_pct: l.pct }))
      );
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Rateio salvo — vale para os próximos lançamentos.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" type="button">
            <Pencil size={14} />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rateio de “{name}”</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          É o mesmo rateio do cadastro deste item. Os percentuais precisam somar 100% e valem a partir dos próximos
          lançamentos — o que já foi lançado não muda.
        </p>
        <PctLinksEditor options={centerOptions} value={links} onChange={setLinks} />
        <DialogFooter>
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
