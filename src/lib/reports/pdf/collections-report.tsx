import { Document, Font, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { CollectionsReport, CollectionsRow } from "@/lib/reports/collections";
import { pdfLongDate, pdfMoney } from "@/lib/pdf/format";

// État de recouvrement du mois : document remis à la direction et utilisé
// pour relancer les parents. Trois sections dans l'ordre de l'action à mener
// (en retard → à encaisser → à jour), la couleur ne portant qu'un sens.
//
// Helvetica ne couvre que le latin-1 (WinAnsi) : n'écrire ici que des
// caractères latin-1, et formater les montants avec pdfMoney.

// Pas de coupure de mots en fin de ligne : un nom d'élève coupé en deux
// (« ABDAL-LAH ») se lit mal sur une liste de relance.
Font.registerHyphenationCallback((word) => [word]);

const INK = "#0f172a";
const SLATE = "#334155";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const LINE = "#e2e8f0";
const ZEBRA = "#f8fafc";
const GREEN = "#047857";
const RED = "#b91c1c";
const RED_BG = "#fef2f2";
const BLUE = "#075985";
const BLUE_BG = "#f0f9ff";
const GREEN_BG = "#ecfdf5";

const styles = StyleSheet.create({
  page: { paddingBottom: 58, fontFamily: "Helvetica", fontSize: 8.5, color: INK },
  body: { paddingHorizontal: 34 },

  // Bandeau d'en-tête
  band: { backgroundColor: INK, paddingHorizontal: 34, paddingVertical: 18, flexDirection: "row", alignItems: "center" },
  logoBox: { width: 46, height: 46, backgroundColor: "#ffffff", borderRadius: 4, padding: 3, marginRight: 12 },
  logo: { width: 40, height: 40, objectFit: "contain" },
  bandSchool: { flex: 1 },
  schoolName: { fontFamily: "Helvetica-Bold", fontSize: 13, color: "#ffffff", letterSpacing: 0.4 },
  schoolMeta: { fontSize: 7.5, color: "#cbd5e1", marginTop: 3 },
  bandDoc: { alignItems: "flex-end" },
  docType: { fontSize: 7, letterSpacing: 1.6, color: "#94a3b8", fontFamily: "Helvetica-Bold" },
  docMonth: { fontSize: 12, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 3 },
  docDate: { fontSize: 7, color: "#cbd5e1", marginTop: 3 },

  title: { fontFamily: "Helvetica-Bold", fontSize: 17, letterSpacing: -0.3, marginTop: 18 },
  subtitle: { fontSize: 8.5, color: MUTED, marginTop: 3 },

  // Synthèse
  tiles: { flexDirection: "row", gap: 8, marginTop: 14 },
  tile: { flex: 1, borderWidth: 0.8, borderColor: LINE, borderLeftWidth: 3, borderRadius: 3, paddingVertical: 8, paddingHorizontal: 9 },
  // lineHeight explicite : sans lui, l'étiquette et la valeur peuvent se
  // chevaucher selon les métriques de police du lecteur PDF (voir le même
  // correctif dans financial-report.tsx).
  tileLabel: { fontSize: 6.5, letterSpacing: 0.7, color: MUTED, fontFamily: "Helvetica-Bold", lineHeight: 1.3 },
  tileValue: { fontSize: 12.5, fontFamily: "Helvetica-Bold", marginTop: 6, lineHeight: 1.3 },
  tileHint: { fontSize: 6.5, color: MUTED, marginTop: 4, lineHeight: 1.3 },

  gauge: { marginTop: 12 },
  gaugeHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  gaugeLabel: { fontSize: 7.5, color: MUTED },
  gaugePct: { fontSize: 10, fontFamily: "Helvetica-Bold", color: GREEN },
  gaugeTrack: { height: 5, backgroundColor: LINE, marginTop: 4, borderRadius: 2 },
  gaugeFill: { height: 5, backgroundColor: GREEN, borderRadius: 2 },

  // Sections
  section: { marginTop: 18 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 3 },
  sectionTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.6 },
  sectionMeta: { fontSize: 7.5 },

  th: { flexDirection: "row", backgroundColor: INK, paddingVertical: 5, paddingHorizontal: 6, marginTop: 6 },
  thText: { fontSize: 6.5, letterSpacing: 0.5, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 4.5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: LINE },
  cell: { fontSize: 8, color: SLATE },
  cellStrong: { fontSize: 8, color: INK },
  cellNum: { fontSize: 8, textAlign: "right", fontFamily: "Helvetica-Bold" },
  note: { fontSize: 6.5, textAlign: "right", marginTop: 1 },
  subtotal: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: INK },
  subtotalLabel: { flex: 1, fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  subtotalValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "right" },

  upToDate: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  upToDateItem: { width: "33.33%", paddingVertical: 2.5, paddingRight: 6, fontSize: 7.5, color: SLATE },

  // Signatures
  signatures: { flexDirection: "row", gap: 30, marginTop: 26 },
  signBox: { flex: 1 },
  signLabel: { fontSize: 7, letterSpacing: 0.6, color: MUTED, fontFamily: "Helvetica-Bold" },
  signLine: { borderBottomWidth: 0.8, borderBottomColor: FAINT, marginTop: 32 },
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

export interface CollectionsPdfInput {
  school: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    currency: string;
    // Logo PNG/JPEG déjà téléchargé (null : pas de logo, ou format illisible).
    logo: { data: Buffer; format: "png" | "jpg" } | null;
  };
  monthLabel: string;
  // « Classe CM2 », « Cycle Élémentaire »... ; vide = toutes les classes.
  filtersLabel: string;
  report: CollectionsReport;
  generatedAt: Date;
}

