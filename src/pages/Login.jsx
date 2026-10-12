import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // 'login' (normal) or 'forgot' (request a password-reset email).
  // /login?forgot=1 opens straight in 'forgot' (used by the reset page when
  // a link has expired).
  const [mode, setMode] = useState(searchParams.get('forgot') ? 'forgot' : 'login')
  const [resetSent, setResetSent] = useState(false)

  const handleForgot = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) {
        // Supabase limits how many emails it sends per hour.
        if (/rate limit|too many|seconds/i.test(err.message)) {
          throw new Error('Too many reset emails have been requested just now. Please wait a few minutes and try again.')
        }
        throw err
      }
      // Same message whether or not the address is registered, so this
      // screen can't be used to find out who has an account.
      setResetSent(true)
    } catch (err) {
      setError(err.message || 'Could not send the reset email')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e3a8a' }}>
            🎣 RecFish ZA
          </h1>
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
            {mode === 'forgot' ? 'Reset your password' : 'Sign in to your account'}
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            color: '#991b1b',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {mode === 'forgot' ? (
          resetSent ? (
            <div style={{ fontSize: '0.95rem', color: '#374151', lineHeight: 1.5 }}>
              <div style={{ padding: '0.9rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, marginBottom: '1rem' }}>
                ✉️ If an account exists for <strong>{email.trim()}</strong>, we've sent it a password-reset link.
              </div>
              Open the email and tap the link to choose a new password. It may take a few minutes,
              and can land in your <strong>spam / junk</strong> folder.
              <button type="button" onClick={() => { setMode('login'); setResetSent(false); setError('') }}
                style={{ display: 'block', width: '100%', marginTop: '1.25rem', padding: '0.875rem', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 6, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot}>
              <p style={{ fontSize: '0.9rem', color: '#4b5563', marginTop: 0, marginBottom: '1rem' }}>
                Enter the email address you registered with and we'll email you a link to set a new password.
              </p>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Email
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '1rem', boxSizing: 'border-box' }}
                  placeholder="your.email@example.com" />
              </div>
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '0.875rem', background: loading ? '#9ca3af' : '#1e3a8a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '0.75rem' }}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError('') }}
                style={{ width: '100%', padding: '0.6rem', background: 'none', border: 'none', color: '#1e3a8a', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                ← Back to Sign In
              </button>
            </form>
          )
        ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
              placeholder="your.email@example.com"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading ? '#9ca3af' : '#1e3a8a',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '1rem'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <div style={{ textAlign: 'center', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
            <button type="button" onClick={() => { setMode('forgot'); setError('') }}
              style={{ background: 'none', border: 'none', color: '#1e3a8a', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}>
              Forgot your password?
            </button>
          </div>
        </form>
        )}

        <div style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '1.5rem',
          marginTop: '0.5rem'
        }}>
          <p style={{
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#6b7280',
            marginBottom: '1rem'
          }}>
            Don't have an account?
          </p>
          <Link
            to="/register"
            style={{
              display: 'block',
              width: '100%',
              padding: '0.875rem',
              background: 'transparent',
              color: '#1e3a8a',
              border: '2px solid #1e3a8a',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              textAlign: 'center',
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  )
}
