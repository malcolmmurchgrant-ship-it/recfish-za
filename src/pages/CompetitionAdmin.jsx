import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const COMPETITION_TYPE_IDS = {
  'billfish_heavy': '88aba2ba-7cc6-4231-b410-7c0314a121b4',
  'billfish_light': '46c947bd-1831-4298-9220-cdac1b51a70b',
  'tuna':           '68e8986e-3b44-4950-8087-2466fcc6c162',
  'gamefish':       'd76ae5ff-501e-4cab-ac84-a40e1b009bcb',
  'bottomfish':     '80ff9956-7fe0-4999-8939-8762468e76fd',
  'bottomfish_traditional': '8ab1b7ac-675e-492a-804e-bdc0ffa8d3fc',
  'shore':          'd76ae5ff-501e-4cab-ac84-a40e1b009bcb'
}

const SADSAA_PROVINCES = [
  'Border',
  'Eastern Cape',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'Northern Gauteng',
  'North West',
  'Southern Cape',
  'Southern Gauteng',
  'Western Province',
  'Zululand'
]

const TEAM_TYPES = [
  'Provincial',
  'U16',
  'U19',
  'U21',
  'Ladies',
  'Masters',
  'Protea',
  'SASACC',
  'Barbarian',
  'SADSAA'
]

const ANGLER_CATEGORIES = ['Junior', 'Senior', 'Ladies', 'Masters']

const LINE_CLASSES = [6, 10, 15, 24]

const TABS = ['Competition', 'Teams & Anglers', 'Boats', 'Boat Draw', 'Roles']

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    fontFamily: "'Georgia', serif",
    padding: '1.5rem',
    maxWidth: '1100px',
    margin: '0 auto',
    color: '#1a2744'
  },
  header: {
    marginBottom: '1.5rem',
    borderBottom: '3px solid #1e3a8a',
    paddingBottom: '1rem'
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: '0.25rem'
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#6b7280'
  },
  tabs: {
    display: 'flex',
    gap: '0.25rem',
    marginBottom: '1.5rem',
    borderBottom: '2px solid #e5e7eb',
    overflowX: 'auto'
  },
  tab: (active) => ({
    padding: '0.6rem 1.25rem',
    border: 'none',
    background: active ? '#1e3a8a' : 'transparent',
    color: active ? 'white' : '#6b7280',
    fontWeight: active ? '600' : '400',
    cursor: 'pointer',
    borderRadius: '4px 4px 0 0',
    fontSize: '0.9rem',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s'
  }),
  card: {
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    padding: '1.5rem',
    marginBottom: '1rem'
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #e5e7eb'
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem'
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '1rem'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem'
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  input: {
    padding: '0.6rem 0.75rem',
    border: '1.5px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.9rem',
    width: '100%',
    boxSizing: 'border-box',
    color: '#1a2744'
  },
  select: {
    padding: '0.6rem 0.75rem',
    border: '1.5px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.9rem',
    width: '100%',
    boxSizing: 'border-box',
    background: 'white',
    color: '#1a2744',
    cursor: 'pointer',
    maxHeight: '42px'
  },
  btn: {
    padding: '0.6rem 1.25rem',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem',
    transition: 'all 0.15s'
  },
  btnPrimary: {
    background: '#1e3a8a',
    color: 'white'
  },
  btnSuccess: {
    background: '#059669',
    color: 'white'
  },
  btnDanger: {
    background: '#dc2626',
    color: 'white',
    padding: '0.3rem 0.75rem',
    fontSize: '0.8rem'
  },
  btnSecondary: {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem'
  },
  th: {
    padding: '0.6rem 0.75rem',
    background: '#1e3a8a',
    color: 'white',
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '0.8rem'
  },
  td: {
    padding: '0.6rem 0.75rem',
    borderBottom: '1px solid #e5e7eb',
    verticalAlign: 'middle'
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '600',
    background: color === 'blue' ? '#dbeafe' : color === 'green' ? '#d1fae5' : '#fef3c7',
    color: color === 'blue' ? '#1e40af' : color === 'green' ? '#065f46' : '#92400e'
  }),
  alert: (type) => ({
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    marginBottom: '1rem',
    fontSize: '0.875rem',
    background: type === 'success' ? '#d1fae5' : type === 'error' ? '#fee2e2' : '#fef3c7',
    color: type === 'success' ? '#065f46' : type === 'error' ? '#991b1b' : '#92400e',
    border: `1px solid ${type === 'success' ? '#6ee7b7' : type === 'error' ? '#fca5a5' : '#fcd34d'}`
  })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Alert({ msg, type }) {
  if (!msg) return null
  return <div style={s.alert(type)}>{msg}</div>
}

