export interface Profile {
  id: string
  display_name: string
  avatar_color: string
  avatar_url?: string | null
  initials: string
  isOnline: boolean
  is_verified: boolean
  is_admin: boolean
}

export type AttachType = 'image' | 'video' | 'audio' | 'multi-audio'

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  attachment_url?: string | null
  attachment_type?: AttachType | null
  attachment_name?: string | null
  attachment_expires_at?: string | null   // ISO timestamp, 7 days after upload
  attachment_expired?: boolean            // true once storage object is deleted
}

export interface AppNotification {
  id: string
  type: 'follow' | 'game_invite'
  read: boolean
  created_at: string
  actor: {
    id: string
    display_name: string
    avatar_color: string
    avatar_url?: string | null
  }
  metadata?: { room_id?: string; game_type?: string } | null
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export interface GameRoom {
  id: string
  game_type: 'chess'
  host_id: string
  guest_id: string | null
  status: 'lobby' | 'playing' | 'finished'
  board: (string | null)[][] | null   // ChessBoard serialized
  turn: 'white' | 'black'
  host_color: 'white' | 'black'
  winner_id: string | null
  draw_offered_by: string | null
  captured: { white: string[]; black: string[] }
  move_history: string[]   // algebraic notation
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }
  en_passant: [number, number] | null
  halfmove: number
  created_at: string
  updated_at: string
}
