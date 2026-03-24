-- FriendGraph v4: social constellations (communities), node_constellations, avatars
-- Run in Supabase SQL Editor after prior migrations.

create extension if not exists "pgcrypto";

-- Social / community constellations (separate from geographic "locations")
create table if not exists public.constellations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  color_index integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists constellations_user_name_lower_idx
  on public.constellations (user_id, lower(trim(name)));

create index if not exists constellations_user_id_idx on public.constellations (user_id);

create table if not exists public.node_constellations (
  node_id uuid not null references public.nodes (id) on delete cascade,
  constellation_id uuid not null references public.constellations (id) on delete cascade,
  primary key (node_id, constellation_id)
);

create index if not exists node_constellations_constellation_idx
  on public.node_constellations (constellation_id);

alter table public.nodes
  add column if not exists avatar_url text;

alter table public.constellations enable row level security;
alter table public.node_constellations enable row level security;

drop policy if exists "constellations_select_own" on public.constellations;
create policy "constellations_select_own"
  on public.constellations for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "constellations_insert_own" on public.constellations;
create policy "constellations_insert_own"
  on public.constellations for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "constellations_update_own" on public.constellations;
create policy "constellations_update_own"
  on public.constellations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "constellations_delete_own" on public.constellations;
create policy "constellations_delete_own"
  on public.constellations for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "node_constellations_select_own" on public.node_constellations;
create policy "node_constellations_select_own"
  on public.node_constellations for select
  to authenticated
  using (
    exists (
      select 1 from public.nodes n
      where n.id = node_id and n.owner_id = auth.uid()
    )
  );

drop policy if exists "node_constellations_insert_own" on public.node_constellations;
create policy "node_constellations_insert_own"
  on public.node_constellations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.nodes n
      where n.id = node_id and n.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.constellations c
      where c.id = constellation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "node_constellations_delete_own" on public.node_constellations;
create policy "node_constellations_delete_own"
  on public.node_constellations for delete
  to authenticated
  using (
    exists (
      select 1 from public.nodes n
      where n.id = node_id and n.owner_id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.constellations to authenticated;
grant select, insert, delete on table public.node_constellations to authenticated;

-- Storage bucket for avatars: path {user_id}/{node_id}.<ext>
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
