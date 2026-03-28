import type { SupabaseClient } from '@supabase/supabase-js'

export type NodePhotoRow = {
  id: string
  owner_id: string
  node_id: string
  url: string
  is_primary: boolean
  uploaded_at: string
}

const BUCKET = 'node-photos'

/** Storage object path within the bucket, e.g. `userId/nodeId/123.jpg` */
export function storagePathFromPublicUrl(url: string): string | null {
  const pub = `/object/public/${BUCKET}/`
  const i = url.indexOf(pub)
  if (i >= 0) {
    return url.slice(i + pub.length).split('?')[0] ?? null
  }
  const legacy = `${BUCKET}/`
  const j = url.indexOf(legacy)
  if (j >= 0) {
    return url.slice(j + legacy.length).split('?')[0] ?? null
  }
  return null
}

export async function fetchNodePhotos(
  supabase: SupabaseClient,
  nodeId: string
): Promise<{ data: NodePhotoRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('node_photos')
    .select('*')
    .eq('node_id', nodeId)
    .order('uploaded_at', { ascending: true })
  if (error) {
    console.error('[node_photos] fetch', error)
    return { data: null, error: new Error(error.message) }
  }
  return { data: (data ?? []) as NodePhotoRow[], error: null }
}

export async function uploadNodeGalleryPhoto(
  supabase: SupabaseClient,
  nodeId: string,
  file: File
): Promise<
  { ok: true; publicUrl: string; wasPrimary: boolean } | { ok: false; message: string }
> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
  if (sessionErr) {
    console.error('[node_photos] getSession', sessionErr)
    return { ok: false, message: sessionErr.message }
  }
  const session = sessionData.session
  if (!session?.user) {
    return { ok: false, message: 'Not signed in' }
  }
  const userId = session.user.id

  const { count, error: countErr } = await supabase
    .from('node_photos')
    .select('*', { count: 'exact', head: true })
    .eq('node_id', nodeId)
  if (countErr) {
    console.error('[node_photos] count', countErr)
    return { ok: false, message: countErr.message }
  }
  const isPrimary = (count ?? 0) === 0

  const ext = file.name.includes('.') ? (file.name.split('.').pop() ?? 'jpg') : 'jpg'
  const path = `${userId}/${nodeId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false })

  if (uploadError) {
    console.error('[node_photos] storage.upload', uploadError)
    return { ok: false, message: uploadError.message }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { error: insertError } = await supabase.from('node_photos').insert({
    owner_id: userId,
    node_id: nodeId,
    url: publicUrl,
    is_primary: isPrimary,
  })

  if (insertError) {
    console.error('[node_photos] insert', insertError)
    return { ok: false, message: insertError.message }
  }

  if (isPrimary) {
    const { error: nodeErr } = await supabase
      .from('nodes')
      .update({ avatar_url: publicUrl })
      .eq('id', nodeId)
    if (nodeErr) {
      console.error('[node_photos] nodes.update avatar', nodeErr)
      return { ok: false, message: nodeErr.message }
    }
  }

  return { ok: true, publicUrl, wasPrimary: isPrimary }
}

export async function setPhotoAsPrimary(
  supabase: SupabaseClient,
  nodeId: string,
  photoId: string,
  photoUrl: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: clearErr } = await supabase
    .from('node_photos')
    .update({ is_primary: false })
    .eq('node_id', nodeId)
  if (clearErr) {
    console.error('[node_photos] clear primary', clearErr)
    return { ok: false, message: clearErr.message }
  }

  const { error: setErr } = await supabase
    .from('node_photos')
    .update({ is_primary: true })
    .eq('id', photoId)
    .eq('node_id', nodeId)
  if (setErr) {
    console.error('[node_photos] set primary', setErr)
    return { ok: false, message: setErr.message }
  }

  const { error: nodeErr } = await supabase
    .from('nodes')
    .update({ avatar_url: photoUrl })
    .eq('id', nodeId)
  if (nodeErr) {
    console.error('[node_photos] nodes avatar', nodeErr)
    return { ok: false, message: nodeErr.message }
  }

  return { ok: true }
}

export async function deleteNodePhoto(
  supabase: SupabaseClient,
  nodeId: string,
  photo: NodePhotoRow,
  allPhotos: NodePhotoRow[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const others = allPhotos.filter((p) => p.id !== photo.id)

  const { error: delErr } = await supabase
    .from('node_photos')
    .delete()
    .eq('id', photo.id)
    .eq('node_id', nodeId)
  if (delErr) {
    console.error('[node_photos] delete row', delErr)
    return { ok: false, message: delErr.message }
  }

  const objectPath = storagePathFromPublicUrl(photo.url)
  if (objectPath) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([objectPath])
    if (rmErr) {
      console.error('[node_photos] storage.remove', rmErr)
      return { ok: false, message: rmErr.message }
    }
  }

  if (photo.is_primary) {
    const next = others[0] ?? null
    if (next) {
      const { error: u1 } = await supabase
        .from('node_photos')
        .update({ is_primary: true })
        .eq('id', next.id)
        .eq('node_id', nodeId)
      if (u1) {
        console.error('[node_photos] promote next primary', u1)
        return { ok: false, message: u1.message }
      }
      const { error: nErr } = await supabase
        .from('nodes')
        .update({ avatar_url: next.url })
        .eq('id', nodeId)
      if (nErr) {
        console.error('[node_photos] nodes avatar after delete', nErr)
        return { ok: false, message: nErr.message }
      }
    } else {
      const { error: nErr } = await supabase
        .from('nodes')
        .update({ avatar_url: null })
        .eq('id', nodeId)
      if (nErr) {
        console.error('[node_photos] clear avatar', nErr)
        return { ok: false, message: nErr.message }
      }
    }
  }

  return { ok: true }
}
