import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// ─── COMPETITION ──────────────────────────────────────────────────────────────
const COMPETITION_ID = '3855034f-ab39-4297-9be4-ba9a7e566ce0'

// ─── OWN BOAT DRAW — team stays on same boat all 5 days ──────────────────────
const TEAMS = {
  'Border':               { captain: 'Tim Wood',           anglers: ['Tim Wood', 'Andrew Sparg', 'Peter Klug'],                          boat: 'ROUGH RIDER',   skipper: 'Arny Nice' },
  'Southern Gauteng Red': { captain: 'Wesley Uys',         anglers: ['Wesley Uys', 'George Breedt', 'Geraldine Breedt'],                 boat: 'JOY TOY',       skipper: 'Patat de Jager' },
  'Southern Gauteng Blue':{ captain: 'Dirk Rosslee',       anglers: ['Dirk Rosslee', 'Leno Pillay', 'Yolande Rosslee'],                  boat: 'PIROMERO',      skipper: 'Andries Oosthuizen' },
  'SADSAA U21':           { captain: 'Francois Rossouw',   anglers: ['Francois Rossouw', 'Jethro Doman', 'Matt Howells'],                boat: 'HOWZIE',        skipper: 'Paul Howells' },
  'Northern Gauteng':     { captain: 'Ryno Le Grange',     anglers: ['Ryno Le Grange', 'Louis du Plessis', 'JC van Heerden'],            boat: 'WALAALAHA',     skipper: 'Riaan Odendaal' },
  'Zululand Black':       { captain: 'Giepie Joubert',     anglers: ['Giepie Joubert', 'Heinz Paul', 'Charl Fourie'],                    boat: 'GIEPSTER',      skipper: 'Giepie Joubert' },
  'Zululand White':       { captain: 'Marius Botha',       anglers: ['Marius Botha', 'Willa Martin', 'Janiene Martin'],                  boat: 'ADDICTED',      skipper: 'Marius Botha' },
  'Natal':                { captain: 'Alex Tyldesley',     anglers: ['Alex Tyldesley', 'Elmar Basson', 'Cameron Johnston'],              boat: 'BLOOD DIAMOND', skipper: 'Struan Blight' },
  'Mpumalanga':           { captain: 'Ricus van Heerden',  anglers: ['Ricus van Heerden', 'Nicky Venter', 'Ruan van der Merwe'],         boat: 'PIRATE',        skipper: 'Nicky Venter' },
}

// Flat angler → team lookup
const ANGLER_TEAM = {}
Object.entries(TEAMS).forEach(([team, data]) => {
  data.anglers.forEach(name => { ANGLER_TEAM[name] = team })
})

const ALL_ANGLERS = Object.values(TEAMS)
  .flatMap(t => t.anglers)
  .sort()

// ─── SPECIES — SADSAA Gamefish (10kg line class) ──────────────────────────────
// All species factor = 1.0 (SADSAA Annexure A)
// Billfish: no weight points but counts as species for multiplier
// Grouped for UI clarity
const SPECIES_GROUPS = [
  {
    label: 'Billfish (no weight points — multiplier only)',
    billfish: true,
    species: [
      'Black Marlin',
      'Blue Marlin',
      'Striped Marlin',
      'White Marlin',
      'Sailfish',
      'Shortbill Spearfish',
      'Broadbill Swordfish',
    ]
  },
  {
    label: 'Tuna (min 5kg)',
    species: [
      'Yellowfin Tuna',
      'Bigeye Tuna',
      'Bluefin Tuna',
      'Dogtooth Tuna',
      'Longfin Tuna (Albacore)',
      'Other Tuna',
    ]
  },
  {
    label: 'Kingfish & Amberjack (min 4kg)',
    species: [
      'Giant Kingfish (Ignobilis)',
      'Other Kingfish (Bluefin / Blacklip / Yellowspot etc.)',
      'Amberjack / Tropical Yellowtail',
    ]
  },
  {
    label: 'Other Gamefish (min 4kg)',
    species: [
      'Wahoo',
      'Dorado',
      'Cobia (Prodigal Son)',
      'Garrick (Leervis)',
      'Great Barracuda',
      'King Mackerel (Cuta)',
      'Queen Mackerel',
      'Queenfish',
      'Rainbow Runner',
      'Green Jobfish (Kakaap)',
      'Yellowtail (Cape)',
      'Elf / Shad',
      'Cape Snoek',
      'Bonito',
    ]
  },
]

