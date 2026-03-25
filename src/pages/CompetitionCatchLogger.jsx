import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  calcKillWeighPoints,
  calcBillfishPoints,
  calcTeamDayScore,
  calcSkipperGrandPrix,
  buildLeaderboard,
  getFamilyGroup,
  isAtBagLimit
} from '../utils/competitionScoring'

const COMPETITION_ID = 'ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77'
const BILLFISH_FAMILIES = ['Sailfish', 'Marlin']

const SCORING_SPECIES = [
  { name: 'Striped Bonito', release: false },
  { name: 'Blackfin Barracuda', release: false },
  { name: 'Great Barracuda', release: false },
  { name: 'Pickhandle Barracuda', release: false },
  { name: 'Sawtooth Barracuda', release: false },
  { name: 'King Mackerel/Cuta', release: false },
  { name: 'Dorado', release: false },
  { name: 'Cobia', release: false },
  { name: 'Double Spotted Queenfish', release: false },
  { name: 'Needlescaled Queenfish', release: false },
  { name: 'Talang Queenfish', release: false },
  { name: 'Giant Kingfish/GT', release: false },
  { name: 'Greater Yellowtail/Amberjack', release: false },
  { name: 'Eastern Little Tuna/Kawakawa', release: false },
  { name: 'Skipjack Tuna', release: false },
  { name: 'Yellowfin Tuna', release: false },
  { name: 'Wahoo', release: false },
  { name: 'Sailfish', release: true },
  { name: 'Black Marlin', release: true },
  { name: 'Blue Marlin', release: true },
  { name: 'Striped Marlin', release: true },
  { name: 'White Marlin', release: true },
]

