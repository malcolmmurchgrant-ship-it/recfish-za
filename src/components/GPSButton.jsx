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

    let watchId = null
    
    // Safety net — force stop after 20 seconds no matter what
    const hardTimeout = setTimeout(() => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
      setError('Could not get location after 20 seconds. Try again outdoors.')
      setLoading(false)
    }, 20000)

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        clearTimeout(hardTimeout)
        navigator.geolocation.clearWatch(watchId)
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        onLocationCaptured(lat, lon)
        setSuccess(true)
        setLoading(false)
      },
      (err) => {
        clearTimeout(hardTimeout)
        navigator.geolocation.clearWatch(watchId)
        setError(`GPS Error ${err.code}: ${err.message}`)
        setLoading(false)
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000
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