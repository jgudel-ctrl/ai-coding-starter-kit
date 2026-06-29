-- PROJ-1: Auth & Rollen — profiles, RLS, Trigger, Helper
-- Idempotent: kann mehrfach ausgeführt werden.

-- 1) Rollen-Enum (7 Rollen laut features/PROJ-1-auth-rollen.md)
do $$
begin
  create type public.user_role as enum (
    'admin',
    'arbeitsvorbereitung',
    'wareneingang',
    'werker',
    'qs',
    'warenausgang',
    'fahrer'
  );
exception
  when duplicate_object then null;
end
$$;

-- 2) profiles-Tabelle (hängt an auth.users)
create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text not null,
  full_name             text not null default '',
  role                  public.user_role not null default 'werker',
  status                text not null default 'aktiv' check (status in ('aktiv', 'deaktiviert')),
  must_change_password  boolean not null default true,
  created_at            timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_status on public.profiles (status);

-- 3) Helper: Ist der aktuelle Nutzer ein AKTIVER Admin?
--    SECURITY DEFINER umgeht RLS -> keine Rekursion in den profiles-Policies.
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
      and role = 'admin'
      and status = 'aktiv'
  );
$$;

-- 4) Row Level Security
alter table public.profiles enable row level security;

-- Lesen: eigenes Profil ODER (für Admins) alle Profile
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select
  using (id = auth.uid() or public.is_active_admin());

-- Schreiben (Insert/Update): nur aktive Admins.
-- Alle Profil-Mutationen laufen ohnehin über Server-Actions mit Service-Role
-- (umgeht RLS); diese Policies sind die zweite Verteidigungslinie für Client-Zugriffe.
drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert" on public.profiles
  for insert
  with check (public.is_active_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- 5) Trigger: Bei jedem neuen auth.users-Eintrag automatisch ein Profil anlegen.
--    Rolle/Name/Flag kommen aus den user_metadata (vom Admin beim Anlegen gesetzt).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'werker'),
    'aktiv',
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
