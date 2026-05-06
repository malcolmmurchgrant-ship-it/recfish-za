import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const SADSAA_PROVINCES_AND_CLUBS = {
  'Border Deep Sea Angling Association': [
    'Christmasvale Ski-boat Club',
    'East London Ski-boat Club',
    'Gonubie Marine Club',
    'Kwelera Ski-boat Club'
  ],
  'Eastern Province Deep Sea Angling Association': [
    'Diaz Deep Sea Club',
    'Noordhoek Skiboat Club',
    'PE Deep Sea Angling Club',
    'Port Alfred River and Skiboat Club',
    'Port St Francis Ski-boat Yacht Club',
    'St Francis Rod Reel and Boat Club',
    'Vikings Fishing Club'
  ],
  'Free State Deep Sea Angling Association': [
    '101 Ski-boat Club',
    'Bloemfontein Diepsee Hengel Klub',
    'Riemland Skiboot Klub'
  ],
  'Gauteng Deep Sea Angling Association': [
    'Albatross Ski-boat Club',
    'Dorado Ski-boat Club'
  ],
  'Limpopo Deep Sea Angling Association': [
    'Letaba Skiboot Klub',
    'Waterberg Ski-boot Klub'
  ],
  'Mpumalanga Deep Sea Angling Association': [
    'Albatross Deep Sea Angling Club',
    'B.O.L.S. Hengelklub',
    'Dagga Boat Anglers',
    'Hoedspruit Hengel Klub',
    'Koning Makriel Seehengelklub',
    'Lowveld Angling and Boat Association Skiboat',
    'Nelspruit & Distrik Hengelklub',
    'Piet Retief Heyshoop Dam Boat Club',
    'Sea Pike Diepsee Hengelklub',
    'Sodwana Angling Club',
    'Standerton Hengel & Bootklub',
    'Taratibo Skiboot Klub',
    'Umhlanga Ski Boat Club'
  ],
  'Natal Deep Sea Angling Association': [
    'Amanzimtoti Ski-Boat Club',
    'Ballito Ski-boat Club',
    'Bluff Yacht Club',
    'Bobbies Angling Club',
    'Durban Ski-Boat Club',
    'Durban Undersea Club',
    'Glenmore Beach Club',
    'Hibberdene Ski-boat Club',
    'Hibiscus Ski-boat Club',
    'Injambili Ski-Boat Club',
    'Isipingo Beach Ski-boat Club',
    'Marlin Ski-boat and Angling Club',
    'Midlands Ski-boat Club',
    'Mtwalume Ski-Boat Club',
    'Natal Deep Sea Rod and Reel Club',
    'Newcastle Ski-Boat Club',
    'Park Rynie Ski-boat Club',
    'Pennington Ski-boat Club',
    'Point Yacht Club',
    'Pompano Ski-Boat Club',
    'Scottburgh Ski-Boat Club',
    'Shelly Beach Ski-boat Club',
    'Tongaat Westbrook Ski-boat Club',
    'Umdloti Ski-Boat Club',
    'Umhlali Ski-Boat Club',
    'Umhlanga Ski-boat Club',
    'Umkomaas Ski-boat Club',
    'Umzimkulu Deep Sea Angling Club',
    'Vryheid Ski-boat Club',
    'Warnadoon Ski-boat Club',
    'Westbrook Ski-boat Club',
    'Zinkwazi Deep Sea Angling and Boating Club'
  ],
  'North West Deep Sea Angling Association': [
    'Klerksdorp Ski-boat Club',
    'Potchefstroom Hengel Klub',
    'Wesrand Hengel Klub'
  ],
  'Northern Cape Deep Sea Angling Association': [
    'Northern Cape Griqua'
  ],
  'Northern Gauteng Deep Sea Angling Association': [
    'Assembly Deep Sea Angling',
    'Northerns Game Fish Club',
    'Pretoria Deep Sea Angling Club'
  ],
  'Southern Cape Deep Sea Angling Association': [
    'George Deep Sea Angling Club',
    'Knysna Angling and Diving Association',
    'Mossel Bay Yacht and Boat Club',
    'Plettenberg Bay Angling Association',
    'Plettenberg Bay Ski-boat Club'
  ],
  'Southern Gauteng Deep Sea Angling Association': [
    'Albatros Deep Sea Angling Club',
    'East Rand Boat Fishing Club',
    'Guinjata Sports Fishing Club',
    'Makaira Game Fishing Club',
    'Nomads Ski-boat Game Fishing Club',
    'Transvaal Ski-boat Club',
    'Wahoo Ski-Boat Club'
  ],
  'Western Province Deep Sea Angling Association': [
    'Atlantic Boat Club',
    'Cape Boat and Ski-boat Club',
    'False Bay Yacht Club',
    'Gordons Bay Boat Club',
    'Overberg Boat Club',
    'Suidpunt Deep Sea Angling Club',
    'Walker Bay Boat Ski-boat Club',
    'Yzerfontein Boat Angling Club'
  ],
  'Zululand Deep Sea Angling Association': [
    'Cape Vidal Skiboat Club',
    'Mapalane Ski Boat Club',
    'Meerensee Boat Club',
    "Richard's Bay Ski Boat Club",
    'Sodwana Ski Boat Club',
    'St Lucia Ski Boat Club',
    'Umlalazi Ski Boat Club'
  ]
}

