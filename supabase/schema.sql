-- FriendGraph — run once in Supabase SQL Editor (adjust if objects already exist)

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

create table public.nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  attributes jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index nodes_owner_id_idx on public.nodes (owner_id);

create table public.edges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  source_node_id uuid not null references public.nodes (id) on delete cascade,
  target_node_id uuid not null references public.nodes (id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);

create index edges_owner_id_idx on public.edges (owner_id);
create index edges_source_node_id_idx on public.edges (source_node_id);
create index edges_target_node_id_idx on public.edges (target_node_id);

alter table public.profiles enable row level security;
alter table public.nodes enable row level security;
alter table public.edges enable row level security;

create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

create policy "nodes_select_own"
  on public.nodes for select
  to authenticated
  using (owner_id = auth.uid());

create policy "nodes_insert_own"
  on public.nodes for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "nodes_update_own"
  on public.nodes for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "nodes_delete_own"
  on public.nodes for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "edges_select_own"
  on public.edges for select
  to authenticated
  using (owner_id = auth.uid());

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
  );

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
  );

create policy "edges_delete_own"
  on public.edges for delete
  to authenticated
  using (owner_id = auth.uid());

grant select on table public.profiles to anon, authenticated;
grant insert, update, delete on table public.profiles to authenticated;

grant select, insert, update, delete on table public.nodes to authenticated;
grant select, insert, update, delete on table public.edges to authenticated;
