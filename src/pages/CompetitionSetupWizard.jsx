// ═══════════════════════════════════════════════════════════════════════════
// CompetitionSetupWizard.jsx — Guided, single-page competition setup
// Built for Tournament Directors (e.g. John Luef) who are new to RecFish ZA
// and need one place to set up an entire competition before fishing starts.
//
// All seven steps are reachable at any time from the sidebar — there is no
// hard gate forcing one step before another, since real tournament setup
// often gets information in a different order than the "ideal" sequence
// (e.g. the boat list confirmed before the final roster). The sidebar shows
// a status indicator per step so the TD always knows what's outstanding.
//
// Route: /setup-wizard
// Route with ID: /setup-wizard/:competitionId
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Date.toISOString() converts to UTC first — for anyone in a timezone
// ahead of UTC (South Africa is UTC+2), a Date built from local midnight
// lands on the PREVIOUS day once converted to UTC and sliced, silently
// shifting every computed date back by one. This formats from the Date
// object's own local getters instead, so "21 August" entered stays
// "21 August" saved, regardless of the browser's timezone.
function toLocalDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const NAVY  = '#1e3a8a'
const GOLD  = '#d97706'
const GREEN = '#16a34a'
const RED   = '#dc2626'
const GREY  = '#6b7280'

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

const BOAT_DRAW_MODES = [
  {
    value: 'fixed',
    label: 'Same boat, same team every day',
    description: 'Each team is assigned one boat for the whole competition. Every angler on that team fishes from that boat on every fishing day.',
  },
  {
    value: 'split_daily',
    label: 'Split teams across boats — changes daily',
    description: 'Anglers from the same team can be spread across different boats, and which boat each angler is on can change from day to day. Use this for a full split-boat draw.',
  },
  {
    value: 'team_rotates',
    label: 'Same team, different boat each day',
    description: 'The team stays together as a unit, but which boat the whole team fishes from changes from day to day (e.g. Team A on Boat X on Day 1, Boat Y on Day 2).',
  },
]

const STEPS = [
  { id: 'competition', label: 'Competition',        icon: '🏆' },
  { id: 'teams',       label: 'Teams & Anglers',    icon: '👥' },
  { id: 'boats',       label: 'Boats',              icon: '🚤' },
  { id: 'draw_mode',   label: 'Boat Draw Mode',     icon: '🔀' },
  { id: 'sessions',    label: 'Fishing Sessions',   icon: '📅' },
  { id: 'boat_draw',   label: 'Boat Draw',          icon: '🎯' },
  { id: 'review',      label: 'Review',             icon: '✅' },
]

