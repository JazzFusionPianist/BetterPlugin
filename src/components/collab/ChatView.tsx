import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, Message, AttachType } from '../../types/collab'

interface Attachment { url: string; type: AttachType; name: string }

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  otherProfile: Profile
  messages: Message[]
  loading: boolean
  onSend: (content: string, attachment?: Attachment) => Promise<boolean>
  onBack: () => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'today'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDur(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── 이미지 첨부 ──────────────────────────────────────────────
function ImageAttachment({ url, name }: { url: string; name: string }) {
  return (
    <img
      src={url}
      alt={name}
      className="msg-att-img"
      onClick={() => window.open(url, '_blank')}
    />
  )
}

// ── 동영상 첨부 ──────────────────────────────────────────────
function VideoAttachment({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false)
  const thumbRef = useRef<HTMLVideoElement>(null)
  const playRef  = useRef<HTMLVideoElement>(null)

  // WKWebView에서 첫 프레임 썸네일 강제 표시
  const handleMetadata = () => {
    if (thumbRef.current) thumbRef.current.currentTime = 0.1
  }

  const start = () => {
    setPlaying(true)
    setTimeout(() => playRef.current?.play(), 50)
  }

  if (playing) {
    return (
      <div className="msg-att-video-wrap">
        <video
          ref={playRef}
          src={url}
          className="msg-att-video"
          controls
          autoPlay
          playsInline
        />
      </div>
    )
  }

  return (
    <div className="msg-att-video-wrap" onClick={start}>
      <video
        ref={thumbRef}
        src={url}
        className="msg-att-video"
        preload="metadata"
        muted
        playsInline
        onLoadedMetadata={handleMetadata}
      />
      <div className="msg-att-video-overlay">
        <div className="msg-att-play-btn">
          <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  )
}

// ── 오디오 첨부 ──────────────────────────────────────────────
function AudioAttachment({ url, name }: { url: string; name: string }) {
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying]   = useState(false)
  const [current, setCurrent]   = useState(0)
  const [duration, setDuration] = useState(0)
  const [copied, setCopied]     = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // fallback: try window.open
      window.open(url, '_blank')
    })
  }

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = ratio * duration
  }

  return (
    <div className="msg-att-audio">
      <div className="msg-att-audio-header" onClick={() => setExpanded(v => !v)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        <span className="msg-att-audio-name">{name}</span>
        <button
          className="msg-att-download"
          onClick={handleDownload}
          title="Copy link to download"
        >
          {copied
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 21h14"/></svg>
          }
        </button>
        {copied && <span className="msg-att-copied">Link copied!</span>}
        <span className="msg-att-audio-chevron">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="msg-att-audio-player">
          <audio
            ref={audioRef}
            src={url}
            onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
            onEnded={() => setPlaying(false)}
          />
          <button className="msg-att-play-pause" onClick={toggle}>
            {playing
              ? <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>
            }
          </button>
          <div className="msg-att-progress-track" onClick={seek}>
            <div
              className="msg-att-progress-fill"
              style={{ width: duration ? `${(current / duration) * 100}%` : '0%' }}
            />
          </div>
          <span className="msg-att-time">{formatDur(current)} / {formatDur(duration)}</span>
        </div>
      )}
    </div>
  )
}

// ── 첨부 렌더러 ──────────────────────────────────────────────
function AttachmentView({ url, type, name }: { url: string; type: AttachType; name: string }) {
  if (type === 'image') return <ImageAttachment url={url} name={name} />
  if (type === 'video') return <VideoAttachment url={url} />
  if (type === 'audio') return <AudioAttachment url={url} name={name} />
  return null
}

