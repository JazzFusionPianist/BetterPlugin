/**
 * Supabase Edge Function: cleanup-attachments
 *
 * Runs on a daily cron schedule. Finds messages whose attachments have
 * passed their 7-day expiry, deletes the files from Supabase Storage,
 * then marks those messages as expired so the client can show a tombstone.
 *
 * Deploy:
 *   supabase functions deploy cleanup-attachments --no-verify-jwt
 *
 * Cron (Supabase Dashboard > Edge Functions > cleanup-attachments > Schedule):
 *   0 3 * * *   (every day at 03:00 UTC)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'attachments'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Find messages with expired attachments not yet cleaned up
  const { data: expired, error: fetchErr } = await supabase
    .from('messages')
    .select('id, attachment_url')
    .eq('attachment_expired', false)
    .not('attachment_expires_at', 'is', null)
    .lt('attachment_expires_at', new Date().toISOString())

  if (fetchErr) {
    console.error('[cleanup] fetch error', fetchErr.message)
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 })
  }

  if (!expired || expired.length === 0) {
    console.log('[cleanup] nothing to expire')
    return new Response(JSON.stringify({ deleted: 0 }), { status: 200 })
  }

  // Extract storage paths from public URLs
  // URL format: https://{ref}.supabase.co/storage/v1/object/public/attachments/{path}
  const paths: string[] = []
  for (const msg of expired) {
    if (!msg.attachment_url) continue
    const marker = `/object/public/${BUCKET}/`
    const idx = msg.attachment_url.indexOf(marker)
    if (idx !== -1) {
      paths.push(decodeURIComponent(msg.attachment_url.slice(idx + marker.length)))
    }
  }

  // Delete storage objects (batch)
  if (paths.length > 0) {
    const { error: storageErr } = await supabase.storage.from(BUCKET).remove(paths)
    if (storageErr) {
      // Log but continue — still mark as expired so UI shows tombstone
      console.warn('[cleanup] storage delete partial error', storageErr.message)
    }
  }

  // Mark messages as expired and clear the URL (no point keeping a dead link)
  const ids = expired.map(m => m.id)
  const { error: updateErr } = await supabase
    .from('messages')
    .update({ attachment_expired: true, attachment_url: null })
    .in('id', ids)

  if (updateErr) {
    console.error('[cleanup] update error', updateErr.message)
    return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 })
  }

  console.log(`[cleanup] expired ${ids.length} attachment(s)`)
  return new Response(JSON.stringify({ deleted: ids.length }), { status: 200 })
})
