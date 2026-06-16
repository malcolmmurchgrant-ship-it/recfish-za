// ─── CompetitionAdminParticipants.jsx ────────────────────────────────────────
// Tab 2 — Participants
// Angler registration, team assignment, boat draw, line class, DQ management.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const NAVY = '#1e3a8a'
const GREY = '#6b7280'
const GREEN = '#16a34a'
const RED = '#dc2626'
const GOLD = '#d97706'

const S = {
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  input:  { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' },
  select: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', background: 'white', boxSizing: 'border-box' },
  btn:    (bg = NAVY, col = 'white') => ({ background: bg, color: col, border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }),
  badge:  (col) => ({ background: col, color: 'white', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, display: 'inline-block' }),
  section:{ fontWeight: 700, color: NAVY, fontSize: '0.95rem', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid #e5e7eb' },
}

export default function CompetitionAdminParticipants({ competition, config, isAdmin, isScorer }) {
  const [participants, setParticipants]   = useState([])
  const [teams,        setTeams]          = useState([])
  const [loading,      setLoading]        = useState(true)
  const [activeTab,    setActiveTab]      = useState('anglers')
  const [search,       setSearch]         = useState('')
  const [dqModal,      setDqModal]        = useState(null)   // participant to DQ
  const [dqReason,     setDqReason]       = useState('')
  const [saving,       setSaving]         = useState(false)
  const [error,        setError]          = useState('')

  // New angler registration state
  const [addingAngler, setAddingAngler]   = useState(false)
  const [newAngler,    setNewAngler]      = useState({
    full_name: '', angler_number: '', team_id: '', line_class_kg: '', category: 'open', is_captain: false,
  })

  useEffect(() => { 
    console.log('Participants: competition prop =', competition?.id, competition?.name)
    if (competition?.id) load() 
  }, [competition?.id])

  async function load() {
    if (!competition?.id) { console.log('load() skipped — no competition.id'); return }
    console.log('load() called with competition.id =', competition.id)
    setLoading(true)
    const [{ data: parts }, { data: tms }] = await Promise.all([
      supabase.from('competition_participants')
        .select('*, competition_teams(id, team_name, province, team_type)')
        .eq('competition_id', competition.id)
        .order('full_name'),
      supabase.from('competition_teams')
        .select('*')
        .eq('competition_id', competition.id)
        .order('team_name'),
    ])
    setParticipants(parts || [])
    setTeams(tms || [])
    setLoading(false)
  }

  // ── Add angler ────────────────────────────────────────────────────────────
  async function handleAddAngler() {
    setSaving(true); setError('')
    const { error: err } = await supabase
      .from('competition_participants')
      .insert({
        competition_id: competition.id,
        full_name:      newAngler.full_name.trim(),
        angler_number:  newAngler.angler_number.trim() || null,
        team_id:        newAngler.team_id || null,
        line_class_kg:  newAngler.line_class_kg ? parseInt(newAngler.line_class_kg) : null,
        category:       newAngler.category,
        is_captain:     newAngler.is_captain,
        status:         'registered',
      })
    if (err) { setError(err.message); setSaving(false); return }
    setNewAngler({ full_name: '', angler_number: '', team_id: '', line_class_kg: '', category: 'open', is_captain: false })
    setAddingAngler(false)
    setSaving(false)
    // Small delay to ensure DB write is committed before re-fetching
    setTimeout(() => load(), 300)
  }

  // ── DQ angler ─────────────────────────────────────────────────────────────
  async function handleDQ() {
    if (!dqReason.trim()) { setError('Please enter a DQ reason'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase
      .from('competition_participants')
      .update({ status: 'disqualified', notes: dqReason.trim() })
      .eq('id', dqModal.id)
    if (err) { setError(err.message); setSaving(false); return }
    // Also zero all their catches
    await supabase
      .from('competition_catches')
      .update({ data_quality: 'disqualified', scoring: false })
      .eq('competition_id', competition.id)
      .eq('angler_id', dqModal.id)
    setSaving(false)
    setDqModal(null)
    setDqReason('')
    load()
  }

  // ── Reinstate DQ'd angler ─────────────────────────────────────────────────
  async function handleReinstate(participant) {
    await supabase
      .from('competition_participants')
      .update({ status: 'registered', notes: null })
      .eq('id', participant.id)
    await supabase
      .from('competition_catches')
      .update({ data_quality: 'unverified', scoring: true })
      .eq('competition_id', competition.id)
      .eq('angler_id', participant.id)
    load()
  }

  const lineClasses = config?.scoring?.line_class?.available_classes || []
  const hasLineClass = config?.scoring?.line_class?.enabled
  const hasTeams = config?.team?.has_teams

  const filtered = participants.filter(p =>
    !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.angler_number?.includes(search)
  )

  const isDQ = p => p.status === 'disqualified'

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: GREY }}>Loading participants…</div>

  return (
    <div>
      {/* ── Sub-tabs ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        {[
          { id: 'anglers', label: `👤 Anglers (${participants.length})` },
          hasTeams && { id: 'teams', label: `🏆 Teams (${teams.length})` },
        ].filter(Boolean).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, padding: '0.6rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: activeTab === t.id ? NAVY : 'white', color: activeTab === t.id ? 'white' : '#374151' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Anglers tab ─────────────────────────────────────────────────── */}
      {activeTab === 'anglers' && (
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input style={{ ...S.input, flex: 1, minWidth: 200 }}
              placeholder="Search by name or angler number…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {isAdmin && (
              <button onClick={() => setAddingAngler(!addingAngler)} style={S.btn(GREEN)}>
                + Add Angler
              </button>
            )}
          </div>

          {/* Add angler form */}
          {addingAngler && isAdmin && (
            <div style={{ ...S.card, border: '2px solid #86efac' }}>
              <div style={S.section}>Register Angler</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={S.label}>Full Name *</label>
                  <input style={S.input} placeholder="First Last"
                    value={newAngler.full_name}
                    onChange={e => setNewAngler(a => ({ ...a, full_name: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Angler Number</label>
                  <input style={S.input} placeholder="e.g. A01"
                    value={newAngler.angler_number}
                    onChange={e => setNewAngler(a => ({ ...a, angler_number: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                {hasTeams && (
                  <div>
                    <label style={S.label}>Team</label>
                    <select style={S.select} value={newAngler.team_id}
                      onChange={e => setNewAngler(a => ({ ...a, team_id: e.target.value }))}>
                      <option value="">— No team —</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.team_name || t.province}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={S.label}>Category</label>
                  <select style={S.select} value={newAngler.category}
                    onChange={e => setNewAngler(a => ({ ...a, category: e.target.value }))}>
                    <option value="open">Open</option>
                    <option value="junior">Junior</option>
                    <option value="ladies">Ladies</option>
                    <option value="senior">Senior</option>
                  </select>
                </div>
                {hasLineClass && lineClasses.length > 0 && (
                  <div>
                    <label style={S.label}>Line Class (kg)</label>
                    <select style={S.select} value={newAngler.line_class_kg}
                      onChange={e => setNewAngler(a => ({ ...a, line_class_kg: e.target.value }))}>
                      <option value="">— Select —</option>
                      {lineClasses.map(lc => <option key={lc} value={lc}>{lc} kg</option>)}
                    </select>
                  </div>
                )}
                {hasTeams && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.6rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input type="checkbox" checked={newAngler.is_captain}
                        onChange={e => setNewAngler(a => ({ ...a, is_captain: e.target.checked }))} />
                      Team Captain
                    </label>
                  </div>
                )}
              </div>
              {error && <div style={{ color: RED, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleAddAngler} disabled={saving || !newAngler.full_name}
                  style={{ ...S.btn(GREEN), opacity: !newAngler.full_name ? 0.5 : 1 }}>
                  {saving ? 'Registering…' : '✓ Register'}
                </button>
                <button onClick={() => setAddingAngler(false)} style={S.btn(GREY)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Participant list */}
          {filtered.length === 0 ? (
            <div style={{ ...S.card, color: GREY, textAlign: 'center', fontStyle: 'italic' }}>
              {search ? 'No anglers match your search.' : 'No anglers registered yet.'}
            </div>
          ) : filtered.map(p => (
            <div key={p.id} style={{ ...S.card, borderLeft: `4px solid ${isDQ(p) ? RED : GREEN}`, opacity: isDQ(p) ? 0.75 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: NAVY, display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {isDQ(p) && <span style={S.badge(RED)}>🚫 DQ</span>}
                    {p.is_captain && <span style={S.badge(GOLD)}>© Captain</span>}
                    {p.full_name}
                    {p.angler_number && <span style={{ color: GREY, fontWeight: 400, fontSize: '0.85rem' }}>#{p.angler_number}</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: GREY, marginTop: 2 }}>
                    {p.competition_teams?.team_name || p.competition_teams?.province || ''}
                    {p.category && ` · ${p.category}`}
                    {p.line_class_kg && ` · ${p.line_class_kg}kg LC`}
                  </div>
                  {isDQ(p) && p.notes && (
                    <div style={{ fontSize: '0.78rem', color: RED, marginTop: 2 }}>Reason: {p.notes}</div>
                  )}
                </div>
                {(isAdmin || isScorer) && (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {!isDQ(p) ? (
                      <button onClick={() => setDqModal(p)}
                        style={{ ...S.btn(RED), padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                        🚫 DQ
                      </button>
                    ) : isAdmin && (
                      <button onClick={() => handleReinstate(p)}
                        style={{ ...S.btn(GREEN), padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                        ↩ Reinstate
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Teams tab ───────────────────────────────────────────────────── */}
      {activeTab === 'teams' && hasTeams && (
        <div>
          {teams.length === 0 ? (
            <div style={{ ...S.card, color: GREY, textAlign: 'center', fontStyle: 'italic' }}>No teams configured yet.</div>
          ) : teams.map(team => {
            const members = participants.filter(p => p.team_id === team.id)
            const dqCount = members.filter(p => isDQ(p)).length
            return (
              <div key={team.id} style={{ ...S.card, borderLeft: `4px solid ${team.is_disqualified ? RED : NAVY}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: NAVY }}>
                      {team.display_name || `${team.team_name}${team.team_suffix ? ` ${team.team_suffix}` : ''}`}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: GREY }}>{members.length} members · {dqCount > 0 ? `${dqCount} DQ'd` : 'All eligible'}</div>
                  </div>
                  {team.is_disqualified && <span style={S.badge(RED)}>Team DQ</span>}
                </div>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', background: '#f8fafc', borderRadius: 5, marginBottom: '0.25rem' }}>
                    <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: m.is_captain ? 700 : 400 }}>
                      {m.full_name}{m.is_captain ? ' ©' : ''}
                      {m.angler_number && <span style={{ color: GREY, fontWeight: 400 }}> #{m.angler_number}</span>}
                    </div>
                    {isDQ(m) && <span style={S.badge(RED)}>DQ</span>}
                    {m.line_class_kg && <span style={{ fontSize: '0.78rem', color: GREY }}>{m.line_class_kg}kg</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* ── DQ Modal ────────────────────────────────────────────────────── */}
      {dqModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', maxWidth: 420, width: '100%' }}>
            <div style={{ fontWeight: 700, color: RED, fontSize: '1.05rem', marginBottom: '0.5rem' }}>🚫 Disqualify Angler</div>
            <div style={{ color: NAVY, fontWeight: 600, marginBottom: '0.75rem' }}>{dqModal.full_name}</div>
            <div style={{ fontSize: '0.82rem', color: GREY, marginBottom: '0.75rem' }}>
              All catches will be retained but scored as 0 points. This action can be reversed by an admin.
            </div>
            <label style={S.label}>Reason for disqualification *</label>
            <textarea style={{ ...S.input, minHeight: 80, marginBottom: '0.75rem', resize: 'vertical' }}
              placeholder="Enter DQ reason…"
              value={dqReason} onChange={e => setDqReason(e.target.value)} />
            {error && <div style={{ color: RED, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleDQ} disabled={saving || !dqReason.trim()}
                style={{ ...S.btn(RED), opacity: !dqReason.trim() ? 0.5 : 1 }}>
                {saving ? 'Processing…' : '🚫 Confirm DQ'}
              </button>
              <button onClick={() => { setDqModal(null); setDqReason(''); setError('') }} style={S.btn(GREY)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
