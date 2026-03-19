import { useState } from 'react'

export default function GPSButton({ onLocationCaptured }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const captureLocation = () => {
    setLoading(true)
    setError('')
    setSuccess(false)

    if (!navigator.geolocation) {
      setError('GPS not supported by your browser')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        onLocationCaptured(lat, lon)
        setSuccess(true)
        setLoading(false)
      },
      (err) => {
        console.error('GPS Error:', err)
        switch(err.code) {
          case err.PERMISSION_DENIED:
            setError('Please allow location access in your browser settings')
            break
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable. Check GPS is enabled on your device.')
            break
          case err.TIMEOUT:
            setError('Location timed out. Move to an open area and try again.')
            break
          default:
            setError('Unable to get location. Try again.')
        }
        setLoading(false)
      },
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 60000
      }
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={captureLocation}
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: loading ? '#9ca3af' : success ? '#1d4ed8' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: loading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '1rem'
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>📍</span>
        {loading ? 'Getting GPS location...' : success ? 'Location Captured ✓' : 'Get Current Location'}
      </button>
      {error && (
        <div style={{
          background: '#fee2e2',
          color: '#991b1b',
          padding: '0.75rem',
          borderRadius: '4px',
          fontSize: '0.875rem',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          background: '#d1fae5',
          color: '#065f46',
          padding: '0.75rem',
          borderRadius: '4px',
          fontSize: '0.875rem',
          marginBottom: '1rem'
        }}>
          ✓ GPS coordinates captured successfully
        </div>
      )}
    </div>
  )
}