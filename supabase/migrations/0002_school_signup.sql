-- =========================================================================
-- Inscription d'une nouvelle école (signup)
--
-- L'auth.users est créé côté serveur via l'API Admin (service_role), puis
-- cette fonction crée schools + users(role='owner') en une seule transaction
-- atomique : soit les deux lignes existent, soit aucune (évite un utilisateur
-- Auth orphelin sans école, ou une école sans owner).
-- =========================================================================

create or replace function public.create_school_with_owner(
  p_school_name text,
  p_school_slug text,
  p_owner_id uuid,
  p_owner_email text,
  p_owner_full_name text
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

  insert into public.users (id, school_id, full_name, email, role)
  values (p_owner_id, v_school_id, p_owner_full_name, p_owner_email, 'owner');

  return v_school_id;
end;
$$;

-- Fonction sensible : contourne RLS et crée un tenant. Réservée à service_role,
-- jamais exposée aux clients authenticated/anon (qui ne pourraient sinon créer
-- une école arbitraire ou s'auto-attribuer le rôle owner).
revoke execute on function public.create_school_with_owner(text, text, uuid, text, text) from public;
revoke execute on function public.create_school_with_owner(text, text, uuid, text, text) from anon;
revoke execute on function public.create_school_with_owner(text, text, uuid, text, text) from authenticated;
grant execute on function public.create_school_with_owner(text, text, uuid, text, text) to service_role;
