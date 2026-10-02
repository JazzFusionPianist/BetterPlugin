import type { AttachmentTimelineMetadata } from './collab'
import type { RegionBundle } from '../lib/regionBundle'

export interface ConversationStem {
  id: string
  conversation_id: string
  uploader_id: string
  file_url: string
  file_name: string
  file_size: number
  mime_type?: string | null
  timeline_metadata?: (Partial<AttachmentTimelineMetadata> & {
    bundle_id?: string
    bundle_asset_id?: string
    region_bundle?: RegionBundle
  }) | null
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
