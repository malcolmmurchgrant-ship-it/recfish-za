import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSession } from '../contexts/SessionContext'

export default function Sessions() {
  const { user } = useAuth()
  const { activeSession } = useSession()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState(null)

  useEffect(() => {
    if (user) {
      loadSessions()
    }
  }, [user, activeSession])

  const loadSessions = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('fishing_sessions')
        .select(`
          *,
          catches (
            id,
            weight_kg,
            length_cm,
            species:species_id (
              catalogue_name,
              common_name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })

      if (error) throw error
      setSessions(data || [])
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  if (loading) {
    return <div>Loading sessions...</div>
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
          You need to be logged in to view your sessions
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Fishing Sessions
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        View your fishing session history and CPUE statistics
      </p>

      {sessions.length === 0 ? (
        <div style={{
          background: 'white',
          padding: '3rem',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎣</div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No sessions yet</h3>
          <p style={{ color: '#6b7280' }}>
            Start a fishing session from the Dashboard to begin tracking CPUE
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setSelectedSession(session)}
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                marginBottom: '1rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                      {formatDate(session.start_time)}
                    </h3>
                    {session.is_active && (
                      <span style={{
                        background: '#10b981',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {formatTime(session.start_time)} - {session.end_time ? formatTime(session.end_time) : 'Ongoing'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e3a8a' }}>
                    {session.total_catches || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>catches</div>
                </div>
              </div>

              {session.location_description && (
                <div style={{ marginBottom: '0.75rem', color: '#6b7280' }}>
                  📍 {session.location_description}
                </div>
              )}

              {session.grid_reference && (
                <div style={{ marginBottom: '0.75rem', color: '#1e3a8a', fontWeight: '600', fontFamily: 'monospace', fontSize: '1rem' }}>
                  🗺️ Grid: {session.grid_reference}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{
                  background: '#f3f4f6',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}>
                  ⏱️ {formatDuration(session.duration_minutes)}
                </div>

                {session.total_weight_kg > 0 && (
                  <div style={{
                    background: '#fef3c7',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    color: '#92400e'
                  }}>
                    ⚖️ {session.total_weight_kg.toFixed(2)} kg
                  </div>
                )}

                {session.cpue_catches_per_hour > 0 && (
                  <div style={{
                    background: '#dbeafe',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    color: '#1e40af'
                  }}>
                    📊 CPUE: {session.cpue_catches_per_hour.toFixed(2)}/hr
                  </div>
                )}

                {session.species_count > 0 && (
                  <div style={{
                    background: '#dcfce7',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    color: '#166534'
                  }}>
                    🐟 {session.species_count} species
                  </div>
                )}
              </div>

              {(session.weather_conditions || session.sea_state) && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  {session.weather_conditions && `${session.weather_conditions}`}
                  {session.weather_conditions && session.sea_state && ' • '}
                  {session.sea_state && `${session.sea_state} seas`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div
          onClick={() => setSelectedSession(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '2rem'
            }}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Session Details
            </h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                {formatDate(selectedSession.start_time)}
              </div>
              <div style={{ color: '#6b7280' }}>
                {formatTime(selectedSession.start_time)} - {selectedSession.end_time ? formatTime(selectedSession.end_time) : 'Ongoing'}
              </div>
            </div>

            {/* Statistics */}
            <div style={{
              background: '#f9fafb',
              padding: '1.5rem',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Statistics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Duration</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                    {formatDuration(selectedSession.duration_minutes)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Catches</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                    {selectedSession.total_catches}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Weight</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                    {selectedSession.total_weight_kg?.toFixed(2) || 0} kg
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Species</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                    {selectedSession.species_count}
                  </div>
                </div>
                {selectedSession.cpue_catches_per_hour > 0 && (
                  <>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>CPUE (catches/hr)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e3a8a' }}>
                        {selectedSession.cpue_catches_per_hour.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>CPUE (kg/hr)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e3a8a' }}>
                        {selectedSession.cpue_kg_per_hour?.toFixed(2) || 0}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Conditions */}
            {(selectedSession.weather_conditions || selectedSession.sea_state || selectedSession.location_description || selectedSession.grid_reference) && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '0.75rem' }}>Conditions</h3>
                {selectedSession.location_description && (
                  <p><strong>Location:</strong> {selectedSession.location_description}</p>
                )}
                {selectedSession.grid_reference && (
                  <p style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: '#1e3a8a' }}>
                    <strong>Grid:</strong> {selectedSession.grid_reference}
                  </p>
                )}
                {selectedSession.weather_conditions && (
                  <p><strong>Weather:</strong> {selectedSession.weather_conditions}</p>
                )}
                {selectedSession.sea_state && (
                  <p><strong>Sea State:</strong> {selectedSession.sea_state}</p>
                )}
                {selectedSession.water_temp_c && (
                  <p><strong>Water Temp:</strong> {selectedSession.water_temp_c}°C</p>
                )}
                {selectedSession.wind_direction && selectedSession.wind_speed_knots && (
                  <p><strong>Wind:</strong> {selectedSession.wind_direction} {selectedSession.wind_speed_knots} knots</p>
                )}
              </div>
            )}

            {/* Catches */}
            {selectedSession.catches && selectedSession.catches.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '0.75rem' }}>
                  Catches ({selectedSession.catches.length})
                </h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {selectedSession.catches.map((catch_) => (
                    <div
                      key={catch_.id}
                      style={{
                        background: '#f9fafb',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <strong>{catch_.species?.catalogue_name || catch_.species?.common_name || 'Unknown'}</strong>
                      {catch_.weight_kg && ` • ${catch_.weight_kg} kg`}
                      {catch_.length_cm && ` • ${catch_.length_cm} cm`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setSelectedSession(null)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
