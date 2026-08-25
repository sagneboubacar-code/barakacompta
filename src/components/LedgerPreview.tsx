import { formatCurrency } from "@/lib/format";

const ROWS = [
  { name: "Aïssatou Diop", detail: "Mensualité — Février", status: "Payé", ok: true },
  { name: "Moussa Ndiaye", detail: "Mensualité — Février", status: "En retard", ok: false },
  { name: "Fatou Sarr", detail: "Frais d'inscription", status: "Payé", ok: true },
];

// L'élément signature de la page : un aperçu du tableau de bord réel, dans
// le même langage visuel que les rapports du produit (chiffres en mono
// tabulaire, filet coloré) — chaque ligne apparaît en cascade, comme un
// registre qui se remplit sous les yeux du visiteur.
export function LedgerPreview() {
  return (
    <div className="relative">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-300/30 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Tableau de bord — Année 2025-2026
          </p>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            En direct
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="animate-ledger-row border-t-2 border-brand bg-slate-50 p-3" style={{ animationDelay: "80ms" }}>
            <p className="text-[11px] text-slate-500">Recettes du mois</p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums text-brand-dark">
              {formatCurrency(1850000)}
            </p>
          </div>
          <div className="animate-ledger-row border-t-2 border-amber-500 bg-slate-50 p-3" style={{ animationDelay: "160ms" }}>
            <p className="text-[11px] text-slate-500">À recouvrer</p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums text-amber-700">
              {formatCurrency(430000)}
            </p>
          </div>
          <div className="animate-ledger-row border-t-2 border-slate-400 bg-slate-50 p-3" style={{ animationDelay: "240ms" }}>
            <p className="text-[11px] text-slate-500">Élèves</p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums text-ink">214</p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
          {ROWS.map((row, i) => (
            <div
              key={row.name}
              className="animate-ledger-row flex items-center justify-between py-2.5 text-sm"
              style={{ animationDelay: `${360 + i * 110}ms` }}
            >
              <div>
                <p className="font-medium text-ink">{row.name}</p>
                <p className="text-xs text-slate-500">{row.detail}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  row.ok ? "bg-brand-light text-brand-dark" : "bg-amber-50 text-amber-700"
                }`}
              >
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
