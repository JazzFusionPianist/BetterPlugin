import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useProfiles } from '../hooks/useProfiles'
import { useMessages } from '../hooks/useMessages'
import FriendsList from '../components/collab/FriendsList'
import ChatView from '../components/collab/ChatView'
import './collab.css'

interface Props {
  user: User
}

export default function CollabPage({ user }: Props) {
  if (!supabase) {
    return <div style={{ padding: 20, fontSize: 12, fontFamily: 'sans-serif', color: '#999' }}>Supabase not configured.</div>
  }

  return <CollabPageInner user={user} />
}

function CollabPageInner({ user }: Props) {
  const client = supabase!
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const favKey = `collab_favorites_${user.id}`
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(favKey)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })

  const { profiles, loading: profilesLoading } = useProfiles(client, user.id)
  const { messages, loading: messagesLoading, send } = useMessages(client, user.id, selectedId)

  const selectedProfile = profiles.find(p => p.id === selectedId) ?? null

  const handleToggleFav = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem(favKey, JSON.stringify([...next]))
      return next
    })
  }

  return (
    <div className={`plugin${selectedId ? ' chat-open' : ''}`}>
      {/* Top bar */}
      <div className="top-bar">
        <span className="app-title">COLLAB</span>
        <div className="icon-btn">
          <svg viewBox="0 0 16 16" strokeWidth="1.5">
            <circle cx="8" cy="8" r="5.5" /><path d="M8 5.5v3l2 1.5" />
          </svg>
        </div>
        <div className="icon-btn">
          <svg viewBox="0 0 16 16" strokeWidth="1.5">
            <circle cx="6" cy="5" r="2" /><circle cx="10" cy="11" r="2" />
            <path d="M8 5h4M4 11H2M8 11h-2M12 5h2" />
          </svg>
        </div>
      </div>

      {/* Sliding content */}
      <div className="content">
        {/* Friends list view */}
        <div className="view fview">
          <FriendsList
            profiles={profiles}
            favorites={favorites}
            loading={profilesLoading}
            onSelect={setSelectedId}
            onToggleFav={handleToggleFav}
          />
        </div>

        {/* Chat view */}
        <div className="view cview">
          {selectedProfile && (
            <ChatView
              currentUserId={user.id}
              otherProfile={selectedProfile}
              messages={messages}
              loading={messagesLoading}
              onSend={send}
              onBack={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
