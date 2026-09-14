import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { lancerProspection, changerStatutProspect, supprimerProspect } from "@/lib/actions/prospection";
import { telHref, whatsappHref, formatPhone } from "@/lib/phone";
import { formatDate } from "@/lib/format";
import { getLanguage } from "@/lib/i18n/get-language";

export const maxDuration = 300; // l'agent fait plusieurs recherches web

const STATUTS: Record<string, { label: string; classe: string }> = {
  nouveau: { label: "À contacter", classe: "bg-slate-100 text-slate-700" },
  contacte: { label: "Contacté", classe: "bg-blue-50 text-blue-700" },
  interesse: { label: "Intéressé", classe: "bg-amber-50 text-amber-700" },
  refuse: { label: "Refusé", classe: "bg-slate-50 text-slate-400" },
  client: { label: "Devenu client", classe: "bg-emerald-50 text-emerald-700" },
};

const ZONES_SUGGEREES = [
  "écoles franco-arabes Guédiawaye",
  "écoles privées Pikine",
  "écoles franco-arabes Parcelles Assainies",
  "écoles privées Thiès",
  "écoles franco-arabes Touba",
];

export default async function ProspectionPage({
  searchParams,
}: {
  searchParams: { error?: string; ajoutes?: string; vide?: string; zone?: string };
}) {
  await requireRole(["super_admin"]);
  const language = getLanguage();
  const admin = createAdminClient();

  const { data: prospects } = await admin
    .from("prospects")
    .select("*")
    .order("statut")
    .order("score", { ascending: false })
    .order("created_at", { ascending: false });

  const liste = prospects ?? [];
  const parStatut = (s: string) => liste.filter((p) => p.statut === s).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
              Baraka Compta — Prospection
            </p>
            <p className="text-sm text-slate-500">Écoles à démarcher</p>
          </div>
          <Link href="/admin" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Retour au tableau de bord
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {searchParams.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
        )}
        {searchParams.ajoutes && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {searchParams.ajoutes} école(s) ajoutée(s). Les doublons ont été ignorés.
          </p>
        )}
        {searchParams.vide && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Aucune école vérifiable trouvée pour « {searchParams.zone} ». Essayez une zone plus large,
            ou nommez un type d&apos;établissement.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {Object.entries(STATUTS).map(([cle, { label }]) => (
            <div key={cle} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
                {parStatut(cle)}
              </p>
            </div>
          ))}
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Lancer une recherche</h2>
          <p className="mt-1 text-xs text-slate-500">
            L&apos;agent cherche sur le web, ouvre les pages et ne rapporte que les écoles dont il a lu
            les informations. Chaque fiche porte le lien de sa source, à vérifier avant d&apos;appeler.
          </p>
          <form action={lancerProspection} className="mt-3 flex flex-wrap gap-2">
            <input
              name="zone"
              required
              placeholder="ex. écoles franco-arabes Guédiawaye"
              className="min-w-64 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Chercher
            </button>
          </form>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ZONES_SUGGEREES.map((z) => (
              <form key={z} action={lancerProspection}>
                <input type="hidden" name="zone" value={z} />
                <button
                  type="submit"
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                >
                  {z}
                </button>
              </form>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Une recherche consomme quelques centimes d&apos;API et prend 1 à 2 minutes.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Prospects ({liste.length})</h2>

          {liste.length === 0 ? (
            <p className="mt-4 text-center text-sm text-slate-400">
              Aucun prospect pour l&apos;instant. Lancez une recherche ci-dessus.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {liste.map((p) => {
                const statut = STATUTS[p.statut] ?? STATUTS.nouveau;
                const wa = whatsappHref(p.telephone, p.accroche ?? undefined);
                return (
                  <article key={p.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-slate-900">{p.nom}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statut.classe}`}>
                            {statut.label}
                          </span>
                          <span className="font-mono text-xs text-slate-400">{p.score}/5</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[p.type_etablissement, p.quartier, p.ville].filter(Boolean).join(" · ") || "—"}
                        </p>
                        {p.pourquoi && <p className="mt-1 text-xs text-slate-600">{p.pourquoi}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatDate(p.created_at.slice(0, 10), language)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {p.telephone ? (
                        <>
                          <a href={telHref(p.telephone) ?? "#"} className="font-medium text-slate-700 hover:underline">
                            {formatPhone(p.telephone)}
                          </a>
                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-100"
                            >
                              WhatsApp avec le message
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-300">Aucun numéro sur la source</span>
                      )}
                      {p.email && (
                        <span className={p.email_fiable ? "text-slate-600" : "text-slate-400 line-through"}>
                          {p.email}
                          {!p.email_fiable && " (adresse de l'annuaire, pas de l'école)"}
                        </span>
                      )}
                      {/* La source est la garantie : un clic permet de vérifier que
                          l'école et son numéro existent avant de décrocher. */}
                      <a
                        href={p.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 underline hover:text-slate-900"
                      >
                        Vérifier la source
                      </a>
                    </div>

                    {p.accroche && (
                      <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs leading-relaxed text-slate-700">
                        {p.accroche}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {Object.entries(STATUTS)
                        .filter(([cle]) => cle !== p.statut)
                        .map(([cle, { label }]) => (
                          <form key={cle} action={changerStatutProspect}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="statut" value={cle} />
                            <button
                              type="submit"
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            >
                              {label}
                            </button>
                          </form>
                        ))}
                      <form action={supprimerProspect} className="ms-auto">
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
