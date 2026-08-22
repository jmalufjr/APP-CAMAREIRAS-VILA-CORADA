import { createClient } from "@/lib/supabase/server";
import type { Room } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { RoomsTable } from "./rooms-table";
import { RoomFormDialog } from "./room-form-dialog";

export default async function QuartosPage() {
  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from("rooms")
    .select("*")
    .order("position", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quartos"
        subtitle="Gerencie a lista de suítes da pousada."
        action={<RoomFormDialog />}
      />
      <RoomsTable rooms={(rooms ?? []) as Room[]} />
    </div>
  );
}
