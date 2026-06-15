// ─── CompetitionAdminSetup.jsx ────────────────────────────────────────────────
// Tab 1 — Setup
// Competition name, dates, venue, status controls,
// session/day management, rule override log.

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const NAVY = '#1e3a8a'
const GREY = '#6b7280'
const GREEN = '#16a34a'
const RED = '#dc2626'
const GOLD = '#d97706'

const S = {
  card:    { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label:   { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  input:   { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' },
  select:  { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', background: 'white', boxSizing: 'border-box' },
  btn:     (bg = NAVY, col = 'white') => ({ background: bg, color: col, border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }),
  badge:   (col) => ({ background: col, color: 'white', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }),
  row:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' },
  section: { fontWeight: 700, color: NAVY, fontSize: '0.95rem', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid #e5e7eb' },
}

const STATUS_COLORS = {
  draft:       GREY,
  open:        GOLD,
  in_progress: GREEN,
  completed:   NAVY,
  archived:    '#9ca3af',
}

const STATUS_LABELS = {
  draft:       'Draft',
  open:        'Open — Registration',
  in_progress: 'In Progress',
  completed:   'Completed',
  archived:    'Archived',
}

export default function CompetitionAdminSetup({ competition, config, days, isAdmin, onReload }) {
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [form,     setForm]     = useState({
    name:       competition?.name       || '',
    short_name: competition?.short_name || '',
    venue:      competition?.venue      || '',
    start_date: competition?.start_date || '',
    end_date:   competition?.end_date   || '',
    status:     competition?.status     || 'draft',
    visibility: competition?.visibility || 'club',
    description:competition?.description|| '',
  })

  // Day session state
  const [dayAction,  setDayAction]  = useState({})
  const [dayLoading, setDayLoading] = useState({})

  if (!competition) return null

  // ── Save competition details ──────────────────────────────────────────────
  async function handleSave() {
    setSaving(true); setError('')
    const { error: err } = await supabase
      .from('competitions')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', competition.id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    setEditing(false)
    onReload()
  }

  // ── Advance competition status ────────────────────────────────────────────
  async function advanceStatus(newStatus) {
    setSaving(true); setError('')
    const updates = { status: newStatus }
    if (newStatus === 'in_progress' && !competition.pinned_config) {
      // Pin the template config at competition start
      const toPin = {
        session:   config.session,
        scoring:   config.scoring,
        species:   config.species,
        team:      config.team,
        reporting: config.reporting,
        pinned_at: new Date().toISOString(),
      }
      updates.pinned_config = toPin
    }
    if (newStatus === 'completed') {
      updates.results_published_at = new Date().toISOString()
    }
    const { error: err } = await supabase
      .from('competitions')
      .update(updates)
      .eq('id', competition.id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    onReload()
  }

  // ── Day session controls ──────────────────────────────────────────────────
  async function updateDayStatus(dayId, newStatus) {
    setDayLoading(p => ({ ...p, [dayId]: true }))
    const { error: err } = await supabase
      .from('competition_days')
      .update({ session_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', dayId)
    setDayLoading(p => ({ ...p, [dayId]: false }))
    if (err) { setError(err.message); return }
    onReload()
  }

  const status      = competition.status || 'draft'
  const isLocked    = !!competition.results_published_at
  const ruleOverrides = competition.rule_overrides || []

  return (
    <div>
      {/* ── Competition header ─────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: NAVY }}>{competition.name}</div>
            <div style={{ fontSize: '0.85rem', color: GREY, marginTop: 2 }}>
              {competition.venue} · {competition.start_date} – {competition.end_date}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={S.badge(STATUS_COLORS[status] || GREY)}>
              {STATUS_LABELS[status] || status}
            </span>
            {isAdmin && !isLocked && (
              <button onClick={() => setEditing(!editing)} style={S.btn()}>
                {editing ? 'Cancel' : '✏️ Edit'}
              </button>
            )}
          </div>
        </div>

        {/* Status workflow buttons */}
        {isAdmin && !isLocked && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {status === 'draft' && (
              <button onClick={() => advanceStatus('open')} style={S.btn(GOLD)}>
                → Open Registration
              </button>
            )}
            {status === 'open' && (
              <button onClick={() => advanceStatus('in_progress')} style={S.btn(GREEN)}>
                → Start Competition
              </button>
            )}
            {status === 'in_progress' && (
              <button onClick={() => advanceStatus('completed')} style={S.btn(NAVY)}>
                → Complete &amp; Publish Results
              </button>
            )}
            {status === 'completed' && (
              <button onClick={() => advanceStatus('archived')} style={S.btn(GREY)}>
                → Archive
              </button>
            )}
          </div>
        )}
        {isLocked && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#f0fdf4', borderRadius: 6, fontSize: '0.82rem', color: GREEN, border: '1px solid #86efac' }}>
            ✅ Results published {new Date(competition.results_published_at).toLocaleString('en-ZA')} — results are locked
          </div>
        )}
        {error && <div style={{ color: RED, fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</div>}
      </div>

      {/* ── Edit form ─────────────────────────────────────────────────────── */}
      {editing && isAdmin && (
        <div style={S.card}>
          <div style={S.section}>Edit Competition Details</div>
          <div style={S.row}>
            <div>
              <label style={S.label}>Competition Name</label>
              <input style={S.input} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Short Name</label>
              <input style={S.input} value={form.short_name}
                onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={S.label}>Venue</label>
            <input style={S.input} value={form.venue}
              onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
          </div>
          <div style={S.row}>
            <div>
              <label style={S.label}>Start Date</label>
              <input style={S.input} type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>End Date</label>
              <input style={S.input} type="date" value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div style={S.row}>
            <div>
              <label style={S.label}>Visibility</label>
              <select style={S.select} value={form.visibility}
                onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}>
                <option value="private">Private — invite only</option>
                <option value="club">Club — members only</option>
                <option value="public">Public — all app users</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Status</label>
              <select style={S.select} value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={S.label}>Description</label>
            <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleSave} disabled={saving} style={S.btn(GREEN)}>
              {saving ? 'Saving…' : '✓ Save Changes'}
            </button>
            <button onClick={() => setEditing(false)} style={S.btn(GREY)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Template / Config summary ─────────────────────────────────────── */}
      <div style={S.card}>
        <div style={S.section}>Competition Configuration</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Scoring Method',  value: config?.scoring?.method || '—' },
            { label: 'Fishing Days',    value: config?.session?.days || '—' },
            { label: 'Team Format',     value: config?.team?.team_format || '—' },
            { label: 'Team Size',       value: config?.team?.team_size_min || '—' },
            { label: 'Line Classes',    value: config?.scoring?.line_class?.enabled ? config?.scoring?.line_class?.available_classes?.join(', ') + ' kg' : 'Not used' },
            { label: 'Species Bonus',   value: config?.scoring?.species_bonus_points ? `${config.scoring.species_bonus_points} pts` : '—' },
            { label: 'Photo Release',   value: config?.scoring?.allow_photo_measure_release ? 'Enabled' : 'Disabled' },
            { label: 'Skipper Comp',    value: config?.scoring?.skipper_competition ? 'Yes' : 'No' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#f8fafc', borderRadius: 6, padding: '0.6rem 0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: GREY, textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
              <div style={{ fontWeight: 600, color: NAVY, marginTop: 2, fontSize: '0.9rem' }}>{String(value)}</div>
            </div>
          ))}
        </div>
        {competition.pinned_config && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: GREY }}>
            ℹ Config pinned at competition start — template changes do not affect this competition.
            Pinned: {new Date(competition.pinned_config.pinned_at).toLocaleString('en-ZA')}
          </div>
        )}
      </div>

      {/* ── Day / Session management ─────────────────────────────────────── */}
      {days?.length > 0 && (
        <div style={S.card}>
          <div style={S.section}>Session Management</div>
          {days.map(day => (
            <div key={day.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: NAVY }}>Day {day.day_number}</div>
                <div style={{ fontSize: '0.8rem', color: GREY }}>
                  {day.date} · {day.fishing_start_time} – {day.fishing_end_time}
                  {day.cancelled && <span style={{ color: RED, marginLeft: 6 }}>CANCELLED — {day.cancellation_reason}</span>}
                </div>
              </div>
              <span style={S.badge(
                day.session_status === 'open'      ? GREEN :
                day.session_status === 'closed'    ? NAVY  :
                day.session_status === 'finalised' ? '#7c3aed' : GREY
              )}>
                {day.session_status || 'setup'}
              </span>
              {isAdmin && !isLocked && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {day.session_status !== 'open' && (
                    <button onClick={() => updateDayStatus(day.id, 'open')}
                      disabled={dayLoading[day.id]}
                      style={{ ...S.btn(GREEN), padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                      Open
                    </button>
                  )}
                  {day.session_status === 'open' && (
                    <button onClick={() => updateDayStatus(day.id, 'closed')}
                      disabled={dayLoading[day.id]}
                      style={{ ...S.btn(NAVY), padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                      Close
                    </button>
                  )}
                  {day.session_status === 'closed' && (
                    <button onClick={() => updateDayStatus(day.id, 'finalised')}
                      disabled={dayLoading[day.id]}
                      style={{ ...S.btn('#7c3aed'), padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                      Finalise
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Rule override log ────────────────────────────────────────────── */}
      {ruleOverrides.length > 0 && (
        <div style={S.card}>
          <div style={S.section}>Mid-Competition Rule Overrides</div>
          {ruleOverrides.map((ov, i) => (
            <div key={i} style={{ padding: '0.6rem 0.75rem', border: '1px solid #fcd34d', borderRadius: 6, marginBottom: '0.4rem', background: '#fffbeb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem' }}>
                <span style={{ fontWeight: 600, color: GOLD }}>{ov.description}</span>
                <span style={{ fontSize: '0.75rem', color: GREY }}>
                  {new Date(ov.timestamp).toLocaleString('en-ZA')}
                </span>
              </div>
              {ov.changed_fields && (
                <div style={{ fontSize: '0.78rem', color: GREY, marginTop: 2 }}>
                  Fields: {Object.keys(ov.changed_fields).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
