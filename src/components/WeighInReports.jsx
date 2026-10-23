// ─── WeighInReports.jsx ──────────────────────────────────────────────────────
// "Who has reported?" for one fishing day: every team/boat shown as Weighed,
// No catch (skipper or captain reported nothing to weigh) or Not reported.
// Used on the public Scoreboard and the admin Scoreboard tab. Reads the raw
// catch rows, including No Catch records (see utils/noCatch.js).

import { useMemo, useState } from 'react'
import { buildReportStatus, teamReportStatus, defaultReportDay } from '../utils/noCatch'
import { teamBoatLabel } from '../utils/teamLabels'

const NAVY = '#1e3a8a'
const GREY = '#6b7280'

const STATES = [
  { key: 'not_reported', label: 'Not reported', icon: '⏳', bg: '#fef2f2', border: '#fca5a5', col: '#b91c1c' },
  { key: 'no_catch',     label: 'No catch',     icon: '🚫', bg: '#f3f4f6', border: '#d1d5db', col: '#374151' },
  { key: 'weighed',      label: 'Weighed',      icon: '✅', bg: '#f0fdf4', border: '#86efac', col: '#15803d' },
]

export default function WeighInReports({ catches = [], participants = [], teams = [], boats = [], days = [] }) {
  const reportable = useMemo(() => [...days].filter(d => !d.cancelled).sort((a, b) => (a.day_number || 0) - (b.day_number || 0)), [days])
  const [dayId, setDayId] = useState(() => defaultReportDay(days)?.id || '')
  const [open, setOpen] = useState(true)

  const day = reportable.find(d => d.id === dayId) || defaultReportDay(days)
  const status = useMemo(() => buildReportStatus(catches, participants, days), [catches, participants, days])

  const activeTeams = teams.filter(t => !t.is_disqualified)
  if (!day || activeTeams.length === 0) return null

  const rows = activeTeams
    .map(t => ({ team: t, label: teamBoatLabel(t, boats), state: teamReportStatus(status, t, participants, day.id) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const byState = Object.fromEntries(STATES.map(s => [s.key, rows.filter(r => r.state === s.key)]))

  return (
    <div data-testid="weigh-in-reports" style={{ background: 'white', borderRadius: 8, padding: '0.85rem 1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, color: NAVY, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
          ⚖️ Weigh-in reports {open ? '▲' : '▼'}
        </div>
        <select value={day.id} onChange={e => setDayId(e.target.value)}
          style={{ padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.82rem', background: 'white' }}>
          {reportable.map(d => <option key={d.id} value={d.id}>Day {d.day_number}{d.date ? ` — ${d.date}` : ''}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {STATES.map(s => (
            <span key={s.key} data-testid={`count-${s.key}`} style={{ fontSize: '0.78rem', fontWeight: 700, color: s.col, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: '0.15rem 0.6rem' }}>
              {s.icon} {byState[s.key].length} {s.label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>
      {open && (
        <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.5rem' }}>
          {STATES.map(s => byState[s.key].length > 0 && (
            <div key={s.key}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{s.icon} {s.label}</div>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {byState[s.key].map(r => (
                  <span key={r.team.id} style={{ fontSize: '0.78rem', color: s.col, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: '0.15rem 0.5rem' }}>{r.label}</span>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: '0.72rem', color: GREY }}>
            A team counts as reported once any of its anglers has a catch, a release or a No Catch recorded in the Catch Logger for that day.
          </div>
        </div>
      )}
    </div>
  )
}
