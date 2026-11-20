import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Chamada pelo próprio aparelho (service worker) quando a notificação é dispensada ou aberta: encerra os lembretes
// daquela ocorrência naquele aparelho. A autorização é o endereço único do aparelho (endpoint), que só ele conhece.
export async function POST(req: Request) {
  try {
    const { occurrenceId, endpoint } = (await req.json()) as { occurrenceId?: string; endpoint?: string };
    if (!occurrenceId || !UUID.test(occurrenceId) || !endpoint || endpoint.length > 1000) {
      return new NextResponse(null, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: sub } = await admin.from("push_subscriptions").select("id").eq("endpoint", endpoint).maybeSingle();
    if (sub) {
      await admin
        .from("push_alerts")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("occurrence_id", occurrenceId)
        .eq("subscription_id", sub.id);
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
