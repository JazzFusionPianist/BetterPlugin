import { useEffect, useState, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AdminProfile {
  id: string
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

function VerifiedIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="#1D9BF0" />
      <path d="M6.5 12.5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AdminPageInner({ client, currentUser }: { client: SupabaseClient; currentUser: User }) {
  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchProfiles = useCallback(async () => {
    const { data } = await client
      .from('profiles')
      .select('id, display_name, avatar_color, is_verified, is_admin, updated_at')
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
        {/* Search */}
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

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #eee', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#bbb', fontSize: 13 }}>No members found</div>
          ) : (
            filtered.map((profile, i) => (
              <div
                key={profile.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px',
                  borderBottom: i < filtered.length - 1 ? '1px solid #f5f5f5' : 'none',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: profile.avatar_color || colorForId(profile.id),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: '#fff',
                }}>
                  {(profile.display_name || '?').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                </div>

                {/* Name + badges */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
                      {profile.display_name || '(no name)'}
                    </span>
                    {profile.is_verified && <VerifiedIcon />}
                    {profile.is_admin && (
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#7C3AED', background: '#EDE9FE', padding: '1px 5px', borderRadius: 4 }}>
                        ADMIN
                      </span>
                    )}
                    {profile.id === currentUser.id && (
                      <span style={{ fontSize: 9, fontWeight: 500, color: '#999', background: '#f0f0f0', padding: '1px 5px', borderRadius: 4 }}>
                        나
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#bbb', marginTop: 1 }}>
                    {new Date(profile.updated_at).toLocaleDateString('ko-KR')} 업데이트
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {/* Verified toggle */}
                  <button
                    onClick={() => toggleVerified(profile)}
                    title={profile.is_verified ? '인증 해제' : '인증 부여'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 8px', border: '1px solid',
                      borderColor: profile.is_verified ? '#1D9BF0' : '#ddd',
                      background: profile.is_verified ? '#E8F5FD' : '#fff',
                      borderRadius: 6, cursor: 'pointer', fontSize: 11,
                      color: profile.is_verified ? '#1D9BF0' : '#888',
                      fontWeight: 500, transition: 'all .15s',
                    }}
                  >
                    <VerifiedIcon />
                    {profile.is_verified ? '인증됨' : '인증'}
                  </button>

                  {/* Delete button — disabled for self */}
                  {profile.id !== currentUser.id && (
                    <button
                      onClick={() => deleteUser(profile)}
                      disabled={deletingId === profile.id}
                      title="회원 탈퇴"
                      style={{
                        padding: '4px 8px', border: '1px solid #fecaca',
                        background: '#fff5f5', borderRadius: 6, cursor: 'pointer',
                        fontSize: 11, color: '#ef4444', fontWeight: 500,
                        opacity: deletingId === profile.id ? 0.5 : 1,
                        transition: 'all .15s',
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
