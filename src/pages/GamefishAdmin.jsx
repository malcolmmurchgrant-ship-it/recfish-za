import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const COMPETITION_ID = '3855034f-ab39-4297-9be4-ba9a7e566ce0'
const OWNER_ID       = 'b9c5048a-b229-46af-9042-44551b162d75'
const SCORER_ID      = '6b41ebd4-e66f-47a0-9ca7-f22d9f5ee7fd'
const LINE_CLASS     = 10

const NAVY  = '#1e3a8a'
const GOLD  = '#d97706'
const GREEN = '#16a34a'
const RED   = '#dc2626'
const GREY  = '#6b7280'

const TEAMS = {
  'Border':               { captain: 'Tim Wood',          boat: 'ROUGH RIDER',   skipper: 'Arny Nice',              anglers: ['Tim Wood', 'Andrew Sparg', 'Peter Klug'] },
  'Southern Gauteng Red': { captain: 'Wesley Uys',        boat: 'JOY TOY',       skipper: 'Patat de Jager',         anglers: ['Wesley Uys', 'George Breedt', 'Geraldine Breedt'] },
  'Southern Gauteng Blue':{ captain: 'Dirk Rosslee',      boat: 'PIROMERO',      skipper: 'Andries Oosthuizen',     anglers: ['Dirk Rosslee', 'Leno Pillay', 'Yolande Rosslee'] },
  'SADSAA U21':           { captain: 'Francois Rossouw',  boat: 'HOWZIE',        skipper: 'Paul Howells',           anglers: ['Francois Rossouw', 'Jethro Doman', 'Matt Howells'] },
  'Northern Gauteng':     { captain: 'Ryno Le Grange',    boat: 'WALAALAHA',     skipper: 'Riaan Odendaal',         anglers: ['Ryno Le Grange', 'Louis du Plessis', 'JC van Heerden'] },
  'Zululand Black':       { captain: 'Giepie Joubert',    boat: 'GIEPSTER',      skipper: 'Giepie Joubert',         anglers: ['Giepie Joubert', 'Heinz Paul', 'Charl Fourie'] },
  'Zululand White':       { captain: 'Marius Botha',      boat: 'ADDICTED',      skipper: 'Marius Botha',           anglers: ['Marius Botha', 'Willa Martin', 'Janiene Martin'] },
  'Natal':                { captain: 'Alex Tyldesley',    boat: 'BLOOD DIAMOND', skipper: 'Struan Blight',          anglers: ['Alex Tyldesley', 'Elmar Basson', 'Cameron Johnston'] },
  'Mpumalanga':           { captain: 'Ricus van Heerden', boat: 'PIRATE',        skipper: 'Nicky Venter',           anglers: ['Ricus van Heerden', 'Nicky Venter', 'Ruan van der Merwe'] },
}

const DAYS = [
  { value: 1, label: 'Day 1 — Monday 1 June' },
  { value: 2, label: 'Day 2 — Tuesday 2 June' },
  { value: 3, label: 'Day 3 — Wednesday 3 June' },
  { value: 4, label: 'Day 4 — Thursday 4 June' },
  { value: 5, label: 'Day 5 — Friday 5 June' },
]

const SPECIES_GROUPS = [
  { label: 'Billfish (no weight points — multiplier only)', billfish: true, species: ['Black Marlin','Blue Marlin','Striped Marlin','White Marlin','Sailfish','Shortbill Spearfish','Broadbill Swordfish','Other Billfish (specify in notes)'] },
  { label: 'Tuna (min 5kg)', species: ['Yellowfin Tuna','Bigeye Tuna','Bluefin Tuna','Dogtooth Tuna','Longfin Tuna (Albacore)','Other Tuna'] },
  { label: 'Kingfish (photographed & released — 5pts) / Amberjack (min 3kg)', species: ['Giant Kingfish (Ignobilis)','Other Kingfish (Bluefin / Blacklip / Yellowspot etc.)','Amberjack / Tropical Yellowtail'] },
  { label: 'Other Gamefish (min 3kg)', species: ['Wahoo','Dorado','Cobia (Prodigal Son)','Garrick (Leervis)','Great Barracuda','King Mackerel (Cuta)','Queen Mackerel','Queenfish','Rainbow Runner','Green Jobfish (Kakaap)','Yellowtail (Cape)','Elf / Shad','Cape Snoek','Bonito','Other Gamefish (specify in notes)'] },
]

const ALL_SPECIES = SPECIES_GROUPS.flatMap(g =>
  g.species.map(name => ({
    name,
    billfish: !!g.billfish,
    kingfish: g.label.toLowerCase().includes('kingfish'),
    minWeight: g.label.includes('5kg') ? 5 : 3
  }))
)

