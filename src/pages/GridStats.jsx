import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function GridStats() {
  const { user } = useAuth()
  const [gridData, setGridData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGridStats()
  }, [user])

  const loadGridStats = async () => {
    try {
      // Get all catches with grid references
      const { data, error } = await supabase
        .from('catches')
        .select(`
          grid_reference,
          weight_kg,
          species_id,
          caught_at,
          session_id
        `)
        .eq('user_id', user.id)
        .not('grid_reference', 'is', null)

      if (error) throw error

      // Aggregate by grid
      const gridMap = new Map()
      
      data.forEach(catch_) => {
        const grid = catch_.grid_reference
        if (!gridMap.has(grid)) {
          gridMap.set(grid, {
            grid_reference: grid,
            total_catches: 0,
            total_weight: 0,
            species: new Set(),
            sessions: new Set(),
            first_catch: catch_.caught_at,
            last_catch: catch_.caught_at
          })
        }
        
        const stats = gridMap.get(grid)
        stats.total_catches++
        stats.total_weight += catch_.weight_kg || 0
        stats.species.add(catch_.species_id)
        if (catch_.session_id) stats.sessions.add(catch_.session_id)
        
        // Update date range
        if (new Date(catch_.caught_at) < new Date(stats.first_catch)) {
          stats.first_catch = catch_.caught_at
        }
        if (new Date(catch_.caught_at) > new Date(stats.last_catch)) {
          stats.last_catch = catch_.caught_at
        }
      })

      // Convert to array and calculate averages
      const gridStats = Array.from(gridMap.values()).map(stat => ({
        ...stat,
        species_count: stat.species.size,
        session_count: stat.sessions.size,
        avg_weight: stat.total_weight / stat.total_catches,
        cpue: stat.total_catches / (stat.session_count || 1)
      }))

      // Sort by total catches descending
      gridStats.sort((a, b) => b.total_catches - a.total_catches)

      setGridData(gridStats)
    } catch (error) {
      console.error('Error loading grid stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading grid statistics...</div>
  }

  if (gridData.length === 0) {
    return (
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No grid data yet</h3>
        <p style={{ color: '#6b7280' }}>
          Log catches with grid references to see statistics by area
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        📊 Grid Performance Analysis
      </h2>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Your catch statistics by grid reference
      </p>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {gridData.map((grid) => (
          <div
            key={grid.grid_reference}
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'start',
              marginBottom: '1rem'
            }}>
              <div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  letterSpacing: '0.1em',
                  color: '#1e3a8a'
                }}>
                  {grid.grid_reference}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {new Date(grid.first_catch).toLocaleDateString()} - {new Date(grid.last_catch).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
                  {grid.total_catches}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>catches</div>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                background: '#f3f4f6',
                padding: '0.75rem',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Total Weight
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                  {grid.total_weight.toFixed(2)} kg
                </div>
              </div>

              <div style={{
                background: '#dbeafe',
                padding: '0.75rem',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.25rem' }}>
                  Avg Weight
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e3a8a' }}>
                  {grid.avg_weight.toFixed(2)} kg
                </div>
              </div>

              <div style={{
                background: '#dcfce7',
                padding: '0.75rem',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '0.25rem' }}>
                  Species
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#15803d' }}>
                  {grid.species_count}
                </div>
              </div>

              <div style={{
                background: '#fef3c7',
                padding: '0.75rem',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#92400e', marginBottom: '0.25rem' }}>
                  CPUE
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#b45309' }}>
                  {grid.cpue.toFixed(1)}/session
                </div>
              </div>

              <div style={{
                background: '#f3e8ff',
                padding: '0.75rem',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#6b21a8', marginBottom: '0.25rem' }}>
                  Sessions
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#7c3aed' }}>
                  {grid.session_count}
                </div>
              </div>
            </div>

            <div style={{
              fontSize: '0.875rem',
              color: '#059669',
              fontWeight: '500'
            }}>
              ✨ Top performing grid
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
