import type { Metadata, Viewport } from 'next'
import StudioPage from '@/components/slur/StudioPage'

export const metadata: Metadata = {
  title: 'Slur Studio',
  description: 'Slur Studio, the daw: tidy, rubato, the doctor, the rough mix and patch on slur on every track. For mac.',
}
export const viewport: Viewport = { themeColor: '#0E0E0E' }

export default function StudioRoute () {
  return <StudioPage />
}
