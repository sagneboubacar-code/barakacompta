-- Ajoute le téléphone du propriétaire, collecté dès l'inscription : c'est
-- le canal de contact WhatsApp déjà central dans le support Baraka Compta.
alter table public.users add column if not exists phone text;

-- create_school_with_owner gagne un paramètre p_owner_phone (nullable,
-- default null pour rester compatible avec un éventuel appel existant sans
-- ce paramètre) ; on supprime l'ancienne signature pour éviter deux
-- surcharges qui divergent silencieusement.
drop function if exists public.create_school_with_owner(text, text, uuid, text, text);

create or replace function public.create_school_with_owner(
  p_school_name text,
  p_school_slug text,
  p_owner_id uuid,
  p_owner_email text,
  p_owner_full_name text,
  p_owner_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  insert into public.schools (name, slug)
  values (p_school_name, p_school_slug)
  returning id into v_school_id;

  insert into public.users (id, school_id, full_name, email, phone, role)
  values (p_owner_id, v_school_id, p_owner_full_name, p_owner_email, p_owner_phone, 'owner');

  return v_school_id;
end;
$$;

revoke execute on function public.create_school_with_owner(text, text, uuid, text, text, text) from public;
revoke execute on function public.create_school_with_owner(text, text, uuid, text, text, text) from anon;
revoke execute on function public.create_school_with_owner(text, text, uuid, text, text, text) from authenticated;
grant execute on function public.create_school_with_owner(text, text, uuid, text, text, text) to service_role;
