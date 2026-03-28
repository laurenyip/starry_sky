-- Run in Supabase SQL editor. Ensures node_photos + storage policies for gallery uploads.

CREATE TABLE IF NOT EXISTS node_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  node_id uuid REFERENCES nodes(id) ON DELETE CASCADE,
  url text NOT NULL,
  is_primary boolean DEFAULT false,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE node_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own node_photos" ON node_photos;
CREATE POLICY "Users manage own node_photos"
ON node_photos FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('node-photos', 'node-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload node photos" ON storage.objects;
CREATE POLICY "Users upload node photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'node-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Node photos public read" ON storage.objects;
CREATE POLICY "Node photos public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'node-photos');

DROP POLICY IF EXISTS "Users delete own node photos" ON storage.objects;
CREATE POLICY "Users delete own node photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'node-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
