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

export function MinibarPieChart({ items }: { items: MinibarItemTotal[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">Sem consumo registrado.</p>
    );
  }

  const total = items.reduce((sum, i) => sum + i.total, 0);
  const data = items.map((item, i) => ({
    name: item.name,
    total: item.total,
    percent: total > 0 ? (item.total / total) * 100 : 0,
    color: COLORS[i % COLORS.length],
  }));
  // `items` já vem ordenado por total decrescente (ver summarizeRows em
  // src/lib/actions/minibar.ts e poolbar.ts), então os 5 primeiros são os
  // 5 maiores itens.
  const top5Names = new Set(data.slice(0, 5).map((d) => d.name));
  const renderSliceLabel = makeSliceLabelRenderer(top5Names);

  return (
    <div className="space-y-3">
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
      {/* Legenda própria em lista (em vez da <Legend> do Recharts): nomes +
          percentuais organizados, sem disputar espaço com os rótulos das fatias. */}
      <ul className="space-y-1">
        {data.map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.name}</span>
            <span className="shrink-0 font-medium">{item.percent.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
