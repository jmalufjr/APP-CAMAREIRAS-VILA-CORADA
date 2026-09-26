"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { MinibarItemTotal } from "@/lib/actions/minibar";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const RADIAN = Math.PI / 180;

// Nome do item sobreposto no meio da própria fatia (halo na cor do card por
// trás do texto, para continuar legível em cima de qualquer cor de fatia) —
// só para os 5 maiores itens, para não poluir fatias pequenas com texto.
function makeSliceLabelRenderer(namesToLabel: Set<string>) {
  return function renderSliceLabel(props: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    name: string;
  }) {
    const { cx, cy, midAngle, innerRadius, outerRadius, name } = props;
    if (!namesToLabel.has(name)) return null;

    const radius = innerRadius + (outerRadius - innerRadius) / 2;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fill="var(--foreground)"
        stroke="var(--card)"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {name}
      </text>
    );
  };
}

// "total" = gráfico por valor (R$); "quantity" = gráfico por quantidade
// consumida — mesmo componente, só troca qual campo vira o percentual de
// cada fatia.
export function MinibarPieChart({
  items,
  valueKey,
}: {
  items: MinibarItemTotal[];
  valueKey: "total" | "quantity";
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">Sem consumo registrado.</p>
    );
  }

  const sum = items.reduce((s, i) => s + i[valueKey], 0);
  // A ordem dos itens (e, com ela, a cor de cada um) segue sempre `items`
  // (por total/valor decrescente, ver summarizeRows em minibar.ts/poolbar.ts)
  // — assim o mesmo item usa a mesma cor no gráfico de valor e no de
  // quantidade, lado a lado, o que facilita comparar os dois visualmente.
  const data = items.map((item, i) => ({
    name: item.name,
    value: item[valueKey],
    percent: sum > 0 ? (item[valueKey] / sum) * 100 : 0,
    color: COLORS[i % COLORS.length],
  }));
  // As 5 maiores fatias DESTE gráfico específico (por valor no gráfico de
  // valor, por quantidade no de quantidade) ganham o nome sobreposto —
  // pode não ser exatamente os 5 primeiros de `data` quando valueKey é
  // "quantity", já que a ordem de `data` segue sempre o total em R$.
  const top5Names = new Set(
    [...data]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((d) => d.name)
  );
  const renderSliceLabel = makeSliceLabelRenderer(top5Names);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="percent"
            nameKey="name"
            innerRadius={45}
            outerRadius={80}
            paddingAngle={2}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label={renderSliceLabel as any}
            labelLine={false}
          >
            {data.map((item) => (
              <Cell key={item.name} fill={item.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
