-- FriendGraph v6: edge-linked communities (hex colors on connections)
-- Run in Supabase SQL Editor after prior migrations.

create extension if not exists "pgcrypto";

-- Replaces social grouping on nodes: each community has a display color; edges reference it.
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists communities_owner_name_lower_idx
  on public.communities (owner_id, lower(trim(name)));

create index if not exists communities_owner_id_idx on public.communities (owner_id);

alter table public.edges
  add column if not exists community_id uuid references public.communities (id) on delete set null;

create index if not exists edges_community_id_idx on public.edges (community_id);

alter table public.communities enable row level security;

drop policy if exists "communities_select_own" on public.communities;
create policy "communities_select_own"
  on public.communities for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "communities_insert_own" on public.communities;
create policy "communities_insert_own"
  on public.communities for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "communities_update_own" on public.communities;
create policy "communities_update_own"
  on public.communities for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "communities_delete_own" on public.communities;
create policy "communities_delete_own"
  on public.communities for delete
  to authenticated
  using (owner_id = auth.uid());

grant select, insert, update, delete on table public.communities to authenticated;

-- Require community_id to be null or owned by the same user (tighten existing edge policies)
drop policy if exists "edges_insert_own" on public.edges;
create policy "edges_insert_own"
  on public.edges for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.nodes n
      where n.id = source_node_id and n.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.nodes n
      where n.id = target_node_id and n.owner_id = auth.uid()
    )
    and (
      community_id is null
      or exists (
        select 1 from public.communities c
        where c.id = community_id and c.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "edges_update_own" on public.edges;
create policy "edges_update_own"
  on public.edges for update
  to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.nodes n
      where n.id = source_node_id and n.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.nodes n
      where n.id = target_node_id and n.owner_id = auth.uid()
    )
    and (
      community_id is null
      or exists (
        select 1 from public.communities c
        where c.id = community_id and c.owner_id = auth.uid()
      )
    )
  );

notify pgrst, 'reload schema';
