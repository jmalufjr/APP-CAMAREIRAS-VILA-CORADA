import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import writeExcelFile from "write-excel-file/node";

// Exportação genérica de relatórios (tabela simples) em CSV, XLSX, RTF e
// PDF — usada por todas as telas de "Demonstrativos e Relatórios". Gera
// tudo no servidor a partir das mesmas linhas que a tela mostra.
export interface ReportPayload {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  // Índices de colunas numéricas (alinhadas à direita no PDF/XLSX).
  numericColumns?: number[];
  filenameBase: string;
}

export type ReportFormat = "csv" | "xlsx" | "rtf" | "pdf";

function cellText(v: string | number): string {
  return typeof v === "number" ? v.toFixed(2).replace(".", ",") : String(v);
}

export function buildCsv(p: ReportPayload): Buffer {
  const lines = [
    [p.title],
    ...(p.subtitle ? [[p.subtitle]] : []),
    [],
    p.columns,
    ...p.rows.map((r) => r.map((c) => (typeof c === "number" ? c.toFixed(2).replace(".", ",") : c))),
  ];
  const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  return Buffer.from("﻿" + csv, "utf8");
}

function rtfEscape(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === "\\" || ch === "{" || ch === "}") out += "\\" + ch;
    else if (code > 127) out += `\\u${code > 32767 ? code - 65536 : code}?`;
    else out += ch;
  }
  return out;
}

export function buildRtf(p: ReportPayload): Buffer {
  const n = Math.max(p.columns.length, 1);
  const total = 15000; // largura útil em twips (paisagem)
  const w = Math.floor(total / n);
  const cells = Array.from({ length: n }, (_, i) => `\\cellx${w * (i + 1)}`).join("");
  const row = (vals: string[], bold: boolean) =>
    `\\trowd\\trgaph60${cells}\n` + vals.map((v) => `\\pard\\intbl${bold ? "\\b " : " "}${rtfEscape(v)}${bold ? "\\b0" : ""}\\cell`).join("") + `\\row\n`;
  const body =
    `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Arial;}}\\landscape\\paperw16840\\paperh11900\\margl700\\margr700\\margt700\\margb700\\fs18\n` +
    `\\pard\\b\\fs28 ${rtfEscape(p.title)}\\b0\\fs18\\par\n` +
    (p.subtitle ? `\\pard ${rtfEscape(p.subtitle)}\\par\n` : "") +
    `\\par\n` +
    row(p.columns, true) +
    p.rows.map((r) => row(r.map(cellText), false)).join("") +
    `}`;
  return Buffer.from(body, "ascii");
}

export async function buildXlsx(p: ReportPayload): Promise<Buffer> {
  const num = new Set(p.numericColumns ?? []);
  type Cell = { value: string | number; fontWeight?: "bold"; align?: "right" | "left"; format?: string };
  const header: Cell[] = p.columns.map((c) => ({ value: c, fontWeight: "bold" }));
  const body: Cell[][] = p.rows.map((r) =>
    r.map((v, i): Cell =>
      typeof v === "number" || num.has(i)
        ? { value: typeof v === "number" ? v : Number(v) || 0, format: "#,##0.00", align: "right" }
        : { value: String(v) }
    )
  );
  const data = [[{ value: p.title, fontWeight: "bold" } as Cell], ...(p.subtitle ? [[{ value: p.subtitle } as Cell]] : []), [] as Cell[], header, ...body];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = await writeExcelFile(data as any, { sheet: p.title.slice(0, 28) } as any).toBuffer();
  return Buffer.from(out as Uint8Array);
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 7, fontFamily: "Helvetica" },
  title: { fontSize: 14, marginBottom: 2 },
  subtitle: { fontSize: 8, color: "#555555", marginBottom: 10 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333333", paddingBottom: 3, marginBottom: 2, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: "#dddddd" },
  cell: { flex: 1, paddingRight: 4 },
  right: { textAlign: "right" },
});

function ReportDocument({ p }: { p: ReportPayload }) {
  const num = new Set(p.numericColumns ?? []);
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Vila Corada — {p.title}</Text>
        {p.subtitle && <Text style={styles.subtitle}>{p.subtitle}</Text>}
        <View style={styles.head} fixed>
          {p.columns.map((c, i) => (
            <Text key={i} style={num.has(i) ? [styles.cell, styles.right] : styles.cell}>
              {c}
            </Text>
          ))}
        </View>
        {p.rows.map((r, ri) => (
          <View key={ri} style={styles.row} wrap={false}>
            {r.map((v, i) => (
              <Text key={i} style={num.has(i) ? [styles.cell, styles.right] : styles.cell}>
                {cellText(v)}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function buildPdf(p: ReportPayload): Promise<Buffer> {
  return renderToBuffer(<ReportDocument p={p} />);
}

export const REPORT_MIME: Record<ReportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  rtf: "application/rtf",
  pdf: "application/pdf",
};
