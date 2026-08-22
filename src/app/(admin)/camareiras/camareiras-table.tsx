"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Profile } from "@/lib/types";
import { deleteCamareira, resetCamareiraPassword } from "@/lib/actions/camareiras";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { CamareiraFormDialog } from "./camareira-form-dialog";
import { Trash2, KeyRound } from "lucide-react";

export function CamareirasTable({ camareiras }: { camareiras: Profile[] }) {
  const [isPending, startTransition] = useTransition();
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const router = useRouter();

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {camareiras.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.active ? "default" : "secondary"}>
                    {c.active ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => setResetTarget(c)}>
                    <KeyRound size={16} />
                  </Button>
                  <CamareiraFormDialog camareira={c} />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    onClick={() => {
                      if (!confirm(`Excluir a camareira ${c.name}?`)) return;
                      startTransition(async () => {
                        const result = await deleteCamareira(c.id);
                        if (result?.error) toast.error(result.error);
                        else {
                          toast.success("Camareira excluída.");
                          router.refresh();
                        }
                      });
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {camareiras.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma camareira cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha de {resetTarget?.name}</DialogTitle>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Nova senha"
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <DialogFooter>
            <Button
              disabled={isPending || newPassword.length < 6}
              onClick={() => {
                if (!resetTarget) return;
                startTransition(async () => {
                  const result = await resetCamareiraPassword(resetTarget.id, newPassword);
                  if (result?.error) toast.error(result.error);
                  else {
                    toast.success("Senha redefinida.");
                    setResetTarget(null);
                    setNewPassword("");
                  }
                });
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
