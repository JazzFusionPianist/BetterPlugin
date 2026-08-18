import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import type { ConversationStem, StemDropRequest } from '../../types/stems'
import { extractAudioTimeline, mergeEmbeddedTimelineWithProject, probeRemoteAudioFormat, refreshDawTimelineSnapshot } from '../../lib/audioTimeline'
import type { AudioFormatProbe } from '../../lib/audioTimeline'
import type { AttachmentTimelineMetadata } from '../../types/collab'
import { AudioAttachment } from './ChatView'

interface Props {
  supabase: SupabaseClient
  conversationId: string
  currentUserId: string
  participants: Profile[]
  pendingDrop: StemDropRequest | null
  onDropConsumed: (id: string) => void
  onClose: () => void
}

const MAX_SIZE = 1000 * 1024 * 1024
const AUDIO_EXTS = new Set(['mp3', 'wav', 'aif', 'aiff', 'm4a', 'ogg', 'flac', 'caf', 'opus', 'aac'])

function isAudio(file: File) {
  return file.type.startsWith('audio/') || AUDIO_EXTS.has(file.name.split('.').pop()?.toLowerCase() ?? '')
}

function nativeFile(name: string, data: string): File {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const mime: Record<string, string> = {
    wav: 'audio/wav', aif: 'audio/aiff', aiff: 'audio/aiff', mp3: 'audio/mpeg',
    m4a: 'audio/mp4', caf: 'audio/x-caf', ogg: 'audio/ogg', flac: 'audio/flac',
  }
  return new File([bytes], name, { type: mime[ext] ?? 'audio/wav' })
}

export default function StemPanel({
  supabase, conversationId, currentUserId, participants, pendingDrop, onDropConsumed, onClose,
}: Props) {
  const [stems, setStems] = useState<ConversationStem[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([])
  const [error, setError] = useState('')
  const [hostTimeline, setHostTimeline] = useState<AttachmentTimelineMetadata | null>(null)
  const [audioFormats, setAudioFormats] = useState<Record<string, AudioFormatProbe | null>>({})
  const consumed = useRef(new Set<string>())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('conversation_stems')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
    if (loadError) setError('Could not load stems.')
    else setStems((data as ConversationStem[]) ?? [])
    setLoading(false)
  }, [supabase, conversationId])

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
    const missing = stems.filter(stem => stem.timeline_metadata?.position.bit_depth == null && audioFormats[stem.file_url] === undefined)
    if (missing.length === 0) return
    let cancelled = false
    void Promise.all(missing.map(async stem => ({ url: stem.file_url, format: await probeRemoteAudioFormat(stem.file_url) })))
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

  const uploadOne = useCallback(async (file: File, fallbackMetadata = pendingDrop?.fallbackMetadata ?? null) => {
    if (!isAudio(file)) { setError(`${file.name} is not an audio file.`); return }
    if (file.size > MAX_SIZE) { setError(`${file.name} is larger than 1 GB.`); return }

    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setUploading(prev => [...prev, { name: file.name, progress: 0 }])
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const contentType = file.type || 'application/octet-stream'
      const presign = await fetch('/api/r2-upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // scope temp = 7-day expiring key, same policy as chat attachments
        body: JSON.stringify({ ext, contentType, userId: currentUserId, scope: 'temp' }),
      })
      if (!presign.ok) throw new Error('presign')
      const { uploadUrl, publicUrl } = await presign.json() as { uploadUrl: string; publicUrl: string }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', contentType)
        xhr.upload.onprogress = event => {
          if (!event.lengthComputable) return
          setUploading(prev => prev.map((item, index) =>
            index === prev.length - 1 ? { ...item, progress: event.loaded / event.total } : item))
        }
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('upload'))
        xhr.onerror = () => reject(new Error('network'))
        xhr.send(file)
      })

      const timeline = await extractAudioTimeline(file, fallbackMetadata)
      const { error: insertError } = await supabase.from('conversation_stems').insert({
        conversation_id: conversationId,
        uploader_id: currentUserId,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: contentType,
        timeline_metadata: timeline,
      })
      if (insertError) throw insertError
      await load()
    } catch (uploadError) {
      console.error('[StemPanel] upload failed', uploadError, key)
      setError(`Could not share ${file.name}.`)
    } finally {
      setUploading(prev => {
        const index = prev.findIndex(item => item.name === file.name)
        return index < 0 ? prev : prev.filter((_, i) => i !== index)
      })
    }
  }, [conversationId, currentUserId, load, pendingDrop?.fallbackMetadata, supabase])

  const uploadFiles = useCallback(async (files: File[], fallback = pendingDrop?.fallbackMetadata ?? null) => {
    for (const file of files) await uploadOne(file, fallback)
  }, [pendingDrop?.fallbackMetadata, uploadOne])

  useEffect(() => {
    if (!pendingDrop || consumed.current.has(pendingDrop.id)) return
    consumed.current.add(pendingDrop.id)
    const files = pendingDrop.files ?? pendingDrop.nativeFiles?.map(file => nativeFile(file.name, file.data)) ?? []
    void uploadFiles(files, pendingDrop.fallbackMetadata).finally(() => onDropConsumed(pendingDrop.id))
  }, [onDropConsumed, pendingDrop, uploadFiles])

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
        void uploadFiles(Array.from(event.dataTransfer.files))
      }}
    >
      <div className="stem-head">
        <h2>Stems</h2>
        <p>Drop audio files here, or use Add Stems to choose multiple files.</p>
        <button className="stem-close" onClick={onClose} aria-label="Close stems">×</button>
      </div>

      {error && <button className="stem-error" onClick={() => setError('')}>{error}</button>}
      {uploading.map((item, index) => (
        <div className="stem-upload" key={`${item.name}-${index}`}>
          <div><span>{item.name}</span><small>{Math.round(item.progress * 100)}%</small></div>
          <div className="stem-upload-track"><i style={{ width: `${item.progress * 100}%` }} /></div>
        </div>
      ))}

      <div className="stem-list">
        {loading ? <div className="stem-empty">Loading stems…</div> : stems.length === 0 ? (
          <div className="stem-empty"><strong>No stems yet</strong><span>Add audio files to share them in this conversation.</span></div>
        ) : stems.map(stem => {
          const uploader = participants.find(profile => profile.id === stem.uploader_id)
          const mergedTimeline = mergeEmbeddedTimelineWithProject(stem.timeline_metadata, hostTimeline)
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
            <div className="stem-item" key={stem.id}>
              <div className="stem-sender-avatar" style={{ background: uploader?.avatar_color }} title={uploader?.display_name ?? 'Member'}>
                {uploader?.avatar_url
                  ? <img src={uploader.avatar_url} alt="" />
                  : (uploader?.initials.slice(0, 1) ?? '?')}
              </div>
              <AudioAttachment
                compact
                url={stem.file_url}
                name={stem.file_name}
                metadata={displayTimeline}
              />
            </div>
          )
        })}
      </div>

      <footer className="stem-footer">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.aif,.aiff,.m4a,.ogg,.flac,.caf,.opus,.aac"
          multiple
          style={{ display: 'none' }}
          onChange={event => handlePickedFiles(event.target.files)}
        />
        <button onClick={() => fileInputRef.current?.click()}>
          <span>＋</span> Add Stems
        </button>
      </footer>
    </div>
  )
}
