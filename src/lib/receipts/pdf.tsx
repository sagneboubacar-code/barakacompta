import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { paymentMethodLabel } from "@/lib/constants/payments";
import { pdfLongDate, pdfMoney } from "@/lib/pdf/format";
import type { ReceiptData } from "@/lib/receipts/data";

// Reçu remis au parent (élève ou famille), au format A5 : il s'imprime à deux
// par feuille A4 et s'envoie tel quel sur WhatsApp. Même parti pris que le
// rapport financier : pas de couleur décorative, le vert pour ce qui est payé,
// l'ambre pour ce qui reste dû.
//
// Helvetica ne couvre que le latin-1 (WinAnsi) : n'écrire ici que des
// caractères latin-1, et formater les montants avec pdfMoney.

const INK = "#0f172a";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const LINE = "#e2e8f0";
const GREEN = "#047857";
const AMBER = "#b45309";

const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 48, paddingHorizontal: 32, fontFamily: "Helvetica", fontSize: 9, color: INK },

  letterhead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  schoolName: { fontFamily: "Helvetica-Bold", fontSize: 11.5, letterSpacing: 0.3, maxWidth: 220 },
  schoolMeta: { fontSize: 7.5, color: MUTED, marginTop: 2, maxWidth: 220, lineHeight: 1.35 },
  docType: { fontSize: 7, letterSpacing: 1.3, color: FAINT, fontFamily: "Helvetica-Bold", textAlign: "right" },
  docNumber: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 3, textAlign: "right" },
  rule: { borderBottomWidth: 1.2, borderBottomColor: INK, marginTop: 9 },

  title: { fontFamily: "Helvetica-Bold", fontSize: 15, letterSpacing: -0.3, marginTop: 14 },

  info: { marginTop: 10 },
  infoRow: { flexDirection: "row", paddingVertical: 2.5 },
  infoLabel: { width: 92, fontSize: 8, color: MUTED },
  infoValue: { flex: 1, fontSize: 9 },

  th: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.8, borderBottomColor: INK, marginTop: 14 },
  thText: { fontSize: 6.8, letterSpacing: 0.6, color: MUTED, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: "#f1f5f9" },
  childFirst: { borderTopWidth: 0.6, borderTopColor: LINE },
  cell: { fontSize: 8.5 },
  cellNum: { fontSize: 8.5, textAlign: "right" },
  klass: { fontSize: 7, color: MUTED, marginTop: 1 },
  remaining: { fontSize: 7, color: AMBER, marginTop: 1 },

  totalRow: { flexDirection: "row", paddingTop: 7, borderTopWidth: 1.2, borderTopColor: INK, marginTop: 2 },
  totalLabel: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 10 },
  totalValue: { fontFamily: "Helvetica-Bold", fontSize: 13, color: GREEN, textAlign: "right" },
  remainingRow: { flexDirection: "row", paddingTop: 4 },
  remainingLabel: { flex: 1, fontSize: 8.5, color: AMBER },
  remainingValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: AMBER, textAlign: "right" },
  note: { fontSize: 7.5, color: GREEN, marginTop: 8 },

  bottom: { flexDirection: "row", gap: 20, marginTop: 18 },
  staff: { flex: 1 },
  staffLine: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  signBox: { flex: 1 },
  signLabel: { fontSize: 7, letterSpacing: 0.6, color: MUTED, fontFamily: "Helvetica-Bold" },
  signLine: { borderBottomWidth: 0.8, borderBottomColor: FAINT, marginTop: 30 },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    borderTopWidth: 0.6,
    borderTopColor: LINE,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 6.5, color: FAINT },
});

