import { useEffect, useState, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { type Profile, getInitials } from '../types/collab'

const AVATAR_COLORS = [
  '#E05555', '#4A8FE7', '#2D8B70', '#9C59B6', '#E67E22',
  '#1ABC9C', '#E91E8C', '#3F51B5', '#FF5722', '#78909C',
]

function colorForId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!
}

interface RawProfile {
  id: string
  display_name: string
  avatar_color: string
  avatar_url?: string | null
  is_verified?: boolean | null
  is_admin?: boolean | null
}

export function useProfiles(supabase: SupabaseClient, currentUserId: string) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [me, setMe] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const avatarOverrideRef = useRef<string | null>(null)

  const fetch = useCallback(async () => {
    let { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_color, avatar_url, is_verified, is_admin')

    // Fall back to basic columns if newer columns don't exist yet
    if (error) {
      const res = await supabase
        .from('profiles')
        .select('id, display_name, avatar_color')
      data = res.data as typeof data
    }

    if (!data) {
      setLoading(false)
      return
    }

    const all = (data as RawProfile[]).map(p => ({
      id: p.id,
      display_name: p.display_name || 'Unknown',
      avatar_color: p.avatar_color || colorForId(p.id),
      avatar_url: p.avatar_url ?? null,
      initials: getInitials(p.display_name || 'Unknown'),
      isOnline: false,
      is_verified: p.is_verified ?? false,
      is_admin: p.is_admin ?? false,
    }))

    setProfiles(all.filter(p => p.id !== currentUserId))
    const myProfile = all.find(p => p.id === currentUserId) ?? null
    if (myProfile && avatarOverrideRef.current) {
      // If DB has caught up, clear the override; otherwise keep it
      if (myProfile.avatar_url === avatarOverrideRef.current) {
        avatarOverrideRef.current = null
      } else {
        myProfile.avatar_url = avatarOverrideRef.current
      }
    }
    setMe(myProfile)
    setLoading(false)
  }, [supabase, currentUserId])

  useEffect(() => {
    fetch()
    const timer = setInterval(fetch, 60_000)
    return () => clearInterval(timer)
  }, [fetch])

  const updateMyAvatar = useCallback((url: string) => {
    avatarOverrideRef.current = url
    setMe(prev => prev ? { ...prev, avatar_url: url } : prev)
  }, [])

  const updateMe = useCallback((updates: Partial<Profile>) => {
    setMe(prev => prev ? { ...prev, ...updates } : prev)
  }, [])

  return { profiles, me, loading, refetch: fetch, updateMyAvatar, updateMe }
}
