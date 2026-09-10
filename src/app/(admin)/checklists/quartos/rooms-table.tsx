"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Room } from "@/lib/types";
import { deleteRoom } from "@/lib/actions/rooms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoomFormDialog } from "./room-form-dialog";
import { Trash2 } from "lucide-react";

export function RoomsTable({ rooms }: { rooms: Room[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms.map((room) => (
            <TableRow key={room.id}>
              <TableCell className="font-medium">{room.number}</TableCell>
              <TableCell>{room.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={room.active ? "default" : "secondary"}>
                  {room.active ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-1">
                <RoomFormDialog room={room} />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => {
                    if (!confirm(`Excluir o quarto ${room.number}?`)) return;
                    startTransition(async () => {
                      const result = await deleteRoom(room.id);
                      if (result?.error) toast.error(result.error);
                      else {
                        toast.success("Quarto excluído.");
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
          {rooms.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Nenhum quarto cadastrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
