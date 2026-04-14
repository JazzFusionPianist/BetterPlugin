import { useCallback, useEffect, useState } from 'react'
import type { VideoSource, VideoSourceKind } from '../types/live'

/**
 * Manages local MediaStream creation based on user-selected video source.
 * - `daw`   → getDisplayMedia with displaySurface hint 'window'
 * - `screen`→ getDisplayMedia with displaySurface hint 'monitor'
 * - `camera`→ getUserMedia with the chosen deviceId (webcam / virtual cam)
 * - `none`  → audio-only
 *
 * Audio is always the user's currently selected microphone (which can be
 * set to BlackHole / Loopback to capture DAW output).
 */
export function useMediaSource() {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [stream, setStream]   = useState<MediaStream | null>(null)
  const [error, setError]     = useState<string | null>(null)

  // Enumerate camera devices. We do this after getting initial permission
  // so device labels are available (browsers hide labels until permission is
  // granted at least once).
  const refreshCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setCameras(devices.filter(d => d.kind === 'videoinput'))
    } catch (e) {
      console.warn('enumerateDevices failed', e)
    }
  }, [])

  useEffect(() => {
    refreshCameras()
    const handler = () => refreshCameras()
    navigator.mediaDevices?.addEventListener('devicechange', handler)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', handler)
  }, [refreshCameras])

  const startStream = useCallback(async (source: VideoSource, withAudio: boolean) => {
    setError(null)
    try {
      let newStream: MediaStream
      if (source.kind === 'daw' || source.kind === 'screen') {
        const displaySurface = source.kind === 'daw' ? 'window' : 'monitor'
        // Note: displaySurface is a hint — user still picks the exact source
        // from the system picker.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const constraints: any = {
          video: { displaySurface },
          audio: false, // display audio is flaky cross-browser; we add mic separately
        }
        newStream = await navigator.mediaDevices.getDisplayMedia(constraints)
        if (withAudio) {
          // Add mic track so viewers can hear. Combine into a single stream.
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
          mic.getAudioTracks().forEach(t => newStream.addTrack(t))
        }
      } else if (source.kind === 'camera') {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: source.deviceId ? { deviceId: { exact: source.deviceId } } : true,
          audio: withAudio,
        })
      } else {
        // audio-only
        newStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      }

      // Refresh device labels now that permission is granted
      refreshCameras()
      setStream(prev => { prev?.getTracks().forEach(t => t.stop()); return newStream })
      return newStream
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      return null
    }
  }, [refreshCameras])

  const stopStream = useCallback(() => {
    setStream(prev => { prev?.getTracks().forEach(t => t.stop()); return null })
  }, [])

  useEffect(() => () => { stream?.getTracks().forEach(t => t.stop()) }, [stream])

  const listSources = useCallback((): VideoSource[] => {
    const sources: VideoSource[] = [
      { kind: 'daw',    label: 'DAW Window' },
      { kind: 'screen', label: 'Entire Screen' },
    ]
    cameras.forEach((c, i) => {
      sources.push({
        kind: 'camera',
        deviceId: c.deviceId,
        label: c.label || `Camera ${i + 1}`,
      })
    })
    return sources
  }, [cameras])

  // Does the browser support screen capture?
  const screenCaptureSupported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && 'getDisplayMedia' in navigator.mediaDevices

  return {
    stream,
    error,
    startStream,
    stopStream,
    listSources,
    screenCaptureSupported,
  }
}

export type { VideoSource, VideoSourceKind }
