import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatDateTimePt } from "@/lib/date";

export interface ReceiptLineItem {
  id: string;
  name: string;
  quantity: number;
  subtotal: number;
}

export interface ReceiptData {
  room_number: string;
  paid_at: string;
  minibarItems: ReceiptLineItem[];
  minibarTotal: number;
  poolbarItems: ReceiptLineItem[];
  poolbarSubtotal: number;
  serviceCharge: number;
  poolbarTotalWithCharge: number;
  grandTotal: number;
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
});

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
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Vila Corada — Conta da Suíte {data.room_number}</Text>
        <Text style={styles.subtitle}>Pagamento registrado em {formatDateTimePt(data.paid_at)}</Text>

        <Text style={styles.sectionTitle}>Frigobar</Text>
        <LineItemRows items={data.minibarItems} />

        <Text style={styles.sectionTitle}>Bar da piscina</Text>
        <LineItemRows items={data.poolbarItems} />

        <View style={{ marginTop: 20 }}>
          <View style={styles.row}>
            <Text>Total frigobar</Text>
            <Text>R$ {data.minibarTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text>Total bar da piscina</Text>
            <Text>R$ {data.poolbarSubtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.rowMuted}>
            <Text>Taxa de serviço (10% sobre o bar)</Text>
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
