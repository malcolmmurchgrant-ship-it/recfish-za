import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const COMPETITION_ID = '3855034f-ab39-4297-9be4-ba9a7e566ce0'
const LINE_CLASS     = 10

const NAVY  = '#1e3a8a'
const GOLD  = '#d97706'
const GREEN = '#16a34a'
const RED   = '#dc2626'
const GREY  = '#6b7280'

// ─── TEAMS & BOATS ────────────────────────────────────────────────────────────
const TEAMS = {
  'Border':               { captain: 'Tim Wood',           boat: 'ROUGH RIDER',   skipper: 'Arny Nice' },
  'Southern Gauteng Red': { captain: 'Wesley Uys',         boat: 'JOY TOY',       skipper: 'Patat de Jager' },
  'Southern Gauteng Blue':{ captain: 'Dirk Rosslee',       boat: 'PIROMERO',      skipper: 'Andries Oosthuizen' },
  'SADSAA U21':           { captain: 'Francois Rossouw',   boat: 'HOWZIE',        skipper: 'Paul Howells' },
  'Northern Gauteng':     { captain: 'Ryno Le Grange',     boat: 'WALAALAHA',     skipper: 'Riaan Odendaal' },
  'Zululand Black':       { captain: 'Giepie Joubert',     boat: 'GIEPSTER',      skipper: 'Giepie Joubert' },
  'Zululand White':       { captain: 'Marius Botha',       boat: 'ADDICTED',      skipper: 'Marius Botha' },
  'Natal':                { captain: 'Alex Tyldesley',     boat: 'BLOOD DIAMOND', skipper: 'Struan Blight' },
  'Mpumalanga':           { captain: 'Ricus van Heerden',  boat: 'PIRATE',        skipper: 'Nicky Venter' },
}

// ─── SCORING FUNCTIONS ────────────────────────────────────────────────────────

// Individual fish points: (weight_kg / line_class)² × 32
function fishPoints(weightKg, lineClass = LINE_CLASS) {
  if (!weightKg || weightKg <= 0) return 0
  return parseFloat(((weightKg / lineClass) ** 2 * 32).toFixed(4))
}

// Count distinct species for an angler's catches (billfish count, 0 pts)
function anglerSpeciesCount(catches) {
  const species = new Set()
  ;(catches || []).forEach(c => {
    if (!c.species) return
    // Group species per competition rules
    if (['Giant Kingfish (Ignobilis)', 'Other Kingfish (Bluefin / Blacklip / Yellowspot etc.)'].includes(c.species))
      species.add('__KINGFISH__')
    else if (c.species === 'Amberjack / Tropical Yellowtail')
      species.add('__AMBERJACK__')
    else if (c.species.toLowerCase().includes('tuna') || c.species === 'Other Tuna')
      species.add('__TUNA__')
    else
      species.add(c.species)
  })
  return species.size
}

