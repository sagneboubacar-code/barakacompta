import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createExpense, deleteExpense, updateExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from "@/lib/constants/expenses";
import { getLanguage } from "@/lib/i18n/get-language";
import { dashboardExpensesDict } from "@/lib/i18n/dictionaries/dashboard-expenses";
import { formatDate } from "@/lib/format";
import type { ExpenseCategory } from "@/types";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; from?: string; to?: string; error?: string; success?: string };
}) {
  const appUser = await requireRole(["owner", "admin", "accountant"]);
  const language = getLanguage();
  const t = dashboardExpensesDict[language];
  const supabase = createClient();

  let query = supabase
    .from("expenses")
    .select("id, label, category, amount, expense_date, receipt_path, cash_manager_id")
    .order("expense_date", { ascending: false });

  const q = searchParams.q?.trim().replace(/[,()%]/g, "");
  if (q) {
    query = query.ilike("label", `%${q}%`);
  }
  if (EXPENSE_CATEGORIES.some((c) => c.key === searchParams.category)) {
    query = query.eq("category", searchParams.category as ExpenseCategory);
  }
  if (searchParams.from) {
    query = query.gte("expense_date", searchParams.from);
  }
  if (searchParams.to) {
    query = query.lte("expense_date", searchParams.to);
  }

  const { data: expenses } = await query;

  const { data: cashManagers } = await supabase.from("cash_managers").select("id, name").order("sort_order");

  const receiptUrls = new Map<string, string>();
  await Promise.all(
    (expenses ?? [])
      .filter((expense) => expense.receipt_path)
      .map(async (expense) => {
        const { data } = await supabase.storage
          .from("expense-receipts")
          .createSignedUrl(expense.receipt_path as string, 3600);
        if (data?.signedUrl) receiptUrls.set(expense.id, data.signedUrl);
      })
  );

  const query_ = new URLSearchParams();
  if (searchParams.q) query_.set("q", searchParams.q);
  if (searchParams.category) query_.set("category", searchParams.category);
  if (searchParams.from) query_.set("from", searchParams.from);
  if (searchParams.to) query_.set("to", searchParams.to);
  const redirectTo = `/dashboard/expenses${query_.toString() ? `?${query_.toString()}` : ""}`;

  const total = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t.title}</h1>
        <p className="text-sm text-slate-500">{t.totalDisplayed(total)}</p>
      </div>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
      )}
      {searchParams.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{searchParams.success}</p>
      )}

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.search}</span>
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder={t.searchPlaceholder}
            className="w-44 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.category}</span>
          <select
            name="category"
            defaultValue={searchParams.category ?? ""}
            className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">{t.all}</option>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category.key} value={category.key}>
                {expenseCategoryLabel(category.key, language)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.from}</span>
          <input
            name="from"
            type="date"
            defaultValue={searchParams.from ?? ""}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">{t.to}</span>
          <input
            name="to"
            type="date"
            defaultValue={searchParams.to ?? ""}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.filter}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{t.colDate}</th>
              <th className="px-4 py-2 font-medium">{t.colCategory}</th>
              <th className="px-4 py-2 font-medium">{t.colDescription}</th>
              <th className="px-4 py-2 font-medium">{t.colAmount}</th>
              <th className="px-4 py-2 font-medium">{t.colReceipt}</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(expenses ?? []).map((expense) => (
              <tr key={expense.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2 text-slate-600">
                  {formatDate(expense.expense_date, language)}
                </td>
                <td className="px-4 py-2 text-slate-600">{expenseCategoryLabel(expense.category, language)}</td>
                <td className="px-4 py-2 text-slate-900">{expense.label}</td>
                <td className="px-4 py-2 text-slate-600">{expense.amount}</td>
                <td className="px-4 py-2">
                  {receiptUrls.has(expense.id) ? (
                    <a
                      href={receiptUrls.get(expense.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-900 underline"
                    >
                      {t.view}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-start gap-2">
                    <details>
                      <summary className="cursor-pointer text-xs text-slate-600 underline">
                        {t.edit}
                      </summary>
                      <form
                        action={updateExpense}
                        encType="multipart/form-data"
                        className="mt-2 flex w-64 flex-col gap-2"
                      >
                        <input type="hidden" name="id" value={expense.id} />
                        <input type="hidden" name="redirect_to" value={redirectTo} />
                        <input
                          name="expense_date"
                          type="date"
                          defaultValue={expense.expense_date}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                        <select
                          name="category"
                          defaultValue={expense.category}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          {EXPENSE_CATEGORIES.map((category) => (
                            <option key={category.key} value={category.key}>
                              {expenseCategoryLabel(category.key, language)}
                            </option>
                          ))}
                        </select>
                        <input
                          name="label"
                          defaultValue={expense.label}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          name="amount"
                          type="number"
                          min="1"
                          step="1"
                          defaultValue={expense.amount}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                        {(cashManagers ?? []).length > 0 && (
                          <select
                            name="cash_manager_id"
                            defaultValue={expense.cash_manager_id ?? ""}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="">{t.managerPlaceholder}</option>
                            {(cashManagers ?? []).map((manager) => (
                              <option key={manager.id} value={manager.id}>
                                {manager.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          name="receipt"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                          className="text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          {t.save}
                        </button>
                      </form>
                    </details>
                    {(appUser.role === "owner" || appUser.role === "admin") && (
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={expense.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          {t.delete}
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(expenses ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t.noExpenses}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          {t.addExpense}
        </summary>
        <form
          action={createExpense}
          encType="multipart/form-data"
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="redirect_to" value={redirectTo} />
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.date}</span>
            <input
              name="expense_date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.category}</span>
            <select
              name="category"
              defaultValue="autres"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>
                  {expenseCategoryLabel(category.key, language)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-slate-600">{t.description}</span>
            <input
              name="label"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.amount}</span>
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          {(cashManagers ?? []).length > 0 && (
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">{t.managerOptional}</span>
              <select
                name="cash_manager_id"
                defaultValue=""
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">—</option>
                {(cashManagers ?? []).map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">{t.receiptOptional}</span>
            <input
              name="receipt"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="w-full text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t.add}
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
