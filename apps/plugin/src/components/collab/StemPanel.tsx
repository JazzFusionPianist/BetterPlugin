import { resolveUrl } from '../../lib/r2Access'
import { messageId, encryptChatMessage, decryptPrivatePayload, type Envelope } from '@orb/core/lib/chatCrypto.ts'
import { uploadSecureFile } from '@orb/core/lib/secureFiles.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import type { ConversationStem, StemDropRequest } from '../../types/stems'
import { extractAudioTimeline, mergeEmbeddedTimelineWithProject, probeRemoteAudioFormat, refreshDawTimelineSnapshot } from '../../lib/audioTimeline'
import type { AudioFormatProbe } from '../../lib/audioTimeline'
import type { AttachmentTimelineMetadata } from '../../types/collab'
import { AudioAttachment, ImportAllWord, ResolvedBundleAudio } from './ChatView'
import { alignToProjectStart, regionToFile } from '../../lib/audioMerge'
import { uploadRegionBundle, type BundleAudioEntry } from '../../lib/regionBundle'
import { isRegionArchive, prepareRegionTransfer } from '../../lib/regionBundleIO'
import RegionBundleAttachment from './RegionBundleAttachment'
import CaptureRegionsButton from './CaptureRegionsButton'
import ExportTracksButton from './ExportTracksButton'
import { useResolvedUrl } from '../../lib/r2Access'
import { useT } from '../../i18n/LanguageContext'

interface Props {
  supabase: SupabaseClient
  conversationId: string
  currentUserId: string
  participants: Profile[]
  pendingDrop: StemDropRequest | null
  onDropConsumed: (id: string) => void
  /** The host can route a multi-file drop through its conversation context. */
  onMultiFileDrop?: (files: File[]) => void
  /** Optional (additive — only the studio passes it): stems whose
   *  stamp anchors to an absolute project position are padded with
   *  silence to project bar 1 before upload, so the receiver drops
   *  them at bar 1 and they line up. Files without a trustworthy
   *  absolute position upload untouched. */
  alignToBarOne?: boolean
}

const MAX_SIZE = 1000 * 1024 * 1024
const AUDIO_EXTS = new Set(['mp3', 'wav', 'aif', 'aiff', 'm4a', 'ogg', 'flac', 'caf', 'opus', 'aac'])

function isAudio(file: File) {
  return file.type.startsWith('audio/') || AUDIO_EXTS.has(file.name.split('.').pop()?.toLowerCase() ?? '')
}

/** One stem row. A component (not inline JSX in the map) so the stored
 *  public file_url can be resolved to a presigned GET via useResolvedUrl
 *  before AudioAttachment plays/fetches it — keeps working once R2
 *  public access is turned off (falls back to the public url until then). */
function StemRow({ stem, uploader, displayTimeline, mine, deleting, onDelete }: {
  stem: ConversationStem
  uploader: Profile | undefined
  displayTimeline: AttachmentTimelineMetadata | undefined
  mine: boolean
  deleting: boolean
  onDelete: () => void
}) {
  const resolvedUrl = useResolvedUrl(stem.file_url)
  // Two-tap delete — the house pattern ("delete" → "sure?"; never a
  // native confirm). Reverts on its own after 2.6 s.
  const [delSure, setDelSure] = useState(false)
  useEffect(() => {
    if (!delSure) return
    const t = setTimeout(() => setDelSure(false), 2600)
    return () => clearTimeout(t)
  }, [delSure])
  return (
    <div className={`stem-item${deleting ? ' deleting' : ''}`}>
      <div className="stem-sender-avatar" style={{ background: uploader?.avatar_color }} title={uploader?.display_name ?? 'Member'}>
        {uploader?.avatar_url
          ? <img src={uploader.avatar_url} alt="" />
          : (uploader?.initials.slice(0, 1) ?? '?')}
      </div>
      <AudioAttachment
        compact
        url={resolvedUrl}
        name={stem.file_name}
        metadata={displayTimeline}
        from={uploader?.display_name}
      />
      {mine && (
        <button
          className={`stem-del${delSure ? ' sure' : ''}`}
          onClick={() => { if (delSure) { setDelSure(false); onDelete() } else setDelSure(true) }}
        >
          {delSure ? 'sure?' : 'delete'}
        </button>
      )}
    </div>
  )
}

