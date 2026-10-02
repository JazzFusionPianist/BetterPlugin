import { useEffect, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/** The database enforces AAL2 independently of this enrollment/challenge UI. */
export function AdminMfaGate({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'denied' | 'challenge' | 'ready'>('loading')
  const [factor, setFactor] = useState('')
  const [qr, setQr] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    const check = async () => {
      const admin = await client.rpc('is_platform_admin')
      if (admin.error) throw admin.error
      if (!alive) return
      if (admin.data !== true) { setState('denied'); return }
      const level = await client.auth.mfa.getAuthenticatorAssuranceLevel()
      if (level.error) throw level.error
      if (!alive) return
      if (level.data.currentLevel === 'aal2') { setQr(''); setState('ready'); return }
      const factors = await client.auth.mfa.listFactors()
      if (factors.error) throw factors.error
      if (!alive) return
      setFactor(factors.data.totp.find(f => f.status === 'verified')?.id ?? '')
      setState('challenge')
    }
    void check().catch(() => { if (alive) setError('관리자 인증을 확인하지 못했습니다. 새로고침해 주세요.') })
    const { data } = client.auth.onAuthStateChange(() => {
      // Do not run auth methods inside the auth callback's lock.
      setTimeout(() => { if (alive) void check().catch(() => setState('denied')) }, 0)
    })
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [client])

  const enroll = async () => {
    setBusy(true); setError('')
    try {
      const result = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Orb admin ${new Date().toISOString()}` })
      if (result.error) throw result.error
      setFactor(result.data.id)
      const svg = result.data.totp.qr_code
      setQr(svg.startsWith('data:') ? svg : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    } catch { setError('인증 앱 등록에 실패했습니다. 다시 시도해 주세요.') }
    finally { setBusy(false) }
  }
  const verify = async () => {
    setBusy(true); setError('')
    try {
      const result = await client.auth.mfa.challengeAndVerify({ factorId: factor, code })
      if (result.error) throw result.error
      setCode(''); setQr(''); setState('ready')
    } catch { setError('인증 코드가 올바르지 않거나 만료되었습니다.') }
    finally { setBusy(false) }
  }
  if (state === 'ready') return children
  return <main style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
    <h1>관리자 인증</h1>
    {state === 'denied' ? <p>관리자 권한이 없습니다.</p> : state === 'loading' ? <p>인증 확인 중…</p> : <>
      <p>회원 정보를 보호하기 위해 인증 앱의 일회용 코드가 필요합니다.</p>
      {!factor && <button disabled={busy} onClick={() => void enroll()}>인증 앱 등록</button>}
      {qr && <><p>인증 앱에서 QR 코드를 스캔한 뒤 코드를 입력해 주세요.</p><img src={qr} alt="인증 앱 등록 QR 코드" width={220} /></>}
      {factor && <form onSubmit={e => { e.preventDefault(); void verify() }}>
        <label>6자리 인증 코드<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
        <button disabled={busy || code.length !== 6}>인증</button>
      </form>}
    </>}
    {error && <p role="alert">{error}</p>}
    <a href="/">돌아가기</a>
  </main>
}
