import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SessionEndSummaryModal({ session, onClose }) {
  const navigate = useNavigate()
  const [catches, setCatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState(null)

  useEffect(() => {
    loadCatches()
  }, [session])

  const loadCatches = async () => {
    try {
      const { data, error } = await supabase
        .from('catches')
        .select(`
          id,
          caught_at,
          weight_kg,
          length_cm,
          length_type,
          photo_url,
          photo_thumbnail_url,
          grid_reference,
          species:species_id (
            catalogue_name,
            common_name
          )
        `)
        .eq('session_id', session.id)
        .order('caught_at', { ascending: true })

      if (error) throw error
      setCatches(data || [])
    } catch (error) {
      console.error('Error loading catches:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const goToSessions = () => {
    onClose()
    navigate('/sessions')
  }

  return (
    <>
      <div
        onClick={onClose}
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
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '2rem'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Session Ended!
            </h2>
            <p style={{ color: '#6b7280' }}>
              Here's your session summary
            </p>
          </div>

          {/* Statistics */}
          <div style={{
            background: '#f9fafb',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Duration
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                  {formatDuration(session.duration_minutes)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Total Catches
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                  {session.total_catches || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Total Weight
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                  {session.total_weight_kg?.toFixed(2) || 0} kg
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Species
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                  {session.species_count || 0}
                </div>
              </div>
            </div>

            {/* CPUE - Highlighted */}
            {session.cpue_catches_per_hour > 0 && (
              <div style={{
                background: '#dbeafe',
                padding: '1rem',
                borderRadius: '6px',
                marginTop: '1rem',
                border: '2px solid #3b82f6'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.875rem', color: '#1e40af', marginBottom: '0.5rem' }}>
                    📊 <strong>CPUE (Catch Per Unit Effort)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                    <div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e3a8a' }}>
                        {session.cpue_catches_per_hour.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>fish/hour</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e3a8a' }}>
                        {session.cpue_kg_per_hour?.toFixed(2) || 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>kg/hour</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Catches List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              Loading catches...
            </div>
          ) : catches.length > 0 ? (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                Your Catches ({catches.length}):
              </h3>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {catches.map((catch_, index) => (
                  <div
                    key={catch_.id}
                    style={{
                      background: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '6px',
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'start'
                    }}
                  >
                    {/* Photo thumbnail if available */}
                    {catch_.photo_thumbnail_url && (
                      <div
                        onClick={() => setSelectedPhoto(catch_.photo_url)}
                        style={{
                          width: '120px',
                          height: '80px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          cursor: 'pointer',
                          border: '2px solid #3b82f6',
                          background: '#f3f4f6'
                        }}
                      >
                        <img
                          src={catch_.photo_thumbnail_url}
                          alt="Catch"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    )}

                    {/* Catch details */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: '600', fontSize: '1rem' }}>
                          {index + 1}. {catch_.species?.catalogue_name || catch_.species?.common_name || 'Unknown'}
                        </span>
                        {catch_.photo_url && (
                          <span style={{ fontSize: '1rem' }}>📸</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {catch_.weight_kg && `${catch_.weight_kg} kg`}
                        {catch_.weight_kg && catch_.length_cm && ' • '}
                        {catch_.length_cm && `${catch_.length_cm} cm ${catch_.length_type || 'TL'}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                        {formatTime(catch_.caught_at)}
                        {catch_.grid_reference && ` • Grid ${catch_.grid_reference}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No catches logged during this session
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: 'white',
                color: '#6b7280',
                border: '2px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Looks Good!
            </button>
            <button
              onClick={goToSessions}
              style={{
                flex: 1,
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
              📊 View All Sessions
            </button>
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '2rem'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
            <img
              src={selectedPhoto}
              alt="Full size catch"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                borderRadius: '8px'
              }}
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'white',
                color: 'black',
                border: 'none',
                borderRadius: '4px',
                padding: '0.5rem 1rem',
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
    </>
  )
}
