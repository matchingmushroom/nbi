import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegister) {
        await register(form.email, form.password, form.name)
      } else {
        await login(form.email, form.password)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(.*\)/, ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">
      <div className="bg-surface rounded-2xl shadow-sm border border-outline-variant p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="font-['Hanken_Grotesk'] text-3xl font-bold text-primary">BankMastery</h1>
          <p className="text-sm text-on-surface-variant mt-1">Learn. Practice. Master.</p>
        </div>
        {resetMode ? (
          <>
            <h2 className="text-lg font-semibold text-on-surface mb-4">Reset Password</h2>
            {resetSent ? (
              <div className="bg-success/10 border border-success/30 rounded-lg p-4 text-center">
                <span className="material-symbols-outlined text-success text-[36px]">mail</span>
                <p className="text-sm font-medium text-on-surface mt-2">Reset link sent!</p>
                <p className="text-xs text-on-surface-variant mt-1">Check your email for the password reset link.</p>
                <button onClick={() => { setResetMode(false); setResetSent(false); setResetEmail('') }} className="mt-4 text-primary font-semibold text-sm hover:underline cursor-pointer">
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault()
                setError('')
                setResetLoading(true)
                try {
                  await sendPasswordResetEmail(auth, resetEmail)
                  setResetSent(true)
                } catch (err) {
                  setError(err.message.replace('Firebase: ', '').replace(/\(.*\)/, ''))
                }
                setResetLoading(false)
              }} className="space-y-4">
                <p className="text-xs text-on-surface-variant">Enter your email address and we'll send you a link to reset your password.</p>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wide">Email</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm placeholder:text-on-surface-variant/50"
                    placeholder="you@example.com"
                  />
                </div>
                {error && <div className="bg-error-container/30 border border-red-200 text-on-error-container text-sm rounded-lg p-3">{error}</div>}
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-primary text-on-primary py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button type="button" onClick={() => { setResetMode(false); setError('') }} className="w-full text-center text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                  Back to Sign In
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-on-surface mb-4">{isRegister ? 'Create Account' : 'Sign In'}</h2>
            {error && (
              <div className="bg-error-container/30 border border-red-200 text-on-error-container text-sm rounded-lg p-3 mb-4">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wide">Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm placeholder:text-on-surface-variant/50"
                    placeholder="John Doe"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm placeholder:text-on-surface-variant/50"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wide">Password</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm placeholder:text-on-surface-variant/50"
                  placeholder="••••••••"
                />
              </div>
              {!isRegister && (
                <div className="text-right -mt-1">
                  <button type="button" onClick={() => { setResetMode(true); setResetEmail(form.email); setError('') }} className="text-xs text-primary font-medium hover:underline cursor-pointer">
                    Forgot Password?
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-on-primary py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
              >
                {loading ? 'Please wait...' : isRegister ? 'Register' : 'Sign In'}
              </button>
            </form>
            <p className="text-center text-xs text-on-surface-variant mt-5">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button onClick={() => { setIsRegister(!isRegister); setError('') }} className="text-primary font-semibold hover:underline cursor-pointer">
                {isRegister ? 'Sign In' : 'Register'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
