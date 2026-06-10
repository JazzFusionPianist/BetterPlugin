import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error } = await supabase!.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="auth-success">
        <div className="auth-success-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="auth-success-title">Check your email</p>
        <p className="auth-success-body">
          We sent a confirmation link to <strong>{email}</strong>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSignUp} className="auth-form">
      <div className="auth-field">
        <label htmlFor="signup-email" className="auth-label">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="auth-input"
        />
      </div>

      <div className="auth-field">
        <label htmlFor="signup-password" className="auth-label">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Min 6 characters"
          className="auth-input"
        />
      </div>

      <div className="auth-field">
        <label htmlFor="signup-confirm" className="auth-label">Confirm Password</label>
        <input
          id="signup-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="Repeat password"
          className="auth-input"
        />
      </div>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" disabled={loading} className="auth-submit">
        {loading ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  )
}
