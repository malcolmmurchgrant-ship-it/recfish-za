import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ─── COMPETITION ──────────────────────────────────────────────────────────────
const COMPETITION_ID = 'ff6e95a9-4f9e-4b54-ad47-a913831d336c'

// ─── SCORING ─────────────────────────────────────────────────────────────────
function tunaPoints(weightKg, lineClassKg) {
  const factors = { 10: 0.32, 15: 32/225 }
  const f = factors[parseInt(lineClassKg || 10)] ?? 0.32
  return parseFloat((Math.pow(parseFloat(weightKg), 2) * f).toFixed(2))
}

function getFishingHours(dayRecord) {
  if (dayRecord?.fishing_start_time && dayRecord?.fishing_end_time) {
    const [sh, sm] = dayRecord.fishing_start_time.slice(0,5).split(':').map(Number)
    const [eh, em] = dayRecord.fishing_end_time.slice(0,5).split(':').map(Number)
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60
  }
  return 10
}

function getTotalFishingHours(days) {
  const active = (days || []).filter(d => d.day_status === 'fishing' || !d.day_status)
  if (active.length === 0) return 28
  return active.reduce((s, d) => s + getFishingHours(d), 0)
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const NAVY  = '#1e3a8a'
const GOLD  = '#d97706'
const GREEN = '#16a34a'
const GREY  = '#6b7280'

const S = {
  page:  { maxWidth: 960, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' },
  card:  { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  tab:   (a) => ({ flex: 1, padding: '0.6rem 0.4rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: a ? NAVY : 'white', color: a ? 'white' : '#374151' }),
  medal: (p) => p === 1 ? { background: '#fef9c3', border: '2px solid #ca8a04' } : p === 2 ? { background: '#f3f4f6', border: '2px solid #9ca3af' } : p === 3 ? { background: '#fff7ed', border: '2px solid #c2410c' } : { background: 'white', border: '1px solid #e5e7eb' },
  icon:  (p) => p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `${p}.`,
  badge: (col) => ({ background: col, color: 'white', padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }),
}

export default function TunaNationalsScoreboard() {
  const [catches,      setCatches]      = useState([])
  const [teams,        setTeams]        = useState([])
  const [anglers,      setAnglers]      = useState([])
  const [boats,        setBoats]        = useState([])
  const [days,         setDays]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [lastRefresh,  setLastRefresh]  = useState(null)
  const [activeTab,    setActiveTab]    = useState('team')

  const load = useCallback(async () => {
    setLoading(true)
    const [
      { data: teamsData },
      { data: anglersData },
      { data: boatsData },
      { data: daysData },
      { data: catchesData },
    ] = await Promise.all([
      supabase.from('competition_teams').select('*').eq('competition_id', COMPETITION_ID),
      supabase.from('competition_participants').select('*').eq('competition_id', COMPETITION_ID),
      supabase.from('competition_boats').select('*').eq('competition_id', COMPETITION_ID),
      supabase.from('competition_days').select('*').eq('competition_id', COMPETITION_ID).order('day_number'),
      supabase.from('competition_catches').select('*').eq('competition_id', COMPETITION_ID),
    ])
    setTeams(teamsData || [])
    setAnglers(anglersData || [])
    setBoats(boatsData || [])
    setDays(daysData || [])
    setCatches(catchesData || [])
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived data ──────────────────────────────────────────────────────────
  const fishingHours = getTotalFishingHours(days)
  const dateToDay = Object.fromEntries((days || []).map(d => [d.date, d.day_number]))
  const cancelledDays = days.filter(d =>
    d.day_status === 'cancelled_before' || d.day_status === 'cancelled_during' || d.day_status === 'rest_day'
  )
  const fishingDays = days.filter(d => d.day_status === 'fishing' || !d.day_status)

  const teamMap   = Object.fromEntries(teams.map(t => [t.id, t]))
  const anglerMap = Object.fromEntries(anglers.map(a => [a.user_id, a]))
  const boatMap   = Object.fromEntries(boats.map(b => [b.id, b]))
  const dayMap    = Object.fromEntries(days.map(d => [d.id, d]))

  const scoringCatches = catches.filter(c => c.scoring !== false && c.weight_kg && parseFloat(c.weight_kg) > 0 && c.species_name !== 'No Catch')

  // ── Team standings ────────────────────────────────────────────────────────
  const teamStandings = teams.map(t => {
    const tc     = scoringCatches.filter(c => c.team_id === t.id)
    const fish   = tc.length
    const kg     = tc.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
    const points = tc.reduce((s, c) => s + parseFloat(c.points || tunaPoints(c.weight_kg, c.line_class_kg)), 0)
    const boat   = boatMap[t.boat_id] || {}
    return {
      id: t.id, name: t.team_name,
      boat: boat.boat_name || '', skipper: boat.skipper_name || '',
      fish, kg: Math.round(kg * 100) / 100,
      points: Math.round(points * 100) / 100,
      kghr: Math.round(kg / fishingHours * 100) / 100,
      fhr:  Math.round(fish / fishingHours * 100) / 100,
    }
  }).sort((a, b) => b.points - a.points || b.fish - a.fish)

  // ── Angler standings ──────────────────────────────────────────────────────
  const anglerStandings = anglers.map(a => {
    const ac     = catches.filter(c => c.angler_id === a.user_id && c.weight_kg && parseFloat(c.weight_kg) > 0 && c.species_name !== 'No Catch' && c.scoring !== false)
    const fish   = ac.length
    const kg     = ac.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
    const points = ac.reduce((s, c) => s + parseFloat(c.points || tunaPoints(c.weight_kg, c.line_class_kg)), 0)
    const team   = teamMap[a.team_id]?.team_name || a.division || ''
    // Group catches by day using fishing_date
    const byDay = {}
    ac.forEach(c => {
      const dn = dateToDay[c.fishing_date]
      if (!dn) return
      if (!byDay[dn]) byDay[dn] = []
      byDay[dn].push(c)
    })
    return {
      id: a.id, name: a.full_name, team, fish,
      kg: Math.round(kg * 100) / 100,
      points: Math.round(points * 100) / 100,
      kghr: Math.round(kg / fishingHours * 100) / 100,
      fhr:  Math.round(fish / fishingHours * 100) / 100,
      byDay,
    }
  }).sort((a, b) => b.points - a.points || b.fish - a.fish)

  // ── Top 10 catches ────────────────────────────────────────────────────────
  const top10 = [...scoringCatches]
    .map(c => ({
      ...c,
      anglerName: anglerMap[c.angler_id]?.full_name || '',
      teamName:   teamMap[c.team_id]?.team_name || '',
      dayNumber:  days.find(d => d.date === c.fishing_date)?.day_number,
      pts: parseFloat(c.points || tunaPoints(c.weight_kg, c.line_class_kg)),
    }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 10)

  // ── Skipper standings ─────────────────────────────────────────────────────
  const skipperStandings = boats.map(b => {
    const team   = teams.find(t => t.boat_id === b.id)
    const tc     = team ? scoringCatches.filter(c => c.team_id === team.id) : []
    const fish   = tc.length
    const kg     = tc.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
    const points = tc.reduce((s, c) => s + parseFloat(c.points || tunaPoints(c.weight_kg, c.line_class_kg)), 0)
    return {
      skipper: b.skipper_name || '', boat: b.boat_name || '',
      team: team?.team_name || '', fish,
      kg:     Math.round(kg * 100) / 100,
      points: Math.round(points * 100) / 100,
      kghr:   Math.round(kg / fishingHours * 100) / 100,
      fhr:    Math.round(fish / fishingHours * 100) / 100,
    }
  }).sort((a, b) => b.points - a.points || b.fish - a.fish)

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalFish   = scoringCatches.length
  const totalKg     = scoringCatches.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
  const totalPoints = scoringCatches.reduce((s, c) => s + parseFloat(c.points || tunaPoints(c.weight_kg, c.line_class_kg)), 0)

  const TABS = [
    { id: 'team',    label: '🏆 Teams'   },
    { id: 'angler',  label: '🎣 Anglers' },
    { id: 'top10',   label: '🐟 Top 10'  },
    { id: 'skipper', label: '⚓ Skippers'},
    { id: 'cpue',    label: '📊 CPUE'    },
  ]

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={{ background: NAVY, color: 'white', padding: '1rem 1.5rem', borderRadius: 8, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>🏆 SADSAA Tuna Nationals 2026</div>
            <div style={{ fontSize: '0.82rem', opacity: 0.85, marginTop: 2 }}>
              Atlantic Boat Club, Hout Bay · Final Results · {fishingHours.toFixed(0)} hrs total fishing
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button onClick={load} disabled={loading}
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem' }}>
              {loading ? '⟳ Loading…' : '⟳ Refresh'}
            </button>
            {lastRefresh && <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 3 }}>Updated {lastRefresh.toLocaleTimeString()}</div>}
          </div>
        </div>

        {/* Cancelled days */}
        {cancelledDays.length > 0 && (
          <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {cancelledDays.map(d => (
              <span key={d.id} style={{ fontSize: '0.75rem', background: 'rgba(220,38,38,0.3)', border: '1px solid rgba(220,38,38,0.5)', padding: '0.2rem 0.6rem', borderRadius: 20 }}>
                🚫 Day {d.day_number} ({d.date}): {d.day_status === 'rest_day' ? 'Rest day' : 'Cancelled'}
              </span>
            ))}
          </div>
        )}

        {/* Summary stats */}
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Fish',    value: totalFish },
            { label: 'Kg',      value: totalKg.toFixed(1) },
            { label: 'Points',  value: totalPoints.toFixed(0) },
            { label: 'Teams',   value: teams.length },
            { label: 'Anglers', value: anglers.length },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={S.tab(activeTab === t.id)}>{t.label}</button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: GREY }}>Loading results…</div>}

      {/* ── TEAM STANDINGS ── */}
      {!loading && activeTab === 'team' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.25rem' }}>Team Standings</div>
          <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '1rem' }}>
            Ranked by cumulative points. Scoring: weight² × line class factor
          </div>
          {teamStandings.length === 0 && <div style={{ color: GREY, fontStyle: 'italic' }}>No data yet.</div>}
          {teamStandings.map((t, i) => {
            const pos = i + 1
            return (
              <div key={t.id} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, minWidth: 28 }}>{S.icon(pos)}</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: '0.78rem', color: GREY }}>🚤 {t.boat} · ⚓ {t.skipper}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Points', val: t.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), col: NAVY  },
                      { label: 'Fish',   val: t.fish,                                                          col: GREEN },
                      { label: 'Kg',     val: t.kg.toFixed(2),                                                 col: GOLD  },
                      { label: 'kg/hr',  val: t.kghr.toFixed(2),                                               col: GREY  },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>{s.label}</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: s.col }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ANGLER STANDINGS ── */}
      {!loading && activeTab === 'angler' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.25rem' }}>Individual Angler Standings</div>
          <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '1rem' }}>
            Ranked by cumulative points. Per-day breakdown shown below each angler.
          </div>
          {anglerStandings.map((a, i) => {
            const pos = i + 1
            return (
              <div key={a.id} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, minWidth: 28 }}>{S.icon(pos)}</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700 }}>{a.name}</div>
                    <div style={{ fontSize: '0.78rem', color: GREY }}>{a.team}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Points', val: a.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), col: NAVY  },
                      { label: 'Fish',   val: a.fish,                                                          col: GREEN },
                      { label: 'Kg',     val: a.kg.toFixed(2),                                                 col: GOLD  },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>{s.label}</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: s.col }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Per-day breakdown */}
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', paddingLeft: '2rem' }}>
                  {fishingDays.map(d => {
                    const dc  = a.byDay[d.day_number] || []
                    const dPts = dc.reduce((s, c) => s + parseFloat(c.points || tunaPoints(c.weight_kg, c.line_class_kg)), 0)
                    const dKg  = dc.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
                    return (
                      <span key={d.id} style={{ fontSize: '0.73rem', background: dc.length > 0 ? '#eff6ff' : '#f9fafb', color: dc.length > 0 ? NAVY : GREY, padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                        Day {d.day_number}: {dc.length > 0 ? `${dc.length}🐟 ${dKg.toFixed(1)}kg ${dPts.toFixed(0)}pts` : 'No catch'}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TOP 10 CATCHES ── */}
      {!loading && activeTab === 'top10' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.25rem' }}>Top 10 Individual Catches</div>
          <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '1rem' }}>All fishing days combined, ranked by points.</div>
          {top10.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: 8, background: i === 0 ? '#fef9c3' : i < 3 ? '#f9fafb' : 'white', border: '1px solid #e5e7eb', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, minWidth: 28, color: GREY }}>{i + 1}.</span>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700 }}>{c.anglerName}</div>
                <div style={{ fontSize: '0.78rem', color: GREY }}>{c.teamName} · Day {c.dayNumber}</div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Species', val: c.species_name,                                                        col: '#374151', bold: false },
                  { label: 'Weight',  val: `${parseFloat(c.weight_kg).toFixed(2)} kg`,                            col: GOLD,      bold: true  },
                  { label: 'Line',    val: `${c.line_class_kg} kg`,                                               col: GREY,      bold: false },
                  { label: 'Points',  val: c.pts.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),            col: NAVY,      bold: true  },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontWeight: s.bold ? 700 : 500, fontSize: '0.88rem', color: s.col }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SKIPPER STANDINGS ── */}
      {!loading && activeTab === 'skipper' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.25rem' }}>Skipper Standings</div>
          <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '1rem' }}>
            Ranked by team points — highest cumulative catch points wins.
          </div>
          {skipperStandings.map((s, i) => {
            const pos = i + 1
            return (
              <div key={s.boat} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, minWidth: 28 }}>{S.icon(pos)}</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700 }}>{s.skipper}</div>
                    <div style={{ fontSize: '0.78rem', color: GREY }}>🚤 {s.boat} · {s.team}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Points',   val: s.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), col: NAVY  },
                      { label: 'kg/hr',    val: s.kghr.toFixed(2),                                              col: GOLD  },
                      { label: 'fish/hr',  val: s.fhr.toFixed(2),                                               col: GREEN },
                    ].map(st => (
                      <div key={st.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>{st.label}</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: st.col }}>{st.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── CPUE ── */}
      {!loading && activeTab === 'cpue' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.25rem' }}>CPUE — Catch Per Unit Effort</div>
          <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '1rem' }}>
            Based on {fishingHours.toFixed(1)} total fishing hours across {fishingDays.length} fishing days.
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: NAVY, color: 'white' }}>
                {['#', 'Angler', 'Team', 'Fish', 'Kg', 'Points', 'kg/hr', 'fish/hr'].map(h => (
                  <th key={h} style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.76rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...anglerStandings].sort((a, b) => b.kghr - a.kghr).map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '0.4rem 0.6rem', color: GREY }}>{i + 1}</td>
                  <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{a.name}</td>
                  <td style={{ padding: '0.4rem 0.6rem', color: GREY, fontSize: '0.78rem' }}>{a.team}</td>
                  <td style={{ padding: '0.4rem 0.6rem' }}>{a.fish}</td>
                  <td style={{ padding: '0.4rem 0.6rem' }}>{a.kg.toFixed(2)}</td>
                  <td style={{ padding: '0.4rem 0.6rem' }}>{a.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: GOLD }}>{a.kghr.toFixed(2)}</td>
                  <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: GREEN }}>{a.fhr.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
