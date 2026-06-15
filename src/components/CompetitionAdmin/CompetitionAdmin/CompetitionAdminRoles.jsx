// ─── CompetitionAdminRoles.jsx ────────────────────────────────────────────────
// Roles tab — grant and revoke competition-level access.
// Mirrors the Roles tab from AllCoastalsAdmin but reads from competition_user_roles.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const NAVY = '#1e3a8a'
const GREY = '#6b7280'
const GREEN = '#16a34a'
const RED = '#dc2626'

const S = {
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  input:  { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' },
  select: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', background: 'white', boxSizing: 'border-box' },
  btn:    (bg = NAVY, col = 'white') => ({ background: bg, color: col, border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }),
  badge:  (col) => ({ background: col, color: 'white', padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, display: 'inline-block' }),
  section:{ fontWeight: 700, color: NAVY, fontSize: '0.95rem', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid #e5e7eb' },
}

const ROLE_COLORS = { admin: NAVY, scorer: GREEN, read_only: GREY, tournament_director: '#7c3aed' }
const ROLE_DESCS  = {
  tournament_director: 'Full control: rules, draws, participants, prize categories',
  scorer:              'Log and edit all catches, view boat draw',
  read_only:           'Scoreboard view only — no edit access',
}

export default function CompetitionAdminRoles({
  competition, competitionId, isAdmin, isPlatformAdmin, grantRole, revokeRole, onReload,
}) {
  const [roles,       setRoles]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [newRole,     setNewRole]     = useState({ email: '', role: 'scorer' })
  const [saving,      setSaving]      = useState(false)
  const [deleteTarget,setDeleteTarget]= useState(null)
  const [error,       setError]       = useState('')

  useEffect(() => { loadRoles() }, [competitionId])

  async function loadRoles() {
    setLoading(true)
    const { data } = await supabase
      .from('competition_user_roles')
      .select('id, role, created_at, user_id')
      .eq('competition_id', competitionId)
      .order('created_at')
    // Resolve emails from users table
    if (data?.length) {
      const ids = data.map(r => r.user_id)
      const { data: users } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', ids)
      const userMap = Object.fromEntries((users || []).map(u => [u.id, u]))
      setRoles(data.map(r => ({ ...r, ...userMap[r.user_id] })))
    } else {
      setRoles([])
    }
    setLoading(false)
  }

  async function handleAddRole() {
    if (!newRole.email.trim()) { setError('Email is required'); return }
    setSaving(true); setError('')
    try {
      await grantRole(newRole.email.trim(), newRole.role)
      setNewRole({ email: '', role: 'scorer' })
      await loadRoles()
      onReload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveRole(roleId) {
    try {
      await revokeRole(roleId)
      setDeleteTarget(null)
      await loadRoles()
      onReload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      {/* ── Grant access ───────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={S.section}>Grant Access</div>
        <div style={{ fontSize: '0.82rem', color: GREY, marginBottom: '0.75rem' }}>
          The user must be registered on RecFish ZA first. Enter their registered email address.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'end' }}>
          <div>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" placeholder="user@example.com"
              value={newRole.email}
              onChange={e => setNewRole(r => ({ ...r, email: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Role</label>
            <select style={{ ...S.select, width: 'auto' }} value={newRole.role}
              onChange={e => setNewRole(r => ({ ...r, role: e.target.value }))}>
              <option value="tournament_director">Tournament Director</option>
              <option value="scorer">Scorer</option>
              <option value="read_only">Read Only</option>
            </select>
          </div>
          <button onClick={handleAddRole} disabled={saving || !newRole.email}
            style={{ ...S.btn(), opacity: !newRole.email ? 0.5 : 1 }}>
            {saving ? 'Granting…' : 'Grant'}
          </button>
        </div>
        {error && <div style={{ color: RED, fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</div>}

        {/* Role legend */}
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {Object.entries(ROLE_DESCS).map(([role, desc]) => (
            <div key={role} style={{ fontSize: '0.75rem', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.4rem 0.6rem', flex: 1, minWidth: 140 }}>
              <span style={S.badge(ROLE_COLORS[role] || GREY)}>{role.replace('_', ' ')}</span>
              <div style={{ color: GREY, marginTop: 3 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Current roles ─────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={S.section}>Current Access</div>

        {/* Platform admins always shown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: '#eff6ff', borderRadius: 6, marginBottom: '0.4rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Malcolm Grant</div>
            <div style={{ fontSize: '0.8rem', color: GREY }}>malcolmmurchgrant@gmail.com · mpca99@telkomsa.net</div>
          </div>
          <span style={S.badge(NAVY)}>platform admin</span>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>System owner</span>
        </div>

        {loading ? (
          <div style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem' }}>Loading roles…</div>
        ) : roles.length === 0 ? (
          <div style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem' }}>No additional roles granted yet.</div>
        ) : roles.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: '0.4rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{r.full_name || r.email}</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {r.full_name && r.email} · Added {new Date(r.created_at).toLocaleDateString('en-ZA')}
              </div>
            </div>
            <span style={S.badge(ROLE_COLORS[r.role] || GREY)}>{r.role?.replace('_', ' ')}</span>
            {deleteTarget === r.id ? (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button onClick={() => handleRemoveRole(r.id)}
                  style={{ ...S.btn(RED), padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}>
                  Confirm
                </button>
                <button onClick={() => setDeleteTarget(null)}
                  style={{ ...S.btn(GREY), padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setDeleteTarget(r.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, fontSize: '0.85rem' }}>
                ✕ Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
