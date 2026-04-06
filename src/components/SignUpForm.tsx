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
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-900">Check your email</p>
        <p className="text-xs text-gray-500">
          We sent a confirmation link to <span className="text-blue-600 font-medium">{email}</span>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSignUp} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="signup-email" className="text-xs font-medium text-gray-600">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="h-10 rounded-lg bg-gray-50 px-3 text-sm text-gray-900 placeholder-gray-400 outline-none ring-1 ring-gray-200 focus:ring-blue-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="signup-password" className="text-xs font-medium text-gray-600">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Min 6 characters"
          className="h-10 rounded-lg bg-gray-50 px-3 text-sm text-gray-900 placeholder-gray-400 outline-none ring-1 ring-gray-200 focus:ring-blue-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="signup-confirm" className="text-xs font-medium text-gray-600">
          Confirm Password
        </label>
        <input
          id="signup-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="Repeat password"
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
        {loading ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  )
}
