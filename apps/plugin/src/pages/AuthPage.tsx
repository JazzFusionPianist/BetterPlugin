import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { openExternalUrl } from '../lib/linkify'
import './auth.css'

type Mode = 'signin' | 'signup'

/** Handles are lowercase, 3-20 chars of letters/digits/dot/underscore. */
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/
const cleanUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20)

/** Legal docs live once, on the app domain — the plugin links out. */
const LEGAL_BASE = 'https://orb-app-liard.vercel.app'
const openLegal = (url: string) => (e: React.MouseEvent) => {
  e.preventDefault()
  openExternalUrl(url)
}

/* Static print-shop marginalia — the plugin's small still version of the
   app's drifting registration marks. Ink and one blue accent only. */
function Marginalia() {
  return (
    <svg className="auth-marks" width="300" height="500" viewBox="0 0 300 500" aria-hidden="true">
      {/* registration crosshairs */}
      <g stroke="#1A1917" strokeWidth="1" fill="none" opacity="0.11">
        <path d="M46 62 h16 M54 54 v16" />
        <circle cx="54" cy="62" r="4.5" />
      </g>
      <g stroke="#2440FF" strokeWidth="1" fill="none" opacity="0.13">
        <path d="M236 420 h14 M243 413 v14" />
        <circle cx="243" cy="420" r="4" />
      </g>
      <g stroke="#1A1917" strokeWidth="1" fill="none" opacity="0.09">
        <path d="M258 96 h12 M264 90 v12" />
        <circle cx="264" cy="96" r="3.5" />
      </g>
      {/* dots + small circles */}
      <circle cx="34" cy="404" r="1.6" fill="#1A1917" opacity="0.12" />
      <circle cx="222" cy="34" r="1.3" fill="#1A1917" opacity="0.1" />
      <circle cx="66" cy="470" r="6" stroke="#1A1917" strokeWidth="1" fill="none" opacity="0.09" />
      <circle cx="272" cy="252" r="7" stroke="#1A1917" strokeWidth="1" fill="none" opacity="0.08" />
    </svg>
  )
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin')
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
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) setError(error.message)
      } else {
        const handle = username.trim()
        if (!USERNAME_RE.test(handle)) {
          setError('usernames are 3–20 characters: lowercase letters, numbers, dots or underscores.')
          return
        }
        // Availability first — the DB's unique index is the real gate,
        // but this gives a human answer instead of a database error.
        const { data: free, error: rpcErr } = await supabase!.rpc('username_available', { u: handle })
        if (rpcErr) { setError('couldn\'t check that username. try again.'); return }
        if (!free) { setError(`@${handle} is taken — try another.`); return }
        if (!agreeTerms || !agreePrivacy || !agreeAge) {
          setError('the required agreements need a check to continue.')
          return
        }
        const { data, error } = await supabase!.auth.signUp({
          email, password,
          options: { data: {
            display_name: name.trim() || handle, username: handle,
            // Consent record — kept in auth.users.raw_user_meta_data as
            // proof of what was agreed to, and when, at signup.
            tos_agreed: 'v1.0', privacy_agreed: 'v1.0', age_over_14: true,
            marketing_opt_in: agreeMarketing, consent_at: new Date().toISOString(),
          } },
        })
        if (error) { setError(error.message); return }
        // If email confirmation is on, there's no session yet.
        if (!data.session) setNote('check your email to confirm, then sign in.')
      }
    } catch (err) {
      console.error('[auth]', err)
      setError('couldn\'t reach the server. try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <Marginalia />
      <div className="auth-grain" aria-hidden="true" />

      <div className="auth-panel">
        <header className="auth-head">
          <span className="auth-brand"><span className="auth-brand-dot" />Orb</span>
          <h1 className="auth-title">
            {mode === 'signin' ? 'welcome back.' : 'make an account.'}
          </h1>
          <p className="auth-lede">
            {mode === 'signin'
              ? 'sign in to get back to your sessions.'
              : 'a name, an email, a password.'}
          </p>
        </header>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <div className="fld">
                <input id="auth-name" type="text" placeholder=" " autoComplete="name"
                  value={name} onChange={e => setName(e.target.value)} />
                <label htmlFor="auth-name">display name</label>
              </div>
              <div className="fld">
                <input id="auth-username" type="text" placeholder=" " autoComplete="username" required
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  value={username} onChange={e => setUsername(cleanUsername(e.target.value))} />
                <label htmlFor="auth-username">username</label>
              </div>
            </>
          )}
          <div className="fld">
            <input id="auth-email" type="email" placeholder=" " autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)} />
            <label htmlFor="auth-email">email</label>
          </div>
          <div className="fld">
            <input id="auth-password" type={showPw ? 'text' : 'password'} placeholder=" "
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required
              value={password} onChange={e => setPassword(e.target.value)} />
            <label htmlFor="auth-password">password</label>
            {password && (
              <button type="button" className="fld-toggle" onClick={() => setShowPw(s => !s)}
                tabIndex={-1} aria-label={showPw ? 'hide password' : 'show password'}>
                {showPw ? 'hide' : 'show'}
              </button>
            )}
          </div>

          {mode === 'signup' && (
            <div className="auth-consent">
              <label className="auth-check">
                <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} required />
                <span>I agree to the <a href={`${LEGAL_BASE}/terms`} onClick={openLegal(`${LEGAL_BASE}/terms`)}>terms of service</a> <em>(required)</em></span>
              </label>
              <label className="auth-check">
                <input type="checkbox" checked={agreePrivacy} onChange={e => setAgreePrivacy(e.target.checked)} required />
                <span>I agree to the <a href={`${LEGAL_BASE}/privacy`} onClick={openLegal(`${LEGAL_BASE}/privacy`)}>privacy policy</a> <em>(required)</em></span>
              </label>
              <label className="auth-check">
                <input type="checkbox" checked={agreeAge} onChange={e => setAgreeAge(e.target.checked)} required />
                <span>I am 14 or older <em>(required)</em></span>
              </label>
              <label className="auth-check">
                <input type="checkbox" checked={agreeMarketing} onChange={e => setAgreeMarketing(e.target.checked)} />
                <span>send me occasional news <em>(optional)</em></span>
              </label>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}
          {note && <div className="auth-note">{note}</div>}

          <button type="submit" className="auth-submit" disabled={busy || (mode === 'signup' && !(agreeTerms && agreePrivacy && agreeAge))}>
            {busy ? (mode === 'signin' ? 'signing in…' : 'creating account…') : (mode === 'signin' ? 'sign in' : 'create account')}
          </button>
        </form>

        <footer className="auth-switch">
          {mode === 'signin' ? 'new here?' : 'already have an account?'}
          <button type="button" onClick={toggle}>{mode === 'signin' ? 'create an account' : 'sign in instead'}</button>
        </footer>
      </div>
    </div>
  )
}
