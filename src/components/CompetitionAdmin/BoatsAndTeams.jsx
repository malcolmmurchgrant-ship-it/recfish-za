// ─── BoatsAndTeams.jsx ───────────────────────────────────────────────────────
// Setup tab → "Boats & Teams": lets a competition's TD / admins add, edit and
// remove boats and teams in the app, instead of asking for SQL.
//
//   Boats  - add (optionally with a team of the same name, for one-boat-one-
//            team events like the CBSC Invitational), rename / change skipper,
//            remove.
//   Teams  - add, rename, put on a boat, remove.
//
// Safety rules:
//   * Nothing is removed once catches exist for it - deleting would wipe real
//     results. The app says so instead.
//   * Removing a boat or team keeps its anglers (with no team) unless you
//     tick "also remove its anglers", so they can be moved elsewhere.
//   * Boat times are stored by boat NAME, so a rename updates them too.
//   * Every write checks rows actually changed (.select) - a change the
//     database refuses is reported, never shown as done.
// Database rules needed for TDs to remove boats / draw rows: SQL 151.

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

const NAVY = '#1e3a8a', GREY = '#6b7280', RED = '#dc2626', GREEN = '#16a34a'
const S = {
  card:    { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1rem' },
  section: { fontWeight: 700, color: NAVY, fontSize: '0.95rem', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid #e5e7eb' },
  input:   { padding: '0.5rem 0.65rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' },
  label:   { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', marginBottom: '0.25rem' },
  btn:     (bg = NAVY, col = 'white') => ({ background: bg, color: col, border: 'none', padding: '0.45rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }),
  row:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.6rem 0', borderTop: '1px solid #f3f4f6' },
}
const az = (a, b) => (a || '').localeCompare(b || '', 'en', { sensitivity: 'base' })
const teamLabel = t => t.team_name + (t.team_suffix ? ` ${t.team_suffix}` : '')

export default function BoatsAndTeams({ competition, boats = [], teams = [], onChanged }) {
  const [participants, setParticipants] = useState([])
  const [msg, setMsg] = useState(null)          // { ok, text }
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(null)    // 'boat' | 'team' | null
  const [editBoat, setEditBoat] = useState(null) // { id, boat_name, skipper_name, renameTeam }
  const [editTeam, setEditTeam] = useState(null) // { id, team_name, boat_id }
  const [removing, setRemoving] = useState(null) // { kind, item, teams, anglers, catches, sessions, draws, alsoAnglers }

  const oneTeamPerBoat = useMemo(() =>
    teams.length > 0 && teams.every(t => t.boat_id) &&
    new Set(teams.map(t => t.boat_id)).size === teams.length, [teams])

  const [newBoat, setNewBoat] = useState({ boat_name: '', skipper_name: '', withTeam: true })
  const [newTeam, setNewTeam] = useState({ team_name: '', boat_id: '' })

  async function loadParticipants() {
    const { data } = await supabase.from('competition_participants')
      .select('id, full_name, team_id').eq('competition_id', competition.id)
    setParticipants(data || [])
  }
  useEffect(() => { if (competition?.id) loadParticipants() }, [competition?.id, teams.length])

  const sortedBoats = [...boats].sort((a, b) => az(a.boat_name, b.boat_name))
  const sortedTeams = [...teams].sort((a, b) => az(teamLabel(a), teamLabel(b)))
  const teamsOnBoat = id => teams.filter(t => t.boat_id === id)
  const anglersInTeams = ids => participants.filter(p => ids.includes(p.team_id))

  function done(text) { setMsg({ ok: true, text }); setBusy(false); onChanged?.(); loadParticipants() }
  function fail(text) { setMsg({ ok: false, text }); setBusy(false) }
  const refused = what => `Not saved: the database did not allow ${what}. Nothing was changed.`

  // ── Add ────────────────────────────────────────────────────────────────────
  async function addBoat() {
    const name = newBoat.boat_name.trim()
    if (!name) return fail('Please enter the boat name.')
    if (boats.some(b => az(b.boat_name, name) === 0)) return fail(`There is already a boat called "${name}".`)
    setBusy(true); setMsg(null)
    const { data: b, error } = await supabase.from('competition_boats')
      .insert({ competition_id: competition.id, boat_name: name, skipper_name: newBoat.skipper_name.trim() || null })
      .select('id')
    if (error) return fail(error.message)
    if (!b?.length) return fail(refused('adding this boat'))
    if (newBoat.withTeam) {
      const { data: t, error: e2 } = await supabase.from('competition_teams')
        .insert({ competition_id: competition.id, team_name: name, boat_id: b[0].id }).select('id')
      if (e2 || !t?.length) return fail(`Boat added, but its team could not be created${e2 ? ': ' + e2.message : ''}.`)
    }
    setNewBoat({ boat_name: '', skipper_name: '', withTeam: true }); setAdding(null)
    done(`✅ Boat "${name}" added${newBoat.withTeam ? ' with its team — add its anglers on the Participants tab' : ''}.`)
  }

  async function addTeam() {
    const name = newTeam.team_name.trim()
    if (!name) return fail('Please enter the team name.')
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.from('competition_teams')
      .insert({ competition_id: competition.id, team_name: name, boat_id: newTeam.boat_id || null }).select('id')
    if (error) return fail(error.message)
    if (!data?.length) return fail(refused('adding this team'))
    setNewTeam({ team_name: '', boat_id: '' }); setAdding(null)
    done(`✅ Team "${name}" added.`)
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  async function saveBoat() {
    const found = boats.find(b => b.id === editBoat.id)
    const old = { id: found.id, boat_name: found.boat_name, skipper_name: found.skipper_name }   // copy before saving
    const oldTeams = teamsOnBoat(found.id).filter(t => az(t.team_name, found.boat_name) === 0).map(t => t.id)
    const name = editBoat.boat_name.trim()
    if (!name) return fail('The boat name cannot be empty.')
    if (boats.some(b => b.id !== old.id && az(b.boat_name, name) === 0)) return fail(`There is already a boat called "${name}".`)
    setBusy(true); setMsg(null)
    const skipper = editBoat.skipper_name.trim() || null
    const { data, error } = await supabase.from('competition_boats')
      .update({ boat_name: name, skipper_name: skipper }).eq('id', old.id).select('id')
    if (error) return fail(error.message)
    if (!data?.length) return fail(refused('changing this boat'))
    // Boat times are stored against the boat's name and skipper.
    if (name !== old.boat_name || skipper !== (old.skipper_name || null)) {
      await supabase.from('competition_fishing_sessions')
        .update({ boat_name: name, skipper_name: skipper })
        .eq('competition_id', competition.id).eq('boat_name', old.boat_name)
    }
    if (editBoat.renameTeam && name !== old.boat_name) {
      for (const tid of oldTeams) {
        await supabase.from('competition_teams').update({ team_name: name }).eq('id', tid)
      }
    }
    setEditBoat(null)
    done(`✅ Boat saved as "${name}".`)
  }

  async function saveTeam() {
    const name = editTeam.team_name.trim()
    if (!name) return fail('The team name cannot be empty.')
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.from('competition_teams')
      .update({ team_name: name, boat_id: editTeam.boat_id || null }).eq('id', editTeam.id).select('id')
    if (error) return fail(error.message)
    if (!data?.length) return fail(refused('changing this team'))
    setEditTeam(null)
    done(`✅ Team saved as "${name}".`)
  }

  // ── Remove ─────────────────────────────────────────────────────────────────
  async function startRemove(kind, item) {
    setBusy(true); setMsg(null)
    const tms = kind === 'boat' ? teamsOnBoat(item.id) : [item]
    const tIds = tms.map(t => t.id)
    const angs = anglersInTeams(tIds)
    const pIds = angs.map(p => p.id)
    // Catches that belong to this boat / team / its anglers
    const ors = []
    if (kind === 'boat') ors.push(`boat_id.eq.${item.id}`)
    if (tIds.length) ors.push(`team_id.in.(${tIds.join(',')})`)
    if (pIds.length) ors.push(`participant_id.in.(${pIds.join(',')})`)
    const { count: catches } = await supabase.from('competition_catches')
      .select('id', { count: 'exact', head: true })
      .eq('competition_id', competition.id).or(ors.join(','))
    let sessions = 0, draws = 0
    if (kind === 'boat') {
      const s = await supabase.from('competition_fishing_sessions').select('id', { count: 'exact', head: true })
        .eq('competition_id', competition.id).eq('boat_name', item.boat_name)
      const d = await supabase.from('competition_boat_draws').select('id', { count: 'exact', head: true })
        .eq('competition_id', competition.id).eq('boat_id', item.id)
      sessions = s.count || 0; draws = d.count || 0
    }
    setBusy(false)
    setRemoving({ kind, item, teams: tms, anglers: angs, catches: catches || 0, sessions, draws, alsoAnglers: false })
  }

  async function confirmRemove() {
    const r = removing
    if (r.catches > 0) return
    setBusy(true); setMsg(null)
    const tIds = r.teams.map(t => t.id)
    const pIds = r.anglers.map(p => p.id)
    try {
      if (r.kind === 'boat') {
        await supabase.from('competition_boat_draws').delete().eq('competition_id', competition.id).eq('boat_id', r.item.id)
        await supabase.from('competition_fishing_sessions').delete().eq('competition_id', competition.id).eq('boat_name', r.item.boat_name)
      }
      if (pIds.length) {
        if (r.alsoAnglers) {
          await supabase.from('competition_boat_draws').delete().eq('competition_id', competition.id).in('participant_id', pIds)
          const { data, error } = await supabase.from('competition_participants').delete().in('id', pIds).select('id')
          if (error || (data?.length || 0) < pIds.length) throw new Error(error?.message || refused('removing the anglers'))
        } else {
          const { data, error } = await supabase.from('competition_participants').update({ team_id: null }).in('id', pIds).select('id')
          if (error || (data?.length || 0) < pIds.length) throw new Error(error?.message || refused('moving the anglers off the team'))
        }
      }
      if (tIds.length) {
        const { data, error } = await supabase.from('competition_teams').delete().in('id', tIds).select('id')
        if (error || (data?.length || 0) < tIds.length) throw new Error(error?.message || refused('removing the team'))
      }
      if (r.kind === 'boat') {
        const { data, error } = await supabase.from('competition_boats').delete().eq('id', r.item.id).select('id')
        if (error || !data?.length) throw new Error(error?.message || refused('removing the boat — ask the organiser to run SQL 151'))
      }
      const what = r.kind === 'boat' ? `Boat "${r.item.boat_name}"` : `Team "${teamLabel(r.item)}"`
      setRemoving(null)
      done(`✅ ${what} removed.${pIds.length ? (r.alsoAnglers ? ` ${pIds.length} angler(s) removed.` : ` ${pIds.length} angler(s) kept with no team — give them a team on the Participants tab.`) : ''}`)
    } catch (e) {
      setRemoving(null)
      fail('❌ ' + (e.message || e) + ' Some parts may already have been removed — refresh the page to see where things stand.')
      onChanged?.()
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  const anglerCount = tIds => anglersInTeams(tIds).length

  return (
    <div style={S.card} data-testid="boats-teams">
      <div style={S.section}>Boats &amp; Teams</div>
      <div style={{ fontSize: '0.8rem', color: GREY, marginBottom: '0.75rem' }}>
        Add, rename or remove boats and teams. Anglers are put on a team on the <strong>Participants</strong> tab.
        Anything that already has catches cannot be removed.
      </div>

      {msg && (
        <div data-testid="bt-msg" style={{ padding: '0.6rem 0.8rem', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 600,
          background: msg.ok ? '#f0fdf4' : '#fee2e2', color: msg.ok ? '#166534' : '#991b1b' }}>{msg.text}</div>
      )}

      {/* Remove confirmation */}
      {removing && (
        <div data-testid="bt-remove" style={{ border: `2px solid ${removing.catches ? RED : '#fca5a5'}`, borderRadius: 8, padding: '0.9rem', marginBottom: '0.9rem', background: '#fff7f7' }}>
          <div style={{ fontWeight: 800, color: RED, marginBottom: '0.4rem' }}>
            Remove {removing.kind === 'boat' ? `boat "${removing.item.boat_name}"` : `team "${teamLabel(removing.item)}"`}?
          </div>
          {removing.catches > 0 ? (
            <div style={{ fontSize: '0.85rem' }}>
              <strong>Can't remove:</strong> {removing.catches} catch(es) are already logged for it. Removing it would delete real results.
              If it has withdrawn, simply leave it in — it won't affect anyone else.
            </div>
          ) : (
            <>
              <ul style={{ margin: '0 0 0.6rem 1.1rem', fontSize: '0.85rem', padding: 0 }}>
                {removing.kind === 'boat' && removing.teams.length > 0 && <li>Team{removing.teams.length > 1 ? 's' : ''}: {removing.teams.map(teamLabel).join(', ')}</li>}
                <li>Anglers on it: {removing.anglers.length ? removing.anglers.map(p => p.full_name).join(', ') : 'none'}</li>
                {removing.kind === 'boat' && <li>Boat-time rows: {removing.sessions} · Boat-draw rows: {removing.draws}</li>}
              </ul>
              {removing.anglers.length > 0 && (
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.6rem' }}>
                  <input type="checkbox" checked={removing.alsoAnglers} onChange={e => setRemoving(r => ({ ...r, alsoAnglers: e.target.checked }))} />
                  Also remove its anglers (otherwise they are kept with no team, to move to another boat)
                </label>
              )}
            </>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!removing.catches && <button disabled={busy} onClick={confirmRemove} style={S.btn(RED)} data-testid="bt-confirm-remove">{busy ? 'Removing…' : 'Yes, remove'}</button>}
            <button onClick={() => setRemoving(null)} style={S.btn('#e5e7eb', '#111')}>Cancel</button>
          </div>
        </div>
      )}

      {/* Boats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
        <div style={{ fontWeight: 700, color: '#111' }}>🚤 Boats ({boats.length})</div>
        <button onClick={() => { setAdding(adding === 'boat' ? null : 'boat'); setNewBoat(n => ({ ...n, withTeam: oneTeamPerBoat || teams.length === 0 })) }}
          style={S.btn(GREEN)} data-testid="bt-add-boat">+ Add boat</button>
      </div>
      {adding === 'boat' && (
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '0.8rem', margin: '0.6rem 0', display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div><label style={S.label}>Boat name *</label><input style={S.input} value={newBoat.boat_name} onChange={e => setNewBoat(n => ({ ...n, boat_name: e.target.value }))} data-testid="bt-new-boat-name" /></div>
          <div><label style={S.label}>Skipper</label><input style={S.input} value={newBoat.skipper_name} onChange={e => setNewBoat(n => ({ ...n, skipper_name: e.target.value }))} /></div>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem', gridColumn: '1 / -1' }}>
            <input type="checkbox" checked={newBoat.withTeam} onChange={e => setNewBoat(n => ({ ...n, withTeam: e.target.checked }))} />
            Also create a team with the same name on this boat (one boat, one team — e.g. the Invitational)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button disabled={busy} onClick={addBoat} style={S.btn(GREEN)} data-testid="bt-save-boat">{busy ? 'Saving…' : 'Save boat'}</button>
            <button onClick={() => setAdding(null)} style={S.btn('#e5e7eb', '#111')}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ marginBottom: '1.1rem' }}>
        {sortedBoats.length === 0 && <div style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem', padding: '0.5rem 0' }}>No boats yet.</div>}
        {sortedBoats.map(b => editBoat?.id === b.id ? (
          <div key={b.id} style={{ ...S.row, background: '#eff6ff', padding: '0.7rem', borderRadius: 6 }}>
            <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', flex: 1 }}>
              <div><label style={S.label}>Boat name</label><input style={S.input} value={editBoat.boat_name} onChange={e => setEditBoat(x => ({ ...x, boat_name: e.target.value }))} data-testid="bt-edit-boat-name" /></div>
              <div><label style={S.label}>Skipper</label><input style={S.input} value={editBoat.skipper_name} onChange={e => setEditBoat(x => ({ ...x, skipper_name: e.target.value }))} /></div>
              {teamsOnBoat(b.id).some(t => az(t.team_name, b.boat_name) === 0) && (
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.82rem', gridColumn: '1 / -1' }}>
                  <input type="checkbox" checked={editBoat.renameTeam} onChange={e => setEditBoat(x => ({ ...x, renameTeam: e.target.checked }))} />
                  Rename its team "{b.boat_name}" too
                </label>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button disabled={busy} onClick={saveBoat} style={S.btn(GREEN)} data-testid="bt-save-edit-boat">Save</button>
              <button onClick={() => setEditBoat(null)} style={S.btn('#e5e7eb', '#111')}>Cancel</button>
            </div>
          </div>
        ) : (
          <div key={b.id} style={S.row} data-testid="bt-boat-row">
            <div>
              <div style={{ fontWeight: 700 }}>{b.boat_name}</div>
              <div style={{ fontSize: '0.8rem', color: GREY }}>
                Skipper: {b.skipper_name || '—'}
                {teamsOnBoat(b.id).length > 0 && ` · Team: ${teamsOnBoat(b.id).map(teamLabel).join(', ')}`}
                {` · ${anglerCount(teamsOnBoat(b.id).map(t => t.id))} angler(s)`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => setEditBoat({ id: b.id, boat_name: b.boat_name || '', skipper_name: b.skipper_name || '', renameTeam: true })} style={S.btn()}>✎ Edit</button>
              <button disabled={busy} onClick={() => startRemove('boat', b)} style={S.btn(RED)} data-testid="bt-remove-boat">Remove</button>
            </div>
          </div>
        ))}
      </div>

      {/* Teams */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, color: '#111' }}>👥 Teams ({teams.length})</div>
        <button onClick={() => setAdding(adding === 'team' ? null : 'team')} style={S.btn(GREEN)}>+ Add team</button>
      </div>
      {adding === 'team' && (
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '0.8rem', margin: '0.6rem 0', display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div><label style={S.label}>Team name *</label><input style={S.input} value={newTeam.team_name} onChange={e => setNewTeam(n => ({ ...n, team_name: e.target.value }))} /></div>
          <div><label style={S.label}>Boat (if the team fishes one boat)</label>
            <select style={S.input} value={newTeam.boat_id} onChange={e => setNewTeam(n => ({ ...n, boat_id: e.target.value }))}>
              <option value="">— none / changes daily —</option>
              {sortedBoats.map(b => <option key={b.id} value={b.id}>{b.boat_name}</option>)}
            </select></div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button disabled={busy} onClick={addTeam} style={S.btn(GREEN)}>{busy ? 'Saving…' : 'Save team'}</button>
            <button onClick={() => setAdding(null)} style={S.btn('#e5e7eb', '#111')}>Cancel</button>
          </div>
        </div>
      )}
      <div>
        {sortedTeams.length === 0 && <div style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem', padding: '0.5rem 0' }}>No teams yet.</div>}
        {sortedTeams.map(t => editTeam?.id === t.id ? (
          <div key={t.id} style={{ ...S.row, background: '#eff6ff', padding: '0.7rem', borderRadius: 6 }}>
            <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', flex: 1 }}>
              <div><label style={S.label}>Team name</label><input style={S.input} value={editTeam.team_name} onChange={e => setEditTeam(x => ({ ...x, team_name: e.target.value }))} /></div>
              <div><label style={S.label}>Boat</label>
                <select style={S.input} value={editTeam.boat_id || ''} onChange={e => setEditTeam(x => ({ ...x, boat_id: e.target.value }))}>
                  <option value="">— none / changes daily —</option>
                  {sortedBoats.map(b => <option key={b.id} value={b.id}>{b.boat_name}</option>)}
                </select></div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button disabled={busy} onClick={saveTeam} style={S.btn(GREEN)}>Save</button>
              <button onClick={() => setEditTeam(null)} style={S.btn('#e5e7eb', '#111')}>Cancel</button>
            </div>
          </div>
        ) : (
          <div key={t.id} style={S.row}>
            <div>
              {(() => {
                // "Team - Boat" (e.g. African Vintage Tackle - Rapha). When the
                // team is named after its boat, the name is shown once.
                const boatName = boats.find(b => b.id === t.boat_id)?.boat_name || ''
                const sameName = boatName && az(t.team_name, boatName) === 0
                return (
                  <>
                    <div style={{ fontWeight: 700 }} data-testid="team-heading">
                      {teamLabel(t)}{boatName && !sameName ? ` - ${boatName}` : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: GREY }}>
                      {boatName ? '' : 'No boat assigned · '}{anglerCount([t.id])} angler(s)
                    </div>
                  </>
                )
              })()}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => setEditTeam({ id: t.id, team_name: t.team_name || '', boat_id: t.boat_id || '' })} style={S.btn()}>✎ Edit</button>
              <button disabled={busy} onClick={() => startRemove('team', t)} style={S.btn(RED)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
