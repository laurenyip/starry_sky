-- FriendGraph v7: edge relation_type (owner↔person), pinned node coords, relation change history
-- Run in Supabase SQL Editor after migration_v6_edge_communities.sql

create extension if not exists "pgcrypto";

-- How this person relates to the graph owner (you), on the edge between you and them
alter table public.edges
  add column if not exists relation_type text;

-- Manual canvas pin (local coordinates within the location constellation)
alter table public.nodes
  add column if not exists pos_x double precision;

alter table public.nodes
  add column if not exists pos_y double precision;

-- Exactly one "You" node per owner (app maintains; enforced here)
alter table public.nodes
  add column if not exists is_self boolean not null default false;

create unique index if not exists nodes_one_self_per_owner_idx
  on public.nodes (owner_id)
  where (is_self = true);

create index if not exists nodes_owner_is_self_idx
  on public.nodes (owner_id)
  where (is_self = true);

create table if not exists public.relation_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  node_id uuid not null references public.nodes (id) on delete cascade,
  previous_relation text,
  new_relation text not null,
  changed_at timestamptz not null default now(),
  note text
);

create index if not exists relation_history_owner_node_idx
  on public.relation_history (owner_id, node_id, changed_at desc);

alter table public.relation_history enable row level security;

drop policy if exists "relation_history_select_own" on public.relation_history;
create policy "relation_history_select_own"
  on public.relation_history for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "relation_history_insert_own" on public.relation_history;
create policy "relation_history_insert_own"
  on public.relation_history for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "relation_history_update_own" on public.relation_history;
create policy "relation_history_update_own"
  on public.relation_history for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "relation_history_delete_own" on public.relation_history;
create policy "relation_history_delete_own"
  on public.relation_history for delete
  to authenticated
  using (owner_id = auth.uid());

grant select, insert, update, delete on table public.relation_history to authenticated;

notify pgrst, 'reload schema';
