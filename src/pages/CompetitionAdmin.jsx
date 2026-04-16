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

  const userEmail = (user?.email || user?.user_metadata?.email || '').toLowerCase()
  const isAuthorised = AUTHORISED_ADMINS.includes(userEmail)

  useEffect(() => { if (isAuthorised) loadData() }, [selectedComp])

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
              Manage competition days and results visibility.
              Toggle <strong>Results Hidden</strong> to keep standings secret until the final day.
            </p>
            {days.map(d => {
              const isHidden = d.session_status === 'hidden'
              return (
                <div key={d.id} style={{ background: 'white', borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#111827' }}>Day {d.day_number}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{d.date}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '20px', background: isHidden ? '#fef3c7' : '#d1fae5', color: isHidden ? '#92400e' : '#065f46', fontWeight: '600' }}>
                      {isHidden ? 'Results Hidden' : 'Results Visible'}
                    </span>
                    <button onClick={() => toggleBlackout(d.id, d.session_status)} disabled={saving}
                      style={smallBtn(isHidden ? '#166534' : '#92400e')}>
                      {isHidden ? 'Show' : 'Hide'}
                    </button>
                  </div>
                </div>
              )
            })}
            <div style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginTop: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ fontWeight: '600', fontSize: '0.875rem', color: NAVY, marginBottom: '0.75rem' }}>Add a Day</div>
              <AddDayForm days={days} onAdd={addDay} saving={saving} iStyle={iStyle} btn={btn} />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
