-- Run in Supabase SQL editor if not already applied (see also migration_v5_profiles_avatar_url.sql).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
