// ═══════════════════════════════════════════════════════════════════════════
// CompetitionAdmin.jsx — Universal Competition Administration
// Supports all SADSAA disciplines, associations and formats
// Route: /competition-admin-v2
// Route with ID: /competition-admin-v2/:competitionId
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const NAVY   = '#1e3a8a'
const GOLD   = '#d97706'
const GREEN  = '#16a34a'
const RED    = '#dc2626'
const GREY   = '#6b7280'

const DISCIPLINE_LABELS = {
  bottomfish:     '🐟 Bottomfish',
  tuna:           '🐟 Tuna',
  gamefish:       '🐟 Gamefish',
  billfish_light: '🐟 Light Tackle Billfish',
  billfish_heavy: '🐟 Heavy Tackle Billfish',
  mixed:          '🐟 Mixed',
  shore:          '🏖 Shore',
  spearfishing:   '🤿 Spearfishing',
}

const LEVEL_LABELS = {
  international:   '🌍 International',
  national:        '🏆 National',
  interprovincial: '🏅 Interprovincial',
  provincial:      '📍 Provincial',
  regional:        '📍 Regional',
  club:            '🎣 Club',
  special:         '⭐ Special',
}

const CATEGORY_LABELS = {
  open:       'Open',
  junior:     'Junior',
  junior_u16: 'Junior U16',
  junior_u19: 'Junior U19',
  junior_u21: 'Junior U21',
  ladies:     'Ladies',
  special:    'Special',
}

