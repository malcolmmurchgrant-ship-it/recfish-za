import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// ─── COMPETITION DATA ────────────────────────────────────────────────────────

const SKIPPERS = {
  'ELITE CAT':       'André Olivier',
  'FISHBONE':        'Richard Fulford',
  'NOTHING BUT BUTT':'André Labuschagne',
  'CAESAR':          'Louis Fouché',
  'SON OF JAMAICA':  'Martin Gierz',
  'REEL NAUTI':      'Ryno Nel',
  'SEA DOG':         'Garth Webb',
  'LEIGHWAY':        'Tim Gillitt',
  'U GO GIRL':       'Johan Coetzer',
  'MACUSHLA':        'Chris Gerber',
}

const TEAMS = {
  'EPDSAA B':               { captain: 'Brenda Weyer',             anglers: ['Madelein Fourie','Brenda Weyer','Joelene Lerm'] },
  'WESTERN PROVINCE':       { captain: 'Stephen Flemming',          anglers: ['Ossie Sauermann','Stephen Flemming','Gareth Decker'] },
  'BORDER WHITE':           { captain: 'Andrew Sparg',              anglers: ['Andrew Sparg','Tim Wood','Dennis Ford'] },
  'SOUTHERN CAPE JNR WHITE':{ captain: 'Joshua Du Plessis',         anglers: ['Saxon Ansley','Joshua Du Plessis','Jaden De Villiers'] },
  'SOUTHERN CAPE MEN':      { captain: 'Kabous Oosthuizen',         anglers: ['Wessel Havenga','Pieter Strobos','Kabous Oosthuizen'] },
  'EPDSAA A':               { captain: 'Brett Potgieter',           anglers: ['Jacques Bekker','Deon Van Jaarsvelt','Brett Potgieter'] },
  'FREE STATE':             { captain: 'Riaz Hussain',              anglers: ['Riaz Hussain','Sayed Cassiem','Brandon Hooke'] },
  'BORDER BLUE':            { captain: 'Michael Swanepoel',         anglers: ['Peter Mansvelt','Michael Swanepoel','Wayne Vooght'] },
  'NATAL':                  { captain: 'Andrea Papachristoforou',   anglers: ['Andrea Papachristoforou','Xavier Truluck','Phillip Papachristoforou'] },
  'EP LADIES B':            { captain: 'Lisa Bekker',               anglers: ['Sheena Gerber','Maggie Koleskie','Lisa Bekker'] },
  'SOUTHERN CAPE JNR GREEN':{ captain: 'Jack Magerla',              anglers: ['Ben Groenewald','Jack Magerla','Owen Lineker'] },
  'EP LADIES A':            { captain: 'Wayne Gerber',              anglers: ['Donald Brown','Wayne Gerber','Brian Gerber'] },
}

// Boat draw: angler -> [day1 boat, day2 boat, day3 boat]
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
  'Kabous Oosthuizen':         ['SEA DOG','NOTHING BUT BUTT','CAESAR'],
  'Jacques Bekker':            ['FISHBONE','NOTHING BUT BUTT','ELITE CAT'],
  'Deon Van Jaarsvelt':        ['SON OF JAMAICA','LEIGHWAY','FISHBONE'],
  'Brett Potgieter':           ['LEIGHWAY','REEL NAUTI','CAESAR'],
  'Riaz Hussain':              ['FISHBONE','CAESAR','NOTHING BUT BUTT'],
  'Sayed Cassiem':             ['SON OF JAMAICA','U GO GIRL','CAESAR'],
  'Brandon Hooke':             ['U GO GIRL','NOTHING BUT BUTT','SEA DOG'],
  'Peter Mansvelt':            ['FISHBONE','SON OF JAMAICA','CAESAR'],
  'Michael Swanepoel':         ['SON OF JAMAICA','MACUSHLA','NOTHING BUT BUTT'],
  'Wayne Vooght':              ['MACUSHLA','REEL NAUTI','SEA DOG'],
  'Andrea Papachristoforou':   ['NOTHING BUT BUTT','ELITE CAT','SEA DOG'],
  'Xavier Truluck':            ['REEL NAUTI','SEA DOG','LEIGHWAY'],
  'Phillip Papachristoforou':  ['SEA DOG','CAESAR','U GO GIRL'],
  'Sheena Gerber':             ['NOTHING BUT BUTT','FISHBONE','LEIGHWAY'],
  'Maggie Koleskie':           ['REEL NAUTI','LEIGHWAY','U GO GIRL'],
  'Lisa Bekker':               ['LEIGHWAY','CAESAR','MACUSHLA'],
  'Ben Groenewald':            ['NOTHING BUT BUTT','SON OF JAMAICA','U GO GIRL'],
  'Jack Magerla':              ['REEL NAUTI','U GO GIRL','MACUSHLA'],
  'Owen Lineker':              ['U GO GIRL','REEL NAUTI','LEIGHWAY'],
  'Donald Brown':              ['NOTHING BUT BUTT','REEL NAUTI','MACUSHLA'],
  'Wayne Gerber':              ['REEL NAUTI','MACUSHLA','SON OF JAMAICA'],
  'Brian Gerber':              ['MACUSHLA','SON OF JAMAICA','REEL NAUTI'],
}

