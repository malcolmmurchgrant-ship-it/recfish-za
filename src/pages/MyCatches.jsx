import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function MyCatches() {
  const { user } = useAuth()
  const [catches, setCatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    released: 0,
    totalWeight: 0
  })

  useEffect(() => {
    loadCatches()
  }, [user])

  const loadCatches = async () => {
    try {
      const { data, error } = await supabase
        .from('catches')
        .select(`
          id,
          caught_at,
          weight_kg,
          length_cm,
          released,
          notes,
          species:species_id (
            common_name,
            catalogue_name,
            scientific_name,
            afrikaans_name
          )
        `)
        .eq('user_id', user.id)
        .order('caught_at', { ascending: false })

      if (error) throw error

      setCatches(data || [])

      // Calculate stats
      const total = data?.length || 0
      const released = data?.filter(c => c.released).length || 0
      const totalWeight = data?.reduce((sum, c) => sum + (c.weight_kg || 0), 0) || 0

      setStats({ total, released, totalWeight })
    } catch (error) {
      console.error('Error loading catches:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteCatch = async (catchId) => {
    if (!confirm('Are you sure you want to delete this catch?')) return

    try {
      const { error } = await supabase
        .from('catches')
        .delete()
        .eq('id', catchId)

      if (error) throw error

      loadCatches() // Reload the list
    } catch (error) {
      console.error('Error deleting catch:', error)
      alert('Error deleting catch: ' + error.message)
    }
  }

  if (loading) {
    return <div>Loading your catches...</div>
  }

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        My Catches
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Your personal fishing log
      </p>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            Total Catches
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e3a8a' }}>
            {stats.total}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            Released
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
            {stats.released}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            Total Weight
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
            {stats.totalWeight.toFixed(1)} kg
          </div>
        </div>
      </div>

      {/* Catches List */}
      {catches.length === 0 ? (
        <div style={{
          background: 'white',
          padding: '3rem',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎣</div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No catches yet</h3>
          <p style={{ color: '#6b7280' }}>Start logging your catches to build your fishing history!</p>
        </div>
      ) : (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {catches.map((catch_, index) => (
            <div
              key={catch_.id}
              style={{
                padding: '1.5rem',
                borderBottom: index < catches.length - 1 ? '1px solid #e5e7eb' : 'none'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                gap: '1rem'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.5rem'
                  }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
                      {catch_.species?.catalogue_name || catch_.species?.common_name || 'Unknown Species'}
                    </h3>
                    {catch_.released && (
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        background: '#d1fae5',
                        color: '#065f46',
                        borderRadius: '4px',
                        fontWeight: '500'
                      }}>
                        Released
                      </span>
                    )}
                  </div>

                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    fontStyle: 'italic',
                    marginBottom: '0.75rem'
                  }}>
                    {catch_.species?.scientific_name}
                  </p>

                  <div style={{
                    display: 'flex',
                    gap: '1.5rem',
                    fontSize: '0.875rem',
                    color: '#374151'
                  }}>
                    <div>
                      <strong>Date:</strong>{' '}
                      {new Date(catch_.caught_at).toLocaleDateString('en-ZA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    {catch_.weight_kg && (
                      <div>
                        <strong>Weight:</strong> {catch_.weight_kg} kg
                      </div>
                    )}
                    {catch_.length_cm && (
                      <div>
                        <strong>Length:</strong> {catch_.length_cm} cm
                      </div>
                    )}
                  </div>

                  {catch_.notes && (
                    <p style={{
                      marginTop: '0.75rem',
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      fontStyle: 'italic'
                    }}>
                      "{catch_.notes}"
                    </p>
                  )}
                </div>

                <button
                  onClick={() => deleteCatch(catch_.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#fee2e2',
                    color: '#991b1b',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#fecaca'}
                  onMouseLeave={(e) => e.target.style.background = '#fee2e2'}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
