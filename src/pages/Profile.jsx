import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape'
]

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '1rem',
  background: 'white',
  boxSizing: 'border-box'
}

const labelStyle = {
  display: 'block',
  marginBottom: '0.4rem',
  fontWeight: '600',
  fontSize: '0.875rem',
  color: '#374151'
}

const fieldGroupStyle = {
  marginBottom: '1.25rem'
}

const sectionStyle = {
  background: 'white',
  padding: '1.5rem',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  marginBottom: '1.5rem'
}

const sectionHeaderStyle = {
  fontSize: '1.1rem',
  fontWeight: '700',
  color: '#1e3a8a',
  marginBottom: '1.25rem',
  paddingBottom: '0.75rem',
  borderBottom: '2px solid #e5e7eb'
}

export default function Profile() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [profile, setProfile] = useState({
    full_name: '',
    alias: '',
    gender: '',
    date_of_birth: '',
    province: '',
    club_name: '',
    sadsaa_number: '',
    email: ''
  })

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          alias: data.alias || '',
          gender: data.gender || '',
          date_of_birth: data.date_of_birth || '',
          province: data.province || '',
          club_name: data.club_name || '',
          sadsaa_number: data.angler_number || '',
          email: user.email || ''
        })
      } else {
        // New user - pre-fill email
        setProfile(prev => ({ ...prev, email: user.email || '' }))
      }
    } catch (err) {
      setError('Failed to load profile: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile.full_name.trim()) {
      setError('Full name is required')
      return
    }

    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: profile.full_name.trim(),
          alias: profile.alias.trim() || null,
          gender: profile.gender || null,
          date_of_birth: profile.date_of_birth || null,
          province: profile.province || null,
          club_name: profile.club_name.trim() || null,
          angler_number: profile.sadsaa_number.trim() || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })

      if (error) throw error

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Failed to save profile: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  // Calculate age category for display
  const getAgeCategory = () => {
    if (!profile.date_of_birth) return null
    const today = new Date()
    const dob = new Date(profile.date_of_birth)
    const age = today.getFullYear() - dob.getFullYear() -
      (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
    return age < 21 ? 'Junior (Under 21)' : 'Senior (21 and over)'
  }

  const ageCategory = getAgeCategory()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
        Loading profile...
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ background: 'white', padding: '3rem', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h3>Please log in to view your profile</h3>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>

      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        My Profile
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '0.925rem' }}>
        Complete your profile to enable SADSAA record notifications and competition features.
      </p>

      {/* Profile completion prompt */}
      {(!profile.gender || !profile.date_of_birth) && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fbbf24',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start'
        }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <p style={{ fontWeight: '600', color: '#92400e', marginBottom: '0.25rem' }}>
              Profile incomplete
            </p>
            <p style={{ fontSize: '0.875rem', color: '#78350f' }}>
              Add your gender and date of birth to enable SADSAA record notifications when you log a catch!
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: '#991b1b',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      {/* Success message */}
      {saved && (
        <div style={{
          background: '#dcfce7',
          border: '1px solid #86efac',
          borderRadius: '6px',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: '#166534',
          fontSize: '0.875rem',
          fontWeight: '600'
        }}>
          ✅ Profile saved successfully!
        </div>
      )}

      {/* ── SECTION 1: Account Details ── */}
      <div style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>🔐 Account Details</h2>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
          Private — never shared with other users
        </p>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Email Address</label>
          <input
            type="email"
            value={profile.email}
            disabled
            style={{ ...inputStyle, background: '#f9fafb', color: '#9ca3af' }}
          />
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
            Contact support to change your email address
          </p>
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Full Name *</label>
          <input
            type="text"
            value={profile.full_name}
            onChange={(e) => handleChange('full_name', e.target.value)}
            style={inputStyle}
            placeholder="Your full legal name"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Gender</label>
            <select
              value={profile.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              style={inputStyle}
            >
              <option value="">Select...</option>
              <option value="Men">Men</option>
              <option value="Ladies">Ladies</option>
            </select>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Date of Birth</label>
            <input
              type="date"
              value={profile.date_of_birth}
              onChange={(e) => handleChange('date_of_birth', e.target.value)}
              style={inputStyle}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        {/* Age category indicator */}
        {ageCategory && (
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            color: '#1e40af',
            marginTop: '-0.5rem'
          }}>
            🏆 SADSAA Record Category: <strong>{ageCategory}</strong>
          </div>
        )}
      </div>

      {/* ── SECTION 2: Angler Identity ── */}
      <div style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>🎣 Angler Identity</h2>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
          Your public fishing identity
        </p>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Alias / Handle</label>
          <input
            type="text"
            value={profile.alias}
            onChange={(e) => handleChange('alias', e.target.value)}
            style={inputStyle}
            placeholder="e.g. TunaKing, FalseBayFisher"
            maxLength={30}
          />
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
            This is what others will see instead of your real name
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Province</label>
            <select
              value={profile.province}
              onChange={(e) => handleChange('province', e.target.value)}
              style={inputStyle}
            >
              <option value="">Select province...</option>
              {SA_PROVINCES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Club Name</label>
            <input
              type="text"
              value={profile.club_name}
              onChange={(e) => handleChange('club_name', e.target.value)}
              style={inputStyle}
              placeholder="Your angling club"
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 3: SADSAA Details ── */}
      <div style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>🏆 SADSAA Details</h2>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
          For competition and record purposes
        </p>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>SADSAA Membership Number</label>
          <input
            type="text"
            value={profile.sadsaa_number}
            onChange={(e) => handleChange('sadsaa_number', e.target.value)}
            style={inputStyle}
            placeholder="Optional — enter when available"
          />
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
            SADSAA is establishing a central membership database. Your number will be assigned shortly.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '3rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.875rem 2.5rem',
            background: saving ? '#9ca3af' : '#1e3a8a',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: saving ? 'not-allowed' : 'pointer',
            minWidth: '160px'
          }}
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

    </div>
  )
}