// ── Tab 1: Competition Details ─────────────────────────────────────────────────

function CompetitionTab({ competition, setCompetition, onSave, saving, alert }) {
  const handleChange = (field, value) => {
    setCompetition(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div style={s.card}>
      <div style={s.sectionTitle}>Competition Details</div>
      <Alert msg={alert.msg} type={alert.type} />

      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={s.field}>
          <label style={s.label}>Competition Name *</label>
          <input
            style={s.input}
            value={competition.name || ''}
            onChange={e => handleChange('name', e.target.value)}
            placeholder="e.g. 2026 SADSAA Junior Gamefish Nationals"
          />
        </div>

        <div style={s.grid2}>
          <div style={s.field}>
            <label style={s.label}>Competition Type *</label>
            <select
              style={s.select}
              value={competition.competition_type || 'gamefish'}
              onChange={e => handleChange('competition_type', e.target.value)}
            >
              <option value="gamefish">Gamefish</option>
              <option value="bottomfish">Bottomfish (2023 Rules)</option>
              <option value="bottomfish_traditional">Bottomfish (Traditional)</option>
              <option value="billfish_heavy">Billfish (Heavy)</option>
              <option value="billfish_light">Billfish (Light)</option>
              <option value="tuna">Tuna</option>
              <option value="shore">Shore</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Status</label>
            <select
              style={s.select}
              value={competition.status || 'upcoming'}
              onChange={e => handleChange('status', e.target.value)}
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div style={s.grid2}>
          <div style={s.field}>
            <label style={s.label}>Venue *</label>
            <input
              style={s.input}
              value={competition.venue || ''}
              onChange={e => handleChange('venue', e.target.value)}
              placeholder="e.g. Sodwana Bay, KZN"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Hosting Province</label>
            <select
              style={s.select}
              value={competition.hosting_province || ''}
              onChange={e => handleChange('hosting_province', e.target.value)}
            >
              <option value="">Select province...</option>
              {SADSAA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div style={s.grid3}>
          <div style={s.field}>
            <label style={s.label}>Start Date *</label>
            <input
              type="date"
              style={s.input}
              value={competition.start_date || ''}
              onChange={e => handleChange('start_date', e.target.value)}
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>End Date *</label>
            <input
              type="date"
              style={s.input}
              value={competition.end_date || ''}
              onChange={e => handleChange('end_date', e.target.value)}
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Default Line Class (kg)</label>
            <select
              style={s.select}
              value={competition.default_line_class_kg || ''}
              onChange={e => handleChange('default_line_class_kg', parseInt(e.target.value))}
            >
              <option value="">Select...</option>
              {LINE_CLASSES.map(lc => (
                <option key={lc} value={lc}>{lc} kg</option>
              ))}
            </select>
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Hosting Club</label>
          <input
            style={s.input}
            value={competition.hosting_club || ''}
            onChange={e => handleChange('hosting_club', e.target.value)}
            placeholder="e.g. Zululand Deep Sea Angling Association"
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>Description / Notes</label>
          <textarea
            style={{ ...s.input, minHeight: '80px', resize: 'vertical' }}
            value={competition.description || ''}
            onChange={e => handleChange('description', e.target.value)}
            placeholder="Any additional competition notes..."
          />
        </div>

        <div>
          <button
            style={{ ...s.btn, ...s.btnPrimary }}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : competition.id ? '💾 Update Competition' : '🏆 Create Competition'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab 2: Teams & Anglers ─────────────────────────────────────────────────────

function TeamsTab({ competitionId, teams, anglers, loadTeams, loadAnglers, alert, setAlert }) {
  const [newTeam, setNewTeam] = useState({ team_name: '', province: '', team_type: '' })
  const [customTeamType, setCustomTeamType] = useState('')
  const [newAngler, setNewAngler] = useState({
    full_name: '', club: '', province: '', angler_number: '',
    category: 'Junior', team_id: '', line_class_kg: ''
  })
  const [saving, setSaving] = useState(false)

  const addTeam = async () => {
    if (!newTeam.team_name) return setAlert({ msg: 'Team name is required', type: 'error' })
    const finalTeamType = newTeam.team_type === 'other' ? customTeamType : newTeam.team_type
    setSaving(true)
    try {
      const { error } = await supabase
        .from('competition_teams')
        .insert([{ ...newTeam, team_type: finalTeamType, competition_id: competitionId }])
      if (error) throw error
      setAlert({ msg: `Team "${newTeam.team_name}" added successfully`, type: 'success' })
      setNewTeam({ team_name: '', province: '', team_type: '' })
      setCustomTeamType('')
      loadTeams()
    } catch (e) {
      setAlert({ msg: 'Error adding team: ' + e.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const addAngler = async () => {
    if (!newAngler.full_name) return setAlert({ msg: 'Angler name is required', type: 'error' })
    if (!newAngler.team_id) return setAlert({ msg: 'Please select a team', type: 'error' })
    setSaving(true)
    try {
      const { error } = await supabase
        .from('competition_participants')
        .insert([{
          competition_id: competitionId,
          team_id: newAngler.team_id,
          full_name: newAngler.full_name,
          club: newAngler.club,
          province: newAngler.province,
          angler_number: newAngler.angler_number ? parseInt(newAngler.angler_number) : null,
          category: newAngler.category,
          line_class_kg: newAngler.line_class_kg ? parseInt(newAngler.line_class_kg) : null,
          division: newAngler.category,
          status: 'confirmed'
        }])
      if (error) throw error
      setAlert({ msg: `Angler "${newAngler.full_name}" added successfully`, type: 'success' })
      setNewAngler({ full_name: '', club: '', province: '', angler_number: '', category: 'Junior', team_id: '', line_class_kg: '' })
      loadAnglers()
    } catch (e) {
      setAlert({ msg: 'Error adding angler: ' + e.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const deleteTeam = async (id, name) => {
    if (!window.confirm(`Delete team "${name}"? This will also remove all anglers in this team.`)) return
    const { error } = await supabase.from('competition_teams').delete().eq('id', id)
    if (error) return setAlert({ msg: 'Error: ' + error.message, type: 'error' })
    setAlert({ msg: `Team "${name}" deleted`, type: 'success' })
    loadTeams()
    loadAnglers()
  }

  const deleteAngler = async (id, name) => {
    if (!window.confirm(`Remove "${name}" from the competition?`)) return
    const { error } = await supabase.from('competition_participants').delete().eq('id', id)
    if (error) return setAlert({ msg: 'Error: ' + error.message, type: 'error' })
    setAlert({ msg: `${name} removed`, type: 'success' })
    loadAnglers()
  }

  return (
    <div>
      <Alert msg={alert.msg} type={alert.type} />

      {/* Add Team */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Add Team</div>
        <div style={s.grid3}>
          <div style={s.field}>
            <label style={s.label}>Team Name *</label>
            <input
              style={s.input}
              value={newTeam.team_name}
              onChange={e => setNewTeam(p => ({ ...p, team_name: e.target.value }))}
              placeholder="e.g. Western Province"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Province <span style={{ fontWeight: '400', textTransform: 'none', fontSize: '0.75rem', color: '#6b7280' }}>(leave blank for Barbarian)</span></label>
            <select
              style={s.select}
              value={newTeam.province}
              onChange={e => setNewTeam(p => ({ ...p, province: e.target.value }))}
            >
              <option value="">— None / Barbarian —</option>
              {SADSAA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Team Type</label>
            <select
              style={s.select}
              value={newTeam.team_type}
              onChange={e => setNewTeam(p => ({ ...p, team_type: e.target.value }))}
            >
              <option value="">Select...</option>
              {TEAM_TYPES.map(t => <option key={t} value={t.toLowerCase().replace(' ', '')}>{t}</option>)}
              <option value="other">Other (specify)...</option>
            </select>
            {newTeam.team_type === 'other' && (
              <input
                style={{ ...s.input, marginTop: '0.4rem' }}
                value={customTeamType}
                onChange={e => setCustomTeamType(e.target.value)}
                placeholder="Enter team type..."
              />
            )}
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <button style={{ ...s.btn, ...s.btnSuccess }} onClick={addTeam} disabled={saving}>
            + Add Team
          </button>
        </div>
      </div>

      {/* Teams List */}
      {teams.length > 0 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>Teams ({teams.length})</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Team Name</th>
                <th style={s.th}>Province</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Anglers</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team, i) => {
                const teamAnglers = anglers.filter(a => a.team_id === team.id)
                return (
                  <tr key={team.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ ...s.td, fontWeight: '600' }}>{team.team_name}</td>
                    <td style={s.td}>{team.province || '—'}</td>
                    <td style={s.td}>
                      {team.team_type && (
                        <span style={s.badge('blue')}>{team.team_type}</span>
                      )}
                    </td>
                    <td style={s.td}>{teamAnglers.length}</td>
                    <td style={s.td}>
                      <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => deleteTeam(team.id, team.team_name)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Angler */}
      {teams.length > 0 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>Add Angler</div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={s.grid3}>
              <div style={s.field}>
                <label style={s.label}>Full Name *</label>
                <input
                  style={s.input}
                  value={newAngler.full_name}
                  onChange={e => setNewAngler(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="First and last name"
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Team *</label>
                <select
                  style={s.select}
                  value={newAngler.team_id}
                  onChange={e => setNewAngler(p => ({ ...p, team_id: e.target.value }))}
                >
                  <option value="">Select team...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Club</label>
                <input
                  style={s.input}
                  value={newAngler.club}
                  onChange={e => setNewAngler(p => ({ ...p, club: e.target.value }))}
                  placeholder="Club name"
                />
              </div>
            </div>
            <div style={s.grid3}>
              <div style={s.field}>
                <label style={s.label}>Category</label>
                <select
                  style={s.select}
                  value={newAngler.category}
                  onChange={e => setNewAngler(p => ({ ...p, category: e.target.value }))}
                >
                  {ANGLER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Angler Number</label>
                <input
                  type="number"
                  style={s.input}
                  value={newAngler.angler_number}
                  onChange={e => setNewAngler(p => ({ ...p, angler_number: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Line Class (kg)</label>
                <select
                  style={s.select}
                  value={newAngler.line_class_kg}
                  onChange={e => setNewAngler(p => ({ ...p, line_class_kg: e.target.value }))}
                >
                  <option value="">Use competition default</option>
                  {LINE_CLASSES.map(lc => <option key={lc} value={lc}>{lc} kg</option>)}
                </select>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button style={{ ...s.btn, ...s.btnSuccess }} onClick={addAngler} disabled={saving}>
              + Add Angler
            </button>
          </div>
        </div>
      )}

      {/* Anglers List */}
      {anglers.length > 0 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>Registered Anglers ({anglers.length})</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Name</th>
                <th style={s.th}>Team</th>
                <th style={s.th}>Club</th>
                <th style={s.th}>Category</th>
                <th style={s.th}>Line Class</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {anglers.map((a, i) => {
                const team = teams.find(t => t.id === a.team_id)
                return (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ ...s.td, color: '#6b7280' }}>{a.angler_number || i + 1}</td>
                    <td style={{ ...s.td, fontWeight: '600' }}>{a.full_name}</td>
                    <td style={s.td}>{team?.team_name || '—'}</td>
                    <td style={s.td}>{a.club || '—'}</td>
                    <td style={s.td}>
                      <span style={s.badge('green')}>{a.category || 'Junior'}</span>
                    </td>
                    <td style={s.td}>{a.line_class_kg ? `${a.line_class_kg} kg` : 'Default'}</td>
                    <td style={s.td}>
                      <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => deleteAngler(a.id, a.full_name)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {teams.length === 0 && (
        <div style={{ ...s.card, textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
          <p>Add teams first, then add anglers to each team.</p>
        </div>
      )}
    </div>
  )
}

// ── Tab 3: Boats ───────────────────────────────────────────────────────────────

function BoatsTab({ competitionId, boats, loadBoats, alert, setAlert }) {
  const [newBoat, setNewBoat] = useState({
    boat_name: '', skipper_name: '', vessel_registration: '', capacity: 4
  })
  const [saving, setSaving] = useState(false)

  const addBoat = async () => {
    if (!newBoat.boat_name || !newBoat.skipper_name)
      return setAlert({ msg: 'Boat name and skipper name are required', type: 'error' })
    setSaving(true)
    try {
      const { error } = await supabase
        .from('competition_boats')
        .insert([{ ...newBoat, competition_id: competitionId, capacity: parseInt(newBoat.capacity) }])
      if (error) throw error
      setAlert({ msg: `Boat "${newBoat.boat_name}" added successfully`, type: 'success' })
      setNewBoat({ boat_name: '', skipper_name: '', vessel_registration: '', capacity: 4 })
      loadBoats()
    } catch (e) {
      setAlert({ msg: 'Error adding boat: ' + e.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const deleteBoat = async (id, name) => {
    if (!window.confirm(`Remove boat "${name}"?`)) return
    const { error } = await supabase.from('competition_boats').delete().eq('id', id)
    if (error) return setAlert({ msg: 'Error: ' + error.message, type: 'error' })
    setAlert({ msg: `Boat "${name}" removed`, type: 'success' })
    loadBoats()
  }

  return (
    <div>
      <Alert msg={alert.msg} type={alert.type} />
      <div style={s.card}>
        <div style={s.sectionTitle}>Add Boat</div>
        <div style={s.grid2}>
          <div style={s.field}>
            <label style={s.label}>Boat Name *</label>
            <input
              style={s.input}
              value={newBoat.boat_name}
              onChange={e => setNewBoat(p => ({ ...p, boat_name: e.target.value }))}
              placeholder="e.g. Blue Marlin"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Skipper Name *</label>
            <input
              style={s.input}
              value={newBoat.skipper_name}
              onChange={e => setNewBoat(p => ({ ...p, skipper_name: e.target.value }))}
              placeholder="Skipper's full name"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Vessel Registration</label>
            <input
              style={s.input}
              value={newBoat.vessel_registration}
              onChange={e => setNewBoat(p => ({ ...p, vessel_registration: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Capacity (anglers)</label>
            <input
              type="number"
              style={s.input}
              value={newBoat.capacity}
              min={1}
              max={8}
              onChange={e => setNewBoat(p => ({ ...p, capacity: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <button style={{ ...s.btn, ...s.btnSuccess }} onClick={addBoat} disabled={saving}>
            + Add Boat
          </button>
        </div>
      </div>

      {boats.length > 0 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>Registered Boats ({boats.length})</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Boat Name</th>
                <th style={s.th}>Skipper</th>
                <th style={s.th}>Registration</th>
                <th style={s.th}>Capacity</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {boats.map((boat, i) => (
                <tr key={boat.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ ...s.td, fontWeight: '600' }}>{boat.boat_name}</td>
                  <td style={s.td}>{boat.skipper_name}</td>
                  <td style={s.td}>{boat.vessel_registration || '—'}</td>
                  <td style={s.td}>{boat.capacity}</td>
                  <td style={s.td}>
                    <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => deleteBoat(boat.id, boat.boat_name)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab 4: Boat Draw ───────────────────────────────────────────────────────────

function BoatDrawTab({ competitionId, competition, boats, anglers, teams, alert, setAlert }) {
  const [draws, setDraws] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [assignments, setAssignments] = useState({})

  useEffect(() => {
    if (competitionId && selectedDate) loadDraws()
  }, [competitionId, selectedDate])

  const getFishingDates = () => {
    if (!competition.start_date || !competition.end_date) return []
    const dates = []
    const start = new Date(competition.start_date)
    const end = new Date(competition.end_date)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0])
    }
    return dates
  }

  const loadDraws = async () => {
    const { data, error } = await supabase
      .from('competition_boat_draws')
      .select('*')
      .eq('competition_id', competitionId)
      .eq('fishing_date', selectedDate)
    if (!error) {
      setDraws(data || [])
      const existing = {}
      data?.forEach(d => { existing[d.angler_id] = d.boat_id })
      setAssignments(existing)
    }
  }

  const saveDraw = async () => {
    setSaving(true)
    try {
      // Delete existing draws for this date
      await supabase
        .from('competition_boat_draws')
        .delete()
        .eq('competition_id', competitionId)
        .eq('fishing_date', selectedDate)

      // Insert new assignments
      const inserts = Object.entries(assignments)
        .filter(([, boatId]) => boatId)
        .map(([anglerId, boatId]) => ({
          competition_id: competitionId,
          boat_id: boatId,
          angler_id: anglerId,
          fishing_date: selectedDate
        }))

      if (inserts.length > 0) {
        const { error } = await supabase.from('competition_boat_draws').insert(inserts)
        if (error) throw error
      }

      setAlert({ msg: `Boat draw saved for ${selectedDate}`, type: 'success' })
      loadDraws()
    } catch (e) {
      setAlert({ msg: 'Error saving draw: ' + e.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const fishingDates = getFishingDates()

  return (
    <div>
      <Alert msg={alert.msg} type={alert.type} />
      <div style={s.card}>
        <div style={s.sectionTitle}>Daily Boat Draw</div>

        <div style={{ ...s.field, maxWidth: '300px', marginBottom: '1.5rem' }}>
          <label style={s.label}>Select Fishing Date</label>
          <select
            style={s.select}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          >
            <option value="">Choose date...</option>
            {fishingDates.map(d => (
              <option key={d} value={d}>
                {new Date(d + 'T12:00:00').toLocaleDateString('en-ZA', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                })}
              </option>
            ))}
          </select>
        </div>

        {selectedDate && anglers.length > 0 && boats.length > 0 && (
          <>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
              Assign each angler to a boat for {selectedDate}. Leave blank if angler is not fishing that day.
            </p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Angler</th>
                  <th style={s.th}>Team</th>
                  <th style={s.th}>Assign to Boat</th>
                </tr>
              </thead>
              <tbody>
                {anglers.map((a, i) => {
                  const team = teams.find(t => t.id === a.team_id)
                  return (
                    <tr key={a.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                      <td style={{ ...s.td, fontWeight: '600' }}>{a.full_name}</td>
                      <td style={s.td}>{team?.team_name || '—'}</td>
                      <td style={s.td}>
                        <select
                          style={{ ...s.select, maxWidth: '220px' }}
                          value={assignments[a.id] || ''}
                          onChange={e => setAssignments(prev => ({
                            ...prev,
                            [a.id]: e.target.value
                          }))}
                        >
                          <option value="">Not fishing</option>
                          {boats.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.boat_name} ({b.skipper_name})
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ marginTop: '1rem' }}>
              <button style={{ ...s.btn, ...s.btnPrimary }} onClick={saveDraw} disabled={saving}>
                {saving ? 'Saving...' : '💾 Save Draw for this Date'}
              </button>
            </div>
          </>
        )}

        {selectedDate && (anglers.length === 0 || boats.length === 0) && (
          <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
            Please add anglers and boats first before creating the boat draw.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Tab 5: User Roles ──────────────────────────────────────────────────────────

function RolesTab({ competitionId, boats, alert, setAlert }) {
  const [roles, setRoles] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('angler')
  const [boatId, setBoatId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (competitionId) loadRoles()
  }, [competitionId])

  const loadRoles = async () => {
    const { data, error } = await supabase
      .from('competition_user_roles')
      .select('*, user:user_id(email)')
      .eq('competition_id', competitionId)
    if (!error) setRoles(data || [])
  }

  const addRole = async () => {
    if (!email) return setAlert({ msg: 'Email is required', type: 'error' })
    setSaving(true)
    try {
      // Look up user by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (userError || !userData)
        return setAlert({ msg: 'User not found. They must be registered in the app first.', type: 'error' })

      const { error } = await supabase
        .from('competition_user_roles')
        .insert([{
          competition_id: competitionId,
          user_id: userData.id,
          role,
          boat_id: (role === 'skipper' && boatId) ? boatId : null
        }])
      if (error) throw error
      setAlert({ msg: `Role assigned successfully`, type: 'success' })
      setEmail('')
      setBoatId('')
      loadRoles()
    } catch (e) {
      setAlert({ msg: 'Error: ' + e.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const removeRole = async (id) => {
    if (!window.confirm('Remove this role?')) return
    const { error } = await supabase.from('competition_user_roles').delete().eq('id', id)
    if (error) return setAlert({ msg: 'Error: ' + error.message, type: 'error' })
    setAlert({ msg: 'Role removed', type: 'success' })
    loadRoles()
  }

  const roleColour = (r) => r === 'admin' || r === 'tournament_director' ? 'blue' : r === 'skipper' ? 'yellow' : 'green'

  return (
    <div>
      <Alert msg={alert.msg} type={alert.type} />
      <div style={s.card}>
        <div style={s.sectionTitle}>Assign Competition Role</div>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
          Users must be registered in the app before they can be assigned a role.
        </p>
        <div style={s.grid3}>
          <div style={s.field}>
            <label style={s.label}>User Email *</label>
            <input
              style={s.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@email.com"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Role *</label>
            <select style={s.select} value={role} onChange={e => setRole(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="tournament_director">Tournament Director</option>
              <option value="skipper">Skipper</option>
              <option value="angler">Angler</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          {role === 'skipper' && (
            <div style={s.field}>
              <label style={s.label}>Assign to Boat</label>
              <select style={s.select} value={boatId} onChange={e => setBoatId(e.target.value)}>
                <option value="">Select boat...</option>
                {boats.map(b => <option key={b.id} value={b.id}>{b.boat_name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{ marginTop: '1rem' }}>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={addRole} disabled={saving}>
            + Assign Role
          </button>
        </div>
      </div>

      {roles.length > 0 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>Assigned Roles ({roles.length})</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>User</th>
                <th style={s.th}>Role</th>
                <th style={s.th}>Boat</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r, i) => {
                const boat = boats.find(b => b.id === r.boat_id)
                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={s.td}>{r.user?.email || r.user_id}</td>
                    <td style={s.td}><span style={s.badge(roleColour(r.role))}>{r.role.replace('_', ' ')}</span></td>
                    <td style={s.td}>{boat?.boat_name || '—'}</td>
                    <td style={s.td}>
                      <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => removeRole(r.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CompetitionAdmin() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(0)
  const [competition, setCompetition] = useState({
    name: '',
    competition_type: 'gamefish',
    venue: '',
    hosting_province: '',
    hosting_club: '',
    start_date: '',
    end_date: '',
    default_line_class_kg: '',
    status: 'upcoming',
    description: '',
    team_format: 'traditional',
    scoring_method: 'points'
  })
  const [teams, setTeams] = useState([])
  const [anglers, setAnglers] = useState([])
  const [boats, setBoats] = useState([])
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState({ msg: '', type: '' })

  // Clear alert after 5 seconds
  useEffect(() => {
    if (alert.msg) {
      const t = setTimeout(() => setAlert({ msg: '', type: '' }), 5000)
      return () => clearTimeout(t)
    }
  }, [alert])

  const loadTeams = async () => {
    if (!competition.id) return
    const { data } = await supabase
      .from('competition_teams')
      .select('*')
      .eq('competition_id', competition.id)
      .order('team_name')
    setTeams(data || [])
  }

  const loadAnglers = async () => {
    if (!competition.id) return
    const { data } = await supabase
      .from('competition_participants')
      .select('*')
      .eq('competition_id', competition.id)
      .order('full_name')
    setAnglers(data || [])
  }

  const loadBoats = async () => {
    if (!competition.id) return
    const { data } = await supabase
      .from('competition_boats')
      .select('*')
      .eq('competition_id', competition.id)
      .order('boat_name')
    setBoats(data || [])
  }

  useEffect(() => {
    if (competition.id) {
      loadTeams()
      loadAnglers()
      loadBoats()
    }
  }, [competition.id])

  const saveCompetition = async () => {
    if (!competition.name || !competition.venue || !competition.start_date || !competition.end_date)
      return setAlert({ msg: 'Please fill in all required fields (Name, Venue, Start Date, End Date)', type: 'error' })

    setSaving(true)
    try {
      const payload = {
        name: competition.name,
        competition_type_id: COMPETITION_TYPE_IDS[competition.competition_type] || COMPETITION_TYPE_IDS['gamefish'],
        venue: competition.venue,
        hosting_province: competition.hosting_province,
        hosting_club: competition.hosting_club,
        start_date: competition.start_date,
        end_date: competition.end_date,
        default_line_class_kg: competition.default_line_class_kg || null,
        status: competition.status,
        description: competition.description,
        team_format: competition.competition_type === 'bottomfish' || competition.competition_type === 'bottomfish_traditional' ? 'split_boat' : 'traditional',
        scoring_method: 'points',
        compiled_by: user?.id
      }

      if (competition.id) {
        const { error } = await supabase
          .from('competitions')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', competition.id)
        if (error) throw error
        setAlert({ msg: 'Competition updated successfully', type: 'success' })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        const { data, error } = await supabase
          .from('competitions')
          .insert([payload])
          .select()
          .single()
        if (error) throw error
        setCompetition(prev => ({ ...prev, id: data.id }))
        setAlert({ msg: '🏆 Competition created! Now add your teams, anglers and boats.', type: 'success' })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setActiveTab(1)
      }
    } catch (e) {
      setAlert({ msg: 'Error saving competition: ' + e.message, type: 'error' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const tabLocked = (index) => index > 0 && !competition.id

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>🏆 Competition Administration</div>
        <div style={s.subtitle}>
          {competition.id
            ? `Managing: ${competition.name}`
            : 'Create a new competition to get started'}
        </div>
      </div>

      <div style={s.tabs}>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            style={{
              ...s.tab(activeTab === i),
              opacity: tabLocked(i) ? 0.4 : 1,
              cursor: tabLocked(i) ? 'not-allowed' : 'pointer'
            }}
            onClick={() => !tabLocked(i) && setActiveTab(i)}
            title={tabLocked(i) ? 'Save competition details first' : ''}
          >
            {tab}
            {tabLocked(i) && ' 🔒'}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
        <CompetitionTab
          competition={competition}
          setCompetition={setCompetition}
          onSave={saveCompetition}
          saving={saving}
          alert={alert}
        />
      )}
      {activeTab === 1 && competition.id && (
        <TeamsTab
          competitionId={competition.id}
          teams={teams}
          anglers={anglers}
          loadTeams={loadTeams}
          loadAnglers={loadAnglers}
          alert={alert}
          setAlert={setAlert}
        />
      )}
      {activeTab === 2 && competition.id && (
        <BoatsTab
          competitionId={competition.id}
          boats={boats}
          loadBoats={loadBoats}
          alert={alert}
          setAlert={setAlert}
        />
      )}
      {activeTab === 3 && competition.id && (
        <BoatDrawTab
          competitionId={competition.id}
          competition={competition}
          boats={boats}
          anglers={anglers}
          teams={teams}
          alert={alert}
          setAlert={setAlert}
        />
      )}
      {activeTab === 4 && competition.id && (
        <RolesTab
          competitionId={competition.id}
          boats={boats}
          alert={alert}
          setAlert={setAlert}
        />
      )}
    </div>
  )
}