// ─── STYLES — match CompetitionAdmin.jsx's existing visual language ─────────
const S = {
  page:    { maxWidth: 1100, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' },
  layout:  { display: 'flex', gap: '1.25rem', alignItems: 'flex-start' },
  sidebar: { width: 220, flexShrink: 0, position: 'sticky', top: '1rem' },
  main:    { flex: 1, minWidth: 0 },
  card:    { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', marginBottom: '1rem' },
  label:   { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  input:   { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' },
  select:  { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box' },
  btn:     (bg=NAVY, color='white') => ({ background: bg, color, border: 'none', padding: '0.55rem 1.1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }),
  btnSm:   (bg=NAVY, color='white') => ({ background: bg, color, border: 'none', padding: '0.35rem 0.75rem', borderRadius: 5, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }),
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  grid3:   { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' },
  row:     { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  badge:   (color) => ({ background: color, color: 'white', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }),
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function hoursBetween(linesIn, linesUp) {
  if (!linesIn || !linesUp) return ''
  const [h1, m1] = linesIn.split(':').map(Number)
  const [h2, m2] = linesUp.split(':').map(Number)
  if (Number.isNaN(h1) || Number.isNaN(h2)) return ''
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (mins <= 0) return ''
  return (mins / 60).toFixed(2)
}

// ─── STEP 1: COMPETITION ───────────────────────────────────────────────────────
// Creates/updates competition_days to match the competition's start_date +
// num_fishing_days — the Wizard never did this at all before, which is the
// root cause of the fishing_date/competition_day_id inconsistency found
// during East London 2026 (boat draws and fishing sessions had nothing
// real to link to). Also reusable any time the schedule changes later
// (e.g. a weather cancellation shifting dates) — call this again and the
// day rows just resync, instead of needing hand-written SQL each time.
//
// Existing days are updated in place (never deleted-and-recreated) so
// their id stays stable for anything already referencing competition_day_id.
// A day beyond the new num_fishing_days is only deleted if nothing's been
// logged against it yet — a day with real catches is left alone rather
// than silently destroyed by shortening the schedule.
async function syncCompetitionDays(competitionId, startDate, numDays) {
  if (!competitionId || !startDate || !numDays) return { error: null }

  const { data: existing, error: fetchErr } = await supabase
    .from('competition_days')
    .select('*')
    .eq('competition_id', competitionId)
  if (fetchErr) return { error: fetchErr }

  const targetDays = Array.from({ length: numDays }, (_, i) => {
    const d = new Date(startDate + 'T00:00:00')
    d.setDate(d.getDate() + i)
    return { day_number: i + 1, date: toLocalDateStr(d) }
  })
  const byDayNumber = Object.fromEntries((existing || []).map(d => [d.day_number, d]))

  for (const t of targetDays) {
    const cur = byDayNumber[t.day_number]
    if (!cur) {
      const { error } = await supabase.from('competition_days')
        .insert({ competition_id: competitionId, day_number: t.day_number, date: t.date })
      if (error) return { error }
    } else if (cur.date !== t.date) {
      const { error } = await supabase.from('competition_days')
        .update({ date: t.date }).eq('id', cur.id)
      if (error) return { error }
    }
  }

  const extraDays = (existing || []).filter(d => d.day_number > numDays)
  for (const d of extraDays) {
    const { count } = await supabase.from('competition_catches')
      .select('id', { count: 'exact', head: true }).eq('competition_day_id', d.id)
    if (!count) {
      await supabase.from('competition_days').delete().eq('id', d.id)
    }
    // else: real catches exist against this day — leave it, don't delete silently.
  }

  return { error: null }
}

// Turns a competition_templates row's scoring/species/team config into a
// short list of plain-English bullets — the "written explanation" that
// lets an organizer actually judge whether a past competition's scoring
// protocol matches what they need this time, instead of guessing from a
// name. Deliberately doesn't try to explain every field — just the ones
// that have actually turned out to matter (points-per-fish tiers, the
// over-line bonus, weight-formula species, skipper scoring) plus a clear
// note about what ISN'T decided at the template level (ladies division,
// exact bag limits per venue) so nobody assumes more than what's really here.
function describeTemplateConfig(tpl) {
  if (!tpl) return ['No scoring template linked to this competition — nothing to inherit.']

  const bullets = []
  const sc = tpl.scoring_config || {}
  const species = tpl.species_config?.eligible_species || []
  const team = tpl.team_config || {}

  bullets.push(`${tpl.discipline || 'Unknown discipline'}${tpl.level ? ` · ${tpl.level}` : ''}${tpl.category ? ` · ${tpl.category}` : ''}`)

  if (sc.method === 'points') {
    bullets.push('Scoring: points per fish (varies by species tier), plus a bonus for the first catch of each species')
  } else if (sc.method) {
    bullets.push(`Scoring method: ${sc.method}`)
  }
  if (sc.line_class_kg) bullets.push(`Line class: ${sc.line_class_kg}kg`)

  if (team.team_format === 'split_boat') {
    bullets.push(`Team format: boats rotate crews day to day (${team.team_size_min ?? tpl.team_size ?? '?'}-angler crews) — no fixed boat for the whole event`)
  } else if (tpl.team_format) {
    bullets.push(`Team format: ${tpl.team_format}`)
  }

  if (species.length) {
    const tiers = [...new Set(species.map(s => s.points_per_fish).filter(v => v != null))].sort((a, b) => a - b)
    bullets.push(`${species.length} species configured${tiers.length ? `, ${tiers.join('/')} points per fish depending on species` : ''}`)
    const weightFormulaSpecies = species.filter(s => s.over_line_bonus_type === 'weight_formula').map(s => s.name)
    if (weightFormulaSpecies.length) {
      bullets.push(`⚠ Variable (weight-calculated) over-line bonus for: ${weightFormulaSpecies.join(', ')} — not a flat bonus like the rest`)
    }
  }

  if (tpl.skipper_competition) {
    bullets.push(`Skipper standings: yes${tpl.skipper_scoring_method === 'average_gp' ? ', ranked by each boat\'s average points per angler per day (grand-prix style, not raw total)' : ''}`)
  }

  bullets.push("Not set at this level — decided later when teams are added: ladies' division split, exact team names/provinces")

  return bullets
}

function CompetitionStep({ competition, onSaved, recentComps, onPickExisting }) {
  const [federations, setFederations]   = useState([])
  const [associations, setAssociations] = useState([])
  const [templates, setTemplates]       = useState([])
  const [showPicker, setShowPicker]     = useState(!competition?.id)
  const [expandedCompId, setExpandedCompId] = useState(null)
  const [form, setForm] = useState({
    name: '', short_name: '', federation_id: '', association_id: '',
    template_id: '', discipline: '', level: '', category: 'open',
    venue: '', hosting_province: '', start_date: '', end_date: '',
    team_format: 'split_boat', team_size: 3, num_fishing_days: 3,
    default_line_class_kg: 6, results_visible: true,
    catch_release_enabled: false, description: '', td_name: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    if (competition) {
      setForm(f => ({ ...f,
        name: competition.name || '', short_name: competition.short_name || '',
        federation_id: competition.federation_id || '', association_id: competition.association_id || '',
        template_id: competition.template_id || '', discipline: competition.discipline || '',
        level: competition.level || '', category: competition.category || 'open',
        venue: competition.venue || '', hosting_province: competition.hosting_province || '',
        start_date: competition.start_date || '', end_date: competition.end_date || '',
        team_format: competition.team_format || 'split_boat', team_size: competition.team_size || 3,
        default_line_class_kg: competition.default_line_class_kg || 6,
        results_visible: competition.results_visible ?? true,
        catch_release_enabled: competition.catch_release_enabled ?? false,
        description: competition.description || '', td_name: competition.td_name || '',
        num_fishing_days: competition.num_fishing_days || 3,
      }))
    }
  }, [competition?.id, competition?.updated_at])

  useEffect(() => {
    supabase.from('federations').select('*').eq('status','active').order('short_name')
      .then(({ data }) => setFederations(data || []))
  }, [])

  useEffect(() => {
    if (!form.federation_id) { setAssociations([]); return }
    supabase.from('associations').select('*')
      .eq('federation_id', form.federation_id).eq('status','active').order('short_name')
      .then(({ data }) => setAssociations(data || []))
  }, [form.federation_id])

  useEffect(() => {
    if (!form.federation_id) { setTemplates([]); return }
    supabase.from('competition_templates').select('*')
      .eq('federation_id', form.federation_id).eq('is_active', true)
      .order('discipline').order('level').order('category')
      .then(({ data }) => setTemplates(data || []))
  }, [form.federation_id])

  const handleTemplateChange = (templateId) => {
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) { setForm(f => ({ ...f, template_id: templateId })); return }
    setForm(f => ({
      ...f, template_id: tpl.id, discipline: tpl.discipline, level: tpl.level || f.level,
      category: tpl.category, team_format: tpl.team_format, team_size: tpl.team_size,
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
      name: form.name, short_name: form.short_name || form.name.slice(0,20),
      federation_id: form.federation_id || null, association_id: form.association_id || null,
      template_id: form.template_id || null, discipline: form.discipline || null,
      level: form.level || null, category: form.category || 'open',
      venue: form.venue || null, hosting_province: form.hosting_province || null,
      start_date: form.start_date || null, end_date: form.end_date || null,
      team_format: form.team_format || null, team_size: parseInt(form.team_size) || 3,
      default_line_class_kg: parseInt(form.default_line_class_kg) || 6,
      results_visible: form.results_visible, catch_release_enabled: form.catch_release_enabled,
      description: form.description || null, td_name: form.td_name || null,
      scoring_method: competition?.scoring_method || 'bottomfish_percentage',
      status: 'active', updated_at: new Date().toISOString(),
    }
    if (form.num_fishing_days) payload.num_fishing_days = parseInt(form.num_fishing_days)

    let savedData, saveError
    if (competition?.id) {
      const { data, error } = await supabase.from('competitions').update(payload).eq('id', competition.id).select()
      saveError = error; savedData = data?.[0] || null
    } else {
      const { data, error } = await supabase.from('competitions').insert(payload).select()
      saveError = error; savedData = data?.[0] || null

      // A brand-new competition has no rows in competition_user_roles yet —
      // and every other table's RLS policy (teams, boats, sessions, etc.)
      // requires the acting user to already hold 'admin' or
      // 'tournament_director' on THIS competition_id. A direct client-side
      // insert into competition_user_roles can't satisfy this itself, since
      // that table has no INSERT policy at all (read-only to clients) — so
      // this calls a SECURITY DEFINER database function instead, which is
      // narrowly allowed to grant the FIRST role on a competition (and
      // permanently a no-op for that competition once any role exists).
      if (!saveError && savedData) {
        const { error: roleError } = await supabase.rpc('claim_first_competition_role', {
          p_competition_id: savedData.id,
        })
        if (roleError) {
          // Don't block the save over this — the competition row itself
          // saved fine — but surface it clearly, since silently failing
          // here just relocates today's exact bug to the next step.
          setError(`Competition saved, but couldn't grant yourself Tournament Director access automatically (${roleError.message}). You may need to be granted access manually before adding teams or boats.`)
        }
      }
    }
    if (saveError) { setError(saveError.message); setSaving(false); return }

    // Keep competition_days in sync with start_date/num_fishing_days —
    // creates them on first save, resyncs dates if the schedule changes
    // later. Doesn't block the save if this fails; the competition itself
    // is already saved, but the person needs to know days aren't right.
    if (savedData?.id && payload.start_date && payload.num_fishing_days) {
      const { error: daysError } = await syncCompetitionDays(savedData.id, payload.start_date, payload.num_fishing_days)
      if (daysError) {
        setError(`Competition saved, but fishing days couldn't be synced automatically (${daysError.message}). Boat draws and the catch logger depend on these — check with Malcolm before continuing.`)
        setSaving(false)
        return
      }
    }

    setSaving(false); setSaved(true)
    setTimeout(() => { setSaved(false); onSaved(savedData) }, 1800)
  }

  const selectedTpl = templates.find(t => t.id === form.template_id)

  // A "draft" is genuinely unfinished — never published, no status yet.
  // Everything else is done-and-dusted: reference material to start FROM,
  // never something to reopen and edit (that was the actual problem —
  // clicking a finished competition used to navigate straight into
  // editing its real, already-scored data).
  const drafts = recentComps.filter(c => c.status !== 'completed' && !c.results_published_at)
  const pastComps = recentComps.filter(c => c.status === 'completed' || c.results_published_at)

  const handleUseAsTemplate = (templateId) => {
    if (templateId) handleTemplateChange(templateId)
    setShowPicker(false)
  }

  return (
    <div>
      {showPicker && (
        <div style={{ ...S.card, borderLeft: `4px solid ${GOLD}` }}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>
            Start a new competition
          </div>

          {drafts.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                Continue a draft
              </div>
              {drafts.map(c => (
                <div key={c.id} onClick={() => { onPickExisting(c.id); setShowPicker(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: 6, cursor: 'pointer', marginBottom: '0.25rem', background: '#f9fafb' }}
                  onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                  onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}>
                  <span style={{ fontWeight: 600, flex: 1 }}>{c.name}</span>
                  {c.start_date && <span style={{ fontSize: '0.78rem', color: GREY }}>{c.start_date}</span>}
                </div>
              ))}
            </div>
          )}

          {pastComps.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                Or use a past competition as a starting point
              </div>
              <div style={{ fontSize: '0.8rem', color: GREY, marginBottom: '0.6rem' }}>
                These are finished — picking one never reopens or edits them. It just carries over the same scoring
                protocol into a brand-new competition, which you'll still name and configure yourself. Expand one to
                see exactly what that protocol is before deciding.
              </div>
              {pastComps.map(c => {
                const tpl = templates.find(t => t.id === c.template_id)
                const isExpanded = expandedCompId === c.id
                return (
                  <div key={c.id} style={{ borderRadius: 6, marginBottom: '0.4rem', background: '#f9fafb', overflow: 'hidden' }}>
                    <div onClick={() => setExpandedCompId(isExpanded ? null : c.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <span style={{ color: GREY, fontSize: '0.75rem', width: 14 }}>{isExpanded ? '▾' : '▸'}</span>
                      <span style={{ fontWeight: 600, flex: 1 }}>{c.name}</span>
                      {c.start_date && <span style={{ fontSize: '0.78rem', color: GREY }}>{c.start_date}</span>}
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '0 0.75rem 0.75rem 2.3rem' }}>
                        <ul style={{ margin: '0 0 0.6rem', paddingLeft: '1rem', fontSize: '0.82rem', color: '#374151' }}>
                          {describeTemplateConfig(tpl).map((b, i) => <li key={i} style={{ marginBottom: '0.2rem' }}>{b}</li>)}
                        </ul>
                        <button onClick={() => handleUseAsTemplate(c.template_id)} style={{ ...S.btn(GREEN), fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}>
                          Use this scoring protocol as a starting point
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <button onClick={() => setShowPicker(false)} style={S.btn(GREY)}>Start from scratch instead</button>
        </div>
      )}

      {!showPicker && (
        <>
          <div style={S.card}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: '1rem' }}>1 — Organisation</div>
            <div style={S.grid2}>
              <div>
                <label style={S.label}>Federation *</label>
                <select style={S.select} value={form.federation_id} onChange={e => set('federation_id', e.target.value)}>
                  <option value=''>Select federation…</option>
                  {federations.map(f => <option key={f.id} value={f.id}>{f.short_name} — {f.name}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Hosting Association</label>
                <select style={S.select} value={form.association_id} onChange={e => set('association_id', e.target.value)} disabled={!form.federation_id}>
                  <option value=''>Select association…</option>
                  {associations.map(a => <option key={a.id} value={a.id}>{a.short_name} — {a.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: '1rem' }}>2 — Competition Template</div>
            <label style={S.label}>Template (fills in the scoring rules and format for you)</label>
            <select style={S.select} value={form.template_id} onChange={e => handleTemplateChange(e.target.value)} disabled={!form.federation_id}>
              <option value=''>Select template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {!form.federation_id && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: GREY, fontStyle: 'italic' }}>
                Choose a federation above first to see its templates.
              </div>
            )}
            {selectedTpl && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#eff6ff', borderRadius: 6, fontSize: '0.85rem' }}>
                <div style={S.row}>
                  <span style={S.badge(NAVY)}>{DISCIPLINE_LABELS[selectedTpl.discipline] || selectedTpl.discipline}</span>
                  <span style={S.badge(GOLD)}>Team: {selectedTpl.team_size} anglers</span>
                </div>
                {selectedTpl.description && <div style={{ marginTop: '0.5rem', color: '#374151' }}>{selectedTpl.description}</div>}
              </div>
            )}
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: '1rem' }}>3 — Competition Details</div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={S.label}>Competition Name *</label>
              <input style={S.input} value={form.name} onChange={e => set('name', e.target.value)}
                placeholder='e.g. SADSAA Junior Bottomfish Interprovincial 2026' />
            </div>
            <div style={{ ...S.grid2, marginBottom: '0.75rem' }}>
              <div>
                <label style={S.label}>Tournament Director</label>
                <input style={S.input} value={form.td_name} onChange={e => set('td_name', e.target.value)} placeholder='Full name' />
              </div>
              <div>
                <label style={S.label}>Venue</label>
                <input style={S.input} value={form.venue} onChange={e => set('venue', e.target.value)} placeholder='e.g. Port Alfred' />
              </div>
            </div>
            <div style={{ ...S.grid3, marginBottom: '0.75rem' }}>
              <div>
                <label style={S.label}>Start Date *</label>
                <input style={S.input} type='date' value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </div>
              <div>
                <label style={S.label}>End Date</label>
                <input style={S.input} type='date' value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Fishing Days</label>
                <input style={S.input} type='number' min='1' max='10' value={form.num_fishing_days} onChange={e => set('num_fishing_days', e.target.value)} />
              </div>
            </div>
            <div style={{ ...S.grid2, marginBottom: '0.75rem' }}>
              <div>
                <label style={S.label}>Team Size (anglers)</label>
                <input style={S.input} type='number' min='1' max='6' value={form.team_size} onChange={e => set('team_size', e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Default Line Class (kg)</label>
                <select style={S.select} value={form.default_line_class_kg} onChange={e => set('default_line_class_kg', e.target.value)}>
                  {[6,8,10,15,24,37].map(lc => <option key={lc} value={lc}>{lc}kg</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={S.label}>Notes</label>
              <textarea style={{ ...S.input, resize: 'vertical' }} rows={2} value={form.description}
                onChange={e => set('description', e.target.value)} placeholder='Anything worth noting about this event…' />
            </div>
          </div>

          {error && <div style={{ background: '#fef2f2', color: RED, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem' }}>{error}</div>}
          {saved && <div style={{ background: '#f0fdf4', color: GREEN, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem', fontWeight: 600 }}>✅ Saved — next, add your teams and anglers.</div>}
          <button onClick={handleSave} disabled={saving} style={{ ...S.btn(), padding: '0.75rem 2rem', fontSize: '1rem', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : competition?.id ? '💾 Save Changes' : '🚀 Create Competition'}
          </button>
        </>
      )}
    </div>
  )
}

// ─── STEP 2: TEAMS & ANGLERS ────────────────────────────────────────────────────
function TeamsStep({ competition }) {
  const [teams, setTeams] = useState([])
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTeam, setNewTeam] = useState({ team_name: '', province: '' })
  const [newAngler, setNewAngler] = useState({ full_name: '', is_captain: false })
  const [addingTeam, setAddingTeam] = useState(false)
  const [addingAngler, setAddingAngler] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!competition?.id) return
    setLoading(true)
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('competition_teams').select('*').eq('competition_id', competition.id).order('team_name'),
      supabase.from('competition_participants').select('*').eq('competition_id', competition.id).order('full_name'),
    ])
    setTeams(t || []); setParticipants(p || []); setLoading(false)
  }, [competition?.id])

  useEffect(() => { load() }, [load])

  const handleAddTeam = async () => {
    if (!newTeam.team_name) return
    const { error: err } = await supabase.from('competition_teams').insert({
      competition_id: competition.id, team_name: newTeam.team_name, province: newTeam.province || null,
    })
    if (err) { setError(err.message); return }
    setNewTeam({ team_name: '', province: '' }); setAddingTeam(false); load()
  }

  const handleAddAngler = async (teamId) => {
    if (!newAngler.full_name) return
    const { error: err } = await supabase.from('competition_participants').insert({
      competition_id: competition.id, team_id: teamId, full_name: newAngler.full_name,
      is_captain: newAngler.is_captain, status: 'confirmed',
    })
    if (err) { setError(err.message); return }
    setNewAngler({ full_name: '', is_captain: false }); setAddingAngler(null); load()
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
    await supabase.from('competition_participants').update({ is_captain: false }).eq('team_id', teamId)
    await supabase.from('competition_participants').update({ is_captain: true }).eq('id', participantId)
    load()
  }

  if (!competition?.id) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      Set up the competition on the first step before adding teams.
    </div>
  )
  if (loading) return <div style={{ color: GREY }}>Loading…</div>

  const teamAnglers = (teamId) => participants.filter(p => p.team_id === teamId)

  return (
    <div>
      <div style={{ ...S.card, background: '#eff6ff' }}>
        <div style={S.row}>
          {[
            { label: 'Teams', val: teams.length },
            { label: 'Anglers', val: participants.length },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', minWidth: 70 }}>
              <div style={{ fontWeight: 800, fontSize: '1.4rem', color: NAVY }}>{s.val}</div>
              <div style={{ fontSize: '0.72rem', color: GREY }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', color: RED, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem' }}>{error}</div>}

      {teams.map(team => (
        <div key={team.id} style={{ ...S.card, borderLeft: `4px solid ${NAVY}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: NAVY }}>{team.team_name}</span>
              {team.province && <span style={{ fontSize: '0.8rem', color: GREY, marginLeft: 8 }}>{team.province}</span>}
            </div>
            <div style={S.row}>
              <button onClick={() => setAddingAngler(team.id)} style={S.btnSm(GREEN)}>+ Angler</button>
              <button onClick={() => handleDeleteTeam(team.id)} style={S.btnSm('#f3f4f6','#374151')}>🗑</button>
            </div>
          </div>

          {teamAnglers(team.id).length === 0 ? (
            <div style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem' }}>No anglers yet</div>
          ) : (
            teamAnglers(team.id).sort((a,b) => (b.is_captain?1:0)-(a.is_captain?1:0)).map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ minWidth: 20 }}>{p.is_captain ? '⚓' : ''}</span>
                <span style={{ flex: 1, fontWeight: p.is_captain ? 700 : 400 }}>{p.full_name}</span>
                {!p.is_captain && <button onClick={() => handleSetCaptain(p.id, team.id)} style={S.btnSm('#f3f4f6','#374151')} title='Set as captain'>⚓</button>}
                <button onClick={() => handleDeleteAngler(p.id)} style={S.btnSm('#f3f4f6','#374151')}>✕</button>
              </div>
            ))
          )}

          {addingAngler === team.id && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 6 }}>
              <div style={S.row}>
                <input style={{ ...S.input, flex: 1 }} placeholder='Angler full name' value={newAngler.full_name}
                  onChange={e => setNewAngler(a => ({ ...a, full_name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddAngler(team.id)} autoFocus />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  <input type='checkbox' checked={newAngler.is_captain} onChange={e => setNewAngler(a => ({ ...a, is_captain: e.target.checked }))} />
                  Captain
                </label>
                <button onClick={() => handleAddAngler(team.id)} style={S.btnSm(GREEN)}>Add</button>
                <button onClick={() => setAddingAngler(null)} style={S.btnSm('#f3f4f6','#374151')}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {addingTeam ? (
        <div style={{ ...S.card, borderLeft: `4px solid ${GREEN}` }}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: GREEN }}>New Team</div>
          <div style={{ ...S.grid2, marginBottom: '0.75rem' }}>
            <div>
              <label style={S.label}>Team Name *</label>
              <input style={S.input} placeholder='e.g. Eastern Province' value={newTeam.team_name}
                onChange={e => setNewTeam(t => ({ ...t, team_name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddTeam()} autoFocus />
            </div>
            <div>
              <label style={S.label}>Province</label>
              <input style={S.input} placeholder='optional' value={newTeam.province}
                onChange={e => setNewTeam(t => ({ ...t, province: e.target.value }))} />
            </div>
          </div>
          <div style={S.row}>
            <button onClick={handleAddTeam} style={S.btn(GREEN)}>Add Team</button>
            <button onClick={() => setAddingTeam(false)} style={S.btn('#f3f4f6','#374151')}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingTeam(true)} style={{ ...S.btn(NAVY), marginTop: '0.25rem' }}>+ Add Team</button>
      )}
    </div>
  )
}

// ─── STEP 3: BOATS — name and skipper only, kept deliberately simple ──────────
function BoatsStep({ competition }) {
  const [boats, setBoats] = useState([])
  const [loading, setLoading] = useState(true)
  const [newBoat, setNewBoat] = useState({ boat_name: '', skipper_name: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!competition?.id) return
    setLoading(true)
    const { data } = await supabase.from('competition_boats').select('*').eq('competition_id', competition.id).order('boat_name')
    setBoats(data || []); setLoading(false)
  }, [competition?.id])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newBoat.boat_name || !newBoat.skipper_name) {
      setError('Both boat name and skipper name are needed.')
      return
    }
    const { error: err } = await supabase.from('competition_boats').insert({
      competition_id: competition.id, boat_name: newBoat.boat_name, skipper_name: newBoat.skipper_name,
    })
    if (err) { setError(err.message); return }
    setError(''); setNewBoat({ boat_name: '', skipper_name: '' }); setAdding(false); load()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this boat?')) return
    await supabase.from('competition_boats').delete().eq('id', id)
    load()
  }

  if (!competition?.id) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      Set up the competition on the first step before adding boats.
    </div>
  )
  if (loading) return <div style={{ color: GREY }}>Loading…</div>

  return (
    <div>
      <div style={S.card}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Boats fishing this competition</div>
        <div style={{ fontSize: '0.85rem', color: GREY, marginBottom: '1rem' }}>
          Just the boat name and skipper for each boat — that's all that's needed here.
        </div>

        {error && <div style={{ background: '#fef2f2', color: RED, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem' }}>{error}</div>}

        {boats.length === 0 && !adding && (
          <div style={{ color: GREY, fontStyle: 'italic', marginBottom: '0.75rem' }}>No boats added yet.</div>
        )}

        {boats.map(b => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontWeight: 700, flex: 1 }}>{b.boat_name}</span>
            <span style={{ color: GREY }}>{b.skipper_name}</span>
            <button onClick={() => handleDelete(b.id)} style={S.btnSm('#f3f4f6','#374151')}>✕</button>
          </div>
        ))}

        {adding ? (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 6 }}>
            <div style={{ ...S.grid2, marginBottom: '0.75rem' }}>
              <div>
                <label style={S.label}>Boat Name *</label>
                <input style={S.input} placeholder='e.g. Sea Hawk' value={newBoat.boat_name}
                  onChange={e => setNewBoat(b => ({ ...b, boat_name: e.target.value }))} autoFocus />
              </div>
              <div>
                <label style={S.label}>Skipper Name *</label>
                <input style={S.input} placeholder='Full name' value={newBoat.skipper_name}
                  onChange={e => setNewBoat(b => ({ ...b, skipper_name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()} />
              </div>
            </div>
            <div style={S.row}>
              <button onClick={handleAdd} style={S.btn(GREEN)}>Add Boat</button>
              <button onClick={() => { setAdding(false); setError('') }} style={S.btn('#f3f4f6','#374151')}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ ...S.btn(NAVY), marginTop: '0.5rem' }}>+ Add Boat</button>
        )}
      </div>
    </div>
  )
}

// ─── STEP 4: BOAT DRAW MODE ─────────────────────────────────────────────────────
function BoatDrawModeStep({ competition, onSaved }) {
  const [mode, setMode] = useState(competition?.boat_draw_mode || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setMode(competition?.boat_draw_mode || '') }, [competition?.id, competition?.boat_draw_mode])

  if (!competition?.id) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      Set up the competition on the first step before choosing a boat draw mode.
    </div>
  )

  const handleSave = async (val) => {
    setMode(val); setSaving(true)
    const { data, error } = await supabase.from('competitions').update({ boat_draw_mode: val }).eq('id', competition.id).select()
    setSaving(false)
    if (!error && data?.[0]) { setSaved(true); onSaved(data[0]); setTimeout(() => setSaved(false), 1500) }
  }

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>How does this competition assign anglers to boats?</div>
      <div style={{ fontSize: '0.85rem', color: GREY, marginBottom: '1rem' }}>
        This decides how the Boat Draw step (later) will be laid out — pick whichever matches how this event is actually run.
      </div>

      {BOAT_DRAW_MODES.map(m => (
        <label key={m.value} style={{
          display: 'block', padding: '0.85rem 1rem', borderRadius: 8, marginBottom: '0.6rem',
          border: `2px solid ${mode === m.value ? NAVY : '#e5e7eb'}`,
          background: mode === m.value ? '#eff6ff' : 'white', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <input type='radio' name='draw_mode' checked={mode === m.value}
              onChange={() => handleSave(m.value)} style={{ marginTop: 4 }} />
            <div>
              <div style={{ fontWeight: 700, color: '#111827' }}>{m.label}</div>
              <div style={{ fontSize: '0.83rem', color: GREY, marginTop: 2 }}>{m.description}</div>
            </div>
          </div>
        </label>
      ))}

      {saving && <div style={{ fontSize: '0.82rem', color: GREY, marginTop: '0.5rem' }}>Saving…</div>}
      {saved && <div style={{ fontSize: '0.82rem', color: GREEN, marginTop: '0.5rem', fontWeight: 600 }}>✅ Saved</div>}
    </div>
  )
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ activeStep, setActiveStep, status }) {
  return (
    <div style={S.sidebar}>
      <div style={S.card}>
        {STEPS.map(step => {
          const st = status[step.id] // 'empty' | 'partial' | 'done'
          const dot = st === 'done' ? '✅' : st === 'partial' ? '🟡' : '⚪'
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%',
                textAlign: 'left', padding: '0.55rem 0.6rem', borderRadius: 6,
                border: 'none', cursor: 'pointer', marginBottom: 2,
                background: activeStep === step.id ? '#eff6ff' : 'transparent',
                color: activeStep === step.id ? NAVY : '#374151',
                fontWeight: activeStep === step.id ? 700 : 500,
                fontSize: '0.85rem',
              }}
            >
              <span>{step.icon}</span>
              <span style={{ flex: 1 }}>{step.label}</span>
              <span style={{ fontSize: '0.7rem' }}>{dot}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── STEP 5: FISHING SESSIONS ───────────────────────────────────────────────────
// ─── STEP 5: FISHING SESSIONS ───────────────────────────────────────────────────
// One row per BOAT per fishing day — matching the real schema (boat_name is
// NOT NULL, with a unique constraint on competition_id+day_number+boat_name).
// A first version of this step incorrectly assumed one row per day overall;
// fixed after checking the schema directly rather than guessing from memory.
function SessionsStep({ competition }) {
  const [boats, setBoats] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(null) // day number currently saving, or null
  const [savedDay, setSavedDay] = useState(null) // day number just successfully saved, briefly shown

  const numDays = competition?.num_fishing_days || 0
  const startDate = competition?.start_date
  const days = Array.from({ length: numDays }, (_, i) => i + 1)

  const load = useCallback(async () => {
    if (!competition?.id) return
    setLoading(true)
    const [{ data: b }, { data: s }] = await Promise.all([
      supabase.from('competition_boats').select('*').eq('competition_id', competition.id).order('boat_name'),
      supabase.from('competition_fishing_sessions').select('*').eq('competition_id', competition.id),
    ])
    setBoats(b || []); setSessions(s || []); setLoading(false)
  }, [competition?.id])

  useEffect(() => { load() }, [load])

  const dateForDay = (dayNum) => {
    if (!startDate) return ''
    const d = new Date(startDate + 'T00:00:00')
    d.setDate(d.getDate() + (dayNum - 1))
    return toLocalDateStr(d)
  }

  // Local, editable copy of each boat/day's session — seeded from whatever's
  // already saved, or sensible blank defaults if this boat/day combination
  // has never been saved before.
  const [draft, setDraft] = useState({})
  const keyOf = (dayNum, boatName) => `${dayNum}|${boatName}`

  const rowFor = (dayNum, boat) => {
    const key = keyOf(dayNum, boat.boat_name)
    if (draft[key]) return draft[key]
    const existing = sessions.find(s => s.day_number === dayNum && s.boat_name === boat.boat_name)
    return existing || {
      day_number: dayNum, boat_name: boat.boat_name, skipper_name: boat.skipper_name,
      lines_in: '', lines_up: '', day_cancelled: false, cancellation_reason: '',
    }
  }

  const updateRow = (dayNum, boat, patch) => {
    const key = keyOf(dayNum, boat.boat_name)
    setDraft(prev => ({ ...prev, [key]: { ...rowFor(dayNum, boat), ...patch } }))
  }

  const handleSaveDay = async (dayNum) => {
    setSaving(dayNum); setSavedDay(null)
    let firstError = null
    // Sequential, not parallel — same discipline as the boat draw fix earlier
    // today: each save re-checks "does this boat/day row already exist"
    // against `sessions` state, so racing writes for the same day could read
    // stale data and double-insert. One day's worth of boats is a small loop.
    for (const boat of boats) {
      const row = rowFor(dayNum, boat)
      const fishing_hours = hoursBetween(row.lines_in, row.lines_up) || null
      const payload = {
        competition_id: competition.id, day_number: dayNum, boat_name: boat.boat_name,
        skipper_name: boat.skipper_name, lines_in: row.lines_in || null, lines_up: row.lines_up || null,
        fishing_hours, day_cancelled: !!row.day_cancelled, cancellation_reason: row.cancellation_reason || null,
      }
      const existing = sessions.find(s => s.day_number === dayNum && s.boat_name === boat.boat_name)
      const { error: err } = existing
        ? await supabase.from('competition_fishing_sessions').update(payload).eq('id', existing.id)
        : await supabase.from('competition_fishing_sessions').insert(payload)
      if (err && !firstError) firstError = err
    }
    setSaving(null)
    if (firstError) { setError(firstError.message); return }
    setError(''); await load(); setSavedDay(dayNum)
    setTimeout(() => setSavedDay(d => d === dayNum ? null : d), 2500)
  }

  if (!competition?.id) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      Set up the competition on the first step before defining fishing sessions.
    </div>
  )
  if (!numDays) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      Set the number of fishing days on the Competition step first.
    </div>
  )
  if (loading) return <div style={{ color: GREY }}>Loading…</div>
  if (boats.length === 0) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      Add boats on the Boats step first — each fishing day is recorded per boat.
    </div>
  )

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>Fishing Sessions</div>
      <div style={{ fontSize: '0.85rem', color: GREY, marginBottom: '1rem' }}>
        One entry per boat, per fishing day. Hours fished are worked out automatically from lines-in
        and lines-up. If a boat didn't fish on a particular day (e.g. bad weather, mechanical issue),
        tick "cancelled" and add a short reason — that boat's hours that day won't count toward
        anyone's catch-per-hour figures.
      </div>

      {error && <div style={{ background: '#fef2f2', color: RED, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem' }}>{error}</div>}

      {days.map(dayNum => (
        <div key={dayNum} style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
            <div style={{ fontWeight: 700, color: NAVY }}>
              Day {dayNum} {startDate && <span style={{ color: GREY, fontWeight: 400, fontSize: '0.85rem' }}>— {dateForDay(dayNum)}</span>}
            </div>
            <button onClick={() => handleSaveDay(dayNum)} style={{ ...S.btnSm(GREEN), opacity: saving === dayNum ? 0.6 : 1 }} disabled={saving === dayNum}>
              {saving === dayNum ? 'Saving…' : `💾 Save Day ${dayNum}`}
            </button>
            {savedDay === dayNum && (
              <span style={{ color: GREEN, fontWeight: 600, fontSize: '0.85rem' }}>✅ Day {dayNum} saved</span>
            )}
          </div>
          {boats.map(boat => {
            const row = rowFor(dayNum, boat)
            const hours = hoursBetween(row.lines_in, row.lines_up)
            return (
              <div key={boat.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>
                  {boat.boat_name} <span style={{ color: GREY, fontWeight: 400 }}>— {boat.skipper_name}</span>
                </div>
                <div style={S.grid2}>
                  <div>
                    <label style={S.label}>Lines In</label>
                    <input style={S.input} type='time' value={row.lines_in || ''}
                      onChange={e => updateRow(dayNum, boat, { lines_in: e.target.value })} disabled={row.day_cancelled} />
                  </div>
                  <div>
                    <label style={S.label}>Lines Up</label>
                    <input style={S.input} type='time' value={row.lines_up || ''}
                      onChange={e => updateRow(dayNum, boat, { lines_up: e.target.value })} disabled={row.day_cancelled} />
                  </div>
                </div>
                <div style={{ ...S.row, marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type='checkbox' checked={!!row.day_cancelled}
                      onChange={e => updateRow(dayNum, boat, { day_cancelled: e.target.checked })} />
                    <span style={{ fontSize: '0.85rem' }}>Didn't fish this day</span>
                  </label>
                  {row.day_cancelled && (
                    <input style={{ ...S.input, flex: 1, maxWidth: 280 }} placeholder='Reason (e.g. bad weather)'
                      value={row.cancellation_reason || ''} onChange={e => updateRow(dayNum, boat, { cancellation_reason: e.target.value })} />
                  )}
                  {!row.day_cancelled && hours && (
                    <span style={{ fontSize: '0.82rem', color: GREY }}>{hours} hours fished</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── STEP 6: BOAT DRAW — layout depends on the mode chosen in Step 4 ──────────
function BoatDrawStep({ competition }) {
  const [boats, setBoats] = useState([])
  const [teams, setTeams] = useState([])
  const [participants, setParticipants] = useState([])
  const [draws, setDraws] = useState([])
  const [compDays, setCompDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const mode = competition?.boat_draw_mode
  const numDays = competition?.num_fishing_days || 0
  const days = Array.from({ length: numDays }, (_, i) => i + 1)

  const load = useCallback(async () => {
    if (!competition?.id) return
    setLoading(true)
    const [{ data: b }, { data: t }, { data: p }, { data: d }, { data: cd }] = await Promise.all([
      supabase.from('competition_boats').select('*').eq('competition_id', competition.id).order('boat_name'),
      supabase.from('competition_teams').select('*').eq('competition_id', competition.id).order('team_name'),
      supabase.from('competition_participants').select('*').eq('competition_id', competition.id).order('full_name'),
      supabase.from('competition_boat_draws').select('*').eq('competition_id', competition.id),
      supabase.from('competition_days').select('*').eq('competition_id', competition.id).order('day_number'),
    ])
    setBoats(b || []); setTeams(t || []); setParticipants(p || []); setDraws(d || []); setCompDays(cd || [])
    setLoading(false)
  }, [competition?.id])

  useEffect(() => { load() }, [load])

  if (!competition?.id) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      Set up the competition on the first step before doing the boat draw.
    </div>
  )
  if (!mode) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      Choose a boat draw mode on the previous step first — the layout here depends on it.
    </div>
  )
  if (boats.length === 0) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      Add at least one boat on the Boats step before doing the draw.
    </div>
  )
  if (participants.length === 0) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      Add anglers on the Teams &amp; Anglers step before doing the draw.
    </div>
  )
  if (loading) return <div style={{ color: GREY }}>Loading…</div>
  if (compDays.length === 0) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      No fishing days found for this competition yet — go back to the first
      step and re-save the competition (with a start date and number of
      fishing days set) to create them, then come back here.
    </div>
  )

  // dayByNumber uses the REAL competition_days rows (created/synced when the
  // Competition step is saved — see syncCompetitionDays above), not a
  // client-computed guess. This is what actually fixes the fishing_date/
  // competition_day_id inconsistency found during East London 2026: both
  // columns get written together, from the same source of truth, every time.
  const dayByNumber = Object.fromEntries(compDays.map(d => [d.day_number, d]))

  const findDraw = (participantId, dayNum) => {
    const day = dayByNumber[dayNum]
    if (!day) return null
    return draws.find(d => d.participant_id === participantId && d.competition_day_id === day.id)
  }

  const saveDraw = async (participantId, dayNum, boatId) => {
    const day = dayByNumber[dayNum]
    if (!day) return
    setSaving(true)
    const existing = findDraw(participantId, dayNum)
    const payload = {
      competition_id: competition.id, participant_id: participantId,
      boat_id: boatId || null, competition_day_id: day.id, fishing_date: day.date,
    }
    const { error: err } = existing
      ? await supabase.from('competition_boat_draws').update(payload).eq('id', existing.id)
      : await supabase.from('competition_boat_draws').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setError(''); load()
  }

  // Writes one team's boat for one day. Does NOT reload state itself —
  // callers that save multiple days in a row (the 'fixed' mode dropdown)
  // should await each call in sequence and reload once at the end, rather
  // than each call reloading independently and showing flickering,
  // partially-saved intermediate state.
  const saveTeamDrawRaw = async (teamId, dayNum, boatId) => {
    const day = dayByNumber[dayNum]
    if (!day) return
    const teamAnglers = participants.filter(p => p.team_id === teamId)
    for (const p of teamAnglers) {
      const existing = findDraw(p.id, dayNum)
      const payload = { competition_id: competition.id, participant_id: p.id, boat_id: boatId || null, competition_day_id: day.id, fishing_date: day.date }
      if (existing) await supabase.from('competition_boat_draws').update(payload).eq('id', existing.id)
      else await supabase.from('competition_boat_draws').insert(payload)
    }
  }

  const saveTeamDraw = async (teamId, dayNum, boatId) => {
    setSaving(true)
    await saveTeamDrawRaw(teamId, dayNum, boatId)
    setSaving(false)
    load()
  }

  const boatOptions = (
    <>
      <option value=''>Select boat…</option>
      {boats.map(b => <option key={b.id} value={b.id}>{b.boat_name} ({b.skipper_name})</option>)}
    </>
  )

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>Boat Draw</div>
      <div style={{ fontSize: '0.85rem', color: GREY, marginBottom: '1rem' }}>
        {BOAT_DRAW_MODES.find(m => m.value === mode)?.description}
      </div>
      {error && <div style={{ background: '#fef2f2', color: RED, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem' }}>{error}</div>}
      {saving && <div style={{ fontSize: '0.8rem', color: GREY, marginBottom: '0.5rem' }}>Saving…</div>}

      {mode === 'fixed' && (
        <div>
          <div style={{ fontSize: '0.82rem', color: GREY, marginBottom: '0.75rem' }}>One boat per team, applied to every fishing day automatically.</div>
          {teams.map(team => {
            const existing = findDraw(participants.find(p => p.team_id === team.id)?.id, days[0])
            const teamHasAnglers = participants.some(p => p.team_id === team.id)
            return (
              <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ fontWeight: 700, flex: 1 }}>{team.team_name}</span>
                {!teamHasAnglers ? (
                  <span style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem' }}>Add an angler to this team first</span>
                ) : (
                <select style={{ ...S.select, maxWidth: 280 }} value={existing?.boat_id || ''}
                  onChange={async e => {
                    const boatId = e.target.value
                    setSaving(true)
                    // Sequential — each day's findDraw() check still reads the
                    // same in-memory `draws` snapshot until we reload at the
                    // end, but since this is a brand-new boat assignment for
                    // every day at once, every day is an INSERT regardless of
                    // order, so this is safe even without an interim reload.
                    for (const d of days) {
                      await saveTeamDrawRaw(team.id, d, boatId)
                    }
                    setSaving(false)
                    load()
                  }}>
                  {boatOptions}
                </select>
                )}
              </div>
            )
          })}
        </div>
      )}

      {mode === 'team_rotates' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Team</th>
                {days.map(d => <th key={d} style={{ textAlign: 'left', padding: '0.5rem' }}>Day {d}{dayByNumber[d]?.date ? <div style={{ fontWeight: 400, fontSize: '0.72rem', color: '#6b7280' }}>{dayByNumber[d].date}</div> : null}</th>)}
              </tr>
            </thead>
            <tbody>
              {teams.map(team => {
                const teamHasAnglers = participants.some(p => p.team_id === team.id)
                return (
                <tr key={team.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 700 }}>{team.team_name}</td>
                  {!teamHasAnglers ? (
                    <td colSpan={days.length} style={{ padding: '0.5rem', color: GREY, fontStyle: 'italic' }}>
                      Add at least one angler to this team on the Teams &amp; Anglers step first.
                    </td>
                  ) : days.map(d => {
                    const existing = findDraw(participants.find(p => p.team_id === team.id)?.id, d)
                    return (
                      <td key={d} style={{ padding: '0.4rem' }}>
                        <select style={S.select} value={existing?.boat_id || ''}
                          onChange={e => saveTeamDraw(team.id, d, e.target.value)}>
                          {boatOptions}
                        </select>
                      </td>
                    )
                  })}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'split_daily' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Angler</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Team</th>
                {days.map(d => <th key={d} style={{ textAlign: 'left', padding: '0.5rem' }}>Day {d}{dayByNumber[d]?.date ? <div style={{ fontWeight: 400, fontSize: '0.72rem', color: '#6b7280' }}>{dayByNumber[d].date}</div> : null}</th>)}
              </tr>
            </thead>
            <tbody>
              {participants.map(p => {
                const teamName = teams.find(t => t.id === p.team_id)?.team_name || '—'
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.5rem', fontWeight: 700 }}>{p.full_name}</td>
                    <td style={{ padding: '0.5rem', color: GREY }}>{teamName}</td>
                    {days.map(d => {
                      const existing = findDraw(p.id, d)
                      return (
                        <td key={d} style={{ padding: '0.4rem' }}>
                          <select style={S.select} value={existing?.boat_id || ''}
                            onChange={e => saveDraw(p.id, d, e.target.value)}>
                            {boatOptions}
                          </select>
                        </td>
                      )
                    })}
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

// ─── STEP 7: REVIEW ─────────────────────────────────────────────────────────────
function ReviewStep({ competition }) {
  const [teams, setTeams] = useState([])
  const [participants, setParticipants] = useState([])
  const [boats, setBoats] = useState([])
  const [sessions, setSessions] = useState([])
  const [draws, setDraws] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!competition?.id) return
    setLoading(true)
    const [{ data: t }, { data: p }, { data: b }, { data: s }, { data: d }] = await Promise.all([
      supabase.from('competition_teams').select('*').eq('competition_id', competition.id),
      supabase.from('competition_participants').select('*').eq('competition_id', competition.id),
      supabase.from('competition_boats').select('*').eq('competition_id', competition.id),
      supabase.from('competition_fishing_sessions').select('*').eq('competition_id', competition.id),
      supabase.from('competition_boat_draws').select('*').eq('competition_id', competition.id),
    ])
    setTeams(t || []); setParticipants(p || []); setBoats(b || []); setSessions(s || []); setDraws(d || [])
    setLoading(false)
  }, [competition?.id])

  useEffect(() => { load() }, [load])

  if (!competition?.id) return (
    <div style={{ ...S.card, color: GREY, fontStyle: 'italic' }}>
      Nothing to review yet — set up the competition first.
    </div>
  )
  if (loading) return <div style={{ color: GREY }}>Loading…</div>

  const numDays = competition.num_fishing_days || 0
  const expectedDrawRows = participants.length * numDays
  const drawComplete = draws.filter(d => d.boat_id).length
  const expectedSessionRows = numDays * boats.length
  const sessionsWithRealData = sessions.filter(s => s.day_cancelled || (s.lines_in && s.lines_up)).length

  const checks = [
    { label: 'Competition details saved', ok: !!(competition.name && competition.start_date) },
    { label: `${teams.length} team${teams.length === 1 ? '' : 's'}, ${participants.length} angler${participants.length === 1 ? '' : 's'}`, ok: teams.length > 0 && participants.length > 0 },
    { label: `${boats.length} boat${boats.length === 1 ? '' : 's'} registered`, ok: boats.length > 0 },
    { label: 'Boat draw mode chosen', ok: !!competition.boat_draw_mode },
    { label: `Fishing sessions: ${sessionsWithRealData} of ${expectedSessionRows} boat-days set up`, ok: expectedSessionRows > 0 && sessionsWithRealData >= expectedSessionRows },
    { label: `Boat draw: ${drawComplete} of ${expectedDrawRows} angler-days assigned`, ok: expectedDrawRows > 0 && drawComplete >= expectedDrawRows },
  ]

  return (
    <div>
      <div style={S.card}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '1rem' }}>Ready to go?</div>
        {checks.map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0' }}>
            <span>{c.ok ? '✅' : '⚪'}</span>
            <span style={{ color: c.ok ? '#111827' : GREY }}>{c.label}</span>
          </div>
        ))}
      </div>

      <div style={{ ...S.card, background: '#eff6ff', borderLeft: `4px solid ${NAVY}` }}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.4rem' }}>Once fishing starts</div>
        <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '0.75rem' }}>
          This wizard is just for setup. Once the competition is underway, catches are logged on a
          separate page — pick a boat, see the anglers aboard it, and log each fish one angler at a
          time.
        </div>
        <a href={`/competition-catch-logger/${competition.id}`} style={{ ...S.btn(NAVY), textDecoration: 'none', display: 'inline-block' }}>
          🎣 Go to Catch Logger
        </a>
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>{competition.name}</div>
        <div style={{ fontSize: '0.85rem', color: GREY, marginBottom: '0.5rem' }}>
          {competition.venue} {competition.start_date && `· ${competition.start_date}`} {competition.end_date && `→ ${competition.end_date}`}
        </div>
        <div style={S.grid2}>
          {teams.map(team => {
            const teamAnglers = participants.filter(p => p.team_id === team.id)
            return (
              <div key={team.id} style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700 }}>{team.team_name}</div>
                <div style={{ fontSize: '0.82rem', color: GREY }}>
                  {teamAnglers.map(p => p.full_name).join(', ') || 'No anglers yet'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>Boats</div>
        {boats.length === 0 ? (
          <div style={{ color: GREY, fontStyle: 'italic' }}>No boats yet.</div>
        ) : (
          boats.map(b => (
            <div key={b.id} style={{ fontSize: '0.85rem', padding: '0.2rem 0' }}>
              <strong>{b.boat_name}</strong> — {b.skipper_name}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CompetitionSetupWizard() {
  const { competitionId } = useParams()
  const navigate = useNavigate()
  const [competition, setCompetition] = useState(null)
  const [activeStep, setActiveStep] = useState('competition')
  const [recentComps, setRecentComps] = useState([])

  useEffect(() => {
    if (!competitionId) { setCompetition(null); return }
    supabase.from('competitions').select('*').eq('id', competitionId)
      .then(({ data }) => { if (data?.[0]) setCompetition(data[0]) })
  }, [competitionId])

  useEffect(() => {
    supabase.from('competitions').select('id,name,start_date,template_id,status,results_published_at')
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setRecentComps(data || []))
  }, [])

  const handleSaved = (comp) => {
    setCompetition(comp)
    navigate(`/setup-wizard/${comp.id}`, { replace: true })
    setActiveStep('teams')
  }

  const handlePickExisting = (id) => {
    navigate(`/setup-wizard/${id}`)
  }

  // Lightweight status indicator per step, for the sidebar — not a hard gate,
  // just a helpful "what's left" signal. Computed from what's already loaded
  // in `competition` plus a couple of cheap counts; the per-step components
  // do their own fuller loading independently.
  // Lightweight counts fetched independently of each step's own data — just
  // enough to drive the sidebar's status dots. Re-fetched whenever the
  // active step changes, so finishing a step and moving to the next one
  // updates that step's dot without needing every step to manage shared state.
  const [counts, setCounts] = useState({ teams: 0, anglers: 0, boats: 0, sessionsSaved: 0, drawRowsFilled: 0 })

  const refreshCounts = useCallback(async () => {
    if (!competition?.id) return
    const [{ count: teamCount }, { count: anglerCount }, { count: boatCount }, { data: sess }, { data: drawRows }] = await Promise.all([
      supabase.from('competition_teams').select('id', { count: 'exact', head: true }).eq('competition_id', competition.id),
      supabase.from('competition_participants').select('id', { count: 'exact', head: true }).eq('competition_id', competition.id),
      supabase.from('competition_boats').select('id', { count: 'exact', head: true }).eq('competition_id', competition.id),
      supabase.from('competition_fishing_sessions').select('id,lines_in,lines_up,day_cancelled').eq('competition_id', competition.id),
      supabase.from('competition_boat_draws').select('id,boat_id').eq('competition_id', competition.id),
    ])
    setCounts({
      teams: teamCount || 0,
      anglers: anglerCount || 0,
      boats: boatCount || 0,
      sessionsSaved: (sess || []).filter(s => s.day_cancelled || (s.lines_in && s.lines_up)).length,
      drawRowsFilled: (drawRows || []).filter(d => d.boat_id).length,
    })
  }, [competition?.id])

  useEffect(() => { refreshCounts() }, [refreshCounts, activeStep])

  const numDays = competition?.num_fishing_days || 0
  const expectedDrawRows = counts.anglers * numDays
  const expectedSessionRows = counts.boats * numDays

  const status = {
    competition: competition?.id ? 'done' : 'empty',
    teams:       counts.teams === 0 ? 'empty' : counts.anglers > 0 ? 'done' : 'partial',
    boats:       counts.boats > 0 ? 'done' : 'empty',
    draw_mode:   competition?.boat_draw_mode ? 'done' : 'empty',
    sessions:    expectedSessionRows === 0 ? 'empty' : counts.sessionsSaved >= expectedSessionRows ? 'done' : counts.sessionsSaved > 0 ? 'partial' : 'empty',
    boat_draw:   expectedDrawRows === 0 ? 'empty' : counts.drawRowsFilled >= expectedDrawRows ? 'done' : counts.drawRowsFilled > 0 ? 'partial' : 'empty',
    review:      'empty',
  }

  return (
    <div style={S.page}>
      <div style={{ background: NAVY, color: 'white', padding: '1rem 1.5rem', borderRadius: 8, marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>🏆 Set Up a Competition</div>
        <div style={{ fontSize: '0.82rem', opacity: 0.8, marginTop: 2 }}>
          {competition ? competition.name : 'Walk through each step — come back to any of them at any time.'}
        </div>
      </div>

      <div style={S.layout}>
        <Sidebar activeStep={activeStep} setActiveStep={setActiveStep} status={status} />
        <div style={S.main}>
          {activeStep === 'competition' && (
            <CompetitionStep competition={competition} onSaved={handleSaved} recentComps={recentComps} onPickExisting={handlePickExisting} />
          )}
          {activeStep === 'teams'     && <TeamsStep competition={competition} />}
          {activeStep === 'boats'     && <BoatsStep competition={competition} />}
          {activeStep === 'draw_mode' && <BoatDrawModeStep competition={competition} onSaved={setCompetition} />}
          {activeStep === 'sessions'  && <SessionsStep competition={competition} />}
          {activeStep === 'boat_draw' && <BoatDrawStep competition={competition} />}
          {activeStep === 'review'    && <ReviewStep competition={competition} />}
        </div>
      </div>
    </div>
  )
}
