import { useCallback, useEffect, useState } from 'react'
import type { VideoSource, VideoSourceKind } from '../types/live'
import { ensureDawAudioActive, initDawAudio } from '../lib/dawAudio'

/**
 * Manages local MediaStream creation based on user-selected video source.
 * - `daw`    → getDisplayMedia with displaySurface hint 'window'
 * - `screen` → getDisplayMedia with displaySurface hint 'monitor'
 * - `camera` → getUserMedia with the chosen deviceId (webcam / virtual cam)
 * - `none`   → audio-only
 *
 * Audio composition (always):
 *   1. DAW audio track (captured from the JUCE plugin, if running in-plugin)
 *   2. Mic track (if `micDeviceId` is provided — null = skip)
 */
export function useMediaSource() {
  const [cameras,     setCameras]     = useState<MediaDeviceInfo[]>([])
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([])
  const [stream, setStream]           = useState<MediaStream | null>(null)
  const [error,  setError]            = useState<string | null>(null)

  // Start receiving DAW audio events as soon as the hook mounts so the
  // worklet is warm when the user clicks Go Live.
  useEffect(() => { initDawAudio() }, [])

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setCameras    (devices.filter(d => d.kind === 'videoinput'))
      setMicrophones(devices.filter(d => d.kind === 'audioinput'))
    } catch (e) {
      console.warn('enumerateDevices failed', e)
    }
  }, [])

  useEffect(() => {
    refreshDevices()
    const handler = () => refreshDevices()
    navigator.mediaDevices?.addEventListener('devicechange', handler)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', handler)
  }, [refreshDevices])

  const startStream = useCallback(async (source: VideoSource, micDeviceId: string | null) => {
    setError(null)
    try {
      // Get video (and optional display audio) first.
      let newStream: MediaStream
      if (source.kind === 'daw' || source.kind === 'screen') {
        const displaySurface = source.kind === 'daw' ? 'window' : 'monitor'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const constraints: any = {
          video: { displaySurface },
          audio: false,
        }
        newStream = await navigator.mediaDevices.getDisplayMedia(constraints)
      } else if (source.kind === 'camera') {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: source.deviceId ? { deviceId: { exact: source.deviceId } } : true,
          audio: false,
        })
      } else {
        // audio-only
        newStream = new MediaStream()
      }

      // Add DAW audio — ensureDawAudioActive() initialises the pipeline if
      // needed (requires a user-gesture context, which startStream always is).
      const dawTrack = await ensureDawAudioActive()
      console.log('[useMediaSource] dawTrack', dawTrack && {
        id: dawTrack.id, enabled: dawTrack.enabled, muted: dawTrack.muted, readyState: dawTrack.readyState,
      })
      if (dawTrack) newStream.addTrack(dawTrack)
      console.log('[useMediaSource] final stream tracks', newStream.getTracks().map(t => ({ kind: t.kind, label: t.label, enabled: t.enabled, muted: t.muted })))

      // Add mic if user picked one
      if (micDeviceId) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: micDeviceId } },
            video: false,
          })
          mic.getAudioTracks().forEach(t => newStream.addTrack(t))
        } catch (e) {
          console.warn('mic getUserMedia failed', e)
          setError('Microphone unavailable — streaming without mic')
        }
      }

      // Refresh device labels now that permission is granted
      refreshDevices()
      setStream(prev => { prev?.getTracks().forEach(t => t.stop()); return newStream })
      return newStream
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      return null
    }
  }, [refreshDevices])

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

  const listMicrophones = useCallback(
    () => microphones.map((m, i) => ({
      deviceId: m.deviceId,
      label: m.label || `Microphone ${i + 1}`,
    })),
    [microphones],
  )

  const screenCaptureSupported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && 'getDisplayMedia' in navigator.mediaDevices

  return {
    stream,
    error,
    startStream,
    stopStream,
    listSources,
    listMicrophones,
    screenCaptureSupported,
  }
}

export type { VideoSource, VideoSourceKind }
