import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  FinancialReport,
  DailyBreakdown,
  CashManagerTotal,
} from "@/lib/reports/financial";

// Document comptable destiné à être imprimé, classé et présenté (banque,
// bailleur, assemblée de parents). D'où le parti pris : pas de couleur
// décorative, la couleur ne sert qu'à porter un sens comptable — encaissé en
// vert, reste à recouvrer en ambre, solde négatif en rouge.

const INK = "#0f172a";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const LINE = "#e2e8f0";
const GREEN = "#047857";
const AMBER = "#b45309";
const ROSE = "#be123c";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 62, // laisse la place au pied de page fixe
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
  },

  // En-tête
  letterhead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  schoolName: { fontFamily: "Helvetica-Bold", fontSize: 13, letterSpacing: 0.3 },
  schoolMeta: { fontSize: 8, color: MUTED, marginTop: 3, maxWidth: 330, lineHeight: 1.4 },
  docType: { fontSize: 7.5, letterSpacing: 1.4, color: FAINT, fontFamily: "Helvetica-Bold" },
  docMeta: { fontSize: 8, color: MUTED, marginTop: 3, textAlign: "right" },
  rule: { borderBottomWidth: 1.4, borderBottomColor: INK, marginTop: 10 },

  title: { fontFamily: "Helvetica-Bold", fontSize: 20, letterSpacing: -0.4, marginTop: 18 },
  period: { fontSize: 9.5, color: MUTED, marginTop: 4 },

  // Vignettes de synthèse
  tiles: { flexDirection: "row", gap: 9, marginTop: 18 },
  tile: { flex: 1, borderTopWidth: 2.5, paddingTop: 7, paddingBottom: 9, paddingHorizontal: 8, backgroundColor: "#f8fafc" },
  tileLabel: { fontSize: 7, letterSpacing: 0.7, color: MUTED, fontFamily: "Helvetica-Bold" },
  tileValue: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 5 },

  // Barre de recouvrement
  gaugeWrap: { marginTop: 16 },
  gaugeHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  gaugeLabel: { fontSize: 8, color: MUTED },
  gaugePct: { fontSize: 11, fontFamily: "Helvetica-Bold", color: GREEN },
  gaugeTrack: { height: 6, backgroundColor: "#e2e8f0", marginTop: 5 },
  gaugeFill: { height: 6, backgroundColor: GREEN },

  // Sections
  section: { marginTop: 22 },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.1,
    paddingBottom: 4,
    borderBottomWidth: 1.2,
    borderBottomColor: INK,
  },

  // Tableaux
  th: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.6, borderBottomColor: LINE },
  thText: { fontSize: 7, letterSpacing: 0.6, color: MUTED, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 4.5, borderBottomWidth: 0.5, borderBottomColor: "#f1f5f9" },
  trTotal: { flexDirection: "row", paddingVertical: 6, borderTopWidth: 1.2, borderTopColor: INK, marginTop: 1 },
  cell: { fontSize: 8.5 },
  cellNum: { fontSize: 8.5, textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  quiet: { color: FAINT },

  // Détail journalier sur deux colonnes
  dayBand: { flexDirection: "row", gap: 22 },
  dayCol: { flex: 1 },

  // Signatures
  signatures: { flexDirection: "row", gap: 34, marginTop: 30 },
  signBox: { flex: 1 },
  signLabel: { fontSize: 7.5, letterSpacing: 0.6, color: MUTED, fontFamily: "Helvetica-Bold" },
  signLine: { borderBottomWidth: 0.8, borderBottomColor: FAINT, marginTop: 34 },
  signHint: { fontSize: 7, color: FAINT, marginTop: 4 },

  // Pied de page
  footer: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    borderTopWidth: 0.6,
    borderTopColor: LINE,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: FAINT },
});

export interface FinancialPdfInput {
  school: { name: string; address: string | null; phone: string | null; email: string | null };
  currency: string;
  from: string;
  to: string;
  report: FinancialReport;
  dailyBreakdown: DailyBreakdown[];
  cashManagerBreakdown: CashManagerTotal[];
  generatedAt: Date;
}

