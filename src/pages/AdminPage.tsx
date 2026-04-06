import { useEffect, useState, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AdminProfile {
  id: string
  display_name: string
  avatar_color: string
  avatar_url?: string | null
  is_verified: boolean
  is_admin: boolean
  updated_at: string
}

interface UserDetails {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  display_name: string
  avatar_color: string
  is_verified: boolean
  is_admin: boolean
  updated_at: string
}

const AVATAR_COLORS = [
  '#E05555', '#4A8FE7', '#2D8B70', '#9C59B6', '#E67E22',
  '#1ABC9C', '#E91E8C', '#3F51B5', '#FF5722', '#78909C',
]
function colorForId(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!
}

function initials(name: string) {
  return (name || '?').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function VerifiedIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="#1D9BF0" />
      <path d="M6.5 12.5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Detail Panel ── */
function DetailPanel({
  client,
  profileId,
  currentUserId,
  profiles,
  onClose,
  onToggleVerified,
  onDelete,
  deletingId,
}: {
  client: SupabaseClient
  profileId: string
  currentUserId: string
  profiles: AdminProfile[]
  onClose: () => void
  onToggleVerified: (p: AdminProfile) => void
  onDelete: (p: AdminProfile) => void
  deletingId: string | null
}) {
  const [details, setDetails] = useState<UserDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(true)
  const [photoZoom, setPhotoZoom] = useState(false)

  useEffect(() => {
    setLoadingDetails(true)
    client.rpc('admin_get_user_details', { target_user_id: profileId })
      .then(({ data }) => {
        setDetails(data as UserDetails)
        setLoadingDetails(false)
      })
  }, [client, profileId])

  const profile = profiles.find(p => p.id === profileId)
  if (!profile) return null

  const avatarBg = profile.avatar_color || colorForId(profile.id)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', zIndex: 40,
          animation: 'fadeIn .15s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 320, background: '#fff', zIndex: 50,
        boxShadow: '-4px 0 24px rgba(0,0,0,.1)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn .2s ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        {/* Panel header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa', padding: 0, lineHeight: 1, marginTop: -1 }}
          >
            ×
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>회원 정보</span>
        </div>

        {/* Avatar + name */}
        <div style={{ padding: '24px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderBottom: '1px solid #f5f5f5' }}>
          <div
            onClick={() => profile.avatar_url && setPhotoZoom(true)}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: avatarBg, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: '#fff',
              cursor: profile.avatar_url ? 'zoom-in' : 'default',
            }}
          >
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials(profile.display_name)}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{profile.display_name || '(no name)'}</span>
              {profile.is_verified && <VerifiedIcon size={15} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4 }}>
              {profile.is_admin && (
                <span style={{ fontSize: 9, fontWeight: 600, color: '#7C3AED', background: '#EDE9FE', padding: '2px 6px', borderRadius: 4 }}>ADMIN</span>
              )}
              {profile.id === currentUserId && (
                <span style={{ fontSize: 9, fontWeight: 500, color: '#999', background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>나</span>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loadingDetails ? (
            <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', marginTop: 32 }}>Loading...</div>
          ) : details ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: '이메일', value: details.email },
                { label: '가입일', value: fmt(details.created_at) },
                { label: '마지막 로그인', value: fmt(details.last_sign_in_at) },
                { label: '프로필 업데이트', value: fmt(details.updated_at) },
                { label: '인증 상태', value: details.is_verified ? '인증됨 ✓' : '미인증' },
                { label: '관리자', value: details.is_admin ? '예' : '아니오' },
                { label: 'ID', value: details.id, mono: true },
              ].map(row => (
                <div key={row.label} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ fontSize: 10, color: '#aaa', fontWeight: 500, marginBottom: 2 }}>{row.label}</div>
                  <div style={{ fontSize: 12, color: '#333', fontFamily: row.mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', marginTop: 32 }}>불러오기 실패</div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => onToggleVerified(profile)}
            style={{
              padding: '8px 0', border: '1px solid',
              borderColor: profile.is_verified ? '#1D9BF0' : '#ddd',
              background: profile.is_verified ? '#E8F5FD' : '#fff',
              borderRadius: 8, cursor: 'pointer', fontSize: 12,
              color: profile.is_verified ? '#1D9BF0' : '#555',
              fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <VerifiedIcon />
            {profile.is_verified ? '인증 해제' : '인증 부여'}
          </button>

          {profile.id !== currentUserId && (
            <button
              onClick={() => onDelete(profile)}
              disabled={deletingId === profile.id}
              style={{
                padding: '8px 0', border: '1px solid #fecaca',
                background: '#fff5f5', borderRadius: 8, cursor: 'pointer',
                fontSize: 12, color: '#ef4444', fontWeight: 500,
                opacity: deletingId === profile.id ? 0.5 : 1,
              }}
            >
              {deletingId === profile.id ? '삭제 중...' : '회원 탈퇴'}
            </button>
          )}
        </div>
      </div>

      {/* Photo zoom modal */}
      {photoZoom && profile.avatar_url && (
        <div
          onClick={() => setPhotoZoom(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', animation: 'fadeIn .15s ease',
          }}
        >
          <img
            src={profile.avatar_url}
            alt=""
            style={{ maxWidth: '80vw', maxHeight: '80vh', borderRadius: 12, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,.5)' }}
          />
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  )
}

/* ── Main ── */
function AdminPageInner({ client, currentUser }: { client: SupabaseClient; currentUser: User }) {
  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchProfiles = useCallback(async () => {
    const { data } = await client
      .from('profiles')
      .select('id, display_name, avatar_color, avatar_url, is_verified, is_admin, updated_at')
      .order('updated_at', { ascending: false })
    if (data) setProfiles(data as AdminProfile[])
    setLoading(false)
  }, [client])

  useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await client
        .from('profiles')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single()
      setIsAdmin(data?.is_admin ?? false)
    }
    checkAdmin()
    fetchProfiles()
  }, [client, currentUser.id, fetchProfiles])

  const toggleVerified = async (profile: AdminProfile) => {
    await client
      .from('profiles')
      .update({ is_verified: !profile.is_verified })
      .eq('id', profile.id)
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_verified: !p.is_verified } : p))
  }

  const deleteUser = async (profile: AdminProfile) => {
    if (!confirm(`"${profile.display_name}" 회원을 탈퇴시키겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return
    setDeletingId(profile.id)
    const { error } = await client.rpc('admin_delete_user', { target_user_id: profile.id })
    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      setProfiles(prev => prev.filter(p => p.id !== profile.id))
      if (selectedId === profile.id) setSelectedId(null)
    }
    setDeletingId(null)
  }

  const filtered = profiles.filter(p =>
    p.display_name?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999', fontFamily: 'sans-serif' }}>
        Loading...
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999', fontFamily: 'sans-serif', flexDirection: 'column', gap: 8 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        <span style={{ fontSize: 14 }}>관리자 권한이 없습니다</span>
        <span style={{ fontSize: 12, color: '#bbb' }}>Supabase에서 is_admin을 true로 설정하세요</span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 15, letterSpacing: 1 }}>CoOp</span>
        <span style={{ color: '#999', fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Admin</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#aaa' }}>{profiles.length} members</span>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        <input
          type="text"
          placeholder="Search members..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 14px', marginBottom: 16,
            border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13,
            outline: 'none', background: '#fff', boxSizing: 'border-box',
          }}
        />

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #eee', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#bbb', fontSize: 13 }}>No members found</div>
          ) : (
            filtered.map((profile, i) => (
              <div
                key={profile.id}
                onClick={() => setSelectedId(profile.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px',
                  borderBottom: i < filtered.length - 1 ? '1px solid #f5f5f5' : 'none',
                  cursor: 'pointer',
                  background: selectedId === profile.id ? '#f8f9ff' : '#fff',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (selectedId !== profile.id) (e.currentTarget as HTMLDivElement).style.background = '#fafafa' }}
                onMouseLeave={e => { if (selectedId !== profile.id) (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
              >
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: profile.avatar_color || colorForId(profile.id),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: '#fff', overflow: 'hidden',
                }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials(profile.display_name)}
                </div>

                {/* Name + badges */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
                      {profile.display_name || '(no name)'}
                    </span>
                    {profile.is_verified && <VerifiedIcon />}
                    {profile.is_admin && (
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#7C3AED', background: '#EDE9FE', padding: '1px 5px', borderRadius: 4 }}>ADMIN</span>
                    )}
                    {profile.id === currentUser.id && (
                      <span style={{ fontSize: 9, fontWeight: 500, color: '#999', background: '#f0f0f0', padding: '1px 5px', borderRadius: 4 }}>나</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#bbb', marginTop: 1 }}>
                    {new Date(profile.updated_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>

                {/* Actions — stop propagation so row click doesn't fire */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => toggleVerified(profile)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 8px', border: '1px solid',
                      borderColor: profile.is_verified ? '#1D9BF0' : '#ddd',
                      background: profile.is_verified ? '#E8F5FD' : '#fff',
                      borderRadius: 6, cursor: 'pointer', fontSize: 11,
                      color: profile.is_verified ? '#1D9BF0' : '#888', fontWeight: 500,
                    }}
                  >
                    <VerifiedIcon />
                    {profile.is_verified ? '인증됨' : '인증'}
                  </button>

                  {profile.id !== currentUser.id && (
                    <button
                      onClick={() => deleteUser(profile)}
                      disabled={deletingId === profile.id}
                      style={{
                        padding: '4px 8px', border: '1px solid #fecaca',
                        background: '#fff5f5', borderRadius: 6, cursor: 'pointer',
                        fontSize: 11, color: '#ef4444', fontWeight: 500,
                        opacity: deletingId === profile.id ? 0.5 : 1,
                      }}
                    >
                      {deletingId === profile.id ? '삭제중...' : '탈퇴'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedId && (
        <DetailPanel
          client={client}
          profileId={selectedId}
          currentUserId={currentUser.id}
          profiles={profiles}
          onClose={() => setSelectedId(null)}
          onToggleVerified={toggleVerified}
          onDelete={deleteUser}
          deletingId={deletingId}
        />
      )}
    </div>
  )
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  if (loading) return null

  if (!supabase) {
    return <div style={{ padding: 20, fontSize: 12, color: '#999' }}>Supabase not configured.</div>
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 14, color: '#555' }}>로그인이 필요합니다</p>
        <a href="/" style={{ fontSize: 12, color: '#1D9BF0' }}>로그인 페이지로</a>
      </div>
    )
  }

  return <AdminPageInner client={supabase} currentUser={user} />
}
