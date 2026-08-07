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
  source?: 'stemlink' | 'adapter'
}

export interface HostStemCapabilities {
  hostName: string
  adapter: string
  connected: boolean
  trackListing: boolean
  exportMode: 'native' | 'onepass' | 'realtime' | 'none'
  sessionOpen?: boolean
  message?: string
  automaticTrigger?: boolean
  requiresBounceConfirmation?: boolean
  inputPort?: string
  outputPort?: string
}

export interface HostRenderedStemFile {
  path: string
  name: string
  size: number
  mimeType: string
  sampleRate: number
  bitDepth: number
  sourceSamples?: number
  sourcePpq?: number
  bpm?: number
  timeSigNumerator?: number
  timeSigDenominator?: number
  captureMode?: 'offline-one-pass' | 'realtime-selection' | 'native'
}

export interface HostStemExportStatus {
  id?: string
  status: 'queued' | 'rendering' | 'complete' | 'error'
  progress?: number
  message?: string
  files?: HostRenderedStemFile[]
}
