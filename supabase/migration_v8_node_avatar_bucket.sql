-- Node profile photos: ensure DB column + dedicated storage bucket (path: {owner_id}/{node_id}/{timestamp}.ext)
-- Run after prior migrations.

alter table public.nodes
  add column if not exists avatar_url text;

-- Public bucket for node avatars (URLs stored in nodes.avatar_url)
insert into storage.buckets (id, name, public)
values ('node-avatars', 'node-avatars', true)
on conflict (id) do nothing;

drop policy if exists "node_avatars_select_public" on storage.objects;
create policy "node_avatars_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'node-avatars');

drop policy if exists "node_avatars_insert_own" on storage.objects;
create policy "node_avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'node-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "node_avatars_update_own" on storage.objects;
create policy "node_avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'node-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'node-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "node_avatars_delete_own" on storage.objects;
create policy "node_avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'node-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
