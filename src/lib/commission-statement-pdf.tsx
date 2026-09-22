import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { CommissionStatement } from "@/lib/actions/commission";
import { monthYearLabelPt } from "@/lib/date";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#555555", marginBottom: 24 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    paddingBottom: 6,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#eeeeee" },
  totalRow: {
    flexDirection: "row",
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#333333",
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  colName: { flex: 2 },
  colValue: { flex: 1, textAlign: "right" },
});

function StatementDocument({ data }: { data: CommissionStatement }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Vila Corada — Demonstrativo de comissões das camareiras</Text>
        <Text style={styles.subtitle}>Último período ({monthYearLabelPt(data.periodEnd)})</Text>

        <View style={styles.headerRow}>
          <Text style={styles.colName}>Camareira</Text>
          <Text style={styles.colValue}>Suítes e Café</Text>
          <Text style={styles.colValue}>Bar (10%)</Text>
          <Text style={styles.colValue}>Total</Text>
        </View>
        {data.rows.map((r) => (
          <View key={r.camareira_name} style={styles.row}>
            <Text style={styles.colName}>{r.camareira_name}</Text>
            <Text style={styles.colValue}>R$ {r.suites_cafe_amount.toFixed(2)}</Text>
            <Text style={styles.colValue}>R$ {r.bar_amount.toFixed(2)}</Text>
            <Text style={styles.colValue}>R$ {r.total_amount.toFixed(2)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.colName}>Total geral</Text>
          <Text style={styles.colValue}>R$ {data.totalSuitesCafe.toFixed(2)}</Text>
          <Text style={styles.colValue}>R$ {data.totalBar.toFixed(2)}</Text>
          <Text style={styles.colValue}>R$ {data.grandTotal.toFixed(2)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCommissionStatementPdf(data: CommissionStatement): Promise<Buffer> {
  return renderToBuffer(<StatementDocument data={data} />);
}
