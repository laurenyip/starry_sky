-- Run in Supabase SQL editor (or via migration) before using "Make graph public" toggle.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;
