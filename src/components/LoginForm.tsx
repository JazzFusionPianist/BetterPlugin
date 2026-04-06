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
    <form onSubmit={handleLogin} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="login-email" className="text-xs font-medium text-gray-600">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="h-10 rounded-lg bg-gray-50 px-3 text-sm text-gray-900 placeholder-gray-400 outline-none ring-1 ring-gray-200 focus:ring-blue-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="login-password" className="text-xs font-medium text-gray-600">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Your password"
          className="h-10 rounded-lg bg-gray-50 px-3 text-sm text-gray-900 placeholder-gray-400 outline-none ring-1 ring-gray-200 focus:ring-blue-500 transition-colors"
        />
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 h-10 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
