import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ─── COMPETITION ──────────────────────────────────────────────────────────────
const COMPETITION_ID = 'c8332f15-ce44-4d0b-a3ab-009fc2a2c484'

// ─── TEAMS — corrected captains ───────────────────────────────────────────────
const TEAMS = {
  'EPDSAA A':               { captain: 'Wayne Gerber' },
  'EPDSAA B':               { captain: 'Brett Potgieter' },
  'EP LADIES A':            { captain: 'Lisa Bekker' },
  'EP LADIES B':            { captain: 'Brenda Weyer' },
  'BORDER WHITE':           { captain: 'Andrew Sparg' },
  'BORDER BLUE':            { captain: 'Michael Swanepoel' },
  'SOUTHERN CAPE MEN':      { captain: 'Kobus Oosthuizen' },
  'SOUTHERN CAPE JNR WHITE':{ captain: 'Joshua Du Plessis' },
  'SOUTHERN CAPE JNR GREEN':{ captain: 'Jack Magerla' },
  'WESTERN PROVINCE':       { captain: 'Stephen Flemming' },
  'NATAL':                  { captain: 'Riaz Hussain' },
  'FREE STATE':             { captain: 'Andrea Papachristoforou' },
}

const SKIPPERS = {
  'ELITE CAT':        'André Olivier',
  'FISHBONE':         'Richard Fulford',
  'NOTHING BUT BUTT': 'André Labuschagne',
  'CAESAR':           'Louis Fouché',
  'SON OF JAMAICA':   'Martin Gierz',
  'REEL NAUTI':       'Ryno Nel',
  'SEA DOG':          'Garth Webb',
  'LEIGHWAY':         'Tim Gillitt',
  'U GO GIRL':        'Johan Coetzer',
  'MACUSHLA':         'Chris Gerber',
}

// ─── BOAT DRAW — corrected spellings ─────────────────────────────────────────
const BOAT_DRAW = {
  'Madelein Fourie':           ['ELITE CAT','FISHBONE','SON OF JAMAICA'],
  'Brenda Weyer':              ['CAESAR','SEA DOG','REEL NAUTI'],
  'Joelene Lerm':              ['SEA DOG','ELITE CAT','FISHBONE'],
  'Ossie Sauermann':           ['ELITE CAT','NOTHING BUT BUTT','REEL NAUTI'],
  'Stephen Flemming':          ['CAESAR','LEIGHWAY','SON OF JAMAICA'],
  'Gareth Decker':             ['LEIGHWAY','ELITE CAT','NOTHING BUT BUTT'],
  'Andrew Sparg':              ['ELITE CAT','CAESAR','FISHBONE'],
  'Tim Wood':                  ['CAESAR','U GO GIRL','ELITE CAT'],
  'Dennis Ford':               ['U GO GIRL','FISHBONE','REEL NAUTI'],
  'Saxon Ansley':              ['ELITE CAT','SON OF JAMAICA','NOTHING BUT BUTT'],
  'Joshua Du Plessis':         ['CAESAR','MACUSHLA','FISHBONE'],
  'Jaden De Villiers':         ['MACUSHLA','FISHBONE','ELITE CAT'],
  'Wessel Havenga':            ['FISHBONE','ELITE CAT','SON OF JAMAICA'],
  'Pieter Strobos':            ['SON OF JAMAICA','SEA DOG','ELITE CAT'],
  'Kobus Oosthuizen':          ['SEA DOG','NOTHING BUT BUTT','CAESAR'],
  'Jacques Bekker':            ['FISHBONE','NOTHING BUT BUTT','ELITE CAT'],
  'Deon van Jaarsveld':        ['SON OF JAMAICA','LEIGHWAY','FISHBONE'],
  'Brett Potgieter':           ['LEIGHWAY','REEL NAUTI','CAESAR'],
  'Riaz Hussain':              ['FISHBONE','CAESAR','NOTHING BUT BUTT'],
  'Sayed Cassiem':             ['SON OF JAMAICA','U GO GIRL','CAESAR'],
  'Brandon Hooke':             ['U GO GIRL','NOTHING BUT BUTT','SEA DOG'],
  'Peter Mansvelt':            ['FISHBONE','SON OF JAMAICA','CAESAR'],
  'Michael Swanepoel':         ['SON OF JAMAICA','MACUSHLA','NOTHING BUT BUTT'],
  'Wayne Voogt':               ['MACUSHLA','REEL NAUTI','SEA DOG'],
  'Andrea Papachristoforou':   ['NOTHING BUT BUTT','ELITE CAT','SEA DOG'],
  'Xavier Truluck':            ['REEL NAUTI','SEA DOG','LEIGHWAY'],
  'Phillip Papachristoforou':  ['SEA DOG','CAESAR','U GO GIRL'],
  'Sheena Gerber':             ['NOTHING BUT BUTT','FISHBONE','LEIGHWAY'],
  'Maggie Kolesky':            ['REEL NAUTI','LEIGHWAY','U GO GIRL'],
  'Lisa Bekker':               ['LEIGHWAY','CAESAR','MACUSHLA'],
  'Ben Groenewald':            ['NOTHING BUT BUTT','SON OF JAMAICA','U GO GIRL'],
  'Jack Magerla':              ['REEL NAUTI','U GO GIRL','MACUSHLA'],
  'Owen Lineker':              ['U GO GIRL','REEL NAUTI','LEIGHWAY'],
  'Donald Brown':              ['NOTHING BUT BUTT','REEL NAUTI','MACUSHLA'],
  'Wayne Gerber':              ['REEL NAUTI','MACUSHLA','SON OF JAMAICA'],
  'Brian Gerber':              ['MACUSHLA','SON OF JAMAICA','REEL NAUTI'],
}