function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(date.getHours())}h${pad(
    date.getMinutes()
  )}`;
}

const byName = (a: CollectionsRow, b: CollectionsRow) => a.name.localeCompare(b.name);

function DebtTable({
  rows,
  money,
  showOverduePart,
}: {
  rows: CollectionsRow[];
  money: (n: number) => string;
  showOverduePart: boolean;
}) {
  return (
    <>
      <View style={styles.th}>
        <Text style={[styles.thText, { width: 20 }]}>N°</Text>
        <Text style={[styles.thText, { flex: 4 }]}>ÉLÈVE</Text>
        <Text style={[styles.thText, { flex: 1.6 }]}>CLASSE</Text>
        <Text style={[styles.thText, { flex: 3 }]}>PARENT</Text>
        <Text style={[styles.thText, { flex: 2.6 }]}>TÉLÉPHONE</Text>
        <Text style={[styles.thText, { flex: 2.6, textAlign: "right" }]}>RESTE DÛ</Text>
      </View>
      {rows.map((row, index) => {
        const partlyLate = showOverduePart && row.overdueRemaining > 0 && row.overdueRemaining < row.totalRemaining;
        return (
          <View key={row.id} style={[styles.tr, index % 2 === 1 ? { backgroundColor: ZEBRA } : {}]} wrap={false}>
            <Text style={[styles.cell, { width: 20, color: FAINT }]}>{index + 1}</Text>
            <Text style={[styles.cellStrong, { flex: 4 }]}>{row.name}</Text>
            <Text style={[styles.cell, { flex: 1.6 }]}>{row.className}</Text>
            <Text style={[styles.cell, { flex: 3 }]}>{row.guardianName}</Text>
            <Text style={[styles.cell, { flex: 2.6 }]}>{row.guardianPhone}</Text>
            <View style={{ flex: 2.6 }}>
              <Text style={styles.cellNum}>{money(row.totalRemaining)}</Text>
              {partlyLate ? <Text style={[styles.note, { color: RED }]}>dont {money(row.overdueRemaining)} en retard</Text> : null}
              {row.colorStatus === "orange" ? <Text style={[styles.note, { color: MUTED }]}>partiellement payé</Text> : null}
            </View>
          </View>
        );
      })}
    </>
  );
}

function CollectionsDocument({ school, monthLabel, filtersLabel, report, generatedAt }: CollectionsPdfInput) {
  const m = (amount: number) => pdfMoney(amount, school.currency);
  const late = report.rows.filter((r) => r.colorStatus === "rouge" || r.colorStatus === "orange").sort(byName);
  const upcoming = report.rows.filter((r) => r.colorStatus === "attente").sort(byName);
  const upToDate = report.rows.filter((r) => r.colorStatus === "vert").sort(byName);
  const lateTotal = late.reduce((s, r) => s + r.totalRemaining, 0);
  const upcomingTotal = upcoming.reduce((s, r) => s + r.totalRemaining, 0);
  const rate = report.expectedTotal > 0 ? Math.round((report.collectedTotal / report.expectedTotal) * 100) : 0;
  const contactLine = [school.address, school.phone, school.email].filter(Boolean).join("  ·  ");
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

  const tiles = [
    { label: "RECETTE TOTALE", value: report.expectedTotal, color: INK, bar: SLATE, hint: "si tous les élèves paient" },
    { label: "DÉJÀ ENCAISSÉ", value: report.collectedTotal, color: GREEN, bar: GREEN, hint: `${rate} % de la recette` },
    { label: "EN RETARD", value: report.overdueTotal, color: RED, bar: RED, hint: "échéance passée" },
    {
      label: "DOIVENT PAYER",
      value: report.upcomingTotal,
      color: BLUE,
      bar: BLUE,
      hint: report.upcomingDueDate ? `échéance le ${pdfLongDate(report.upcomingDueDate)}` : "pas encore échu",
    },
  ];

  return (
    <Document
      title={`État de recouvrement — ${monthLabel} — ${school.name}`}
      author={school.name}
      creator="Baraka Compta"
      producer="Baraka Compta"
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
            <Text style={styles.docType}>ÉTAT DE RECOUVREMENT</Text>
            <Text style={styles.docMonth}>{monthLabel}</Text>
            <Text style={styles.docDate}>Établi le {stamp(generatedAt)}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>État de recouvrement — {monthLabel}</Text>
          <Text style={styles.subtitle}>
            {filtersLabel || "Toutes les classes"}  ·  {plural(report.rows.length, "élève")}  ·  {plural(late.length, "élève")} en
            retard
          </Text>

          <View style={styles.tiles}>
            {tiles.map((tile) => (
              <View key={tile.label} style={[styles.tile, { borderLeftColor: tile.bar }]}>
                <Text style={styles.tileLabel}>{tile.label}</Text>
                <Text style={[styles.tileValue, { color: tile.color }]}>{m(tile.value)}</Text>
                <Text style={styles.tileHint}>{tile.hint}</Text>
              </View>
            ))}
          </View>

          <View style={styles.gauge}>
            <View style={styles.gaugeHead}>
              <Text style={styles.gaugeLabel}>
                Taux de recouvrement : {m(report.collectedTotal)} encaissés sur {m(report.expectedTotal)}
              </Text>
              <Text style={styles.gaugePct}>{rate} %</Text>
            </View>
            <View style={styles.gaugeTrack}>
              <View style={[styles.gaugeFill, { width: `${Math.min(rate, 100)}%` }]} />
            </View>
          </View>

          {late.length > 0 && (
            <View style={styles.section}>
              <View style={[styles.sectionHead, { backgroundColor: RED_BG }]} wrap={false}>
                <Text style={[styles.sectionTitle, { color: RED }]}>EN RETARD — À RELANCER</Text>
                <Text style={[styles.sectionMeta, { color: RED }]}>{plural(late.length, "élève")}</Text>
              </View>
              <DebtTable rows={late} money={m} showOverduePart />
              <View style={styles.subtotal} wrap={false}>
                <Text style={styles.subtotalLabel}>Total des élèves en retard</Text>
                <Text style={[styles.subtotalValue, { color: RED }]}>{m(lateTotal)}</Text>
              </View>
            </View>
          )}

          {upcoming.length > 0 && (
            <View style={styles.section}>
              <View style={[styles.sectionHead, { backgroundColor: BLUE_BG }]} wrap={false}>
                <Text style={[styles.sectionTitle, { color: BLUE }]}>
                  DOIVENT PAYER{report.upcomingDueDate ? ` — ÉCHÉANCE LE ${pdfLongDate(report.upcomingDueDate).toUpperCase()}` : ""}
                </Text>
                <Text style={[styles.sectionMeta, { color: BLUE }]}>{plural(upcoming.length, "élève")}</Text>
              </View>
              <DebtTable rows={upcoming} money={m} showOverduePart={false} />
              <View style={styles.subtotal} wrap={false}>
                <Text style={styles.subtotalLabel}>Total à payer</Text>
                <Text style={[styles.subtotalValue, { color: BLUE }]}>{m(upcomingTotal)}</Text>
              </View>
            </View>
          )}

          {upToDate.length > 0 && (
            <View style={styles.section} wrap={false}>
              <View style={[styles.sectionHead, { backgroundColor: GREEN_BG }]}>
                <Text style={[styles.sectionTitle, { color: GREEN }]}>À JOUR</Text>
                <Text style={[styles.sectionMeta, { color: GREEN }]}>{plural(upToDate.length, "élève")}</Text>
              </View>
              <View style={styles.upToDate}>
                {upToDate.map((row) => (
                  <Text key={row.id} style={styles.upToDateItem}>
                    {row.name} ({row.className})
                  </Text>
                ))}
              </View>
            </View>
          )}

          <View style={styles.signatures} wrap={false}>
            <View style={styles.signBox}>
              <Text style={styles.signLabel}>LE RESPONSABLE DU RECOUVREMENT</Text>
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
            {school.name} — État de recouvrement, {monthLabel}
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

export function renderCollectionsReportPdf(input: CollectionsPdfInput): Promise<Buffer> {
  return renderToBuffer(<CollectionsDocument {...input} />);
}
