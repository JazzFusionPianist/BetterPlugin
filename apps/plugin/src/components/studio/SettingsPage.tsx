/**
 * Settings — a short catalogue page: account, language, about, and the
 * door out. Everything the web app's settings sheet and the full plug-in's
 * settings panels offer, minus what this surface doesn't have (the studio
 * has one paper theme and one text size). Words, hairlines, no chrome.
 */

import { useEffect, useState } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { useT } from '../../i18n/LanguageContext'
import { LANG_META } from '../../i18n/types'
import { openExternalUrl } from '../../lib/linkify'

interface Props {
  supabase: SupabaseClient
  user: User
}

const LEGAL_BASE = 'https://orb-app-liard.vercel.app'

/** The native plug-in passes its own version on the URL (?ver=, from
 *  JucePlugin_VersionString); a plain browser shows the bundle's. */
export const APP_VERSION: string =
  new URLSearchParams(window.location.search).get('ver') ?? __APP_VERSION__

export default function SettingsPage({ supabase, user }: Props) {
  const { lang, setLang } = useT()

  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = window.setTimeout(() => setMsg(null), 2400)
    return () => window.clearTimeout(t)
  }, [msg])

  // ── password ────────────────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false)
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwErr, setPwErr] = useState<string | null>(null)
  const closePw = () => { setPwOpen(false); setCurPw(''); setNewPw(''); setNewPw2(''); setPwErr(null) }
  const changePw = async () => {
    setPwErr(null)
    if (!curPw) { setPwErr('enter your current password'); return }
    if (newPw.length < 6) { setPwErr('new password — at least 6 characters'); return }
    if (newPw !== newPw2) { setPwErr('the two new passwords differ'); return }
    setPwBusy(true)
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email ?? '', password: curPw })
    if (authErr) { setPwBusy(false); setPwErr('that isn’t your current password'); return }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwBusy(false)
    if (error) { setPwErr('couldn’t change it — try again'); return }
    closePw()
    setMsg('password changed')
  }

  // ── delete account — three taps, each a plainer sentence ────────────
  const [delStep, setDelStep] = useState(0)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    if (delStep === 0) return
    const t = window.setTimeout(() => setDelStep(0), 6000)
    return () => window.clearTimeout(t)
  }, [delStep])
  const onDelete = async () => {
    if (delStep < 2) { setDelStep(s => s + 1); return }
    setDeleting(true)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) { setDeleting(false); setDelStep(0); setMsg('couldn’t delete the account — write to wtsteven123@gmail.com'); return }
    await supabase.auth.signOut()
  }

  const [signingOut, setSigningOut] = useState(false)

  return (
    <div className="wd-set">
      <div className="wd-set-scroll">

        <div className="wd-set-sec">
          <div className="wd-set-head">account</div>
          <div className="wd-set-row">
            <span className="wd-set-k">email</span>
            <span className="wd-set-v">{user.email}</span>
          </div>
          <div className="wd-set-row">
            <span className="wd-set-k">password</span>
            {pwOpen
              ? <button className="wd-word" onClick={closePw}>cancel</button>
              : <button className="wd-word" onClick={() => setPwOpen(true)}>change</button>}
          </div>
          {pwOpen && (
            <div className="wd-set-pw">
              <input type="password" className="wd-set-in" placeholder="current password" value={curPw}
                autoFocus autoComplete="current-password" onChange={e => { setCurPw(e.target.value); setPwErr(null) }} />
              <input type="password" className="wd-set-in" placeholder="new password" value={newPw}
                autoComplete="new-password" onChange={e => { setNewPw(e.target.value); setPwErr(null) }} />
              <input type="password" className="wd-set-in" placeholder="new password, again" value={newPw2}
                autoComplete="new-password" onChange={e => { setNewPw2(e.target.value); setPwErr(null) }}
                onKeyDown={e => { if (e.key === 'Enter') void changePw() }} />
              <div className="wd-set-pw-acts">
                <button className="wd-word acc" disabled={pwBusy || !curPw || !newPw || !newPw2} onClick={() => void changePw()}>
                  {pwBusy ? 'checking…' : 'update password'}
                </button>
                {pwErr && <span className="wd-set-err">{pwErr}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="wd-set-sec">
          <div className="wd-set-head">language</div>
          <div className="wd-set-langs">
            {LANG_META.map(m => (
              <button key={m.code} className={`wd-set-lang${m.code === lang ? ' on' : ''}`}
                onClick={() => setLang(m.code)} title={m.englishName}>
                {m.nativeName}
              </button>
            ))}
          </div>
          <div className="wd-set-fine">games follow this. the studio itself speaks english</div>
        </div>

        <div className="wd-set-sec">
          <div className="wd-set-head">about</div>
          <div className="wd-set-row">
            <span className="wd-set-k">orb chat</span>
            <span className="wd-set-v tab">{APP_VERSION}</span>
          </div>
          <div className="wd-set-row">
            <span className="wd-set-k">build</span>
            <span className="wd-set-v tab">{__BUILD_ID__}</span>
          </div>
          <div className="wd-set-row">
            <span className="wd-set-k">legal</span>
            <span className="wd-set-v">
              <a href={`${LEGAL_BASE}/terms`} onClick={e => { e.preventDefault(); void openExternalUrl(`${LEGAL_BASE}/terms`) }}>terms</a>
              <a href={`${LEGAL_BASE}/privacy`} onClick={e => { e.preventDefault(); void openExternalUrl(`${LEGAL_BASE}/privacy`) }}>privacy</a>
            </span>
          </div>
        </div>

        <div className="wd-set-sec">
          <div className="wd-set-head">session</div>
          <div className="wd-set-row">
            <button className="wd-word" disabled={signingOut}
              onClick={() => { setSigningOut(true); void supabase.auth.signOut() }}>
              {signingOut ? 'signing out…' : 'sign out'}
            </button>
          </div>
          <div className="wd-set-row">
            <button className={`wd-word${delStep > 0 ? ' sure' : ' dim'}`} disabled={deleting} onClick={() => void onDelete()}>
              {deleting ? 'deleting…'
                : delStep === 0 ? 'delete account'
                : delStep === 1 ? 'delete my account'
                : 'sure? this is forever'}
            </button>
            {delStep > 0 && !deleting && (
              <span className="wd-set-fine inline">your messages, files and rooms go with it</span>
            )}
          </div>
        </div>

      </div>
      {msg && <div className="wd-toast">{msg}</div>}
    </div>
  )
}
