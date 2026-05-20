import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['malcolmmurchgrant@gmail.com', 'mpca99@telkomsa.net']

const SKIPPERS = {
  'ELITE CAT':'André Olivier','FISHBONE':'Richard Fulford',
  'NOTHING BUT BUTT':'André Labuschagne','CAESAR':'Louis Fouché',
  'SON OF JAMAICA':'Martin Gierz','REEL NAUTI':'Ryno Nel',
  'SEA DOG':'Garth Webb','LEIGHWAY':'Tim Gillitt',
  'U GO GIRL':'Johan Coetzer','MACUSHLA':'Chris Gerber',
}

const TEAMS_DATA = {
  'EPDSAA B':               { captain:'Brenda Weyer',           anglers:['Madelein Fourie','Brenda Weyer','Joelene Lerm'] },
  'WESTERN PROVINCE':       { captain:'Stephen Flemming',        anglers:['Ossie Sauermann','Stephen Flemming','Gareth Decker'] },
  'BORDER WHITE':           { captain:'Andrew Sparg',            anglers:['Andrew Sparg','Tim Wood','Dennis Ford'] },
  'SOUTHERN CAPE JNR WHITE':{ captain:'Joshua Du Plessis',       anglers:['Saxon Ansley','Joshua Du Plessis','Jaden De Villiers'] },
  'SOUTHERN CAPE MEN':      { captain:'Kabous Oosthuizen',       anglers:['Wessel Havenga','Pieter Strobos','Kabous Oosthuizen'] },
  'EPDSAA A':               { captain:'Brett Potgieter',         anglers:['Jacques Bekker','Deon Van Jaarsvelt','Brett Potgieter'] },
  'FREE STATE':             { captain:'Riaz Hussain',            anglers:['Riaz Hussain','Sayed Cassiem','Brandon Hooke'] },
  'BORDER BLUE':            { captain:'Michael Swanepoel',       anglers:['Peter Mansvelt','Michael Swanepoel','Wayne Vooght'] },
  'NATAL':                  { captain:'Andrea Papachristoforou', anglers:['Andrea Papachristoforou','Xavier Truluck','Phillip Papachristoforou'] },
  'EP LADIES B':            { captain:'Lisa Bekker',             anglers:['Sheena Gerber','Maggie Koleskie','Lisa Bekker'] },
  'SOUTHERN CAPE JNR GREEN':{ captain:'Jack Magerla',            anglers:['Ben Groenewald','Jack Magerla','Owen Lineker'] },
  'EP LADIES A':            { captain:'Wayne Gerber',            anglers:['Donald Brown','Wayne Gerber','Brian Gerber'] },
}

const BOAT_DRAW = {
  'Madelein Fourie':         ['ELITE CAT','FISHBONE','SON OF JAMAICA'],
  'Brenda Weyer':            ['CAESAR','SEA DOG','REEL NAUTI'],
  'Joelene Lerm':            ['SEA DOG','ELITE CAT','FISHBONE'],
  'Ossie Sauermann':         ['ELITE CAT','NOTHING BUT BUTT','REEL NAUTI'],
  'Stephen Flemming':        ['CAESAR','LEIGHWAY','SON OF JAMAICA'],
  'Gareth Decker':           ['LEIGHWAY','ELITE CAT','NOTHING BUT BUTT'],
  'Andrew Sparg':            ['ELITE CAT','CAESAR','FISHBONE'],
  'Tim Wood':                ['CAESAR','U GO GIRL','ELITE CAT'],
  'Dennis Ford':             ['U GO GIRL','FISHBONE','REEL NAUTI'],
  'Saxon Ansley':            ['ELITE CAT','SON OF JAMAICA','NOTHING BUT BUTT'],
  'Joshua Du Plessis':       ['CAESAR','MACUSHLA','FISHBONE'],
  'Jaden De Villiers':       ['MACUSHLA','FISHBONE','ELITE CAT'],
  'Wessel Havenga':          ['FISHBONE','ELITE CAT','SON OF JAMAICA'],
  'Pieter Strobos':          ['SON OF JAMAICA','SEA DOG','ELITE CAT'],
  'Kabous Oosthuizen':       ['SEA DOG','NOTHING BUT BUTT','CAESAR'],
  'Jacques Bekker':          ['FISHBONE','NOTHING BUT BUTT','ELITE CAT'],
  'Deon Van Jaarsvelt':      ['SON OF JAMAICA','LEIGHWAY','FISHBONE'],
  'Brett Potgieter':         ['LEIGHWAY','REEL NAUTI','CAESAR'],
  'Riaz Hussain':            ['FISHBONE','CAESAR','NOTHING BUT BUTT'],
  'Sayed Cassiem':           ['SON OF JAMAICA','U GO GIRL','CAESAR'],
  'Brandon Hooke':           ['U GO GIRL','NOTHING BUT BUTT','SEA DOG'],
  'Peter Mansvelt':          ['FISHBONE','SON OF JAMAICA','CAESAR'],
  'Michael Swanepoel':       ['SON OF JAMAICA','MACUSHLA','NOTHING BUT BUTT'],
  'Wayne Vooght':            ['MACUSHLA','REEL NAUTI','SEA DOG'],
  'Andrea Papachristoforou': ['NOTHING BUT BUTT','ELITE CAT','SEA DOG'],
  'Xavier Truluck':          ['REEL NAUTI','SEA DOG','LEIGHWAY'],
  'Phillip Papachristoforou':['SEA DOG','CAESAR','U GO GIRL'],
  'Sheena Gerber':           ['NOTHING BUT BUTT','FISHBONE','LEIGHWAY'],
  'Maggie Koleskie':         ['REEL NAUTI','LEIGHWAY','U GO GIRL'],
  'Lisa Bekker':             ['LEIGHWAY','CAESAR','MACUSHLA'],
  'Ben Groenewald':          ['NOTHING BUT BUTT','SON OF JAMAICA','U GO GIRL'],
  'Jack Magerla':            ['REEL NAUTI','U GO GIRL','MACUSHLA'],
  'Owen Lineker':            ['U GO GIRL','REEL NAUTI','LEIGHWAY'],
  'Donald Brown':            ['NOTHING BUT BUTT','REEL NAUTI','MACUSHLA'],
  'Wayne Gerber':            ['REEL NAUTI','MACUSHLA','SON OF JAMAICA'],
  'Brian Gerber':            ['MACUSHLA','SON OF JAMAICA','REEL NAUTI'],
}

