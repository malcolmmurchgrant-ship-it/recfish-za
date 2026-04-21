import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const AUTHORISED_ADMINS = [
  'mpca99@telkomsa.net',
  'malcolmmurchgrant@gmail.com',
  'wpdsaa@mweb.co.za',
]

const NAT_COMP_ID = 'ff6e95a9-4f9e-4b54-ad47-a913831d336c'
const INT_COMP_ID = '4a905558-8a94-4dc2-8305-bce37bfc1fe4'
const GAMEFISH_ID = 'ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77'
const NAVY = '#1e3a8a'

// ── CATCH EDIT FORM ────────────────────────────────────────────
function CatchEditForm({ editingCatch, setEditingCatch, teams, participants, boats, saving, onSave, onCancel }) {
  const iStyle = { width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', marginBottom: '0.5rem' }
  const btn = (color) => ({ padding: '0.5rem 1rem', background: color, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' })
  return (
    <div style={{ padding: '1rem', background: '#eff6ff', border: '2px solid #1e40af', borderRadius: '8px', marginTop: '0.5rem' }}>
      <div style={{ fontWeight: '600', fontSize: '0.85rem', color: NAVY, marginBottom: '0.75rem' }}>Editing catch</div>
      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Team</label>
      <select style={iStyle} value={editingCatch.team_id}
        onChange={e => setEditingCatch(c => ({ ...c, team_id: e.target.value, angler_id: '' }))}>
        {teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
      </select>
      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Angler</label>
      <select style={iStyle} value={editingCatch.angler_id}
        onChange={e => setEditingCatch(c => ({ ...c, angler_id: e.target.value }))}>
        <option value="">— Select angler —</option>
        {participants.filter(p => p.team_id === editingCatch.team_id).map(p =>
          <option key={p.id} value={p.id}>{p.full_name}{p.status === 'reserve' ? ' (Reserve)' : ''}</option>
        )}
      </select>
      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Boat</label>
      <select style={iStyle} value={editingCatch.boat_id || ''}
        onChange={e => setEditingCatch(c => ({ ...c, boat_id: e.target.value }))}>
        <option value="">— Select boat —</option>
        {boats.map(b => <option key={b.id} value={b.id}>{b.boat_name} — {b.skipper_name}</option>)}
      </select>
      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Species</label>
      <input style={iStyle} value={editingCatch.species_name}
        onChange={e => setEditingCatch(c => ({ ...c, species_name: e.target.value }))} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Weight (kg)</label>
          <input type="number" step="0.01" style={iStyle} value={editingCatch.weight_kg || ''}
            onChange={e => setEditingCatch(c => ({ ...c, weight_kg: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Line Class</label>
          <select style={iStyle} value={editingCatch.line_class_kg || 10}
            onChange={e => setEditingCatch(c => ({ ...c, line_class_kg: e.target.value }))}>
            <option value={10}>10 kg</option>
            <option value={15}>15 kg</option>
          </select>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={editingCatch.scoring === false}
          onChange={e => setEditingCatch(c => ({ ...c, scoring: !e.target.checked }))} />
        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Non-scoring (mutilated/predated)</span>
      </label>
      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Notes</label>
      <input style={iStyle} value={editingCatch.notes || ''}
        onChange={e => setEditingCatch(c => ({ ...c, notes: e.target.value }))} />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button onClick={onSave} disabled={saving} style={btn('#166534')}>{saving ? 'Saving...' : 'Save Changes'}</button>
        <button onClick={onCancel} style={btn('#6b7280')}>Cancel</button>
      </div>
    </div>
  )
}

// ── ADD DAY FORM ───────────────────────────────────────────────
function AddDayForm({ days, onAdd, saving, iStyle, btn }) {
  const nextDay = (days.length > 0 ? Math.max(...days.map(d => d.day_number)) : 0) + 1
  const [dayNum, setDayNum] = useState(nextDay)
  const [date, setDate] = useState('')
  return (
    <div>
      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Day Number</label>
      <input type="number" style={iStyle} value={dayNum} onChange={e => setDayNum(parseInt(e.target.value))} />
      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Date</label>
      <input type="date" style={iStyle} value={date} onChange={e => setDate(e.target.value)} />
      <button onClick={() => { if (date) onAdd(dayNum, date) }} disabled={saving || !date} style={btn('#166534')}>
        {saving ? 'Adding...' : 'Add Day'}
      </button>
    </div>
  )
}

// ── MAIN COMPONENT ─────────────────────────────────────────────
export default function CompetitionAdminPanel({ onClose }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('boats')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [boats, setBoats] = useState([])
  const [teams, setTeams] = useState([])
  const [catches, setCatches] = useState([])
  const [participants, setParticipants] = useState([])
  const [days, setDays] = useState([])
  const [editingBoat, setEditingBoat] = useState(null)
  const [editingCatch, setEditingCatch] = useState(null)
  const [editingTeam, setEditingTeam] = useState(null)
  const [selectedComp, setSelectedComp] = useState(NAT_COMP_ID)
  const [addAngler, setAddAngler] = useState({ teamId: null, name: '', category: 'Crew', status: 'active' })
  const [showBlackout, setShowBlackout] = useState({})
  const [editingDay, setEditingDay] = useState(null)
  const [compSignOff, setCompSignOff] = useState({ td_name: '', td_verified: false })
  const [signOffLoaded, setSignOffLoaded] = useState(false)

  const userEmail = (user?.email || user?.user_metadata?.email || '').toLowerCase()
  const isAuthorised = AUTHORISED_ADMINS.includes(userEmail)

  useEffect(() => { if (isAuthorised) { loadData(); loadSignOff() } }, [selectedComp])

  const loadData = async () => {
    setLoading(true)
    const [boatsRes, teamsRes, catchesRes, participantsRes, daysRes] = await Promise.all([
      supabase.from('competition_boats').select('*').eq('competition_id', selectedComp).order('boat_name'),
      supabase.from('competition_teams').select('*').eq('competition_id', selectedComp).order('team_name'),
      supabase.from('competition_catches').select('*').eq('competition_id', selectedComp).order('catch_time', { ascending: false }),
      supabase.from('competition_participants').select('*').eq('competition_id', selectedComp).order('full_name'),
      supabase.from('competition_days').select('*').eq('competition_id', selectedComp).order('day_number'),
    ])
    setBoats(boatsRes.data || [])
    setTeams(teamsRes.data || [])
    setCatches(catchesRes.data || [])
    setParticipants(participantsRes.data || [])
    setDays(daysRes.data || [])
    setLoading(false)
  }

  const loadSignOff = async () => {
    const { data } = await supabase
      .from('competitions')
      .select('td_name, td_verified, td_verified_at')
      .eq('id', selectedComp)
      .single()
    if (data) {
      setCompSignOff({ td_name: data.td_name || '', td_verified: data.td_verified || false, td_verified_at: data.td_verified_at })
      setSignOffLoaded(true)
    }
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // ── BOATS ──────────────────────────────────────────────────────
  const saveBoat = async () => {
    if (!editingBoat) return
    setSaving(true)
    const { error } = await supabase.from('competition_boats')
      .update({ boat_name: editingBoat.boat_name, skipper_name: editingBoat.skipper_name })
      .eq('id', editingBoat.id)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Boat updated'); setEditingBoat(null); loadData() }
    setSaving(false)
  }

  // ── TEAMS ──────────────────────────────────────────────────────
  const saveTeamName = async (teamId, newName) => {
    setSaving(true)
    const { error } = await supabase.from('competition_teams').update({ team_name: newName }).eq('id', teamId)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Team name updated'); setEditingTeam(null); loadData() }
    setSaving(false)
  }

  const addAnglerToTeam = async () => {
    if (!addAngler.name.trim() || !addAngler.teamId) return
    setSaving(true)
    const { error } = await supabase.from('competition_participants').insert([{
      competition_id: selectedComp,
      team_id: addAngler.teamId,
      user_id: crypto.randomUUID(),
      full_name: addAngler.name.trim(),
      category: addAngler.category,
      division: 'Senior',
      line_class_kg: 10,
      status: addAngler.status,
    }])
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Angler added'); setAddAngler({ teamId: null, name: '', category: 'Crew', status: 'active' }); loadData() }
    setSaving(false)
  }

  const removeAngler = async (anglerId, anglerName) => {
    if (!confirm('Remove ' + anglerName + ' from the team?')) return
    setSaving(true)
    const { error } = await supabase.from('competition_participants').delete().eq('id', anglerId)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Angler removed'); loadData() }
    setSaving(false)
  }

  const activateReserve = async (anglerId, anglerName) => {
    setSaving(true)
    const { error } = await supabase.from('competition_participants')
      .update({ status: 'active' }).eq('id', anglerId)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage(anglerName + ' activated'); loadData() }
    setSaving(false)
  }

  // ── CATCHES ────────────────────────────────────────────────────
  const calcPoints = (weightKg, lineClassKg, scoring) => {
    if (!scoring || !weightKg || parseFloat(weightKg) <= 0) return 0
    const w = parseFloat(weightKg)
    const factors = { 10: 0.32, 15: 0.142 }
    const f = factors[parseInt(lineClassKg || 10)] || 0.32
    return parseFloat((w * w * f).toFixed(2))
  }

  const saveCatch = async () => {
    if (!editingCatch) return
    setSaving(true)
    const recalcPoints = calcPoints(editingCatch.weight_kg, editingCatch.line_class_kg, editingCatch.scoring)
    const { error } = await supabase.from('competition_catches').update({
      team_id: editingCatch.team_id,
      angler_id: editingCatch.angler_id,
      boat_id: editingCatch.boat_id,
      species_name: editingCatch.species_name,
      weight_kg: editingCatch.weight_kg ? parseFloat(editingCatch.weight_kg) : null,
      line_class_kg: parseInt(editingCatch.line_class_kg || 10),
      points: recalcPoints,
      scoring: editingCatch.scoring,
      notes: editingCatch.notes,
    }).eq('id', editingCatch.id)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Catch updated — points recalculated'); setEditingCatch(null); loadData() }
    setSaving(false)
  }

  const deleteCatch = async (id) => {
    if (!confirm('Permanently delete this catch?')) return
    setSaving(true)
    const { error } = await supabase.from('competition_catches').delete().eq('id', id)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Catch deleted'); loadData() }
    setSaving(false)
  }

  // ── DAYS ───────────────────────────────────────────────────────
  const addDay = async (dayNumber, date) => {
    setSaving(true)
    const { error } = await supabase.from('competition_days').insert([{
      competition_id: selectedComp, day_number: dayNumber, date, session_status: 'pending'
    }])
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Day ' + dayNumber + ' added'); loadData() }
    setSaving(false)
  }

  const saveDay = async (day) => {
    setSaving(true)
    const { error } = await supabase.from('competition_days').update({
      fishing_start_time: day.fishing_start_time,
      fishing_end_time:   day.fishing_end_time,
      lines_up_time:      day.lines_up_time,
      capturer_name:      day.capturer_name,
      capturer_contact:   day.capturer_contact,
    }).eq('id', day.id)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Day ' + day.day_number + ' updated'); setEditingDay(null); loadData() }
    setSaving(false)
  }

  const saveDayStatus = async (dayId, dayNumber, status, reason, cancelTime) => {
    setSaving(true)
    const updates = {
      day_status: status,
      cancellation_reason: reason || null,
      cancellation_time: cancelTime || null,
      cancelled: status !== 'fishing',
    }
    const { error } = await supabase.from('competition_days').update(updates).eq('id', dayId)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Day ' + dayNumber + ' status updated'); loadData() }
    setSaving(false)
  }

  const saveSignOff = async () => {
    setSaving(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from('competitions').update({
      td_name: compSignOff.td_name,
      td_verified: compSignOff.td_verified,
      td_verified_at: compSignOff.td_verified ? now : null,
    }).eq('id', selectedComp)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('TD sign-off saved'); loadSignOff() }
    setSaving(false)
  }

  const toggleBlackout = async (dayId, current) => {
    setSaving(true)
    const newStatus = current === 'hidden' ? 'pending' : 'hidden'
    const { error } = await supabase.from('competition_days')
      .update({ session_status: newStatus }).eq('id', dayId)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Day ' + (newStatus === 'hidden' ? 'results hidden' : 'results visible')); loadData() }
    setSaving(false)
  }

  if (!isAuthorised) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
        <div style={{ fontWeight: '600' }}>Access restricted to authorised officials only.</div>
        <button onClick={onClose} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: NAVY, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Close</button>
      </div>
    )
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>

  const iStyle = { width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', marginBottom: '0.5rem' }
  const btn = (color) => ({ padding: '0.5rem 1rem', background: color, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' })
  const smallBtn = (color) => ({ padding: '0.25rem 0.6rem', background: color, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' })

  const anglerGroups = {}
  catches.forEach(c => {
    const key = c.angler_id || 'unknown'
    if (!anglerGroups[key]) {
      const angler = participants.find(p => p.id === c.angler_id)
      const team = teams.find(t => t.id === c.team_id)
      anglerGroups[key] = { angler, team, name: angler?.full_name || 'Unknown', catches: [] }
    }
    anglerGroups[key].catches.push(c)
  })
  const sortedGroups = Object.values(anglerGroups).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', paddingBottom: '3rem' }}>

      {/* Header */}
      <div style={{ background: NAVY, color: 'white', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>SADSAA — Admin</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>Competition Data Editor</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '20px', padding: '0.35rem 0.9rem', cursor: 'pointer', fontSize: '0.8rem' }}>✕ Close</button>
      </div>

      {message && (
        <div style={{ background: message.type === 'error' ? '#fee2e2' : '#d1fae5', color: message.type === 'error' ? '#991b1b' : '#065f46', padding: '0.75rem 1.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
          {message.text}
        </div>
      )}

      {/* Competition selector */}
      <div style={{ background: 'white', padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb' }}>
        <select value={selectedComp} onChange={e => setSelectedComp(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', width: '100%' }}>
          <option value={NAT_COMP_ID}>Tuna Nationals 2026</option>
          <option value={INT_COMP_ID}>Tuna International 2026</option>
          <option value={GAMEFISH_ID}>Junior Gamefish Nationals 2026</option>
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '2px solid #e5e7eb' }}>
        {[['boats','Boats & Skippers'],['teams','Teams & Anglers'],['catches','Catches'],['days','Days']].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            flex: 1, padding: '0.7rem 0.25rem', border: 'none', cursor: 'pointer',
            fontWeight: '600', fontSize: '0.72rem', background: 'none',
            borderBottom: tab === v ? '3px solid ' + NAVY : '3px solid transparent',
            color: tab === v ? NAVY : '#6b7280'
          }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth: '650px', margin: '0 auto', padding: '1rem' }}>

        {/* ── BOATS TAB ── */}
        {tab === 'boats' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>Tap Edit to change a boat name or skipper.</p>
            {boats.map(boat => {
              const team = teams.find(t => t.boat_id === boat.id)
              const isEditing = editingBoat?.id === boat.id
              return (
                <div key={boat.id} style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  {isEditing ? (
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.85rem', color: NAVY, marginBottom: '0.5rem' }}>Editing: {boat.boat_name}</div>
                      <input style={iStyle} placeholder="Boat name" value={editingBoat.boat_name}
                        onChange={e => setEditingBoat(b => ({ ...b, boat_name: e.target.value }))} />
                      <input style={iStyle} placeholder="Skipper name" value={editingBoat.skipper_name}
                        onChange={e => setEditingBoat(b => ({ ...b, skipper_name: e.target.value }))} />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button onClick={saveBoat} disabled={saving} style={btn('#166534')}>{saving ? 'Saving...' : 'Save'}</button>
                        <button onClick={() => setEditingBoat(null)} style={btn('#6b7280')}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: '#111827' }}>{boat.boat_name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Skipper: {boat.skipper_name}</div>
                        {team && <div style={{ fontSize: '0.75rem', color: NAVY, marginTop: '0.2rem' }}>Team: {team.team_name}</div>}
                      </div>
                      <button onClick={() => setEditingBoat({ ...boat })} style={btn('#1e40af')}>Edit</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── TEAMS & ANGLERS TAB ── */}
        {tab === 'teams' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
              View and edit team members. Add reserves or replacements directly.
            </p>
            {teams.map(team => {
              const teamAnglers = participants
                .filter(p => p.team_id === team.id)
                .sort((a, b) => {
                  if (a.status === 'reserve' && b.status !== 'reserve') return 1
                  if (b.status === 'reserve' && a.status !== 'reserve') return -1
                  return a.full_name.localeCompare(b.full_name)
                })
              const isEditingName = editingTeam === team.id
              const isAddingAngler = addAngler.teamId === team.id

              return (
                <div key={team.id} style={{ marginBottom: '1.25rem' }}>
                  {/* Team header */}
                  <div style={{ background: NAVY, color: 'white', borderRadius: isEditingName ? '8px 8px 0 0' : (teamAnglers.length > 0 || isAddingAngler ? '8px 8px 0 0' : '8px'), padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {isEditingName ? (
                      <input
                        style={{ flex: 1, padding: '0.3rem 0.5rem', borderRadius: '4px', border: 'none', fontSize: '0.9rem', fontWeight: '700', marginRight: '0.5rem' }}
                        defaultValue={team.team_name}
                        id={'team-name-' + team.id}
                      />
                    ) : (
                      <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{team.team_name}</div>
                    )}
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      {isEditingName ? (
                        <>
                          <button onClick={() => {
                            const val = document.getElementById('team-name-' + team.id)?.value
                            if (val) saveTeamName(team.id, val)
                          }} style={smallBtn('#166534')}>Save</button>
                          <button onClick={() => setEditingTeam(null)} style={smallBtn('#6b7280')}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditingTeam(team.id)} style={smallBtn('#1e40af')}>Rename</button>
                          <button onClick={() => setAddAngler({ teamId: team.id, name: '', category: 'Crew', status: 'active' })} style={smallBtn('#166534')}>+ Angler</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Anglers list */}
                  {teamAnglers.map((angler, idx) => {
                    const isLast = idx === teamAnglers.length - 1 && !isAddingAngler
                    const isReserve = angler.status === 'reserve'
                    return (
                      <div key={angler.id} style={{
                        background: isReserve ? '#fefce8' : (idx % 2 === 0 ? '#f8fafc' : 'white'),
                        border: '1px solid #e5e7eb', borderTop: 'none',
                        padding: '0.6rem 1rem',
                        borderRadius: isLast ? '0 0 8px 8px' : '0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <span style={{ fontWeight: '600', fontSize: '0.875rem', color: '#111827' }}>{angler.full_name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>{angler.category}</span>
                          {isReserve && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: '#fef9c3', color: '#92400e', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>Reserve</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {isReserve && (
                            <button onClick={() => activateReserve(angler.id, angler.full_name)} style={smallBtn('#166534')}>Activate</button>
                          )}
                          <button onClick={() => removeAngler(angler.id, angler.full_name)} style={smallBtn('#ef4444')}>Remove</button>
                        </div>
                      </div>
                    )
                  })}

                  {/* Add angler form */}
                  {isAddingAngler && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderTop: 'none', padding: '0.875rem 1rem', borderRadius: '0 0 8px 8px' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.8rem', color: NAVY, marginBottom: '0.5rem' }}>Add angler to {team.team_name}</div>
                      <input style={iStyle} placeholder="Full name" value={addAngler.name}
                        onChange={e => setAddAngler(a => ({ ...a, name: e.target.value }))} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151' }}>Role</label>
                          <select style={iStyle} value={addAngler.category}
                            onChange={e => setAddAngler(a => ({ ...a, category: e.target.value }))}>
                            <option>Captain</option>
                            <option>Crew 1</option>
                            <option>Crew 2</option>
                            <option>Crew 3</option>
                            <option>Crew</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151' }}>Status</label>
                          <select style={iStyle} value={addAngler.status}
                            onChange={e => setAddAngler(a => ({ ...a, status: e.target.value }))}>
                            <option value="active">Active</option>
                            <option value="reserve">Reserve</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={addAnglerToTeam} disabled={saving || !addAngler.name.trim()} style={btn('#166534')}>{saving ? 'Adding...' : 'Add Angler'}</button>
                        <button onClick={() => setAddAngler({ teamId: null, name: '', category: 'Crew', status: 'active' })} style={btn('#6b7280')}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── CATCHES TAB ── */}
        {tab === 'catches' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
              Grouped by angler alphabetically, sorted by day. Tap Edit to correct a catch.
            </p>
            {catches.length === 0 && (
              <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No catches logged yet.</div>
            )}
            {sortedGroups.map(group => {
              const groupTotal = group.catches.reduce((s, c) => s + (parseFloat(c.points) || 0), 0)
              const sortedCatches = [...group.catches].sort((a, b) => {
                const da = days.find(d => d.id === a.competition_day_id)?.day_number || 0
                const db = days.find(d => d.id === b.competition_day_id)?.day_number || 0
                if (da !== db) return da - db
                return parseFloat(b.weight_kg || 0) - parseFloat(a.weight_kg || 0)
              })
              return (
                <div key={group.name} style={{ marginBottom: '1rem' }}>
                  <div style={{ background: NAVY, color: 'white', borderRadius: '8px 8px 0 0', padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{group.name}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                        {group.team?.team_name} — {group.catches.length} catch{group.catches.length !== 1 ? 'es' : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{groupTotal.toFixed(2)} pts</div>
                  </div>
                  {sortedCatches.map((c, idx) => {
                    const day = days.find(d => d.id === c.competition_day_id)
                    const isLast = idx === sortedCatches.length - 1
                    const isEditing = editingCatch?.id === c.id
                    return (
                      <div key={c.id} style={{ background: idx % 2 === 0 ? '#f8fafc' : 'white', border: '1px solid #e5e7eb', borderTop: 'none', padding: '0.6rem 1rem', borderRadius: isLast && !isEditing ? '0 0 8px 8px' : '0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '600', fontSize: '0.875rem', color: '#111827' }}>{c.species_name}</span>
                              {c.scoring === false && (
                                <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>Non-scoring</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.775rem', color: '#6b7280', marginTop: '0.15rem' }}>
                              {'Day ' + (day?.day_number || '?') + '  •  '}
                              {c.weight_kg ? parseFloat(c.weight_kg).toFixed(2) + ' kg' : 'No weight'}
                              {'  •  ' + (c.line_class_kg || 10) + ' kg line  •  '}
                              <span style={{ color: '#7c3aed', fontWeight: '600' }}>{parseFloat(c.points || 0).toFixed(2)} pts</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                            <button onClick={() => setEditingCatch({ ...c })} style={btn('#1e40af')}>Edit</button>
                            <button onClick={() => deleteCatch(c.id)} style={btn('#ef4444')}>Del</button>
                          </div>
                        </div>
                        {isEditing && (
                          <CatchEditForm
                            editingCatch={editingCatch}
                            setEditingCatch={setEditingCatch}
                            teams={teams}
                            participants={participants}
                            boats={boats}
                            saving={saving}
                            onSave={saveCatch}
                            onCancel={() => setEditingCatch(null)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* ── DAYS TAB ── */}
        {tab === 'days' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
              Manage fishing times, capturer details, results visibility and weather cancellations per day.
            </p>

            {days.map(d => {
              const isHidden = d.session_status === 'hidden'
              const isEditing = editingDay?.id === d.id
              const fishingHours = (() => {
                if (d.fishing_start_time && d.fishing_end_time) {
                  const [sh, sm] = d.fishing_start_time.split(':').map(Number)
                  const [eh, em] = d.fishing_end_time.split(':').map(Number)
                  return ((eh * 60 + em) - (sh * 60 + sm)) / 60
                }
                return null
              })()

              const isCancelled = d.day_status === 'cancelled_before' || d.day_status === 'cancelled_during'
              const statusColour = isCancelled ? '#fee2e2' : d.day_status === 'rest_day' ? '#fef3c7' : 'white'
              const statusBorder = isCancelled ? '2px solid #fca5a5' : d.day_status === 'rest_day' ? '2px solid #fbbf24' : '1px solid transparent'
              const statusLabel = {
                fishing: null,
                cancelled_before: '⛔ Cancelled — before start',
                cancelled_during: '⛔ Cancelled during fishing',
                rest_day: '🛟 Rest / travel day',
              }[d.day_status]

              return (
                <div key={d.id} style={{ marginBottom: '0.75rem' }}>
                  {/* Day header — always visible */}
                  <div style={{ background: statusColour, border: statusBorder, borderRadius: isEditing ? '8px 8px 0 0' : '8px', padding: '0.875rem 1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: '700', color: isCancelled ? '#991b1b' : '#111827', fontSize: '0.95rem' }}>Day {d.day_number} — {d.date}</span>
                          {statusLabel && <span style={{ fontSize: '0.72rem', fontWeight: '700', color: isCancelled ? '#991b1b' : '#92400e', background: isCancelled ? '#fee2e2' : '#fef3c7', padding: '0.15rem 0.5rem', borderRadius: '10px' }}>{statusLabel}</span>}
                        </div>
                        {isCancelled && d.cancellation_reason && (
                          <div style={{ fontSize: '0.775rem', color: '#991b1b', marginTop: '0.2rem', fontStyle: 'italic' }}>
                            Reason: {d.cancellation_reason}
                            {d.day_status === 'cancelled_during' && d.cancellation_time && ` — called off at ${d.cancellation_time.slice(0,5)}`}
                          </div>
                        )}
                        <div style={{ fontSize: '0.775rem', color: '#6b7280', marginTop: '0.2rem' }}>
                          Lines In: {d.fishing_start_time?.slice(0,5) || '—'}  •  Lines Up: {d.fishing_end_time?.slice(0,5) || '—'}
                          {fishingHours !== null && <span> • {fishingHours} hrs</span>}
                        </div>
                        {d.capturer_name && (
                          <div style={{ fontSize: '0.775rem', color: '#6b7280' }}>
                            Capturer: {d.capturer_name}{d.capturer_contact ? ' — ' + d.capturer_contact : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                        {/* Hide/Show slider-style toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: isHidden ? '#92400e' : '#065f46' }}>
                            {isHidden ? '🔒 Hidden' : '✅ Visible'}
                          </span>
                          <div
                            onClick={() => toggleBlackout(d.id, d.session_status)}
                            style={{
                              width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                              background: isHidden ? '#f59e0b' : '#10b981',
                              position: 'relative', transition: 'background 0.2s',
                              flexShrink: 0
                            }}>
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                              position: 'absolute', top: '3px',
                              left: isHidden ? '3px' : '23px',
                              transition: 'left 0.2s',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                            }} />
                          </div>
                        </div>
                        <button onClick={() => setEditingDay(isEditing ? null : { ...d, fishing_start_time: d.fishing_start_time?.slice(0,5) || '06:00', fishing_end_time: d.fishing_end_time?.slice(0,5) || '16:00', lines_up_time: d.lines_up_time?.slice(0,5) || '16:00', capturer_name: d.capturer_name || '', capturer_contact: d.capturer_contact || '', day_status: d.day_status || 'fishing', cancellation_reason: d.cancellation_reason || '', cancellation_time: d.cancellation_time?.slice(0,5) || '' })}
                          style={smallBtn(isEditing ? '#6b7280' : '#1e40af')}>
                          {isEditing ? 'Cancel' : 'Edit'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Edit form */}
                  {isEditing && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderTop: 'none', padding: '1rem', borderRadius: '0 0 8px 8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Lines In</label>
                          <input type="time" style={iStyle} value={editingDay.fishing_start_time}
                            onChange={e => setEditingDay(d => ({ ...d, fishing_start_time: e.target.value, lines_up_time: d.fishing_end_time }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Lines Up</label>
                          <input type="time" style={iStyle} value={editingDay.fishing_end_time}
                            onChange={e => setEditingDay(d => ({ ...d, fishing_end_time: e.target.value, lines_up_time: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ fontSize: '0.775rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                        {(() => {
                          if (editingDay.fishing_start_time && editingDay.fishing_end_time) {
                            const [sh, sm] = editingDay.fishing_start_time.split(':').map(Number)
                            const [eh, em] = editingDay.fishing_end_time.split(':').map(Number)
                            const hrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60
                            return 'Fishing hours: ' + hrs + ' hrs — CPUE will use this value in reports'
                          }
                          return ''
                        })()}
                      </div>
                      <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Capturer Name</label>
                      <input style={iStyle} placeholder="Full name of data capturer" value={editingDay.capturer_name}
                        onChange={e => setEditingDay(d => ({ ...d, capturer_name: e.target.value }))} />
                      <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Capturer Contact Number</label>
                      <input style={iStyle} placeholder="e.g. 082 555 1234" value={editingDay.capturer_contact}
                        onChange={e => setEditingDay(d => ({ ...d, capturer_contact: e.target.value }))} />
                      {/* Weather Committee */}
                      <div style={{ marginTop: '1rem', borderTop: '1px solid #bfdbfe', paddingTop: '1rem' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#991b1b', marginBottom: '0.5rem' }}>⛅ Weather Committee</div>
                        <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Day Status</label>
                        <select style={iStyle} value={editingDay.day_status || 'fishing'}
                          onChange={e => setEditingDay(d => ({ ...d, day_status: e.target.value, cancellation_time: e.target.value !== 'cancelled_during' ? '' : d.cancellation_time }))}>
                          <option value="fishing">✅ Fishing — normal day</option>
                          <option value="cancelled_before">⛔ Cancelled before start</option>
                          <option value="cancelled_during">⛔ Cancelled during fishing</option>
                          <option value="rest_day">🛟 Rest / travel day</option>
                        </select>
                        {(editingDay.day_status === 'cancelled_before' || editingDay.day_status === 'cancelled_during') && (
                          <>
                            <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Reason</label>
                            <input style={iStyle} placeholder="e.g. Gale force winds, Rough seas" value={editingDay.cancellation_reason || ''}
                              onChange={e => setEditingDay(d => ({ ...d, cancellation_reason: e.target.value }))} />
                          </>
                        )}
                        {editingDay.day_status === 'cancelled_during' && (
                          <>
                            <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Time called off</label>
                            <input type="time" style={iStyle} value={editingDay.cancellation_time || ''}
                              onChange={e => setEditingDay(d => ({ ...d, cancellation_time: e.target.value }))} />
                          </>
                        )}
                        {(editingDay.day_status === 'cancelled_before' || editingDay.day_status === 'cancelled_during' || editingDay.day_status === 'rest_day') && (
                          <button onClick={() => saveDayStatus(editingDay.id, editingDay.day_number, editingDay.day_status, editingDay.cancellation_reason, editingDay.cancellation_time)}
                            disabled={saving}
                            style={{ ...btn('#dc2626'), marginBottom: '0.5rem' }}>
                            {saving ? 'Saving...' : 'Save Day Status'}
                          </button>
                        )}
                        {editingDay.day_status === 'fishing' && (editingDay.cancellation_reason || editingDay.cancellation_time) && (
                          <button onClick={() => saveDayStatus(editingDay.id, editingDay.day_number, 'fishing', null, null)}
                            disabled={saving}
                            style={{ ...btn('#166534'), marginBottom: '0.5rem' }}>
                            {saving ? 'Saving...' : 'Clear Cancellation'}
                          </button>
                        )}
                      </div>
                      <button onClick={() => saveDay(editingDay)} disabled={saving} style={btn('#166534')}>
                        {saving ? 'Saving...' : 'Save Day Details'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add Day */}
            <div style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginTop: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ fontWeight: '600', fontSize: '0.875rem', color: NAVY, marginBottom: '0.75rem' }}>Add a Day</div>
              <AddDayForm days={days} onAdd={addDay} saving={saving} iStyle={iStyle} btn={btn} />
            </div>

            {/* TD Sign-off */}
            <div style={{ background: compSignOff.td_verified ? '#d1fae5' : 'white', border: compSignOff.td_verified ? '2px solid #6ee7b7' : '2px solid #e5e7eb', borderRadius: '8px', padding: '1rem', marginTop: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ fontWeight: '700', fontSize: '0.925rem', color: NAVY, marginBottom: '0.25rem' }}>
                Tournament Director Sign-off
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.875rem' }}>
                The TD verifies that all competition results are true and correct.
              </div>
              <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>TD Name</label>
              <input style={iStyle} placeholder="Full name of Tournament Director"
                value={compSignOff.td_name}
                onChange={e => setCompSignOff(s => ({ ...s, td_name: e.target.value }))} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: '0.875rem', padding: '0.75rem', background: compSignOff.td_verified ? '#ecfdf5' : '#f9fafb', borderRadius: '6px', border: '1px solid ' + (compSignOff.td_verified ? '#6ee7b7' : '#e5e7eb') }}>
                <input type="checkbox" checked={compSignOff.td_verified}
                  onChange={e => setCompSignOff(s => ({ ...s, td_verified: e.target.checked }))}
                  style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }} />
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.875rem', color: compSignOff.td_verified ? '#065f46' : '#374151' }}>
                    {compSignOff.td_verified ? '✅ Results verified as true and correct' : 'I verify these results are true and correct'}
                  </div>
                  {compSignOff.td_verified_at && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                      Verified: {new Date(compSignOff.td_verified_at).toLocaleString('en-ZA')}
                    </div>
                  )}
                </div>
              </label>
              <button onClick={saveSignOff} disabled={saving || !compSignOff.td_name.trim()} style={btn(compSignOff.td_verified ? '#166534' : '#1e40af')}>
                {saving ? 'Saving...' : compSignOff.td_verified ? 'Save Verification' : 'Save TD Details'}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
