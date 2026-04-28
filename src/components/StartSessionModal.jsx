import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../contexts/SessionContext'

export default function StartSessionModal({ isOpen, onClose }) {
  const { startSession } = useSession()
  const [loading, setLoading] = useState(false)
  const [launchSites, setLaunchSites] = useState([])
  const [launchSearch, setLaunchSearch] = useState('')
  const [showLaunchDropdown, setShowLaunchDropdown] = useState(false)
  const [selectedLaunchSite, setSelectedLaunchSite] = useState(null)
  const [formData, setFormData] = useState({
    location_description: '',
    grid_reference: '',
    launch_site_id: null,
    fine_grid_id: null,
    coarse_grid_id: null,
    weather_conditions: '',
    sea_state: '',
    water_temp_c: '',
    wind_direction: '',
    wind_speed_knots: '',
    boat_name: '',
    session_type: 'recreational',
    notes: ''
  })

  useEffect(() => {
    loadLaunchSites()
  }, [])

  const loadLaunchSites = async () => {
    const { data } = await supabase
      .from('launch_sites')
      .select('id, name, coastal_area, fine_grid_id, coarse_grid_id')
      .order('coastal_area', { ascending: true })
      .order('name', { ascending: true })
    setLaunchSites(data || [])
  }

  const filteredSites = launchSites.filter(s =>
    s.name.toLowerCase().includes(launchSearch.toLowerCase()) ||
    (s.coastal_area || '').toLowerCase().includes(launchSearch.toLowerCase())
  ).slice(0, 10)

  const selectLaunchSite = (site) => {
    setSelectedLaunchSite(site)
    setLaunchSearch(site.name)
    setShowLaunchDropdown(false)
    setFormData(f => ({
      ...f,
      launch_site_id: site.id,
      fine_grid_id: site.fine_grid_id,
      coarse_grid_id: site.coarse_grid_id,
      location_description: site.name,
      grid_reference: site.fine_grid_id ? String(site.fine_grid_id) : f.grid_reference
    }))
  }

  const clearLaunchSite = () => {
    setSelectedLaunchSite(null)
    setLaunchSearch('')
    setFormData(f => ({
      ...f,
      launch_site_id: null,
      fine_grid_id: null,
      coarse_grid_id: null
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const sessionData = {
      ...formData,
      water_temp_c: formData.water_temp_c ? parseFloat(formData.water_temp_c) : null,
      wind_speed_knots: formData.wind_speed_knots ? parseInt(formData.wind_speed_knots) : null,
      grid_reference: formData.grid_reference || null,
      launch_site_id: formData.launch_site_id || null,
      fine_grid_id: formData.fine_grid_id || null,
      coarse_grid_id: formData.coarse_grid_id || null
    }

    const result = await startSession(sessionData)

    if (result.success) {
      alert('Fishing session started! 🎣')
      onClose()
    } else {
      alert('Error starting session: ' + result.error)
    }

    setLoading(false)
  }

  if (!isOpen) return null

  return (
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
          maxWidth: '700px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '2rem'
        }}
      >
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          🎣 Start Fishing Session
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          Log session details to track CPUE and conditions
        </p>

        <form onSubmit={handleSubmit}>
          {/* Location */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Location Description
            </label>
            <input
              type="text"
              value={formData.location_description}
              onChange={(e) => setFormData({ ...formData, location_description: e.target.value })}
              placeholder="e.g., Off Hout Bay, 2nm from shore"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>

          {/* Launch Site Selector */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Launch Site <span style={{ color: '#6b7280', fontWeight: '400', fontSize: '0.85rem' }}>— auto-assigns grid reference</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={launchSearch}
                  onChange={(e) => { setLaunchSearch(e.target.value); setShowLaunchDropdown(true) }}
                  onFocus={() => setShowLaunchDropdown(true)}
                  placeholder="Search launch site or coastal area..."
                  style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '1rem' }}
                />
                {selectedLaunchSite && (
                  <button type="button" onClick={clearLaunchSite}
                    style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>
                    ✕
                  </button>
                )}
              </div>
              {showLaunchDropdown && launchSearch.length > 1 && filteredSites.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white',
                  border: '1px solid #d1d5db', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 100, maxHeight: '220px', overflow: 'auto' }}>
                  {filteredSites.map(site => (
                    <div key={site.id} onClick={() => selectLaunchSite(site)}
                      style={{ padding: '0.6rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{site.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                        {site.coastal_area}
                        {site.fine_grid_id && <span style={{ marginLeft: '0.5rem', color: '#1e3a8a', fontFamily: 'monospace' }}>Grid {site.fine_grid_id}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedLaunchSite && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#166534', background: '#dcfce7',
                padding: '0.4rem 0.6rem', borderRadius: '4px', display: 'flex', gap: '1rem' }}>
                <span>✓ {selectedLaunchSite.coastal_area}</span>
                {selectedLaunchSite.fine_grid_id && <span>Fine grid: <strong>{selectedLaunchSite.fine_grid_id}</strong></span>}
                {selectedLaunchSite.coarse_grid_id && <span>Coarse grid: <strong>{selectedLaunchSite.coarse_grid_id}</strong></span>}
              </div>
            )}
          </div>

          {/* Manual Grid Reference — shown if no launch site selected */}
          {!selectedLaunchSite && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Grid Reference <span style={{ color: '#6b7280', fontWeight: '400', fontSize: '0.85rem' }}>(manual entry if launch site not listed)</span>
              </label>
              <input
                type="text"
                value={formData.grid_reference}
                onChange={(e) => setFormData({ ...formData, grid_reference: e.target.value })}
                placeholder="e.g. 23456"
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '1rem', fontFamily: 'monospace' }}
              />
            </div>
          )}

          {/* Weather & Sea State */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Weather
              </label>
              <select
                value={formData.weather_conditions}
                onChange={(e) => setFormData({ ...formData, weather_conditions: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              >
                <option value="">Select...</option>
                <option value="Sunny">☀️ Sunny</option>
                <option value="Partly Cloudy">⛅ Partly Cloudy</option>
                <option value="Cloudy">☁️ Cloudy</option>
                <option value="Overcast">🌥️ Overcast</option>
                <option value="Rainy">🌧️ Rainy</option>
                <option value="Stormy">⛈️ Stormy</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Sea State
              </label>
              <select
                value={formData.sea_state}
                onChange={(e) => setFormData({ ...formData, sea_state: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              >
                <option value="">Select...</option>
                <option value="Calm">Calm (0-1m)</option>
                <option value="Slight">Slight (1-2m)</option>
                <option value="Moderate">Moderate (2-3m)</option>
                <option value="Rough">Rough (3-4m)</option>
                <option value="Very Rough">Very Rough (4m+)</option>
              </select>
            </div>
          </div>

          {/* Wind & Water Temp */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                Wind Direction
              </label>
              <select
                value={formData.wind_direction}
                onChange={(e) => setFormData({ ...formData, wind_direction: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              >
                <option value="">-</option>
                <option value="N">N</option>
                <option value="NE">NE</option>
                <option value="E">E</option>
                <option value="SE">SE</option>
                <option value="S">S</option>
                <option value="SW">SW</option>
                <option value="W">W</option>
                <option value="NW">NW</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                Wind (knots)
              </label>
              <input
                type="number"
                value={formData.wind_speed_knots}
                onChange={(e) => setFormData({ ...formData, wind_speed_knots: e.target.value })}
                placeholder="15"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                Water Temp (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.water_temp_c}
                onChange={(e) => setFormData({ ...formData, water_temp_c: e.target.value })}
                placeholder="18.5"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              />
            </div>
          </div>

          {/* Session Type & Boat */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Session Type
              </label>
              <select
                value={formData.session_type}
                onChange={(e) => setFormData({ ...formData, session_type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              >
                <option value="recreational">Recreational</option>
                <option value="competition">Competition</option>
                <option value="charter">Charter</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Boat Name
              </label>
              <input
                type="text"
                value={formData.boat_name}
                onChange={(e) => setFormData({ ...formData, boat_name: e.target.value })}
                placeholder="Optional"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Tide times, moon phase, strategy, etc."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: loading ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Starting...' : '🎣 Start Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
