import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../contexts/SessionContext'
import SessionEndSummaryModal from './SessionEndSummaryModal'

export default function ActiveSessionBanner() {
  const { activeSession, elapsedTime, formatDuration, endSession, clearSession } = useSession()
  const [showEndModal, setShowEndModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [endedSession, setEndedSession] = useState(null)

  if (!activeSession) return null

  const handleEndSession = async () => {
    if (!confirm('End this fishing session? Statistics will be calculated.')) {
      return
    }

    setLoading(true)
    
    try {
      // End the session
      const result = await endSession(activeSession.id)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to end session')
      }

      // Wait a moment for database function to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      // Fetch the updated session with calculated stats
      const { data, error } = await supabase
        .from('fishing_sessions')
        .select('*')
        .eq('id', activeSession.id)
        .single()
      
      if (error) {
        console.error('Error fetching session:', error)
        throw error
      }

      if (data) {
        // Force state update by creating new object
        setEndedSession({ ...data, _timestamp: Date.now() })
      } else {
        alert('Session ended! Go to Sessions page to view statistics.')
      }
    } catch (error) {
      console.error('Error ending session:', error)
      alert('Error ending session: ' + error.message + '\n\nThe session may have ended but stats need to be recalculated. Check Sessions page.')
    } finally {
      setLoading(false)
    }
  }

  const handleClearSession = () => {
    if (confirm('This will remove the session banner. The session may still exist in the database. Continue?')) {
      clearSession()
    }
  }

  const handleCloseModal = () => {
    setEndedSession(null)
  }

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: 'white',
        padding: '1rem',
        marginBottom: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem'
            }}>
              <span style={{ fontSize: '1.5rem' }}>🎣</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
                  Active Fishing Session
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                  {elapsedTime > 0 && formatDuration(elapsedTime)}
                </div>
              </div>
            </div>

            {activeSession.location_description && (
              <div style={{
                fontSize: '0.875rem',
                opacity: 0.9,
                marginTop: '0.5rem'
              }}>
                📍 {activeSession.location_description}
              </div>
            )}

            {activeSession.grid_reference && (
              <div style={{
                fontSize: '0.875rem',
                opacity: 0.9,
                marginTop: '0.25rem',
                fontFamily: 'monospace'
              }}>
                🗺️ Grid: {activeSession.grid_reference}
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={handleClearSession}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '4px',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Clear
            </button>

            <button
              onClick={handleEndSession}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.95)',
                color: loading ? '#9ca3af' : '#059669',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.background = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.95)'
              }}
            >
              {loading ? 'Ending...' : '⏹ End Session'}
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div style={{
          marginTop: '0.75rem',
          fontSize: '0.875rem',
          opacity: 0.9,
          fontStyle: 'italic'
        }}>
          💡 All catches logged during this session will be linked for CPUE tracking
        </div>
      </div>

      {/* Session End Summary Modal */}
      {endedSession && (
        <SessionEndSummaryModal
          session={endedSession}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}
