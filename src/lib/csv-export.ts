// Exportação CSV client-side, compartilhada por toda tela que precisa de
// "Baixar CSV" — um blob UTF-8 com BOM (pra acentos abrirem certo no
// Excel), baixado direto no navegador, sem nenhuma rota de servidor.
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Linhas de cabeçalho pra conciliação/auditoria (PRD_compras&contabil.md
// seção 22.1, item 8.2 — "metadados para conciliação, trilha de
// auditoria e referência dos lançamentos"), prefixadas a qualquer export
// financeiro:
// período, moeda, fuso horário e data de geração — sempre as mesmas 4
// linhas, antes do cabeçalho de colunas de cada exportação.
export function csvMetadataHeader(from: string, to: string, generatedAtIso: string): (string | number)[][] {
  return [
    ["Período", `${from} a ${to}`],
    ["Moeda", "BRL"],
    ["Fuso horário", "America/Sao_Paulo"],
    ["Gerado em", generatedAtIso],
    [],
  ];
}
