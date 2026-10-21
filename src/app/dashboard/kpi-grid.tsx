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

// Cases chiffrées en tête du tableau de bord.
export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi) => {
        const content = (
          <>
            <p className="text-xs text-slate-500 sm:text-sm">{kpi.label}</p>
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