// ── 메인 ChatView ─────────────────────────────────────────────
export default function ChatView({ supabase, currentUserId, otherProfile, messages, loading, onSend, onBack }: Props) {
  const [input, setInput]         = useState('')
  const [sendError, setSendError] = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadErrMsg, setUploadErrMsg] = useState('')
  const [dragOver, setDragOver]   = useState(false)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const imgRef  = useRef<HTMLInputElement>(null)
  const vidRef  = useRef<HTMLInputElement>(null)
  const audRef  = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const dragCounter = useRef(0)

  useEffect(() => {
    const el = chatAreaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const MAX_SIZE_MB = 50
  const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024

  const showErr = (msg: string) => {
    setUploadErrMsg(msg)
    setSendError(true)
    setTimeout(() => { setSendError(false); setUploadErrMsg('') }, 3000)
  }

  const uploadFile = async (file: File, type: AttachType): Promise<Attachment | null> => {
    const ext  = file.name.split('.').pop() ?? 'bin'
    const path = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage
      .from('attachments')
      .upload(path, file, { contentType: file.type })
    if (error) {
      console.error('[upload error]', error.message, error)
      return null
    }
    const { data } = supabase.storage.from('attachments').getPublicUrl(path)
    return { url: data.publicUrl, type, name: file.name }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, type: AttachType) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMenuOpen(false)

    if (file.size > MAX_SIZE) {
      showErr(`File too large (max ${MAX_SIZE_MB}MB)`)
      if (e.target) e.target.value = ''
      return
    }

    setUploading(true)
    const att = await uploadFile(file, type)
    setUploading(false)
    if (!att) {
      showErr('Upload failed. Check file size or connection.')
    } else {
      await onSend('', att)
    }
    if (e.target) e.target.value = ''
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const val = input
    setInput('')
    const ok = await onSend(val)
    if (!ok) {
      setSendError(true)
      setTimeout(() => setSendError(false), 2500)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const processDroppedFile = async (file: File) => {
    const mime = file.type
    let type: AttachType
    if (mime.startsWith('image/')) type = 'image'
    else if (mime.startsWith('video/')) type = 'video'
    else if (mime.startsWith('audio/')) type = 'audio'
    else { showErr('Only image, video, or audio files supported.'); return }

    if (file.size > MAX_SIZE) { showErr(`File too large (max ${MAX_SIZE_MB}MB)`); return }

    setUploading(true)
    const att = await uploadFile(file, type)
    setUploading(false)
    if (!att) showErr('Upload failed. Check file size or connection.')
    else await onSend('', att)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragOver(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await processDroppedFile(file)
  }

  // 날짜별 그룹 구분선
  const groups: Array<{ type: 'ts'; label: string } | { type: 'msg'; msg: Message }> = []
  let lastDate = ''
  for (const msg of messages) {
    const dateLabel = formatDate(msg.created_at)
    if (dateLabel !== lastDate) {
      groups.push({ type: 'ts', label: dateLabel })
      lastDate = dateLabel
    }
    groups.push({ type: 'msg', msg })
  }

  return (
    <div
      className="chat-drop-zone"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="drop-overlay">
          <div className="drop-overlay-inner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>Drop to attach</span>
          </div>
        </div>
      )}
      {/* Sub-bar */}
      <div className="csub">
        <div className="back" onClick={onBack}>&#8249;</div>
        <div className="chdr-av" style={{ background: otherProfile.avatar_color }}>
          {otherProfile.avatar_url
            ? <img src={otherProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : otherProfile.initials}
          <div className={`chdr-dot ${otherProfile.isOnline ? 'don' : 'doff'}`} />
        </div>
        <div className="chdr-info">
          <div className="chdr-name" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {otherProfile.display_name}
            {otherProfile.is_verified && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="12" fill="#1D9BF0" />
                <path d="M6.5 12.5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="chdr-sub">{otherProfile.isOnline ? 'online' : 'offline'}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-area" ref={chatAreaRef}>
        {loading && <div className="collab-loading" style={{ flex: 'unset' }}>Loading...</div>}
        {groups.map((g, i) =>
          g.type === 'ts' ? (
            <div key={i} className="ts">{g.label}</div>
          ) : (
            <div key={g.msg.id} className={`mg ${g.msg.sender_id === currentUserId ? 'mine' : 'theirs'}`}>
              {g.msg.attachment_url && g.msg.attachment_type && (
                <AttachmentView
                  url={g.msg.attachment_url}
                  type={g.msg.attachment_type}
                  name={g.msg.attachment_name ?? ''}
                />
              )}
              {g.msg.content && <div className="mb">{g.msg.content}</div>}
              <div className="mtime">{formatTime(g.msg.created_at)}</div>
            </div>
          )
        )}
        {messages.length === 0 && !loading && (
          <div className="collab-loading" style={{ flex: 'unset', marginTop: 40 }}>
            No messages yet
          </div>
        )}
      </div>

      {/* 전송/업로드 실패 토스트 */}
      {sendError && (
        <div className="send-error-toast">
          {uploadErrMsg || 'Failed to send. Please try again.'}
        </div>
      )}

      {/* + 메뉴 팝업 */}
      {menuOpen && (
        <div className="attach-menu" ref={menuRef}>
          <button className="attach-menu-item" onClick={() => { imgRef.current?.click() }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
            Photo
          </button>
          <button className="attach-menu-item" onClick={() => { vidRef.current?.click() }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9l5-3v12l-5-3V9z"/>
            </svg>
            Video
          </button>
          <button className="attach-menu-item" onClick={() => { audRef.current?.click() }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            Audio
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="input-bar">
        {/* 숨겨진 파일 입력들 */}
        <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e, 'image')} />
        <input ref={vidRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleFile(e, 'video')} />
        <input ref={audRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => handleFile(e, 'audio')} />

        {/* + 버튼 */}
        <button
          className={`attach-btn${menuOpen ? ' active' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          disabled={uploading}
          title="Attach file"
        >
          {uploading
            ? <span style={{ fontSize: 10, color: 'var(--t3)' }}>...</span>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="16" height="16">
                <path d="M12 5v14M5 12h14"/>
              </svg>
          }
        </button>

        <div className="mi-wrap">
          <input
            className="mi"
            type="text"
            placeholder={`message ${otherProfile.display_name.split(' ')[0]}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button className="send-btn" onClick={handleSend}>
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
