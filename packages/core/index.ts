// Shared, platform-agnostic core — chat / social data layer used by both
// the plugin (Vite) and the web app (Next). Every hook takes a Supabase
// client as a parameter, so there's no bundler-specific code here.
//
// NOTE: temporarily duplicated from apps/plugin/src while the web app is
// stood up. The plugin will migrate its imports here next, after which
// the apps/plugin copies are deleted.

// Domain types (the DB-row `Conversation` from collab is intentionally
// NOT re-exported — it clashes with the UI `Conversation` from
// useConversations, which is the one consumers actually use).
export type { Profile, Message, AttachType, ChatTarget, ConversationKind } from './types/collab'
export { getInitials } from './types/collab'

// Conversation helpers (DM resolve, group create/rename/membership).
export * from './lib/conversations'

// Hooks.
export * from './hooks/useProfiles'
export * from './hooks/useFollows'
export * from './hooks/usePresence'
export * from './hooks/useConversations'
export * from './hooks/useConversationNotifications'
export * from './hooks/useConversationReads'
export * from './hooks/useFriends'
export * from './hooks/useMessages'
