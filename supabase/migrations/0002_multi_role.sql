-- PROJ-1 Erweiterung: Mehrere Rollen pro Nutzer.
-- profiles.role (einzeln) -> profiles.roles (Liste). Idempotent.

-- 1) Neue Array-Spalte + Backfill aus der bisherigen Einzelrolle
alter table public.profiles add column if not exists roles public.user_role[] default '{}';

update public.profiles
   set roles = array[role]::public.user_role[]
 where (roles is null or array_length(roles, 1) is null)
   and role is not null;

-- Fallback für etwaige leere Zeilen
update public.profiles
   set roles = array['werker']::public.user_role[]
 where roles is null or array_length(roles, 1) is null;

alter table public.profiles alter column roles set not null;

do $$
begin
  alter table public.profiles
    add constraint profiles_roles_not_empty check (array_length(roles, 1) >= 1);
exception
  when duplicate_object then null;
end
$$;

-- 2) Index: alten Einzel-Index ersetzen durch GIN auf der Liste
drop index if exists idx_profiles_role;
create index if not exists idx_profiles_roles on public.profiles using gin (roles);

-- 3) Admin-Prüfung auf "enthält admin" umstellen
create or replace function public.is_active_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and 'admin' = any(roles)
      and status = 'aktiv'
  );
$$;

-- 4) Trigger: Rollen aus user_metadata (Array 'roles' bevorzugt, sonst 'role', sonst werker)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_roles public.user_role[];
begin
  if new.raw_user_meta_data ? 'roles' then
    select array_agg(elem::public.user_role)
      into v_roles
      from jsonb_array_elements_text(new.raw_user_meta_data -> 'roles') as elem;
  elsif new.raw_user_meta_data ? 'role' then
    v_roles := array[(new.raw_user_meta_data ->> 'role')::public.user_role];
  end if;

  if v_roles is null or array_length(v_roles, 1) is null then
    v_roles := array['werker']::public.user_role[];
  end if;

  insert into public.profiles (id, email, full_name, roles, status, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_roles,
    'aktiv',
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end
$$;

-- 5) Alte Einzelspalte entfernen (nach Backfill + Funktions-Update)
alter table public.profiles drop column if exists role;
