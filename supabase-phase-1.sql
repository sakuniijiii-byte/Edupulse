-- EduPulse PRO · Phase 1 only: private student profiles
-- Review this script, then run it in the Supabase SQL Editor before using profile setup.
-- It does not create the Phase 2 community schema or any other task-list tables.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default ''
    check (char_length(display_name) <= 40),
  bio text not null default ''
    check (char_length(bio) <= 200),
  avatar_url text
    check (avatar_url is null or (char_length(avatar_url) <= 500 and avatar_url ~ '^https://')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select (id, username, display_name, bio, avatar_url, created_at) on public.profiles to authenticated;
grant insert (id, username, display_name, bio, avatar_url) on public.profiles to authenticated;
grant update (username, display_name, bio, avatar_url) on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy profiles_insert_own
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.edupulse_handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_display_name text;
begin
  v_base := regexp_replace(
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1), '')),
    '[^a-z0-9_]', '', 'g'
  );
  v_base := left(v_base, 11);
  if char_length(v_base) < 3 then
    v_base := 'student';
  end if;

  v_display_name := left(
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, ''), '@', 1), 'Aspirant'),
    40
  );

  begin
    insert into public.profiles (id, username, display_name)
    values (new.id, v_base, v_display_name)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, username, display_name)
    values (new.id, 'u' || substr(replace(new.id::text, '-', ''), 1, 19), v_display_name)
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

revoke all on function public.edupulse_handle_new_user_profile() from public, anon, authenticated;

drop trigger if exists edupulse_profiles_after_auth_insert on auth.users;
create trigger edupulse_profiles_after_auth_insert
  after insert on auth.users
  for each row execute function public.edupulse_handle_new_user_profile();

commit;
