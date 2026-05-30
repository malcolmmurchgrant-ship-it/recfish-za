import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAVY  = '#1e3a8a'
const GOLD  = '#d97706'
const GREEN = '#16a34a'

// Your Supabase user ID — always sees Enter Catches buttons
const OWNER_ID = 'b9c5048a-b229-46af-9042-44551b162d75'

// Roles that grant catch-entry access
const CATCH_ROLES = ['admin', 'tournament_director']

// ─── Competition-specific page links ─────────────────────────────────────────
// canEnter: whether the current user has catch-entry access for this competition
function getLinks(comp, canEnter) {
  const id = comp.id

  const specific = {
    'c8332f15-ce44-4d0b-a3ab-009fc2a2c484': [  // All Coastals 2026 — completed
      { to: '/allcoastals-scores', label: '📊 Scoreboard', primary: true  },
      { to: '/allcoastals-teams',  label: '🏅 Teams',      primary: false },
    ],
    '3855034f-ab39-4297-9be4-ba9a7e566ce0': [  // Gamefish Nationals
      ...(canEnter ? [{ to: '/gamefish',        label: '🎣 Enter Catches', primary: true  }] : []),
      {                to: '/gamefish-scores',   label: '📊 Scoreboard',    primary: !canEnter },
    ],
  }
  if (specific[id]) return specific[id]

  // Generic fallback — no Enter Catches for unknown competitions
  return [
    { to: `/competition-admin-v2/${id}`, label: '⚙️ Manage Competition', primary: true },
  ]
}

// ─── Discipline colours & labels ─────────────────────────────────────────────
const DISCIPLINE_STYLE = {
  bottomfish:     { bg: '#dcfce7', col: '#15803d', label: '🎣 Bottomfish'  },
  gamefish:       { bg: '#dbeafe', col: '#1e40af', label: '🐟 Gamefish'    },
  tuna:           { bg: '#fef3c7', col: '#92400e', label: '🐟 Tuna'        },
  billfish_light: { bg: '#f3e8ff', col: '#7c3aed', label: '🎣 LT Billfish' },
  billfish_heavy: { bg: '#fce7f3', col: '#be185d', label: '🎣 HT Billfish' },
  mixed:          { bg: '#f0fdf4', col: '#166534', label: '🎣 Mixed'       },
  shore:          { bg: '#fff7ed', col: '#c2410c', label: '🏖 Shore'       },
  spearfishing:   { bg: '#ecfeff', col: '#0e7490', label: '🤿 Spearfishing'},
}

const STATUS_STYLE = {
  active:            { bg: '#dcfce7', col: GREEN,      label: '🟢 Live',      border: GREEN      },
  upcoming:          { bg: '#eff6ff', col: NAVY,       label: '🔵 Upcoming',  border: NAVY       },
  registration_open: { bg: '#fef3c7', col: GOLD,       label: '🟡 Open',      border: GOLD       },
  completed:         { bg: '#f3f4f6', col: '#6b7280',  label: '⚪ Completed', border: '#d1d5db'  },
  cancelled:         { bg: '#fef2f2', col: '#dc2626',  label: '🔴 Cancelled', border: '#fca5a5'  },
}

const LEVEL_LABELS = {
  international:   'International',
  national:        'National',
  interprovincial: 'Interprovincial',
  provincial:      'Provincial',
  regional:        'Regional',
  club:            'Club',
  special:         'Special',
}

// Competitions that are finished and should not appear on the Hub
const HIDDEN_IDS = new Set([
  // All completed competitions still visible in Hub (read-only)
])

