// ─── CompetitionAdminScoring.jsx ─────────────────────────────────────────────
// Tab 3 — Scoring
// Live catch overview by day, catch entry, verification, full edit including DQ'd.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { calculateCatchPoints } from './utils/scoringEngine'

const NAVY  = '#1e3a8a'
const GREY  = '#6b7280'
const GREEN = '#16a34a'
const RED   = '#dc2626'
const GOLD  = '#d97706'

const S = {
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  input:  { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' },
  select: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', background: 'white', boxSizing: 'border-box' },
  btn:    (bg = NAVY, col = 'white') => ({ background: bg, color: col, border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }),
  badge:  (col) => ({ background: col, color: 'white', padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }),
  section:{ fontWeight: 700, color: NAVY, fontSize: '0.95rem', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid #e5e7eb' },
}

const DQ_COLORS = {
  verified:     GREEN,
  unverified:   GOLD,
  flagged:      '#f59e0b',
  disqualified: RED,
  rejected:     '#9ca3af',
}

export default function CompetitionAdminScoring({
  competition, config, catches, participants, days,
  isAdmin, isScorer, onCatchUpdate,
}) {
  const [dayFilter,  setDayFilter]  = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [search,     setSearch]     = useState('')
  const [editing,    setEditing]    = useState(null)
  const [creating,   setCreating]   = useState(false)
  const [error,      setError]      = useState('')

  const teams = [...new Map(
    participants.filter(p => p.competition_teams)
      .map(p => [p.team_id, p.competition_teams])
  ).values()]

  // ── Filter catches ───────────────────────────────────────────────────────
  const filtered = catches.filter(c => {
    if (dayFilter !== 'all' && c.competition_days?.day_number !== parseInt(dayFilter)) return false
    if (teamFilter !== 'all' && c.competition_teams?.team_name !== teamFilter) return false
    if (search) {
      const name = c.competition_participants?.full_name?.toLowerCase() || ''
      const sp   = (c.species_name || '').toLowerCase()
      if (!name.includes(search.toLowerCase()) && !sp.includes(search.toLowerCase())) return false
    }
    return true
  })

  const totalFish   = filtered.filter(c => c.data_quality !== 'rejected').length
  const totalPoints = filtered.reduce((s, c) =>
    c.data_quality === 'disqualified' || c.data_quality === 'rejected'
      ? s : s + parseFloat(c.points || 0), 0)
  const dqCount     = filtered.filter(c => c.data_quality === 'disqualified').length

  const isLocked = !!competition?.results_published_at

  return (
    <div>
      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div style={{ ...S.card, background: NAVY, color: 'white' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Catches', val: totalFish },
              { label: 'Total Points',  val: totalPoints.toFixed(2) },
              { label: 'DQs',          val: dqCount, color: dqCount > 0 ? '#fca5a5' : 'rgba(255,255,255,0.7)' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontWeight: 700, color: s.color || 'white', fontSize: '1.1rem' }}>{s.val}</div>
              </div>
            ))}
          </div>
          {(isAdmin || isScorer) && !isLocked && (
            <button onClick={() => setCreating(true)}
              style={{ background: GREEN, color: 'white', border: 'none', padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              + Log Catch
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={S.label}>Day</label>
          <select style={S.select} value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
            <option value="all">All Days</option>
            {days.map(d => <option key={d.day_number} value={d.day_number}>Day {d.day_number} — {d.date}</option>)}
          </select>
        </div>
        {teams.length > 0 && (
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={S.label}>Team</label>
            <select style={S.select} value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
              <option value="all">All Teams</option>
              {teams.map(t => <option key={t.id} value={t.team_name}>{t.team_name || t.province}</option>)}
            </select>
          </div>
        )}
        <div style={{ flex: 2, minWidth: 180 }}>
          <label style={S.label}>Search</label>
          <input style={S.input} placeholder="Angler name or species…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* ── Catch cards ─────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ ...S.card, color: GREY, textAlign: 'center', fontStyle: 'italic' }}>
          No catches found for selected filters.
        </div>
      ) : filtered.map(c => {
        const qColor = DQ_COLORS[c.data_quality] || GREY
        const participant = c.competition_participants
        const team = participant?.competition_teams
        return (
          <div key={c.id} style={{ ...S.card, borderLeft: `4px solid ${qColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 700, color: NAVY, display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {c.data_quality === 'disqualified' && <span style={S.badge(RED)}>🚫 DQ</span>}
                  {c.data_quality === 'rejected'     && <span style={S.badge('#9ca3af')}>Rejected</span>}
                  {c.data_quality === 'verified'     && <span style={S.badge(GREEN)}>✓ Verified</span>}
                  {c.species_name}
                  {c.weight_kg && <span style={{ fontWeight: 400, color: GREY }}>{parseFloat(c.weight_kg).toFixed(2)} kg</span>}
                </div>
                <div style={{ fontSize: '0.8rem', color: GREY, marginTop: 2 }}>
                  {participant?.full_name}
                  {team && ` · ${team.team_name || team.province}`}
                  {` · Day ${c.competition_days?.day_number || '?'}`}
                  {c.line_class_kg && ` · ${c.line_class_kg}kg LC`}
                </div>
                {c.notes && (
                  <div style={{ fontSize: '0.78rem', color: GOLD, marginTop: 2, fontStyle: 'italic' }}>
                    📌 {c.notes}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>Points</div>
                  <div style={{ fontWeight: 700, color: c.data_quality === 'disqualified' ? RED : NAVY, fontSize: '1.05rem' }}>
                    {c.data_quality === 'disqualified' ? '0' : parseFloat(c.points || 0).toFixed(2)}
                  </div>
                </div>
                {(isAdmin || isScorer) && !isLocked && (
                  <button onClick={() => setEditing(c)}
                    style={{ ...S.btn(), fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
                    ✏️ Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editing && (
        <CatchEditModal
          catch_={editing}
          config={config}
          participants={participants}
          days={days}
          onSave={() => { setEditing(null); onCatchUpdate() }}
          onClose={() => setEditing(null)}
        />
      )}

      {/* ── New Catch Modal ──────────────────────────────────────────────── */}
      {creating && (
        <NewCatchModal
          competition={competition}
          config={config}
          participants={participants}
          days={days}
          onSave={() => { setCreating(false); onCatchUpdate() }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}

// ── CatchEditModal ────────────────────────────────────────────────────────────
function CatchEditModal({ catch_, config, participants, days, onSave, onClose }) {
  const [form,   setForm]   = useState({
    species_name:   catch_.species_name   || '',
    weight_kg:      catch_.weight_kg      || '',
    length_cm:      catch_.length_cm      || '',
    line_class_kg:  catch_.line_class_kg  || '',
    data_quality:   catch_.data_quality   || 'unverified',
    notes:          catch_.notes          || '',
    retained:       catch_.retained       ?? true,
    scoring:        catch_.scoring        ?? true,
    competition_day_id: catch_.competition_day_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    setSaving(true); setError('')
    // Recalculate points
    const scoringConfig = config?.scoring || {}
    const { points } = calculateCatchPoints({
      scoringConfig,
      weightKg:      parseFloat(form.weight_kg) || 0,
      lineClassKg:   parseInt(form.line_class_kg) || scoringConfig?.line_class?.default_kg || 10,
      fishCount:     1,
      isBillfish:    false,
      isKingfishRelease: false,
      isFirstFish:   true,
    })

    const { error: err } = await supabase
      .from('competition_catches')
      .update({
        ...form,
        weight_kg:     parseFloat(form.weight_kg) || null,
        length_cm:     parseFloat(form.length_cm) || null,
        line_class_kg: parseInt(form.line_class_kg) || null,
        points:        form.data_quality === 'disqualified' ? 0 : points,
        scored_at:     new Date().toISOString(),
      })
      .eq('id', catch_.id)

    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', maxWidth: 600, width: '100%', marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, color: NAVY }}>Edit Catch</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: GREY }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Species</label>
            <input style={S.input} value={form.species_name}
              onChange={e => setForm(f => ({ ...f, species_name: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Weight (kg)</label>
            <input style={S.input} type="number" step="0.001" value={form.weight_kg}
              onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Length (cm)</label>
            <input style={S.input} type="number" step="0.1" value={form.length_cm}
              onChange={e => setForm(f => ({ ...f, length_cm: e.target.value }))} />
          </div>
          {config?.scoring?.line_class?.enabled && (
            <div>
              <label style={S.label}>Line Class (kg)</label>
              <select style={S.select} value={form.line_class_kg}
                onChange={e => setForm(f => ({ ...f, line_class_kg: e.target.value }))}>
                <option value="">— Select —</option>
                {(config.scoring.line_class.available_classes || []).map(lc => (
                  <option key={lc} value={lc}>{lc} kg</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={S.label}>Day</label>
            <select style={S.select} value={form.competition_day_id}
              onChange={e => setForm(f => ({ ...f, competition_day_id: e.target.value }))}>
              {days.map(d => <option key={d.id} value={d.id}>Day {d.day_number} — {d.date}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Data Quality</label>
            <select style={S.select} value={form.data_quality}
              onChange={e => setForm(f => ({ ...f, data_quality: e.target.value }))}>
              <option value="unverified">Unverified</option>
              <option value="verified">Verified</option>
              <option value="flagged">Flagged</option>
              <option value="disqualified">Disqualified (score = 0)</option>
              <option value="rejected">Rejected (excluded)</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Notes</label>
            <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        {error && <div style={{ color: RED, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleSave} disabled={saving} style={S.btn(GREEN)}>
            {saving ? 'Saving…' : '✓ Save Changes'}
          </button>
          <button onClick={onClose} style={S.btn(GREY)}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── NewCatchModal ─────────────────────────────────────────────────────────────
function NewCatchModal({ competition, config, participants, days, onSave, onClose }) {
  const [form,   setForm]   = useState({
    angler_id:      '',
    species_name:   '',
    weight_kg:      '',
    length_cm:      '',
    line_class_kg:  config?.scoring?.line_class?.default_kg || '',
    competition_day_id: days[0]?.id || '',
    notes:          '',
    retained:       true,
  })
  const [preview, setPreview] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  function recalcPreview(updates) {
    const f = { ...form, ...updates }
    if (!f.weight_kg || !f.species_name) { setPreview(null); return }
    const scoringConfig = config?.scoring || {}
    const result = calculateCatchPoints({
      scoringConfig,
      weightKg:    parseFloat(f.weight_kg) || 0,
      lineClassKg: parseInt(f.line_class_kg) || scoringConfig?.line_class?.default_kg || 10,
      fishCount:   1,
      isFirstFish: true,
      isBillfish:  false,
      isKingfishRelease: false,
    })
    setPreview(result)
  }

  function handleChange(key, value) {
    setForm(f => ({ ...f, [key]: value }))
    recalcPreview({ [key]: value })
  }

  async function handleSave() {
    if (!form.angler_id || !form.species_name) { setError('Angler and species are required'); return }
    setSaving(true); setError('')
    const participant = participants.find(p => p.id === form.angler_id)
    const day = days.find(d => d.id === form.competition_day_id)
    const { points } = preview || { points: 0 }

    const { error: err } = await supabase
      .from('competition_catches')
      .insert({
        competition_id:     competition.id,
        competition_day_id: form.competition_day_id,
        angler_id:          form.angler_id,
        team_id:            participant?.team_id || null,
        species_name:       form.species_name.trim(),
        weight_kg:          parseFloat(form.weight_kg) || null,
        length_cm:          parseFloat(form.length_cm) || null,
        line_class_kg:      parseInt(form.line_class_kg) || null,
        fishing_date:       day?.date || null,
        points:             points,
        retained:           form.retained,
        notes:              form.notes.trim() || null,
        data_quality:       'unverified',
        scoring:            true,
      })

    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', maxWidth: 600, width: '100%', marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, color: NAVY }}>Log New Catch</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: GREY }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Angler *</label>
            <select style={S.select} value={form.angler_id}
              onChange={e => handleChange('angler_id', e.target.value)}>
              <option value="">— Select angler —</option>
              {participants
                .filter(p => p.status !== 'disqualified')
                .sort((a, b) => a.full_name.localeCompare(b.full_name))
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}{p.angler_number ? ` (#${p.angler_number})` : ''}
                  </option>
                ))}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Species *</label>
            <input style={S.input} placeholder="Enter species name"
              value={form.species_name}
              onChange={e => handleChange('species_name', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Weight (kg)</label>
            <input style={S.input} type="number" step="0.001"
              value={form.weight_kg}
              onChange={e => handleChange('weight_kg', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Length (cm)</label>
            <input style={S.input} type="number" step="0.1"
              value={form.length_cm}
              onChange={e => handleChange('length_cm', e.target.value)} />
          </div>
          {config?.scoring?.line_class?.enabled && (
            <div>
              <label style={S.label}>Line Class (kg)</label>
              <select style={S.select} value={form.line_class_kg}
                onChange={e => handleChange('line_class_kg', e.target.value)}>
                <option value="">— Select —</option>
                {(config.scoring.line_class.available_classes || []).map(lc => (
                  <option key={lc} value={lc}>{lc} kg</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={S.label}>Day</label>
            <select style={S.select} value={form.competition_day_id}
              onChange={e => handleChange('competition_day_id', e.target.value)}>
              {days.map(d => <option key={d.id} value={d.id}>Day {d.day_number} — {d.date}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Notes</label>
            <input style={S.input} placeholder="Optional notes"
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)} />
          </div>
        </div>

        {/* Points preview */}
        {preview && (
          <div style={{ padding: '0.75rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 700, color: GREEN }}>Points preview: {preview.points.toFixed(2)}</div>
            <div style={{ fontSize: '0.78rem', color: GREY }}>{preview.detail} · {preview.method}</div>
          </div>
        )}

        {error && <div style={{ color: RED, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleSave} disabled={saving || !form.angler_id || !form.species_name}
            style={{ ...S.btn(GREEN), opacity: (!form.angler_id || !form.species_name) ? 0.5 : 1 }}>
            {saving ? 'Logging…' : '✓ Log Catch'}
          </button>
          <button onClick={onClose} style={S.btn(GREY)}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
