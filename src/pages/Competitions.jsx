import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAVY  = '#1e3a8a'
const GOLD  = '#d97706'
const GREEN = '#16a34a'

const OWNER_ID    = 'b9c5048a-b229-46af-9042-44551b162d75'
const CATCH_ROLES = ['admin', 'tournament_director']

// ─── Competition-specific page links ─────────────────────────────────────────
// Return { links, hideGenericAdmin } per competition
function getCompConfig(comp, canEnter) {
  const id = comp.id

  const specific = {
    '3855034f-ab39-4297-9be4-ba9a7e566ce0': {  // Gamefish Nationals
      hideGenericAdmin: false,
      links: [
        ...(canEnter ? [{ to: '/gamefish',       label: '🎣 Enter Catches', primary: true  }] : []),
        {               to: '/gamefish-scores',   label: '📊 Scoreboard',    primary: !canEnter },
      ],
    },
    'ff6e95a9-4f9e-4b54-ad47-a913831d336c': {  // Tuna Nationals 2026
      hideGenericAdmin: false,
      links: [
        { to: '/tuna-nationals-scores', label: '📊 Scoreboard', primary: true },
      ],
    },
    '4a905558-8a94-4dc2-8305-bce37bfc1fe4': {  // Tuna International 2026
      hideGenericAdmin: false,
      links: [
        { to: '/tuna-international-scores', label: '📊 Scoreboard', primary: true },
      ],
    },
    // ── 2024 historical imports — scoreboards coming soon ──────────────────
    '46b59df9-87ed-47aa-b853-3dc57e2bfc56': {  // EFSA Big Game 2024
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    'aca2ddb4-10d6-4aa9-8a62-a81f28dd4b39': {  // HT Billfish Interprovincial 2024
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    '099345fd-51d0-46b9-8d59-21345047e7c4': {  // Bottomfish International 2024
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    'f9a2cd2b-bbee-4bd3-9961-9bb5039d28af': {  // Bottomfish Nationals 2024
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    'bf2a40c3-14a3-4adf-acbb-a5f904e4ca53': {  // Junior Bottomfish Nationals 2024
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    'b4a20da9-5eca-48fb-b181-bb9409e09d5b': {  // Bottomfish Interprovincial 2024
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    '262ab951-4805-4d8f-a541-0ab79762fd94': {  // All Coastals Interprovincial 2024
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    '5e4785fe-1382-4d25-a8be-f18c820919e0': {  // HT Billfish Nationals 2024
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    'ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77': {  // Junior Gamefish Nationals 2026
      hideGenericAdmin: false,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    // ── 2025 historical imports — scoreboards coming soon ──────────────────
    'ad8d03e7-6d4d-4cea-b96b-1007d3c6127d': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // All Inland Interprov 2025
    '350c759c-fa02-48b1-9c77-bf3b40fff22f': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // Gamefish Nationals 2025
    '25fc4dbc-9ed8-420d-9d09-c5ebb10b7b69': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // Tuna Interprov 2025
    'b5d55428-53fc-4ce6-ad76-f098f757701a': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // All Coastals 2025
    '0a099402-0bc5-46b0-b94d-0f94129758f0': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // Junior U16 Gamefish 2025
    '82dbbca2-fbea-4eb7-931c-a60072a136c1': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // Junior U19 Gamefish 2025
    'c9fce393-71f7-4f9e-85cf-163911ccb877': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // HT Billfish Interprov 2025
    '1c6ebb69-e11c-46d4-8894-ec00848bde37': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // Tuna International 2025
    'a6d492db-e803-428d-b37c-a2fb3a662063': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // Tuna Nationals 2025
    'f0a4d797-e3b8-47ad-b5d4-171fafb2627b': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // Gamefish Interprov 2025
    '39031484-67be-450b-be43-e2c5e090fbce': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // LT Billfish Nationals 2025
    '11880c4a-82df-4dec-a7b0-57e0b98db1f4': { hideGenericAdmin: true, links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }] },  // Bottomfish Interprov 2025

    // ── 2023 historical imports — scoreboards coming soon ──────────────────
    '346d0d52-e2af-4675-97d9-d40ad32e168e': {  // Junior Gamefish Nationals 2023
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    '1bc6eb85-ee59-43b5-8066-2a4ae1047c67': {  // Tuna Nationals 2023
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    'b8e78ab2-28d8-42fe-b063-24c1c5779478': {  // Tuna International 2023
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
    '4838f5d2-52db-459a-9b6b-2d7ee41fa789': {  // All Inland Open 2023
      hideGenericAdmin: true,
      links: [{ to: null, label: '📊 Results Coming Soon', primary: true, disabled: true }],
    },
  }

  if (specific[id]) return specific[id]

  // Generic fallback
  return {
    hideGenericAdmin: true,
    links: [
      { to: `/competition-admin-v2/${id}`, label: '⚙️ Manage Competition', primary: true },
    ],
  }
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
  active:            { bg: '#dcfce7', col: GREEN,     label: '🟢 Live',      border: GREEN      },
  upcoming:          { bg: '#eff6ff', col: NAVY,      label: '🔵 Upcoming',  border: NAVY       },
  registration_open: { bg: '#fef3c7', col: GOLD,      label: '🟡 Open',      border: GOLD       },
  completed:         { bg: '#f3f4f6', col: '#6b7280', label: '⚪ Completed', border: '#d1d5db'  },
  cancelled:         { bg: '#fef2f2', col: '#dc2626', label: '🔴 Cancelled', border: '#fca5a5'  },
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

export default function Competitions() {
  const navigate = useNavigate()
  const [competitions, setCompetitions] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('all')
  const [catchAccess,  setCatchAccess]  = useState(new Set())

  // ── Auth + roles ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id || null
      if (!uid) return
      if (uid === OWNER_ID) { setCatchAccess('all'); return }
      supabase
        .from('competition_user_roles')
        .select('competition_id, role')
        .eq('user_id', uid)
        .then(({ data: roles }) => {
          if (!roles) return
          setCatchAccess(new Set(
            roles.filter(r => CATCH_ROLES.includes(r.role)).map(r => r.competition_id)
          ))
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
        setCompetitions(data || [])
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
          const disc      = DISCIPLINE_STYLE[comp.discipline] || { bg: '#f3f4f6', col: '#6b7280', label: comp.discipline || 'Unknown' }
          const statStyle = STATUS_STYLE[comp.status]         || STATUS_STYLE.completed
          const { links, hideGenericAdmin } = getCompConfig(comp, canEnter(comp.id))
          const dateStr   = comp.start_date && comp.end_date
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
              {comp.description && comp.description !== 'null' && (
                <div style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.75rem' }}>
                  {comp.description}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {links.map(link => (
                  <button key={(link.to || link.label || Math.random())}
                    onClick={() => link.to && navigate(link.to)}
                    disabled={link.disabled}
                    style={{
                      background: link.disabled ? '#e5e7eb' : link.primary ? NAVY : 'white',
                      color: link.disabled ? '#9ca3af' : link.primary ? 'white' : NAVY,
                      border: `2px solid ${link.disabled ? '#e5e7eb' : NAVY}`,
                      padding: '0.5rem 1.1rem',
                      borderRadius: 6,
                      cursor: link.disabled ? 'default' : 'pointer',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                    }}>
                    {link.label}
                  </button>
                ))}
                {!hideGenericAdmin && (
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
                )}
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
