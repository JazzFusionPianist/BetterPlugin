import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase!.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleLogin} className="auth-form">
      <div className="auth-field">
        <label htmlFor="login-email" className="auth-label">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="auth-input"
        />
      </div>

      <div className="auth-field">
        <label htmlFor="login-password" className="auth-label">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Your password"
          className="auth-input"
        />
      </div>

      {error && <p className="auth-error">{error}</p>}

      <button type="submit" disabled={loading} className="auth-submit">
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
