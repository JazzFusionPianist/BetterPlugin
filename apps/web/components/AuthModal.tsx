'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import SlurMark from './slur/SlurMark'
import Bar from './slur/Bar'
import { C } from './slur/marks'

const DOOR_NOTES = [
  { x: 170, step: 2, color: C.ink, hollow: false },
  { x: 360, step: 6, color: C.paper },
  { x: 550, step: 4, color: C.orange, hollow: false },
]

type Mode = 'signin' | 'signup'

interface Props {
  open: boolean
  onClose: () => void
  /** Which view to show when the panel opens. Defaults to sign-in. */
  initialMode?: Mode
  /** Fired after a successful sign-in (session established). */
  onAuthed: () => void
}

/** Handles are lowercase, 3-20 chars of letters/digits/dot/underscore. */
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/
const cleanUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20)

export default function AuthModal({ open, onClose, initialMode = 'signin', onAuthed }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  // Signup consent — required boxes gate the submit; the choices ride
  // signUp metadata as the consent record.
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeAge, setAgreeAge] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  // Reset to the requested mode + focus the email field when it opens.
  useEffect(() => {
    if (open) {
      setMode(initialMode); setError(null); setNote(null)
      const t = setTimeout(() => emailRef.current?.focus(), 260)
      return () => clearTimeout(t)
    }
  }, [open, initialMode])

  // Esc closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const toggle = () => {
    setMode(m => (m === 'signin' ? 'signup' : 'signin'))
    setError(null); setNote(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(null); setNote(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setError(/invalid login credentials/i.test(error.message)
            ? 'email and password don’t match — try again.'
            : 'couldn’t log you in — try again.')
          return
        }
        onAuthed()
      } else {
        const handle = username.trim()
        if (!USERNAME_RE.test(handle)) {
          setError('usernames are 3–20 characters — lowercase letters, numbers, dots or underscores.')
          return
        }
        // Availability first — the DB's unique index is the real gate,
        // but this gives a human answer instead of a database error.
        const { data: free, error: rpcErr } = await supabase.rpc('username_available', { u: handle })
        if (rpcErr) { setError('couldn’t check that username — try again.'); return }
        if (!free) { setError(`@${handle} is taken — try another.`); return }
        if (!agreeTerms || !agreePrivacy || !agreeAge) {
          setError('the required agreements need a check to continue.')
          return
        }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: {
            display_name: name.trim() || handle, username: handle,
            // Consent record — kept in auth.users.raw_user_meta_data as
            // proof of what was agreed to, and when, at signup.
            tos_agreed: 'v1.0', privacy_agreed: 'v1.0', age_over_14: true,
            marketing_opt_in: agreeMarketing, consent_at: new Date().toISOString(),
          } },
        })
        if (error) {
          setError(/already registered/i.test(error.message)
            ? 'that email already has an account — log in instead.'
            : 'couldn’t create the account — try again.')
          return
        }
        // If email confirmation is on, there's no session yet.
        if (data.session) onAuthed()
        else setNote('check your email to confirm the account, then log in.')
      }
    } catch (err) {
      console.error('[auth]', err)
      setError('something went wrong — try again.')
    } finally {
      setBusy(false)
    }
  }

  const lamp = (checked: boolean, set: (v: boolean) => void, body: React.ReactNode, required = true) => (
    <label className="sl-lamp">
      <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)} required={required} />
      <span>{body}{required && <em> required</em>}</span>
    </label>
  )

  // The door: a lilac arch with three tied notes on the left, the form on
  // the right. Phones get the form alone.
  return (
    <div className={`sl-door${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label={mode === 'signin' ? 'log in' : 'sign up'}>
      <div className="sl-door-l">
        {open && <Bar w={720} h={900} y0={360} gap={60} s={50} line="rgba(26,25,23,.35)" notes={DOOR_NOTES} />}
        <span className="sl-logo"><SlurMark height={40} arm={C.white} /><span>studio</span></span>
      </div>
      <div className="sl-door-r">
        <button className="sl-door-x" onClick={onClose}>close</button>
        <form className="sl-form" onSubmit={submit}>
          <h2>{mode === 'signin' ? 'log in' : 'sign up'}</h2>
          {mode === 'signup' && (
            <>
              <input className="sl-fld" type="text" placeholder="name" autoComplete="name" aria-label="name"
                value={name} onChange={e => setName(e.target.value)} />
              <input className="sl-fld" type="text" placeholder="username" autoComplete="username" aria-label="username" required
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                value={username} onChange={e => setUsername(cleanUsername(e.target.value))} />
            </>
          )}
          <input className="sl-fld" ref={emailRef} type="email" placeholder="email" autoComplete="email" aria-label="email" required
            value={email} onChange={e => setEmail(e.target.value)} />
          <div className="sl-fld-wrap">
            <input className="sl-fld" type={showPw ? 'text' : 'password'} placeholder="password" aria-label="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required
              value={password} onChange={e => setPassword(e.target.value)} />
            {password && (
              <button type="button" className="sl-show" onClick={() => setShowPw(s => !s)}
                tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? 'hide' : 'show'}
              </button>
            )}
          </div>

          {mode === 'signup' && (
            <div className="sl-lamps">
              {lamp(agreeTerms, setAgreeTerms, <><a href="/terms" target="_blank" rel="noreferrer">terms</a></>)}
              {lamp(agreePrivacy, setAgreePrivacy, <><a href="/privacy" target="_blank" rel="noreferrer">privacy policy</a></>)}
              {lamp(agreeAge, setAgreeAge, <>14 or older</>)}
              {lamp(agreeMarketing, setAgreeMarketing, <>the odd update</>, false)}
            </div>
          )}

          {error && <div className="sl-msg err">{error}</div>}
          {note && <div className="sl-msg">{note}</div>}

          <button type="submit" className="sl-go" disabled={busy || (mode === 'signup' && !(agreeTerms && agreePrivacy && agreeAge))}>
            {busy ? (mode === 'signin' ? 'logging in…' : 'signing up…') : (mode === 'signin' ? 'log in' : 'sign up')}
          </button>
          <button type="button" className="sl-swap" onClick={toggle}>{mode === 'signin' ? 'sign up' : 'log in'}</button>
        </form>
      </div>
    </div>
  )
}
