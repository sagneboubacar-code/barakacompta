import { Document, Font, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { managerStatementTotals, type ManagerStatement } from "@/lib/reports/manager-statement";
import { expenseCategoryLabel } from "@/lib/constants/expenses";
import { paymentMethodLabel } from "@/lib/constants/payments";
import { pdfLongDate, pdfMoney, pdfShortDate, pdfText } from "@/lib/pdf/format";

// Relevé de caisse d'un responsable, en PDF : la feuille du pointage, remise
// au responsable et signée. Mêmes lignes que la page (lib/reports/
// manager-statement.ts), même langage visuel que le rapport financier ; la
// couleur ne porte qu'un sens : vert = entré, rouge = sorti.
//
// Helvetica ne couvre que le latin-1 (WinAnsi) : n'écrire ici que des
// caractères latin-1, et passer le texte saisi par l'école dans pdfText.

// Pas de coupure de mots en fin de ligne.
Font.registerHyphenationCallback((word) => [word]);

const INK = "#0f172a";
const SLATE = "#334155";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const LINE = "#e2e8f0";
const ZEBRA = "#f8fafc";
const GREEN = "#047857";
const ROSE = "#be123c";
const ORANGE = "#c2410c";

const styles = StyleSheet.create({
  page: { paddingBottom: 58, fontFamily: "Helvetica", fontSize: 8.5, color: INK },
  body: { paddingHorizontal: 34 },

  band: { backgroundColor: INK, paddingHorizontal: 34, paddingVertical: 15, flexDirection: "row", alignItems: "center" },
  logoBox: { width: 46, height: 46, backgroundColor: "#ffffff", borderRadius: 4, padding: 3, marginRight: 12 },
  logo: { width: 40, height: 40, objectFit: "contain" },
  bandSchool: { flex: 1 },
  schoolName: { fontFamily: "Helvetica-Bold", fontSize: 13, color: "#ffffff", letterSpacing: 0.4 },
  schoolMeta: { fontSize: 7.5, color: "#cbd5e1", marginTop: 3 },
  bandDoc: { alignItems: "flex-end" },
  docType: { fontSize: 7, letterSpacing: 1.6, color: "#94a3b8", fontFamily: "Helvetica-Bold" },
  docPeriod: { fontSize: 10.5, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 3 },
  docDate: { fontSize: 7, color: "#cbd5e1", marginTop: 3 },

  title: { fontFamily: "Helvetica-Bold", fontSize: 17, letterSpacing: -0.3, marginTop: 14 },
  subtitle: { fontSize: 8.5, color: MUTED, marginTop: 3 },

  summary: { marginTop: 12, width: 330, borderWidth: 0.8, borderColor: LINE, borderLeftWidth: 3, borderLeftColor: INK, borderRadius: 3 },
  summaryRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 9 },
  summaryLabel: { flex: 1, fontSize: 8.5, color: SLATE },
  summaryAmount: { fontSize: 8.5, textAlign: "right" },
  summaryTotal: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 9, borderTopWidth: 1, borderTopColor: INK, backgroundColor: ZEBRA },

  section: { marginTop: 14 },
  sectionTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.9, color: INK, paddingBottom: 4 },

  th: { flexDirection: "row", backgroundColor: INK, paddingVertical: 5, paddingHorizontal: 6 },
  thText: { fontSize: 6.5, letterSpacing: 0.5, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: LINE },
  cell: { fontSize: 8, color: SLATE },
  cellNum: { fontSize: 8, textAlign: "right" },
  empty: { fontSize: 7.5, color: FAINT, paddingVertical: 6, paddingHorizontal: 6 },
  totalRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: INK },
  bold: { fontFamily: "Helvetica-Bold" },

  note: { fontSize: 7, color: MUTED, marginTop: 10 },

  signatures: { flexDirection: "row", gap: 30, marginTop: 20 },
  signBox: { flex: 1 },
  signLabel: { fontSize: 7, letterSpacing: 0.6, color: MUTED, fontFamily: "Helvetica-Bold" },
  signLine: { borderBottomWidth: 0.8, borderBottomColor: FAINT, marginTop: 26 },
  signHint: { fontSize: 6.5, color: FAINT, marginTop: 3 },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 34,
    right: 34,
    borderTopWidth: 0.6,
    borderTopColor: LINE,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 6.5, color: FAINT },
});

