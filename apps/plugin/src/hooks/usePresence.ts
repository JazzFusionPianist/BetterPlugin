import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function usePresence(supabase: SupabaseClient, currentUserId: string) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const channel = supabase.channel('online-users')

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ user_id: string }>()
        const ids = new Set(
          Object.values(state)
            .flat()
            .map(p => p.user_id)
        )
        setOnlineIds(ids)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: currentUserId })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, currentUserId])

  return onlineIds
}
