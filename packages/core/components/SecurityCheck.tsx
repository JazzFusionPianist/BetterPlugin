'use client'

import { useEffect, useRef, useState } from 'react'
import { Turnstile } from './Turnstile.tsx'
import { SECURITY_CHECK_URL, needsHostedSecurityCheck } from '../lib/securityCheck.ts'

type Props = { onToken: (token: string) => void; onError: () => void; resetKey?: number }

/** Native origins use an HTTPS challenge; ordinary browsers render it directly. */
export function SecurityCheck({ resetKey = 0, ...callbacks }: Props) {
  const [hosted, setHosted] = useState<boolean | null>(null)
  useEffect(() => {
    const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    setHosted(needsHostedSecurityCheck(location.protocol, capacitor?.isNativePlatform?.() === true))
  }, [])
  if (hosted === null) return <div className="sl-turnstile" aria-label="Security check loading" />
  return hosted
    ? <HostedCheck key={resetKey} {...callbacks} />
    : <Turnstile resetKey={resetKey} {...callbacks} />
}

function HostedCheck({ onToken, onError }: Omit<Props, 'resetKey'>) {
  const [nonce] = useState(() => crypto.randomUUID())
  const frame = useRef<HTMLIFrameElement>(null)
  const channel = useRef<MessageChannel | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbacks = useRef({ onToken, onError })
  callbacks.current = { onToken, onError }
  useEffect(() => {
    timer.current = setTimeout(() => {
      callbacks.current.onToken('')
      callbacks.current.onError()
    }, 45_000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      channel.current?.port1.close()
      channel.current?.port2.close()
    }
  }, [])
  const connect = () => {
    channel.current?.port1.close()
    channel.current?.port2.close()
    const connection = new MessageChannel()
    channel.current = connection
    connection.port1.onmessage = ({ data }) => {
      if (!data || data.nonce !== nonce) return
      // A loaded widget is not a successful verification. Keep the token deadline.
      if (data.type === 'ready') return
      if (data.type === 'token' && typeof data.token === 'string' && data.token.length > 0 && data.token.length <= 2048) {
        if (timer.current) clearTimeout(timer.current)
        callbacks.current.onToken(data.token)
      } else if (data.type === 'expired') callbacks.current.onToken('')
      else if (data.type === 'error') {
        if (timer.current) clearTimeout(timer.current)
        callbacks.current.onToken('')
        callbacks.current.onError()
      }
    }
    connection.port1.start()
    frame.current?.contentWindow?.postMessage({ type: 'slur-security-check', nonce },
      new URL(SECURITY_CHECK_URL).origin, [connection.port2])
  }
  return <iframe ref={frame} src={`${SECURITY_CHECK_URL}#${nonce}`} title="Security check"
    className="sl-turnstile" style={{ border: 0, width: 300, maxWidth: '100%', height: 78 }}
    referrerPolicy="no-referrer" onLoad={connect}
    onError={() => { callbacks.current.onToken(''); callbacks.current.onError() }} />
}
