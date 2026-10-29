// ─── CompetitionAdminSetup.jsx ────────────────────────────────────────────────
// Tab 1 — Setup
// Competition name, dates, venue, status controls,
// session/day management, rule override log.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import BoatsAndTeams from './BoatsAndTeams'

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

export default function CompetitionAdminSetup({ competition, config, days, boats, teams = [], isAdmin, onReload }) {
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

  // Per-boat fishing session times (Lines In / Lines Up), for record-keeping
  // and fishing-hours tracking. This is informational only for this
  // competition — scoring here is 'points' method (points-per-fish +
  // species/over-line bonuses), not CPUE, so nothing entered here changes
  // the standings.
  const [fishingSessions, setFishingSessions]   = useState([])
  const [loadingSessions, setLoadingSessions]   = useState(true)
  const [expandedDay,     setExpandedDay]       = useState(null)
  const [rescheduleOpenDay, setRescheduleOpenDay] = useState(null) // day.id
  const [rescheduleDate,    setRescheduleDate]    = useState('')
  const [cancelReason,      setCancelReason]      = useState('')
  const [sessionForm,     setSessionForm]       = useState({}) // keyed by session id: { lines_in, lines_up }
  const [savingSession,   setSavingSession]     = useState({}) // keyed by session id

  useEffect(() => {
    if (!competition?.id) return
    loadFishingSessions()
  }, [competition?.id])

  async function loadFishingSessions() {
    setLoadingSessions(true)
    const { data, error: err } = await supabase
      .from('competition_fishing_sessions')
      .select('*')
      .eq('competition_id', competition.id)
    if (!err) setFishingSessions(data || [])
    setLoadingSessions(false)
  }

  // Team name(s) fishing from a boat, for display beside the boat name in
  // Boat Times - e.g. "Alter Ego · Motley Crew". A team with the same name
  // as its boat (e.g. Nenya) isn't repeated.
  function teamNamesForBoat(boatName) {
    const key = n => (n || '').trim().toLowerCase()
    const boat = (boats || []).find(b => key(b.boat_name) === key(boatName))
    if (!boat) return ''
    return (teams || [])
      .filter(t => t.boat_id === boat.id && key(t.team_name) !== key(boatName))
      .map(t => t.team_name + (t.team_suffix ? ` ${t.team_suffix}` : ''))
      .join(', ')
  }

  // One row per boat for a day, in A-Z order by boat name. Built from the
  // competition's CURRENT boats, merged with any saved session rows - not
  // from the saved rows alone. Saved rows are only created when boats are
  // first set up, so a boat added later (e.g. Motley Crew) used to be missing
  // here entirely. A boat with no saved row yet gets a placeholder that is
  // inserted on its first Save. Saved rows for a boat no longer in the list
  // are still shown, so no recorded times are hidden.
  function sessionsForDay(dayNumber) {
    const saved = fishingSessions.filter(s => s.day_number === dayNumber)
    const key = n => (n || '').trim().toLowerCase()
    const savedByName = new Map(saved.map(s => [key(s.boat_name), s]))
    const rows = (boats || []).map(b => savedByName.get(key(b.boat_name)) || {
      id: `new-${dayNumber}-${b.id}`, _new: true, day_number: dayNumber,
      boat_name: b.boat_name, skipper_name: b.skipper_name,
    })
    const boatNames = new Set((boats || []).map(b => key(b.boat_name)))
    for (const s of saved) if (!boatNames.has(key(s.boat_name))) rows.push(s)
    return rows.sort((a, b) => (a.boat_name || '').localeCompare(b.boat_name || '', undefined, { sensitivity: 'base', numeric: true }))
  }

  function fieldFor(session, field) {
    return sessionForm[session.id]?.[field] ?? session[field] ?? ''
  }

  function setField(sessionId, field, value) {
    setSessionForm(f => ({ ...f, [sessionId]: { ...f[sessionId], [field]: value } }))
  }

  // Hours between two "HH:MM" times, same day. Returns null if either is
  // missing/invalid rather than guessing — an incomplete pair shouldn't
  // silently produce a wrong number.
  function computeHours(linesIn, linesUp) {
    if (!linesIn || !linesUp) return null
    const [inH, inM]  = linesIn.split(':').map(Number)
    const [upH, upM]  = linesUp.split(':').map(Number)
    if ([inH, inM, upH, upM].some(Number.isNaN)) return null
    const minutes = (upH * 60 + upM) - (inH * 60 + inM)
    if (minutes < 0) return null // lines-up before lines-in — flag by showing nothing rather than a negative number
    return parseFloat((minutes / 60).toFixed(2))
  }

  async function saveSession(session) {
    const linesIn  = fieldFor(session, 'lines_in')
    const linesUp  = fieldFor(session, 'lines_up')
    const hours    = computeHours(linesIn, linesUp)
    setSavingSession(p => ({ ...p, [session.id]: true }))
    const times = {
      lines_in:      linesIn || null,
      lines_up:      linesUp || null,
      fishing_hours: hours,
      updated_at:    new Date().toISOString(),
    }
    // A boat with no saved row for this day yet (added after setup) gets one
    // created now; otherwise the existing row is updated. .select('id')
    // returns the rows actually written, so a change the database silently
    // refuses is reported instead of looking saved.
    const { data: written, error: err } = session._new
      ? await supabase.from('competition_fishing_sessions')
          .insert({ competition_id: competition.id, day_number: session.day_number,
                    boat_name: session.boat_name, skipper_name: session.skipper_name || null, ...times })
          .select('id')
      : await supabase.from('competition_fishing_sessions')
          .update(times).eq('id', session.id).select('id')
    setSavingSession(p => ({ ...p, [session.id]: false }))
    if (err) { setError(err.message); return }
    if (!written || written.length === 0) { setError(`${session.boat_name}: times NOT saved - the database did not allow the change.`); return }
    setSessionForm(f => { const n = { ...f }; delete n[session.id]; return n })
    await loadFishingSessions()
  }

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

  // Rest day / reschedule — previously required direct SQL (see Malcolm's
  // July 10 rest-day fix). Cancelling marks the day so it's clearly not
  // being fished rather than left looking like a forgotten pending day;
  // rescheduling moves a day's calendar date without touching its
  // day_number, so a "Day 3" that gets rained out and fished a day later
  // is still Day 3, just on the correct date.
  // SADSAA numbers fishing days only (Day 1 = first day actually fished).
  // After a day is cancelled, restored or moved, the days are renumbered in
  // the database (renumber_competition_days) so fishing days stay 1, 2, 3...
  // in date order, together with boat times and day-specific prizes.
  async function renumberDays() {
    const { error: err } = await supabase.rpc('renumber_competition_days', { p_competition_id: competition.id })
    if (err) setError(`Days saved, but they could not be renumbered: ${err.message}`)
  }

  async function handleCancelDay(dayId, reason) {
    setDayLoading(p => ({ ...p, [dayId]: true }))
    const { error: err } = await supabase
      .from('competition_days')
      .update({ cancelled: true, cancellation_reason: reason || 'Rest day', updated_at: new Date().toISOString() })
      .eq('id', dayId)
    setDayLoading(p => ({ ...p, [dayId]: false }))
    if (err) { setError(err.message); return }
    await renumberDays()
    onReload()
  }

  async function handleUncancelDay(dayId) {
    setDayLoading(p => ({ ...p, [dayId]: true }))
    const { error: err } = await supabase
      .from('competition_days')
      .update({ cancelled: false, cancellation_reason: null, updated_at: new Date().toISOString() })
      .eq('id', dayId)
    setDayLoading(p => ({ ...p, [dayId]: false }))
    if (err) { setError(err.message); return }
    await renumberDays()
    onReload()
  }

  async function handleRescheduleDay(dayId, newDate) {
    if (!newDate) return
    setDayLoading(p => ({ ...p, [dayId]: true }))
    const { error: err } = await supabase
      .from('competition_days')
      .update({ date: newDate, updated_at: new Date().toISOString() })
      .eq('id', dayId)
    setDayLoading(p => ({ ...p, [dayId]: false }))
    if (err) { setError(err.message); return }
    await renumberDays()
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
            // Each of these checks an optional *_display_label override
            // first, falling back to the real functional value. Never the
            // other way around - method and team_format are read
            // elsewhere to decide actual scoring/team behaviour
            // (scoreDraftFish dispatches on method === 'weight' exactly;
            // isTeamBased checks team_format !== 'split_boat'), so the
            // real values driving that behaviour are never touched here,
            // only optionally relabelled for this display.
            { label: 'Scoring Method',  value: config?.scoring?.method_display_label || config?.scoring?.method || '—' },
            { label: 'Fishing Days',    value: config?.session?.days || '—' },
            { label: 'Team Format',     value: config?.team?.team_format_display_label || config?.team?.team_format || '—' },
            { label: 'Team Size',       value: config?.team?.team_size_display_label || config?.team?.team_size_min || '—' },
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

      {/* ── Boats & Teams (add / edit / remove) ──────────────────────────── */}
      {isAdmin && (
        <BoatsAndTeams competition={competition} boats={boats} teams={teams}
          onChanged={() => { onReload?.(); loadFishingSessions() }} />
      )}

      {/* ── Day / Session management ─────────────────────────────────────── */}
      {days?.length > 0 && (
        <div style={S.card}>
          <div style={S.section}>Session Management</div>
          <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '0.75rem' }}>
            Lines In / Lines Up times below are for record-keeping and fishing-hours
            tracking only — this competition scores on points-per-fish, so nothing
            entered here affects standings.
          </div>
          {days.map(day => {
            const daySessions = sessionsForDay(day.day_number)
            const isExpanded = expandedDay === day.day_number
            return (
              <div key={day.id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: '0.4rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: day.cancelled ? RED : NAVY }}>{day.cancelled ? 'Cancelled' : `Day ${day.day_number}`}</div>
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
                  {boats?.length > 0 && (
                    <button onClick={() => setExpandedDay(isExpanded ? null : day.day_number)}
                      style={{ ...S.btn(GREY), padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                      {isExpanded ? '▲ Hide Boat Times' : '▼ Boat Times'}
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => {
                      if (rescheduleOpenDay === day.id) { setRescheduleOpenDay(null); return }
                      setRescheduleOpenDay(day.id)
                      setRescheduleDate(day.date || '')
                      setCancelReason(day.cancellation_reason || '')
                    }}
                      style={{ ...S.btn(GREY), padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                      📅 Reschedule / Rest Day
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem', background: '#f8fafc' }}>
                    {loadingSessions ? (
                      <div style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem' }}>Loading…</div>
                    ) : daySessions.length === 0 ? (
                      <div style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem' }}>
                        No session rows found for this day — boats may not have been set up yet.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {daySessions.map(session => {
                          const linesIn  = fieldFor(session, 'lines_in')
                          const linesUp  = fieldFor(session, 'lines_up')
                          const hours    = computeHours(linesIn, linesUp)
                          return (
                            <div key={session.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 0.8fr auto', gap: '0.6rem', alignItems: 'center', background: 'white', borderRadius: 6, padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb' }}>
                              <div>
                                <div style={{ fontWeight: 600, color: NAVY, fontSize: '0.88rem' }}>
                                  {session.boat_name}
                                  {teamNamesForBoat(session.boat_name) && (
                                    <span style={{ fontWeight: 500, color: '#374151' }}> · {teamNamesForBoat(session.boat_name)}</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: GREY }}>{session.skipper_name}</div>
                              </div>
                              <div>
                                <label style={{ ...S.label, marginBottom: 2 }}>Lines In</label>
                                <input type="time" style={{ ...S.input, padding: '0.4rem 0.5rem' }}
                                  value={linesIn}
                                  onChange={e => setField(session.id, 'lines_in', e.target.value)} />
                              </div>
                              <div>
                                <label style={{ ...S.label, marginBottom: 2 }}>Lines Up</label>
                                <input type="time" style={{ ...S.input, padding: '0.4rem 0.5rem' }}
                                  value={linesUp}
                                  onChange={e => setField(session.id, 'lines_up', e.target.value)} />
                              </div>
                              <div style={{ fontSize: '0.85rem', color: GREY, textAlign: 'center' }}>
                                {hours != null ? `${hours}h` : '—'}
                              </div>
                              <button onClick={() => saveSession(session)}
                                disabled={savingSession[session.id]}
                                style={{ ...S.btn(GREEN), padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>
                                {savingSession[session.id] ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {rescheduleOpenDay === day.id && (
                  <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem', background: '#fffbeb' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'end', marginBottom: '0.75rem' }}>
                      <div>
                        <label style={S.label}>Calendar Date</label>
                        <input type="date" style={S.input} value={rescheduleDate}
                          onChange={e => setRescheduleDate(e.target.value)} />
                      </div>
                      <button onClick={() => handleRescheduleDay(day.id, rescheduleDate)}
                        disabled={dayLoading[day.id] || !rescheduleDate}
                        style={{ ...S.btn(NAVY), padding: '0.5rem 1rem', fontSize: '0.82rem' }}>
                        Save Date
                      </button>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: GREY, marginBottom: '0.5rem' }}>
                      Moves this day's calendar date — use this when a day gets rained out and is
                      fished later instead. Days are numbered by fishing day in date order (Day 1 is
                      the first day fished); a cancelled day gets no day number.
                    </div>

                    {day.cancelled ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '0.82rem', color: RED }}>Marked cancelled: {day.cancellation_reason}</span>
                        <button onClick={() => handleUncancelDay(day.id)}
                          disabled={dayLoading[day.id]}
                          style={{ ...S.btn(GREEN), padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}>
                          Un-cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'end' }}>
                        <div>
                          <label style={S.label}>Reason (e.g. "Rest day — weather")</label>
                          <input style={S.input} placeholder="Rest day — weather"
                            value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                        </div>
                        <button onClick={() => handleCancelDay(day.id, cancelReason)}
                          disabled={dayLoading[day.id]}
                          style={{ ...S.btn(RED), padding: '0.5rem 1rem', fontSize: '0.82rem' }}>
                          Mark as Rest Day / Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
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
