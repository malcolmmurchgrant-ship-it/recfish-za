import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Heat map colour scale ─────────────────────────────────────────────────────
// Ocean-themed: pale blue → deep teal → rich navy
const heatColour = (count, max) => {
  if (max === 0) return 'rgba(100,180,200,0.15)'
  const t = Math.min(count / max, 1)
  // 0 → sky blue, 0.5 → teal, 1 → deep navy
  if (t < 0.33) {
    const u = t / 0.33
    return `rgba(${Math.round(100 + u * 0)},${Math.round(180 - u * 40)},${Math.round(200 + u * 10)},${0.25 + u * 0.25})`
  } else if (t < 0.66) {
    const u = (t - 0.33) / 0.33
    return `rgba(${Math.round(100 - u * 50)},${Math.round(140 - u * 60)},${Math.round(210 - u * 30)},${0.5 + u * 0.2})`
  } else {
    const u = (t - 0.66) / 0.34
    return `rgba(${Math.round(50 - u * 20)},${Math.round(80 - u * 50)},${Math.round(180 - u * 50)},${0.7 + u * 0.25})`
  }
}

const heatColourSolid = (count, max) => {
  if (max === 0) return '#c7e8f0'
  const t = Math.min(count / max, 1)
  if (t < 0.33) return '#64b4c8'
  if (t < 0.66) return '#2a7a9e'
  if (t < 0.85) return '#1a4f7c'
  return '#0a2342'
}

