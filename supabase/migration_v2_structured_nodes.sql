-- Upgrade existing FriendGraph DB (from older schema with nodes.attributes jsonb).
-- Run in Supabase SQL Editor in order. Review backups first.

create extension if not exists "pgcrypto";

-- 1) Enum for relationships
do $$ begin
  create type public.node_relationship as enum (
    'friend',
    'family',
    'acquaintance',
    'colleague',
    'network',
    'romantic',
    'mentor'
  );
exception
  when duplicate_object then null;
end $$;

-- 2) Locations table
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists locations_user_name_lower_idx
  on public.locations (user_id, lower(trim(name)));

create index if not exists locations_user_id_idx on public.locations (user_id);

alter table public.locations enable row level security;

drop policy if exists "locations_select_own" on public.locations;
create policy "locations_select_own"
  on public.locations for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "locations_insert_own" on public.locations;
create policy "locations_insert_own"
  on public.locations for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "locations_update_own" on public.locations;
create policy "locations_update_own"
  on public.locations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "locations_delete_own" on public.locations;
create policy "locations_delete_own"
  on public.locations for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on table public.locations to authenticated;

-- 3) New node columns (keep legacy attributes until migrated)
alter table public.nodes
  add column if not exists location_id uuid references public.locations (id) on delete set null;

alter table public.nodes
  add column if not exists relationship public.node_relationship;

alter table public.nodes
  add column if not exists things_to_remember text;

alter table public.nodes
  add column if not exists custom_attributes jsonb;

alter table public.nodes
  add column if not exists position_x double precision;

alter table public.nodes
  add column if not exists position_y double precision;

update public.nodes
set
  relationship = coalesce(relationship, 'friend'::public.node_relationship),
  things_to_remember = coalesce(things_to_remember, ''),
  custom_attributes = coalesce(custom_attributes, '{}'::jsonb)
where relationship is null
   or things_to_remember is null
   or custom_attributes is null;

alter table public.nodes
  alter column relationship set default 'friend'::public.node_relationship;

alter table public.nodes
  alter column relationship set not null;

alter table public.nodes
  alter column things_to_remember set default '';

alter table public.nodes
  alter column things_to_remember set not null;

alter table public.nodes
  alter column custom_attributes set default '{}'::jsonb;

alter table public.nodes
  alter column custom_attributes set not null;

-- 4) Migrate jsonb attributes -> structured columns + locations (best effort)
insert into public.locations (user_id, name)
select distinct n.owner_id, trim(both '"' from (n.attributes->>'location')::text)
from public.nodes n
where n.attributes ? 'location'
  and coalesce(nullif(trim(both '"' from (n.attributes->>'location')::text), ''), null) is not null
  and not exists (
    select 1 from public.locations l
    where l.user_id = n.owner_id
      and lower(trim(l.name)) = lower(trim(both '"' from (n.attributes->>'location')::text))
  );

with loc_map as (
  select
    n.id as node_id,
    l.id as location_id
  from public.nodes n
  left join public.locations l
    on l.user_id = n.owner_id
   and lower(trim(l.name)) = lower(trim(coalesce(n.attributes->>'location', '')))
  where n.attributes ? 'location'
)
update public.nodes n
set location_id = loc_map.location_id
from loc_map
where n.id = loc_map.node_id
  and loc_map.location_id is not null;

update public.nodes n
set things_to_remember = coalesce(
  nullif(trim(n.attributes->>'thingsToRemember'), ''),
  nullif(trim(n.attributes->>'things_to_remember'), ''),
  n.things_to_remember
)
where n.attributes is not null
  and n.attributes != '{}'::jsonb;

update public.nodes n
set custom_attributes = coalesce(
  (
    select jsonb_object_agg(trim(elem->>'label'), coalesce(elem->>'value', ''))
    from jsonb_array_elements(n.attributes->'extraFields') elem
    where trim(coalesce(elem->>'label', '')) != ''
  ),
  n.custom_attributes,
  '{}'::jsonb
)
where n.attributes ? 'extraFields';

update public.nodes n
set relationship = case lower(trim(coalesce(n.attributes->>'relationship', '')))
  when 'family' then 'family'::public.node_relationship
  when 'network' then 'network'::public.node_relationship
  when 'acquaintance' then 'acquaintance'::public.node_relationship
  when 'colleague' then 'colleague'::public.node_relationship
  when 'romantic' then 'romantic'::public.node_relationship
  when 'mentor' then 'mentor'::public.node_relationship
  when 'friend' then 'friend'::public.node_relationship
  else n.relationship
end
where n.attributes is not null
  and n.attributes->>'relationship' is not null;

update public.nodes n
set
  position_x = coalesce(
    n.position_x,
    nullif((n.attributes->'placement'->>'x')::double precision, null),
    (n.attributes->>'layout_x')::double precision
  ),
  position_y = coalesce(
    n.position_y,
    nullif((n.attributes->'placement'->>'y')::double precision, null),
    (n.attributes->>'layout_y')::double precision
  )
where n.position_x is null
  and n.position_y is null
  and n.attributes is not null;

-- 5) Default location for nodes still missing location_id
insert into public.locations (user_id, name)
select distinct n.owner_id, 'General'
from public.nodes n
where n.location_id is null
  and not exists (
    select 1 from public.locations l
    where l.user_id = n.owner_id and lower(trim(l.name)) = 'general'
  );

update public.nodes n
set location_id = (
  select l.id from public.locations l
  where l.user_id = n.owner_id and lower(trim(l.name)) = 'general'
  limit 1
)
where n.location_id is null;

-- 6) Drop legacy attributes column (comment out if you want to keep for rollback)
alter table public.nodes drop column if exists attributes;

-- 7) Edge labels: normalize empty to friend
update public.edges set label = 'friend' where label is null or trim(label) = '';

alter table public.edges alter column label set default 'friend';
alter table public.edges alter column label set not null;