// Species data from official scorecard
// pointsPerFish: points for each fish after the first
// speciesBonus: 3 pts for first fish of species (always 3)
// overLineLength: cm threshold for +5 bonus | lengthType: F=fork, T=total
// bagLimit: max fish per angler
// minSize: minimum scoring length in cm (null = no minimum)
const SPECIES = [
  // 10 per angler - 3 pts per fish
  { name:'BAARDMAN',              bag:5,  minSize:40,  pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'BANK STEENBRAS',        bag:5,  minSize:50,  pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'BLACKTAIL',             bag:5,  minSize:25,  pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'BLUE HOTTENTOT',        bag:5,  minSize:null,pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'BRONZE BREAM',          bag:2,  minSize:30,  pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'CARPENTER',             bag:4,  minSize:35,  pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'DANE',                  bag:5,  minSize:null,pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'GURNARD',               bag:10, minSize:null,pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'KOB',                   bag:5,  minSize:50,  pointsPerFish:3, overLineLength:84,    lengthType:'T' },
  { name:'KOB (>110cm)',          bag:1,  minSize:110, pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'PANGA / DIKBEKKIE',     bag:10, minSize:null,pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'ROMAN',                 bag:2,  minSize:30,  pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'SHAD / ELF',            bag:5,  minSize:30,  pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'SANTER / SOLDIER / BASTERMAN',   bag:5,  minSize:30,  pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'SHALLOW-WATER HAKE / STOCKFISH',             bag:10, minSize:null,pointsPerFish:3, overLineLength:null,  lengthType:null },
  { name:'ZEBRA / WILDEPERD',     bag:5,  minSize:30,  pointsPerFish:3, overLineLength:null,  lengthType:null },
  // 10 per angler - 4 pts per fish
  { name:'CATFACE ROCKCOD',       bag:5,  minSize:50,  pointsPerFish:4, overLineLength:null,  lengthType:null },
  { name:'GRUNTER',               bag:5,  minSize:40,  pointsPerFish:4, overLineLength:null,  lengthType:null },
  { name:'GEELBEK / CAPE SALMON', bag:2,  minSize:60,  pointsPerFish:4, overLineLength:88,    lengthType:'F' },
  { name:'SCOTSMAN',              bag:1,  minSize:40,  pointsPerFish:4, overLineLength:71,    lengthType:'F' },
  // 10 per angler - 5 pts per fish
  { name:'DAGERAAD',              bag:1,  minSize:40,  pointsPerFish:5, overLineLength:null,  lengthType:null },
  { name:'ENGLISHMAN',            bag:1,  minSize:40,  pointsPerFish:5, overLineLength:null,  lengthType:null },
  { name:'GREATER YELLOWTAIL / AMBERJACK / TROPICAL TAIL',    bag:10, minSize:null,pointsPerFish:5, overLineLength:79,    lengthType:'F' },
  { name:'JOHN BROWN / JAN BRUIN',             bag:1,  minSize:null,pointsPerFish:5, overLineLength:null,  lengthType:null },
  { name:'RED STUMPNOSE / MISS LUCY', bag:1,  minSize:30,  pointsPerFish:5, overLineLength:61,    lengthType:'F' },
  { name:'MOUSTACHE ROCKCOD',     bag:4,  minSize:50,  pointsPerFish:5, overLineLength:70,    lengthType:'T' },
  { name:'WHITE MUSSELCRACKER',        bag:1,  minSize:60,  pointsPerFish:5, overLineLength:65,    lengthType:'F' },
  { name:'RED STEENBRAS / COPPER',bag:1,  minSize:60,  pointsPerFish:5, overLineLength:68,    lengthType:'F' },
  { name:'WHITE STEENBRAS',       bag:1,  minSize:60,  pointsPerFish:5, overLineLength:65,    lengthType:'F' },
  { name:'YELLOWBELLY ROCKCOD',   bag:1,  minSize:60,  pointsPerFish:5, overLineLength:70,    lengthType:'T' },
  { name:'YELLOWTAIL',            bag:10, minSize:null,pointsPerFish:5, overLineLength:79,    lengthType:'F' },
  { name:'BLACK MUSSELCRACKER',   bag:1,  minSize:50,  pointsPerFish:5, overLineLength:60,    lengthType:'F' },
]

