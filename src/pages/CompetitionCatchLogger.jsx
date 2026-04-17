import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { generateResultsPDF, generateIntResultsPDF } from '../utils/competitionPDF'
import CompetitionAdminPanel from './CompetitionAdmin'
import { supabase } from '../lib/supabase'
import {
  calcKillWeighPoints, calcKingfishPoints, calcTeamDayScore,
  calcSkipperGrandPrix, buildLeaderboard, getFamilyGroup,
  isAtBagLimit, isAtKingfishLimit, isBillfish, isGT, isOtherKingfish,
  isKingfish, checkGamefishMinimums, GAMEFISH_BAG_LIMIT, GT_SCORE_KG, KINGFISH_SCORE_KG,
  calcTunaPoints, checkTunaMinimums, isAtTunaBagLimit,
  calcTunaTeamDayScore, buildTunaLeaderboard, TUNA_LINE_CLASS_FACTORS,
  TUNA_MIN_WEIGHTS, TUNA_SPECIES, TUNA_BAG_LIMIT
} from '../utils/competitionScoring'

const COMPETITIONS = [
  {
    id: 'ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77',
    name: 'Junior Gamefish Nationals 2026',
    type: 'gamefish',
    venue: 'Sodwana Bay',
    dates: '30 Mar – 3 Apr 2026',
    days: 5,
    startDate: '2026-03-30'
  },
  {
    id: 'ff6e95a9-4f9e-4b54-ad47-a913831d336c',
    name: 'Tuna Nationals 2026',
    type: 'tuna',
    venue: 'Atlantic Boat Club, Hout Bay',
    dates: '13 – 17 Apr 2026',
    days: 5,
    startDate: '2026-04-13'
  },
  {
    id: '4a905558-8a94-4dc2-8305-bce37bfc1fe4',
    name: 'Tuna International 2026',
    type: 'tuna',
    venue: 'Atlantic Boat Club, Hout Bay',
    dates: '13 – 17 Apr 2026',
    days: 5,
    startDate: '2026-04-13'
  }
]

const GAMEFISH_SPECIES = [
  { name: 'Striped Bonito', release: false, tuna: true },
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
  { name: 'Greater Yellowtail/Amberjack', release: false },
  { name: 'Eastern Little Tuna/Kawakawa', release: false, tuna: true },
  { name: 'Skipjack Tuna', release: false, tuna: true },
  { name: 'Yellowfin Tuna', release: false, tuna: true },
  { name: 'Wahoo', release: false },
  { name: 'Giant Kingfish/GT', release: true, kingfish: true, gt: true },
  { name: 'Bluefin Kingfish', release: true, kingfish: true },
  { name: 'Blacktip Kingfish', release: true, kingfish: true },
  { name: 'Yellowspot Kingfish', release: true, kingfish: true },
  { name: 'Sailfish', release: true, billfish: true },
  { name: 'Black Marlin', release: true, billfish: true },
  { name: 'Blue Marlin', release: true, billfish: true },
  { name: 'Striped Marlin', release: true, billfish: true },
  { name: 'White Marlin', release: true, billfish: true },
]

const TUNA_SCORING_SPECIES = [
  { name: 'Yellowfin Tuna', minWeight: 20 },
  { name: 'Bigeye Tuna', minWeight: 20 },
  { name: 'Southern Bluefin Tuna', minWeight: 20 },
  { name: 'Longfin Tuna', minWeight: 10 },
]

const NAVY = '#1e3a8a'
const medal = idx => idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : idx === 2 ? '#b45309' : '#e5e7eb'

