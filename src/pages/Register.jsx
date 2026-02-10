import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registrationComplete, setRegistrationComplete] = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      })

      if (error) throw error

      // Check if email confirmation is disabled (instant login)
      if (data?.session) {
        // Email confirmation disabled - user is logged in immediately
        navigate('/dashboard')
      } else {
        // Email confirmation enabled - show success message
        setRegistrationComplete(true)
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Success screen after registration
  if (registrationComplete) {
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
          padding: '2.5rem',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '500px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: '#10b981',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              fontSize: '3rem',
              color: 'white'
            }}>
              ✓
            </div>
          </div>

          <h1 style={{ 
            fontSize: '1.75rem', 
            fontWeight: 'bold', 
            marginBottom: '1rem', 
            textAlign: 'center',
            color: '#1f2937'
          }}>
            Check Your Email!
          </h1>

          <div style={{
            background: '#dbeafe',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            padding: '1.25rem',
            marginBottom: '1.5rem'
          }}>
            <p style={{ 
              fontSize: '1rem', 
              color: '#1e40af',
              marginBottom: '0.75rem',
              fontWeight: '600'
            }}>
              📧 Verification Email Sent
            </p>
            <p style={{ fontSize: '0.9rem', color: '#1e3a8a', marginBottom: '0.5rem' }}>
              We've sent a verification link to:
            </p>
            <p style={{ 
              fontSize: '1rem', 
              fontWeight: 'bold', 
              color: '#1e40af',
              marginBottom: '1rem',
              wordBreak: 'break-word'
            }}>
              {email}
            </p>
            <p style={{ fontSize: '0.9rem', color: '#1e3a8a' }}>
              Click the link in the email to activate your account and log in.
            </p>
          </div>

          <div style={{
            background: '#f9fafb',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <p style={{ 
              fontSize: '0.875rem', 
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.75rem'
            }}>
              What to do next:
            </p>
            <ol style={{ 
              fontSize: '0.875rem',
              color: '#6b7280',
              paddingLeft: '1.25rem',
              margin: 0
            }}>
              <li style={{ marginBottom: '0.5rem' }}>
                Check your email inbox for a message from RecFish ZA
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                Click the "Confirm your email" link in the email
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                You'll be redirected back here to log in
              </li>
              <li>
                Start logging your catches! 🎣
              </li>
            </ol>
          </div>

          <div style={{
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '6px',
            padding: '0.875rem',
            marginBottom: '1.5rem',
            fontSize: '0.8rem',
            color: '#78350f'
          }}>
            <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
              ⚠️ Didn't receive the email?
            </p>
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Check your spam/junk folder</li>
              <li>Check promotions tab (Gmail users)</li>
              <li>Wait a few minutes - emails can be delayed</li>
              <li>Make sure you entered the correct email address</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Go to Login Page
            </button>
            
            <button
              onClick={() => {
                setRegistrationComplete(false)
                setEmail('')
                setPassword('')
              }}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: 'transparent',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Register with different email
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Registration form
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
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '420px'
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>
          🎣 RecFish ZA
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '2rem', textAlign: 'center' }}>
          Create your angler account
        </p>

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="your.email@example.com"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="••••••••"
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Minimum 6 characters
            </p>
          </div>

          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            padding: '0.875rem',
            marginBottom: '1.25rem',
            fontSize: '0.8rem',
            color: '#1e40af'
          }}>
            <p style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              📧 Email verification required
            </p>
            <p style={{ margin: 0 }}>
              You'll receive a confirmation email after registering. Click the link to activate your account.
            </p>
          </div>

          {error && (
            <div style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '0.875rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              border: '1px solid #fecaca'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
          Already have an account?{' '}
          <a
            href="/login"
            style={{ color: '#3b82f6', fontWeight: '600', textDecoration: 'none' }}
          >
            Sign in here
          </a>
        </div>
      </div>
    </div>
  )
}
