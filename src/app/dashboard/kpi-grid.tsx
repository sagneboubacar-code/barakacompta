import Link from "next/link";

export interface Kpi {
  label: string;
  value: number;
  tone: "neutral" | "positive" | "negative" | "warning";
  // Petite ligne d'explication sous le chiffre (facultative).
  hint?: string;
  // Case cliquable vers le détail (facultatif).
  href?: string;
}

const toneClasses: Record<Kpi["tone"], string> = {
  neutral: "text-slate-900",
  positive: "text-green-700",
  negative: "text-red-700",
  warning: "text-orange-700",
};

// Cases par ligne sur grand écran : chaque groupe remplit exactement sa
// ligne, sans trou au bout. En dessous de xl, six cases par ligne ne
// laissent plus la place aux montants (ils débordaient vers 1100 px).
const wideColumns = { 5: "xl:grid-cols-5", 6: "xl:grid-cols-6" } as const;

// Cases chiffrées en tête du tableau de bord.
export function KpiGrid({ kpis, columns = 6 }: { kpis: Kpi[]; columns?: keyof typeof wideColumns }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${wideColumns[columns]}`}>
      {kpis.map((kpi) => {
        const content = (
          <>
            {/* Deux lignes réservées au libellé : sur une même ligne de cases,
                les montants tombent à la même hauteur même quand un libellé
                (« Mensualités encaissées ») passe à la ligne. */}
            <p className="text-xs text-slate-500 sm:text-sm xl:min-h-[2.5rem]">{kpi.label}</p>
            <p className={`mt-1 text-xl font-semibold sm:text-2xl ${toneClasses[kpi.tone]}`}>{kpi.value}</p>
            {kpi.hint && <p className="mt-1 text-[11px] leading-snug text-slate-400">{kpi.hint}</p>}
          </>
        );
        const className = "rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4";
        return kpi.href ? (
          <Link key={kpi.label} href={kpi.href} className={`${className} block hover:border-slate-400`}>
            {content}
          </Link>
        ) : (
          <div key={kpi.label} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