const S = {
  page:    { maxWidth: 1000, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' },
  card:    { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', marginBottom: '1rem' },
  label:   { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  input:   { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' },
  select:  { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box' },
  btn:     (bg=NAVY, color='white') => ({ background: bg, color, border: 'none', padding: '0.55rem 1.1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }),
  btnSm:   (bg=NAVY, color='white') => ({ background: bg, color, border: 'none', padding: '0.35rem 0.75rem', borderRadius: 5, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }),
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  grid3:   { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' },
  row:     { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  tab:     (active) => ({ flex: 1, padding: '0.65rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: active ? NAVY : 'white', color: active ? 'white' : '#374151' }),
  badge:   (color) => ({ background: color, color: 'white', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }),
}

// ─── SETUP TAB ────────────────────────────────────────────────────────────────
function SetupTab({ competition, onSaved }) {
  const [federations, setFederations]   = useState([])
  const [associations, setAssociations] = useState([])
  const [templates, setTemplates]       = useState([])
  const [form, setForm] = useState({
    name: '', short_name: '', federation_id: '', association_id: '',
    template_id: '', discipline: '', level: '', category: 'open',
    venue: '', hosting_province: '', start_date: '', end_date: '',
    team_format: 'split_boat', team_size: 3, num_fishing_days: 3,
    default_line_class_kg: 6, fine_grid_number: '', coarse_grid_number: '',
    results_visible: true, catch_release_enabled: false,
    description: '', td_name: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  // Pre-fill from existing competition
  useEffect(() => {
    if (competition) {
      setForm(f => ({ ...f,
        name:                  competition.name || '',
        short_name:            competition.short_name || '',
        federation_id:         competition.federation_id || '',
        association_id:        competition.association_id || '',
        template_id:           competition.template_id || '',
        discipline:            competition.discipline || '',
        level:                 competition.level || '',
        category:              competition.category || 'open',
        venue:                 competition.venue || '',
        hosting_province:      competition.hosting_province || '',
        start_date:            competition.start_date || '',
        end_date:              competition.end_date || '',
        team_format:           competition.team_format || 'split_boat',
        team_size:             competition.team_size || 3,
        default_line_class_kg: competition.default_line_class_kg || 6,
        fine_grid_number:      competition.fine_grid_number || '',
        coarse_grid_number:    competition.coarse_grid_number || '',
        results_visible:       competition.results_visible ?? true,
        catch_release_enabled: competition.catch_release_enabled ?? false,
        description:           competition.description || '',
        td_name:               competition.td_name || '',
      }))
    }
  }, [competition])

  // Load federations
  useEffect(() => {
    supabase.from('federations').select('*').eq('status','active').order('short_name')
      .then(({ data }) => setFederations(data || []))
  }, [])

  // Load associations when federation changes
  useEffect(() => {
    if (!form.federation_id) { setAssociations([]); return }
    supabase.from('associations').select('*')
      .eq('federation_id', form.federation_id)
      .eq('status','active')
      .order('short_name')
      .then(({ data }) => setAssociations(data || []))
  }, [form.federation_id])

  // Load templates when federation changes
  useEffect(() => {
    if (!form.federation_id) { setTemplates([]); return }
    supabase.from('competition_templates').select('*')
      .eq('federation_id', form.federation_id)
      .eq('is_active', true)
      .order('discipline').order('level').order('category')
      .then(({ data }) => setTemplates(data || []))
  }, [form.federation_id])

  // Auto-fill from template
  const handleTemplateChange = (templateId) => {
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) { setForm(f => ({ ...f, template_id: templateId })); return }
    setForm(f => ({
      ...f,
      template_id:           tpl.id,
      discipline:            tpl.discipline,
      level:                 tpl.level || f.level,
      category:              tpl.category,
      team_format:           tpl.team_format,
      team_size:             tpl.team_size,
      default_line_class_kg: tpl.default_line_class_kg || f.default_line_class_kg,
      catch_release_enabled: tpl.catch_release_enabled,
    }))
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    if (!form.name || !form.federation_id || !form.start_date) {
      setError('Competition name, federation and start date are required.')
      return
    }
    setSaving(true); setError('')

    const payload = {
      name:                  form.name,
      short_name:            form.short_name || form.name.slice(0,20),
      federation_id:         form.federation_id || null,
      association_id:        form.association_id || null,
      template_id:           form.template_id || null,
      discipline:            form.discipline || null,
      level:                 form.level || null,
      category:              form.category || 'open',
      venue:                 form.venue || null,
      hosting_province:      form.hosting_province || null,
      start_date:            form.start_date || null,
      end_date:              form.end_date || null,
      team_format:           form.team_format || null,
      team_size:             parseInt(form.team_size) || 3,
      default_line_class_kg: parseInt(form.default_line_class_kg) || 6,
      fine_grid_number:      form.fine_grid_number ? parseInt(form.fine_grid_number) : null,
      coarse_grid_number:    form.coarse_grid_number ? parseInt(form.coarse_grid_number) : null,
      results_visible:       form.results_visible,
      catch_release_enabled: form.catch_release_enabled,
      description:           form.description || null,
      td_name:               form.td_name || null,
      scoring_method:        form.scoring_method || null,
      status:                'active',
      updated_at:            new Date().toISOString(),
    }

    let savedData, saveError
    if (competition?.id) {
      const { data, error } = await supabase
        .from('competitions').update(payload).eq('id', competition.id).select()
      saveError = error
      savedData = data?.[0] || null
    } else {
      const { data, error } = await supabase
        .from('competitions').insert(payload).select()
      saveError = error
      savedData = data?.[0] || null
    }

    if (saveError) { setError(saveError.message); setSaving(false); return }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    if (savedData) onSaved(savedData)
  }

  const selectedFed  = federations.find(f => f.id === form.federation_id)
  const selectedTpl  = templates.find(t => t.id === form.template_id)

  return (
    <div>
      {/* Federation & Association */}
      <div style={S.card}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '1rem' }}>
          1 — Organisation
        </div>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Federation *</label>
            <select style={S.select} value={form.federation_id}
              onChange={e => set('federation_id', e.target.value)}>
              <option value=''>Select federation…</option>
              {federations.map(f => (
                <option key={f.id} value={f.id}>{f.short_name} — {f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Hosting Association</label>
            <select style={S.select} value={form.association_id}
              onChange={e => set('association_id', e.target.value)}
              disabled={!form.federation_id}>
              <option value=''>Select association…</option>
              {associations.map(a => (
                <option key={a.id} value={a.id}>{a.short_name} — {a.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Template */}
      <div style={S.card}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '1rem' }}>
          2 — Competition Template
        </div>
        <div>
          <label style={S.label}>Template (auto-fills format & scoring rules)</label>
          <select style={S.select} value={form.template_id}
            onChange={e => handleTemplateChange(e.target.value)}
            disabled={!form.federation_id}>
            <option value=''>Select template…</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        {selectedTpl && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#eff6ff', borderRadius: 6, fontSize: '0.85rem' }}>
            <div style={S.row}>
              <span style={S.badge(NAVY)}>{DISCIPLINE_LABELS[selectedTpl.discipline]}</span>
              <span style={S.badge('#6b7280')}>{LEVEL_LABELS[selectedTpl.level]}</span>
              <span style={S.badge(GREEN)}>{CATEGORY_LABELS[selectedTpl.category]}</span>
              <span style={S.badge(GOLD)}>Team: {selectedTpl.team_size} anglers</span>
            </div>
            {selectedTpl.description && (
              <div style={{ marginTop: '0.5rem', color: '#374151' }}>{selectedTpl.description}</div>
            )}
          </div>
        )}
      </div>

      {/* Competition Details */}
      <div style={S.card}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '1rem' }}>
          3 — Competition Details
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={S.label}>Competition Name *</label>
          <input style={S.input} value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder='e.g. SADSAA Gamefish Nationals 2026' />
        </div>
        <div style={{ ...S.grid2, marginBottom: '0.75rem' }}>
          <div>
            <label style={S.label}>Short Name</label>
            <input style={S.input} value={form.short_name}
              onChange={e => set('short_name', e.target.value)}
              placeholder='e.g. Gamefish Nationals 2026' />
          </div>
          <div>
            <label style={S.label}>Tournament Director</label>
            <input style={S.input} value={form.td_name}
              onChange={e => set('td_name', e.target.value)}
              placeholder='Full name' />
          </div>
        </div>
        <div style={{ ...S.grid2, marginBottom: '0.75rem' }}>
          <div>
            <label style={S.label}>Venue</label>
            <input style={S.input} value={form.venue}
              onChange={e => set('venue', e.target.value)}
              placeholder='e.g. Meerensee Boat Club' />
          </div>
          <div>
            <label style={S.label}>Hosting Province</label>
            <input style={S.input} value={form.hosting_province}
              onChange={e => set('hosting_province', e.target.value)}
              placeholder='e.g. KwaZulu-Natal' />
          </div>
        </div>
        <div style={{ ...S.grid3, marginBottom: '0.75rem' }}>
          <div>
            <label style={S.label}>Start Date *</label>
            <input style={S.input} type='date' value={form.start_date}
              onChange={e => set('start_date', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>End Date</label>
            <input style={S.input} type='date' value={form.end_date}
              onChange={e => set('end_date', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Fishing Days</label>
            <input style={S.input} type='number' min='1' max='10'
              value={form.num_fishing_days}
              onChange={e => set('num_fishing_days', e.target.value)} />
          </div>
        </div>
        <div style={{ ...S.grid3, marginBottom: '0.75rem' }}>
          <div>
            <label style={S.label}>Team Size (anglers)</label>
            <input style={S.input} type='number' min='1' max='6'
              value={form.team_size}
              onChange={e => set('team_size', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Default Line Class (kg)</label>
            <select style={S.select} value={form.default_line_class_kg}
              onChange={e => set('default_line_class_kg', e.target.value)}>
              {[6,8,10,15,24,37].map(lc => (
                <option key={lc} value={lc}>{lc}kg</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Team Format</label>
            <select style={S.select} value={form.team_format}
              onChange={e => set('team_format', e.target.value)}>
              <option value='split_boat'>Split Boat Draw</option>
              <option value='traditional'>Own Boat (Traditional)</option>
              <option value='individual'>Individual</option>
              <option value='pairs'>Pairs</option>
            </select>
          </div>
        </div>
        <div style={{ ...S.grid2, marginBottom: '0.75rem' }}>
          <div>
            <label style={S.label}>Fine Grid Number (SAN)</label>
            <input style={S.input} type='number' value={form.fine_grid_number}
              onChange={e => set('fine_grid_number', e.target.value)}
              placeholder='e.g. 21548' />
          </div>
          <div>
            <label style={S.label}>Coarse Grid Number (SAN)</label>
            <input style={S.input} type='number' value={form.coarse_grid_number}
              onChange={e => set('coarse_grid_number', e.target.value)}
              placeholder='e.g. 2434' />
          </div>
        </div>
        <div>
          <label style={S.label}>Description / Notes</label>
          <textarea style={{ ...S.input, resize: 'vertical' }} rows={3}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder='Any additional notes about this competition…' />
        </div>
      </div>

      {/* Settings */}
      <div style={S.card}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '1rem' }}>
          4 — Settings
        </div>
        <div style={S.row}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type='checkbox' checked={form.results_visible}
              onChange={e => set('results_visible', e.target.checked)} />
            <span style={{ fontWeight: 600 }}>Results visible to all users</span>
          </label>
          <span style={{ fontSize: '0.8rem', color: GREY }}>
            Uncheck to hide live standings from competitors during the competition
          </span>
        </div>
        <div style={{ ...S.row, marginTop: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type='checkbox' checked={form.catch_release_enabled}
              onChange={e => set('catch_release_enabled', e.target.checked)} />
            <span style={{ fontWeight: 600 }}>Catch & Release enabled</span>
          </label>
          <span style={{ fontSize: '0.8rem', color: GREY }}>
            Allows recording of released fish with configurable points
          </span>
        </div>
      </div>

      {/* Save */}
      {error && <div style={{ background: '#fef2f2', color: RED, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem' }}>{error}</div>}
      {saved && <div style={{ background: '#f0fdf4', color: GREEN, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem', fontWeight: 600 }}>✅ Competition saved successfully!</div>}
      <button onClick={handleSave} disabled={saving}
        style={{ ...S.btn(), padding: '0.75rem 2rem', fontSize: '1rem', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving…' : competition?.id ? '💾 Update Competition' : '🚀 Create Competition'}
      </button>
    </div>
  )
}

// ─── TEAMS TAB ────────────────────────────────────────────────────────────────
function TeamsTab({ competition }) {
  const [teams, setTeams]           = useState([])
  const [participants, setParticipants] = useState([])
  const [loading, setLoading]       = useState(true)
  const [newTeam, setNewTeam]       = useState({ team_name: '', province: '' })
  const [newAngler, setNewAngler]   = useState({ full_name: '', is_captain: false, team_id: '' })
  const [addingTeam, setAddingTeam] = useState(false)
  const [addingAngler, setAddingAngler] = useState(null) // team_id
  const [error, setError]           = useState('')

  const load = useCallback(async () => {
    if (!competition?.id) return
    setLoading(true)
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('competition_teams').select('*')
        .eq('competition_id', competition.id).order('team_name'),
      supabase.from('competition_participants').select('*')
        .eq('competition_id', competition.id).order('full_name'),
    ])
    setTeams(t || [])
    setParticipants(p || [])
    setLoading(false)
  }, [competition?.id])

  useEffect(() => { load() }, [load])

  const handleAddTeam = async () => {
    if (!newTeam.team_name) return
    const { error: err } = await supabase.from('competition_teams').insert({
      competition_id: competition.id,
      team_name: newTeam.team_name,
      province: newTeam.province || null,
    })
    if (err) { setError(err.message); return }
    setNewTeam({ team_name: '', province: '' })
    setAddingTeam(false)
    load()
  }

  const handleAddAngler = async (teamId) => {
    if (!newAngler.full_name) return
    const { error: err } = await supabase.from('competition_participants').insert({
      competition_id: competition.id,
      team_id: teamId,
      full_name: newAngler.full_name,
      is_captain: newAngler.is_captain,
      status: 'confirmed',
    })
    if (err) { setError(err.message); return }
    setNewAngler({ full_name: '', is_captain: false, team_id: '' })
    setAddingAngler(null)
    load()
  }

  const handleDeleteAngler = async (id) => {
    if (!window.confirm('Remove this angler?')) return
    await supabase.from('competition_participants').delete().eq('id', id)
    load()
  }

  const handleDeleteTeam = async (id) => {
    if (!window.confirm('Delete this team and all its anglers?')) return
    await supabase.from('competition_participants').delete().eq('team_id', id)
    await supabase.from('competition_teams').delete().eq('id', id)
    load()
  }

  const handleSetCaptain = async (participantId, teamId) => {
    // Clear existing captain on team
    await supabase.from('competition_participants')
      .update({ is_captain: false })
      .eq('team_id', teamId)
    // Set new captain
    await supabase.from('competition_participants')
      .update({ is_captain: true })
      .eq('id', participantId)
    load()
  }

  const handleDQ = async (p) => {
    const reason = window.prompt(`Disqualification reason for ${p.full_name}:`, p.disqualified_reason || '')
    if (reason === null) return
    await supabase.from('competition_participants')
      .update({ disqualified: !p.disqualified, disqualified_reason: reason })
      .eq('id', p.id)
    load()
  }

  if (!competition?.id) return (
    <div style={{ color: GREY, fontStyle: 'italic' }}>Save the competition first to manage teams.</div>
  )

  if (loading) return <div style={{ color: GREY }}>Loading…</div>

  const teamAnglers = (teamId) => participants.filter(p => p.team_id === teamId)
  const totalAnglers = participants.length
  const expectedAnglers = teams.length * (competition.team_size || 3)

  return (
    <div>
      {/* Summary */}
      <div style={{ ...S.card, background: '#eff6ff' }}>
        <div style={S.row}>
          {[
            { label: 'Teams', val: teams.length },
            { label: 'Anglers', val: totalAnglers },
            { label: 'Expected', val: expectedAnglers },
            { label: 'Captains', val: participants.filter(p => p.is_captain).length },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', minWidth: 70 }}>
              <div style={{ fontWeight: 800, fontSize: '1.4rem', color: NAVY }}>{s.val}</div>
              <div style={{ fontSize: '0.72rem', color: GREY }}>{s.label}</div>
            </div>
          ))}
          {totalAnglers < expectedAnglers && (
            <div style={{ marginLeft: 'auto', fontSize: '0.82rem', color: GOLD, fontWeight: 600 }}>
              ⚠ {expectedAnglers - totalAnglers} anglers still to add
            </div>
          )}
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', color: RED, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem' }}>{error}</div>}

      {/* Team list */}
      {teams.map(team => (
        <div key={team.id} style={{ ...S.card, borderLeft: `4px solid ${NAVY}` }}>
          {/* Team header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: NAVY }}>{team.team_name}</span>
              {team.province && <span style={{ fontSize: '0.8rem', color: GREY, marginLeft: 8 }}>{team.province}</span>}
            </div>
            <div style={S.row}>
              <button onClick={() => setAddingAngler(team.id)}
                style={S.btnSm(GREEN)}>+ Angler</button>
              <button onClick={() => handleDeleteTeam(team.id)}
                style={S.btnSm('#f3f4f6','#374151')}>🗑</button>
            </div>
          </div>

          {/* Anglers */}
          {teamAnglers(team.id).length === 0 ? (
            <div style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem' }}>No anglers yet</div>
          ) : (
            teamAnglers(team.id)
              .sort((a,b) => (b.is_captain ? 1 : 0) - (a.is_captain ? 1 : 0))
              .map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 0', borderBottom: '1px solid #f0f0f0',
                background: p.disqualified ? '#fef2f2' : 'transparent',
                borderRadius: 4, paddingLeft: 4,
              }}>
                <span style={{ minWidth: 20 }}>{p.is_captain ? '⚓' : ''}</span>
                <span style={{ flex: 1, fontWeight: p.is_captain ? 700 : 400, color: p.disqualified ? RED : '#111' }}>
                  {p.full_name}
                  {p.disqualified && <span style={{ ...S.badge(RED), marginLeft: 8 }}>DQ</span>}
                </span>
                {!p.is_captain && (
                  <button onClick={() => handleSetCaptain(p.id, team.id)}
                    style={S.btnSm('#f3f4f6','#374151')} title='Set as captain'>⚓</button>
                )}
                <button onClick={() => handleDQ(p)}
                  style={S.btnSm(p.disqualified ? GOLD : '#f3f4f6', p.disqualified ? 'white' : '#374151')}
                  title={p.disqualified ? 'Remove DQ' : 'Disqualify'}>
                  {p.disqualified ? 'Un-DQ' : 'DQ'}
                </button>
                <button onClick={() => handleDeleteAngler(p.id)}
                  style={S.btnSm('#f3f4f6','#374151')}>✕</button>
              </div>
            ))
          )}

          {/* Add angler inline form */}
          {addingAngler === team.id && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 6 }}>
              <div style={S.row}>
                <input style={{ ...S.input, flex: 1 }}
                  placeholder='Angler full name'
                  value={newAngler.full_name}
                  onChange={e => setNewAngler(a => ({ ...a, full_name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddAngler(team.id)}
                  autoFocus />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  <input type='checkbox' checked={newAngler.is_captain}
                    onChange={e => setNewAngler(a => ({ ...a, is_captain: e.target.checked }))} />
                  Captain
                </label>
                <button onClick={() => handleAddAngler(team.id)} style={S.btnSm(GREEN)}>Add</button>
                <button onClick={() => setAddingAngler(null)} style={S.btnSm('#f3f4f6','#374151')}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add team */}
      {addingTeam ? (
        <div style={{ ...S.card, borderLeft: `4px solid ${GREEN}` }}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: GREEN }}>New Team</div>
          <div style={{ ...S.grid2, marginBottom: '0.75rem' }}>
            <div>
              <label style={S.label}>Team Name *</label>
              <input style={S.input} placeholder='e.g. WPDSAA A'
                value={newTeam.team_name}
                onChange={e => setNewTeam(t => ({ ...t, team_name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddTeam()}
                autoFocus />
            </div>
            <div>
              <label style={S.label}>Province</label>
              <input style={S.input} placeholder='e.g. Western Province'
                value={newTeam.province}
                onChange={e => setNewTeam(t => ({ ...t, province: e.target.value }))} />
            </div>
          </div>
          <div style={S.row}>
            <button onClick={handleAddTeam} style={S.btn(GREEN)}>Add Team</button>
            <button onClick={() => setAddingTeam(false)} style={S.btn('#f3f4f6','#374151')}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingTeam(true)} style={{ ...S.btn(NAVY), marginTop: '0.25rem' }}>
          + Add Team
        </button>
      )}
    </div>
  )
}

// ─── ROLES TAB ────────────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: 'catch_recorder',              label: 'Official Catch Recorder' },
  { value: 'tournament_director',         label: 'Tournament Director' },
  { value: 'national_tournament_officer', label: 'National Tournament Officer' },
  { value: 'admin',                       label: 'System Administrator' },
  { value: 'observer',                    label: 'Observer' },
  { value: 'scorer',                      label: 'Scorer' },
  { value: 'read_only',                   label: 'Read Only' },
]

const ROLE_COLORS = {
  admin:                       '#dc2626',
  tournament_director:         '#7c3aed',
  national_tournament_officer: '#1d4ed8',
  catch_recorder:              '#065f46',
  scorer:                      '#1e3a8a',
  observer:                    '#6b7280',
  read_only:                   '#9ca3af',
}

// Derive a display name from email or full_name
function displayName(email, fullName) {
  if (fullName && fullName !== email) return fullName
  // Capitalise the part before the @ as a fallback
  const local = email.split('@')[0]
  return local.replace(/[._]/g, ' ').replace(/\w/g, c => c.toUpperCase())
}

function RolesTab({ competition }) {
  const [roles,    setRoles]   = useState([])
  const [names,    setNames]   = useState({})  // email → display name
  const [email,    setEmail]   = useState('')
  const [role,     setRole]    = useState('catch_recorder')
  const [loading,  setLoading] = useState(true)
  const [adding,   setAdding]  = useState(false)
  const [error,    setError]   = useState('')
  const [success,  setSuccess] = useState('')

  const load = useCallback(async () => {
    if (!competition?.id) return
    const { data } = await supabase
      .from('allcoastals_roles')
      .select('*')
      .eq('competition_id', competition.id)
      .order('created_at')
    const roleData = data || []
    setRoles(roleData)

    // Fetch display names for registered users
    const userIds = roleData.filter(r => r.user_id).map(r => r.user_id)
    if (userIds.length > 0) {
      const { data: userRows } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', userIds)
      const nameMap = {}
      ;(userRows || []).forEach(u => { nameMap[u.email] = u.full_name || u.email })
      setNames(nameMap)
    }
    setLoading(false)
  }, [competition?.id])

  useEffect(() => { load() }, [load])

  const handleGrant = async () => {
    if (!email) return
    setAdding(true); setError(''); setSuccess('')
    let userId = null
    const { data: userData } = await supabase
      .rpc('get_user_by_email', { email_input: email })
      .catch(() => ({ data: null }))
    userId = userData?.id
    const roleOption = ROLE_OPTIONS.find(o => o.value === role)
    const { error: err } = await supabase.from('allcoastals_roles').insert({
      user_id:        userId || null,
      email,
      role,
      role_title:     roleOption?.label || role,
      competition_id: competition.id,
    })
    if (err) { setError(err.message); setAdding(false); return }
    setSuccess(`✅ ${roleOption?.label} granted to ${email}`)
    setEmail(''); setAdding(false)
    load()
  }

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke this access?')) return
    await supabase.from('allcoastals_roles').delete().eq('id', id)
    load()
  }

  if (!competition?.id) return (
    <div style={{ color: GREY, fontStyle: 'italic' }}>Save the competition first to manage roles.</div>
  )

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 700, color: NAVY, marginBottom: '1rem' }}>Access & Roles</div>

      {/* Grant form — stacks vertically on mobile */}
      <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: 8, marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Grant Access</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <input style={S.input} type='email'
            placeholder='user@email.com'
            value={email} onChange={e => setEmail(e.target.value)} />
          <select style={S.select} value={role} onChange={e => setRole(e.target.value)}>
            {ROLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button onClick={handleGrant} disabled={adding || !email}
            style={{ ...S.btn(GREEN), opacity: adding || !email ? 0.5 : 1, width: '100%', padding: '0.65rem' }}>
            {adding ? 'Checking…' : '+ Grant Access'}
          </button>
        </div>
        {error   && <div style={{ color: RED,   marginTop: '0.5rem', fontSize: '0.85rem' }}>{error}</div>}
        {success && <div style={{ color: GREEN, marginTop: '0.5rem', fontSize: '0.85rem' }}>{success}</div>}
      </div>

      {/* Role list — card per person for mobile clarity */}
      {loading ? <div style={{ color: GREY }}>Loading…</div> : (
        roles.length === 0 ? (
          <div style={{ color: GREY, fontStyle: 'italic' }}>No roles assigned yet.</div>
        ) : (
          roles.map(r => {
            const name = displayName(r.email, names[r.email])
            const isEmail = name.toLowerCase() === r.email.toLowerCase()
            return (
              <div key={r.id} style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '0.75rem',
                marginBottom: '0.5rem',
                borderLeft: `4px solid ${ROLE_COLORS[r.role] || GREY}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Name */}
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>
                      {isEmail ? r.email.split('@')[0].replace(/[._]/g, ' ').replace(/\w/g, c => c.toUpperCase()) : name}
                    </div>
                    {/* Email */}
                    <div style={{ fontSize: '0.78rem', color: GREY, marginTop: 1, wordBreak: 'break-all' }}>
                      {r.email}
                    </div>
                    {/* Role badge */}
                    <div style={{ marginTop: '0.4rem' }}>
                      <span style={{
                        background: ROLE_COLORS[r.role] || GREY,
                        color: 'white',
                        padding: '0.15rem 0.6rem',
                        borderRadius: 20,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}>
                        {r.role_title || r.role}
                      </span>
                      {!r.user_id && (
                        <span style={{ fontSize: '0.72rem', color: GOLD, marginLeft: '0.5rem' }}>
                          ⏳ Pending registration
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleRevoke(r.id)}
                    style={{ ...S.btnSm('#fef2f2', RED), flexShrink: 0, alignSelf: 'center' }}>
                    Revoke
                  </button>
                </div>
              </div>
            )
          })
        )
      )}
    </div>
  )
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ competition, onEditSetup }) {
  if (!competition?.id) return (
    <div style={{ ...S.card, textAlign: 'center', padding: '3rem', color: GREY }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
      <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>No competition selected</div>
      <div style={{ marginBottom: '1rem' }}>Use the Setup tab to create a new competition.</div>
    </div>
  )

  const c = competition
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: NAVY }}>{c.name}</div>
          <div style={{ fontSize: '0.85rem', color: GREY, marginTop: 2 }}>
            {c.venue} {c.start_date && `· ${c.start_date}`} {c.end_date && `→ ${c.end_date}`}
          </div>
        </div>
        <button onClick={onEditSetup} style={S.btnSm(NAVY)}>✏️ Edit Setup</button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {c.discipline && <span style={S.badge(NAVY)}>{DISCIPLINE_LABELS[c.discipline] || c.discipline}</span>}
        {c.level      && <span style={S.badge(GREY)}>{LEVEL_LABELS[c.level] || c.level}</span>}
        {c.category   && <span style={S.badge(GREEN)}>{CATEGORY_LABELS[c.category] || c.category}</span>}
        {c.team_size  && <span style={S.badge(GOLD)}>Teams: {c.team_size} anglers</span>}
        <span style={S.badge(c.results_visible ? GREEN : RED)}>
          {c.results_visible ? '👁 Results visible' : '🔒 Results hidden'}
        </span>
      </div>

      <div style={{ ...S.grid2, fontSize: '0.85rem' }}>
        {[
          ['Tournament Director', c.td_name],
          ['Hosting Province',    c.hosting_province],
          ['Team Format',         c.team_format],
          ['Default Line Class',  c.default_line_class_kg ? `${c.default_line_class_kg}kg` : null],
          ['Fine Grid (SAN)',     c.fine_grid_number],
          ['Coarse Grid (SAN)',   c.coarse_grid_number],
          ['Catch & Release',     c.catch_release_enabled ? 'Enabled' : 'Disabled'],
          ['Competition ID',      c.id?.slice(0,8) + '…'],
        ].filter(([,v]) => v).map(([k,v]) => (
          <div key={k}>
            <span style={{ color: GREY }}>{k}: </span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      {c.description && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 6, fontSize: '0.85rem', color: '#374151' }}>
          {c.description}
        </div>
      )}
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CompetitionAdmin() {
  const { competitionId } = useParams()
  const navigate          = useNavigate()
  const { user }          = useAuth()
  const [competition, setCompetition] = useState(null)
  const [activeTab, setActiveTab]     = useState(competitionId ? 'overview' : 'setup')
  const [recentComps, setRecentComps] = useState([])
  const [showPicker, setShowPicker]   = useState(!competitionId)

  // Load competition if ID in URL
  useEffect(() => {
    if (!competitionId) return
    supabase.from('competitions').select('*').eq('id', competitionId)
      .then(({ data }) => { if (data?.[0]) setCompetition(data[0]) })
  }, [competitionId])

  // Load recent competitions for the picker
  useEffect(() => {
    supabase.from('competitions').select('id,name,discipline,level,start_date,status')
      .in('status', ['active','upcoming','registration_open','completed'])
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setRecentComps(data || []))
  }, [])

  const handleSaved = (comp) => {
    setCompetition(comp)
    setActiveTab('teams')
    navigate(`/competition-admin-v2/${comp.id}`, { replace: true })
    setShowPicker(false)
  }

  const TABS = [
    { id: 'overview',  label: '📋 Overview' },
    { id: 'setup',     label: '⚙️ Setup' },
    { id: 'teams',     label: '👥 Teams' },
    { id: 'roles',     label: '🔑 Roles' },
  ]

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ background: NAVY, color: 'white', padding: '1rem 1.5rem', borderRadius: 8, marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
              🏆 Competition Administration
            </div>
            <div style={{ fontSize: '0.82rem', opacity: 0.8, marginTop: 2 }}>
              {competition ? competition.name : 'RecFish ZA — Universal Admin Panel'}
            </div>
          </div>
          <div style={S.row}>
            <button onClick={() => setShowPicker(!showPicker)}
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
              {showPicker ? '✕ Close' : '📂 Open Competition'}
            </button>
            <button onClick={() => { setCompetition(null); setActiveTab('setup'); navigate('/competition-admin-v2'); setShowPicker(false) }}
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
              + New
            </button>
          </div>
        </div>
      </div>

      {/* Competition picker */}
      {showPicker && (
        <div style={{ ...S.card, borderLeft: `4px solid ${GOLD}` }}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Select a Competition</div>
          {recentComps.length === 0 ? (
            <div style={{ color: GREY, fontStyle: 'italic' }}>No competitions yet — use Setup to create one.</div>
          ) : (
            recentComps.map(c => (
              <div key={c.id}
                onClick={() => { navigate(`/competition-admin-v2/${c.id}`); setShowPicker(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: 6, cursor: 'pointer', marginBottom: '0.25rem', background: competition?.id === c.id ? '#eff6ff' : '#f9fafb' }}
                onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                onMouseLeave={e => e.currentTarget.style.background= competition?.id === c.id ? '#eff6ff' : '#f9fafb'}
              >
                <span style={{ fontWeight: 600, flex: 1 }}>{c.name}</span>
                {c.discipline && <span style={S.badge(NAVY)}>{c.discipline}</span>}
                {c.level      && <span style={S.badge(GREY)}>{c.level}</span>}
                {c.start_date && <span style={{ fontSize: '0.78rem', color: GREY }}>{c.start_date}</span>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={S.tab(activeTab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab competition={competition} onEditSetup={() => setActiveTab('setup')} />
      )}
      {activeTab === 'setup' && (
        <SetupTab competition={competition} onSaved={handleSaved} />
      )}
      {activeTab === 'teams' && (
        <TeamsTab competition={competition} />
      )}
      {activeTab === 'roles' && (
        <RolesTab competition={competition} />
      )}
    </div>
  )
}