// Angler raw points (billfish = 0)
function anglerRawPoints(catches, lineClass = LINE_CLASS) {
  return (
    <div style={S.page}>

      {/* Header */}
      <div style={{ background: NAVY, color: 'white', padding: '1rem 1.5rem', borderRadius: 8, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>🏆 SADSAA Gamefish Nationals 2026</div>
            <div style={{ fontSize: '0.82rem', opacity: 0.85, marginTop: 2 }}>Meerensee Boat Club · Live Scoreboard · 10kg Line Class</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button onClick={load} disabled={loading}
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem' }}>
              {loading ? '⟳ Loading…' : '⟳ Refresh'}
            </button>
            {lastRefresh && <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 3 }}>Updated {lastRefresh.toLocaleTimeString()}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Scorecards', value: totalEntries },
            { label: 'Fish Recorded', value: totalFishAll },
            { label: 'Teams', value: Object.keys(TEAMS).length },
            { label: 'Top Species', value: topSpecies[0] ? topSpecies[0][0].split(' ')[0] : '—' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Results visibility gate */}
      {!resultsVisible && !isAuthorised ? (
        <div style={{ background: NAVY, color: 'white', borderRadius: 8, padding: '2rem', textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Results Not Yet Available</div>
          <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>The Tournament Director has not yet released the results. Please check back later.</div>
        </div>
      ) : (
        <div>
          {/* Scoring note */}
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#92400e' }}>
            <strong>Scoring:</strong> Individual = raw pts × (species−1) · Team = sum of raw pts × (team species−1) · Billfish count as species, score 0pts
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={S.tab(activeTab === t.id)}>{t.label}</button>
            ))}
          </div>

          {/* ── TEAM STANDINGS ── */}
          {activeTab === 'team' && (
            <div style={S.card}>
              <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.25rem' }}>Team Standings</div>
              <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '1rem' }}>
                Ranked by cumulative team score. Team score = sum of anglers raw points × team species multiplier per day.
              </div>
              {teamStandings.length === 0 && <div style={{ color: GREY, fontStyle: 'italic' }}>No data yet.</div>}
              {teamStandings.map((t, i) => {
                const pos = i + 1
                const info = TEAMS[t.name]
                return (
                  <div key={t.name} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, minWidth: 28 }}>{S.icon(pos)}</span>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: '0.78rem', color: GREY }}>⚓ {info?.captain} · 🚤 {info?.boat}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>Total Score</div>
                        <div style={{ fontWeight: 800, fontSize: '1.2rem', color: NAVY }}>{t.totalScore.toFixed(2)}</div>
                      </div>
                    </div>
                    {t.dayScores.length > 0 && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {t.dayScores.sort((a,b) => a.day - b.day).map(d => (
                          <span key={d.day} style={{ fontSize: '0.75rem', background: '#eff6ff', color: NAVY, padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                            Day {d.day}: {d.rawTotal.toFixed(1)} raw ×{d.mult} = {d.total.toFixed(2)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── ANGLER STANDINGS ── */}
          {activeTab === 'angler' && (
            <div style={S.card}>
              <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.25rem' }}>Individual Angler Standings</div>
              <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '1rem' }}>
                Ranked by cumulative multiplied score. Individual score = raw pts × (angler species−1).
              </div>
              {anglerStandings.length === 0 && <div style={{ color: GREY, fontStyle: 'italic' }}>No data yet.</div>}
              {anglerStandings.map((a, i) => {
                const pos = i + 1
                const isCaptain = TEAMS[a.team]?.captain === a.name
                return (
                  <div key={a.name} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, minWidth: 28 }}>{S.icon(pos)}</span>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontWeight: 700 }}>{a.name}{isCaptain ? ' ⚓' : ''}</div>
                        <div style={{ fontSize: '0.78rem', color: GREY }}>{a.team}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {[
                          { label: 'Score',   val: a.totalMult.toFixed(2), color: NAVY  },
                          { label: 'Raw Pts', val: a.totalRaw.toFixed(2),  color: GREY  },
                          { label: 'Fish',    val: a.totalFish,            color: GREEN },
                          { label: 'Kg',      val: a.totalKg.toFixed(1),   color: GOLD  },
                          { label: 'Days',    val: `${a.daysEntered}/5`,   color: GREY  },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>{s.label}</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: s.color }}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {a.days.sort((x,y) => x.day_number - y.day_number).map(r => {
                        const raw  = anglerRawPoints(r.catches)
                        const mult = anglerMultipliedScore(r.catches)
                        const sp   = anglerSpeciesCount(r.catches)
                        return (
                          <span key={r.day_number} style={{ fontSize: '0.73rem', background: '#eff6ff', color: NAVY, padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                            Day {r.day_number}: {raw.toFixed(1)} raw ×{Math.max(1,sp-1)} = {mult.toFixed(2)} ({r.fish_count || 0}🐟 {sp}sp)
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── SKIPPER STANDINGS ── */}
          {activeTab === 'skipper' && (
            <div style={S.card}>
              <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.25rem' }}>Skipper Standings</div>
              <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '1rem' }}>
                Ranked by team score. Skipper with the highest cumulative team score wins.
              </div>
              {skipperStandings.length === 0 && <div style={{ color: GREY, fontStyle: 'italic' }}>No data yet.</div>}
              {skipperStandings.map((t, i) => {
                const pos = i + 1
                return (
                  <div key={t.name} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, minWidth: 28 }}>{S.icon(pos)}</span>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontWeight: 700 }}>{t.skipper}</div>
                        <div style={{ fontSize: '0.78rem', color: GREY }}>🚤 {t.boat} · Team: {t.name}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>Team Score</div>
                        <div style={{ fontWeight: 800, fontSize: '1.2rem', color: NAVY }}>{t.totalScore.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── DAILY RESULTS ── */}
          {activeTab === 'daily' && (
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {['all',1,2,3,4,5].map(d => (
                  <button key={d} onClick={() => setDayFilter(d)}
                    style={{ padding: '0.35rem 0.9rem', borderRadius: 20, border: `2px solid ${NAVY}`, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: dayFilter === d ? NAVY : 'white', color: dayFilter === d ? 'white' : NAVY }}>
                    {d === 'all' ? 'All Days' : `Day ${d}`}
                  </button>
                ))}
              </div>
              {Object.keys(TEAMS).map(teamName => {
                const teamRows = filtered.filter(r => r.team_name === teamName)
                if (teamRows.length === 0) return null
                const info = TEAMS[teamName]
                const days = dayFilter === 'all' ? [1,2,3,4,5] : [parseInt(dayFilter)]
                return (
                  <div key={teamName} style={S.card}>
                    <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>
                      {teamName} <span style={{ fontSize: '0.82rem', color: GREY, fontWeight: 400 }}>· 🚤 {info.boat} · {info.skipper}</span>
                    </div>
                    {days.map(d => {
                      const dayRows = teamRows.filter(r => r.day_number === d)
                      if (dayRows.length === 0) return null
                      const score = teamScore(dayRows)
                      return (
                        <div key={d} style={{ marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                            Day {d} — Raw: {score.rawTotal.toFixed(2)} × {score.mult} ({score.species} species) = <span style={{ color: NAVY }}>{score.total.toFixed(2)} pts</span>
                          </div>
                          {dayRows.sort((a,b) => anglerMultipliedScore(b.catches) - anglerMultipliedScore(a.catches)).map(r => {
                            const raw  = anglerRawPoints(r.catches)
                            const mult = anglerMultipliedScore(r.catches)
                            const sp   = anglerSpeciesCount(r.catches)
                            const isCaptain = info.captain === r.angler_name
                            return (
                              <div key={r.angler_name} style={{ padding: '0.4rem 0.6rem', borderRadius: 6, background: '#f9fafb', marginBottom: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600, flex: 1 }}>{isCaptain ? '⚓ ' : ''}{r.angler_name}</span>
                                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.82rem' }}>
                                    <span style={{ color: GREY }}>{r.fish_count || 0}🐟 · {sp} sp</span>
                                    <span style={{ color: GREY }}>{raw.toFixed(2)} raw ×{Math.max(1,sp-1)}</span>
                                    <span style={{ fontWeight: 700, color: NAVY }}>{mult.toFixed(2)} pts</span>
                                  </div>
                                </div>
                                {(r.catches || []).filter(c => c.species).length > 0 && (
                                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: 4 }}>
                                    {r.catches.filter(c => c.species).map((c, ci) => (
                                      <span key={ci} style={S.badge(c.billfish ? GOLD : '#374151')}>
                                        {c.species.split(' ')[0]} {c.billfish ? '(OB)' : `${c.weight_kg}kg`}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              {filtered.length === 0 && <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>No data for selected day.</div>}
            </div>
          )}

          {/* ── CPUE ── */}
          {activeTab === 'cpue' && (
            <div style={S.card}>
              <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.25rem' }}>CPUE — Catch Per Unit Effort</div>
              <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '1rem' }}>
                Fish per hour and kg per hour per angler per day.
              </div>
              {cpueData.length === 0 ? (
                <div style={{ color: GREY, fontStyle: 'italic' }}>
                  No fishing hours recorded yet. The scorer must enter lines-in and lines-up times for each boat each day.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: NAVY, color: 'white' }}>
                      {['Day','Angler','Team','Fish','Kg','Hours','Fish/hr','Kg/hr'].map(h => (
                        <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.78rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cpueData.sort((a,b) => (b.kph||0) - (a.kph||0)).map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                        <td style={{ padding: '0.45rem 0.6rem' }}>{r.day}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600 }}>{r.angler}</td>
                        <td style={{ padding: '0.45rem 0.6rem', color: GREY }}>{r.team}</td>
                        <td style={{ padding: '0.45rem 0.6rem' }}>{r.fish}</td>
                        <td style={{ padding: '0.45rem 0.6rem' }}>{r.kg}</td>
                        <td style={{ padding: '0.45rem 0.6rem' }}>{r.hours}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 700, color: GREEN }}>{r.fph?.toFixed(2) || '—'}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 700, color: NAVY }}>{r.kph?.toFixed(2) || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── STATS ── */}
          {activeTab === 'stats' && (
            <div>
              <div style={S.card}>
                <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Top Species by Fish Count</div>
                {topSpecies.length === 0 && <div style={{ color: GREY, fontStyle: 'italic' }}>No data yet.</div>}
                {topSpecies.map(([sp, count], i) => {
                  const pct = count / (topSpecies[0]?.[1] || 1) * 100
                  return (
                    <div key={sp} style={{ marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{sp}</span>
                        <span style={{ fontSize: '0.85rem', color: GREY }}>{count} fish</span>
                      </div>
                      <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? GOLD : NAVY, borderRadius: 4 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={S.card}>
                <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Billfish Releases</div>
                {(() => {
                  const billfish = catches.flatMap(r =>
                    (r.catches || []).filter(c => c.billfish && c.species).map(c => ({
                      angler: r.angler_name, team: r.team_name, day: r.day_number, species: c.species
                    }))
                  )
                  if (billfish.length === 0) return <div style={{ color: GREY, fontStyle: 'italic' }}>No billfish recorded yet.</div>
                  return billfish.map((b, i) => (
                    <div key={i} style={{ padding: '0.4rem 0.6rem', borderRadius: 6, background: '#fef3c7', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                      <strong>{b.angler}</strong> ({b.team}) — Day {b.day}: {b.species} 🐬
                    </div>
                  ))
                })()}
              </div>
              <div style={S.card}>
                <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Record / PB Claims</div>
                {(() => {
                  const claims = catches.filter(r => r.record_note)
                  if (claims.length === 0) return <div style={{ color: GREY, fontStyle: 'italic' }}>No record claims yet.</div>
                  return claims.map(r => (
                    <div key={r.id} style={{ padding: '0.5rem 0.75rem', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', marginBottom: '0.4rem' }}>
                      <div style={{ fontWeight: 600 }}>{r.angler_name} — Day {r.day_number}</div>
                      <div style={{ fontSize: '0.85rem', color: '#374151' }}>{r.record_note}</div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  )
}
