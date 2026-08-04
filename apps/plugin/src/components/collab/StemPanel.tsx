import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import type { ConversationStem, HostRenderedStemFile, HostStemCapabilities, HostStemExportStatus, HostStemTrack, StemDropRequest } from '../../types/stems'
import { extractAudioTimeline, mergeEmbeddedTimelineWithProject, probeRemoteAudioFormat, refreshDawTimelineSnapshot } from '../../lib/audioTimeline'
import type { AudioFormatProbe } from '../../lib/audioTimeline'
import type { AttachmentTimelineMetadata } from '../../types/collab'
import { AudioAttachment } from './ChatView'
import { callJuceNative, hasJuceBridge } from '../../lib/juceBridge'

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
  const [addOpen, setAddOpen] = useState(false)
  const [hostStatus, setHostStatus] = useState<HostStemCapabilities | null>(null)
  const [hostTracks, setHostTracks] = useState<HostStemTrack[]>([])
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set())
  const [rangeMode, setRangeMode] = useState<'session' | 'selection'>('session')
  const [hostLoading, setHostLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const consumed = useRef(new Set<string>())

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

  const refreshHostTracks = useCallback(async () => {
    setHostLoading(true)
    try {
      const statusText = await callJuceNative('getHostControlStatus')
      if (statusText.startsWith('error:')) {
        setHostStatus(null)
        setHostTracks([])
        return
      }
      const status = JSON.parse(statusText) as HostStemCapabilities
      setHostStatus(status)
      if (!status.connected) {
        await callJuceNative('getHostTracks')
        await new Promise(resolve => setTimeout(resolve, 350))
      }
      const trackText = await callJuceNative('getHostTracks')
      const tracks = trackText.startsWith('error:') ? [] : JSON.parse(trackText) as HostStemTrack[]
      setHostTracks(tracks)
      setSelectedTracks(previous => {
        if (previous.size > 0) return previous
        return new Set(tracks.filter(track => track.selected).map(track => track.index))
      })
      const refreshedStatusText = await callJuceNative('getHostControlStatus')
      if (!refreshedStatusText.startsWith('error:'))
        setHostStatus(JSON.parse(refreshedStatusText) as HostStemCapabilities)
    } catch {
      setHostStatus(null)
      setHostTracks([])
    } finally {
      setHostLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!addOpen) return
    void refreshHostTracks()
  }, [addOpen, refreshHostTracks])

  const toggleTrack = useCallback((track: HostStemTrack) => {
    setSelectedTracks(previous => {
      const next = new Set(previous)
      const selected = !next.has(track.index)
      if (selected) next.add(track.index)
      else next.delete(track.index)
      void callJuceNative('setHostTrackSelected', [track.index, selected])
      return next
    })
  }, [])

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
        body: JSON.stringify({ ext, contentType, userId: currentUserId }),
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

  const uploadRenderedStem = useCallback(async (file: HostRenderedStemFile) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'wav'
    const contentType = file.mimeType || 'audio/wav'
    setUploading(previous => [...previous, { name: file.name, progress: 0.15 }])
    try {
      const presign = await fetch('/api/r2-upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ext, contentType, userId: currentUserId }),
      })
      if (!presign.ok) throw new Error('presign')
      const { uploadUrl, publicUrl } = await presign.json() as { uploadUrl: string; publicUrl: string }
      setUploading(previous => previous.map(item => item.name === file.name ? { ...item, progress: 0.5 } : item))
      const nativeResult = await callJuceNative('uploadHostStemFile', [file.path, uploadUrl, contentType], 60 * 60 * 1000)
      if (nativeResult !== 'ok') throw new Error(nativeResult)
      setUploading(previous => previous.map(item => item.name === file.name ? { ...item, progress: 1 } : item))

      const sourceSamples = file.sourceSamples ?? 0
      const seconds = sourceSamples / file.sampleRate
      const timeline: AttachmentTimelineMetadata = {
        schema_version: 1,
        position: {
          source_samples: sourceSamples,
          sample_rate: file.sampleRate,
          bit_depth: file.bitDepth,
          seconds,
          source: 'daw_playhead',
          confidence: 'exact',
        },
        tempo_map: hostTimeline?.tempo_map,
        time_signature_map: hostTimeline?.time_signature_map,
        captured_at: new Date().toISOString(),
      }
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
    } finally {
      setUploading(previous => previous.filter(item => item.name !== file.name))
    }
  }, [conversationId, currentUserId, hostTimeline, supabase])

  const shareSelectedTracks = useCallback(async () => {
    if (selectedTracks.size === 0) return
    setSharing(true)
    setShareStatus('Starting DAW export…')
    try {
      const requestId = await callJuceNative(
        'startHostStemExport',
        [[...selectedTracks].sort((a, b) => a - b).join(','), rangeMode],
        10_000,
      )
      if (requestId.startsWith('error:')) throw new Error(requestId)
      let result: HostStemExportStatus = { status: 'queued' }
      const deadline = Date.now() + 6 * 60 * 60 * 1000
      while (Date.now() < deadline) {
        const raw = await callJuceNative('getHostStemExportStatus', [requestId], 5000)
        result = JSON.parse(raw) as HostStemExportStatus
        setShareStatus(result.message || (result.status === 'queued' ? 'Waiting for DAW…' : `Rendering ${Math.round((result.progress ?? 0) * 100)}%`))
        if (result.status === 'complete' || result.status === 'error') break
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      if (result.status === 'error') throw new Error(result.message || 'DAW export failed')
      if (result.status !== 'complete' || !result.files?.length) throw new Error('DAW export timed out')
      for (let index = 0; index < result.files.length; index++) {
        setShareStatus(`Uploading ${index + 1} of ${result.files.length}…`)
        await uploadRenderedStem(result.files[index])
      }
      await load()
      setAddOpen(false)
      setShareStatus('')
    } catch (shareError) {
      console.error('[StemPanel] automatic export failed', shareError)
      setError(shareError instanceof Error ? shareError.message : 'Could not export and share DAW stems.')
    } finally {
      setSharing(false)
    }
  }, [load, rangeMode, selectedTracks, uploadRenderedStem])

  const uploadFiles = useCallback(async (files: File[], fallback = pendingDrop?.fallbackMetadata ?? null) => {
    for (const file of files) await uploadOne(file, fallback)
  }, [pendingDrop?.fallbackMetadata, uploadOne])

  useEffect(() => {
    if (!pendingDrop || consumed.current.has(pendingDrop.id)) return
    consumed.current.add(pendingDrop.id)
    const files = pendingDrop.files ?? pendingDrop.nativeFiles?.map(file => nativeFile(file.name, file.data)) ?? []
    void uploadFiles(files, pendingDrop.fallbackMetadata).finally(() => onDropConsumed(pendingDrop.id))
  }, [onDropConsumed, pendingDrop, uploadFiles])

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
          <div className="stem-empty"><strong>No stems yet</strong><span>Audio dropped from the DAW will appear here.</span></div>
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

      {addOpen && (
        <section className="stem-add-sheet" aria-label="Add stems from project">
          <div className="stem-add-head">
            <div>
              <strong>Add Stems</strong>
              <span>{hostStatus?.hostName || 'DAW project'}</span>
            </div>
            <button onClick={() => setAddOpen(false)} aria-label="Close">×</button>
          </div>

          {!hasJuceBridge ? (
            <div className="stem-host-notice">Open Orb inside your DAW to read project tracks.</div>
          ) : hostLoading && hostTracks.length === 0 ? (
            <div className="stem-host-notice">Reading tracks from the DAW…</div>
          ) : !hostStatus?.connected ? (
            <div className="stem-host-notice">
              <strong>Connect Orb Control</strong>
              <span>Choose “Orb Control” in your DAW’s Remote or Control Surface setup. No screen access is used.</span>
              <button onClick={() => void refreshHostTracks()}>Refresh</button>
            </div>
          ) : (
            <>
              <div className="stem-host-state">
                <i />
                <span>{hostStatus.adapter}</span>
                <small>{hostStatus.exportMode === 'native' ? 'Native Export' : 'DAW Render'}</small>
              </div>
              <div className="stem-range-tabs">
                <button className={rangeMode === 'session' ? 'on' : ''} onClick={() => setRangeMode('session')}>Entire Session</button>
                <button className={rangeMode === 'selection' ? 'on' : ''} onClick={() => setRangeMode('selection')}>Edit Selection</button>
              </div>
              <div className="stem-track-tools">
                <span>{selectedTracks.size} selected</span>
                <button onClick={() => {
                  const all = selectedTracks.size !== hostTracks.length
                  setSelectedTracks(new Set(all ? hostTracks.map(track => track.index) : []))
                  for (const track of hostTracks)
                    void callJuceNative('setHostTrackSelected', [track.index, all])
                }}>{selectedTracks.size === hostTracks.length ? 'Clear' : 'Select all'}</button>
              </div>
              <div className="stem-track-list">
                {hostTracks.map(track => (
                  <button className={selectedTracks.has(track.index) ? 'on' : ''} key={track.id} onClick={() => toggleTrack(track)}>
                    <i style={track.color ? { background: track.color } : undefined} />
                    <span>{track.name}</span>
                    <b>{selectedTracks.has(track.index) ? '✓' : ''}</b>
                  </button>
                ))}
              </div>
              <button className="stem-share-project" disabled={sharing || selectedTracks.size === 0 || hostStatus.exportMode === 'none'} onClick={() => void shareSelectedTracks()}>
                {hostStatus.exportMode === 'none'
                  ? 'Automatic export unavailable'
                  : sharing ? (shareStatus || 'Working…') : `Share ${selectedTracks.size || ''} Stem${selectedTracks.size === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </section>
      )}

      <footer className="stem-footer">
        <button onClick={() => setAddOpen(open => !open)}>
          <span>＋</span> Add Stems
        </button>
      </footer>
    </div>
  )
}