const SA_PROVINCES = Object.keys(SADSAA_PROVINCES_AND_CLUBS).sort()

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
  const [clubMemberships, setClubMemberships] = useState([])
  const [addingClub, setAddingClub] = useState(false)
  const [newClub, setNewClub] = useState({ provincial_body: '', club_name: '', member_since: '' })

  const [profile, setProfile] = useState({
    full_name: '',
    alias: '',
    gender: '',
    date_of_birth: '',
    province: '',
    club_name: '',
    sadsaa_number: '',
    email: '',
    // Nomination form fields (Point 3)
    id_number: '',
    sa_citizen: true,
    nationality: '',
    passport_number: '',
    passport_expiry: '',
    club_member_since: '',
    cell_phone: '',
    postal_address: '',
    postal_code: '',
    facets: [],
    medical_notes: '',
  })

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const [{ data, error }, { data: clubs }] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('angler_club_memberships')
          .select('*').eq('user_id', user.id).order('is_primary', { ascending: false })
      ])

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
          email: user.email || '',
          id_number: data.id_number || '',
          sa_citizen: data.sa_citizen !== false,
          nationality: data.nationality || '',
          passport_number: data.passport_number || '',
          passport_expiry: data.passport_expiry || '',
          club_member_since: data.club_member_since || '',
          cell_phone: data.cell_phone || '',
          postal_address: data.postal_address || '',
          postal_code: data.postal_code || '',
          facets: data.facets || [],
          medical_notes: data.medical_notes || '',
        })
      } else {
        setProfile(prev => ({ ...prev, email: user.email || '' }))
      }
      setClubMemberships(clubs || [])
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
          // Nomination form fields
          id_number: profile.id_number.trim() || null,
          sa_citizen: profile.sa_citizen,
          nationality: profile.sa_citizen ? null : (profile.nationality.trim() || null),
          passport_number: profile.passport_number.trim() || null,
          passport_expiry: profile.passport_expiry || null,
          club_member_since: profile.club_member_since || null,
          cell_phone: profile.cell_phone.trim() || null,
          postal_address: profile.postal_address.trim() || null,
          postal_code: profile.postal_code.trim() || null,
          facets: profile.facets.length > 0 ? profile.facets : null,
          medical_notes: profile.medical_notes.trim() || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })

      if (error) throw error

      setSaved(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setTimeout(() => setSaved(false), 5000)
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

  const toggleFacet = (facet) => {
    setProfile(prev => {
      const facets = prev.facets.includes(facet)
        ? prev.facets.filter(f => f !== facet)
        : [...prev.facets, facet]
      return { ...prev, facets }
    })
    setSaved(false)
  }

  const addClubMembership = async () => {
    if (!newClub.provincial_body || !newClub.club_name) {
      setError('Please select a province and club')
      return
    }
    setAddingClub(true)
    const isFirst = clubMemberships.length === 0
    const { error } = await supabase.from('angler_club_memberships').insert({
      user_id: user.id,
      club_name: newClub.club_name,
      provincial_body: newClub.provincial_body,
      member_since: newClub.member_since || null,
      is_primary: isFirst  // first club added is automatically primary
    })
    if (error) { setError('Could not add club: ' + error.message) }
    else {
      setNewClub({ provincial_body: '', club_name: '', member_since: '' })
      const { data } = await supabase.from('angler_club_memberships')
        .select('*').eq('user_id', user.id).order('is_primary', { ascending: false })
      setClubMemberships(data || [])
    }
    setAddingClub(false)
  }

  const setPrimaryClub = async (membershipId) => {
    // Clear all primaries for this user, then set the chosen one
    await supabase.from('angler_club_memberships')
      .update({ is_primary: false }).eq('user_id', user.id)
    await supabase.from('angler_club_memberships')
      .update({ is_primary: true }).eq('id', membershipId)
    const { data } = await supabase.from('angler_club_memberships')
      .select('*').eq('user_id', user.id).order('is_primary', { ascending: false })
    setClubMemberships(data || [])
  }

  const removeClubMembership = async (membershipId, isPrimary) => {
    if (isPrimary && clubMemberships.length > 1) {
      setError('Set another club as primary before removing your primary club.')
      return
    }
    if (!confirm('Remove this club membership?')) return
    await supabase.from('angler_club_memberships').delete().eq('id', membershipId)
    const { data } = await supabase.from('angler_club_memberships')
      .select('*').eq('user_id', user.id).order('is_primary', { ascending: false })
    setClubMemberships(data || [])
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
            <label style={labelStyle}>Provincial Association</label>
            <select
              value={profile.province}
              onChange={(e) => {
                handleChange('province', e.target.value)
                handleChange('club_name', '') // reset club when province changes
              }}
              style={inputStyle}
            >
              <option value="">Select province...</option>
              {SA_PROVINCES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Club</label>
            <select
              value={profile.club_name}
              onChange={(e) => handleChange('club_name', e.target.value)}
              style={{ ...inputStyle, background: profile.province ? 'white' : '#f9fafb' }}
              disabled={!profile.province}
            >
              <option value="">
                {profile.province ? 'Select club...' : 'Select province first'}
              </option>
              {profile.province && (SADSAA_PROVINCES_AND_CLUBS[profile.province] || []).map(club => (
                <option key={club} value={club}>{club}</option>
              ))}
            </select>
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

      {/* ── SECTION 4: Contact Details ── */}
      <div style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>📬 Contact Details</h2>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
          Nomination form Sections 3 &amp; 4 — kept private, shared with SADSAA selectors only
        </p>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Cell Phone</label>
          <input type="tel" value={profile.cell_phone}
            onChange={e => handleChange('cell_phone', e.target.value)}
            style={inputStyle} placeholder="e.g. 082 123 4567" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1rem' }}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Postal Address</label>
            <input type="text" value={profile.postal_address}
              onChange={e => handleChange('postal_address', e.target.value)}
              style={inputStyle} placeholder="Street address or PO Box" />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Postal Code</label>
            <input type="text" value={profile.postal_code}
              onChange={e => handleChange('postal_code', e.target.value)}
              style={inputStyle} placeholder="e.g. 7925" maxLength={10} />
          </div>
        </div>
      </div>

      {/* ── SECTION 5: Identity & Citizenship ── */}
      <div style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>🪪 Identity &amp; Citizenship</h2>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
          Nomination form Section 2 — required for Protea and SADSAA team selection
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>SA ID Number</label>
            <input type="text" value={profile.id_number}
              onChange={e => handleChange('id_number', e.target.value)}
              style={inputStyle} placeholder="13-digit ID number" maxLength={13} />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>South African Citizen?</label>
            <select value={profile.sa_citizen ? 'yes' : 'no'}
              onChange={e => handleChange('sa_citizen', e.target.value === 'yes')}
              style={inputStyle}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        {!profile.sa_citizen && (
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Nationality (if not SA citizen)</label>
            <input type="text" value={profile.nationality}
              onChange={e => handleChange('nationality', e.target.value)}
              style={inputStyle} placeholder="e.g. Zimbabwe" />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Passport Number</label>
            <input type="text" value={profile.passport_number}
              onChange={e => handleChange('passport_number', e.target.value)}
              style={inputStyle} placeholder="Optional — for international travel" />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Passport Expiry Date</label>
            <input type="date" value={profile.passport_expiry}
              onChange={e => handleChange('passport_expiry', e.target.value)}
              style={inputStyle} min={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
      </div>

      {/* ── SECTION 6: Angling Facets ── */}
      <div style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>🎯 Angling Facets</h2>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
          Nomination form — facet of nomination. Select all that apply.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {['Tuna', 'Gamefish', 'Bottomfish', 'Heavy Tackle Billfish', 'Light Tackle Billfish'].map(facet => {
            const active = profile.facets.includes(facet)
            return (
              <button key={facet} onClick={() => toggleFacet(facet)}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '20px', cursor: 'pointer',
                  fontSize: '0.875rem', fontWeight: '600', border: '2px solid',
                  borderColor: active ? '#1e3a8a' : '#d1d5db',
                  background: active ? '#1e3a8a' : 'white',
                  color: active ? 'white' : '#374151',
                  transition: 'all 0.15s'
                }}>
                {active ? '✓ ' : ''}{facet}
              </button>
            )
          })}
        </div>
        {profile.facets.length > 0 && (
          <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.75rem' }}>
            Selected: {profile.facets.join(', ')}
          </p>
        )}
      </div>

      {/* ── SECTION 7: Club Memberships ── */}
      <div style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>🏅 Club Memberships</h2>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
          Nomination form Section 5 — you may belong to multiple clubs. Mark the one through which
          you are domiciled and will nominate as <strong>Primary</strong>.
        </p>

        {/* Current memberships list */}
        {clubMemberships.length > 0 && (
          <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {clubMemberships.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', borderRadius: '6px', flexWrap: 'wrap',
                background: m.is_primary ? '#eff6ff' : '#f9fafb',
                border: `1px solid ${m.is_primary ? '#bfdbfe' : '#e5e7eb'}`
              }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1e3a8a' }}>
                    {m.club_name}
                    {m.is_primary && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', background: '#1e3a8a', color: 'white', borderRadius: '10px', padding: '0.1rem 0.5rem', fontWeight: '600' }}>
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>
                    {m.provincial_body}
                    {m.member_since && ` · Member since ${new Date(m.member_since).getFullYear()} (${Math.floor((new Date() - new Date(m.member_since)) / (1000 * 60 * 60 * 24 * 365.25))} yrs)`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  {!m.is_primary && (
                    <button onClick={() => setPrimaryClub(m.id)}
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', fontWeight: '600', border: '1px solid #bfdbfe', background: 'white', color: '#1e40af', borderRadius: '4px', cursor: 'pointer' }}>
                      Set Primary
                    </button>
                  )}
                  <button onClick={() => removeClubMembership(m.id, m.is_primary)}
                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', fontWeight: '600', border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new club form */}
        <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '6px', padding: '1rem' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
            + Add a club membership
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Provincial Association</label>
              <select value={newClub.provincial_body}
                onChange={e => setNewClub(prev => ({ ...prev, provincial_body: e.target.value, club_name: '' }))}
                style={inputStyle}>
                <option value="">Select province...</option>
                {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Club</label>
              <select value={newClub.club_name}
                onChange={e => setNewClub(prev => ({ ...prev, club_name: e.target.value }))}
                style={{ ...inputStyle, background: newClub.provincial_body ? 'white' : '#f9fafb' }}
                disabled={!newClub.provincial_body}>
                <option value="">{newClub.provincial_body ? 'Select club...' : 'Select province first'}</option>
                {newClub.provincial_body && (SADSAA_PROVINCES_AND_CLUBS[newClub.provincial_body] || []).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Member Since (optional)</label>
              <input type="date" value={newClub.member_since}
                onChange={e => setNewClub(prev => ({ ...prev, member_since: e.target.value }))}
                style={inputStyle} max={new Date().toISOString().split('T')[0]} />
            </div>
            <button onClick={addClubMembership} disabled={addingClub || !newClub.club_name}
              style={{
                padding: '0.75rem 1.25rem', background: addingClub || !newClub.club_name ? '#9ca3af' : '#1e3a8a',
                color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600',
                fontSize: '0.875rem', cursor: addingClub || !newClub.club_name ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}>
              {addingClub ? 'Adding...' : 'Add Club'}
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 8: Medical (Nomination Form Section 8) ── */}
      <div style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>🏥 Medical Information</h2>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
          Nomination form Section 8 — notable health conditions in the past 5 years.
          Kept strictly private and shared only with SADSAA selectors if you nominate.
        </p>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Health Conditions (if any)</label>
          <textarea value={profile.medical_notes}
            onChange={e => handleChange('medical_notes', e.target.value)}
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Leave blank if none. Only complete if you have notable or serious conditions to declare." />
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
