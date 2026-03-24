-- Profile picture URL (public bucket path stored as full URL in profiles.avatar_url)
alter table public.profiles
  add column if not exists avatar_url text;

notify pgrst, 'reload schema';