function ReceiptDocument({ receipt }: { receipt: ReceiptData }) {
  const m = (amount: number) => pdfMoney(amount, receipt.school.currency);
  const isFamily = receipt.kind === "family";
  const contactLine = [receipt.school.phone, receipt.school.email].filter(Boolean).join("  ·  ");
  const title = isFamily ? "Reçu de paiement — famille" : "Reçu de paiement";

  const info: [string, string][] = [
    [isFamily ? "Famille" : "Élève", receipt.payerName],
    ...(receipt.guardianName ? [["Parent", receipt.guardianName] as [string, string]] : []),
    ["Date du paiement", pdfLongDate(receipt.paidAt)],
    ["Mode de paiement", paymentMethodLabel(receipt.paymentMethod, "fr")],
    ...(receipt.reference ? [["Référence", receipt.reference] as [string, string]] : []),
  ];

  return (
    <Document
      title={`${title} N° ${receipt.number} — ${receipt.payerName}`}
      author={receipt.school.name}
      creator="Baraka Compta"
      producer="Baraka Compta"
    >
      <Page size="A5" style={styles.page}>
        <View style={styles.letterhead}>
          <View>
            <Text style={styles.schoolName}>{receipt.school.name.toUpperCase()}</Text>
            {receipt.school.address ? <Text style={styles.schoolMeta}>{receipt.school.address}</Text> : null}
            {contactLine ? <Text style={styles.schoolMeta}>{contactLine}</Text> : null}
          </View>
          <View>
            <Text style={styles.docType}>REÇU DE PAIEMENT</Text>
            <Text style={styles.docNumber}>N° {receipt.number}</Text>
          </View>
        </View>
        <View style={styles.rule} />

        <Text style={styles.title}>{title}</Text>

        <View style={styles.info}>
          {info.map(([label, value]) => (
            <View key={label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.th}>
          <Text style={[styles.thText, { flex: 4 }]}>{isFamily ? "ENFANT" : "ÉLÈVE"}</Text>
          <Text style={[styles.thText, { flex: 5 }]}>ÉCHÉANCE RÉGLÉE</Text>
          <Text style={[styles.thText, { flex: 3, textAlign: "right" }]}>MONTANT</Text>
        </View>
        {receipt.children.map((child) =>
          child.items.map((item, index) => (
            <View key={item.id} style={[styles.tr, index === 0 ? styles.childFirst : {}]} wrap={false}>
              <View style={{ flex: 4 }}>
                {index === 0 ? (
                  <>
                    <Text style={styles.cell}>{child.name}</Text>
                    {child.klass ? <Text style={styles.klass}>{child.klass}</Text> : null}
                  </>
                ) : null}
              </View>
              <View style={{ flex: 5 }}>
                <Text style={styles.cell}>{item.label}</Text>
                {item.remaining > 0 ? <Text style={styles.remaining}>reste à payer : {m(item.remaining)}</Text> : null}
              </View>
              <Text style={[styles.cellNum, { flex: 3 }]}>{m(item.amount)}</Text>
            </View>
          ))
        )}

        <View style={styles.totalRow} wrap={false}>
          <Text style={styles.totalLabel}>TOTAL PAYÉ</Text>
          <Text style={styles.totalValue}>{m(receipt.total)}</Text>
        </View>
        {receipt.totalRemaining > 0 ? (
          <View style={styles.remainingRow}>
            <Text style={styles.remainingLabel}>Reste à payer sur ces échéances (à la date du reçu)</Text>
            <Text style={styles.remainingValue}>{m(receipt.totalRemaining)}</Text>
          </View>
        ) : null}
        {receipt.freeChildName ? (
          <Text style={styles.note}>
            {`${receipt.freeChildName} : pris(e) en charge par l'école (inscription et mensualités offertes).`}
          </Text>
        ) : null}

        <View style={styles.bottom} wrap={false}>
          <View style={styles.staff}>
            {receipt.receivedBy ? <Text style={styles.staffLine}>Reçu par : {receipt.receivedBy}</Text> : null}
            {receipt.cashManager ? <Text style={styles.staffLine}>Responsable : {receipt.cashManager}</Text> : null}
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>CACHET ET SIGNATURE</Text>
            <View style={styles.signLine} />
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {receipt.school.name} — Reçu N° {receipt.number}
          </Text>
          <Text style={styles.footerText}>Baraka Compta</Text>
        </View>
      </Page>
    </Document>
  );
}

export function renderReceiptPdf(receipt: ReceiptData): Promise<Buffer> {
  return renderToBuffer(<ReceiptDocument receipt={receipt} />);
}

// Nom de fichier lisible et sûr : « recu-F-1a2b3c4d-diop.pdf ».
export function receiptFileName(receipt: ReceiptData): string {
  const slug = receipt.payerName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `recu-${receipt.number}${slug ? `-${slug}` : ""}.pdf`;
}
