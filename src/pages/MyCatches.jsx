import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Data quality tier config ──────────────────────────────────────────────────
const QUALITY = {
  competition_verified: {
    label: 'Competition',
    badge: '🥇 Competition — TD Verified',
    color: '#92400e',
    bg: '#fef3c7',
    border: '#fcd34d',
    description: 'Officially recorded and signed off by the Tournament Director'
  },
  guided_trip: {
    label: 'Guided Trip',
    badge: '🥈 Guided Trip',
    color: '#1e40af',
    bg: '#dbeafe',
    border: '#93c5fd',
    description: 'Recorded by a named data capturer on a structured outing'
  },
  self_reported: {
    label: 'Personal Log',
    badge: '🥉 Personal Log',
    color: '#374151',
    bg: '#f3f4f6',
    border: '#d1d5db',
    description: 'Self-reported — entered by the angler'
  }
}

// Derive quality tier from existing catch fields
const getQualityTier = (catch_) => {
  if (catch_.is_competition_entry && catch_.verification_status === 'verified') {
    return 'competition_verified'
  }
  if (catch_.official_measurement || catch_.verification_status === 'verified') {
    return 'guided_trip'
  }
  return 'self_reported'
}

export default function MyCatches() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('social')
  const [socialCatches, setSocialCatches] = useState([])
  const [competitionCatches, setCompetitionCatches] = useState([])
  const [claimableRecords, setClaimableRecords] = useState([])
  const [claiming, setClaiming] = useState(false)
  const [claimMessage, setClaimMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, released: 0, totalWeight: 0, competitions: 0 })

  useEffect(() => { if (user) loadAll() }, [user])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([loadSocialCatches(), loadCompetitionCatches(), loadClaimableRecords()])
    setLoading(false)
  }

  const loadSocialCatches = async () => {
    const { data, error } = await supabase
      .from('catches')
      .select(`
        id, caught_at, weight_kg, length_cm, length_type, released, notes,
        photo_url, is_competition_entry, official_measurement,
        verification_status, data_quality,
        species:species_id (
          common_name, catalogue_name, scientific_name, afrikaans_name
        )
      `)
      .eq('user_id', user.id)
      .order('caught_at', { ascending: false })

    if (error) { console.error('Error loading catches:', error); return }

    const data_ = data || []
    setSocialCatches(data_)

    const total = data_.length
    const released = data_.filter(c => c.released).length
    const totalWeight = data_.reduce((s, c) => s + (c.weight_kg || 0), 0)
    setStats(prev => ({ ...prev, total, released, totalWeight: totalWeight.toFixed(1) }))
  }

  const loadCompetitionCatches = async () => {
    const { data, error } = await supabase
      .from('competition_catches')
      .select(`
        id, created_at, fishing_date, weight_kg, length_cm,
        retained, notes, points, species_name, line_class_kg,
        scoring, angler_verified,
        competition:competition_id ( id, name, venue, start_date ),
        day:competition_day_id ( day_number )
      `)
      .eq('angler_id', user.id)
      .eq('scoring', true)
      .order('fishing_date', { ascending: false })

    if (error) { console.error('Error loading competition catches:', error); return }

    const data_ = data || []
    setCompetitionCatches(data_)
    const competitions = new Set(
      data_.map(c => c.competition?.id).filter(Boolean)
    ).size
    setStats(prev => ({ ...prev, competitions }))
  }

  // ── Claimable records ─────────────────────────────────────────────────────
  // Find competition_participants rows whose full_name matches this user's
  // profile name but whose user_id is not yet this user's auth.uid()
  const loadClaimableRecords = async () => {
    // Get the angler's full name from their profile
    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()

    if (!profile?.full_name) return

    // Find participant records with matching name not yet claimed by this
    // user. IMPORTANT: a plain .neq('user_id', user.id) silently drops every
    // genuinely-unclaimed row too — in SQL, NULL != anything evaluates to
    // unknown, not true, so rows with user_id IS NULL (exactly the unclaimed
    // records this is meant to surface, e.g. historical spreadsheet imports
    // where no one has ever linked an account) never match a plain .neq()
    // and were silently excluded. .or() below explicitly includes both
    // "unclaimed" (IS NULL) and "claimed by someone else" (!= me).
    const { data: matches } = await supabase
      .from('competition_participants')
      .select(`
        id, full_name, user_id, category,
        competition:competition_id ( id, name, venue, start_date )
      `)
      .ilike('full_name', profile.full_name.trim())
      .or(`user_id.is.null,user_id.neq.${user.id}`)

    if (!matches || matches.length === 0) return

    // For each match get the catch count. Same fix as
    // CompetitionAdminScoring.jsx / CompetitionAdminParticipants.jsx earlier
    // today: matching on angler_id alone returns zero rows for any
    // unregistered/historically-imported angler, since angler_id is only
    // populated once someone has actually claimed the record — exactly the
    // case we're trying to detect here. participant_id always lines up with
    // competition_participants.id regardless of registration status, so use
    // that as the primary key and only fall back to angler_id if it's
    // actually set (covers competitions scored live, where angler_id may be
    // the reliable link instead).
    const withCounts = await Promise.all(matches.map(async (m) => {
      const query = supabase
        .from('competition_catches')
        .select('id', { count: 'exact', head: true })
        .eq('competition_id', m.competition.id)
      const { count } = m.user_id
        ? await query.eq('angler_id', m.user_id)
        : await query.eq('participant_id', m.id)
      return { ...m, catch_count: count || 0 }
    }))

    setClaimableRecords(withCounts.filter(m => m.catch_count > 0))
  }

  const claimRecord = async (participant) => {
    if (!confirm(
      `Claim ${participant.catch_count} catches from ${participant.competition.name} as ${participant.full_name}?\n\n` +
      `This links your account to this competition record permanently.`
    )) return

    setClaiming(true)
    setClaimMessage('')

    try {
      // 1. Update competition_catches: swap old placeholder UUID for real
      // auth.uid(). Same participant_id/angler_id fallback as above — for
      // historically-imported catches, angler_id is null and matching on it
      // here would silently update zero rows while still reporting success
      // below, leaving every catch permanently orphaned from the claim.
      const catchQuery = supabase
        .from('competition_catches')
        .update({ angler_id: user.id })
        .eq('competition_id', participant.competition.id)
      const { error: catchError } = participant.user_id
        ? await catchQuery.eq('angler_id', participant.user_id)
        : await catchQuery.eq('participant_id', participant.id)

      if (catchError) throw catchError

      // 2. Update competition_participants: link participant row to real auth.uid()
      const { error: partError } = await supabase
        .from('competition_participants')
        .update({ user_id: user.id })
        .eq('id', participant.id)

      if (partError) throw partError

      setClaimMessage(`✅ Successfully claimed ${participant.catch_count} catches from ${participant.competition.name}!`)
      // Reload everything so Competition History tab populates immediately
      await loadAll()
    } catch (err) {
      setClaimMessage('❌ Error: ' + err.message)
    } finally {
      setClaiming(false)
    }
  }

  // ── Delete social catch ────────────────────────────────────────────────────
  const deleteCatch = async (id) => {
    if (!confirm('Delete this catch?')) return
    const { error } = await supabase.from('catches').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    loadSocialCatches()
  }

  // ── CSV download (social) ──────────────────────────────────────────────────
  const downloadCSV = () => {
    const headers = ['Date', 'Species', 'Scientific Name', 'Weight (kg)', 'Length (cm)', 'Released', 'Data Quality', 'Notes']
    const rows = socialCatches.map(c => [
      new Date(c.caught_at).toLocaleDateString('en-ZA'),
      c.species?.catalogue_name || c.species?.common_name || 'Unknown',
      c.species?.scientific_name || '',
      c.weight_kg || '',
      c.length_cm || '',
      c.released ? 'Yes' : 'No',
      QUALITY[c.data_quality || getQualityTier(c)]?.label || 'Personal Log',
      c.notes || ''
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RecFishZA_MyCatches_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── PDF download (social) ──────────────────────────────────────────────────
  const downloadPDF = () => {
    const rows = socialCatches.map((c, i) => {
      const q = QUALITY[c.data_quality || getQualityTier(c)]
      return `
      <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
        <td>${new Date(c.caught_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
        <td><strong>${c.species?.catalogue_name || c.species?.common_name || 'Unknown'}</strong><br/>
            <em style="color:#6b7280;font-size:0.8em">${c.species?.scientific_name || ''}</em></td>
        <td>${c.weight_kg ? c.weight_kg + ' kg' : '—'}</td>
        <td>${c.length_cm ? c.length_cm + ' cm' : '—'}</td>
        <td>${c.released ? '<span style="color:#065f46;background:#d1fae5;padding:2px 6px;border-radius:4px;font-size:0.8em">Released</span>' : '—'}</td>
        <td><span style="color:${q.color};background:${q.bg};padding:2px 6px;border-radius:4px;font-size:0.78em">${q.label}</span></td>
        <td style="color:#6b7280;font-size:0.85em">${c.notes || ''}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><title>My Catches — RecFish ZA</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #1f2937; margin: 24px; }
      h1 { color: #1e3a8a; font-size: 22px; margin-bottom: 4px; }
      .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
      .stats { display: flex; gap: 24px; margin-bottom: 20px; padding: 12px 16px; background: #eff6ff; border-radius: 8px; }
      .stat label { font-size: 11px; color: #6b7280; display: block; }
      .stat span { font-size: 18px; font-weight: bold; color: #1e3a8a; }
      .legend { display: flex; gap: 12px; margin-bottom: 14px; font-size: 11px; }
      .leg { padding: 2px 8px; border-radius: 4px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1e3a8a; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
      td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
      .footer { margin-top: 20px; color: #9ca3af; font-size: 11px; text-align: center; }
      @media print { body { margin: 12px; } }
    </style></head><body>
    <h1>My Catches — RecFish ZA</h1>
    <div class="subtitle">Generated ${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    <div class="stats">
      <div class="stat"><label>Total Catches</label><span>${stats.total}</span></div>
      <div class="stat"><label>Released</label><span>${stats.released}</span></div>
      <div class="stat"><label>Total Weight</label><span>${stats.totalWeight} kg</span></div>
    </div>
    <div class="legend">
      <span class="leg" style="background:#fef3c7;color:#92400e">🥇 Competition — TD Verified</span>
      <span class="leg" style="background:#dbeafe;color:#1e40af">🥈 Guided Trip</span>
      <span class="leg" style="background:#f3f4f6;color:#374151">🥉 Personal Log</span>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Species</th><th>Weight</th><th>Length</th><th>Status</th><th>Quality</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">RecFish ZA • recfish-za.netlify.app</div>
    <script>window.onload = () => window.print()</script>
    </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const TAB_BASE = {
    padding: '0.6rem 1.25rem',
    border: 'none',
    borderBottom: '3px solid transparent',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '0.925rem',
    fontWeight: '600',
    color: '#6b7280',
    transition: 'all 0.15s'
  }
  const TAB_ACTIVE = { ...TAB_BASE, color: '#1e3a8a', borderBottomColor: '#1e3a8a' }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading your catches...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>My Catches</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>Your personal fishing log and competition history</p>
        </div>
        {activeTab === 'social' && socialCatches.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={downloadCSV} style={{ padding: '0.5rem 1rem', background: '#166534', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
              ⬇ CSV
            </button>
            <button onClick={downloadPDF} style={{ padding: '0.5rem 1rem', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
              ⬇ PDF
            </button>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {[
          { label: 'Total Social Catches', value: stats.total, color: '#1e3a8a' },
          { label: 'Released', value: stats.released, color: '#10b981' },
          { label: 'Total Weight', value: `${stats.totalWeight} kg`, color: '#f59e0b' },
          { label: 'Competitions', value: stats.competitions, color: '#7c3aed' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'white', padding: '1.25rem 1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.4rem' }}>{label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Data quality legend */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {Object.values(QUALITY).map(q => (
          <span key={q.label} style={{
            fontSize: '0.78rem', padding: '0.25rem 0.65rem',
            background: q.bg, color: q.color,
            border: `1px solid ${q.border}`, borderRadius: '12px',
            fontWeight: '600'
          }} title={q.description}>
            {q.badge}
          </span>
        ))}
        <span style={{ fontSize: '0.75rem', color: '#9ca3af', alignSelf: 'center', fontStyle: 'italic' }}>
          Hover for details
        </span>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem', display: 'flex', gap: '0' }}>
        <button
          style={activeTab === 'social' ? TAB_ACTIVE : TAB_BASE}
          onClick={() => setActiveTab('social')}
        >
          🎣 Social Catches
          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', background: '#e5e7eb', borderRadius: '10px', padding: '0.1rem 0.45rem' }}>
            {socialCatches.length}
          </span>
        </button>
        <button
          style={activeTab === 'competition' ? TAB_ACTIVE : TAB_BASE}
          onClick={() => setActiveTab('competition')}
        >
          🏆 Competition History
          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', background: '#fef3c7', color: '#92400e', borderRadius: '10px', padding: '0.1rem 0.45rem' }}>
            {competitionCatches.length}
          </span>
        </button>
      </div>

      {/* ── SOCIAL CATCHES TAB ─────────────────────────────────── */}
      {activeTab === 'social' && (
        <>
          {socialCatches.length === 0 ? (
            <div style={{ background: 'white', padding: '3rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎣</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No catches logged yet</h3>
              <p style={{ color: '#6b7280' }}>Start logging your catches to build your fishing history!</p>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              {socialCatches.map((catch_, index) => {
                const tier = catch_.data_quality || getQualityTier(catch_)
                const q = QUALITY[tier]
                return (
                  <div key={catch_.id} style={{ padding: '1.25rem 1.5rem', borderBottom: index < socialCatches.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        {/* Species + badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>
                            {catch_.species?.catalogue_name || catch_.species?.common_name || 'Unknown Species'}
                          </h3>
                          <span style={{
                            fontSize: '0.72rem', padding: '0.2rem 0.55rem',
                            background: q.bg, color: q.color,
                            border: `1px solid ${q.border}`, borderRadius: '10px',
                            fontWeight: '600'
                          }} title={q.description}>
                            {q.badge}
                          </span>
                          {catch_.released && (
                            <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', background: '#d1fae5', color: '#065f46', borderRadius: '10px', fontWeight: '500' }}>
                              ✓ Released
                            </span>
                          )}
                        </div>

                        <p style={{ fontSize: '0.82rem', color: '#9ca3af', fontStyle: 'italic', margin: '0 0 0.65rem' }}>
                          {catch_.species?.scientific_name}
                        </p>

                        <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.875rem', color: '#374151', flexWrap: 'wrap' }}>
                          <div>
                            <strong>Date: </strong>
                            {new Date(catch_.caught_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                          {catch_.weight_kg && <div><strong>Weight: </strong>{catch_.weight_kg} kg</div>}
                          {catch_.length_cm && <div><strong>Length: </strong>{catch_.length_cm} cm ({catch_.length_type || 'TL'})</div>}
                        </div>

                        {catch_.notes && (
                          <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
                            "{catch_.notes}"
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => deleteCatch(catch_.id)}
                        style={{ padding: '0.4rem 0.85rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '500', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => e.target.style.background = '#fecaca'}
                        onMouseLeave={e => e.target.style.background = '#fee2e2'}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── COMPETITION HISTORY TAB ────────────────────────────── */}
      {activeTab === 'competition' && (
        <>
          {/* Verified data notice */}
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '0.85rem 1.1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#78350f', display: 'flex', gap: '0.6rem' }}>
            <span>🥇</span>
            <span>
              <strong>TD-Verified Data.</strong> These catches were officially recorded during SADSAA competitions
              and signed off by the Tournament Director. This is the highest-quality data tier and can be used
              for SADSAA nomination forms (Sections 15, 17 &amp; 18).
            </span>
          </div>

          {/* Claim message feedback */}
          {claimMessage && (
            <div style={{
              padding: '0.85rem 1.1rem', borderRadius: '8px', marginBottom: '1.25rem',
              fontSize: '0.875rem', fontWeight: '600',
              background: claimMessage.startsWith('✅') ? '#dcfce7' : '#fee2e2',
              color: claimMessage.startsWith('✅') ? '#166534' : '#991b1b',
              border: `1px solid ${claimMessage.startsWith('✅') ? '#86efac' : '#fecaca'}`
            }}>
              {claimMessage}
            </div>
          )}

          {/* Claimable records — shown when name matches exist */}
          {claimableRecords.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1e3a8a', marginBottom: '0.6rem' }}>
                🔗 Competition records found matching your name
              </div>
              {claimableRecords.map(record => (
                <div key={record.id} style={{
                  background: 'white', border: '2px solid #fcd34d', borderRadius: '8px',
                  padding: '1rem 1.25rem', marginBottom: '0.75rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap', gap: '0.75rem'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#1e3a8a', fontSize: '0.95rem' }}>
                      {record.competition?.name}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '0.2rem' }}>
                      📍 {record.competition?.venue}
                      {record.competition?.start_date && ` · ${new Date(record.competition.start_date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`}
                      {record.category && ` · ${record.category}`}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: '600', marginTop: '0.3rem' }}>
                      🥇 {record.catch_count} verified catch{record.catch_count !== 1 ? 'es' : ''} waiting to be claimed
                    </div>
                  </div>
                  <button
                    onClick={() => claimRecord(record)}
                    disabled={claiming}
                    style={{
                      padding: '0.6rem 1.25rem', background: claiming ? '#9ca3af' : '#1e3a8a',
                      color: 'white', border: 'none', borderRadius: '6px',
                      fontWeight: '700', fontSize: '0.875rem',
                      cursor: claiming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap'
                    }}>
                    {claiming ? 'Claiming...' : 'Claim My Record'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {competitionCatches.length === 0 ? (
            <div style={{ background: 'white', padding: '3rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No competition catches yet</h3>
              <p style={{ color: '#6b7280' }}>Catches recorded in official SADSAA competitions will appear here once your angler profile is linked to competition entries.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Group by competition */}
              {(() => {
                const grouped = {}
                competitionCatches.forEach(c => {
                  const compName = c.competition?.name || 'Unknown Competition'
                  if (!grouped[compName]) grouped[compName] = { meta: c.competition, catches: [] }
                  grouped[compName].catches.push(c)
                })
                return Object.entries(grouped).map(([compName, group]) => (
                  <div key={compName} style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    {/* Competition header */}
                    <div style={{ background: '#1e3a8a', padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: 'white', fontSize: '1rem' }}>{compName}</div>
                        {group.meta && (
                          <div style={{ fontSize: '0.8rem', color: '#93c5fd', marginTop: '0.15rem' }}>
                            📍 {group.meta.venue}
                            {group.meta.start_date && ` · ${new Date(group.meta.start_date).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' })}`}
                          </div>
                        )}
                      </div>
                      <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '12px', padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontWeight: '700' }}>
                        🥇 {group.catches.length} catch{group.catches.length !== 1 ? 'es' : ''}
                      </span>
                    </div>

                    {/* Catches in this competition */}
                    {group.catches.map((c, i) => (
                      <div key={c.id} style={{ padding: '1rem 1.25rem', borderBottom: i < group.catches.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                              <span style={{ fontWeight: '700', fontSize: '1rem' }}>
                                {c.species_name || 'Unknown Species'}
                              </span>
                              {!c.retained && (
                                <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', background: '#d1fae5', color: '#065f46', borderRadius: '10px', fontWeight: '500' }}>
                                  ✓ Released
                                </span>
                              )}
                              {c.angler_verified && (
                                <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', background: '#ede9fe', color: '#5b21b6', borderRadius: '10px', fontWeight: '500' }}>
                                  ✓ Angler Verified
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem', color: '#374151', flexWrap: 'wrap' }}>
                              {c.fishing_date && (
                                <div>
                                  <strong>{c.day?.day_number ? `Day ${c.day.day_number}: ` : ''}</strong>
                                  {new Date(c.fishing_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </div>
                              )}
                              {c.weight_kg && <div><strong>Weight: </strong>{c.weight_kg} kg</div>}
                              {c.length_cm && <div><strong>Length: </strong>{c.length_cm} cm</div>}
                              {c.line_class_kg && <div><strong>Line: </strong>{c.line_class_kg} kg</div>}
                              {c.points > 0 && (
                                <div style={{ color: '#d97706', fontWeight: '600' }}>
                                  ★ {c.points} pts
                                </div>
                              )}
                            </div>
                            {c.notes && (
                              <p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#6b7280', fontStyle: 'italic' }}>
                                "{c.notes}"
                              </p>
                            )}
                          </div>
                          <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: '10px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            🥇 TD Verified
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}
