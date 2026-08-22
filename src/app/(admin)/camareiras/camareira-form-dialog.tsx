"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCamareira, updateCamareira } from "@/lib/actions/camareiras";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";

export function CamareiraFormDialog({ camareira }: { camareira?: Profile }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!camareira;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon">
              <Pencil size={16} />
            </Button>
          ) : (
            <Button>
              <Plus size={16} /> Nova camareira
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar camareira" : "Nova camareira"}</DialogTitle>
          {!isEdit && (
            <DialogDescription>
              O login será gerado automaticamente a partir do nome; a camareira usará o
              nome pré-cadastrado e a senha definida aqui para acessar o sistema.
            </DialogDescription>
          )}
        </DialogHeader>
        <form
          action={(formData) => {
            startTransition(async () => {
              const result = isEdit
                ? await updateCamareira(camareira.id, formData)
                : await createCamareira(formData);
              if (result?.error) {
                toast.error(result.error);
              } else {
                toast.success(isEdit ? "Camareira atualizada." : "Camareira cadastrada.");
                setOpen(false);
                router.refresh();
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={camareira?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" name="phone" defaultValue={camareira?.phone ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" defaultValue={camareira?.email ?? ""} />
          </div>
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha inicial</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
          )}
          {isEdit && (
            <div className="flex items-center gap-2">
              <Switch id="active" name="active" defaultChecked={camareira?.active ?? true} />
              <Label htmlFor="active">Ativa</Label>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