export default function StemPanel({
  supabase, conversationId, currentUserId, participants, pendingDrop, onDropConsumed, onMultiFileDrop, alignToBarOne,
}: Props) {
  const { t } = useT()
  const [stems, setStems] = useState<ConversationStem[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState<{ id:string; name: string; progress: number }[]>([])
  const [error, setError] = useState('')
  const [hostTimeline, setHostTimeline] = useState<AttachmentTimelineMetadata | null>(null)
  const [audioFormats, setAudioFormats] = useState<Record<string, AudioFormatProbe | null>>({})
  const consumed = useRef(new Set<string>())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const conversationRef = useRef(conversationId); conversationRef.current = conversationId

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('conversation_stems')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
    if (conversationRef.current !== conversationId) return
    if (loadError) setError('couldn\'t load stems. try again.')
    else {
      const clear=await Promise.all(((data as (ConversationStem & {encrypted_payload?:Envelope})[])??[]).map(async row=>{
        if(!row.encrypted_payload)return row
        try{const payload=await decryptPrivatePayload(supabase,currentUserId,row.id,row.conversation_id,row.uploader_id,row.encrypted_payload);return {...row,...payload,id:row.id,conversation_id:row.conversation_id,uploader_id:row.uploader_id}}catch{return {...row,file_url:'',file_name:'Encrypted file — could not verify'}}
      }))
      if(conversationRef.current===conversationId)setStems(clear)
    }
    setLoading(false)
  }, [supabase, conversationId,currentUserId])

  useEffect(() => {
    setLoading(true)
    void load()
    const channel = supabase
      .channel(`stems:${conversationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversation_stems',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => { void load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, conversationId, load])

  useEffect(() => {
    void refreshDawTimelineSnapshot().then(setHostTimeline)
  }, [conversationId])

  useEffect(() => {
    const missing = stems.filter(stem => !stem.timeline_metadata?.bundle_id && stem.timeline_metadata?.position?.bit_depth == null && audioFormats[stem.file_url] === undefined)
    if (missing.length === 0) return
    let cancelled = false
    void Promise.all(missing.map(async stem => ({ url: stem.file_url, format: await probeRemoteAudioFormat(await resolveUrl(stem.file_url)) })))
      .then(results => {
        if (cancelled) return
        setAudioFormats(previous => {
          const next = { ...previous }
          for (const result of results) next[result.url] = result.format
          return next
        })
      })
    return () => { cancelled = true }
  }, [audioFormats, stems])

  const encryptedRow = async (row: {conversation_id:string;uploader_id:string;file_url:string;file_key:string;file_name:string;file_size:number;mime_type:string;timeline_metadata:unknown}) => {
    const id=await messageId()
    const encrypted_payload=await encryptChatMessage(supabase,currentUserId,id,row.conversation_id,{file_url:row.file_url,file_name:row.file_name,mime_type:row.mime_type,timeline_metadata:row.timeline_metadata})
    return {...row,id,file_url:'orb-encrypted:',file_name:'Encrypted file',mime_type:'application/octet-stream',timeline_metadata:null,encrypted_payload}
  }

  const uploadOne = useCallback(async (sourceFile: File, fallbackMetadata = pendingDrop?.fallbackMetadata ?? null, deferInsert = false) => {
    if (!isAudio(sourceFile)) { setError(`${sourceFile.name} is not an audio file.`); return }
    if (sourceFile.size > MAX_SIZE) { setError(`${sourceFile.name} is larger than 1 GB.`); return }

    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setUploading(prev => [...prev, { id:key,name: sourceFile.name, progress: 0 }])
    let file = sourceFile
    try {
      // The embedded stamp is read BEFORE upload so the studio's bar-1
      // alignment can pad the very bytes that go out. Files without an
      // anchored absolute position (and every chat send) stay untouched.
      let timeline = await extractAudioTimeline(sourceFile, fallbackMetadata)
      if (alignToBarOne && !deferInsert) {
        const aligned = await alignToProjectStart(sourceFile, timeline)
        if (aligned) { file = aligned.file; timeline = aligned.metadata }
      }

      const contentType = file.type || 'application/octet-stream'
      const { url: publicUrl, key: fileKey } = await uploadSecureFile(supabase, file, { onProgress: progress =>
        setUploading(prev => prev.map(item => item.id === key ? { ...item, progress } : item)) })

      const row = {
        conversation_id: conversationId,
        uploader_id: currentUserId,
        file_url: publicUrl,
        file_key: fileKey,
        file_name: file.name,
        file_size: file.size,
        mime_type: contentType,
        timeline_metadata: timeline,
      }
      if (deferInsert) return row
      const { error: insertError } = await supabase.from('conversation_stems').insert(await encryptedRow(row))
      if (insertError) throw insertError
      await load()
    } catch (uploadError) {
      console.error('[StemPanel] upload failed')
      setError(`couldn't share ${file.name}. try again.`)
      if (deferInsert) throw uploadError
    } finally {
      setUploading(prev => {
        const index = prev.findIndex(item => item.id === key)
        return index < 0 ? prev : prev.filter((_, i) => i !== index)
      })
    }
  }, [alignToBarOne, conversationId, currentUserId, load, pendingDrop?.fallbackMetadata, supabase])

  const uploadFiles = useCallback(async (files: File[], fallback = pendingDrop?.fallbackMetadata ?? null) => {
    if (!files.length) return
    if (files.length === 1 && !isRegionArchive(files[0])) { await uploadOne(files[0], fallback); return }
    setError('')
    try {
      const prepared = await prepareRegionTransfer(files)
      const rows: NonNullable<Awaited<ReturnType<typeof uploadOne>>>[] = []
      await uploadRegionBundle(prepared, async file => {
        const row = await uploadOne(file, null, true)
        if (!row) return null
        rows.push(row)
        return { url: row.file_url, name: row.file_name }
      })
      // One INSERT is atomic; private-file access still uses each original file_key.
      const { error: insertError } = await supabase.from('conversation_stems').insert(await Promise.all(rows.map((row, i) => encryptedRow({
        ...row,
        timeline_metadata: {
          ...row.timeline_metadata,
          bundle_id: prepared.bundle.id,
          bundle_asset_id: prepared.bundle.assets[i].id,
          ...(i === 0 ? { region_bundle: prepared.bundle } : {}),
        },
      }))))
      if (insertError) throw insertError
      await load()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The region bundle was not sent.') }
  }, [pendingDrop?.fallbackMetadata, uploadOne, supabase, load])

  useEffect(() => {
    if (!pendingDrop || consumed.current.has(pendingDrop.id)) return
    consumed.current.add(pendingDrop.id)
    void (async () => {
      const files = pendingDrop.files ?? pendingDrop.nativeFiles?.map(file => regionToFile(file.name, file.data)) ?? []
      await uploadFiles(files, pendingDrop.fallbackMetadata)
    })().finally(() => onDropConsumed(pendingDrop.id))
  }, [onDropConsumed, pendingDrop, uploadFiles])

  // Delete goes through /api/message-delete ({ stemId }) so the R2
  // object dies with the row (RLS "uploaders can delete stems" is the
  // authority). Local state drops the row on success — conversation-
  // filtered realtime never sees stem DELETEs (old rows carry only the
  // PK), so other clients pick it up on their next load.
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set())
  const deleteStem = useCallback(async (stem: ConversationStem) => {
    setDeletingIds(prev => new Set(prev).add(stem.id))
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('no session')
      const res = await fetch('/api/message-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stemId: stem.id }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStems(prev => prev.filter(s => s.id !== stem.id))
    } catch (deleteError) {
      console.error('[StemPanel] delete failed', deleteError)
      setError(`couldn't delete ${stem.file_name}. try again.`)
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(stem.id); return next })
    }
  }, [supabase])

  const handlePickedFiles = useCallback((fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : []
    if (files.length > 0) void uploadFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [uploadFiles])

  return (
    <div
      className={`stem-panel${dragOver ? ' drag-over' : ''}`}
      onDragEnter={event => { event.preventDefault(); setDragOver(true) }}
      onDragOver={event => event.preventDefault()}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false) }}
      onDrop={event => {
        event.preventDefault(); setDragOver(false)
        const files = Array.from(event.dataTransfer.files)
        // Multi-file drops defer to the host's chooser when it wants
        // them (studio); otherwise (combined plugin) upload as always.
        if (onMultiFileDrop && files.length >= 2) { onMultiFileDrop(files); return }
        void uploadFiles(files)
      }}
    >
      <div className="stem-head">
        <CaptureRegionsButton key={conversationId} className="stem-file-btn"
          onCapture={file => uploadFiles([file])} onError={setError} />
        <ExportTracksButton key={`tracks-${conversationId}`} className="stem-file-btn"
          onCapture={file => uploadFiles([file])} />
        <p>{t('stems.dropGuide')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.aif,.aiff,.m4a,.ogg,.flac,.caf,.opus,.aac,.orb-regions.zip"
          multiple
          style={{ display: 'none' }}
          onChange={event => handlePickedFiles(event.target.files)}
        />
        <button className="stem-file-btn" onClick={() => fileInputRef.current?.click()}>
          {t('stems.files')}
        </button>
      </div>

      {error && <button className="stem-error" onClick={() => setError('')}>{error}</button>}
      {uploading.map((item, index) => (
        <div className="stem-upload" key={`${item.name}-${index}`}>
          <div><span>{item.name}</span><small>{Math.round(item.progress * 100)}%</small></div>
          <div className="stem-upload-track"><i style={{ width: `${item.progress * 100}%` }} /></div>
        </div>
      ))}

      {/* Batched import — every stem listed, one armed multi-file drag.
          Quiet word at the list's top right; only where a JUCE host can
          actually receive the drag, and only once there's a set. */}
      {!!window.__JUCE__?.backend && stems.length >= 2 && (
        <div className="stem-list-head">
          <ImportAllWord
            tracks={stems.map(stem => ({ url: stem.file_url, name: stem.file_name }))}
            groupKey={`import-all-stems:${conversationId}`}
            className="stem-import-all"
          />
        </div>
      )}

      <div className="stem-list">
        {loading ? <div className="stem-empty">loading stems…</div> : stems.length === 0 ? (
          <div className="stem-empty"><strong>no stems yet</strong><span>add audio files to share them in this conversation.</span></div>
        ) : stems.map(stem => {
          const bundleId = stem.timeline_metadata?.bundle_id
          if (bundleId) {
            const members = stems.filter(s => s.timeline_metadata?.bundle_id === bundleId && s.uploader_id === stem.uploader_id)
            if (members[0]?.id !== stem.id) return null
            const manifest = members.find(s => s.timeline_metadata?.region_bundle)?.timeline_metadata?.region_bundle
            const entries: BundleAudioEntry[] = members.map(s => ({
              url: s.file_url, name: s.file_name, assetId: s.timeline_metadata?.bundle_asset_id ?? '',
            }))
            if (entries[0]) entries[0].regionBundle = manifest
            return <RegionBundleAttachment key={`${stem.uploader_id}:${bundleId}`} value={entries} renderAudio={entry =>
              <ResolvedBundleAudio url={entry.url} name={entry.name} />} />
          }
          const uploader = participants.find(profile => profile.id === stem.uploader_id)
          const timeline = stem.timeline_metadata?.schema_version === 1 && stem.timeline_metadata.position && stem.timeline_metadata.captured_at
            ? stem.timeline_metadata as AttachmentTimelineMetadata : null
          const mergedTimeline = mergeEmbeddedTimelineWithProject(timeline, hostTimeline)
          const probedFormat = audioFormats[stem.file_url]
          const displayTimeline = mergedTimeline ? {
            ...mergedTimeline,
            position: {
              ...mergedTimeline.position,
              sample_rate: mergedTimeline.position.sample_rate ?? probedFormat?.sampleRate,
              bit_depth: mergedTimeline.position.bit_depth ?? probedFormat?.bitDepth,
            },
          } : undefined
          return (
            <StemRow
              key={stem.id}
              stem={stem}
              uploader={uploader}
              displayTimeline={displayTimeline}
              mine={stem.uploader_id === currentUserId}
              deleting={deletingIds.has(stem.id)}
              onDelete={() => { void deleteStem(stem) }}
            />
          )
        })}
      </div>
    </div>
  )
}
