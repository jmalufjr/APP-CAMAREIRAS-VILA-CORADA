"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createApiToken, revokeApiToken, type ApiTokenRow } from "@/lib/actions/api-tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDateTimePt } from "@/lib/date";

export function ApiTokensPanel({ tokens }: { tokens: ApiTokenRow[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCreate() {
    startTransition(async () => {
      const result = await createApiToken(label);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setNewToken(result!.token!);
      setLabel("");
      router.refresh();
    });
  }

  function handleRevoke(id: string) {
    if (!confirm("Revogar este token? O sistema financeiro para de conseguir consultar a API imediatamente.")) {
      return;
    }
    startTransition(async () => {
      const result = await revokeApiToken(id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Token revogado.");
        router.refresh();
      }
    });
  }

  async function handleCopy() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-2 max-w-md">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Nome do token</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Sistema financeiro Vila Corada"
            disabled={isPending}
          />
        </div>
        <Button onClick={handleCreate} disabled={isPending || !label.trim()}>
          + Gerar novo token
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Criado por</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.label}</TableCell>
                <TableCell>{formatDateTimePt(t.created_at)}</TableCell>
                <TableCell>{t.created_by_name ?? "—"}</TableCell>
                <TableCell>
                  {t.revoked_at ? (
                    <Badge variant="destructive">Revogado</Badge>
                  ) : (
                    <Badge variant="secondary">Ativo</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {!t.revoked_at && (
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleRevoke(t.id)}>
                      Revogar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {tokens.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum token gerado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!newToken}
        onOpenChange={(open) => {
          if (!open) {
            setNewToken(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token gerado</DialogTitle>
            <DialogDescription>
              Copie agora e guarde num lugar seguro — este valor não será mostrado de novo. Se perder, é
              preciso gerar um token novo e revogar este.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted p-3 font-mono text-xs break-all">
            {newToken}
          </div>
          <DialogFooter>
            <Button onClick={handleCopy}>{copied ? "Copiado!" : "Copiar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
