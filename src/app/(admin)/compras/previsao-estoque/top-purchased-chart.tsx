"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { TopPurchasedItemRow } from "@/lib/actions/inventory-report";

// Barra horizontal — mais legível que vertical quando os rótulos são
// nomes de produto (podem ser longos), mesma convenção de eixo invertido
// já usada noutros relatórios financeiros.
export function TopPurchasedChart({ data }: { data: TopPurchasedItemRow[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Sem compras registradas.</p>;
  }

  const height = Math.max(220, data.length * 28);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tickFormatter={(v) => `R$${v}`} fontSize={11} stroke="var(--muted-foreground)" />
          <YAxis
            type="category"
            dataKey="item_name"
            width={150}
            fontSize={11}
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--foreground)" }}
          />
          <Tooltip
            formatter={(value) => `R$ ${Number(value ?? 0).toFixed(2)}`}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="total_value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
