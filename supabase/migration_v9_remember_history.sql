-- FriendGraph v9: history for Things to Remember edits
-- Run in Supabase SQL Editor after migration_v8_node_avatar_bucket.sql

create extension if not exists "pgcrypto";

create table if not exists public.remember_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  node_id uuid not null references public.nodes (id) on delete cascade,
  content text not null default '',
  saved_at timestamptz not null default now()
);

create index if not exists remember_history_owner_node_idx
  on public.remember_history (owner_id, node_id, saved_at desc);

alter table public.remember_history enable row level security;

drop policy if exists "remember_history_select_own" on public.remember_history;
create policy "remember_history_select_own"
  on public.remember_history for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "remember_history_insert_own" on public.remember_history;
create policy "remember_history_insert_own"
  on public.remember_history for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "remember_history_update_own" on public.remember_history;
create policy "remember_history_update_own"
  on public.remember_history for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "remember_history_delete_own" on public.remember_history;
create policy "remember_history_delete_own"
  on public.remember_history for delete
  to authenticated
  using (owner_id = auth.uid());

grant select, insert, update, delete on table public.remember_history to authenticated;

notify pgrst, 'reload schema';
