import { useState } from 'react'
import LoginForm from '../components/LoginForm'
import SignUpForm from '../components/SignUpForm'

type Tab = 'login' | 'signup'

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>('login')

  return (
    <div className="flex flex-col justify-center px-8 py-10" style={{ width: 300, height: 500, overflow: 'hidden' }}>
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold text-gray-900">CoOp</h1>
      </div>

      <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setTab('login')}
          className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${
            tab === 'login'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => setTab('signup')}
          className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${
            tab === 'signup'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sign Up
        </button>
      </div>

      {tab === 'login' ? <LoginForm /> : <SignUpForm />}
    </div>
  )
}
