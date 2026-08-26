"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Profile } from "@/lib/types";
import { deleteUser, resetUserPassword } from "@/lib/actions/users";
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
import { UserFormDialog } from "./user-form-dialog";
import { Trash2, KeyRound } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  camareira: "Camareira",
  manutencao: "Funcionário de Manutenção",
};

export function UsersTable({ users }: { users: Profile[] }) {
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
              <TableHead>Papel</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{ROLE_LABELS[u.role] ?? u.role}</TableCell>
                <TableCell>{u.phone ?? "—"}</TableCell>
                <TableCell>{u.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={u.active ? "default" : "secondary"}>
                    {u.active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => setResetTarget(u)}>
                    <KeyRound size={16} />
                  </Button>
                  <UserFormDialog user={u} />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    onClick={() => {
                      if (!confirm(`Excluir o usuário ${u.name}?`)) return;
                      startTransition(async () => {
                        const result = await deleteUser(u.id);
                        if (result?.error) toast.error(result.error);
                        else {
                          toast.success("Usuário excluído.");
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
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum usuário cadastrado.
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
                  const result = await resetUserPassword(resetTarget.id, newPassword);
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
