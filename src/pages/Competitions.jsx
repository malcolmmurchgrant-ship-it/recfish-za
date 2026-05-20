import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAVY = '#1e3a8a'

const competitions = [
  {
    id: 'allcoastals',
    title: 'SADSAA All Coastal Bottomfish 2026',
    subtitle: 'Inter-Provincial · St Francis Bay',
    status: 'active',
    statusLabel: '🟢 Live',
    description: '12 teams · 36 anglers · 10 boats · 3 fishing days · 32 species',
    links: [
      { to: '/allcoastals',        label: '🎣 Enter Catches',   primary: true  },
      { to: '/allcoastals-scores', label: '📊 Live Scoreboard', primary: false },
    ],
  },
  {
    id: 'junior-gamefish',
    title: 'SADSAA Junior Gamefish Nationals 2026',
    subtitle: 'Sodwana Bay',
    status: 'upcoming',
    statusLabel: '🔵 Upcoming',
    description: 'Junior gamefish competition — weight-based scoring',
    links: [
      { to: '/competition', label: '🎣 Catch Logger', primary: true },
    ],
  },
]

export default function Competitions() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: NAVY, color: 'white', padding: '1.25rem 1.5rem', borderRadius: 8, marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>🏆 SADSAA Competitions</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: 3 }}>
          Select a competition to enter catches or view results
        </div>
      </div>

      {/* Competition cards */}
      {competitions.map(comp => (
        <div key={comp.id} style={{
          background: 'white',
          borderRadius: 10,
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          marginBottom: '1rem',
          borderLeft: `5px solid ${comp.status === 'active' ? '#16a34a' : '#6b7280'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: NAVY }}>{comp.title}</div>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 2 }}>{comp.subtitle}</div>
            </div>
            <span style={{
              fontSize: '0.78rem', fontWeight: 700,
              background: comp.status === 'active' ? '#dcfce7' : '#f3f4f6',
              color: comp.status === 'active' ? '#16a34a' : '#6b7280',
              padding: '0.25rem 0.75rem', borderRadius: 20,
            }}>
              {comp.statusLabel}
            </span>
          </div>

          <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '1rem' }}>
            {comp.description}
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {comp.links.map(link => (
              <button key={link.to} onClick={() => navigate(link.to)}
                style={{
                  background: link.primary ? NAVY : 'white',
                  color: link.primary ? 'white' : NAVY,
                  border: `2px solid ${NAVY}`,
                  padding: '0.5rem 1.1rem',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                }}>
                {link.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Admin shortcut — subtle, at the bottom */}
      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <button onClick={() => navigate('/allcoastals-admin')}
          style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}>
          ⚙️ All Coastals Admin Panel
        </button>
      </div>

    </div>
  )
}
