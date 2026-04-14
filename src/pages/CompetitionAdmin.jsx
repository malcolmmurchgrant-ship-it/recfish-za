import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const AUTHORISED_ADMINS = [
  'malcolmmurchgrant@gmail.com',
  'wpdsaa@mweb.co.za',
]

const NAT_COMP_ID = 'ff6e95a9-4f9e-4b54-ad47-a913831d336c'
const INT_COMP_ID = '4a905558-8a94-4dc2-8305-bce37bfc1fe4'
const GAMEFISH_ID = 'ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77'

const NAVY = '#1e3a8a'

export default function CompetitionAdminPanel({ onClose }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('boats')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // Data
  const [boats, setBoats] = useState([])
  const [teams, setTeams] = useState([])
  const [catches, setCatches] = useState([])
  const [participants, setParticipants] = useState([])
  const [days, setDays] = useState([])

  // Edit states
  const [editingBoat, setEditingBoat] = useState(null)
  const [editingCatch, setEditingCatch] = useState(null)
  const [selectedComp, setSelectedComp] = useState(NAT_COMP_ID)

  const isAuthorised = user && AUTHORISED_ADMINS.includes(user.email?.toLowerCase())

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

  // ── BOAT EDITOR ──────────────────────────────────────────────
  const saveBoat = async () => {
    if (!editingBoat) return
    setSaving(true)
    const { error } = await supabase
      .from('competition_boats')
      .update({ boat_name: editingBoat.boat_name, skipper_name: editingBoat.skipper_name })
      .eq('id', editingBoat.id)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Boat updated successfully'); setEditingBoat(null); loadData() }
    setSaving(false)
  }

  // ── TEAM MOVER ───────────────────────────────────────────────
  const moveTeam = async (teamId, newCompId) => {
    setSaving(true)
    const team = teams.find(t => t.id === teamId)
    if (!team) { setSaving(false); return }

    // Get boat for this team
    const boat = boats.find(b => b.id === team.boat_id)

    // Insert team in new competition
    const { data: newTeam, error: teamErr } = await supabase
      .from('competition_teams')
      .insert([{ competition_id: newCompId, team_name: team.team_name, province: team.province, team_type: team.team_type }])
      .select().single()

    if (teamErr) { showMessage('Error moving team: ' + teamErr.message, 'error'); setSaving(false); return }

    // Move boat if exists
    if (boat) {
      await supabase.from('competition_boats')
        .insert([{ competition_id: newCompId, boat_name: boat.boat_name, skipper_name: boat.skipper_name }])
    }

    // Move participants
    const teamParticipants = participants.filter(p => p.team_id === teamId)
    if (teamParticipants.length > 0) {
      await supabase.from('competition_participants').insert(
        teamParticipants.map(p => ({
          competition_id: newCompId,
          user_id: p.user_id,
          team_id: newTeam.id,
          full_name: p.full_name,
          division: p.division,
          category: p.category,
          line_class_kg: p.line_class_kg
        }))
      )
    }

    // Delete from old competition
    await supabase.from('competition_participants').delete().eq('team_id', teamId)
    await supabase.from('competition_teams').delete().eq('id', teamId)
    if (boat) await supabase.from('competition_boats').delete().eq('id', boat.id)

    showMessage(`${team.team_name} moved successfully`)
    loadData()
    setSaving(false)
  }

  // ── CATCH EDITOR ─────────────────────────────────────────────
  const saveCatch = async () => {
    if (!editingCatch) return
    setSaving(true)
    const { error } = await supabase
      .from('competition_catches')
      .update({
        team_id:     editingCatch.team_id,
        angler_id:   editingCatch.angler_id,
        boat_id:     editingCatch.boat_id,
        species_name:editingCatch.species_name,
        weight_kg:   editingCatch.weight_kg ? parseFloat(editingCatch.weight_kg) : null,
        line_class_kg: parseInt(editingCatch.line_class_kg || 10),
        points:      editingCatch.points ? parseFloat(editingCatch.points) : null,
        scoring:     editingCatch.scoring,
        notes:       editingCatch.notes,
      })
      .eq('id', editingCatch.id)
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage('Catch updated successfully'); setEditingCatch(null); loadData() }
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

  // ── ADD COMPETITION DAY ───────────────────────────────────────
  const addDay = async (dayNumber, date) => {
    setSaving(true)
    const { error } = await supabase.from('competition_days').insert([{
      competition_id: selectedComp,
      day_number: dayNumber,
      date,
      session_status: 'pending'
    }])
    if (error) showMessage('Error: ' + error.message, 'error')
    else { showMessage(`Day ${dayNumber} added`); loadData() }
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

  const inputStyle = { width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', marginBottom: '0.5rem' }
  const btnStyle = (color) => ({ padding: '0.5rem 1rem', background: color, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' })

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

      {/* Message */}
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
        {[['boats','⛵ Boats & Skippers'],['teams','👥 Teams'],['catches','🎣 Catches'],['days','📅 Days']].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            flex: 1, padding: '0.7rem 0.25rem', border: 'none', cursor: 'pointer',
            fontWeight: '600', fontSize: '0.75rem', background: 'none',
            borderBottom: tab === v ? `3px solid ${NAVY}` : '3px solid transparent',
            color: tab === v ? NAVY : '#6b7280'
          }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth: '650px', margin: '0 auto', padding: '1rem' }}>

        {/* ── BOATS & SKIPPERS TAB ── */}
        {tab === 'boats' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
              Tap a boat to edit its name or skipper.
            </p>
            {boats.map(boat => {
              const team = teams.find(t => t.boat_id === boat.id)
              const isEditing = editingBoat?.id === boat.id
              return (
                <div key={boat.id} style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  {!isEditing ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: '#111827' }}>{boat.boat_name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Skipper: {boat.skipper_name}</div>
                        {team && <div style={{ fontSize: '0.75rem', color: NAVY, marginTop: '0.2rem' }}>Team: {team.team_name}</div>}
                      </div>
                      <button onClick={() => setEditingBoat({ ...boat })} style={btnStyle('#1e40af')}>Edit</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.85rem', color: NAVY, marginBottom: '0.5rem' }}>Editing: {boat.boat_name}</div>
                      <input style={inputStyle} placeholder="Boat name" value={editingBoat.boat_name}
                        onChange={e => setEditingBoat(b => ({ ...b, boat_name: e.target.value }))} />
                      <input style={inputStyle} placeholder="Skipper name" value={editingBoat.skipper_name}
                        onChange={e => setEditingBoat(b => ({ ...b, skipper_name: e.target.value }))} />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button onClick={saveBoat} disabled={saving} style={btnStyle('#166534')}>
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setEditingBoat(null)} style={btnStyle('#6b7280')}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── TEAMS TAB ── */}
        {tab === 'teams' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
              Move a team between Nationals and International competitions.
            </p>
            {teams.map(team => {
              const boat = boats.find(b => b.id === team.boat_id)
              const otherComp = selectedComp === NAT_COMP_ID ? INT_COMP_ID : NAT_COMP_ID
              const otherCompName = selectedComp === NAT_COMP_ID ? 'International' : 'Nationals'
              return (
                <div key={team.id} style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: '#111827' }}>{team.team_name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{boat ? `${boat.boat_name} — ${boat.skipper_name}` : 'No boat assigned'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{participants.filter(p => p.team_id === team.id).length} anglers</div>
                  </div>
                  <button
                    onClick={() => { if (confirm(`Move ${team.team_name} to ${otherCompName}?`)) moveTeam(team.id, otherComp) }}
                    disabled={saving}
                    style={btnStyle('#7c3aed')}>
                    → {otherCompName}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ── CATCHES TAB ── */}
        {tab === 'catches' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
              Edit or delete any logged catch. Tap a catch to edit.
            </p>
            {catches.length === 0 && (
              <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No catches logged yet.</div>
            )}
            {catches.map(c => {
              const team = teams.find(t => t.id === c.team_id)
              const angler = participants.find(p => p.id === c.angler_id)
              const boat = boats.find(b => b.id === c.boat_id)
              const day = days.find(d => d.id === c.competition_day_id)
              const isEditing = editingCatch?.id === c.id

              return (
                <div key={c.id} style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  {!isEditing ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.9rem' }}>
                          {c.species_name}
                          {c.scoring === false && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>Non-scoring</span>}
                        </div>
                        <div style={{ fontSize: '0.775rem', color: '#6b7280' }}>
                          {angler?.full_name} • {team?.team_name} • {boat?.boat_name}
                        </div>
                        <div style={{ fontSize: '0.775rem', color: '#6b7280' }}>
                          Day {day?.day_number} — {c.weight_kg ? `${parseFloat(c.weight_kg).toFixed(2)} kg` : 'No weight'} • {c.line_class_kg} kg line • {c.points} pts
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <button onClick={() => setEditingCatch({ ...c })} style={btnStyle('#1e40af')}>Edit</button>
                        <button onClick={() => deleteCatch(c.id)} style={btnStyle('#ef4444')}>Delete</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.85rem', color: NAVY, marginBottom: '0.75rem' }}>Editing catch</div>

                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Team</label>
                      <select style={inputStyle} value={editingCatch.team_id}
                        onChange={e => setEditingCatch(c => ({ ...c, team_id: e.target.value, angler_id: '' }))}>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                      </select>

                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Angler</label>
                      <select style={inputStyle} value={editingCatch.angler_id}
                        onChange={e => setEditingCatch(c => ({ ...c, angler_id: e.target.value }))}>
                        <option value="">— Select angler —</option>
                        {participants.filter(p => p.team_id === editingCatch.team_id).map(p =>
                          <option key={p.id} value={p.id}>{p.full_name}</option>
                        )}
                      </select>

                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Boat</label>
                      <select style={inputStyle} value={editingCatch.boat_id || ''}
                        onChange={e => setEditingCatch(c => ({ ...c, boat_id: e.target.value }))}>
                        <option value="">— Select boat —</option>
                        {boats.map(b => <option key={b.id} value={b.id}>{b.boat_name} — {b.skipper_name}</option>)}
                      </select>

                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Species</label>
                      <input style={inputStyle} value={editingCatch.species_name}
                        onChange={e => setEditingCatch(c => ({ ...c, species_name: e.target.value }))} />

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Weight (kg)</label>
                          <input type="number" step="0.01" style={inputStyle} value={editingCatch.weight_kg || ''}
                            onChange={e => setEditingCatch(c => ({ ...c, weight_kg: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Line Class</label>
                          <select style={inputStyle} value={editingCatch.line_class_kg || 10}
                            onChange={e => setEditingCatch(c => ({ ...c, line_class_kg: e.target.value }))}>
                            <option value={10}>10 kg</option>
                            <option value={15}>15 kg</option>
                          </select>
                        </div>
                      </div>

                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Points</label>
                      <input type="number" step="0.01" style={inputStyle} value={editingCatch.points || ''}
                        onChange={e => setEditingCatch(c => ({ ...c, points: e.target.value }))} />

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editingCatch.scoring === false}
                          onChange={e => setEditingCatch(c => ({ ...c, scoring: !e.target.checked }))} />
                        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Non-scoring (mutilated/predated)</span>
                      </label>

                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Notes</label>
                      <input style={inputStyle} value={editingCatch.notes || ''}
                        onChange={e => setEditingCatch(c => ({ ...c, notes: e.target.value }))} />

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button onClick={saveCatch} disabled={saving} style={btnStyle('#166534')}>
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button onClick={() => setEditingCatch(null)} style={btnStyle('#6b7280')}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── DAYS TAB ── */}
        {tab === 'days' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
              Current competition days. Add a day if the competition starts later than planned.
            </p>
            {days.map(d => (
              <div key={d.id} style={{ background: 'white', borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '700', color: '#111827' }}>Day {d.day_number}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{d.date}</div>
                </div>
                <div style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '20px', background: d.session_status === 'completed' ? '#d1fae5' : '#eff6ff', color: d.session_status === 'completed' ? '#065f46' : NAVY, fontWeight: '600' }}>
                  {d.session_status}
                </div>
              </div>
            ))}
            <div style={{ background: 'white', borderRadius: '8px', padding: '1rem', marginTop: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ fontWeight: '600', fontSize: '0.875rem', color: NAVY, marginBottom: '0.75rem' }}>Add a Day</div>
              <AddDayForm days={days} onAdd={addDay} saving={saving} inputStyle={inputStyle} btnStyle={btnStyle} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AddDayForm({ days, onAdd, saving, inputStyle, btnStyle }) {
  const nextDay = (days.length > 0 ? Math.max(...days.map(d => d.day_number)) : 0) + 1
  const [dayNum, setDayNum] = useState(nextDay)
  const [date, setDate] = useState('')
  return (
    <div>
      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Day Number</label>
      <input type="number" style={inputStyle} value={dayNum} onChange={e => setDayNum(parseInt(e.target.value))} />
      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Date</label>
      <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      <button onClick={() => { if (date) onAdd(dayNum, date) }} disabled={saving || !date} style={btnStyle('#166534')}>
        {saving ? 'Adding...' : 'Add Day'}
      </button>
    </div>
  )
}
