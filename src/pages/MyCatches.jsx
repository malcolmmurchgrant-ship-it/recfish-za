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

  const downloadCSV = () => {
    const headers = ['Date', 'Species', 'Scientific Name', 'Weight (kg)', 'Length (cm)', 'Released', 'Notes']
    const rows = catches.map(c => [
      new Date(c.caught_at).toLocaleDateString('en-ZA'),
      c.species?.catalogue_name || c.species?.common_name || 'Unknown',
      c.species?.scientific_name || '',
      c.weight_kg || '',
      c.length_cm || '',
      c.released ? 'Yes' : 'No',
      c.notes || ''
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `RecFishZA_MyCatches_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPDF = () => {
    // Build printable HTML and open in new window for browser print-to-PDF
    const rows = catches.map((c, i) => `
      <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
        <td>${new Date(c.caught_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
        <td><strong>${c.species?.catalogue_name || c.species?.common_name || 'Unknown'}</strong><br/><em style="color:#6b7280;font-size:0.8em">${c.species?.scientific_name || ''}</em></td>
        <td>${c.weight_kg ? c.weight_kg + ' kg' : '—'}</td>
        <td>${c.length_cm ? c.length_cm + ' cm' : '—'}</td>
        <td>${c.released ? '<span style="color:#065f46;background:#d1fae5;padding:2px 6px;border-radius:4px;font-size:0.8em">Released</span>' : '—'}</td>
        <td style="color:#6b7280;font-size:0.85em">${c.notes || ''}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><title>My Catches — RecFish ZA</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #1f2937; margin: 24px; }
      h1 { color: #1e3a8a; font-size: 22px; margin-bottom: 4px; }
      .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
      .stats { display: flex; gap: 24px; margin-bottom: 20px; padding: 12px 16px; background: #eff6ff; border-radius: 8px; }
      .stat label { font-size: 11px; color: #6b7280; display: block; }
      .stat span { font-size: 18px; font-weight: bold; color: #1e3a8a; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1e3a8a; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
      td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
      .footer { margin-top: 20px; color: #9ca3af; font-size: 11px; text-align: center; }
      @media print { body { margin: 12px; } }
    </style></head><body>
    <h1>My Catches — RecFish ZA</h1>
    <div class="subtitle">Generated ${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    <div class="stats">
      <div class="stat"><label>Total Catches</label><span>${stats.total}</span></div>
      <div class="stat"><label>Released</label><span>${stats.released}</span></div>
      <div class="stat"><label>Total Weight</label><span>${stats.totalWeight.toFixed(1)} kg</span></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Species</th><th>Weight</th><th>Length</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">RecFish ZA • recfish-za.netlify.app</div>
    <script>window.onload = () => window.print()</script>
    </body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>My Catches</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>Your personal fishing log</p>
        </div>
        {catches.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={downloadCSV} style={{ padding: '0.5rem 1rem', background: '#166534', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
              ⬇ CSV
            </button>
            <button onClick={downloadPDF} style={{ padding: '0.5rem 1rem', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
              ⬇ PDF
            </button>
          </div>
        )}
      </div>

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
