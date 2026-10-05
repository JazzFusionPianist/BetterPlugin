import { useEffect, useRef, useState } from 'react'
import { Turnstile } from '@orb/core/components/Turnstile.tsx'

const CHECK_URL = 'https://better-plugin.vercel.app/security-check.html'

/** Opaque juce:// origins cannot host Turnstile. Only the challenge lives online. */
export default function PluginSecurityCheck({ onToken, onError, resetKey }: {
  onToken: (token: string) => void; onError: () => void; resetKey: number
}) {
  if (location.protocol === 'http:' || location.protocol === 'https:')
    return <Turnstile onToken={onToken} onError={onError} resetKey={resetKey} />
  return <HostedCheck key={resetKey} onToken={onToken} onError={onError} />
}

function HostedCheck({ onToken, onError }: { onToken: (token: string) => void; onError: () => void }) {
  const [nonce] = useState(() => crypto.randomUUID())
  const frame = useRef<HTMLIFrameElement>(null)
  const channel = useRef<MessageChannel | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbacks = useRef({ onToken, onError })
  callbacks.current = { onToken, onError }
  useEffect(() => {
    timer.current = setTimeout(() => callbacks.current.onError(), 45_000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      channel.current?.port1.close(); channel.current?.port2.close()
    }
  }, [])
  const connect = () => {
    channel.current?.port1.close(); channel.current?.port2.close()
    const connection = new MessageChannel()
    channel.current = connection
    connection.port1.onmessage = ({ data }) => {
      if (!data || data.nonce !== nonce) return
      if (timer.current) clearTimeout(timer.current)
      if (data.type === 'token' && typeof data.token === 'string' && data.token.length <= 2048)
        callbacks.current.onToken(data.token)
      else if (data.type === 'expired') callbacks.current.onToken('')
      else if (data.type === 'error') { callbacks.current.onToken(''); callbacks.current.onError() }
    }
    // Target the exact HTTPS origin. Replies use a private port, never wildcard postMessage.
    frame.current?.contentWindow?.postMessage({ type: 'slur-security-check', nonce },
      new URL(CHECK_URL).origin, [connection.port2])
  }
  return <iframe ref={frame} src={`${CHECK_URL}#${nonce}`} title="Security check"
    className="sl-turnstile" style={{ border: 0, height: 78 }} referrerPolicy="no-referrer"
    onLoad={connect} onError={() => callbacks.current.onError()} />
}