export default function CatchMap() {
  const { user } = useAuth()
  const mapRef = useRef(null)
  const leafletMapRef = useRef(null)
  const layersRef = useRef([])

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalCatches: 0, cellsWithCatches: 0, topSpecies: '' })
  const [selectedCell, setSelectedCell] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all') // all | competition | social

  useEffect(() => {
    loadLeaflet()
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (leafletMapRef.current) loadData()
  }, [activeFilter])

  const loadLeaflet = () => {
    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(link)
    }
    // Inject Leaflet JS
    if (window.L) { initMap(); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = initMap
    document.head.appendChild(script)
  }

  const initMap = () => {
    if (leafletMapRef.current || !mapRef.current) return

    const map = window.L.map(mapRef.current, {
      center: [-33.5, 25.0], // centred on SA coastline
      zoom: 6,
      zoomControl: true,
      attributionControl: true
    })

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 14
    }).addTo(map)

    leafletMapRef.current = map
    loadData()
  }

  const loadData = async () => {
    if (!user || !leafletMapRef.current) return
    setLoading(true)
    setSelectedCell(null)

    // Clear existing layers
    layersRef.current.forEach(l => leafletMapRef.current.removeLayer(l))
    layersRef.current = []

    try {
      // Build query based on filter
      let query = supabase
        .from('catches')
        .select(`
          fine_grid_id,
          coarse_grid_id,
          species:species_id ( common_name, catalogue_name )
        `)
        .eq('user_id', user.id)
        .not('fine_grid_id', 'is', null)

      if (activeFilter === 'competition') {
        query = query.eq('is_competition_entry', true)
      } else if (activeFilter === 'social') {
        query = query.eq('is_competition_entry', false)
      }

      const { data: catches, error } = await query
      if (error) throw error

      if (!catches || catches.length === 0) {
        setLoading(false)
        setStats({ totalCatches: 0, cellsWithCatches: 0, topSpecies: '—' })
        return
      }

      // Aggregate catches by fine_grid_id
      const cellMap = {}
      const speciesCount = {}

      catches.forEach(c => {
        const id = c.fine_grid_id
        if (!cellMap[id]) cellMap[id] = { count: 0, species: {} }
        cellMap[id].count++
        const sp = c.species?.catalogue_name || c.species?.common_name || 'Unknown'
        cellMap[id].species[sp] = (cellMap[id].species[sp] || 0) + 1
        speciesCount[sp] = (speciesCount[sp] || 0) + 1
      })

      // Also aggregate competition catches
      const { data: compCatches } = await supabase
        .from('competition_catches')
        .select('fine_grid_id, species_name')
        .eq('angler_id', user.id)
        .not('fine_grid_id', 'is', null)

      if (compCatches && activeFilter !== 'social') {
        compCatches.forEach(c => {
          const id = c.fine_grid_id
          if (!cellMap[id]) cellMap[id] = { count: 0, species: {} }
          cellMap[id].count++
          const sp = c.species_name || 'Unknown'
          cellMap[id].species[sp] = (cellMap[id].species[sp] || 0) + 1
          speciesCount[sp] = (speciesCount[sp] || 0) + 1
        })
      }

      const cellIds = Object.keys(cellMap).map(Number)
      if (cellIds.length === 0) {
        setLoading(false)
        setStats({ totalCatches: catches.length, cellsWithCatches: 0, topSpecies: '—' })
        return
      }

      // Fetch grid cell coordinates
      const { data: gridCells, error: gridError } = await supabase
        .from('grid_fine')
        .select('id, lon_min, lon_max, lat_min, lat_max')
        .in('id', cellIds)

      if (gridError) throw gridError

      const maxCount = Math.max(...Object.values(cellMap).map(c => c.count))
      const map = leafletMapRef.current
      const bounds = []

      gridCells.forEach(cell => {
        const data = cellMap[cell.id]
        if (!data) return

        const colour = heatColour(data.count, maxCount)
        const solidColour = heatColourSolid(data.count, maxCount)

        const polygon = window.L.polygon([
          [cell.lat_min, cell.lon_min],
          [cell.lat_min, cell.lon_max],
          [cell.lat_max, cell.lon_max],
          [cell.lat_max, cell.lon_min]
        ], {
          fillColor: solidColour,
          fillOpacity: data.count / maxCount < 0.15 ? 0.25 : 0.6,
          color: solidColour,
          weight: 0.5,
          opacity: 0.7
        })

        // Build species breakdown for popup
        const topSpecies = Object.entries(data.species)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([sp, n]) => `<div style="display:flex;justify-content:space-between;gap:1rem;padding:2px 0;border-bottom:1px solid #f0f0f0">
            <span style="color:#374151">${sp}</span>
            <strong style="color:#1e3a8a">${n}</strong>
          </div>`)
          .join('')

        polygon.bindPopup(`
          <div style="font-family:Arial,sans-serif;min-width:180px">
            <div style="font-weight:700;color:#1e3a8a;font-size:1rem;margin-bottom:4px">
              Grid ${cell.id}
            </div>
            <div style="font-size:0.8rem;color:#6b7280;margin-bottom:8px">
              ${data.count} catch${data.count !== 1 ? 'es' : ''}
            </div>
            ${topSpecies}
          </div>
        `, { maxWidth: 250 })

        polygon.on('click', () => {
          setSelectedCell({
            id: cell.id,
            count: data.count,
            species: data.species,
            lat_min: cell.lat_min,
            lat_max: cell.lat_max,
            lon_min: cell.lon_min,
            lon_max: cell.lon_max
          })
        })

        polygon.on('mouseover', () => {
          polygon.setStyle({ fillOpacity: 0.85, weight: 1.5 })
        })
        polygon.on('mouseout', () => {
          polygon.setStyle({
            fillOpacity: data.count / maxCount < 0.15 ? 0.25 : 0.6,
            weight: 0.5
          })
        })

        polygon.addTo(map)
        layersRef.current.push(polygon)
        bounds.push([cell.lat_min, cell.lon_min])
        bounds.push([cell.lat_max, cell.lon_max])
      })

      // Fit map to catch area
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40] })
      }

      // Top species
      const topSp = Object.entries(speciesCount)
        .sort((a, b) => b[1] - a[1])[0]

      setStats({
        totalCatches: catches.length + (compCatches?.length || 0),
        cellsWithCatches: cellIds.length,
        topSpecies: topSp ? `${topSp[0]} (${topSp[1]})` : '—'
      })

    } catch (err) {
      console.error('Map load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Colour scale legend ────────────────────────────────────────────────────
  const legendStops = [
    { label: '1', color: '#64b4c8' },
    { label: 'Some', color: '#2a7a9e' },
    { label: 'Many', color: '#1a4f7c' },
    { label: 'Most', color: '#0a2342' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>

      {/* Header */}
      <div style={{ background: '#0a2342', padding: '1rem 1.5rem', color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', letterSpacing: '-0.01em' }}>
          🗺 My Catch Map
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#7fb8cc' }}>
          Catch density by SAN chart grid cell · GPS privacy protected
        </p>
      </div>

      {/* Filter tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 1.5rem', display: 'flex', gap: 0 }}>
        {[
          { key: 'all', label: '🎣 All Catches' },
          { key: 'competition', label: '🏆 Competition' },
          { key: 'social', label: '📝 Personal Log' },
        ].map(f => (
          <button key={f.key} onClick={() => setActiveFilter(f.key)} style={{
            padding: '0.65rem 1.1rem', border: 'none', background: 'transparent',
            fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
            borderBottom: activeFilter === f.key ? '3px solid #0a2342' : '3px solid transparent',
            color: activeFilter === f.key ? '#0a2342' : '#6b7280',
            transition: 'all 0.15s'
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div style={{ background: 'white', padding: '0.75rem 1.5rem', display: 'flex', gap: '2rem', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Catches Mapped', value: stats.totalCatches },
          { label: 'Grid Cells', value: stats.cellsWithCatches },
          { label: 'Top Species', value: stats.topSpecies },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0a2342' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Map + sidebar layout */}
      <div style={{ display: 'flex', height: 'calc(100vh - 200px)', minHeight: '400px' }}>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* Loading overlay */}
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, flexDirection: 'column', gap: '0.75rem'
            }}>
              <div style={{ width: '2rem', height: '2rem', border: '3px solid #e5e7eb', borderTopColor: '#0a2342', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading your catch map...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* No data message */}
          {!loading && stats.cellsWithCatches === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 500, pointerEvents: 'none'
            }}>
              <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗺️</div>
                <div style={{ fontWeight: '700', color: '#0a2342', marginBottom: '0.25rem' }}>No mapped catches yet</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Log catches with GPS to see your heat map</div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: '2rem', left: '1rem', zIndex: 500,
            background: 'white', borderRadius: '8px', padding: '0.75rem 1rem',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)', minWidth: '140px'
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
              Catch Density
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.35rem' }}>
              {legendStops.map(s => (
                <div key={s.label} style={{ flex: 1, height: '10px', background: s.color, borderRadius: '2px' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af' }}>
              <span>Low</span><span>High</span>
            </div>
          </div>

          {/* Data quality note */}
          <div style={{
            position: 'absolute', bottom: '2rem', right: '1rem', zIndex: 500,
            background: 'rgba(10,35,66,0.85)', borderRadius: '6px', padding: '0.5rem 0.75rem',
            fontSize: '0.72rem', color: '#a8d8ea', maxWidth: '200px', lineHeight: '1.4'
          }}>
            🔒 Exact GPS coordinates are private. Map shows 5′×5′ SAN grid cells only.
          </div>
        </div>

        {/* Selected cell sidebar */}
        {selectedCell && (
          <div style={{
            width: '260px', background: 'white', borderLeft: '1px solid #e5e7eb',
            padding: '1.25rem', overflowY: 'auto', flexShrink: 0
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#0a2342' }}>
                  Grid {selectedCell.id}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.15rem' }}>
                  {Math.abs(selectedCell.lat_max).toFixed(2)}°S – {Math.abs(selectedCell.lat_min).toFixed(2)}°S<br />
                  {selectedCell.lon_min.toFixed(2)}°E – {selectedCell.lon_max.toFixed(2)}°E
                </div>
              </div>
              <button onClick={() => setSelectedCell(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.25rem', lineHeight: 1 }}>
                ×
              </button>
            </div>

            <div style={{ background: '#eff6ff', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0a2342' }}>{selectedCell.count}</div>
              <div style={{ fontSize: '0.78rem', color: '#3b82f6' }}>catch{selectedCell.count !== 1 ? 'es' : ''} in this cell</div>
            </div>

            <div style={{ fontWeight: '600', fontSize: '0.8rem', color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Species
            </div>
            {Object.entries(selectedCell.species)
              .sort((a, b) => b[1] - a[1])
              .map(([sp, n]) => (
                <div key={sp} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6'
                }}>
                  <span style={{ fontSize: '0.85rem', color: '#374151' }}>{sp}</span>
                  <span style={{
                    background: '#0a2342', color: 'white', borderRadius: '10px',
                    padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: '700'
                  }}>{n}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
