import { useState } from 'react'
import LoginForm from '../components/LoginForm'
import SignUpForm from '../components/SignUpForm'
import FloatingOrbs from '../components/FloatingOrbs'
import './auth.css'

type Tab = 'login' | 'signup'

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>('login')

  return (
    <div className="auth-page">
      <FloatingOrbs />
      <div className="auth-content">
        <h1 className="auth-logo">CoOp</h1>

        <div className="auth-tabs">
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`auth-tab${tab === 'login' ? ' active' : ''}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            className={`auth-tab${tab === 'signup' ? ' active' : ''}`}
          >
            Sign Up
          </button>
        </div>

        {tab === 'login' ? <LoginForm /> : <SignUpForm />}
      </div>
    </div>
  )
}
