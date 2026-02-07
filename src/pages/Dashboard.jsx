import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSession } from '../contexts/SessionContext'
import ActiveSessionBanner from '../components/ActiveSessionBanner'
import StartSessionModal from '../components/StartSessionModal'
import SessionEndSummaryModal from '../components/SessionEndSummaryModal'
import GridStats from '../components/GridStats'

export default function Dashboard() {
  const { user } = useAuth()
  const { activeSession, lastEndedSession, clearLastEndedSession } = useSession()
  const [stats, setStats] = useState({
    totalCatches: 0,
    totalSpecies: 0,
    recentCatches: []
  })
  const [loading, setLoading] = useState(true)
  const [showStartSession, setShowStartSession] = useState(false)

  useEffect(() => {
    if (user) {
      loadStats()
    } else {
      setLoading(false)
    }
  }, [user])

  const loadStats = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      // Get total catches count
      const { count: totalCatches } = await supabase
        .from('catches')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      // Get unique species count
      const { data: speciesData } = await supabase
        .from('catches')
        .select('species_id')
        .eq('user_id', user.id)

      const uniqueSpecies = new Set(speciesData?.map(c => c.species_id) || [])

      // Get recent catches with species info
      const { data: recentCatches } = await supabase
        .from('catches')
        .select(`
          id,
          caught_at,
          weight_kg,
          length_cm,
          species:species_id (
            common_name,
            scientific_name,
            catalogue_name
          )
        `)
        .eq('user_id', user.id)
        .order('caught_at', { ascending: false })
        .limit(5)

      setStats({
        totalCatches: totalCatches || 0,
        totalSpecies: uniqueSpecies.size,
        recentCatches: recentCatches || []
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return (
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Please log in</h3>
        <p style={{ color: '#6b7280' }}>
          You need to be logged in to view your dashboard
        </p>
      </div>
    )
  }

  console.log('🔵 Dashboard - lastEndedSession:', lastEndedSession)

  return (
    <div>
      <ActiveSessionBanner />
      
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
        Dashboard
      </h1>

      {/* Start Session Button */}
      {!activeSession && (
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => setShowStartSession(true)}
            style={{
              padding: '1rem 2rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>🎣</span>
            Start Fishing Session
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎣</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e3a8a' }}>
            {stats.totalCatches}
          </div>
          <div style={{ color: '#6b7280' }}>Total Catches</div>
        </div>

        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🐟</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#059669' }}>
            {stats.totalSpecies}
          </div>
          <div style={{ color: '#6b7280' }}>Species Caught</div>
        </div>
      </div>

      {/* Recent Catches */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
          Recent Catches
        </h2>
        {stats.recentCatches.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
            No catches yet. Start logging your catches!
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {stats.recentCatches.map((catch_) => (
              <div
                key={catch_.id}
                style={{
                  padding: '1rem',
                  background: '#f9fafb',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                    {catch_.species?.catalogue_name || catch_.species?.common_name || 'Unknown Species'}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {new Date(catch_.caught_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {catch_.weight_kg && (
                    <div style={{ fontWeight: '600' }}>
                      {catch_.weight_kg} kg
                    </div>
                  )}
                  {catch_.length_cm && (
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {catch_.length_cm} cm
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid Statistics */}
      <div style={{ marginTop: '3rem' }}>
        <GridStats />
      </div>

      {/* Start Session Modal */}
      <StartSessionModal
        isOpen={showStartSession}
        onClose={() => setShowStartSession(false)}
      />

      {/* Session End Summary Modal - SHOWN FROM DASHBOARD! */}
      {lastEndedSession && (
        <>
          {console.log('🟢 RENDERING SessionEndSummaryModal from Dashboard!')}
          <SessionEndSummaryModal
            session={lastEndedSession}
            onClose={() => {
              console.log('🟢 Closing modal, clearing lastEndedSession')
              clearLastEndedSession()
            }}
          />
        </>
      )}
    </div>
  )
}
