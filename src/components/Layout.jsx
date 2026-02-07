import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: '#1e3a8a',
        color: 'white',
        padding: '1rem 2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            🎣 RecFish ZA
          </h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem' }}>
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              style={{
                padding: '0.5rem 1rem',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 2rem'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          gap: '2rem'
        }}>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/species">Species Lookup</NavLink>
          <NavLink to="/log-catch">Log Catch</NavLink>
          <NavLink to="/my-catches">My Catches</NavLink>
        </div>
      </nav>

      {/* Main content */}
      <main style={{
        flex: 1,
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '2rem'
      }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{
        background: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
        padding: '1rem 2rem',
        textAlign: 'center',
        fontSize: '0.875rem',
        color: '#6b7280'
      }}>
        <p>RecFish ZA - South African Recreational Fishing</p>
        <p>© 2026 SADSAA | Environmental Data Collection</p>
      </footer>
    </div>
  )
}

function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      style={{
        padding: '1rem 0',
        textDecoration: 'none',
        color: '#374151',
        borderBottom: '2px solid transparent',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.target.style.color = '#1e3a8a'
        e.target.style.borderBottomColor = '#1e3a8a'
      }}
      onMouseLeave={(e) => {
        e.target.style.color = '#374151'
        e.target.style.borderBottomColor = 'transparent'
      }}
    >
      {children}
    </Link>
  )
}
