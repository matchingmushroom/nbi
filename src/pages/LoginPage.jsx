import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
          <h1 className="font-['Hanken_Grotesk'] text-3xl font-bold text-primary">NBI Prep</h1>
          <p className="text-sm text-on-surface-variant mt-1">Licensure Excellence</p>
        </div>
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
      </div>
    </div>
  )
}