export default function CompetitionCatchLogger() {
  const [teams, setTeams] = useState([])
  const [participants, setParticipants] = useState([])
  const [boats, setBoats] = useState([])
  const [days, setDays] = useState([])
  const [allCatches, setAllCatches] = useState([])
  const [dayCatches, setDayCatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeDay, setActiveDay] = useState(1)
  const [view, setView] = useState('log')

  const [form, setForm] = useState({
    team_id: '',
    angler_id: '',
    boat_id: '',
    species_name: '',
    weight_kg: '',
    notes: ''
  })

  useEffect(() => { loadData() }, [])
  useEffect(() => { loadCatches() }, [activeDay, days])

  useEffect(() => {
    if (form.team_id) {
      const first = participants.filter(p => p.team_id === form.team_id)[0]
      setForm(f => ({ ...f, angler_id: first?.id || '' }))
    }
  }, [form.team_id])

  const loadData = async () => {
    setLoading(true)
    const [teamsRes, participantsRes, boatsRes, daysRes] = await Promise.all([
      supabase.from('competition_teams').select('*').eq('competition_id', COMPETITION_ID).order('team_type').order('team_name'),
      supabase.from('competition_participants').select('*').eq('competition_id', COMPETITION_ID).order('full_name'),
      supabase.from('competition_boats').select('*').eq('competition_id', COMPETITION_ID).order('boat_name'),
      supabase.from('competition_days').select('*').eq('competition_id', COMPETITION_ID).order('day_number')
    ])
    setTeams(teamsRes.data || [])
    setParticipants(participantsRes.data || [])
    setBoats(boatsRes.data || [])
    setDays(daysRes.data || [])
    setLoading(false)
  }

  const loadCatches = async () => {
    if (days.length === 0) return
    const dayRecord = days.find(d => d.day_number === activeDay)
    if (!dayRecord) return

    const { data: day } = await supabase
      .from('competition_catches')
      .select('*')
      .eq('competition_id', COMPETITION_ID)
      .eq('competition_day_id', dayRecord.id)
      .order('catch_time', { ascending: false })
    setDayCatches(day || [])

    const { data: all } = await supabase
      .from('competition_catches')
      .select('*')
      .eq('competition_id', COMPETITION_ID)
    setAllCatches(all || [])
  }

  const activeDayRecord = days.find(d => d.day_number === activeDay)
  const selectedSpecies = SCORING_SPECIES.find(s => s.name === form.species_name)
  const isReleaseOnly = selectedSpecies?.release || false
  const teamParticipants = participants.filter(p => p.team_id === form.team_id)
  const anglerDayCatches = dayCatches.filter(c => c.angler_id === form.angler_id)
  const bagLimitReached = isAtBagLimit(anglerDayCatches)

  const getPointsPreview = () => {
    if (!form.species_name) return null
    const family = getFamilyGroup(form.species_name)
    if (BILLFISH_FAMILIES.includes(family)) {
      const releaseNum = dayCatches.filter(c =>
        c.team_id === form.team_id && getFamilyGroup(c.species_name) === family
      ).length + 1
      const pts = calcBillfishPoints(family, releaseNum)
      return { label: `Release #${releaseNum} — ${pts} pts` }
    }
    if (form.weight_kg && parseFloat(form.weight_kg) > 0) {
      const pts = Math.round(calcKillWeighPoints(parseFloat(form.weight_kg)) * 100) / 100
      return { label: `${pts} pts` }
    }
    return null
  }

  const pointsPreview = getPointsPreview()

  const handleSubmit = async () => {
    if (!form.team_id || !form.angler_id || !form.species_name) {
      alert('Please select a team, angler and species.')
      return
    }
    if (!isReleaseOnly && !form.weight_kg) {
      alert('Please enter a weight for this species.')
      return
    }
    if (bagLimitReached) {
      alert('This angler has reached the daily bag limit of 10 fish.')
      return
    }
    if (!activeDayRecord) {
      alert('Could not find competition day record.')
      return
    }

    setSaving(true)
    const family = getFamilyGroup(form.species_name)
    let points = 0

    if (BILLFISH_FAMILIES.includes(family)) {
      const releaseNum = dayCatches.filter(c =>
        c.team_id === form.team_id && getFamilyGroup(c.species_name) === family
      ).length + 1
      points = calcBillfishPoints(family, releaseNum)
    } else {
      points = Math.round(calcKillWeighPoints(parseFloat(form.weight_kg || 0)) * 100) / 100
    }

    const { error } = await supabase.from('competition_catches').insert([{
      competition_id: COMPETITION_ID,
      competition_day_id: activeDayRecord.id,
      team_id: form.team_id,
      angler_id: form.angler_id,
      boat_id: form.boat_id || null,
      fishing_date: activeDayRecord.date,
      species_name: form.species_name,
      line_class_kg: 10,
      weight_kg: isReleaseOnly ? null : parseFloat(form.weight_kg),
      retained: !isReleaseOnly,
      points: points,
      entered_by: 'Shore Official',
      notes: form.notes || null
    }])

    if (error) {
      alert('Error saving catch: ' + error.message)
    } else {
      setForm(f => ({ ...f, species_name: '', weight_kg: '', notes: '' }))
      loadCatches()
    }
    setSaving(false)
  }

  const deleteCatch = async (id) => {
    if (!confirm('Delete this catch?')) return
    await supabase.from('competition_catches').delete().eq('id', id)
    loadCatches()
  }

  const getTeamDayScore = (teamId) => {
    const catches = dayCatches.filter(c => c.team_id === teamId)
    return calcTeamDayScore(catches)
  }

  const leaderboard = buildLeaderboard(allCatches, teams)

  const skipperLeaderboard = () => {
    const byDay = {}
    allCatches.forEach(c => {
      if (!c.boat_id) return
      const key = `${c.boat_id}_${c.competition_day_id}`
      if (!byDay[key]) byDay[key] = { boat_id: c.boat_id, day_id: c.competition_day_id, catches: [] }
      byDay[key].catches.push(c)
    })

    const dailyByDay = {}
    Object.values(byDay).forEach(({ boat_id, day_id, catches }) => {
      if (!dailyByDay[day_id]) dailyByDay[day_id] = []
      dailyByDay[day_id].push({ boat_id, totalPoints: calcTeamDayScore(catches).finalScore })
    })

    const grandPrixTotals = {}
    Object.values(dailyByDay).forEach(dayScores => {
      calcSkipperGrandPrix(dayScores).forEach(({ boat_id, grandPrixPoints }) => {
        grandPrixTotals[boat_id] = (grandPrixTotals[boat_id] || 0) + grandPrixPoints
      })
    })

    return boats
      .map(b => ({ ...b, grandPrixTotal: grandPrixTotals[b.id] || 0 }))
      .sort((a, b) => {
        if (a.grandPrixTotal === 0 && b.grandPrixTotal === 0) return 0
        if (a.grandPrixTotal === 0) return 1
        if (b.grandPrixTotal === 0) return -1
        return a.grandPrixTotal - b.grandPrixTotal
      })
  }

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading competition data...</div>
  )

  const medal = idx => idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : idx === 2 ? '#b45309' : '#e5e7eb'

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', paddingBottom: '3rem' }}>

      {/* Header */}
      <div style={{ background: '#1e3a8a', color: 'white', padding: '1rem 1.5rem' }}>
        <div style={{ fontSize: '0.7rem', opacity: 0.7, letterSpacing: '0.1em', textTransform: 'uppercase' }}>SADSAA</div>
        <div style={{ fontSize: '1.2rem', fontWeight: '800' }}>Junior Gamefish Nationals 2026</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>Sodwana Bay • 30 Mar – 2 Apr • 10kg Line Class</div>
      </div>

      {/* Day Tabs */}
      <div style={{ background: '#1e40af', padding: '0.6rem 1rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        {[1,2,3,4].map(d => (
          <button key={d} onClick={() => setActiveDay(d)} style={{
            padding: '0.35rem 0.9rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
            fontWeight: '700', fontSize: '0.8rem',
            background: activeDay === d ? 'white' : 'rgba(255,255,255,0.2)',
            color: activeDay === d ? '#1e3a8a' : 'white'
          }}>Day {d}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem' }}>
          {activeDayRecord?.date || ''}
        </span>
      </div>

      {/* View Tabs */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '2px solid #e5e7eb' }}>
        {[['log','🎣 Log'],['leaderboard','🏆 Teams'],['skippers','⚓ Skippers']].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '0.7rem 0.25rem', border: 'none', cursor: 'pointer',
            fontWeight: '600', fontSize: '0.8rem', background: 'none',
            borderBottom: view === v ? '3px solid #1e3a8a' : '3px solid transparent',
            color: view === v ? '#1e3a8a' : '#6b7280'
          }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>

        {/* LOG VIEW */}
        {view === 'log' && (
          <>
            <div style={{ background: 'white', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: '800', color: '#1e3a8a', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Log Catch — Day {activeDay}
              </h3>

              {/* Team */}
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem' }}>Team *</label>
                <select value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value, angler_id: '' }))}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}>
                  <option value="">— Select team —</option>
                  <optgroup label="U/19">
                    {teams.filter(t => t.team_type === 'U19').map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                  </optgroup>
                  <optgroup label="U/16">
                    {teams.filter(t => t.team_type === 'U16').map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                  </optgroup>
                </select>
              </div>

              {/* Angler */}
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: bagLimitReached ? '#ef4444' : '#374151', marginBottom: '0.3rem' }}>
                  Angler * {bagLimitReached && '⚠ BAG LIMIT REACHED (10)'}
                </label>
                <select value={form.angler_id} onChange={e => setForm(f => ({ ...f, angler_id: e.target.value }))}
                  disabled={!form.team_id}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: bagLimitReached ? '2px solid #ef4444' : '1px solid #d1d5db', fontSize: '0.9rem', background: !form.team_id ? '#f9fafb' : 'white' }}>
                  <option value="">— Select angler —</option>
                  {teamParticipants.map(p => {
                    const cnt = dayCatches.filter(c => c.angler_id === p.id).length
                    return <option key={p.id} value={p.id}>{p.full_name} ({p.category}) — {cnt}/10</option>
                  })}
                </select>
              </div>

              {/* Boat */}
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem' }}>Boat</label>
                <select value={form.boat_id} onChange={e => setForm(f => ({ ...f, boat_id: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}>
                  <option value="">— Select boat —</option>
                  {boats.map(b => <option key={b.id} value={b.id}>{b.boat_name} — {b.skipper_name}</option>)}
                </select>
              </div>

              {/* Species */}
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem' }}>Species *</label>
                <select value={form.species_name}
                  onChange={e => setForm(f => ({ ...f, species_name: e.target.value, weight_kg: '' }))}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}>
                  <option value="">— Select species —</option>
                  <optgroup label="Kill & Weigh">
                    {SCORING_SPECIES.filter(s => !s.release).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </optgroup>
                  <optgroup label="🔵 Billfish — Release Only">
                    {SCORING_SPECIES.filter(s => s.release).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </optgroup>
                </select>
              </div>

              {/* Billfish notice */}
              {isReleaseOnly && (
                <div style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '6px', padding: '0.65rem', marginBottom: '0.875rem', fontSize: '0.825rem', color: '#1e40af' }}>
                  🔵 <strong>Billfish — Catch & Release only.</strong> No weight required.
                </div>
              )}

              {/* Weight */}
              {!isReleaseOnly && form.species_name && (
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem' }}>Weight (kg) *</label>
                  <input type="number" step="0.01" min="0" value={form.weight_kg}
                    onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
                    placeholder="e.g. 12.50"
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '1rem' }} />
                </div>
              )}

              {/* Points preview */}
              {pointsPreview && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '0.6rem 0.875rem', marginBottom: '0.875rem', fontSize: '0.85rem', color: '#166534', fontWeight: '600' }}>
                  📊 Estimated: {pointsPreview.label}
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem' }}>Notes (optional)</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any details..."
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
              </div>

              <button onClick={handleSubmit} disabled={saving || bagLimitReached} style={{
                width: '100%', padding: '0.85rem',
                background: saving || bagLimitReached ? '#9ca3af' : '#1e3a8a',
                color: 'white', border: 'none', borderRadius: '6px',
                fontSize: '1rem', fontWeight: '800', cursor: saving || bagLimitReached ? 'not-allowed' : 'pointer'
              }}>
                {saving ? 'Saving...' : bagLimitReached ? '⚠ Bag Limit Reached' : '✓ Save Catch'}
              </button>
            </div>

            {/* Day catches list */}
            <h3 style={{ fontWeight: '700', color: '#1f2937', fontSize: '0.9rem', marginBottom: '0.6rem' }}>
              Day {activeDay} Catches ({dayCatches.length})
            </h3>
            {dayCatches.length === 0 ? (
              <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                No catches logged yet.
              </div>
            ) : dayCatches.map(c => {
              const team = teams.find(t => t.id === c.team_id)
              const angler = participants.find(p => p.id === c.angler_id)
              const boat = boats.find(b => b.id === c.boat_id)
              return (
                <div key={c.id} style={{
                  background: 'white', borderRadius: '8px', padding: '0.75rem 1rem',
                  marginBottom: '0.4rem', boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#111827' }}>
                      {c.species_name}
                      {!c.retained && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', background: '#dbeafe', color: '#1e40af', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>Released</span>}
                    </div>
                    <div style={{ fontSize: '0.775rem', color: '#6b7280' }}>
                      {angler?.full_name} • {team?.team_name}{boat ? ` • ${boat.boat_name}` : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.1rem', display: 'flex', gap: '0.75rem' }}>
                      {c.weight_kg && <span style={{ color: '#059669', fontWeight: '600' }}>{parseFloat(c.weight_kg).toFixed(2)} kg</span>}
                      {c.points > 0 && <span style={{ color: '#7c3aed', fontWeight: '600' }}>{c.points} pts</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteCatch(c.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '1rem', padding: '0.25rem 0.5rem' }}>✕</button>
                </div>
              )
            })}
          </>
        )}

        {/* LEADERBOARD VIEW */}
        {view === 'leaderboard' && ['U19', 'U16'].map(cat => (
          <div key={cat} style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontWeight: '800', color: '#1e3a8a', marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🏆 {cat === 'U19' ? 'Under 19' : 'Under 16'}
            </h3>
            {leaderboard[cat].map((team, idx) => {
              const day = getTeamDayScore(team.id)
              return (
                <div key={team.id} style={{
                  background: 'white', borderRadius: '8px', padding: '0.875rem 1rem',
                  marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.07)',
                  display: 'flex', alignItems: 'center', gap: '0.875rem'
                }}>
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', flexShrink: 0, background: medal(idx), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.875rem', color: idx < 3 ? 'white' : '#6b7280' }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#111827' }}>{team.team_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {team.totalFish} fish{team.totalReleases > 0 ? ` • ${team.totalReleases} releases` : ''}
                    </div>
                    {day.catchCount > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#7c3aed' }}>
                        Day {activeDay}: {day.finalScore} pts{day.multiplier > 1 ? ` (×${day.multiplier} species bonus)` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#1e3a8a' }}>{team.totalScore}</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>total pts</div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* SKIPPERS VIEW */}
        {view === 'skippers' && (
          <div>
            <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#92400e' }}>
              ⚓ Lowest grand prix points wins. Updates live as catches are logged.
            </div>
            {skipperLeaderboard().map((boat, idx) => (
              <div key={boat.id} style={{
                background: 'white', borderRadius: '8px', padding: '0.875rem 1rem',
                marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.07)',
                display: 'flex', alignItems: 'center', gap: '0.875rem'
              }}>
                <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', flexShrink: 0, background: medal(idx), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.875rem', color: idx < 3 ? 'white' : '#6b7280' }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#111827' }}>{boat.boat_name}</div>
                  <div style={{ fontSize: '0.775rem', color: '#6b7280' }}>{boat.skipper_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#1e3a8a' }}>{boat.grandPrixTotal || '—'}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>GP pts</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