const ALL_SPECIES = SPECIES_GROUPS.flatMap(g =>
  g.species.map(name => ({ name, billfish: !!g.billfish, minWeight: g.label.includes('5kg') ? 5 : 4 }))
)

// ─── SCORING ──────────────────────────────────────────────────────────────────
// Individual fish: (weight_kg / line_class_kg)^2 * 32 * species_factor (all = 1)
// Multiplier applied at team level pending Nick Nel confirmation
// Stored raw here — multiplier applied in scoreboard

function calcFishPoints(weightKg, lineClassKg = 10) {
  if (!weightKg || weightKg <= 0) return 0
  const ratio = weightKg / lineClassKg
  return parseFloat((ratio * ratio * 32).toFixed(2))
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const NAVY = '#1e3a8a'
const GOLD = '#d97706'
const GREEN = '#16a34a'
const RED   = '#dc2626'

const S = {
  page:   { maxWidth: 900, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' },
  header: { background: NAVY, color: 'white', padding: '1rem 1.5rem', borderRadius: 8, marginBottom: '1.25rem' },
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  select: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box' },
  input:  { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' },
  btn:    (bg=NAVY, color='white') => ({ background: bg, color, border: 'none', padding: '0.55rem 1.1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }),
  grid2:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  row:    { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  badge:  (color) => ({ background: color, color: 'white', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }),
}

// ─── FISH ENTRY ROW ───────────────────────────────────────────────────────────
function FishRow({ fish, index, onChange, onRemove, lineClass = 10 }) {
  const pts = fish.billfish ? 0 : calcFishPoints(parseFloat(fish.weight_kg) || 0, lineClass)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr auto',
      gap: '0.5rem',
      alignItems: 'center',
      padding: '0.5rem',
      background: fish.billfish ? '#fef3c7' : '#f9fafb',
      borderRadius: 6,
      marginBottom: '0.4rem',
      border: `1px solid ${fish.billfish ? '#fcd34d' : '#e5e7eb'}`,
    }}>
      <select
        style={{ ...S.select, fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}
        value={fish.species}
        onChange={e => {
          const sp = ALL_SPECIES.find(s => s.name === e.target.value)
          onChange(index, { ...fish, species: e.target.value, billfish: sp?.billfish || false, min_weight: sp?.minWeight || 4 })
        }}
      >
        <option value=''>Select species…</option>
        {SPECIES_GROUPS.map(g => (
          <optgroup key={g.label} label={g.label}>
            {g.species.map(s => <option key={s} value={s}>{s}</option>)}
          </optgroup>
        ))}
      </select>

      <div>
        <input
          type='number'
          step='0.1'
          min='0'
          placeholder='kg'
          value={fish.weight_kg}
          disabled={fish.billfish}
          onChange={e => onChange(index, { ...fish, weight_kg: e.target.value })}
          style={{ ...S.input, fontSize: '0.85rem', padding: '0.4rem 0.5rem', background: fish.billfish ? '#f3f4f6' : 'white' }}
        />
        {fish.weight_kg && !fish.billfish && parseFloat(fish.weight_kg) < fish.min_weight && (
          <div style={{ fontSize: '0.7rem', color: RED, marginTop: 2 }}>
            Min {fish.min_weight}kg ⚠
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        {fish.billfish ? (
          <span style={S.badge(GOLD)}>Multiplier</span>
        ) : (
          <div>
            <div style={{ fontWeight: 700, color: NAVY, fontSize: '1rem' }}>{pts > 0 ? pts.toFixed(2) : '—'}</div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>pts</div>
          </div>
        )}
      </div>

      <button onClick={() => onRemove(index)}
        style={{ background: '#fef2f2', color: RED, border: 'none', borderRadius: 4, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem' }}>
        ✕
      </button>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function GamefishCatchLogger() {
  const { user } = useAuth()

  const [day,        setDay]        = useState('')
  const [teamName,   setTeamName]   = useState('')
  const [anglerName, setAnglerName] = useState('')
  const [catches,    setCatches]    = useState([])
  const [recordNote, setRecordNote] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')
  const [existing,   setExisting]   = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [teamSummary,setTeamSummary]= useState([])
  const [activeTab,  setActiveTab]  = useState('entry')

  const team       = teamName ? TEAMS[teamName] : null
  const lineClass  = 10

  // Load existing entry when angler + day selected
  useEffect(() => {
    if (!anglerName || !day) return
    setLoading(true)
    setSaved(false)
    setError('')
    supabase
      .from('gamefish_catches')
      .select('*')
      .eq('competition_id', COMPETITION_ID)
      .eq('day_number', parseInt(day))
      .eq('angler_name', anglerName)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExisting(data)
          setCatches(data.catches || [])
          setRecordNote(data.record_note || '')
        } else {
          setExisting(null)
          setCatches([])
          setRecordNote('')
        }
        setLoading(false)
      })
  }, [anglerName, day])

  // Load team summary when team + day selected
  useEffect(() => {
    if (!teamName || !day) return
    supabase
      .from('gamefish_catches')
      .select('angler_name, catches, total_points, day_number')
      .eq('competition_id', COMPETITION_ID)
      .eq('day_number', parseInt(day))
      .in('angler_name', TEAMS[teamName]?.anglers || [])
      .then(({ data }) => setTeamSummary(data || []))
  }, [teamName, day, saved])

  const addFish = () => {
    if (catches.length >= 5) return
    setCatches(prev => [...prev, { species: '', weight_kg: '', billfish: false, min_weight: 4 }])
  }

  const updateFish = (i, fish) => setCatches(prev => prev.map((f, idx) => idx === i ? fish : f))
  const removeFish = (i)       => setCatches(prev => prev.filter((_, idx) => idx !== i))

  const validCatches = catches.filter(c => c.species && (c.billfish || (parseFloat(c.weight_kg) || 0) >= c.min_weight))

  const totalPoints = validCatches
    .filter(c => !c.billfish)
    .reduce((sum, c) => sum + calcFishPoints(parseFloat(c.weight_kg), lineClass), 0)

  const speciesCount = new Set(validCatches.map(c => {
    // Group species per competition rules
    if (['Giant Kingfish (Ignobilis)', 'Other Kingfish (Bluefin / Blacklip / Yellowspot etc.)'].includes(c.species)) return 'KINGFISH'
    if (['Amberjack / Tropical Yellowtail'].includes(c.species)) return 'AMBERJACK'
    if (c.species.includes('Tuna') || c.species === 'Other Tuna') return c.species === 'Other Tuna' ? 'TUNA_OTHER' : c.species
    return c.species
  })).size

  const handleSave = async () => {
    if (!day || !anglerName) return
    setSaving(true); setError('')

    const payload = {
      competition_id: COMPETITION_ID,
      day_number:     parseInt(day),
      angler_name:    anglerName,
      team_name:      teamName,
      boat_name:      team?.boat || '',
      skipper_name:   team?.skipper || '',
      catches:        validCatches,
      total_points:   parseFloat(totalPoints.toFixed(2)),
      species_count:  speciesCount,
      fish_count:     validCatches.length,
      record_note:    recordNote,
      entered_by:     user?.id,
      updated_at:     new Date().toISOString(),
    }

    let err
    if (existing) {
      ;({ error: err } = await supabase.from('gamefish_catches').update(payload).eq('id', existing.id))
    } else {
      ;({ error: err } = await supabase.from('gamefish_catches').insert(payload))
    }

    if (err) { setError(err.message); setSaving(false); return }

    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)

    const { data: fresh } = await supabase
      .from('gamefish_catches').select('*')
      .eq('competition_id', COMPETITION_ID)
      .eq('day_number', parseInt(day))
      .eq('angler_name', anglerName)
      .maybeSingle()
    setExisting(fresh)

    const { data: ts } = await supabase
      .from('gamefish_catches').select('angler_name, catches, total_points, day_number')
      .eq('competition_id', COMPETITION_ID)
      .eq('day_number', parseInt(day))
      .in('angler_name', TEAMS[teamName]?.anglers || [])
    setTeamSummary(ts || [])
  }

  const TABS = [
    { id: 'entry', label: `📝 ${anglerName ? anglerName.split(' ')[0] + "'s Card" : 'Catch Entry'}` },
    { id: 'team',  label: `🚤 ${teamName || 'Team'} Summary` },
  ]

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>🎣 SADSAA Gamefish Nationals 2026</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 2 }}>
          Meerensee Boat Club, Richards Bay · 10kg Line Class · Catch Logger
        </div>
      </div>

      {/* Step 1: Day + Team */}
      <div style={S.card}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Step 1 — Select Day & Team</div>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Fishing Day</label>
            <select style={S.select} value={day}
              onChange={e => { setDay(e.target.value); setAnglerName('') }}>
              <option value=''>Select day…</option>
              <option value='1'>Day 1 — Monday 1 June</option>
              <option value='2'>Day 2 — Tuesday 2 June</option>
              <option value='3'>Day 3 — Wednesday 3 June</option>
              <option value='4'>Day 4 — Thursday 4 June</option>
              <option value='5'>Day 5 — Friday 5 June</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Team</label>
            <select style={S.select} value={teamName}
              onChange={e => { setTeamName(e.target.value); setAnglerName('') }}
              disabled={!day}>
              <option value=''>Select team…</option>
              {Object.keys(TEAMS).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {team && (
          <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: '#eff6ff', borderRadius: 6, fontSize: '0.85rem', color: '#1e40af' }}>
            <strong>Boat:</strong> {team.boat} &nbsp;·&nbsp;
            <strong>Skipper:</strong> {team.skipper} &nbsp;·&nbsp;
            <strong>Lines up:</strong> {day === '5' ? '14:00' : '15:00'}
          </div>
        )}
      </div>

      {/* Step 2: Angler */}
      {team && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Step 2 — Select Angler</div>
          <select style={S.select} value={anglerName} onChange={e => setAnglerName(e.target.value)}>
            <option value=''>Select angler…</option>
            {team.anglers.map(a => (
              <option key={a} value={a}>
                {a === team.captain ? `⚓ ${a} (Captain)` : a}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      {anglerName && !loading && (
        <>
          <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ flex: 1, padding: '0.65rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                  background: activeTab === t.id ? NAVY : 'white', color: activeTab === t.id ? 'white' : '#374151' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── CATCH ENTRY TAB ── */}
          {activeTab === 'entry' && (
            <>
              {/* Angler summary bar */}
              <div style={{ ...S.card, background: '#f8fafc' }}>
                <div style={S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{anglerName}{anglerName === team?.captain ? ' ⚓' : ''}</div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>{teamName} · Day {day} · {team?.boat}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>RAW PTS</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: NAVY }}>{totalPoints.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>FISH</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: GREEN }}>{validCatches.length}/5</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>SPECIES</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: GOLD }}>{speciesCount}</div>
                  </div>
                </div>
                {speciesCount > 1 && (
                  <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', background: '#fef3c7', borderRadius: 6, fontSize: '0.85rem', color: '#92400e', fontWeight: 600 }}>
                    ✨ Species multiplier: ×{speciesCount - 1 === 0 ? 1 : speciesCount - 1} — applied to team total
                  </div>
                )}
              </div>

              {/* Fish entries */}
              <div style={S.card}>
                <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>Step 3 — Record Catches</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  Enter each fish with its weighed mass. Billfish count as a multiplier species — no weight needed.
                  Maximum 5 qualifying fish per angler per day.
                </div>

                {catches.length === 0 && (
                  <div style={{ color: '#9ca3af', fontStyle: 'italic', marginBottom: '0.75rem' }}>
                    No catches recorded yet — click + Add Fish below.
                  </div>
                )}

                {catches.map((fish, i) => (
                  <FishRow key={i} fish={fish} index={i}
                    onChange={updateFish} onRemove={removeFish} lineClass={lineClass} />
                ))}

                {catches.length < 5 && (
                  <button onClick={addFish} style={{ ...S.btn(GREEN), marginTop: '0.5rem' }}>
                    + Add Fish
                  </button>
                )}
                {catches.length >= 5 && (
                  <div style={{ fontSize: '0.82rem', color: GOLD, fontWeight: 600, marginTop: '0.5rem' }}>
                    ⚠ Maximum 5 fish reached for this angler today.
                  </div>
                )}
              </div>

              {/* Record/PB note */}
              <div style={S.card}>
                <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>Record / PB Claims</div>
                <textarea
                  placeholder='e.g. Yellowfin 33.8kg — possible record&#10;Wahoo 18.2kg — personal best'
                  value={recordNote}
                  onChange={e => setRecordNote(e.target.value)}
                  rows={2}
                  style={{ ...S.input, resize: 'vertical' }}
                />
              </div>

              {error && <div style={{ background: '#fef2f2', color: RED, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem' }}>{error}</div>}
              {saved  && <div style={{ background: '#f0fdf4', color: GREEN, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem', fontWeight: 600 }}>✅ Saved successfully!</div>}

              <button onClick={handleSave} disabled={saving || validCatches.length === 0}
                style={{ ...S.btn(), padding: '0.75rem 2rem', fontSize: '1rem', opacity: (saving || validCatches.length === 0) ? 0.5 : 1 }}>
                {saving ? 'Saving…' : existing ? '💾 Update Scorecard' : '💾 Save Scorecard'}
              </button>
              {validCatches.length === 0 && (
                <span style={{ fontSize: '0.82rem', color: '#9ca3af', marginLeft: '0.75rem' }}>
                  Add at least 1 valid catch to save
                </span>
              )}
            </>
          )}

          {/* ── TEAM SUMMARY TAB ── */}
          {activeTab === 'team' && (
            <div style={S.card}>
              <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>
                🚤 {team?.boat} — Day {day} Team Summary
              </div>
              <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                Skipper: {team?.skipper}
              </div>
              {teamSummary.length === 0 ? (
                <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No catches entered yet for this team today.</div>
              ) : (
                <>
                  {/* Team totals */}
                  {(() => {
                    const teamTotalPts = teamSummary.reduce((s, r) => s + (r.total_points || 0), 0)
                    const teamSpecies  = new Set(teamSummary.flatMap(r =>
                      (r.catches || []).filter(c => c.species).map(c => {
                        if (['Giant Kingfish (Ignobilis)', 'Other Kingfish (Bluefin / Blacklip / Yellowspot etc.)'].includes(c.species)) return 'KINGFISH'
                        if (c.species === 'Amberjack / Tropical Yellowtail') return 'AMBERJACK'
                        return c.species
                      })
                    )).size
                    const multiplier = Math.max(1, teamSpecies - 1)
                    const finalPts   = parseFloat((teamTotalPts * multiplier).toFixed(2))

                    return (
                      <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: 8, marginBottom: '0.75rem' }}>
                        <div style={S.row}>
                          {[
                            { label: 'Raw Team Pts', val: teamTotalPts.toFixed(2), color: NAVY },
                            { label: 'Species',      val: teamSpecies,              color: GOLD },
                            { label: 'Multiplier',   val: `×${multiplier}`,         color: '#7c3aed' },
                            { label: 'Final Pts',    val: finalPts.toFixed(2),       color: GREEN },
                          ].map(s => (
                            <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
                              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: s.color }}>{s.val}</div>
                              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#374151', marginTop: '0.5rem', fontStyle: 'italic' }}>
                          ⚠ Multiplier pending confirmation from Nick Nel (SADSAA TO) — applied at team level per SADSAA rules
                        </div>
                      </div>
                    )
                  })()}

                  {/* Angler rows */}
                  {team?.anglers.map(angler => {
                    const row = teamSummary.find(r => r.angler_name === angler)
                    return (
                      <div key={angler} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <div>
                            <span style={{ fontWeight: 700 }}>
                              {angler === team.captain ? '⚓ ' : ''}{angler}
                            </span>
                          </div>
                          <div style={{ fontWeight: 800, color: NAVY }}>
                            {row ? `${row.total_points?.toFixed(2)} pts` : '—'}
                          </div>
                        </div>
                        {row?.catches?.length > 0 ? (
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {row.catches.map((c, i) => (
                              <span key={i} style={S.badge(c.billfish ? GOLD : '#374151')}>
                                {c.species} {c.billfish ? '(OB)' : `${c.weight_kg}kg · ${calcFishPoints(parseFloat(c.weight_kg), lineClass).toFixed(1)}pts`}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic' }}>Not yet entered</div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </>
      )}

      {loading && <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading…</div>}
    </div>
  )
}
