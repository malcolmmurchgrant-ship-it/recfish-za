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

const TABS = [
  { id: 'team',    label: '🏆 Teams'    },
  { id: 'angler',  label: '🎣 Anglers'  },
  { id: 'skipper', label: '⚓ Skippers' },
  { id: 'daily',   label: '📅 Daily'   },
  { id: 'cpue',    label: '📊 CPUE'    },
  { id: 'stats',   label: '📈 Stats'   },
]

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

// Angler raw points (billfish = 0 pts but count as species)
function anglerRawPoints(catches, lineClass = LINE_CLASS) {
  return (catches || []).reduce((sum, c) => {
    if (c.billfish) return sum
    return sum + fishPoints(c.weight_kg, lineClass)
  }, 0)
}

// Angler multiplied score: raw × max(1, species - 1)
function anglerMultipliedScore(catches, lineClass = LINE_CLASS) {
  const raw  = anglerRawPoints(catches, lineClass)
  const sp   = anglerSpeciesCount(catches)
  const mult = Math.max(1, sp - 1)
  return raw * mult
}

// Team score for a set of catch rows (one day or all days)
function teamScore(rows, lineClass = LINE_CLASS) {
  // Collect all species across all anglers on the team for this set
  const allSpecies = new Set()
  rows.forEach(r => {
    ;(r.catches || []).forEach(c => {
      if (!c.species) return
      if (['Giant Kingfish (Ignobilis)', 'Other Kingfish (Bluefin / Blacklip / Yellowspot etc.)'].includes(c.species))
        allSpecies.add('__KINGFISH__')
      else if (c.species === 'Amberjack / Tropical Yellowtail')
        allSpecies.add('__AMBERJACK__')
      else if (c.species.toLowerCase().includes('tuna') || c.species === 'Other Tuna')
        allSpecies.add('__TUNA__')
      else
        allSpecies.add(c.species)
    })
  })
  const species  = allSpecies.size
  const mult     = Math.max(1, species - 1)
  const rawTotal = rows.reduce((s, r) => s + anglerRawPoints(r.catches, lineClass), 0)
  return { rawTotal, mult, species, total: rawTotal * mult }
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  page:  { maxWidth: 900, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' },
  card:  { background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  tab:   (a) => ({ flex: 1, padding: '0.55rem 0.5rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.15s', background: a ? NAVY : 'white', color: a ? 'white' : '#374151' }),
  medal: (p) => p === 1 ? { background: '#fef9c3', border: '2px solid #ca8a04' } : p === 2 ? { background: '#f3f4f6', border: '2px solid #9ca3af' } : p === 3 ? { background: '#fff7ed', border: '2px solid #c2410c' } : { background: 'white', border: '1px solid #e5e7eb' },
  icon:  (p) => p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `${p}.`,
  badge: (color) => ({ background: color, color: 'white', padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }),
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function GamefishScoreboard() {
  const [catches,        setCatches]        = useState([])
  const [sessions,       setSessions]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [lastRefresh,    setLastRefresh]    = useState(null)
  const [activeTab,      setActiveTab]      = useState('team')
  const [dayFilter,      setDayFilter]      = useState('all')
  const [resultsVisible, setResultsVisible] = useState(false)
  const [isAuthorised,   setIsAuthorised]   = useState(false)
  const [pinInput,       setPinInput]       = useState('')
  const [pinError,       setPinError]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: c }, { data: s }, { data: cfg }] = await Promise.all([
      supabase.from('gamefish_catches').select('*')
        .eq('competition_id', COMPETITION_ID).order('day_number'),
      supabase.from('competition_fishing_sessions').select('*')
        .eq('competition_id', COMPETITION_ID),
      supabase.from('competitions').select('results_released, scorer_pin')
        .eq('id', COMPETITION_ID).single(),
    ])
    setCatches(c || [])
    setSessions(s || [])
    if (cfg?.results_released) setResultsVisible(true)
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  // ── Filter by day ─────────────────────────────────────────────────────────
  const filtered = dayFilter === 'all' ? catches : catches.filter(r => r.day_number === parseInt(dayFilter))

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalEntries = catches.length
  const totalFishAll = catches.reduce((s, r) => s + (r.fish_count || 0), 0)

  const speciesMap = {}
  catches.forEach(r => {
    ;(r.catches || []).forEach(c => {
      if (c.species) speciesMap[c.species] = (speciesMap[c.species] || 0) + 1
    })
  })
  const topSpecies = Object.entries(speciesMap).sort((a, b) => b[1] - a[1])

  // ── Team standings ────────────────────────────────────────────────────────
  const teamStandings = Object.keys(TEAMS).map(teamName => {
    const teamRows = catches.filter(r => r.team_name === teamName)
    const days = [1, 2, 3, 4, 5]
    const dayScores = days.map(d => {
      const dayRows = teamRows.filter(r => r.day_number === d)
      if (dayRows.length === 0) return null
      const s = teamScore(dayRows)
      return { day: d, ...s }
    }).filter(Boolean)
    const totalScore = dayScores.reduce((s, d) => s + d.total, 0)
    return { name: teamName, totalScore, dayScores }
  }).sort((a, b) => b.totalScore - a.totalScore)

  // ── Angler standings ──────────────────────────────────────────────────────
  const anglerMap = {}
  catches.forEach(r => {
    if (!anglerMap[r.angler_name]) {
      anglerMap[r.angler_name] = { name: r.angler_name, team: r.team_name, days: [], totalRaw: 0, totalMult: 0, totalFish: 0, totalKg: 0, daysEntered: 0 }
    }
    const a = anglerMap[r.angler_name]
    a.days.push(r)
    a.totalRaw  += anglerRawPoints(r.catches)
    a.totalMult += anglerMultipliedScore(r.catches)
    a.totalFish += r.fish_count || 0
    a.totalKg   += (r.catches || []).reduce((s, c) => s + (c.weight_kg || 0), 0)
    a.daysEntered++
  })
  const anglerStandings = Object.values(anglerMap).sort((a, b) => b.totalMult - a.totalMult)

  // ── Skipper standings (same order as team) ────────────────────────────────
  const skipperStandings = teamStandings.map(t => ({
    ...t,
    skipper: TEAMS[t.name]?.skipper,
    boat:    TEAMS[t.name]?.boat,
  }))

  // ── CPUE ──────────────────────────────────────────────────────────────────
  const cpueData = catches.map(r => {
    const session = sessions.find(s => s.angler_id === r.angler_id && s.day_number === r.day_number)
    if (!session?.lines_in_time || !session?.lines_up_time) return null
    const hoursRaw = (new Date(session.lines_up_time) - new Date(session.lines_in_time)) / 3600000
    const hours = Math.max(0.1, hoursRaw)
    const fish  = r.fish_count || 0
    const kg    = (r.catches || []).reduce((s, c) => s + (c.weight_kg || 0), 0)
    return {
      day:    r.day_number,
      angler: r.angler_name,
      team:   r.team_name,
      fish,
      kg:     kg.toFixed(1),
      hours:  hours.toFixed(2),
      fph:    fish / hours,
      kph:    kg / hours,
    }
  }).filter(Boolean)

  // ─────────────────────────────────────────────────────────────────────────
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
          <div style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '1.25rem' }}>The Tournament Director has not yet released the results. Please check back later.</div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <input
              type="password"
              placeholder="Scorer PIN"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false) }}
              style={{ padding: '0.4rem 0.75rem', borderRadius: 6, border: pinError ? '2px solid #ef4444' : '1px solid #ccc', fontSize: '0.9rem', width: 140 }}
            />
            <button
              onClick={() => {
                if (pinInput === '7749') { setIsAuthorised(true); setPinError(false) }
                else setPinError(true)
              }}
              style={{ padding: '0.4rem 1rem', borderRadius: 6, background: GOLD, color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
              Unlock
            </button>
          </div>
          {pinError && <div style={{ color: '#fca5a5', fontSize: '0.82rem', marginTop: '0.5rem' }}>Incorrect PIN</div>}
        </div>
      ) : (
        <div>
          {/* Scoring note */}
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#92400e' }}>
            <strong>Scoring:</strong> Individual = raw pts × (species−1) · Team = sum of raw pts × (team species−1) · Billfish count as species, score 0 pts
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
                const pos  = i + 1
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
                        {t.dayScores.sort((a, b) => a.day - b.day).map(d => (
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
                const pos       = i + 1
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
                      {a.days.sort((x, y) => x.day_number - y.day_number).map(r => {
                        const raw  = anglerRawPoints(r.catches)
                        const mult = anglerMultipliedScore(r.catches)
                        const sp   = anglerSpeciesCount(r.catches)
                        return (
                          <span key={r.day_number} style={{ fontSize: '0.73rem', background: '#eff6ff', color: NAVY, padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                            Day {r.day_number}: {raw.toFixed(1)} raw ×{Math.max(1, sp - 1)} = {mult.toFixed(2)} ({r.fish_count || 0}🐟 {sp}sp)
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
                {['all', 1, 2, 3, 4, 5].map(d => (
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
                const days = dayFilter === 'all' ? [1, 2, 3, 4, 5] : [parseInt(dayFilter)]
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
                          {dayRows.sort((a, b) => anglerMultipliedScore(b.catches) - anglerMultipliedScore(a.catches)).map(r => {
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
                                    <span style={{ color: GREY }}>{raw.toFixed(2)} raw ×{Math.max(1, sp - 1)}</span>
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
                      {['Day', 'Angler', 'Team', 'Fish', 'Kg', 'Hours', 'Fish/hr', 'Kg/hr'].map(h => (
                        <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.78rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cpueData.sort((a, b) => (b.kph || 0) - (a.kph || 0)).map((r, i) => (
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