// ── COMPETITION SELECTOR ─────────────────────────────────────
function CompetitionSelector({ onSelect }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <div style={{ background: NAVY, color: 'white', padding: '1.5rem' }}>
        <div style={{ fontSize: '0.7rem', opacity: 0.7, letterSpacing: '0.1em', textTransform: 'uppercase' }}>SADSAA</div>
        <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>RecFish ZA</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>Competition Catch Logger</div>
      </div>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>
        <h2 style={{ fontWeight: '800', color: '#1f2937', marginBottom: '1.25rem', fontSize: '1rem' }}>
          Select Competition
        </h2>
        {COMPETITIONS.map(comp => (
          <button
            key={comp.id}
            onClick={() => onSelect(comp)}
            style={{
              width: '100%', background: 'white', border: '2px solid #e5e7eb',
              borderRadius: '10px', padding: '1.25rem', marginBottom: '0.75rem',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = NAVY; e.currentTarget.style.background = '#eff6ff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'white' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '800', fontSize: '1rem', color: NAVY, marginBottom: '0.35rem' }}>
                  {comp.name}
                </div>
                <div style={{ fontSize: '0.825rem', color: '#6b7280' }}>{comp.venue}</div>
                <div style={{ fontSize: '0.825rem', color: '#6b7280' }}>{comp.dates}</div>
              </div>
              <span style={{
                padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700',
                background: comp.type === 'tuna' ? '#fef3c7' : '#dbeafe',
                color: comp.type === 'tuna' ? '#92400e' : '#1e40af',
                whiteSpace: 'nowrap', flexShrink: 0
              }}>
                {comp.type === 'tuna' ? '🐟 Tuna' : '🎣 Gamefish'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── MAIN LOGGER ──────────────────────────────────────────────
export default function CompetitionCatchLogger() {
  const [selectedComp, setSelectedComp] = useState(null)
  const [teams, setTeams] = useState([])
  const [participants, setParticipants] = useState([])
  const [boats, setBoats] = useState([])
  const [days, setDays] = useState([])
  const [allCatches, setAllCatches] = useState([])
  const [dayCatches, setDayCatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeDay, setActiveDay] = useState(1)
  const [view, setView] = useState('log')

  // Line class per team per day (tuna only)
  const [teamLineClass, setTeamLineClass] = useState({})

  const [form, setForm] = useState({
    team_id: '', angler_id: '', species_name: '',
    weight_kg: '', length_cm: '', scoring: true, notes: ''
  })

  const [generating, setGenerating] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const { user } = useAuth()
  const ADMIN_EMAILS = ['malcolmmurchgrant@gmail.com','mpca99@telkomsa.net','wpdsaa@mweb.co.za']
  const userEmail = (user?.email || user?.user_metadata?.email || '').toLowerCase()
  const isAdmin = ADMIN_EMAILS.includes(userEmail)
  const isTuna = selectedComp?.type === 'tuna'
  const isGamefish = selectedComp?.type === 'gamefish'

  useEffect(() => {
    if (selectedComp) loadData()
  }, [selectedComp])

  useEffect(() => {
    if (selectedComp) loadCatches()
  }, [activeDay, days])

  useEffect(() => {
    if (form.team_id) {
      const first = participants.filter(p => p.team_id === form.team_id)[0]
      setForm(f => ({ ...f, angler_id: first?.id || '' }))
    }
  }, [form.team_id])

  const loadData = async () => {
    setLoading(true)
    const [teamsRes, participantsRes, boatsRes, daysRes] = await Promise.all([
      supabase.from('competition_teams').select('*').eq('competition_id', selectedComp.id).order('team_name'),
      supabase.from('competition_participants').select('*').eq('competition_id', selectedComp.id).order('full_name'),
      supabase.from('competition_boats').select('*').eq('competition_id', selectedComp.id).order('boat_name'),
      supabase.from('competition_days').select('*').eq('competition_id', selectedComp.id).order('day_number')
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
    const { data: day } = await supabase.from('competition_catches').select('*')
      .eq('competition_id', selectedComp.id).eq('competition_day_id', dayRecord.id)
      .order('catch_time', { ascending: false })
    setDayCatches(day || [])
    const { data: all } = await supabase.from('competition_catches').select('*')
      .eq('competition_id', selectedComp.id)
    setAllCatches(all || [])
  }

  const activeDayRecord = days.find(d => d.day_number === activeDay)
  const isDayHidden = activeDayRecord?.session_status === 'hidden'
  const teamParticipants = participants.filter(p => p.team_id === form.team_id)
  const anglerDayCatches = dayCatches.filter(c => c.angler_id === form.angler_id)
  const currentLineClass = teamLineClass[`${form.team_id}_${activeDay}`] || 10

  // Get boat for a team
  const getTeamBoat = (teamId) => {
    const team = teams.find(t => t.id === teamId)
    if (!team?.boat_id) return null
    return boats.find(b => b.id === team.boat_id)
  }

  // Gamefish validations
  const selectedGamefishSpecies = GAMEFISH_SPECIES.find(s => s.name === form.species_name)
  const isReleaseOnly = selectedGamefishSpecies?.release || false
  const speciesIsBillfish = selectedGamefishSpecies?.billfish || false
  const speciesIsKingfish = selectedGamefishSpecies?.kingfish || false
  const speciesIsGT = selectedGamefishSpecies?.gt || false
  const bagLimitReached = isGamefish
    ? isAtBagLimit(anglerDayCatches)
    : isAtTunaBagLimit(anglerDayCatches)
  const gtLimitReached = isGamefish && form.team_id && speciesIsGT &&
    isAtKingfishLimit(dayCatches.filter(c => c.team_id === form.team_id), 'GT')
  const kingfishLimitReached = isGamefish && form.team_id && speciesIsKingfish && !speciesIsGT &&
    isAtKingfishLimit(dayCatches.filter(c => c.team_id === form.team_id), 'other')

  const getValidationError = () => {
    if (!form.team_id || !form.angler_id || !form.species_name) return null
    if (bagLimitReached) return `Bag limit reached (${isTuna ? TUNA_BAG_LIMIT : GAMEFISH_BAG_LIMIT} fish/day)`
    if (isGamefish) {
      if (gtLimitReached) return 'Team GT limit reached (1 per day)'
      if (kingfishLimitReached) return 'Team kingfish limit reached (1 per day)'
      if (!isReleaseOnly && !speciesIsKingfish && form.weight_kg) {
        const check = checkGamefishMinimums(form.species_name, form.weight_kg, null)
        if (!check.valid) return check.reason
      }
      if (speciesIsKingfish && form.length_cm) {
        const check = checkGamefishMinimums(form.species_name, null, form.length_cm)
        if (!check.valid) return check.reason
      }
    }
    if (isTuna && form.weight_kg && form.scoring) {
      const check = checkTunaMinimums(form.species_name, form.weight_kg)
      if (!check.valid) return check.reason
    }
    return null
  }

  const validationError = getValidationError()

  const getPointsPreview = () => {
    if (!form.species_name) return null
    if (isGamefish) {
      if (speciesIsBillfish) return { label: '0 pts (counts for species multiplier only)' }
      if (speciesIsGT) return { label: `${Math.round(calcKingfishPoints(form.species_name) * 100) / 100} pts (scores as ${GT_SCORE_KG}kg)` }
      if (speciesIsKingfish) return { label: `${Math.round(calcKingfishPoints(form.species_name) * 100) / 100} pts (scores as ${KINGFISH_SCORE_KG}kg)` }
      if (form.weight_kg && parseFloat(form.weight_kg) > 0)
        return { label: `${Math.round(calcKillWeighPoints(parseFloat(form.weight_kg)) * 100) / 100} pts` }
    }
    if (isTuna && form.weight_kg && parseFloat(form.weight_kg) > 0 && form.scoring) {
      const pts = calcTunaPoints(parseFloat(form.weight_kg), currentLineClass)
      return { label: `${pts} pts (${currentLineClass}kg line class)` }
    }
    return null
  }

  const pointsPreview = getPointsPreview()

  const handleSubmit = async () => {
    if (!form.team_id || !form.angler_id || !form.species_name) {
      alert('Please select a team, angler and species.')
      return
    }
    if (form.species_name !== 'No Catch') {
      if (isGamefish && !isReleaseOnly && !speciesIsKingfish && !form.weight_kg) {
        alert('Please enter a weight.')
        return
      }
      if (isGamefish && speciesIsKingfish && !form.length_cm) {
        alert('Please enter a length for kingfish.')
        return
      }
      if (isTuna && !form.weight_kg) {
        alert('Please enter a weight.')
        return
      }
    }
    if (validationError && form.species_name !== 'No Catch') { alert(validationError); return }
    if (!activeDayRecord) { alert('Could not find competition day record.'); return }

    setSaving(true)
    let points = 0
    const boat = getTeamBoat(form.team_id)

    if (form.species_name === 'No Catch') {
      points = 0
    } else if (isGamefish) {
      if (speciesIsBillfish) points = 0
      else if (speciesIsKingfish) points = Math.round(calcKingfishPoints(form.species_name) * 100) / 100
      else points = Math.round(calcKillWeighPoints(parseFloat(form.weight_kg || 0)) * 100) / 100
    } else {
      points = form.scoring ? calcTunaPoints(parseFloat(form.weight_kg || 0), currentLineClass) : 0
    }

    const { error } = await supabase.from('competition_catches').insert([{
      competition_id: selectedComp.id,
      competition_day_id: activeDayRecord.id,
      team_id: form.team_id,
      angler_id: form.angler_id,
      boat_id: boat?.id || null,
      fishing_date: activeDayRecord.date,
      species_name: form.species_name,
      line_class_kg: isTuna ? currentLineClass : 10,
      weight_kg: (form.species_name === 'No Catch' || (isGamefish && isReleaseOnly)) ? null : parseFloat(form.weight_kg) || null,
      length_cm: form.length_cm ? parseFloat(form.length_cm) : null,
      retained: isGamefish ? !isReleaseOnly : true,
      points: points,
      entered_by: null,
      notes: form.notes || null
    }])

    if (error) {
      alert('Error saving catch: ' + error.message)
    } else {
      setForm(f => ({ ...f, species_name: '', weight_kg: '', length_cm: '', notes: '', scoring: true }))
      loadCatches()
    }
    setSaving(false)
  }

  const deleteCatch = async (id) => {
    if (!confirm('Delete this catch?')) return
    await supabase.from('competition_catches').delete().eq('id', id)
    loadCatches()
  }

  // Leaderboards
  const gamefishLeaderboard = isGamefish ? buildLeaderboard(allCatches, teams) : { U19: [], U16: [] }
  const tunaLeaderboard = isTuna ? buildTunaLeaderboard(allCatches, teams) : []

  const getTeamDayScore = (teamId) => {
    const catches = dayCatches.filter(c => c.team_id === teamId)
    return isGamefish ? calcTeamDayScore(catches) : calcTunaTeamDayScore(catches)
  }

  const skipperLeaderboard = () => {
    // Accumulated catch points — highest wins
    const boatTotals = {}
    allCatches.forEach(c => {
      if (!c.boat_id || !c.weight_kg || c.scoring === false) return
      const pts = parseFloat(c.points || 0)
      if (!boatTotals[c.boat_id]) boatTotals[c.boat_id] = { total: 0, fish: 0, weight: 0 }
      boatTotals[c.boat_id].total  += pts
      boatTotals[c.boat_id].fish   += 1
      boatTotals[c.boat_id].weight += parseFloat(c.weight_kg)
    })
    return boats
      .map(b => ({ ...b, grandPrixTotal: Math.round((boatTotals[b.id]?.total || 0) * 100) / 100 }))
      .sort((a, b) => {
        if (a.grandPrixTotal === 0 && b.grandPrixTotal === 0) return 0
        if (a.grandPrixTotal === 0) return 1
        if (b.grandPrixTotal === 0) return -1
        return b.grandPrixTotal - a.grandPrixTotal
      })
  }

  const handleGeneratePDF = async (dayNumber) => {
    if (!selectedComp || selectedComp.type !== 'tuna') return
    setGenerating(true)
    try {
      if (selectedComp.id === '4a905558-8a94-4dc2-8305-bce37bfc1fe4') {
        await generateIntResultsPDF(supabase, dayNumber)
      } else {
        await generateResultsPDF(supabase, dayNumber)
      }
    } catch (err) {
      alert('Error generating PDF: ' + err.message)
    }
    setGenerating(false)
  }

  if (showAdmin) return <CompetitionAdminPanel onClose={() => { setShowAdmin(false); }} />

  if (!selectedComp) return <CompetitionSelector onSelect={c => { setSelectedComp(c); setActiveDay(1); setView('log') }} />

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading competition data...</div>
  )

  const canSubmit = !saving && !bagLimitReached && !gtLimitReached && !kingfishLimitReached && !validationError

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', paddingBottom: '3rem' }}>

      {/* Header */}
      <div style={{ background: NAVY, color: 'white', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isAdmin ? (
            <button onClick={() => setShowAdmin(true)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' }}>
              Admin
            </button>
          ) : (
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>{userEmail || 'not logged in'}</span>
          )}
          <button onClick={() => { setSelectedComp(null); setTeams([]); setParticipants([]); setBoats([]); setDays([]); setAllCatches([]); setDayCatches([]) }}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
          ← All Competitions
        </button>
        </div>
        <div style={{ fontSize: '0.7rem', opacity: 0.7, letterSpacing: '0.1em', textTransform: 'uppercase' }}>SADSAA</div>
        <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>{selectedComp.name}</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>{selectedComp.venue} • {selectedComp.dates}</div>
      </div>

      {/* Day Tabs */}
      <div style={{ background: '#1e40af', padding: '0.6rem 1rem', display: 'flex', gap: '0.4rem', alignItems: 'center', overflowX: 'auto' }}>
        {Array.from({ length: selectedComp.days }, (_, i) => i + 1).map(d => (
          <button key={d} onClick={() => setActiveDay(d)} style={{
            padding: '0.35rem 0.9rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
            fontWeight: '700', fontSize: '0.8rem', flexShrink: 0,
            background: activeDay === d ? 'white' : 'rgba(255,255,255,0.2)',
            color: activeDay === d ? NAVY : 'white'
          }}>Day {d}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', flexShrink: 0 }}>
          {activeDayRecord?.date || ''}
        </span>
      </div>

      {/* View Tabs */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '2px solid #e5e7eb' }}>
        {[['log','🎣 Log'],['leaderboard','🏆 Teams'],['skippers','⚓ Skippers']].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '0.7rem 0.25rem', border: 'none', cursor: 'pointer',
            fontWeight: '600', fontSize: '0.8rem', background: 'none',
            borderBottom: view === v ? `3px solid ${NAVY}` : '3px solid transparent',
            color: view === v ? NAVY : '#6b7280'
          }}>{label}</button>
        ))}
      </div>

      {/* PDF Generation — Tuna only */}
      {isTuna && (
        <div style={{ background: '#f0fdf4', borderBottom: '1px solid #86efac', padding: '0.6rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: '600', flexShrink: 0 }}>Generate Official Results:</span>
          <button
            onClick={() => handleGeneratePDF(activeDay)}
            disabled={generating}
            style={{ padding: '0.35rem 0.8rem', background: generating ? '#9ca3af' : '#166534', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: generating ? 'not-allowed' : 'pointer', flexShrink: 0 }}
          >
            {generating ? 'Generating...' : `Day ${activeDay} Results`}
          </button>
          <button
            onClick={() => handleGeneratePDF(null)}
            disabled={generating}
            style={{ padding: '0.35rem 0.8rem', background: generating ? '#9ca3af' : '#1e3a8a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: generating ? 'not-allowed' : 'pointer', flexShrink: 0 }}
          >
            {generating ? 'Generating...' : 'Final Results'}
          </button>
        </div>
      )}

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>

        {/* LOG VIEW */}
        {view === 'log' && (
          <>
            <div style={{ background: 'white', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: '800', color: NAVY, marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Log Catch — Day {activeDay}
              </h3>

              {/* Team */}
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem' }}>Team *</label>
                <select value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value, angler_id: '' }))}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}>
                  <option value="">— Select team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                </select>
              </div>

              {/* Show assigned boat for tuna */}
              {isTuna && form.team_id && (() => {
                const boat = getTeamBoat(form.team_id)
                return boat ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '0.6rem 0.875rem', marginBottom: '0.875rem', fontSize: '0.825rem', color: '#166534' }}>
                    ⛵ <strong>{boat.boat_name}</strong> — Skipper: {boat.skipper_name}
                  </div>
                ) : null
              })()}

              {/* Line class selector — tuna only */}
              {isTuna && form.team_id && (
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem' }}>
                    Line Class for Day {activeDay} *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[10, 15].map(lc => (
                      <label key={lc} style={{
                        display: 'flex', alignItems: 'center', padding: '0.6rem',
                        border: currentLineClass === lc ? `2px solid ${NAVY}` : '1px solid #d1d5db',
                        borderRadius: '6px', cursor: 'pointer',
                        background: currentLineClass === lc ? '#eff6ff' : 'white'
                      }}>
                        <input type="radio" name="lineClass" value={lc}
                          checked={currentLineClass === lc}
                          onChange={() => setTeamLineClass(prev => ({ ...prev, [`${form.team_id}_${activeDay}`]: lc }))}
                          style={{ marginRight: '0.5rem' }} />
                        <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{lc}kg</span>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.35rem' }}>
                          (×{TUNA_LINE_CLASS_FACTORS[lc]})
                        </span>
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.3rem' }}>
                    ⚠ Line class cannot be changed during the day
                  </div>
                </div>
              )}

              {/* Angler */}
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: bagLimitReached ? '#ef4444' : '#374151', marginBottom: '0.3rem' }}>
                  Angler * {bagLimitReached && `⚠ BAG LIMIT (${isTuna ? TUNA_BAG_LIMIT : GAMEFISH_BAG_LIMIT}/day)`}
                </label>
                <select value={form.angler_id} onChange={e => setForm(f => ({ ...f, angler_id: e.target.value }))}
                  disabled={!form.team_id}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: bagLimitReached ? '2px solid #ef4444' : '1px solid #d1d5db', fontSize: '0.9rem', background: !form.team_id ? '#f9fafb' : 'white' }}>
                  <option value="">— Select angler —</option>
                  {teamParticipants.map(p => {
                    const cnt = dayCatches.filter(c => c.angler_id === p.id).length
                    return <option key={p.id} value={p.id}>{p.full_name} ({p.category}) — {cnt}/{isTuna ? TUNA_BAG_LIMIT : GAMEFISH_BAG_LIMIT}</option>
                  })}
                </select>
              </div>

              {/* Species */}
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem' }}>Species *</label>
                {isGamefish ? (
                  <select value={form.species_name}
                    onChange={e => {
                      const val = e.target.value
                      setForm(f => ({
                        ...f,
                        species_name: val,
                        weight_kg: val === 'No Catch' ? '0' : '',
                        length_cm: '',
                        scoring: val === 'No Catch' ? false : true
                      }))
                    }}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}>
                    <option value="">— Select species —</option>
                    <optgroup label="Kill & Weigh">{GAMEFISH_SPECIES.filter(s => !s.release).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</optgroup>
                    <optgroup label="🟢 Kingfish — Release & Measure">{GAMEFISH_SPECIES.filter(s => s.kingfish).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</optgroup>
                    <optgroup label="🔵 Billfish — Release Only">{GAMEFISH_SPECIES.filter(s => s.billfish).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</optgroup>
                    <option value="No Catch">No Catch — 0 points</option>
                  </select>
                ) : (
                  <select value={form.species_name}
                    onChange={e => {
                      const val = e.target.value
                      setForm(f => ({
                        ...f,
                        species_name: val,
                        weight_kg: val === 'No Catch' ? '0' : '',
                        scoring: val === 'No Catch' ? false : true
                      }))
                    }}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}>
                    <option value="">— Select species —</option>
                    {TUNA_SCORING_SPECIES.map(s => <option key={s.name} value={s.name}>{s.name} (min {s.minWeight}kg)</option>)}
                    <option value="No Catch">No Catch — 0 points</option>
                  </select>
                )}
              </div>

              {/* Gamefish notices */}
              {isGamefish && speciesIsBillfish && (
                <div style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '6px', padding: '0.65rem', marginBottom: '0.875rem', fontSize: '0.825rem', color: '#1e40af' }}>
                  🔵 <strong>Billfish — Release only.</strong> 0 points but counts toward species multiplier.
                </div>
              )}
              {isGamefish && speciesIsGT && (
                <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '6px', padding: '0.65rem', marginBottom: '0.875rem', fontSize: '0.825rem', color: '#065f46' }}>
                  🟢 <strong>GT — Release & Measure.</strong> Scores as {GT_SCORE_KG}kg. Min 65cm fork length. Max 1/team/day.
                  {gtLimitReached && <div style={{ marginTop: '0.4rem', color: '#ef4444', fontWeight: '700' }}>⚠ Team GT limit reached.</div>}
                </div>
              )}
              {isGamefish && speciesIsKingfish && !speciesIsGT && (
                <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '6px', padding: '0.65rem', marginBottom: '0.875rem', fontSize: '0.825rem', color: '#065f46' }}>
                  🟢 <strong>Kingfish — Release & Measure.</strong> Scores as {KINGFISH_SCORE_KG}kg. Min 40cm fork length. Max 1/team/day.
                  {kingfishLimitReached && <div style={{ marginTop: '0.4rem', color: '#ef4444', fontWeight: '700' }}>⚠ Team kingfish limit reached.</div>}
                </div>
              )}

              {/* Length — kingfish only */}
              {isGamefish && speciesIsKingfish && (
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem' }}>
                    Fork Length (cm) * {speciesIsGT ? '— min 65cm' : '— min 40cm'}
                  </label>
                  <input type="number" step="0.1" min="0" value={form.length_cm}
                    onChange={e => setForm(f => ({ ...f, length_cm: e.target.value }))}
                    placeholder={speciesIsGT ? 'e.g. 72.5' : 'e.g. 45.0'}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '1rem' }} />
                </div>
              )}

              {/* Weight */}
              {((isGamefish && !isReleaseOnly && form.species_name) || isTuna) && (
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem' }}>
                    Weight (kg) *
                    {isTuna && form.species_name && <span style={{ color: '#6b7280', fontWeight: '400' }}> — min {TUNA_MIN_WEIGHTS[form.species_name] || '?'}kg</span>}
                    {isGamefish && selectedGamefishSpecies?.tuna && <span style={{ color: '#6b7280', fontWeight: '400' }}> — min 4kg</span>}
                    {isGamefish && !selectedGamefishSpecies?.tuna && !speciesIsKingfish && <span style={{ color: '#6b7280', fontWeight: '400' }}> — min 3kg</span>}
                  </label>
                  <input type="number" step="0.01" min="0" value={form.weight_kg}
                    onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
                    placeholder="e.g. 25.50"
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '1rem' }} />
                </div>
              )}

              {/* Non-scoring flag — tuna only */}
              {isTuna && form.species_name && (
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!form.scoring}
                      onChange={e => setForm(f => ({ ...f, scoring: !e.target.checked }))}
                      style={{ width: '1.1rem', height: '1.1rem' }} />
                    <span style={{ fontWeight: '500', fontSize: '0.9rem', color: '#374151' }}>
                      Non-scoring catch (mutilated / predated)
                    </span>
                  </label>
                  {!form.scoring && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#92400e', background: '#fef3c7', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                      ⚠ This catch will be recorded but excluded from points
                    </div>
                  )}
                </div>
              )}

              {/* Points preview */}
              {pointsPreview && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '0.6rem 0.875rem', marginBottom: '0.875rem', fontSize: '0.85rem', color: '#166534', fontWeight: '600' }}>
                  📊 {pointsPreview.label}
                </div>
              )}

              {/* Validation error */}
              {validationError && (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.6rem 0.875rem', marginBottom: '0.875rem', fontSize: '0.85rem', color: '#991b1b', fontWeight: '600' }}>
                  ⚠ {validationError}
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.3rem' }}>Notes (optional)</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any details..."
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
              </div>

              <button onClick={handleSubmit} disabled={!canSubmit} style={{
                width: '100%', padding: '0.85rem',
                background: canSubmit ? NAVY : '#9ca3af',
                color: 'white', border: 'none', borderRadius: '6px',
                fontSize: '1rem', fontWeight: '800', cursor: canSubmit ? 'pointer' : 'not-allowed'
              }}>
                {saving ? 'Saving...' : validationError ? '⚠ Check Requirements' : '✓ Save Catch'}
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
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  opacity: c.scoring === false ? 0.6 : 1
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#111827' }}>
                      {c.species_name}
                      {!c.retained && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', background: '#dbeafe', color: '#1e40af', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>Released</span>}
                      {c.scoring === false && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>Non-scoring</span>}
                    </div>
                    <div style={{ fontSize: '0.775rem', color: '#6b7280' }}>
                      {angler?.full_name} • {team?.team_name}{boat ? ` • ${boat.boat_name}` : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.1rem', display: 'flex', gap: '0.75rem' }}>
                      {c.weight_kg && <span style={{ color: '#059669', fontWeight: '600' }}>{parseFloat(c.weight_kg).toFixed(2)} kg</span>}
                      {c.length_cm && <span style={{ color: '#0891b2', fontWeight: '600' }}>{parseFloat(c.length_cm).toFixed(1)} cm</span>}
                      {isTuna && c.line_class_kg && <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{c.line_class_kg}kg line</span>}
                      <span style={{ color: '#7c3aed', fontWeight: '600' }}>{c.points} pts</span>
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
        {view === 'leaderboard' && (
          <div>
            {isDayHidden && !isAdmin ? (
              <div style={{ background: 'white', borderRadius: '10px', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
                <div style={{ fontWeight: '800', fontSize: '1.1rem', color: NAVY, marginBottom: '0.5rem' }}>Results Hidden</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  Day {activeDay} results will be revealed after the final day of competition.
                </div>
              </div>
            ) : isGamefish ? (
              ['U19', 'U16'].map(cat => (
                <div key={cat} style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontWeight: '800', color: NAVY, marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                    🏆 {cat === 'U19' ? 'Under 19' : 'Under 16'}
                  </h3>
                  {gamefishLeaderboard[cat].map((team, idx) => {
                    const day = getTeamDayScore(team.id)
                    return (
                      <div key={team.id} style={{ background: 'white', borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', flexShrink: 0, background: medal(idx), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.875rem', color: idx < 3 ? 'white' : '#6b7280' }}>{idx + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#111827' }}>{team.team_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{team.totalFish} fish total</div>
                          {day.catchCount > 0 && <div style={{ fontSize: '0.75rem', color: '#7c3aed' }}>Day {activeDay}: {day.finalScore} pts{day.multiplier > 1 ? ` (×${day.multiplier})` : ''}</div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '800', fontSize: '1.1rem', color: NAVY }}>{team.totalScore}</div>
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>total pts</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            ) : isDayHidden && !isAdmin ? null : (
              <div>
                <h3 style={{ fontWeight: '800', color: NAVY, marginBottom: '0.75rem', fontSize: '0.9rem', textTransform: 'uppercase' }}>Standings</h3>
                {tunaLeaderboard.map((team, idx) => {
                  const day = getTeamDayScore(team.id)
                  const boat = getTeamBoat(team.id)
                  return (
                    <div key={team.id} style={{ background: 'white', borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', flexShrink: 0, background: medal(idx), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.875rem', color: idx < 3 ? 'white' : '#6b7280' }}>{idx + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#111827' }}>{team.team_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{team.totalFish} fish{boat ? ` • ${boat.boat_name}` : ''}</div>
                        {day.catchCount > 0 && <div style={{ fontSize: '0.75rem', color: '#7c3aed' }}>Day {activeDay}: {day.totalScore} pts</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '800', fontSize: '1.1rem', color: NAVY }}>{team.totalScore}</div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>total pts</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* SKIPPERS VIEW */}
        {view === 'skippers' && (
          <div>
            {isDayHidden && !isAdmin ? (
              <div style={{ background: 'white', borderRadius: '10px', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
                <div style={{ fontWeight: '800', fontSize: '1.1rem', color: NAVY, marginBottom: '0.5rem' }}>Results Hidden</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Skipper standings will be revealed after the final day.</div>
              </div>
            ) : null}
            {(!isDayHidden || isAdmin) && <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#92400e' }}>
              Highest accumulated catch points wins. Updates live as catches are logged.
            </div>}
            {(!isDayHidden || isAdmin) && skipperLeaderboard().map((boat, idx) => (
              <div key={boat.id} style={{ background: 'white', borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', flexShrink: 0, background: medal(idx), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.875rem', color: idx < 3 ? 'white' : '#6b7280' }}>{idx + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#111827' }}>{boat.boat_name}</div>
                  <div style={{ fontSize: '0.775rem', color: '#6b7280' }}>{boat.skipper_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '800', fontSize: '1.1rem', color: NAVY }}>{boat.grandPrixTotal || '—'}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>pts</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