export interface ManagerStatementPdfInput {
  school: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    // Logo PNG/JPEG déjà téléchargé (null : pas de logo, ou format illisible).
    logo?: { data: Buffer; format: "png" | "jpg" } | null;
  };
  currency: string;
  // null : « Non attribué ».
  managerName: string | null;
  from: string;
  to: string;
  statement: ManagerStatement;
  generatedAt: Date;
}

function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(date.getHours())}h${pad(
    date.getMinutes()
  )}`;
}

// « 2026-10-01 » → « 2026-09-30 ».
function dayBefore(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function ManagerStatementDocument(input: ManagerStatementPdfInput) {
  const { school, currency, from, to, statement, generatedAt } = input;
  const { rows, expenses, transfers, openingBalance } = statement;
  const totals = managerStatementTotals(statement);
  const name = pdfText(input.managerName ?? "Non attribué");
  const m = (amount: number) => pdfMoney(amount, currency);
  const signed = (amount: number) => (amount > 0 ? `+${m(amount)}` : m(amount));
  const contactLine = [school.address, school.phone, school.email].filter(Boolean).join("  ·  ");
  const periodLabel = `Du ${pdfLongDate(from)} au ${pdfLongDate(to)}`;
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

  // Même élève, même montant, même jour : signalé comme à l'écran.
  const sameKey = (row: (typeof rows)[number]) => `${row.studentId}|${row.amount}|${row.paidAt.slice(0, 10)}`;
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(sameKey(row), (counts.get(sameKey(row)) ?? 0) + 1);

  // Le calcul du solde, ligne à ligne, pour le refaire à la main.
  const movements = [
    { label: `Recettes encaissées (${plural(rows.length, "paiement")})`, text: `+ ${m(totals.collected)}`, color: GREEN, show: true },
    {
      label: `Transferts reçus (${totals.receivedCount})`,
      text: `+ ${m(totals.totalReceived)}`,
      color: GREEN,
      show: totals.receivedCount > 0,
    },
    { label: `Dépenses payées (${expenses.length})`, text: `- ${m(totals.spent)}`, color: ROSE, show: true },
    {
      label: `Transferts remis (${totals.sentCount})`,
      text: `- ${m(totals.totalSent)}`,
      color: ROSE,
      show: totals.sentCount > 0,
    },
  ].filter((line) => line.show);

  return (
    <Document
      title={`Relevé de caisse — ${name} — ${from} au ${to}`}
      author={school.name}
      creator="Baraka Compta"
      producer="Baraka Compta"
      subject={`Relevé de caisse de ${name}, ${periodLabel.toLowerCase()}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.band}>
          {school.logo ? (
            <View style={styles.logoBox}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, pas une balise HTML */}
              <Image style={styles.logo} src={school.logo} />
            </View>
          ) : null}
          <View style={styles.bandSchool}>
            <Text style={styles.schoolName}>{school.name.toUpperCase()}</Text>
            {contactLine ? <Text style={styles.schoolMeta}>{contactLine}</Text> : null}
          </View>
          <View style={styles.bandDoc}>
            <Text style={styles.docType}>RELEVÉ DE CAISSE</Text>
            <Text style={styles.docPeriod}>
              {pdfLongDate(from)} - {pdfLongDate(to)}
            </Text>
            <Text style={styles.docDate}>Établi le {stamp(generatedAt)}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Relevé de caisse — {name}</Text>
          <Text style={styles.subtitle}>{periodLabel}  ·  recettes, dépenses et transferts du responsable</Text>

          <View style={styles.summary} wrap={false}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: INK }]}>En main le {pdfShortDate(dayBefore(from))}, avant la période</Text>
              <Text style={[styles.summaryAmount, { color: INK }]}>{m(openingBalance)}</Text>
            </View>
            {movements.map((line) => (
              <View key={line.label} style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { paddingLeft: 10 }]}>{line.label}</Text>
                <Text style={[styles.summaryAmount, { color: line.color }]}>{line.text}</Text>
              </View>
            ))}
            <View style={[styles.summaryRow, { borderTopWidth: 0.5, borderTopColor: LINE }]}>
              <Text style={[styles.summaryLabel, { paddingLeft: 10 }]}>Solde de la période</Text>
              <Text style={[styles.summaryAmount, { color: SLATE }]}>{signed(totals.solde)}</Text>
            </View>
            <View style={styles.summaryTotal}>
              <Text style={[styles.summaryLabel, styles.bold, { color: INK }]}>
                En main le {pdfShortDate(to)} : à retrouver en caisse
              </Text>
              <Text style={[styles.summaryAmount, styles.bold, { fontSize: 10, color: totals.closingBalance >= 0 ? INK : ROSE }]}>
                {m(totals.closingBalance)}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <View wrap={false} minPresenceAhead={40}>
              <Text style={styles.sectionTitle}>RECETTES</Text>
              <View style={styles.th}>
                <Text style={[styles.thText, { flex: 1.3 }]}>DATE</Text>
                <Text style={[styles.thText, { flex: 5 }]}>ÉLÈVE</Text>
                <Text style={[styles.thText, { flex: 1.2 }]}>CLASSE</Text>
                <Text style={[styles.thText, { flex: 1.6 }]}>MOYEN</Text>
                <Text style={[styles.thText, { flex: 1.9, textAlign: "right" }]}>MONTANT</Text>
              </View>
            </View>
            {rows.map((row, index) => (
              <View key={row.id} style={[styles.tr, index % 2 === 1 ? { backgroundColor: ZEBRA } : {}]} wrap={false}>
                <Text style={[styles.cell, { flex: 1.3, color: MUTED }]}>{pdfShortDate(row.paidAt)}</Text>
                <Text style={[styles.cell, { flex: 5, color: INK }]}>
                  {pdfText(row.studentName ?? "-")}
                  {row.familyName ? <Text style={{ color: FAINT }}>  ·  Famille {pdfText(row.familyName)}</Text> : null}
                  {row.studentId !== null && (counts.get(sameKey(row)) ?? 0) > 1 ? (
                    <Text style={{ color: ORANGE }}>  ·  doublon ?</Text>
                  ) : null}
                </Text>
                <Text style={[styles.cell, { flex: 1.2 }]}>{pdfText(row.className ?? "-")}</Text>
                <Text style={[styles.cell, { flex: 1.6 }]}>{paymentMethodLabel(row.paymentMethod, "fr")}</Text>
                <Text style={[styles.cellNum, { flex: 1.9 }]}>{m(row.amount)}</Text>
              </View>
            ))}
            {rows.length === 0 ? <Text style={styles.empty}>Aucun paiement encaissé sur la période.</Text> : null}
            <View style={styles.totalRow} wrap={false}>
              <Text style={[styles.cell, styles.bold, { flex: 9.1, color: INK }]}>TOTAL</Text>
              <Text style={[styles.cellNum, styles.bold, { flex: 1.9, color: GREEN }]}>{m(totals.collected)}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View wrap={false} minPresenceAhead={40}>
              <Text style={styles.sectionTitle}>DÉPENSES</Text>
              <View style={styles.th}>
                <Text style={[styles.thText, { flex: 1.3 }]}>DATE</Text>
                <Text style={[styles.thText, { flex: 5 }]}>DESCRIPTION</Text>
                <Text style={[styles.thText, { flex: 2.8 }]}>CATÉGORIE</Text>
                <Text style={[styles.thText, { flex: 1.9, textAlign: "right" }]}>MONTANT</Text>
              </View>
            </View>
            {expenses.map((expense, index) => (
              <View key={expense.id} style={[styles.tr, index % 2 === 1 ? { backgroundColor: ZEBRA } : {}]} wrap={false}>
                <Text style={[styles.cell, { flex: 1.3, color: MUTED }]}>{pdfShortDate(expense.date)}</Text>
                <Text style={[styles.cell, { flex: 5, color: INK }]}>{pdfText(expense.label)}</Text>
                <Text style={[styles.cell, { flex: 2.8 }]}>{pdfText(expenseCategoryLabel(expense.category, "fr"))}</Text>
                <Text style={[styles.cellNum, { flex: 1.9 }]}>{m(expense.amount)}</Text>
              </View>
            ))}
            {expenses.length === 0 ? <Text style={styles.empty}>Aucune dépense payée sur la période.</Text> : null}
            <View style={styles.totalRow} wrap={false}>
              <Text style={[styles.cell, styles.bold, { flex: 9.1, color: INK }]}>TOTAL</Text>
              <Text style={[styles.cellNum, styles.bold, { flex: 1.9, color: ROSE }]}>{m(totals.spent)}</Text>
            </View>
          </View>

          {transfers.length > 0 && (
            <View style={styles.section}>
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.sectionTitle}>TRANSFERTS ENTRE RESPONSABLES</Text>
                <View style={styles.th}>
                  <Text style={[styles.thText, { flex: 1.3 }]}>DATE</Text>
                  <Text style={[styles.thText, { flex: 3 }]}>MOUVEMENT</Text>
                  <Text style={[styles.thText, { flex: 4.8 }]}>NOTE</Text>
                  <Text style={[styles.thText, { flex: 1.9, textAlign: "right" }]}>MONTANT</Text>
                </View>
              </View>
              {transfers.map((transfer, index) => (
                <View key={transfer.id} style={[styles.tr, index % 2 === 1 ? { backgroundColor: ZEBRA } : {}]} wrap={false}>
                  <Text style={[styles.cell, { flex: 1.3, color: MUTED }]}>{pdfShortDate(transfer.date)}</Text>
                  <Text style={[styles.cell, { flex: 3, color: INK }]}>
                    {transfer.received ? "Reçu de " : "Remis à "}
                    {pdfText(transfer.otherName)}
                  </Text>
                  <Text style={[styles.cell, { flex: 4.8 }]}>{transfer.notes ? pdfText(transfer.notes) : "-"}</Text>
                  <Text style={[styles.cellNum, { flex: 1.9, color: transfer.received ? GREEN : ROSE }]}>
                    {transfer.received ? `+${m(transfer.amount)}` : `-${m(transfer.amount)}`}
                  </Text>
                </View>
              ))}
              <View style={styles.totalRow} wrap={false}>
                <Text style={[styles.cell, styles.bold, { flex: 9.1, color: INK }]}>TOTAL</Text>
                <Text style={[styles.cellNum, styles.bold, { flex: 1.9 }]}>
                  {signed(totals.totalReceived - totals.totalSent)}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.note}>
            Le solde de la période est celui de la ligne de {name} dans le rapport financier. « En main » ajoute ce que
            le responsable avait avant la période : c&apos;est l&apos;argent à compter dans sa caisse.
          </Text>

          <View style={styles.signatures} wrap={false}>
            <View style={styles.signBox}>
              <Text style={styles.signLabel}>LE RESPONSABLE — {name.toUpperCase()}</Text>
              <View style={styles.signLine} />
              <Text style={styles.signHint}>Date et signature</Text>
            </View>
            <View style={styles.signBox}>
              <Text style={styles.signLabel}>VÉRIFIÉ PAR</Text>
              <View style={styles.signLine} />
              <Text style={styles.signHint}>Nom, date et signature</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {school.name} — Relevé de caisse de {name}, {periodLabel.toLowerCase()}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Baraka Compta  ·  Page ${pageNumber} / ${totalPages}`}
            fixed
          />
        </View>
      </Page>
    </Document>
  );
}

export function renderManagerStatementPdf(input: ManagerStatementPdfInput): Promise<Buffer> {
  return renderToBuffer(<ManagerStatementDocument {...input} />);
}