function calcFishPoints(weightKg, lc = LINE_CLASS) {
  if (!weightKg || weightKg <= 0) return 0
  return parseFloat(((weightKg / lc) ** 2 * 32).toFixed(2))
}

const S = {
  page:   { maxWidth: 960, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' },
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  select: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', background: 'white', boxSizing: 'border-box' },
  input:  { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' },
  btn:    (bg = NAVY, col = 'white') => ({ background: bg, color: col, border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }),
  tab:    (a) => ({ flex: 1, padding: '0.6rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: a ? NAVY : 'white', color: a ? 'white' : '#374151' }),
  badge:  (col) => ({ background: col, color: 'white', padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }),
}

// ─── EDIT MODAL ───────────────────────────────────────────────────────────────
function EditModal({ record, onSave, onClose }) {
  const [catches,    setCatches]    = useState(record.catches || [])
  const [recordNote, setRecordNote] = useState(record.record_note || '')
  const [dq,         setDq]         = useState(record.disqualified || false)
  const [dqReason,   setDqReason]   = useState(record.disqualified_reason || '')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const validCatches = catches.filter(c =>
    c.species && (c.billfish || (c.kingfish_release && c.measured_400mm) || (parseFloat(c.weight_kg) || 0) >= (c.min_weight || 3))
  )

  const totalPoints = validCatches
    .filter(c => !c.billfish)
    .reduce((sum, c) => sum + (c.kingfish_release ? 5 : calcFishPoints(parseFloat(c.weight_kg))), 0)

  const fishCount = validCatches.length

  const addFish = () => {
    if (catches.length >= 10) return
    setCatches(prev => [...prev, { species: '', weight_kg: '', billfish: false, kingfish_release: false, measured_400mm: false, min_weight: 3 }])
  }

  const updateFish = (i, fish) => setCatches(prev => prev.map((f, idx) => idx === i ? fish : f))
  const removeFish = (i)       => setCatches(prev => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (dq && !dqReason.trim()) { setError('Please enter a disqualification reason.'); return }
    setSaving(true); setError('')
    const payload = {
      catches:               validCatches,
      total_points:          parseFloat(totalPoints.toFixed(2)),
      fish_count:            fishCount,
      record_note:           recordNote,
      disqualified:          dq,
      disqualified_reason:   dq ? dqReason.trim() : null,
      updated_at:            new Date().toISOString(),
    }
    const { error: err } = await supabase
      .from('gamefish_catches').update(payload).eq('id', record.id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', maxWidth: 700, width: '100%', marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: NAVY }}>Edit Scorecard</div>
            <div style={{ fontSize: '0.82rem', color: GREY }}>{record.angler_name} · {record.team_name} · Day {record.day_number}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: GREY }}>✕</button>
        </div>

        {/* DQ toggle */}
        <div style={{ background: dq ? '#fef2f2' : '#f9fafb', border: `1px solid ${dq ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 700, color: dq ? RED : '#374151' }}>
            <input type='checkbox' checked={dq} onChange={e => setDq(e.target.checked)} />
            🚫 Mark as Disqualified
          </label>
          {dq && (
            <input
              style={{ ...S.input, marginTop: '0.5rem', borderColor: RED }}
              placeholder='Disqualification reason (required)…'
              value={dqReason}
              onChange={e => setDqReason(e.target.value)}
            />
          )}
        </div>

        {/* Catches */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>Catches</div>
          {catches.map((fish, i) => {
            const sp    = ALL_SPECIES.find(s => s.name === fish.species)
            const isKF  = sp?.kingfish || fish.kingfish_release
            const pts   = fish.billfish ? 0 : isKF ? 5 : calcFishPoints(parseFloat(fish.weight_kg) || 0)
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center', padding: '0.4rem', background: fish.billfish ? '#fef3c7' : '#f9fafb', borderRadius: 6, marginBottom: '0.3rem', border: `1px solid ${fish.billfish ? '#fcd34d' : '#e5e7eb'}` }}>
                <select
                  style={{ ...S.select, fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
                  value={fish.species || ''}
                  onChange={e => {
                    const val  = e.target.value
                    const sp2  = ALL_SPECIES.find(s => s.name === val)
                    const isKF2 = sp2?.kingfish || false
                    if (isKF2) {
                      updateFish(i, { ...fish, species: val, billfish: false, kingfish_release: true, measured_400mm: false, weight_kg: '', min_weight: 3 })
                    } else {
                      updateFish(i, { ...fish, species: val, billfish: sp2?.billfish || false, kingfish_release: false, weight_kg: fish.weight_kg, min_weight: sp2?.minWeight || 3 })
                    }
                  }}>
                  <option value=''>Select species…</option>
                  {SPECIES_GROUPS.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.species.map(s => <option key={s} value={s}>{s}</option>)}
                    </optgroup>
                  ))}
                </select>
                <input
                  type='number' step='0.1' min='0' placeholder='kg'
                  value={fish.weight_kg || ''}
                  disabled={fish.billfish || isKF}
                  onChange={e => updateFish(i, { ...fish, weight_kg: e.target.value })}
                  style={{ ...S.input, fontSize: '0.85rem', padding: '0.35rem 0.5rem', background: (fish.billfish || isKF) ? '#f3f4f6' : 'white' }}
                />
                <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                  {fish.billfish ? <span style={S.badge(GOLD)}>OB</span>
                    : isKF ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={S.badge(fish.measured_400mm ? '#7c3aed' : GREY)}>5 pts 📸</span>
                        <label style={{ fontSize: '0.65rem', color: fish.measured_400mm ? '#7c3aed' : RED, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                          <input type='checkbox' checked={!!fish.measured_400mm} onChange={e => updateFish(i, { ...fish, measured_400mm: e.target.checked })} />
                          ≥400mm
                        </label>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 700, color: NAVY }}>{pts > 0 ? pts.toFixed(2) : '—'}</div>
                        <div style={{ fontSize: '0.68rem', color: GREY }}>pts</div>
                      </div>
                    )}
                </div>
                <button onClick={() => removeFish(i)}
                  style={{ background: '#fef2f2', color: RED, border: 'none', borderRadius: 4, padding: '0.3rem 0.6rem', cursor: 'pointer' }}>✕</button>
              </div>
            )
          })}
          {catches.length < 10 && (
            <button onClick={addFish} style={{ ...S.btn(GREEN), marginTop: '0.25rem', fontSize: '0.82rem' }}>+ Add Fish</button>
          )}
        </div>

        {/* Record note */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={S.label}>Record / PB Note</label>
          <textarea
            rows={2}
            value={recordNote}
            onChange={e => setRecordNote(e.target.value)}
            style={{ ...S.input, resize: 'vertical' }}
            placeholder='e.g. Yellowfin 33.8kg — possible record'
          />
        </div>

        {/* Summary */}
        <div style={{ background: '#eff6ff', borderRadius: 6, padding: '0.6rem 1rem', marginBottom: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Fish',     val: fishCount,                    col: GREEN },
            { label: 'Raw Pts',  val: totalPoints.toFixed(2),       col: NAVY  },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: s.col }}>{s.val}</div>
            </div>
          ))}
          {dq && <span style={{ ...S.badge(RED), alignSelf: 'center', fontSize: '0.82rem' }}>🚫 DISQUALIFIED</span>}
        </div>

        {error && <div style={{ background: '#fef2f2', color: RED, padding: '0.6rem', borderRadius: 6, marginBottom: '0.75rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.btn('#f3f4f6', '#374151')}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...S.btn(), opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function GamefishAdmin() {
  const { user } = useAuth()
  const [authorised, setAuthorised] = useState(false)
  const [checking,   setChecking]   = useState(true)
  const [catches,    setCatches]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState('scorecards')
  const [dayFilter,  setDayFilter]  = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [editing,        setEditing]        = useState(null)
  const [resultsReleased, setResultsReleased] = useState(false)
  const [togglingRelease, setTogglingRelease] = useState(false)


  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setChecking(false); return }
    if ([OWNER_ID, SCORER_ID].includes(user.id)) {
      setAuthorised(true); setChecking(false); return
    }
    supabase.from('competition_user_roles').select('role')
      .eq('user_id', user.id).eq('competition_id', COMPETITION_ID)
      .then(({ data }) => {
        if (data?.some(r => ['admin','tournament_director'].includes(r.role)))
          setAuthorised(true)
        setChecking(false)
      })
  }, [user])

  // ── Load results_released status ────────────────────────────────────────────
  useEffect(() => {
    if (!authorised) return
    supabase.from('competitions').select('results_released')
      .eq('id', COMPETITION_ID).single()
      .then(({ data }) => { if (data) setResultsReleased(data.results_released || false) })
  }, [authorised])

  const toggleRelease = async () => {
    setTogglingRelease(true)
    const newVal = !resultsReleased
    await supabase.from('competitions')
      .update({ results_released: newVal })
      .eq('id', COMPETITION_ID)
    setResultsReleased(newVal)
    setTogglingRelease(false)
  }

  // ── Load catches ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('gamefish_catches').select('*')
      .eq('competition_id', COMPETITION_ID)
      .order('day_number').order('team_name').order('angler_name')
    setCatches(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { if (authorised) load() }, [authorised, load])



  if (checking) return <div style={{ textAlign: 'center', padding: '3rem', color: GREY }}>Checking access…</div>
  if (!user)    return <div style={{ textAlign: 'center', padding: '3rem', color: RED }}>Please log in to access the Admin panel.</div>
  if (!authorised) return <div style={{ textAlign: 'center', padding: '3rem', color: RED }}>⛔ Access denied. This page is for scorers only.</div>

  // ── Filters ─────────────────────────────────────────────────────────────────
  const filtered = catches.filter(c => {
    if (dayFilter  !== 'all' && c.day_number !== parseInt(dayFilter))  return false
    if (teamFilter !== 'all' && c.team_name  !== teamFilter)           return false
    return true
  })

  const dqCount     = catches.filter(c => c.disqualified).length
  const totalFish   = catches.reduce((s, c) => s + (c.fish_count || 0), 0)
  const totalCards  = catches.length



  return (
    <div style={S.page}>

      {/* Header */}
      <div style={{ background: NAVY, color: 'white', padding: '1rem 1.5rem', borderRadius: 8, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>⚙️ Gamefish Nationals 2026 — Admin</div>
            <div style={{ fontSize: '0.82rem', opacity: 0.85, marginTop: 2 }}>Meerensee Boat Club · Scorer Panel</div>
          </div>
          <button onClick={load} disabled={loading}
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem' }}>
            {loading ? '⟳ Loading…' : '⟳ Refresh'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Scorecards', val: totalCards },
            { label: 'Fish',       val: totalFish  },
            { label: 'DQs',        val: dqCount,   color: dqCount > 0 ? '#fca5a5' : 'rgba(255,255,255,0.7)' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontWeight: 700, color: s.color || 'white' }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Results release toggle */}
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', background: resultsReleased ? '#f0fdf4' : '#fef3c7', border: `1px solid ${resultsReleased ? '#86efac' : '#fcd34d'}` }}>
        <div>
          <div style={{ fontWeight: 700, color: resultsReleased ? GREEN : GOLD }}>
            {resultsReleased ? '👁 Results Visible to Public' : '🔒 Results Hidden from Public'}
          </div>
          <div style={{ fontSize: '0.78rem', color: GREY, marginTop: 2 }}>
            {resultsReleased ? 'Anyone can view the scoreboard without a PIN.' : 'Scoreboard requires PIN 7749 to unlock.'}
          </div>
        </div>
        <button onClick={toggleRelease} disabled={togglingRelease}
          style={{ ...S.btn(resultsReleased ? RED : GREEN), opacity: togglingRelease ? 0.6 : 1 }}>
          {togglingRelease ? 'Updating…' : resultsReleased ? '🔒 Lock Results' : '👁 Release Results'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        {[
          { id: 'scorecards', label: '📋 Scorecards' },
  
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={S.tab(activeTab === t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ── SCORECARDS TAB ── */}
      {activeTab === 'scorecards' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={S.label}>Day</label>
              <select style={S.select} value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
                <option value='all'>All Days</option>
                {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={S.label}>Team</label>
              <select style={S.select} value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
                <option value='all'>All Teams</option>
                {Object.keys(TEAMS).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: GREY }}>Loading scorecards…</div>
          ) : filtered.length === 0 ? (
            <div style={{ ...S.card, color: GREY, fontStyle: 'italic', textAlign: 'center' }}>No scorecards found for selected filters.</div>
          ) : (
            filtered.map(c => (
              <div key={c.id} style={{ ...S.card, borderLeft: `4px solid ${c.disqualified ? RED : GREEN}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                      {c.disqualified && <span style={{ ...S.badge(RED), marginRight: 6 }}>🚫 DQ</span>}
                      {c.angler_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: GREY }}>
                      {c.team_name} · Day {c.day_number} · {c.boat_name}
                    </div>
                    {c.disqualified && c.disqualified_reason && (
                      <div style={{ fontSize: '0.8rem', color: RED, marginTop: 2 }}>Reason: {c.disqualified_reason}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>Fish</div>
                      <div style={{ fontWeight: 700, color: GREEN }}>{c.fish_count || 0}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>Raw Pts</div>
                      <div style={{ fontWeight: 700, color: NAVY }}>{(c.total_points || 0).toFixed(2)}</div>
                    </div>
                    <button onClick={() => setEditing(c)}
                      style={{ ...S.btn(), fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
                      ✏️ Edit
                    </button>
                  </div>
                </div>
                {/* Species badges */}
                {(c.catches || []).filter(f => f.species).length > 0 && (
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {c.catches.filter(f => f.species).map((f, i) => (
                      <span key={i} style={S.badge(f.billfish ? GOLD : f.kingfish_release ? '#7c3aed' : '#374151')}>
                        {f.species.split(' ')[0]} {f.billfish ? '(OB)' : f.kingfish_release ? '📸' : `${f.weight_kg}kg`}
                      </span>
                    ))}
                  </div>
                )}
                {c.record_note && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: GOLD, fontStyle: 'italic' }}>
                    📌 {c.record_note}
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}



      {/* Edit Modal */}
      {editing && (
        <EditModal
          record={editing}
          onSave={() => { setEditing(null); load() }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
