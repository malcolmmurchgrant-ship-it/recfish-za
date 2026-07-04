// ─── CompetitionAdminScoreboard.jsx ──────────────────────────────────────────
// Tab 4 — Scoreboard
// Embedded live scoreboard with admin controls.
// Delegates to UniversalScoreboard when it's built (Phase 4).
// For now renders standings directly from catches + participants.

import { useState, useMemo } from 'react'
import { buildIndividualStandings, aggregateTeamScores } from './utils/scoringEngine'

const NAVY  = '#1e3a8a'
const GREY  = '#6b7280'
const GREEN = '#16a34a'
const GOLD  = '#d97706'
const RED   = '#dc2626'

const S = {
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  select: { padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.88rem', background: 'white' },
  btn:    (bg = NAVY, col = 'white', active = true) => ({ background: active ? bg : '#f3f4f6', color: active ? col : '#374151', border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }),
  badge:  (col) => ({ background: col, color: 'white', padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }),
}

const RANK_COLORS = { 1: GOLD, 2: '#9ca3af', 3: '#b45309' }

export default function CompetitionAdminScoreboard({
  competition, config, catches, participants, teams, isAdmin, onSelectAngler,
}) {
  const [viewMode,        setViewMode]        = useState('individual')
  const [showPending,     setShowPending]      = useState(true)
  const [categoryFilter,  setCategoryFilter]   = useState('all')

  // ── Build standings ──────────────────────────────────────────────────────
  const activeCatches = useMemo(() =>
    catches.filter(c => showPending ? c.data_quality !== 'rejected' : c.data_quality === 'verified'),
    [catches, showPending]
  )

  const individualStandings = useMemo(() =>
    buildIndividualStandings(activeCatches, participants),
    [activeCatches, participants]
  )

  const filteredStandings = useMemo(() => {
    if (categoryFilter === 'all') return individualStandings
    return individualStandings
      .filter(s => s.category === categoryFilter)
      .map((s, i) => ({ ...s, rank: i + 1 }))
  }, [individualStandings, categoryFilter])

  // Team standings
  const teamStandings = useMemo(() => {
    const byTeam = {}
    for (const s of individualStandings) {
      if (!s.teamId) continue
      if (!byTeam[s.teamId]) {
        const team = teams?.find(t => t.id === s.teamId)
        byTeam[s.teamId] = {
          teamId:      s.teamId,
          teamName:    team?.team_name || team?.province || 'Unknown',
          totalPoints: 0,
          totalWeight: 0,
          memberCount: 0,
          members:     [],
        }
      }
      byTeam[s.teamId].totalPoints += s.totalPoints
      byTeam[s.teamId].totalWeight += s.totalWeightKg
      byTeam[s.teamId].memberCount += 1
      byTeam[s.teamId].members.push(s)
    }
    return Object.values(byTeam)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((t, i) => ({ ...t, rank: i + 1 }))
  }, [individualStandings, teams])

  const categories = ['all', ...new Set(participants.map(p => p.category).filter(Boolean))]
  const isLocked   = !!competition?.results_published_at

  return (
    <div>
      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View mode */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            {[
              { id: 'individual', label: '👤 Individual' },
              { id: 'teams',      label: '🏆 Teams' },
            ].map(m => (
              <button key={m.id} onClick={() => setViewMode(m.id)}
                style={S.btn(NAVY, 'white', viewMode === m.id)}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          {categories.length > 2 && (
            <select style={S.select} value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}>
              {categories.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          )}

          {/* Pending toggle (admin only) */}
          {isAdmin && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showPending}
                onChange={e => setShowPending(e.target.checked)} />
              Include unverified catches
            </label>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: GREY }}>
            {isLocked
              ? '🔒 Results published — final'
              : showPending
                ? '⚠ Includes unverified catches'
                : '✓ Verified catches only'}
          </div>
        </div>
      </div>

      {/* ── Individual standings ─────────────────────────────────────────── */}
      {viewMode === 'individual' && (
        <div style={S.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: NAVY, color: 'white' }}>
                  {['Rank','Angler','Team','LC','Category','Points','Weight','Spp','Catches'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: h === 'Rank' ? 'center' : 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStandings.map((s, i) => (
                  <tr key={s.participantId}
                    style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, color: RANK_COLORS[s.rank] || NAVY }}>
                      {s.rank <= 3 ? ['🥇','🥈','🥉'][s.rank - 1] : s.rank}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: NAVY, whiteSpace: 'nowrap' }}>
                      {onSelectAngler ? (
                        <button
                          onClick={() => onSelectAngler(s.participantId, s.teamName)}
                          title="Jump to this angler's catches in Scoring"
                          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: NAVY, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}>
                          {s.displayName}
                        </button>
                      ) : s.displayName}
                      {s.anglerNumber && <span style={{ color: GREY, fontWeight: 400 }}> #{s.anglerNumber}</span>}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: GREY, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {s.teamName || '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: GREY, fontSize: '0.82rem', textAlign: 'center' }}>
                      {s.lineClass ? `${s.lineClass}kg` : '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {s.category && <span style={S.badge(s.category === 'junior' ? '#7c3aed' : s.category === 'ladies' ? '#db2777' : NAVY)}>{s.category}</span>}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: NAVY, textAlign: 'right' }}>
                      {s.totalPoints.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: GREY, textAlign: 'right' }}>
                      {s.totalWeightKg.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: GREY }}>
                      {s.speciesCount}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: GREY }}>
                      {s.catchCount}
                    </td>
                  </tr>
                ))}
                {filteredStandings.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: '1.5rem', textAlign: 'center', color: GREY, fontStyle: 'italic' }}>No catches recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Team standings ───────────────────────────────────────────────── */}
      {viewMode === 'teams' && (
        <div>
          {teamStandings.map((t, i) => (
            <div key={t.teamId} style={{ ...S.card, borderLeft: `4px solid ${RANK_COLORS[t.rank] || '#e5e7eb'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: '1rem' }}>
                    {t.rank <= 3 ? ['🥇','🥈','🥉'][t.rank - 1] + ' ' : `${t.rank}. `}
                    {t.teamName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: GREY }}>{t.memberCount} anglers · {t.totalWeight.toFixed(2)} kg</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: NAVY }}>{t.totalPoints.toFixed(2)}</div>
              </div>
              {t.members.sort((a, b) => b.totalPoints - a.totalPoints).map(m => (
                <div key={m.participantId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.3rem 0.5rem', background: '#f8fafc', borderRadius: 5, marginBottom: '0.25rem' }}>
                  <div style={{ flex: 1, fontSize: '0.85rem' }}>
                    {onSelectAngler ? (
                      <button
                        onClick={() => onSelectAngler(m.participantId, m.teamName ?? t.teamName)}
                        title="Jump to this angler's catches in Scoring"
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}>
                        {m.displayName}
                      </button>
                    ) : m.displayName}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: GREY }}>{m.catchCount} fish</div>
                  <div style={{ fontWeight: 700, color: NAVY, minWidth: 60, textAlign: 'right' }}>{m.totalPoints.toFixed(2)}</div>
                </div>
              ))}
            </div>
          ))}
          {teamStandings.length === 0 && (
            <div style={{ ...S.card, color: GREY, textAlign: 'center', fontStyle: 'italic' }}>No team data available.</div>
          )}
        </div>
      )}
    </div>
  )
}
