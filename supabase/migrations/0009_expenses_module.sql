-- =========================================================================
-- Module "Dépenses" : catégories fixes, justificatif (image/PDF) sur bucket
-- Storage privé.
-- =========================================================================

update public.expenses set category = 'autres' where category is null;

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses alter column category set default 'autres';
alter table public.expenses alter column category set not null;
alter table public.expenses
  add constraint expenses_category_check
  check (category in (
    'salaires', 'fournitures', 'eau', 'electricite', 'internet',
    'cantine', 'transport', 'entretien', 'autres'
  ));

-- Redondant avec `label` (utilisé comme description) pour ce module.
alter table public.expenses drop column if exists notes;

-- Un justificatif financier n'a pas vocation à être public comme un logo :
-- on stocke désormais un CHEMIN de fichier (pas une URL publique), résolu en
-- URL signée à la demande côté serveur.
alter table public.expenses rename column receipt_url to receipt_path;

-- -------------------------------------------------------------------------
-- Supabase Storage : bucket privé pour les justificatifs de dépenses.
-- Convention de chemin : <school_id>/<fichier> — la RLS Storage vérifie que
-- le premier segment du chemin correspond à l'école de l'utilisateur.
-- Écriture ouverte aux 3 rôles (comme expenses_insert/update) ; suppression
-- réservée à owner/admin (comme expenses_delete).
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

drop policy if exists "expense_receipts_select" on storage.objects;
create policy "expense_receipts_select" on storage.objects
  for select
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists "expense_receipts_insert" on storage.objects;
create policy "expense_receipts_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists "expense_receipts_update" on storage.objects;
create policy "expense_receipts_update" on storage.objects
  for update
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  )
  with check (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

drop policy if exists "expense_receipts_delete" on storage.objects;
create policy "expense_receipts_delete" on storage.objects
  for delete
  using (
    bucket_id = 'expense-receipts'
    and (storage.foldername(name))[1] = public.current_school_id()::text
    and public.has_role(array['owner', 'admin'])
  );
