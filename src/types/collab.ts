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

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}
