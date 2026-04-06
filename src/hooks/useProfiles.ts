import { useEffect, useState, useCallback } from 'react'
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
}

export function useProfiles(supabase: SupabaseClient, currentUserId: string) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_color')

    if (!data) return

    const list = (data as RawProfile[])
      .filter(p => p.id !== currentUserId)
      .map(p => ({
        id: p.id,
        display_name: p.display_name || 'Unknown',
        avatar_color: p.avatar_color || colorForId(p.id),
        initials: getInitials(p.display_name || 'U'),
        isOnline: false,
      }))

    setProfiles(list)
    setLoading(false)
  }, [supabase, currentUserId])

  useEffect(() => {
    fetch()
    const timer = setInterval(fetch, 60_000)
    return () => clearInterval(timer)
  }, [fetch])

  return { profiles, loading }
}
