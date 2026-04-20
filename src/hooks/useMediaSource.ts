import { useCallback, useEffect, useRef, useState } from 'react'
import type { VideoSource, VideoSourceKind } from '../types/live'
import { ensureDawAudioActive, initDawAudio } from '../lib/dawAudio'
import { startNativeVideo, stopNativeVideo, initNativeVideo } from '../lib/nativeVideo'
import { hasJuceBridge } from '../lib/juceBridge'

/**
 * True when the app is running inside the JUCE plugin's WebView.
 * We use the JUCE backend bridge as the signal — more reliable than a URL
 * parameter and available as soon as index.html loads.
 */
export const isInJucePlugin = hasJuceBridge

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
 *
 * The DAW audio track is owned by lib/dawAudio and must never be .stop()'d
 * here — stopping it kills the worklet output permanently. Video/mic tracks
 * are ephemeral and are stopped on replace/teardown.
 */
export function useMediaSource() {
  const [cameras,     setCameras]     = useState<MediaDeviceInfo[]>([])
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([])
  const [stream, setStream]           = useState<MediaStream | null>(null)
  const [error,  setError]            = useState<string | null>(null)
  const [permissionsGranted, setPermissionsGranted] = useState(false)
  // Remember the DAW track so we can preserve it across source switches.
  const dawTrackRef = useRef<MediaStreamTrack | null>(null)

  useEffect(() => {
    initDawAudio()
    initNativeVideo()
  }, [])

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setCameras    (devices.filter(d => d.kind === 'videoinput'  && d.deviceId))
      setMicrophones(devices.filter(d => d.kind === 'audioinput'  && d.deviceId))
    } catch (e) {
      console.warn('enumerateDevices failed', e)
    }
  }, [])

  /**
   * Ask for mic + camera permission in a regular browser so enumerateDevices
   * returns real deviceIds + labels. Inside the JUCE plugin we skip this
   * entirely: any getUserMedia() call made from inside an Audio Unit's
   * WKWebView triggers a TCC prompt that destabilises the host ("plug-in
   * reported a problem") and forces Logic to ask for a restart. DAW audio
   * + getDisplayMedia (screen/window) remain available.
   */
  const requestDevicePermissions = useCallback(async () => {
    if (permissionsGranted) return
    if (hasJuceBridge) return      // never touch TCC inside the plugin
    const tryGrant = async (constraints: MediaStreamConstraints) => {
      try {
        const s = await navigator.mediaDevices.getUserMedia(constraints)
        s.getTracks().forEach(t => t.stop())
        return true
      } catch { return false }
    }
    const gotAudio = await tryGrant({ audio: true })
    const gotVideo = await tryGrant({ video: true })
    if (gotAudio || gotVideo) setPermissionsGranted(true)
    await refreshDevices()
  }, [permissionsGranted, refreshDevices])

  useEffect(() => {
    refreshDevices()
    const handler = () => refreshDevices()
    navigator.mediaDevices?.addEventListener('devicechange', handler)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', handler)
  }, [refreshDevices])

  /** Stop only ephemeral tracks (video + mic); never the DAW track. */
  const stopEphemeral = (s: MediaStream | null) => {
    if (!s) return
    s.getTracks().forEach(t => {
      if (t !== dawTrackRef.current) t.stop()
    })
  }

  /**
   * Acquire a new video + mic pair. Builds a fresh MediaStream containing
   * the NEW video track, the existing DAW audio track, and the NEW mic track
   * (if micDeviceId set). Used for both initial start and in-stream switching
   * — the broadcaster hook watches stream changes and calls replaceTrack on
   * existing peer senders instead of renegotiating.
   */
  const acquireStream = useCallback(async (source: VideoSource, micDeviceId: string | null) => {
    // If the previous source used native plugin capture and the new one does
    // NOT, tell the plugin to stop producing frames (the canvas/captureStream
    // track itself is kept alive module-side — just the producer pauses).
    const usingNative = hasJuceBridge && (source.kind === 'daw' || source.kind === 'screen')
    if (!usingNative) await stopNativeVideo()

    // Build video
    let newStream: MediaStream
    if (source.kind === 'daw' || source.kind === 'screen') {
      // Try plugin native capture first (no picker). If the plugin doesn't
      // support it (older build, or macOS where SCK isn't integrated yet),
      // the native call returns null and we fall back to getDisplayMedia.
      let nativeTrack: MediaStreamTrack | null = null
      if (hasJuceBridge) {
        const nativeKind = source.kind === 'daw' ? 'window' : 'screen'
        nativeTrack = await startNativeVideo(nativeKind)
      }
      if (nativeTrack) {
        newStream = new MediaStream()
        newStream.addTrack(nativeTrack)
      } else {
        const displaySurface = source.kind === 'daw' ? 'window' : 'monitor'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const constraints: any = { video: { displaySurface }, audio: false }
        newStream = await navigator.mediaDevices.getDisplayMedia(constraints)
      }
    } else if (source.kind === 'camera') {
      if (hasJuceBridge) {
        // Hard block — see requestDevicePermissions() comment.
        throw new Error('Camera capture is disabled inside the plugin. Open the community web app in a browser to stream a camera.')
      }
      newStream = await navigator.mediaDevices.getUserMedia({
        video: source.deviceId ? { deviceId: { exact: source.deviceId } } : true,
        audio: false,
      })
    } else {
      newStream = new MediaStream()
    }

    const dawTrack = await ensureDawAudioActive()
    dawTrackRef.current = dawTrack
    if (dawTrack) newStream.addTrack(dawTrack)

    if (micDeviceId && !hasJuceBridge) {
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

    return newStream
  }, [])

  const startStream = useCallback(async (source: VideoSource, micDeviceId: string | null) => {
    setError(null)
    try {
      const newStream = await acquireStream(source, micDeviceId)
      refreshDevices()
      setStream(prev => { stopEphemeral(prev); return newStream })
      return newStream
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    }
  }, [acquireStream, refreshDevices])

  /**
   * Swap sources while live. Acquires a new stream with the new video/mic
   * pair, then replaces the state. The broadcaster hook reacts to this by
   * calling replaceTrack on each peer, avoiding a full renegotiation.
   */
  const replaceSource = useCallback(async (source: VideoSource, micDeviceId: string | null) => {
    setError(null)
    try {
      const newStream = await acquireStream(source, micDeviceId)
      setStream(prev => { stopEphemeral(prev); return newStream })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [acquireStream])

  const stopStream = useCallback(() => {
    stopNativeVideo()
    setStream(prev => { stopEphemeral(prev); return null })
  }, [])

  useEffect(() => () => { stopEphemeral(stream) }, [stream])

  const listSources = useCallback((): VideoSource[] => {
    const sources: VideoSource[] = [
      { kind: 'daw',    label: 'DAW Window' },
      { kind: 'screen', label: 'Entire Screen' },
    ]
    // Cameras require getUserMedia → TCC prompt → Logic destabilises.
    // Keep them out of the picker inside the plugin.
    if (!hasJuceBridge) {
      cameras.forEach((c, i) => {
        sources.push({
          kind: 'camera',
          deviceId: c.deviceId,
          label: c.label || `Camera ${i + 1}`,
        })
      })
    }
    return sources
  }, [cameras])

  const listMicrophones = useCallback(
    // Same reasoning as listSources: mic acquisition inside the plugin goes
    // through getUserMedia which triggers a TCC prompt that crashes Logic.
    () => hasJuceBridge ? [] : microphones.map((m, i) => ({
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
    replaceSource,
    listSources,
    listMicrophones,
    screenCaptureSupported,
    requestDevicePermissions,
    permissionsGranted,
  }
}

export type { VideoSource, VideoSourceKind }