const SPECIES = [
  { name:'BAARTMAN',              bag:5,  minSize:40,  pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'BANK STEENBRAS',        bag:5,  minSize:50,  pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'BLACKTAIL',             bag:5,  minSize:25,  pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'BLUE HOTTENTOT',        bag:5,  minSize:null,pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'BRONZE BREAM',          bag:2,  minSize:30,  pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'CARPENTER',             bag:4,  minSize:35,  pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'DANE',                  bag:5,  minSize:null,pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'GURNARD',               bag:10, minSize:null,pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'KOB',                   bag:5,  minSize:50,  pointsPerFish:3, overLineLength:84,   lengthType:'T' },
  { name:'KOB (>110cm)',          bag:1,  minSize:110, pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'PANGA / DIKBEKKIE',     bag:10, minSize:null,pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'ROMAN',                 bag:2,  minSize:30,  pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'SHAD / ELF',            bag:5,  minSize:30,  pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'SOLDIER / BASTERMAN',   bag:5,  minSize:30,  pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'STOCKFISH',             bag:10, minSize:null,pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'ZEBRA / WILDEPERD',     bag:5,  minSize:30,  pointsPerFish:3, overLineLength:null, lengthType:null },
  { name:'CATFACE ROCKCOD',       bag:5,  minSize:50,  pointsPerFish:4, overLineLength:null, lengthType:null },
  { name:'GRUNTER',               bag:5,  minSize:40,  pointsPerFish:4, overLineLength:null, lengthType:null },
  { name:'GEELBEK / CAPE SALMON', bag:2,  minSize:60,  pointsPerFish:4, overLineLength:88,   lengthType:'F' },
  { name:'SCOTSMAN',              bag:1,  minSize:40,  pointsPerFish:4, overLineLength:71,   lengthType:'F' },
  { name:'DAGERAAD',              bag:1,  minSize:40,  pointsPerFish:5, overLineLength:null, lengthType:null },
  { name:'ENGLISHMAN',            bag:1,  minSize:40,  pointsPerFish:5, overLineLength:null, lengthType:null },
  { name:'GREATER YELLOWTAIL',    bag:10, minSize:null,pointsPerFish:5, overLineLength:79,   lengthType:'F' },
  { name:'JAN BRUIN',             bag:1,  minSize:null,pointsPerFish:5, overLineLength:null, lengthType:null },
  { name:'MISS LUCY / RED STUMP', bag:1,  minSize:30,  pointsPerFish:5, overLineLength:61,   lengthType:'F' },
  { name:'MOUSTACHE ROCKCOD',     bag:4,  minSize:50,  pointsPerFish:5, overLineLength:70,   lengthType:'T' },
  { name:'MUSSELLCRACKER',        bag:1,  minSize:60,  pointsPerFish:5, overLineLength:65,   lengthType:'F' },
  { name:'RED STEENBRAS / COPPER',bag:1,  minSize:60,  pointsPerFish:5, overLineLength:68,   lengthType:'F' },
  { name:'WHITE STEENBRAS',       bag:1,  minSize:60,  pointsPerFish:5, overLineLength:65,   lengthType:'F' },
  { name:'YELLOWBELLY ROCKCOD',   bag:1,  minSize:60,  pointsPerFish:5, overLineLength:70,   lengthType:'T' },
  { name:'YELLOWTAIL',            bag:10, minSize:null,pointsPerFish:5, overLineLength:79,   lengthType:'F' },
  { name:'BLACK MUSSELCRACKER',   bag:1,  minSize:50,  pointsPerFish:5, overLineLength:60,   lengthType:'F' },
]

const SPECIES_BONUS = 3
const OVER_LINE_BONUS = 5

