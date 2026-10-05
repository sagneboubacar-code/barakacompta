import { Document, Font, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { FinancialReport, DailyBreakdown, CashManagerTotal, ExpenseItem } from "@/lib/reports/financial";
import { pdfLongDate, pdfMoney, pdfShortDate, pdfText } from "@/lib/pdf/format";

// Rapport financier = journal de caisse de la période : l'argent réellement
// reçu et dépensé, et le solde qui doit être en caisse. Document remis à la
// direction (et présenté à la banque, aux bailleurs, aux parents). Même
// langage visuel que l'état de recouvrement ; la couleur ne porte qu'un
// sens : vert = entré, rouge = sorti.
//
// Helvetica ne couvre que le latin-1 (WinAnsi) : n'écrire ici que des
// caractères latin-1, et formater les montants avec pdfMoney.

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

  tiles: { flexDirection: "row", gap: 8, marginTop: 12 },
  tile: { flex: 1, borderWidth: 0.8, borderColor: LINE, borderLeftWidth: 3, borderRadius: 3, paddingVertical: 9, paddingHorizontal: 10 },
  tileLabel: { fontSize: 6.5, letterSpacing: 0.7, color: MUTED, fontFamily: "Helvetica-Bold" },
  tileValue: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 4 },
  tileHint: { fontSize: 6.5, color: MUTED, marginTop: 2 },

  twoCols: { flexDirection: "row", gap: 18 },
  col: { flex: 1 },

  section: { marginTop: 14 },
  sectionTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.9, color: INK, paddingBottom: 4 },

  th: { flexDirection: "row", backgroundColor: INK, paddingVertical: 5, paddingHorizontal: 6 },
  thText: { fontSize: 6.5, letterSpacing: 0.5, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: LINE },
  cell: { fontSize: 8, color: SLATE },
  cellNum: { fontSize: 8, textAlign: "right" },
  empty: { fontSize: 7.5, color: FAINT, paddingVertical: 6, paddingHorizontal: 6 },
  totalRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: INK },
  groupRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, marginTop: 4, backgroundColor: "#f1f5f9" },
  bold: { fontFamily: "Helvetica-Bold" },

  note: { fontSize: 7, color: MUTED, marginTop: 10 },

  signatures: { flexDirection: "row", gap: 30, marginTop: 16 },
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

export interface FinancialPdfInput {
  school: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    // Logo PNG/JPEG déjà téléchargé (null : pas de logo, ou format illisible).
    logo?: { data: Buffer; format: "png" | "jpg" } | null;
  };
  currency: string;
  from: string;
  to: string;
  report: FinancialReport;
  dailyBreakdown: DailyBreakdown[];
  cashManagerBreakdown: CashManagerTotal[];
  generatedAt: Date;
}

