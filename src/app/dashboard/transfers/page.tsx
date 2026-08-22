import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createCashTransfer, deleteCashTransfer } from "@/lib/actions/cashTransfers";

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  await requireRole(["owner", "admin", "accountant"]);
  const supabase = createClient();

  const [{ data: cashManagers }, { data: transfers }] = await Promise.all([
    supabase.from("cash_managers").select("id, name").order("sort_order"),
    supabase
      .from("cash_manager_transfers")
      .select(
        "id, amount, transferred_at, notes, from_manager:cash_managers!cash_manager_transfers_from_manager_id_fkey(name), to_manager:cash_managers!cash_manager_transfers_to_manager_id_fkey(name)"
      )
      .order("transferred_at", { ascending: false })
      .limit(50),
  ]);

  const managers = cashManagers ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Transferts entre responsables</h1>
        <p className="text-sm text-slate-500">
          Quand un responsable remet du cash à un autre (ex. Directeur → Adjoint). Ça ajuste le solde de
          chacun sur le Tableau de bord, sans changer les totaux Recettes/Dépenses de l&apos;école.
        </p>
      </div>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{searchParams.success}</p>
      )}

      {managers.length < 2 ? (
        <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Il faut au moins deux responsables configurés (Réglages → Responsables (caisse)) pour enregistrer
          un transfert.
        </p>
      ) : (
        <form
          action={createCashTransfer}
          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
        >
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">De (responsable qui donne)</span>
            <select
              name="from_manager_id"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">— Choisir —</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">À (responsable qui reçoit)</span>
            <select
              name="to_manager_id"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">— Choisir —</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Montant</span>
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Date</span>
            <input
              name="transferred_at"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-slate-600">Note (optionnel)</span>
            <input name="notes" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Enregistrer le transfert
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">De</th>
              <th className="px-4 py-2 font-medium">À</th>
              <th className="px-4 py-2 font-medium">Montant</th>
              <th className="px-4 py-2 font-medium">Note</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(transfers ?? []).map((transfer) => {
              const fromManager = Array.isArray(transfer.from_manager)
                ? transfer.from_manager[0]
                : transfer.from_manager;
              const toManager = Array.isArray(transfer.to_manager) ? transfer.to_manager[0] : transfer.to_manager;
              return (
                <tr key={transfer.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(transfer.transferred_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-2 text-slate-900">{fromManager?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-900">{toManager?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{transfer.amount}</td>
                  <td className="px-4 py-2 text-slate-600">{transfer.notes ?? "—"}</td>
                  <td className="px-4 py-2">
                    <form action={deleteCashTransfer}>
                      <input type="hidden" name="id" value={transfer.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {(transfers ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Aucun transfert enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
