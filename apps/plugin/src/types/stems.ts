import type { AttachmentTimelineMetadata } from './collab'

export interface ConversationStem {
  id: string
  conversation_id: string
  uploader_id: string
  file_url: string
  file_name: string
  file_size: number
  mime_type?: string | null
  timeline_metadata?: AttachmentTimelineMetadata | null
  created_at: string
}

export interface NativeStemFile {
  name: string
  data: string
}

export interface StemDropRequest {
  id: string
  files?: File[]
  nativeFiles?: NativeStemFile[]
  fallbackMetadata?: AttachmentTimelineMetadata | null
}

export interface HostStemTrack {
  id: string
  index: number
  name: string
  selected: boolean
  color?: string
}

export interface HostStemCapabilities {
  hostName: string
  adapter: string
  connected: boolean
  trackListing: boolean
  exportMode: 'native' | 'realtime' | 'none'
  inputPort?: string
  outputPort?: string
}