function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(date.getHours())}h${pad(
    date.getMinutes()
  )}`;
}

function FinancialReportDocument(input: FinancialPdfInput) {
  const { school, currency, from, to, report, dailyBreakdown, cashManagerBreakdown, generatedAt } = input;
  const m = (amount: number) => pdfMoney(amount, currency);
  const contactLine = [school.address, school.phone, school.email].filter(Boolean).join("  ·  ");
  const periodLabel = `Du ${pdfLongDate(from)} au ${pdfLongDate(to)}`;
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

  const tiles = [
    {
      label: "RECETTES ENCAISSÉES",
      value: report.totalCollected,
      color: GREEN,
      bar: GREEN,
      hint: `${plural(report.paymentsCount, "paiement")} sur la période`,
    },
    { label: "DÉPENSES", value: report.totalExpenses, color: ROSE, bar: ROSE, hint: "sorties de caisse" },
    {
      label: "SOLDE DE CAISSE",
      value: report.balance,
      color: report.balance >= 0 ? INK : ROSE,
      bar: report.balance >= 0 ? INK : ROSE,
      hint: "recettes - dépenses",
    },
  ];

  return (
    <Document
      title={`Rapport financier — ${school.name} — ${from} au ${to}`}
      author={school.name}
      creator="Baraka Compta"
      producer="Baraka Compta"
      subject={`Rapport financier ${periodLabel.toLowerCase()}`}
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
            <Text style={styles.docType}>RAPPORT FINANCIER</Text>
            <Text style={styles.docPeriod}>
              {pdfLongDate(from)} - {pdfLongDate(to)}
            </Text>
            <Text style={styles.docDate}>Établi le {stamp(generatedAt)}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Rapport financier</Text>
          <Text style={styles.subtitle}>{periodLabel}  ·  argent réellement reçu et dépensé</Text>

          <View style={styles.tiles}>
            {tiles.map((tile) => (
              <View key={tile.label} style={[styles.tile, { borderLeftColor: tile.bar }]}>
                <Text style={styles.tileLabel}>{tile.label}</Text>
                <Text style={[styles.tileValue, { color: tile.color }]}>{m(tile.value)}</Text>
                <Text style={styles.tileHint}>{tile.hint}</Text>
              </View>
            ))}
          </View>

          {/* Recettes et dépenses côte à côte : deux tableaux courts. */}
          <View style={[styles.twoCols, styles.section]} wrap={false}>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>RECETTES PAR TYPE</Text>
              <View style={styles.th}>
                <Text style={[styles.thText, { flex: 3 }]}>TYPE</Text>
                <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>ENCAISSÉ</Text>
              </View>
              {report.revenueByType.map((bucket, index) => (
                <View key={bucket.key} style={[styles.tr, index % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
                  <Text style={[styles.cell, { flex: 3 }]}>{bucket.label}</Text>
                  <Text style={[styles.cellNum, { flex: 2, color: GREEN }]}>{m(bucket.collected)}</Text>
                </View>
              ))}
              {report.revenueByType.length === 0 ? <Text style={styles.empty}>Aucun paiement reçu.</Text> : null}
              <View style={styles.totalRow}>
                <Text style={[styles.cell, styles.bold, { flex: 3, color: INK }]}>TOTAL</Text>
                <Text style={[styles.cellNum, styles.bold, { flex: 2, color: GREEN }]}>{m(report.totalCollected)}</Text>
              </View>
            </View>

            <View style={styles.col}>
              <Text style={styles.sectionTitle}>DÉPENSES PAR CATÉGORIE</Text>
              <View style={styles.th}>
                <Text style={[styles.thText, { flex: 3 }]}>CATÉGORIE</Text>
                <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>MONTANT</Text>
              </View>
              {report.expensesByCategory.map((category, index) => (
                <View key={category.key} style={[styles.tr, index % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
                  <Text style={[styles.cell, { flex: 3 }]}>{category.label}</Text>
                  <Text style={[styles.cellNum, { flex: 2, color: ROSE }]}>{m(category.amount)}</Text>
                </View>
              ))}
              {report.expensesByCategory.length === 0 ? <Text style={styles.empty}>Aucune dépense.</Text> : null}
              <View style={styles.totalRow}>
                <Text style={[styles.cell, styles.bold, { flex: 3, color: INK }]}>TOTAL</Text>
                <Text style={[styles.cellNum, styles.bold, { flex: 2, color: ROSE }]}>{m(report.totalExpenses)}</Text>
              </View>
            </View>
          </View>

          {cashManagerBreakdown.length > 0 && (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>RÉPARTITION PAR RESPONSABLE</Text>
              <View style={styles.th}>
                <Text style={[styles.thText, { flex: 3 }]}>RESPONSABLE</Text>
                <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>RECETTES</Text>
                <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>DÉPENSES</Text>
                <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>SOLDE EN MAIN</Text>
              </View>
              {cashManagerBreakdown.map((manager, index) => {
                const quiet = manager.collected === 0 && manager.spent === 0 && manager.solde === 0;
                return (
                  <View
                    key={manager.cashManagerId ?? "none"}
                    style={[styles.tr, index % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}
                  >
                    <Text style={[styles.cell, { flex: 3 }, quiet ? { color: FAINT } : {}]}>{manager.name}</Text>
                    <Text style={[styles.cellNum, { flex: 2 }, quiet ? { color: FAINT } : {}]}>{m(manager.collected)}</Text>
                    <Text style={[styles.cellNum, { flex: 2 }, quiet ? { color: FAINT } : {}]}>{m(manager.spent)}</Text>
                    <Text style={[styles.cellNum, styles.bold, { flex: 2 }, quiet ? { color: FAINT } : {}]}>
                      {m(manager.solde)}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.totalRow}>
                <Text style={[styles.cell, styles.bold, { flex: 3, color: INK }]}>COMPTA FINALE - ÉCOLE</Text>
                <Text style={[styles.cellNum, styles.bold, { flex: 2 }]}>{m(report.totalCollected)}</Text>
                <Text style={[styles.cellNum, styles.bold, { flex: 2 }]}>{m(report.totalExpenses)}</Text>
                <Text style={[styles.cellNum, styles.bold, { flex: 2, color: report.balance >= 0 ? INK : ROSE }]}>
                  {m(report.balance)}
                </Text>
              </View>
            </View>
          )}

          {report.expensesByCategory.length > 0 && (
            <View style={styles.section}>
              <View wrap={false} minPresenceAhead={40}>
                <Text style={styles.sectionTitle}>DÉTAIL DES DÉPENSES</Text>
                <View style={styles.th}>
                  <Text style={[styles.thText, { flex: 1.4 }]}>DATE</Text>
                  <Text style={[styles.thText, { flex: 5 }]}>DESCRIPTION</Text>
                  <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>MONTANT</Text>
                </View>
              </View>
              {report.expensesByCategory.map((category) => {
                const [first, ...rest] = category.items;
                const row = (item: ExpenseItem) => (
                  <View key={item.id} style={styles.tr} wrap={false}>
                    <Text style={[styles.cell, { flex: 1.4, color: MUTED }]}>{pdfShortDate(item.date)}</Text>
                    <Text style={[styles.cell, { flex: 5, color: INK }]}>{pdfText(item.label)}</Text>
                    <Text style={[styles.cellNum, { flex: 2 }]}>{m(item.amount)}</Text>
                  </View>
                );
                return (
                  <View key={category.key}>
                    {/* L'intitulé de la catégorie ne reste jamais seul en bas de page. */}
                    <View wrap={false}>
                      <View style={styles.groupRow}>
                        <Text style={[styles.cell, styles.bold, { flex: 6.4, color: INK }]}>
                          {category.label.toUpperCase()}
                        </Text>
                        <Text style={[styles.cellNum, styles.bold, { flex: 2, color: ROSE }]}>{m(category.amount)}</Text>
                      </View>
                      {first ? row(first) : null}
                    </View>
                    {rest.map(row)}
                  </View>
                );
              })}
              <View style={styles.totalRow} wrap={false}>
                <Text style={[styles.cell, styles.bold, { flex: 6.4, color: INK }]}>TOTAL</Text>
                <Text style={[styles.cellNum, styles.bold, { flex: 2, color: ROSE }]}>{m(report.totalExpenses)}</Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DÉTAIL JOURNALIER</Text>
            <View style={styles.th}>
              <Text style={[styles.thText, { flex: 2 }]}>DATE</Text>
              <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>RECETTES</Text>
              <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>DÉPENSES</Text>
              <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>SOLDE DU JOUR</Text>
              <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>CUMUL</Text>
            </View>
            {dailyBreakdown.map((day, index) => (
              <View key={day.key} style={[styles.tr, index % 2 === 1 ? { backgroundColor: ZEBRA } : {}]} wrap={false}>
                <Text style={[styles.cell, { flex: 2, color: INK }]}>{day.label}</Text>
                <Text style={[styles.cellNum, { flex: 2, color: day.recettes > 0 ? GREEN : FAINT }]}>
                  {day.recettes > 0 ? m(day.recettes) : "-"}
                </Text>
                <Text style={[styles.cellNum, { flex: 2, color: day.depenses > 0 ? ROSE : FAINT }]}>
                  {day.depenses > 0 ? m(day.depenses) : "-"}
                </Text>
                <Text style={[styles.cellNum, { flex: 2 }]}>{m(day.solde)}</Text>
                <Text style={[styles.cellNum, styles.bold, { flex: 2, color: day.cumul >= 0 ? INK : ROSE }]}>
                  {m(day.cumul)}
                </Text>
              </View>
            ))}
            {dailyBreakdown.length === 0 ? <Text style={styles.empty}>Aucun mouvement de caisse sur la période.</Text> : null}
            <View style={styles.totalRow} wrap={false}>
              <Text style={[styles.cell, styles.bold, { flex: 2, color: INK }]}>TOTAL</Text>
              <Text style={[styles.cellNum, styles.bold, { flex: 2, color: GREEN }]}>{m(report.totalCollected)}</Text>
              <Text style={[styles.cellNum, styles.bold, { flex: 2, color: ROSE }]}>{m(report.totalExpenses)}</Text>
              <Text style={[styles.cellNum, styles.bold, { flex: 4, color: report.balance >= 0 ? INK : ROSE }]}>
                {m(report.balance)}
              </Text>
            </View>
          </View>

          <Text style={styles.note}>
            Ce rapport suit l&apos;argent réellement reçu et dépensé pendant la période. Les montants attendus et
            les impayés figurent dans l&apos;état de recouvrement.
          </Text>

          <View style={styles.signatures} wrap={false}>
            <View style={styles.signBox}>
              <Text style={styles.signLabel}>LE RESPONSABLE DE CAISSE</Text>
              <View style={styles.signLine} />
              <Text style={styles.signHint}>Nom, date et signature</Text>
            </View>
            <View style={styles.signBox}>
              <Text style={styles.signLabel}>LA DIRECTION</Text>
              <View style={styles.signLine} />
              <Text style={styles.signHint}>Visa et cachet</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {school.name} — Rapport financier, {periodLabel.toLowerCase()}
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

export function renderFinancialReportPdf(input: FinancialPdfInput): Promise<Buffer> {
  return renderToBuffer(<FinancialReportDocument {...input} />);
}
