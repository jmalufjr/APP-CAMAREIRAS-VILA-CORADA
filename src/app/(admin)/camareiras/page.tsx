import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { CamareirasTable } from "./camareiras-table";
import { CamareiraFormDialog } from "./camareira-form-dialog";

export default async function CamareirasPage() {
  const supabase = await createClient();
  const { data: camareiras } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "camareira")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Camareiras"
        subtitle="Cadastre a equipe e gerencie o acesso ao sistema."
        action={<CamareiraFormDialog />}
      />
      <CamareirasTable camareiras={(camareiras ?? []) as Profile[]} />
    </div>
  );
}
