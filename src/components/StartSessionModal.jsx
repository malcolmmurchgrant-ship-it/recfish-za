import { useState } from 'react'
import { useSession } from '../contexts/SessionContext'
import GridInput from './GridInput'

export default function StartSessionModal({ isOpen, onClose }) {
  const { startSession } = useSession()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    location_description: '',
    grid_reference: '',
    weather_conditions: '',
    sea_state: '',
    water_temp_c: '',
    wind_direction: '',
    wind_speed_knots: '',
    boat_name: '',
    session_type: 'recreational',
    notes: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const sessionData = {
      ...formData,
      water_temp_c: formData.water_temp_c ? parseFloat(formData.water_temp_c) : null,
      wind_speed_knots: formData.wind_speed_knots ? parseInt(formData.wind_speed_knots) : null,
      grid_reference: formData.grid_reference || null
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

          {/* Grid Reference */}
          <GridInput
            value={formData.grid_reference}
            onChange={(value) => setFormData({ ...formData, grid_reference: value })}
            label="Grid Reference (5-digit, Optional)"
          />

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