function calcPoints(catches) {
  let total = 0
  for (const c of catches) {
    if (!c.fishCount) continue
    const sp = SPECIES.find(s => s.name === c.species)
    if (!sp) continue
    total += sp.pointsPerFish + SPECIES_BONUS
    if (c.fishCount > 1) total += sp.pointsPerFish * (c.fishCount - 1)
    total += (c.overLineCount || 0) * OVER_LINE_BONUS
  }
  return total
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const NAVY = '#1e3a8a'
const S = {
  page:    { maxWidth:960, margin:'0 auto', padding:'1rem', fontFamily:'system-ui,sans-serif' },
  header:  { background:NAVY, color:'white', padding:'1rem 1.5rem', borderRadius:8, marginBottom:'1.25rem' },
  card:    { background:'white', borderRadius:8, padding:'1.25rem', boxShadow:'0 1px 4px rgba(0,0,0,0.1)', marginBottom:'1rem' },
  label:   { fontSize:'0.78rem', fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 },
  input:   { width:'100%', padding:'0.55rem 0.75rem', borderRadius:6, border:'1px solid #d1d5db', fontSize:'0.9rem', boxSizing:'border-box' },
  select:  { width:'100%', padding:'0.55rem 0.75rem', borderRadius:6, border:'1px solid #d1d5db', fontSize:'0.9rem', background:'white' },
  btn:     (col=NAVY, outline=false) => ({
    background:outline?'white':col, color:outline?col:'white',
    border:`2px solid ${col}`, padding:'0.5rem 1.1rem', borderRadius:6,
    cursor:'pointer', fontWeight:600, fontSize:'0.88rem',
  }),
  tab:     (active) => ({
    flex:1, padding:'0.6rem 0.4rem', border:'none', cursor:'pointer', fontWeight:600, fontSize:'0.82rem',
    background:active?NAVY:'white', color:active?'white':'#374151',
  }),
  badge:   (col) => ({ background:col, color:'white', padding:'0.15rem 0.55rem', borderRadius:20, fontSize:'0.75rem', fontWeight:700 }),
  danger:  { background:'#fef2f2', color:'#dc2626', padding:'0.6rem 0.75rem', borderRadius:6, fontSize:'0.85rem', marginBottom:'0.75rem' },
  success: { background:'#f0fdf4', color:'#16a34a', padding:'0.6rem 0.75rem', borderRadius:6, fontSize:'0.85rem', marginBottom:'0.75rem', fontWeight:600 },
  warn:    { background:'#fffbeb', color:'#92400e', padding:'0.6rem 0.75rem', borderRadius:6, fontSize:'0.85rem', marginBottom:'0.75rem' },
}

// ─── INLINE EDIT MODAL ───────────────────────────────────────────────────────

function EditModal({ entry, onSave, onClose }) {
  const [catches, setCatches] = useState(
    SPECIES.map(sp => {
      const existing = entry.catches?.find(c => c.species === sp.name)
      return { species:sp.name, fishCount: existing?.fishCount||0, overLineCount: existing?.overLineCount||0 }
    })
  )
  const [recordClaims, setRecordClaims] = useState(entry.record_claims?.join('\n')||'')
  const [saving, setSaving] = useState(false)

  const totalPoints = calcPoints(catches)
  const totalFish   = catches.reduce((s,c) => s+c.fishCount, 0)

  const updateCatch = (species, field, val) => {
    setCatches(prev => prev.map(c => {
      if (c.species !== species) return c
      const updated = { ...c, [field]: Math.max(0, val) }
      // Keep overLineCount <= fishCount
      if (updated.overLineCount > updated.fishCount) updated.overLineCount = updated.fishCount
      return updated
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(entry.id, catches, totalFish, totalPoints,
      recordClaims.split('\n').map(s=>s.trim()).filter(Boolean))
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'1rem', overflowY:'auto' }}>
      <div style={{ background:'white', borderRadius:10, width:'100%', maxWidth:700, padding:'1.5rem', marginTop:'1rem' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:'1.05rem', color:NAVY }}>Edit Scorecard</div>
            <div style={{ fontSize:'0.82rem', color:'#6b7280' }}>
              {entry.angler_name} · {entry.team_name} · Day {entry.day_number} · {entry.boat_name}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.4rem', cursor:'pointer', color:'#6b7280' }}>✕</button>
        </div>

        {/* Running totals */}
        <div style={{ display:'flex', gap:'1rem', background:'#eff6ff', borderRadius:8, padding:'0.75rem 1rem', marginBottom:'1rem' }}>
          <div><span style={{ fontSize:'0.75rem', color:'#6b7280' }}>POINTS </span><strong style={{ fontSize:'1.2rem', color:NAVY }}>{totalPoints}</strong></div>
          <div><span style={{ fontSize:'0.75rem', color:'#6b7280' }}>FISH </span><strong style={{ fontSize:'1.2rem', color:'#16a34a' }}>{totalFish}</strong></div>
        </div>

        {/* Species grid */}
        <div style={{ maxHeight:'50vh', overflowY:'auto', marginBottom:'1rem' }}>
          {[3,4,5].map(pts => (
            <div key={pts}>
              <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', padding:'0.3rem 0', marginTop:'0.5rem' }}>── {pts} pts / fish</div>
              {SPECIES.filter(sp => sp.pointsPerFish === pts).map(sp => {
                const c = catches.find(x => x.species === sp.name)
                return (
                  <div key={sp.name} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'0.5rem', alignItems:'center', padding:'0.3rem 0', borderBottom:'1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'0.85rem' }}>{sp.name}</div>
                      <div style={{ fontSize:'0.72rem', color:'#9ca3af' }}>
                        Bag {sp.bag}{sp.minSize?` · min ${sp.minSize}cm`:''}{sp.overLineLength?` · OL >${sp.overLineLength}cm(${sp.lengthType})`:''}
                      </div>
                    </div>
                    {/* Fish counter */}
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'0.68rem', color:'#6b7280', marginBottom:2 }}>FISH</div>
                      <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                        <button onClick={() => updateCatch(sp.name,'fishCount',c.fishCount-1)}
                          style={{ width:24, height:24, borderRadius:'50%', border:'1px solid #d1d5db', background:'white', cursor:'pointer', fontSize:'0.9rem' }}>−</button>
                        <span style={{ minWidth:18, textAlign:'center', fontWeight:700, color:c.fishCount>0?'#16a34a':'#374151' }}>{c.fishCount}</span>
                        <button onClick={() => updateCatch(sp.name,'fishCount',Math.min(c.fishCount+1, sp.bag))}
                          style={{ width:24, height:24, borderRadius:'50%', border:'1px solid #d1d5db', background:c.fishCount>=sp.bag?'#f3f4f6':'#dcfce7', cursor:c.fishCount>=sp.bag?'default':'pointer', fontSize:'0.9rem' }}>+</button>
                      </div>
                    </div>
                    {/* Over-line counter */}
                    <div style={{ textAlign:'center', minWidth:80 }}>
                      {sp.overLineLength ? (
                        <>
                          <div style={{ fontSize:'0.68rem', color:'#6b7280', marginBottom:2 }}>OVER LINE</div>
                          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                            <button onClick={() => updateCatch(sp.name,'overLineCount',c.overLineCount-1)}
                              style={{ width:24, height:24, borderRadius:'50%', border:'1px solid #d1d5db', background:'white', cursor:'pointer', fontSize:'0.9rem' }}>−</button>
                            <span style={{ minWidth:18, textAlign:'center', fontWeight:700, color:c.overLineCount>0?'#d97706':'#374151' }}>{c.overLineCount}</span>
                            <button onClick={() => updateCatch(sp.name,'overLineCount',Math.min(c.overLineCount+1, c.fishCount))}
                              style={{ width:24, height:24, borderRadius:'50%', border:'1px solid #d1d5db', background:c.overLineCount>=c.fishCount?'#f3f4f6':'#fef3c7', cursor:c.overLineCount>=c.fishCount?'default':'pointer', fontSize:'0.9rem' }}>+</button>
                          </div>
                        </>
                      ) : <div style={{ color:'#e5e7eb', fontSize:'0.75rem' }}>—</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Record claims */}
        <div style={{ marginBottom:'1rem' }}>
          <div style={S.label}>Record / PB / CV Claims</div>
          <textarea value={recordClaims} onChange={e => setRecordClaims(e.target.value)} rows={2}
            style={{ ...S.input, resize:'vertical' }}
            placeholder="e.g. Geelbek 4.2kg 94cm Fork — Record claim" />
        </div>

        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={S.btn('#6b7280', true)}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...S.btn(), opacity:saving?0.6:1 }}>
            {saving ? 'Saving…' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function AllCoastalsAdmin() {
  const { user } = useAuth()
  const [activeTab, setActiveTab]     = useState('overview')
  const [userRole, setUserRole]       = useState(null)   // 'admin' | 'scorer' | null
  const [checkingAccess, setChecking] = useState(true)
  const [roles, setRoles]             = useState([])
  const [catches, setCatches]         = useState([])
  const [newRole, setNewRole]         = useState({ email:'', role:'scorer' })
  const [msg, setMsg]                 = useState({ text:'', type:'' })
  const [loading, setLoading]         = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editEntry, setEditEntry]     = useState(null)

  // ── Access check ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    if (ADMIN_EMAILS.includes(user.email)) {
      setUserRole('admin')
      setChecking(false)
      return
    }
    supabase.from('allcoastals_roles').select('role').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        setUserRole(data?.role || null)
        setChecking(false)
      })
  }, [user])

  const isAdmin  = userRole === 'admin'
  const isScorer = userRole === 'scorer' || isAdmin
  const hasAccess = isAdmin || isScorer

  // Scorers land on the Scorecards tab directly
  useEffect(() => {
    if (userRole === 'scorer') setActiveTab('entries')
  }, [userRole])

  const loadRoles = useCallback(async () => {
    const { data } = await supabase.from('allcoastals_roles').select('*').order('created_at')
    setRoles(data || [])
  }, [])

  const loadCatches = useCallback(async () => {
    const { data } = await supabase.from('allcoastals_catches').select('*').order('day_number').order('boat_name')
    setCatches(data || [])
  }, [])

  useEffect(() => {
    if (!hasAccess) return
    loadCatches()
    if (isAdmin) loadRoles()
  }, [hasAccess, isAdmin, loadCatches, loadRoles])

  const showMsg = (text, type='success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text:'', type:'' }), 4500)
  }

  // ── Recalculate boat %s for a given day+boat ─────────────────────────────
  const recalcBoat = async (dayNumber, boatName, allCatches) => {
    const rows = allCatches.filter(r => r.day_number===dayNumber && r.boat_name===boatName)
    if (rows.length === 0) return
    const maxPts = Math.max(...rows.map(r => r.total_points))
    for (const row of rows) {
      const pct = maxPts > 0 ? parseFloat(((row.total_points/maxPts)*100).toFixed(2)) : 0
      await supabase.from('allcoastals_catches')
        .update({ boat_max_points:maxPts, boat_percentage:pct })
        .eq('id', row.id)
    }
  }

  // ── Save edited entry ────────────────────────────────────────────────────
  const handleSaveEdit = async (id, newCatches, totalFish, totalPoints, recordClaims) => {
    const { error } = await supabase.from('allcoastals_catches').update({
      catches: newCatches,
      total_fish: totalFish,
      total_points: totalPoints,
      record_claims: recordClaims,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    if (error) { showMsg(error.message, 'error'); return }

    // Reload catches then recalculate boat %s for the affected day+boat
    const { data: fresh } = await supabase.from('allcoastals_catches').select('*').order('day_number').order('boat_name')
    const freshCatches = fresh || []
    setCatches(freshCatches)

    const edited = freshCatches.find(r => r.id === id)
    if (edited) await recalcBoat(edited.day_number, edited.boat_name, freshCatches)

    // Reload one more time to get updated percentages
    const { data: final } = await supabase.from('allcoastals_catches').select('*').order('day_number').order('boat_name')
    setCatches(final || [])
    setEditEntry(null)
    showMsg(`Scorecard for ${edited?.angler_name} updated and boat percentages recalculated.`)
  }

  // ── Delete entry ─────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    const target = catches.find(r => r.id === id)
    const { error } = await supabase.from('allcoastals_catches').delete().eq('id', id)
    if (error) { showMsg(error.message, 'error'); return }
    const { data: fresh } = await supabase.from('allcoastals_catches').select('*').order('day_number').order('boat_name')
    const freshCatches = fresh || []
    setCatches(freshCatches)
    if (target) await recalcBoat(target.day_number, target.boat_name, freshCatches)
    const { data: final } = await supabase.from('allcoastals_catches').select('*').order('day_number').order('boat_name')
    setCatches(final || [])
    setDeleteTarget(null)
    showMsg('Entry deleted and boat percentages recalculated.')
  }

  // ── Recalculate all ──────────────────────────────────────────────────────
  const handleRecalcAll = async () => {
    setLoading(true)
    const boatDays = [...new Set(catches.map(r => `${r.day_number}|${r.boat_name}`))]
    for (const key of boatDays) {
      const [day, boat] = key.split('|')
      await recalcBoat(parseInt(day), boat, catches)
    }
    await loadCatches()
    showMsg('All boat percentages recalculated.')
    setLoading(false)
  }

  // ── Add role ─────────────────────────────────────────────────────────────
  const handleAddRole = async () => {
    if (!newRole.email.trim()) return
    setLoading(true)
    const { data: userData, error: userErr } = await supabase
      .from('users').select('id').eq('email', newRole.email.trim().toLowerCase()).single()
    if (userErr || !userData) {
      showMsg('User not found — they must register in the app first.', 'error')
      setLoading(false)
      return
    }
    const { error } = await supabase.from('allcoastals_roles').upsert({
      user_id: userData.id, email: newRole.email.trim().toLowerCase(),
      role: newRole.role, granted_by: user.id,
    }, { onConflict:'user_id' })
    if (error) { showMsg(error.message, 'error'); setLoading(false); return }
    showMsg(`Role '${newRole.role}' granted to ${newRole.email}`)
    setNewRole({ email:'', role:'scorer' })
    loadRoles()
    setLoading(false)
  }

  // ── Remove role ──────────────────────────────────────────────────────────
  const handleRemoveRole = async (id) => {
    await supabase.from('allcoastals_roles').delete().eq('id', id)
    showMsg('Role removed.')
    setDeleteTarget(null)
    loadRoles()
  }

  // ─── Guards ───────────────────────────────────────────────────────────────
  if (checkingAccess) return <div style={{ padding:'2rem', textAlign:'center', color:'#6b7280' }}>Checking access…</div>

  if (!hasAccess) return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign:'center', padding:'3rem' }}>
        <div style={{ fontSize:'2rem', marginBottom:'1rem' }}>🔒</div>
        <div style={{ fontWeight:700, fontSize:'1.1rem' }}>Admin / Scorer Access Required</div>
        <div style={{ color:'#6b7280', marginTop:'0.5rem' }}>Contact Malcolm Grant to be granted access.</div>
      </div>
    </div>
  )

  // ─── Derived stats ────────────────────────────────────────────────────────
  const totalEntries  = catches.length
  const totalFish     = catches.reduce((s,r) => s+(r.total_fish||0), 0)
  const daysWithData  = [...new Set(catches.map(r => r.day_number))].sort()
  const entriesPerDay = [1,2,3].map(d => ({ day:d, count:catches.filter(r=>r.day_number===d).length }))
  const missingEntries = []
  for (const [angler, days] of Object.entries(BOAT_DRAW)) {
    for (let d=1; d<=3; d++) {
      if (!catches.find(r => r.angler_name===angler && r.day_number===d))
        missingEntries.push({ angler, day:d, boat:days[d-1] })
    }
  }

  // Tabs available per role
  const allTabs = [
    { id:'overview', label:'📊 Overview',  adminOnly:true  },
    { id:'entries',  label:'📋 Scorecards',adminOnly:false },
    { id:'draw',     label:'🚤 Boat Draw', adminOnly:false },
    { id:'teams',    label:'🏅 Teams',     adminOnly:true  },
    { id:'roles',    label:'👥 Roles',     adminOnly:true  },
  ].filter(t => isAdmin || !t.adminOnly)

  return (
    <div style={S.page}>
      {editEntry && (
        <EditModal entry={editEntry} onSave={handleSaveEdit} onClose={() => setEditEntry(null)} />
      )}

      {/* Header */}
      <div style={S.header}>
        <div style={{ fontWeight:700, fontSize:'1.1rem' }}>⚙️ SADSAA All Coastal 2026 — Admin Panel</div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginTop:3, flexWrap:'wrap' }}>
          <span style={{ fontSize:'0.82rem', opacity:0.8 }}>{user.email}</span>
          <span style={S.badge(userRole==='admin'?'#1d4ed8':'#16a34a')}>{userRole}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:'1rem', borderRadius:8, overflow:'hidden', border:'1px solid #e5e7eb' }}>
        {allTabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={S.tab(activeTab===t.id)}>{t.label}</button>
        ))}
      </div>

      {msg.text && <div style={msg.type==='error'?S.danger:S.success}>{msg.text}</div>}

      {/* ── OVERVIEW (admin only) ── */}
      {activeTab==='overview' && isAdmin && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:'0.75rem', marginBottom:'1rem' }}>
            {[
              { label:'Scorecards',       value:totalEntries, sub:'/ 108 total', col:NAVY },
              { label:'Fish Recorded',    value:totalFish,    sub:'',            col:'#16a34a' },
              { label:'Days Fished',      value:`${daysWithData.length}/3`, sub:'', col:'#d97706' },
              { label:'Missing Entries',  value:missingEntries.length, sub:'', col:missingEntries.length>0?'#dc2626':'#16a34a' },
            ].map(st => (
              <div key={st.label} style={{ ...S.card, marginBottom:0, textAlign:'center' }}>
                <div style={{ fontSize:'2rem', fontWeight:800, color:st.col }}>{st.value}</div>
                <div style={{ fontSize:'0.78rem', color:'#6b7280' }}>{st.label} {st.sub}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <div style={{ fontWeight:700, color:NAVY, marginBottom:'0.75rem' }}>Entries per Day</div>
            {entriesPerDay.map(d => (
              <div key={d.day} style={{ marginBottom:'0.5rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontWeight:600 }}>Day {d.day}</span>
                  <span style={{ fontSize:'0.85rem', color:'#6b7280' }}>{d.count} / 36</span>
                </div>
                <div style={{ height:10, background:'#e5e7eb', borderRadius:5 }}>
                  <div style={{ height:'100%', width:`${(d.count/36)*100}%`, background:d.count===36?'#16a34a':NAVY, borderRadius:5 }} />
                </div>
              </div>
            ))}
          </div>
          {missingEntries.length > 0 && (
            <div style={S.card}>
              <div style={{ fontWeight:700, color:'#dc2626', marginBottom:'0.75rem' }}>⚠️ Missing Entries ({missingEntries.length})</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'0.3rem' }}>
                {missingEntries.map((m,i) => (
                  <span key={i} style={{ fontSize:'0.75rem', background:'#fef2f2', border:'1px solid #fca5a5', padding:'0.2rem 0.5rem', borderRadius:4, color:'#991b1b' }}>
                    Day {m.day} · {m.angler} · {m.boat}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
            <button onClick={handleRecalcAll} disabled={loading} style={S.btn()}>
              {loading?'Recalculating…':'🔄 Recalculate All Boat %s'}
            </button>
            <button onClick={() => { loadCatches(); loadRoles() }} style={S.btn('#374151',true)}>⟳ Refresh</button>
          </div>
        </div>
      )}

      {/* ── SCORECARDS (admin + scorer) ── */}
      {activeTab==='entries' && (
        <div>
          {isScorer && !isAdmin && (
            <div style={S.warn}>
              You have <strong>scorer</strong> access. You can edit any scorecard and your changes will automatically recalculate boat percentages.
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem', flexWrap:'wrap', gap:'0.5rem' }}>
            <div style={{ fontWeight:700, color:NAVY }}>All Scorecard Entries ({totalEntries})</div>
            <button onClick={loadCatches} style={S.btn('#374151',true)}>⟳ Refresh</button>
          </div>
          {[1,2,3].map(day => {
            const dayRows = catches.filter(r => r.day_number===day)
            if (dayRows.length===0) return (
              <div key={day} style={{ ...S.card, color:'#9ca3af', fontStyle:'italic' }}>Day {day} — no entries yet.</div>
            )
            return (
              <div key={day} style={S.card}>
                <div style={{ fontWeight:700, color:NAVY, marginBottom:'0.75rem' }}>
                  Day {day} — {dayRows.length} of 36 entries
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                    <thead>
                      <tr style={{ background:'#f8fafc' }}>
                        {['Angler','Team','Boat','Fish','Pts','Boat %','OL','Actions'].map(h => (
                          <th key={h} style={{ padding:'0.4rem 0.6rem', textAlign:'left', fontWeight:600, color:'#6b7280', borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...dayRows].sort((a,b)=>(b.boat_percentage||0)-(a.boat_percentage||0)).map(r => {
                        const olCount = r.catches?.reduce((s,c)=>s+(c.overLineCount||0),0)||0
                        return (
                          <tr key={r.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                            <td style={{ padding:'0.4rem 0.6rem', fontWeight:600 }}>{r.angler_name}</td>
                            <td style={{ padding:'0.4rem 0.6rem', color:'#6b7280' }}>{r.team_name}</td>
                            <td style={{ padding:'0.4rem 0.6rem', color:'#6b7280' }}>{r.boat_name}</td>
                            <td style={{ padding:'0.4rem 0.6rem', fontWeight:700, color:'#16a34a' }}>{r.total_fish}</td>
                            <td style={{ padding:'0.4rem 0.6rem', fontWeight:700 }}>{r.total_points}</td>
                            <td style={{ padding:'0.4rem 0.6rem', fontWeight:700, color:NAVY }}>
                              {r.boat_percentage!=null ? `${r.boat_percentage}%` : '—'}
                            </td>
                            <td style={{ padding:'0.4rem 0.6rem', color:olCount>0?'#d97706':'#9ca3af', fontWeight:olCount>0?700:400 }}>
                              {olCount>0 ? `${olCount} 🏆` : '—'}
                            </td>
                            <td style={{ padding:'0.4rem 0.6rem' }}>
                              <div style={{ display:'flex', gap:'0.35rem' }}>
                                {/* Edit — available to scorers and admins */}
                                <button onClick={() => setEditEntry(r)}
                                  style={{ ...S.btn('#1d4ed8',true), padding:'0.2rem 0.6rem', fontSize:'0.75rem' }}>
                                  ✏️ Edit
                                </button>
                                {/* Delete — admin only */}
                                {isAdmin && (
                                  deleteTarget===r.id ? (
                                    <>
                                      <button onClick={() => handleDelete(r.id)} style={{ ...S.btn('#dc2626'), padding:'0.2rem 0.5rem', fontSize:'0.75rem' }}>Delete</button>
                                      <button onClick={() => setDeleteTarget(null)} style={{ ...S.btn('#6b7280',true), padding:'0.2rem 0.5rem', fontSize:'0.75rem' }}>Cancel</button>
                                    </>
                                  ) : (
                                    <button onClick={() => setDeleteTarget(r.id)}
                                      style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:'0.8rem', padding:'0.2rem' }}>✕</button>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── BOAT DRAW (admin + scorer) ── */}
      {activeTab==='draw' && (
        <div style={S.card}>
          <div style={{ fontWeight:700, color:NAVY, marginBottom:'0.75rem' }}>Boat Draw — All 3 Days</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['Angler','Team','Day 1','Day 2','Day 3'].map(h => (
                    <th key={h} style={{ padding:'0.5rem 0.75rem', textAlign:'left', fontWeight:600, color:'#6b7280', borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(BOAT_DRAW).map(([angler, days]) => {
                  const team = Object.entries(TEAMS_DATA).find(([,t])=>t.anglers.includes(angler))?.[0]||''
                  const isCapt = TEAMS_DATA[team]?.captain===angler
                  return (
                    <tr key={angler} style={{ borderBottom:'1px solid #f3f4f6' }}>
                      <td style={{ padding:'0.45rem 0.75rem', fontWeight:isCapt?700:400 }}>{angler}{isCapt?' ©':''}</td>
                      <td style={{ padding:'0.45rem 0.75rem', color:'#6b7280', fontSize:'0.78rem' }}>{team}</td>
                      {days.map((boat,i) => {
                        const hasEntry = catches.some(r=>r.angler_name===angler&&r.day_number===i+1)
                        return (
                          <td key={i} style={{ padding:'0.45rem 0.75rem', whiteSpace:'nowrap', color:hasEntry?'#16a34a':'#374151' }}>
                            {hasEntry?'✅ ':''}{boat}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:'0.75rem', fontSize:'0.75rem', color:'#6b7280' }}>© = captain &nbsp;·&nbsp; ✅ = scorecard entered</div>
        </div>
      )}

      {/* ── TEAMS (admin only) ── */}
      {activeTab==='teams' && isAdmin && (
        <div>
          {Object.entries(TEAMS_DATA).map(([team, data]) => {
            const teamCatches = catches.filter(r=>data.anglers.includes(r.angler_name))
            const totalPct    = teamCatches.reduce((s,r)=>s+(r.boat_percentage||0),0)
            return (
              <div key={team} style={S.card}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem', flexWrap:'wrap', gap:'0.5rem' }}>
                  <div>
                    <div style={{ fontWeight:700, color:NAVY }}>{team}</div>
                    <div style={{ fontSize:'0.8rem', color:'#6b7280' }}>Captain: {data.captain}</div>
                  </div>
                  <div style={{ fontWeight:800, fontSize:'1.2rem', color:NAVY }}>{totalPct.toFixed(2)}%</div>
                </div>
                {data.anglers.map(angler => {
                  const aRows = catches.filter(r=>r.angler_name===angler)
                  const aPct  = aRows.reduce((s,r)=>s+(r.boat_percentage||0),0)
                  return (
                    <div key={angler} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.35rem 0.5rem', background:'#f8fafc', borderRadius:5, marginBottom:'0.25rem' }}>
                      <div style={{ flex:1, fontSize:'0.85rem', fontWeight:data.captain===angler?700:400 }}>
                        {angler}{data.captain===angler?' ©':''}
                      </div>
                      <div style={{ fontSize:'0.78rem', color:'#6b7280' }}>{aRows.length}/3 days</div>
                      <div style={{ fontWeight:700, color:NAVY, minWidth:52, textAlign:'right' }}>{aPct.toFixed(1)}%</div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ── ROLES (admin only) ── */}
      {activeTab==='roles' && isAdmin && (
        <div>
          <div style={S.card}>
            <div style={{ fontWeight:700, color:NAVY, marginBottom:'0.5rem' }}>Grant Access</div>
            <div style={{ fontSize:'0.82rem', color:'#6b7280', marginBottom:'0.75rem' }}>
              The user must register at recfish-za.netlify.app first. Scorers can edit all scorecards; admins have full control.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'0.5rem', alignItems:'end' }}>
              <div>
                <div style={S.label}>Email</div>
                <input style={S.input} type="email" placeholder="user@example.com"
                  value={newRole.email} onChange={e=>setNewRole(r=>({...r,email:e.target.value}))} />
              </div>
              <div>
                <div style={S.label}>Role</div>
                <select style={{ ...S.select, width:'auto' }} value={newRole.role}
                  onChange={e=>setNewRole(r=>({...r,role:e.target.value}))}>
                  <option value="scorer">scorer</option>
                  <option value="admin">admin</option>
                  <option value="read_only">read_only</option>
                </select>
              </div>
              <button onClick={handleAddRole} disabled={loading||!newRole.email}
                style={{ ...S.btn(), opacity:!newRole.email?0.5:1 }}>Grant</button>
            </div>
            <div style={{ marginTop:'0.75rem', display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
              {[
                { role:'admin',     desc:'Full control including delete and role management', col:NAVY },
                { role:'scorer',    desc:'Edit all scorecards, view boat draw', col:'#16a34a' },
                { role:'read_only', desc:'Scoreboard view only (no admin access)', col:'#6b7280' },
              ].map(r => (
                <div key={r.role} style={{ fontSize:'0.75rem', background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:6, padding:'0.4rem 0.6rem', flex:1, minWidth:140 }}>
                  <span style={S.badge(r.col)}>{r.role}</span>
                  <div style={{ color:'#6b7280', marginTop:3 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={S.card}>
            <div style={{ fontWeight:700, color:NAVY, marginBottom:'0.75rem' }}>Current Roles</div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem 0.75rem', background:'#eff6ff', borderRadius:6, marginBottom:'0.4rem' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600 }}>Malcolm Grant</div>
                <div style={{ fontSize:'0.8rem', color:'#6b7280' }}>malcolmmurchgrant@gmail.com</div>
              </div>
              <span style={S.badge(NAVY)}>admin</span>
              <span style={{ fontSize:'0.75rem', color:'#9ca3af' }}>System owner</span>
            </div>
            {roles.length===0 && <div style={{ color:'#9ca3af', fontStyle:'italic', fontSize:'0.85rem' }}>No additional roles granted yet.</div>}
            {roles.map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem 0.75rem', border:'1px solid #e5e7eb', borderRadius:6, marginBottom:'0.4rem' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600 }}>{r.email}</div>
                  <div style={{ fontSize:'0.75rem', color:'#9ca3af' }}>Added {new Date(r.created_at).toLocaleDateString('en-ZA')}</div>
                </div>
                <span style={S.badge(r.role==='admin'?NAVY:r.role==='scorer'?'#16a34a':'#6b7280')}>{r.role}</span>
                {deleteTarget===r.id ? (
                  <div style={{ display:'flex', gap:'0.4rem' }}>
                    <button onClick={()=>handleRemoveRole(r.id)} style={{ ...S.btn('#dc2626'), padding:'0.3rem 0.7rem', fontSize:'0.8rem' }}>Confirm</button>
                    <button onClick={()=>setDeleteTarget(null)} style={{ ...S.btn('#6b7280',true), padding:'0.3rem 0.7rem', fontSize:'0.8rem' }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={()=>setDeleteTarget(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:'0.85rem' }}>✕ Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