const SPECIES_BONUS = 3
const OVER_LINE_BONUS = 5

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getAnglerTeam(anglerName) {
  for (const [team, data] of Object.entries(TEAMS)) {
    if (data.anglers.includes(anglerName)) return team
  }
  return 'Unknown'
}

function getBoatAnglers(boat, dayIndex) {
  return Object.entries(BOAT_DRAW)
    .filter(([, days]) => days[dayIndex] === boat)
    .map(([name]) => name)
}

function calcAnglerPoints(catches) {
  let total = 0
  for (const c of catches) {
    if (c.fishCount === 0) continue
    const sp = SPECIES.find(s => s.name === c.species)
    if (!sp) continue
    // First fish gets pointsPerFish + speciesBonus, rest get pointsPerFish
    total += sp.pointsPerFish + SPECIES_BONUS  // first fish
    if (c.fishCount > 1) total += sp.pointsPerFish * (c.fishCount - 1)
    // Over line class bonus
    total += c.overLineCount * OVER_LINE_BONUS
  }
  return total
}

function calcTotalFish(catches) {
  return catches.reduce((sum, c) => sum + c.fishCount, 0)
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const S = {
  page: { maxWidth: 900, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' },
  header: { background: '#1e3a8a', color: 'white', padding: '1rem 1.5rem', borderRadius: 8, marginBottom: '1.5rem' },
  card: { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label: { fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 },
  select: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.95rem', background: 'white' },
  btn: (color='#1e3a8a', outlined=false) => ({
    background: outlined ? 'white' : color,
    color: outlined ? color : 'white',
    border: `2px solid ${color}`,
    padding: '0.5rem 1rem',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    transition: 'all 0.15s',
  }),
  badge: (color) => ({
    background: color,
    color: 'white',
    padding: '0.2rem 0.6rem',
    borderRadius: 20,
    fontSize: '0.78rem',
    fontWeight: 700,
  }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  row: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
}

// ─── SPECIES ROW COMPONENT ───────────────────────────────────────────────────

function SpeciesRow({ sp, entry, onChange, disabled }) {
  const maxReached = entry.fishCount >= sp.bag
  const canAddOverLine = sp.overLineLength && entry.overLineCount < entry.fishCount

  const addFish = () => {
    if (maxReached || disabled) return
    onChange({ ...entry, fishCount: entry.fishCount + 1 })
  }
  const removeFish = () => {
    if (entry.fishCount === 0 || disabled) return
    const newCount = entry.fishCount - 1
    onChange({ ...entry, fishCount: newCount, overLineCount: Math.min(entry.overLineCount, newCount) })
  }
  const addOverLine = () => {
    if (!canAddOverLine || disabled) return
    onChange({ ...entry, overLineCount: entry.overLineCount + 1 })
  }
  const removeOverLine = () => {
    if (entry.overLineCount === 0 || disabled) return
    onChange({ ...entry, overLineCount: entry.overLineCount - 1 })
  }

  // Points preview
  let pts = 0
  if (entry.fishCount > 0) {
    pts = sp.pointsPerFish + SPECIES_BONUS + sp.pointsPerFish * (entry.fishCount - 1) + entry.overLineCount * OVER_LINE_BONUS
  }

  const rowBg = entry.fishCount > 0 ? '#f0fdf4' : 'white'
  const borderColor = entry.fishCount > 0 ? '#86efac' : '#e5e7eb'

  return (
    <div style={{ background: rowBg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>{sp.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            Bag: {sp.bag} {sp.minSize ? `• Min: ${sp.minSize}cm` : ''} • {sp.pointsPerFish}pts/fish
            {sp.overLineLength ? ` • OL: >${sp.overLineLength}cm(${sp.lengthType})` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Fish counter */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: 2 }}>FISH</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={removeFish} disabled={entry.fishCount === 0 || disabled}
                style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #d1d5db', background: 'white', cursor: entry.fishCount === 0 ? 'default' : 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: entry.fishCount === 0 ? 0.4 : 1 }}>−</button>
              <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', color: entry.fishCount > 0 ? '#16a34a' : '#374151' }}>{entry.fishCount}</span>
              <button onClick={addFish} disabled={maxReached || disabled}
                style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #d1d5db', background: maxReached ? '#f3f4f6' : '#dcfce7', cursor: maxReached ? 'default' : 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: maxReached ? 0.4 : 1 }}>+</button>
            </div>
          </div>

          {/* Over line counter - only show if species has threshold */}
          {sp.overLineLength ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: 2 }}>OVER LINE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={removeOverLine} disabled={entry.overLineCount === 0 || disabled}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #d1d5db', background: 'white', cursor: entry.overLineCount === 0 ? 'default' : 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: entry.overLineCount === 0 ? 0.4 : 1 }}>−</button>
                <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', color: entry.overLineCount > 0 ? '#d97706' : '#374151' }}>{entry.overLineCount}</span>
                <button onClick={addOverLine} disabled={!canAddOverLine || disabled}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #d1d5db', background: canAddOverLine ? '#fef3c7' : '#f3f4f6', cursor: canAddOverLine ? 'pointer' : 'default', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canAddOverLine ? 1 : 0.4 }}>+</button>
              </div>
            </div>
          ) : <div style={{ width: 80 }} />}

          {/* Points earned */}
          <div style={{ minWidth: 44, textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: 2 }}>PTS</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: pts > 0 ? '#1e3a8a' : '#9ca3af' }}>{pts}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AllCoastalsCatchLogger() {
  const { user } = useAuth()

  const [day, setDay] = useState('')
  const [boat, setBoat] = useState('')
  const [anglerName, setAnglerName] = useState('')
  const [catches, setCatches] = useState([])
  const [recordClaims, setRecordClaims] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [existingEntry, setExistingEntry] = useState(null)
  const [boatSummary, setBoatSummary] = useState([])
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [activeTab, setActiveTab] = useState('entry') // 'entry' | 'boat'

  const dayIndex = day ? parseInt(day) - 1 : null
  const boatAnglers = (day && boat) ? getBoatAnglers(boat, dayIndex) : []
  const anglerTeam = anglerName ? getAnglerTeam(anglerName) : ''

  // Initialise catch entries when angler selected
  useEffect(() => {
    if (!anglerName) return
    setLoadingExisting(true)
    setSaved(false)
    setError('')

    supabase
      .from('allcoastals_catches')
      .select('*')
      .eq('day_number', parseInt(day))
      .eq('angler_name', anglerName)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingEntry(data)
          setCatches(data.catches)
          setRecordClaims(data.record_claims?.join('\n') || '')
        } else {
          setExistingEntry(null)
          setCatches(SPECIES.map(sp => ({ species: sp.name, fishCount: 0, overLineCount: 0 })))
          setRecordClaims('')
        }
        setLoadingExisting(false)
      })
  }, [anglerName, day])

  // Load boat summary whenever boat/day changes
  useEffect(() => {
    if (!day || !boat) return
    supabase
      .from('allcoastals_catches')
      .select('angler_name, team_name, total_fish, total_points, boat_percentage, catches')
      .eq('day_number', parseInt(day))
      .eq('boat_name', boat)
      .then(({ data }) => setBoatSummary(data || []))
  }, [day, boat, saved])

  const handleCatchChange = (speciesName, entry) => {
    setCatches(prev => prev.map(c => c.species === speciesName ? entry : c))
  }

  const totalPoints = calcAnglerPoints(catches)
  const totalFish = calcTotalFish(catches)

  const handleSave = async () => {
    if (!day || !boat || !anglerName) return
    setSaving(true)
    setError('')

    // Calculate boat percentages after save
    const payload = {
      entered_by: user.id,
      day_number: parseInt(day),
      boat_name: boat,
      angler_name: anglerName,
      team_name: anglerTeam,
      catches,
      total_fish: totalFish,
      total_points: totalPoints,
      record_claims: recordClaims.split('\n').map(s => s.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    }

    let err
    if (existingEntry) {
      ;({ error: err } = await supabase
        .from('allcoastals_catches')
        .update(payload)
        .eq('id', existingEntry.id))
    } else {
      ;({ error: err } = await supabase
        .from('allcoastals_catches')
        .insert(payload))
    }

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    // Recalculate boat percentages for all anglers on this boat/day
    const { data: boatData } = await supabase
      .from('allcoastals_catches')
      .select('id, total_points')
      .eq('day_number', parseInt(day))
      .eq('boat_name', boat)

    if (boatData && boatData.length > 0) {
      const maxPts = Math.max(...boatData.map(r => r.total_points))
      for (const row of boatData) {
        const pct = maxPts > 0 ? parseFloat(((row.total_points / maxPts) * 100).toFixed(2)) : 0
        await supabase
          .from('allcoastals_catches')
          .update({ boat_max_points: maxPts, boat_percentage: pct })
          .eq('id', row.id)
      }
    }

    setSaving(false)
    setSaved(true)
    // Reload existing entry
    const { data: fresh } = await supabase
      .from('allcoastals_catches')
      .select('*')
      .eq('day_number', parseInt(day))
      .eq('angler_name', anglerName)
      .maybeSingle()
    setExistingEntry(fresh)

    // Refresh boat summary
    const { data: bs } = await supabase
      .from('allcoastals_catches')
      .select('angler_name, team_name, total_fish, total_points, boat_percentage, catches')
      .eq('day_number', parseInt(day))
      .eq('boat_name', boat)
    setBoatSummary(bs || [])
  }

  const boats = Object.keys(SKIPPERS)

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>🎣 SADSAA All Coastal Bottomfish 2026</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 2 }}>St Francis Bay · Catch Logger</div>
      </div>

      {/* Step 1: Day & Boat */}
      <div style={S.card}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#1e3a8a' }}>Step 1 — Select Day & Boat</div>
        <div style={S.grid2}>
          <div>
            <div style={S.label}>Fishing Day</div>
            <select style={S.select} value={day} onChange={e => { setDay(e.target.value); setBoat(''); setAnglerName('') }}>
              <option value=''>Select day…</option>
              <option value='1'>Day 1</option>
              <option value='2'>Day 2</option>
              <option value='3'>Day 3</option>
            </select>
          </div>
          <div>
            <div style={S.label}>Boat</div>
            <select style={S.select} value={boat} onChange={e => { setBoat(e.target.value); setAnglerName('') }} disabled={!day}>
              <option value=''>Select boat…</option>
              {boats.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        {boat && (
          <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: '#eff6ff', borderRadius: 6, fontSize: '0.85rem', color: '#1e40af' }}>
            <strong>Skipper:</strong> {SKIPPERS[boat]} &nbsp;|&nbsp;
            <strong>Anglers ({boatAnglers.length}):</strong> {boatAnglers.join(', ')}
          </div>
        )}
      </div>

      {/* Step 2: Angler */}
      {boat && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#1e3a8a' }}>Step 2 — Select Angler</div>
          <select style={S.select} value={anglerName} onChange={e => setAnglerName(e.target.value)}>
            <option value=''>Select angler…</option>
            {boatAnglers.map(a => (
              <option key={a} value={a}>{a} ({getAnglerTeam(a)})</option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs: Entry / Boat Summary */}
      {anglerName && !loadingExisting && (
        <>
          <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            {['entry','boat'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: '0.65rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                  background: activeTab === tab ? '#1e3a8a' : 'white',
                  color: activeTab === tab ? 'white' : '#374151' }}>
                {tab === 'entry' ? `📝 ${anglerName.split(' ')[0]}'s Card` : `🚤 ${boat} Summary`}
              </button>
            ))}
          </div>

          {activeTab === 'entry' && (
            <>
              {/* Angler info bar */}
              <div style={{ ...S.card, background: '#f8fafc', marginBottom: '0.75rem' }}>
                <div style={S.row}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{anglerName}</div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>{anglerTeam} · Day {day} · {boat}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>TOTAL PTS</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e3a8a', lineHeight: 1 }}>{totalPoints}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>FISH</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{totalFish}</div>
                  </div>
                </div>
                {existingEntry?.boat_percentage != null && (
                  <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', background: '#dbeafe', borderRadius: 6, fontSize: '0.85rem', color: '#1e40af', fontWeight: 600 }}>
                    Boat position: {existingEntry.boat_percentage}%
                  </div>
                )}
              </div>

              {/* Species scorecard */}
              <div style={S.card}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#1e3a8a' }}>Step 3 — Record Catches</div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  Tap + for each fish landed. Toggle Over Line if fish exceeds the threshold length on the SADSAA mat.
                </div>

                {/* Group species by points tier */}
                {[
                  { label: '3 pts / fish', filter: sp => sp.pointsPerFish === 3 },
                  { label: '4 pts / fish', filter: sp => sp.pointsPerFish === 4 },
                  { label: '5 pts / fish', filter: sp => sp.pointsPerFish === 5 },
                ].map(group => (
                  <div key={group.label} style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', paddingLeft: 2 }}>
                      ── {group.label}
                    </div>
                    {SPECIES.filter(group.filter).map(sp => {
                      const entry = catches.find(c => c.species === sp.name) || { species: sp.name, fishCount: 0, overLineCount: 0 }
                      return (
                        <SpeciesRow key={sp.name} sp={sp} entry={entry}
                          onChange={e => handleCatchChange(sp.name, e)} disabled={false} />
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Record/PB claims */}
              <div style={S.card}>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#1e3a8a' }}>Record / PB / CV Claims — as declared by angler</div>
                <textarea
                  placeholder="e.g. Geelbek 4.2kg 94cm Fork — Record claim&#10;Kob 3.1kg 88cm Total — PB"
                  value={recordClaims}
                  onChange={e => setRecordClaims(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {/* Save */}
              {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.9rem' }}>{error}</div>}
              {saved && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>✅ Saved! Boat percentages recalculated.</div>}

              <div style={S.row}>
                <button onClick={handleSave} disabled={saving || totalFish === 0}
                  style={{ ...S.btn('#1e3a8a'), opacity: (saving || totalFish === 0) ? 0.5 : 1, padding: '0.75rem 2rem', fontSize: '1rem' }}>
                  {saving ? 'Saving…' : existingEntry ? '💾 Update Scorecard' : '💾 Save Scorecard'}
                </button>
                {totalFish === 0 && <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Record at least 1 fish to save</span>}
              </div>
            </>
          )}

          {activeTab === 'boat' && (
            <div style={S.card}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#1e3a8a' }}>
                🚤 {boat} — Day {day} Summary
              </div>
              <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                Skipper: {SKIPPERS[boat]} &nbsp;·&nbsp; {boatAnglers.length} anglers assigned
              </div>
              {boatSummary.length === 0 ? (
                <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No catches recorded for this boat yet.</div>
              ) : (
                <>
                  {/* Sort by points desc */}
                  {[...boatSummary].sort((a,b) => b.total_points - a.total_points).map((row, i) => (
                    <div key={row.angler_name} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem', background: i === 0 ? '#fefce8' : 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{i === 0 ? '🏆 ' : ''}{row.angler_name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{row.team_name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1e3a8a' }}>
                            {row.boat_percentage != null ? `${row.boat_percentage}%` : `${row.total_points}pts`}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{row.total_points} pts · {row.total_fish} fish</div>
                        </div>
                      </div>
                      {/* Species breakdown */}
                      {row.catches?.filter(c => c.fishCount > 0).length > 0 && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {row.catches.filter(c => c.fishCount > 0).map(c => (
                            <span key={c.species} style={S.badge('#374151')}>
                              {c.species} ×{c.fishCount}{c.overLineCount > 0 ? ` (OL:${c.overLineCount})` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Anglers not yet entered */}
                  {boatAnglers.filter(a => !boatSummary.find(r => r.angler_name === a)).map(a => (
                    <div key={a} style={{ border: '1px dashed #d1d5db', borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem', color: '#9ca3af' }}>
                      {a} ({getAnglerTeam(a)}) — not yet entered
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {loadingExisting && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading…</div>
      )}
    </div>
  )
}