export default function Competitions() {
  const navigate = useNavigate()
  const [competitions,  setCompetitions]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('all')
  const [userId,        setUserId]        = useState(null)
  const [catchAccess,   setCatchAccess]   = useState(new Set()) // competition IDs user can enter

  // ── Auth + roles ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id || null
      setUserId(uid)

      if (!uid) return

      // Owner bypass — grant access to all competitions immediately
      if (uid === OWNER_ID) {
        setCatchAccess('all') // special sentinel
        return
      }

      // Look up competition_user_roles for this user
      supabase
        .from('competition_user_roles')
        .select('competition_id, role')
        .eq('user_id', uid)
        .then(({ data: roles }) => {
          if (!roles) return
          const ids = new Set(
            roles
              .filter(r => CATCH_ROLES.includes(r.role))
              .map(r => r.competition_id)
          )
          setCatchAccess(ids)
        })
    })
  }, [])

  // ── Competitions ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('competitions')
      .select(`
        id, name, short_name, venue, start_date, end_date,
        status, discipline, level, category, description,
        team_size, default_line_class_kg, hosting_province,
        federation_id, association_id
      `)
      .not('status', 'eq', 'cancelled')
      .order('start_date', { ascending: false })
      .then(({ data }) => {
        setCompetitions((data || []).filter(c => !HIDDEN_IDS.has(c.id)))
        setLoading(false)
      })
  }, [])

  const canEnter = (compId) =>
    catchAccess === 'all' || (catchAccess instanceof Set && catchAccess.has(compId))

  const filtered = competitions.filter(c => {
    if (filter === 'all')       return true
    if (filter === 'active')    return c.status === 'active'
    if (filter === 'upcoming')  return ['upcoming', 'registration_open'].includes(c.status)
    if (filter === 'completed') return c.status === 'completed'
    return true
  })

  const filterCounts = {
    all:       competitions.length,
    active:    competitions.filter(c => c.status === 'active').length,
    upcoming:  competitions.filter(c => ['upcoming', 'registration_open'].includes(c.status)).length,
    completed: competitions.filter(c => c.status === 'completed').length,
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: NAVY, color: 'white', padding: '1.25rem 1.5rem', borderRadius: 8, marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>🏆 SADSAA Competitions</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: 3 }}>
          Select a competition to view results or enter catches
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { key: 'all',       label: 'All'          },
          { key: 'active',    label: '🟢 Live'      },
          { key: 'upcoming',  label: '🔵 Upcoming'  },
          { key: 'completed', label: '⚪ Completed' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: 20,
              border: `2px solid ${filter === f.key ? NAVY : '#d1d5db'}`,
              background: filter === f.key ? NAVY : 'white',
              color: filter === f.key ? 'white' : '#374151',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}>
            {f.label}
            <span style={{ marginLeft: 4, opacity: 0.7, fontSize: '0.75rem' }}>
              ({filterCounts[f.key]})
            </span>
          </button>
        ))}
      </div>

      {/* Competition cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading competitions…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No competitions found.</div>
      ) : (
        filtered.map(comp => {
          const disc     = DISCIPLINE_STYLE[comp.discipline] || { bg: '#f3f4f6', col: '#6b7280', label: comp.discipline || 'Unknown' }
          const statStyle = STATUS_STYLE[comp.status]        || STATUS_STYLE.completed
          const links    = getLinks(comp, canEnter(comp.id))
          const dateStr  = comp.start_date && comp.end_date
            ? `${comp.start_date} → ${comp.end_date}`
            : comp.start_date || ''

          return (
            <div key={comp.id} style={{
              background: 'white',
              borderRadius: 10,
              padding: '1.25rem 1.5rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
              marginBottom: '1rem',
              borderLeft: `5px solid ${statStyle.border}`,
            }}>
              {/* Title row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: NAVY }}>{comp.name}</div>
                  <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 2 }}>
                    {comp.venue}{comp.hosting_province ? ` · ${comp.hosting_province}` : ''}
                    {dateStr ? ` · ${dateStr}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, background: disc.bg, color: disc.col, padding: '0.2rem 0.65rem', borderRadius: 20 }}>
                    {disc.label}
                  </span>
                  {comp.level && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#f3f4f6', color: '#374151', padding: '0.2rem 0.65rem', borderRadius: 20 }}>
                      {LEVEL_LABELS[comp.level] || comp.level}
                    </span>
                  )}
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, background: statStyle.bg, color: statStyle.col, padding: '0.2rem 0.65rem', borderRadius: 20 }}>
                    {statStyle.label}
                  </span>
                </div>
              </div>

              {/* Description */}
              {comp.description && (
                <div style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.75rem' }}>
                  {comp.description}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {links.map(link => (
                  <button key={link.to + link.label} onClick={() => navigate(link.to)}
                    style={{
                      background: link.primary ? NAVY : 'white',
                      color: link.primary ? 'white' : NAVY,
                      border: `2px solid ${NAVY}`,
                      padding: '0.5rem 1.1rem',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                    }}>
                    {link.label}
                  </button>
                ))}
                <button onClick={() => navigate(`/competition-admin-v2/${comp.id}`)}
                  style={{
                    background: 'white', color: '#6b7280',
                    border: '1px solid #d1d5db',
                    padding: '0.5rem 0.9rem',
                    borderRadius: 6, cursor: 'pointer',
                    fontWeight: 600, fontSize: '0.85rem',
                  }}>
                  ⚙️ Admin
                </button>
              </div>
            </div>
          )
        })
      )}

      {/* New competition shortcut */}
      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <button onClick={() => navigate('/competition-admin-v2')}
          style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}>
          + Create New Competition
        </button>
      </div>
    </div>
  )
}