// Les polices PDF standard (Helvetica) sont limitées au jeu WinAnsi : pas de
// signe moins U+2212, pas d'espace fine insécable. N'écrire dans ce fichier
// que des caractères latin-1 (le tiret ordinaire, l'espace ordinaire).
//
// Helvetica ne couvre que le latin-1 : les espaces fines insécables que
// produit Intl.NumberFormat("fr-FR") s'y afficheraient en caractères parasites.
// D'où ce formatage maison, à l'espace ordinaire.
function money(amount: number, currency: string): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped} ${currency === "XOF" ? "F CFA" : currency}`;
}

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(
    date.getHours()
  )}h${pad(date.getMinutes())}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function FinancialReportDocument(input: FinancialPdfInput) {
  const { school, currency, from, to, report, dailyBreakdown, cashManagerBreakdown, generatedAt } = input;
  const m = (n: number) => money(n, currency);

  // Adresse et coordonnées sur deux lignes distinctes : sur une seule, une
  // adresse e-mail longue se coupait en plein milieu du mot.
  const addressLine = school.address ?? "";
  const contactLine = [school.phone, school.email].filter(Boolean).join("  ·  ");
  const collectionRate =
    report.totalExpected > 0 ? Math.round((report.totalCollected / report.totalExpected) * 100) : 0;

  const dailyTotals = dailyBreakdown.reduce(
    (acc, d) => ({
      recettes: acc.recettes + d.recettes,
      depenses: acc.depenses + d.depenses,
      solde: acc.solde + d.solde,
    }),
    { recettes: 0, depenses: 0, solde: 0 }
  );

  // Deux colonnes de jours par bande : un mois entier tient ainsi sur une
  // page, au lieu d'une colonne unique qui la traverserait entièrement.
  const dayBands = chunk(chunk(dailyBreakdown, 16), 2);

  const tiles = [
    { label: "MONTANT ATTENDU", value: report.totalExpected, color: MUTED, bar: FAINT },
    { label: "ENCAISSÉ", value: report.totalCollected, color: GREEN, bar: GREEN },
    { label: "À RECOUVRER", value: report.totalRemaining, color: AMBER, bar: AMBER },
    {
      label: "SOLDE",
      value: report.balance,
      color: report.balance >= 0 ? GREEN : ROSE,
      bar: report.balance >= 0 ? GREEN : ROSE,
    },
  ];

  return (
    <Document
      title={`Rapport financier — ${school.name} — ${from} au ${to}`}
      author={school.name}
      creator="Baraka Compta"
      producer="Baraka Compta"
      subject={`Rapport financier du ${longDate(from)} au ${longDate(to)}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          <View>
            <Text style={styles.schoolName}>{school.name.toUpperCase()}</Text>
            {addressLine ? <Text style={styles.schoolMeta}>{addressLine}</Text> : null}
            {contactLine ? (
              <Text style={[styles.schoolMeta, { marginTop: 1 }]}>{contactLine}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.docType}>DOCUMENT COMPTABLE</Text>
            <Text style={styles.docMeta}>Établi le {stamp(generatedAt)}</Text>
          </View>
        </View>
        <View style={styles.rule} />

        <Text style={styles.title}>Rapport financier</Text>
        <Text style={styles.period}>
          Période du {longDate(from)} au {longDate(to)}
        </Text>

        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <View key={tile.label} style={[styles.tile, { borderTopColor: tile.bar }]}>
              <Text style={styles.tileLabel}>{tile.label}</Text>
              <Text style={[styles.tileValue, { color: tile.color }]}>{m(tile.value)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.gaugeWrap}>
          <View style={styles.gaugeHead}>
            <Text style={styles.gaugeLabel}>
              Taux de recouvrement — {m(report.totalCollected)} encaissés sur {m(report.totalExpected)} attendus
            </Text>
            <Text style={styles.gaugePct}>{collectionRate} %</Text>
          </View>
          <View style={styles.gaugeTrack}>
            <View style={[styles.gaugeFill, { width: `${Math.min(collectionRate, 100)}%` }]} />
          </View>
        </View>

        {/* ---------------------------------------------------- Recettes */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>RECETTES DÉTAILLÉES</Text>
          <View style={styles.th}>
            <Text style={[styles.thText, { flex: 3 }]}>TYPE DE FRAIS</Text>
            <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>ATTENDU</Text>
            <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>ENCAISSÉ</Text>
            <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>RESTE</Text>
          </View>
          {report.revenueByType.map((bucket) => {
            const empty = bucket.expected === 0 && bucket.collected === 0;
            return (
              <View key={bucket.key} style={styles.tr}>
                <Text style={[styles.cell, { flex: 3 }, empty ? styles.quiet : {}]}>{bucket.label}</Text>
                <Text style={[styles.cellNum, { flex: 2 }, empty ? styles.quiet : {}]}>{m(bucket.expected)}</Text>
                <Text style={[styles.cellNum, { flex: 2 }, empty ? styles.quiet : { color: GREEN }]}>
                  {m(bucket.collected)}
                </Text>
                <Text style={[styles.cellNum, { flex: 2 }, empty ? styles.quiet : { color: AMBER }]}>
                  {m(bucket.remaining)}
                </Text>
              </View>
            );
          })}
          <View style={styles.trTotal}>
            <Text style={[styles.cell, styles.bold, { flex: 3 }]}>TOTAL</Text>
            <Text style={[styles.cellNum, styles.bold, { flex: 2 }]}>{m(report.totalExpected)}</Text>
            <Text style={[styles.cellNum, styles.bold, { flex: 2, color: GREEN }]}>{m(report.totalCollected)}</Text>
            <Text style={[styles.cellNum, styles.bold, { flex: 2, color: AMBER }]}>{m(report.totalRemaining)}</Text>
          </View>
        </View>

        {/* ---------------------------------------------------- Dépenses */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>DÉPENSES PAR CATÉGORIE</Text>
          <View style={styles.th}>
            <Text style={[styles.thText, { flex: 5 }]}>CATÉGORIE</Text>
            <Text style={[styles.thText, { flex: 3, textAlign: "right" }]}>MONTANT</Text>
          </View>
          {report.expensesByCategory.map((category) => (
            <View key={category.key} style={styles.tr}>
              <Text style={[styles.cell, { flex: 5 }, category.amount === 0 ? styles.quiet : {}]}>
                {category.label}
              </Text>
              <Text style={[styles.cellNum, { flex: 3 }, category.amount === 0 ? styles.quiet : {}]}>
                {m(category.amount)}
              </Text>
            </View>
          ))}
          <View style={styles.trTotal}>
            <Text style={[styles.cell, styles.bold, { flex: 5 }]}>TOTAL DES DÉPENSES</Text>
            <Text style={[styles.cellNum, styles.bold, { flex: 3 }]}>{m(report.totalExpenses)}</Text>
          </View>
        </View>

        {/* ------------------------------------------------ Responsables */}
        {cashManagerBreakdown.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>RÉPARTITION PAR RESPONSABLE</Text>
            <View style={styles.th}>
              <Text style={[styles.thText, { flex: 3 }]}>RESPONSABLE</Text>
              <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>RECETTES</Text>
              <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>DÉPENSES</Text>
              <Text style={[styles.thText, { flex: 2, textAlign: "right" }]}>SOLDE EN MAIN</Text>
            </View>
            {cashManagerBreakdown.map((manager) => {
              const empty = manager.collected === 0 && manager.spent === 0;
              return (
                <View key={manager.cashManagerId ?? "none"} style={styles.tr}>
                  <Text style={[styles.cell, { flex: 3 }, empty ? styles.quiet : {}]}>{manager.name}</Text>
                  <Text style={[styles.cellNum, { flex: 2 }, empty ? styles.quiet : {}]}>{m(manager.collected)}</Text>
                  <Text style={[styles.cellNum, { flex: 2 }, empty ? styles.quiet : {}]}>{m(manager.spent)}</Text>
                  <Text style={[styles.cellNum, styles.bold, { flex: 2 }, empty ? styles.quiet : {}]}>
                    {m(manager.solde)}
                  </Text>
                </View>
              );
            })}
            <View style={styles.trTotal}>
              <Text style={[styles.cell, styles.bold, { flex: 3 }]}>COMPTA FINALE — ÉCOLE</Text>
              <Text style={[styles.cellNum, styles.bold, { flex: 2 }]}>{m(report.totalCollected)}</Text>
              <Text style={[styles.cellNum, styles.bold, { flex: 2 }]}>{m(report.totalExpenses)}</Text>
              <Text
                style={[
                  styles.cellNum,
                  styles.bold,
                  { flex: 2, color: report.balance >= 0 ? GREEN : ROSE },
                ]}
              >
                {m(report.balance)}
              </Text>
            </View>
          </View>
        )}

        {/* -------------------------------------------- Détail journalier */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DÉTAIL JOURNALIER</Text>
          {dayBands.map((band, bandIndex) => (
            <View key={bandIndex} style={[styles.dayBand, { marginTop: bandIndex === 0 ? 0 : 10 }]} wrap={false}>
              {band.map((column, columnIndex) => (
                <View key={columnIndex} style={styles.dayCol}>
                  <View style={styles.th}>
                    <Text style={[styles.thText, { flex: 3 }]}>DATE</Text>
                    <Text style={[styles.thText, { flex: 3, textAlign: "right" }]}>RECETTES</Text>
                    <Text style={[styles.thText, { flex: 3, textAlign: "right" }]}>DÉPENSES</Text>
                    <Text style={[styles.thText, { flex: 3, textAlign: "right" }]}>SOLDE</Text>
                  </View>
                  {column.map((day) => {
                    const quiet = day.recettes === 0 && day.depenses === 0;
                    return (
                      <View key={day.key} style={styles.tr}>
                        <Text style={[styles.cell, { flex: 3 }, quiet ? styles.quiet : {}]}>{day.label}</Text>
                        <Text style={[styles.cellNum, { flex: 3 }, quiet ? styles.quiet : {}]}>{m(day.recettes)}</Text>
                        <Text style={[styles.cellNum, { flex: 3 }, quiet ? styles.quiet : {}]}>{m(day.depenses)}</Text>
                        <Text style={[styles.cellNum, { flex: 3 }, quiet ? styles.quiet : styles.bold]}>
                          {m(day.solde)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
              {band.length === 1 && <View style={styles.dayCol} />}
            </View>
          ))}
          {/* Total pleine largeur, montants poussés à droite : aligné sous la
              colonne de gauche, il se lirait comme le total de cette seule
              colonne alors qu'il couvre toute la période. */}
          <View style={styles.trTotal}>
            <Text style={[styles.cell, styles.bold, { flex: 1 }]}>TOTAL DE LA PÉRIODE</Text>
            <Text style={[styles.cellNum, styles.bold, { width: 96 }]}>{m(dailyTotals.recettes)}</Text>
            <Text style={[styles.cellNum, styles.bold, { width: 96 }]}>{m(dailyTotals.depenses)}</Text>
            <Text
              style={[
                styles.cellNum,
                styles.bold,
                { width: 96, color: dailyTotals.solde >= 0 ? GREEN : ROSE },
              ]}
            >
              {m(dailyTotals.solde)}
            </Text>
          </View>
        </View>

        {/* ---------------------------------------------------- Synthèse */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>SYNTHÈSE</Text>
          {[
            ["Montant attendu sur la période", m(report.totalExpected), INK],
            ["Montant encaissé", m(report.totalCollected), GREEN],
            ["Montant restant à recouvrer", m(report.totalRemaining), AMBER],
            ["Total des dépenses", m(report.totalExpenses), INK],
          ].map(([label, value, color]) => (
            <View key={label} style={styles.tr}>
              <Text style={[styles.cell, { flex: 5 }]}>{label}</Text>
              <Text style={[styles.cellNum, { flex: 3, color }]}>{value}</Text>
            </View>
          ))}
          <View style={styles.trTotal}>
            <Text style={[styles.cell, styles.bold, { flex: 5 }]}>SOLDE (RECETTES - DÉPENSES)</Text>
            <Text
              style={[
                styles.cellNum,
                styles.bold,
                { flex: 3, fontSize: 11, color: report.balance >= 0 ? GREEN : ROSE },
              ]}
            >
              {m(report.balance)}
            </Text>
          </View>
        </View>

        <View style={styles.signatures} wrap={false}>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>LE RESPONSABLE DE CAISSE</Text>
            <View style={styles.signLine} />
            <Text style={styles.signHint}>Nom, date et signature</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>LA DIRECTION</Text>
            <View style={styles.signLine} />
            <Text style={styles.signHint}>Nom, date et signature</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {school.name} — Rapport financier du {longDate(from)} au {longDate(to)}
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
