// ─── ResetPassword.jsx ───────────────────────────────────────────────────────
// Where the "reset your password" email link lands (/reset-password).
//
// Flow: Login page → "Forgot your password?" → enter email →
// supabase.auth.resetPasswordForEmail(..., { redirectTo: <site>/reset-password })
// → the email's link signs the person in for a password change and brings
// them here → they choose a new password → supabase.auth.updateUser().
//
// The Supabase client picks the one-time login out of the link's address
// by itself (detectSessionInUrl, on by default). This page waits for that
// session; if the link is expired, already used or invalid, it says so and
// offers to send a new one instead of showing a form that can't work.
//
// Supabase setting required: Authentication → URL Configuration → Redirect
// URLs must include https://recfish-za.netlify.app/reset-password.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAVY = '#1e3a8a'
const MIN_LENGTH = 6   // Supabase's default minimum password length

// Errors Supabase puts in the link's address (e.g. an expired link)
function linkErrorFromUrl() {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search)
    const desc = params.get('error_description') || params.get('error')
    return desc ? desc.replace(/\+/g, ' ') : ''
  } catch { return '' }
}

export default function ResetPassword() {
  const navigate = useNavigate()
  // checking → ready (may set a new password) | invalid (bad/expired link) | done
  const [stage, setStage] = useState('checking')
  const [linkError, setLinkError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const urlError = linkErrorFromUrl()
    if (urlError) { setLinkError(urlError); setStage('invalid'); return }

    let settled = false
    const ready = () => { if (!settled) { settled = true; setStage('ready') } }

    // The link's one-time login arrives as a PASSWORD_RECOVERY (or SIGNED_IN)
    // event once the Supabase client has read it from the address.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) ready()
    })
    // ...or it may already have been processed before this page mounted.
    supabase.auth.getSession().then(({ data }) => { if (data?.session) ready() })

    // No session after a while: the link was invalid, expired or used.
    const t = setTimeout(() => {
      if (!settled) { settled = true; setStage('invalid') }
    }, 10000)

    return () => { clearTimeout(t); subscription.unsubscribe() }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < MIN_LENGTH) { setError(`Use at least ${MIN_LENGTH} characters.`); return }
    if (password !== confirm) { setError("The two passwords don't match."); return }
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) {
      setError(/same|different/i.test(err.message)
        ? 'Please choose a password different from your old one.'
        : (err.message || 'Could not save the new password'))
      return
    }
    setStage('done')
    setTimeout(() => navigate('/dashboard'), 2500)
  }

  const input = { width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '1rem', boxSizing: 'border-box' }
  const label = { display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }
  const btn = (disabled) => ({ width: '100%', padding: '0.875rem', background: disabled ? '#9ca3af' : NAVY, color: 'white', border: 'none', borderRadius: 6, fontSize: '1rem', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '1rem' }}>
      <div style={{ background: 'white', padding: '2rem', borderRadius: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: NAVY, margin: 0 }}>🎣 RecFish ZA</h1>
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Set a new password</p>
        </div>

        {stage === 'checking' && (
          <div data-stage="checking" style={{ textAlign: 'center', color: '#6b7280' }}>Checking your reset link…</div>
        )}

        {stage === 'invalid' && (
          <div data-stage="invalid">
            <div style={{ padding: '0.9rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, color: '#991b1b', marginBottom: '1rem', fontSize: '0.9rem' }}>
              This reset link has expired, has already been used, or isn't valid.
              {linkError && <div style={{ marginTop: 6, fontSize: '0.8rem', opacity: 0.85 }}>({linkError})</div>}
            </div>
            <Link to="/login?forgot=1" style={{ ...btn(false), display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Send me a new link
            </Link>
          </div>
        )}

        {stage === 'ready' && (
          <form data-stage="ready" onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding: '0.75rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 4, color: '#991b1b', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={label}>New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" style={input} placeholder={`At least ${MIN_LENGTH} characters`} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={label}>Type it again</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" style={input} placeholder="Same password again" />
            </div>
            <button type="submit" disabled={saving} style={btn(saving)}>{saving ? 'Saving…' : 'Save new password'}</button>
          </form>
        )}

        {stage === 'done' && (
          <div data-stage="done" style={{ padding: '0.9rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', textAlign: 'center' }}>
            ✓ Your password has been changed. Taking you in…
          </div>
        )}
      </div>
    </div>
  )
}
