import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatDateTimePt, formatDatePt } from "@/lib/date";

export interface ReceiptLineItem {
  id: string;
  name: string;
  quantity: number;
  subtotal: number;
}

import type { ConsumptionMatrix } from "@/lib/bill-consumption";

export interface ReceiptData {
  room_number: string;
  // Hóspede e período da estadia, e as tabelas de consumo (frigobar por dia, bar por comanda).
  guestName?: string | null;
  stayCheckIn?: string | null;
  stayCheckOut?: string | null;
  minibarMatrix?: ConsumptionMatrix;
  barMatrix?: ConsumptionMatrix;
  // Conta avulsa (ex-hóspede): room_number guarda o nome do hóspede; sem frigobar.
  isWalkin?: boolean;
  // Texto e data mostrados no subtítulo — variam conforme o motivo do PDF:
  // recibo de pagamento ("Pagamento registrado em", paid_at) ou conta
  // fechada aguardando pagamento ("Conta fechada em", closed_at).
  statusLabel: string;
  statusDate: string;
  minibarItems: ReceiptLineItem[];
  minibarTotal: number;
  poolbarItems: ReceiptLineItem[];
  poolbarSubtotal: number;
  serviceCharge: number;
  poolbarTotalWithCharge: number;
  grandTotal: number;
  serviceChargeWaived: boolean;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#555555", marginBottom: 24 },
  sectionTitle: { fontSize: 12, marginBottom: 6, marginTop: 16, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  rowMuted: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, color: "#555555" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
  },
  empty: { color: "#888888", fontStyle: "italic" },
  info: { fontSize: 11, marginBottom: 2 },
  mHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999999", paddingBottom: 3 },
  mRow: { flexDirection: "row", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: "#dddddd" },
  mName: { flexGrow: 1, flexBasis: 140 },
  mCell: { width: 72, textAlign: "center" },
  mSub: { fontSize: 8, color: "#666666" },
});

// Tabela de consumo: linhas = itens, colunas = dia/serviço (frigobar) ou comanda (bar), última coluna = total.
function MatrixPdfTable({ matrix }: { matrix: ConsumptionMatrix }) {
  if (matrix.rows.length === 0) return <Text style={styles.empty}>Sem consumo.</Text>;
  return (
    <View>
      <View style={styles.mHead}>
        <Text style={styles.mName}>Item</Text>
        {matrix.columns.map((c) => (
          <View key={c.key} style={styles.mCell}>
            <Text>{c.title}</Text>
            {c.subtitle ? <Text style={styles.mSub}>{c.subtitle}</Text> : null}
          </View>
        ))}
        <Text style={styles.mCell}>Total</Text>
      </View>
      {matrix.rows.map((r) => (
        <View key={r.name} style={styles.mRow}>
          <Text style={styles.mName}>{r.name}</Text>
          {r.cells.map((v, i) => (
            <Text key={i} style={styles.mCell}>{v === 0 ? "-" : String(v)}</Text>
          ))}
          <Text style={styles.mCell}>{String(r.total)}</Text>
        </View>
      ))}
    </View>
  );
}

function LineItemRows({ items }: { items: ReceiptLineItem[] }) {
  if (items.length === 0) {
    return <Text style={styles.empty}>Sem consumo.</Text>;
  }
  return (
    <>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <Text>
            {item.name} × {item.quantity}
          </Text>
          <Text>R$ {item.subtotal.toFixed(2)}</Text>
        </View>
      ))}
    </>
  );
}

function ReceiptDocument({ data }: { data: ReceiptData }) {
  return (
    <Document>
      <Page size="A4" orientation={Math.max(data.minibarMatrix?.columns.length ?? 0, data.barMatrix?.columns.length ?? 0) > 5 ? "landscape" : "portrait"} style={styles.page}>
        <Text style={styles.title}>Vila Corada — {data.isWalkin ? `Conta avulsa — ${data.room_number}` : `Conta da Suíte ${data.room_number}`}</Text>
        {data.guestName ? <Text style={styles.info}>Hóspede: {data.guestName}</Text> : null}
        {!data.isWalkin ? <Text style={styles.info}>Suíte: {data.room_number}</Text> : null}
        {data.stayCheckIn && data.stayCheckOut ? (
          <Text style={styles.info}>Período da hospedagem: {formatDatePt(data.stayCheckIn)} a {formatDatePt(data.stayCheckOut)}</Text>
        ) : null}
        <Text style={styles.subtitle}>
          {data.statusLabel} {formatDateTimePt(data.statusDate)}
        </Text>

        {!data.isWalkin && (
          <>
            <Text style={styles.sectionTitle}>Frigobar</Text>
            {data.minibarMatrix ? <MatrixPdfTable matrix={data.minibarMatrix} /> : <LineItemRows items={data.minibarItems} />}
          </>
        )}

        <Text style={styles.sectionTitle}>Bar da piscina</Text>
        {data.barMatrix ? <MatrixPdfTable matrix={data.barMatrix} /> : <LineItemRows items={data.poolbarItems} />}

        <View style={{ marginTop: 20 }}>
          {!data.isWalkin && (
            <View style={styles.row}>
              <Text>Total frigobar</Text>
              <Text>R$ {data.minibarTotal.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text>Total bar da piscina</Text>
            <Text>R$ {data.poolbarSubtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.rowMuted}>
            <Text>Taxa de serviço (10% sobre o bar){data.serviceChargeWaived ? " — isenta" : ""}</Text>
            <Text>R$ {data.serviceCharge.toFixed(2)}</Text>
          </View>
          <View style={styles.rowMuted}>
            <Text>Bar da piscina com taxa</Text>
            <Text>R$ {data.poolbarTotalWithCharge.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Total geral</Text>
            <Text>R$ {data.grandTotal.toFixed(2)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return renderToBuffer(<ReceiptDocument data={data} />);
}