// ─── ANGLER → TEAM MAP — corrected ───────────────────────────────────────────
function getAnglerTeam(name) {
  const teamMap = {
    'Wayne Gerber':'EPDSAA A','Brian Gerber':'EPDSAA A','Donald Brown':'EPDSAA A',
    'Brett Potgieter':'EPDSAA B','Jacques Bekker':'EPDSAA B','Deon van Jaarsveld':'EPDSAA B',
    'Lisa Bekker':'EP LADIES A','Sheena Gerber':'EP LADIES A','Maggie Kolesky':'EP LADIES A',
    'Brenda Weyer':'EP LADIES B','Madelein Fourie':'EP LADIES B','Joelene Lerm':'EP LADIES B',
    'Andrew Sparg':'BORDER WHITE','Dennis Ford':'BORDER WHITE','Tim Wood':'BORDER WHITE',
    'Michael Swanepoel':'BORDER BLUE','Peter Mansvelt':'BORDER BLUE','Wayne Voogt':'BORDER BLUE',
    'Kobus Oosthuizen':'SOUTHERN CAPE MEN','Pieter Strobos':'SOUTHERN CAPE MEN','Wessel Havenga':'SOUTHERN CAPE MEN',
    'Joshua Du Plessis':'SOUTHERN CAPE JNR WHITE','Jaden De Villiers':'SOUTHERN CAPE JNR WHITE','Saxon Ansley':'SOUTHERN CAPE JNR WHITE',
    'Jack Magerla':'SOUTHERN CAPE JNR GREEN','Owen Lineker':'SOUTHERN CAPE JNR GREEN','Ben Groenewald':'SOUTHERN CAPE JNR GREEN',
    'Stephen Flemming':'WESTERN PROVINCE','Ossie Sauermann':'WESTERN PROVINCE','Gareth Decker':'WESTERN PROVINCE',
    'Riaz Hussain':'NATAL','Brandon Hooke':'NATAL','Sayed Cassiem':'NATAL',
    'Andrea Papachristoforou':'FREE STATE','Xavier Truluck':'FREE STATE','Phillip Papachristoforou':'FREE STATE',
  }
  return teamMap[name] || 'Unknown'
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const NAVY = '#1e3a8a'
const GOLD = '#d97706'
const GREEN = '#16a34a'

const S = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' },
  header: { background: NAVY, color: 'white', padding: '1rem 1.5rem', borderRadius: 8, marginBottom: '1.25rem' },
  card: { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  tab: (active) => ({
    flex: 1, padding: '0.65rem', border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.88rem',
    background: active ? NAVY : 'white',
    color: active ? 'white' : '#374151',
  }),
  medal: (pos) => {
    if (pos === 1) return { background: '#fef9c3', border: '2px solid #ca8a04' }
    if (pos === 2) return { background: '#f3f4f6', border: '2px solid #9ca3af' }
    if (pos === 3) return { background: '#fff7ed', border: '2px solid #c2410c' }
    return { background: 'white', border: '1px solid #e5e7eb' }
  },
  medalIcon: (pos) => pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `${pos}.`,
}

function MedalIcon({ pos }) {
  return <span style={{ fontWeight: 700, minWidth: 28, display: 'inline-block' }}>{S.medalIcon(pos)}</span>
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AllCoastalsScoreboard() {
  const [catches, setCatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [activeTab, setActiveTab] = useState('angler')
  const [dayFilter, setDayFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('allcoastals_catches')
      .select('*')
      .order('day_number')
    setCatches(data || [])
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  // ── Angler standings ──────────────────────────────────────────────────────

  const anglerStandings = Object.keys(BOAT_DRAW).map(name => {
    const rows = catches.filter(r => r.angler_name === name)
    const totalPct = rows.reduce((s, r) => s + (r.boat_percentage ?? 0), 0)
    const totalFish = rows.reduce((s, r) => s + (r.total_fish ?? 0), 0)
    const totalRawPts = rows.reduce((s, r) => s + (r.total_points ?? 0), 0)
    const daysEntered = rows.length
    const hasDQ = rows.some(r => r.disqualified)
    return { name, team: getAnglerTeam(name), totalPct, totalFish, totalRawPts, daysEntered, rows, hasDQ }
  }).sort((a, b) => {
    if (b.totalPct !== a.totalPct) return b.totalPct - a.totalPct
    if (b.totalFish !== a.totalFish) return b.totalFish - a.totalFish
    return b.totalRawPts - a.totalRawPts
  })

  // ── Team standings ────────────────────────────────────────────────────────

  const teamStandings = Object.keys(TEAMS).map(team => {
    const members = Object.entries(BOAT_DRAW)
      .filter(([name]) => getAnglerTeam(name) === team)
      .map(([name]) => name)
    const rows = catches.filter(r => members.includes(r.angler_name))
    const totalPct = rows.reduce((s, r) => s + (r.boat_percentage ?? 0), 0)
    const totalFish = rows.reduce((s, r) => s + (r.total_fish ?? 0), 0)
    const totalRawPts = rows.reduce((s, r) => s + (r.total_points ?? 0), 0)
    return { team, captain: TEAMS[team].captain, members, totalPct, totalFish, totalRawPts }
  }).sort((a, b) => {
    if (b.totalPct !== a.totalPct) return b.totalPct - a.totalPct
    if (b.totalFish !== a.totalFish) return b.totalFish - a.totalFish
    return b.totalRawPts - a.totalRawPts
  })

  // ── Skipper standings (grand prix — lowest wins) ──────────────────────────

  const skipperDailyAvg = {}
  for (const [boat] of Object.entries(SKIPPERS)) {
    for (let day = 1; day <= 3; day++) {
      // Include ALL anglers (incl. DQ) — DQ points still count toward skipper score
      const boatRows = catches.filter(r => r.boat_name === boat && r.day_number === day)
      if (boatRows.length === 0) continue
      const avg = boatRows.reduce((s, r) => s + (r.total_points ?? 0), 0) / boatRows.length
      if (!skipperDailyAvg[boat]) skipperDailyAvg[boat] = {}
      skipperDailyAvg[boat][day] = avg
    }
  }

  const skipperGPPoints = {}
  for (let day = 1; day <= 3; day++) {
    const boatsThisDay = Object.entries(skipperDailyAvg)
      .filter(([, days]) => days[day] !== undefined)
      .sort((a, b) => b[1][day] - a[1][day])
    boatsThisDay.forEach(([boat], idx) => {
      if (!skipperGPPoints[boat]) skipperGPPoints[boat] = { gp: 0, days: {}, avgByDay: {} }
      skipperGPPoints[boat].gp += (idx + 1)
      skipperGPPoints[boat].days[day] = idx + 1
      skipperGPPoints[boat].avgByDay[day] = skipperDailyAvg[boat][day]
    })
  }

  const skipperStandings = Object.entries(skipperGPPoints).map(([boat, data]) => ({
    boat,
    skipper: SKIPPERS[boat],
    gpTotal: data.gp,
    days: data.days,
    avgByDay: data.avgByDay,
    totalFish: catches.filter(r => r.boat_name === boat).reduce((s, r) => s + (r.total_fish ?? 0), 0),
    totalRawPts: catches.filter(r => r.boat_name === boat).reduce((s, r) => s + (r.total_points ?? 0), 0), // DQ points included
  })).sort((a, b) => {
    if (a.gpTotal !== b.gpTotal) return a.gpTotal - b.gpTotal
    if (b.totalFish !== a.totalFish) return b.totalFish - a.totalFish
    return b.totalRawPts - a.totalRawPts
  })

  // ── Stats ─────────────────────────────────────────────────────────────────

  const daysWithData = [1, 2, 3].filter(d => catches.some(r => r.day_number === d))
  const totalEntries = catches.length
  const totalFishAll = catches.reduce((s, r) => s + (r.total_fish ?? 0), 0)

  const speciesCounts = {}
  catches.forEach(r => {
    r.catches?.forEach(c => {
      if (c.fishCount > 0) speciesCounts[c.species] = (speciesCounts[c.species] || 0) + c.fishCount
    })
  })
  const topSpecies = Object.entries(speciesCounts).sort((a,b) => b[1]-a[1]).slice(0,5)

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>🏆 SADSAA All Coastal Bottomfish 2026</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 2 }}>Cape St Francis · Live Scoreboard</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button onClick={load} disabled={loading}
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              {loading ? '⟳ Loading…' : '⟳ Refresh'}
            </button>
            {lastRefresh && (
              <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: 3 }}>
                Updated {lastRefresh.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Scorecards', value: totalEntries },
            { label: 'Fish Recorded', value: totalFishAll },
            { label: 'Days Fished', value: daysWithData.length },
            { label: 'Top Species', value: topSpecies[0] ? `${topSpecies[0][0]} (${topSpecies[0][1]})` : '—' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        {[
          { id: 'angler',  label: '🎣 Anglers' },
          { id: 'team',    label: '🏅 Teams' },
          { id: 'skipper', label: '⚓ Skippers' },
          { id: 'daily',   label: '📋 Daily' },
          { id: 'stats',   label: '📊 Stats' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={S.tab(activeTab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ANGLER STANDINGS ── */}
      {activeTab === 'angler' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: NAVY }}>Individual Angler Standings</div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '1rem' }}>
            Ranked by cumulative boat % score. Tie-break: total fish count, then raw points.
          </div>
          {anglerStandings.filter(a => a.daysEntered > 0).length === 0 && (
            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No data yet — enter scorecards in the Catch Logger.</div>
          )}
          {anglerStandings.map((a, i) => {
            if (a.daysEntered === 0) return null
            const pos = i + 1
            return (
              <div key={a.name} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <MedalIcon pos={pos} />
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {a.name}{TEAMS[a.team]?.captain === a.name ? ' ⚓' : ''}
                    {a.hasDQ && <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#dc2626', color: 'white', padding: '1px 6px', borderRadius: 3, letterSpacing: 0.5 }}>DQ</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{a.team}</div>
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase' }}>Total %</div>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: NAVY }}>{a.totalPct.toFixed(2)}%</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase' }}>Fish</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: GREEN }}>{a.totalFish}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase' }}>Raw Pts</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#374151' }}>{a.totalRawPts}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase' }}>Days</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#374151' }}>{a.daysEntered}/3</div>
                  </div>
                </div>
                <div style={{ width: '100%', display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                  {a.rows.map(r => (
                    <span key={r.day_number} style={{ fontSize: '0.75rem', background: r.disqualified ? '#fef2f2' : '#eff6ff', color: r.disqualified ? '#dc2626' : NAVY, padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: r.disqualified ? 700 : 400 }}>
                      Day {r.day_number}: {r.disqualified ? '🚫 DQ' : `${r.boat_percentage?.toFixed(1)}% (${r.total_fish}🐟)`}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
          {anglerStandings.filter(a => a.daysEntered === 0).length > 0 && (
            <details style={{ marginTop: '0.75rem' }}>
              <summary style={{ fontSize: '0.82rem', color: '#9ca3af', cursor: 'pointer' }}>
                {anglerStandings.filter(a => a.daysEntered === 0).length} anglers not yet entered
              </summary>
              <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {anglerStandings.filter(a => a.daysEntered === 0).map(a => (
                  <span key={a.name} style={{ fontSize: '0.8rem', background: '#f3f4f6', padding: '0.2rem 0.6rem', borderRadius: 4, color: '#6b7280' }}>
                    {a.name}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── TEAM STANDINGS ── */}
      {activeTab === 'team' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: NAVY }}>Team Standings</div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '1rem' }}>
            Sum of all 3 anglers' cumulative boat % scores. Tie-break: total fish, then raw points.
          </div>
          {teamStandings.filter(t => t.totalPct > 0).length === 0 && (
            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No data yet.</div>
          )}
          {teamStandings.map((t, i) => {
            if (t.totalPct === 0) return null
            const pos = i + 1
            return (
              <div key={t.team} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <MedalIcon pos={pos} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700 }}>{t.team}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>⚓ {t.captain}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase' }}>Total %</div>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: NAVY }}>{t.totalPct.toFixed(2)}%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase' }}>Fish</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: GREEN }}>{t.totalFish}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase' }}>Raw Pts</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#374151' }}>{t.totalRawPts}</div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {t.members.map(m => {
                    const mRows = catches.filter(r => r.angler_name === m)
                    const mPct = mRows.reduce((s, r) => s + (r.boat_percentage ?? 0), 0)
                    return (
                      <span key={m} style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.06)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                        {m === t.captain ? '⚓ ' : ''}{m.split(' ')[0]}: {mPct.toFixed(1)}%
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {teamStandings.filter(t => t.totalPct === 0).length > 0 && (
            <details style={{ marginTop: '0.75rem' }}>
              <summary style={{ fontSize: '0.82rem', color: '#9ca3af', cursor: 'pointer' }}>
                {teamStandings.filter(t => t.totalPct === 0).length} teams not yet on the board
              </summary>
              <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {teamStandings.filter(t => t.totalPct === 0).map(t => (
                  <span key={t.team} style={{ fontSize: '0.8rem', background: '#f3f4f6', padding: '0.2rem 0.6rem', borderRadius: 4, color: '#6b7280' }}>{t.team}</span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── SKIPPER STANDINGS ── */}
      {activeTab === 'skipper' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: NAVY }}>Skipper Standings — Grand Prix</div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '1rem' }}>
            Daily position based on average angler points on boat. Lowest cumulative GP points wins.
            Tie-break: most fish, then highest raw points.
          </div>
          {skipperStandings.length === 0 && (
            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No data yet.</div>
          )}
          {skipperStandings.map((sk, i) => {
            const pos = i + 1
            return (
              <div key={sk.boat} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <MedalIcon pos={pos} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700 }}>{sk.skipper}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{sk.boat}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase' }}>GP Pts</div>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: GOLD }}>{sk.gpTotal}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase' }}>Fish</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: GREEN }}>{sk.totalFish}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase' }}>Avg Pts</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#374151' }}>
                        {sk.totalRawPts > 0 ? (sk.totalRawPts / Object.keys(sk.avgByDay).length).toFixed(1) : '—'}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {[1,2,3].map(d => sk.days[d] !== undefined ? (
                    <span key={d} style={{ fontSize: '0.75rem', background: '#eff6ff', color: NAVY, padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                      Day {d}: P{sk.days[d]} (avg {sk.avgByDay[d]?.toFixed(1)}pts)
                    </span>
                  ) : (
                    <span key={d} style={{ fontSize: '0.75rem', background: '#f3f4f6', color: '#9ca3af', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                      Day {d}: —
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
          {Object.entries(SKIPPERS).filter(([boat]) => !skipperGPPoints[boat]).map(([boat, skipper]) => (
            <div key={boat} style={{ border: '1px dashed #d1d5db', borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '0.3rem', color: '#9ca3af', fontSize: '0.85rem' }}>
              {skipper} ({boat}) — no data yet
            </div>
          ))}
        </div>
      )}

      {/* ── DAILY RESULTS ── */}
      {activeTab === 'daily' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {['all',1,2,3].map(d => (
              <button key={d} onClick={() => setDayFilter(d)}
                style={{ padding: '0.4rem 1rem', borderRadius: 20, border: '2px solid #1e3a8a', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                  background: dayFilter === d ? NAVY : 'white', color: dayFilter === d ? 'white' : NAVY }}>
                {d === 'all' ? 'All Days' : `Day ${d}`}
              </button>
            ))}
          </div>
          {Object.entries(SKIPPERS).map(([boat, skipper]) => {
            const days = dayFilter === 'all' ? [1,2,3] : [dayFilter]
            const boatRows = catches.filter(r => r.boat_name === boat && days.includes(r.day_number))
            if (boatRows.length === 0) return null
            return (
              <div key={boat} style={S.card}>
                <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>{boat}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>Skipper: {skipper}</div>
                {days.map(d => {
                  const dayRows = boatRows.filter(r => r.day_number === d)
                  if (dayRows.length === 0) return null
                  const qualifiedRows = dayRows.filter(r => !r.disqualified)
                  const maxPts = qualifiedRows.length > 0 ? Math.max(...qualifiedRows.map(r => r.total_points)) : 0
                  return (
                    <div key={d} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Day {d}</div>
                      {[...dayRows].sort((a,b) => b.total_points - a.total_points).map((r, idx) => (
                        <div key={r.angler_name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.6rem', borderRadius: 6, background: r.disqualified ? '#fef2f2' : idx === 0 ? '#fefce8' : '#f9fafb', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                          <span style={{ minWidth: 20, fontWeight: 700, color: '#6b7280' }}>{idx+1}.</span>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600 }}>{r.angler_name}</span>
                            {r.disqualified && <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#dc2626', color: 'white', padding: '1px 6px', borderRadius: 3, marginLeft: 6 }}>DQ</span>}
                            <span style={{ fontSize: '0.78rem', color: '#6b7280', marginLeft: 6 }}>{r.team_name}</span>
                            {r.disqualified && r.disqualified_reason && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginLeft: 6 }}>— {r.disqualified_reason}</span>}
                          </div>
                          <span style={{ fontWeight: 800, color: r.disqualified ? '#dc2626' : NAVY, minWidth: 52, textAlign: 'right' }}>
                            {r.disqualified ? '🚫 DQ' : r.boat_percentage != null ? `${r.boat_percentage}%` : `${r.total_points}pts`}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.total_fish}🐟 · {r.total_points}pts</span>
                          {!r.disqualified && r.total_points === maxPts && <span style={{ fontSize: '0.78rem', background: '#fef9c3', padding: '0.1rem 0.4rem', borderRadius: 4 }}>Boat winner</span>}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}
          {catches.filter(r => dayFilter === 'all' || r.day_number === dayFilter).length === 0 && (
            <div style={{ ...S.card, color: '#9ca3af', fontStyle: 'italic' }}>No data for selected day.</div>
          )}
        </div>
      )}

      {/* ── STATS ── */}
      {activeTab === 'stats' && (
        <div>
          <div style={S.card}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Top Species by Fish Count</div>
            {topSpecies.length === 0 && <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No data yet.</div>}
            {Object.entries(speciesCounts).sort((a,b) => b[1]-a[1]).map(([sp, count], i) => {
              const pct = (count / Math.max(...Object.values(speciesCounts))) * 100
              return (
                <div key={sp} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{sp}</span>
                    <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{count} fish</span>
                  </div>
                  <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? GOLD : NAVY, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Over-Line-Class Claims</div>
            {(() => {
              const olClaims = []
              catches.forEach(r => {
                r.catches?.forEach(c => {
                  if (c.overLineCount > 0) {
                    olClaims.push({ angler: r.angler_name, team: r.team_name, day: r.day_number, species: c.species, count: c.overLineCount })
                  }
                })
              })
              if (olClaims.length === 0) return <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No over-line-class fish recorded yet.</div>
              return olClaims.map((c, i) => (
                <div key={i} style={{ padding: '0.4rem 0.6rem', borderRadius: 6, background: '#fef3c7', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                  <strong>{c.angler}</strong> ({c.team}) — Day {c.day}: {c.count}× {c.species} over line class 🏆
                </div>
              ))
            })()}
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Record / PB / CV Claims</div>
            {(() => {
              const claims = catches.filter(r => r.record_claims?.length > 0)
              if (claims.length === 0) return <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No record claims yet.</div>
              return claims.map(r => (
                <div key={r.id} style={{ padding: '0.5rem 0.75rem', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', marginBottom: '0.4rem' }}>
                  <div style={{ fontWeight: 600 }}>{r.angler_name} — Day {r.day_number}</div>
                  {r.record_claims.map((c, i) => <div key={i} style={{ fontSize: '0.85rem', color: '#374151' }}>• {c}</div>)}
                </div>
              ))
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
