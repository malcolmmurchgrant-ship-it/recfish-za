import { useState } from 'react'

export default function GridInput({ value, onChange, label = "Grid Reference", required = false }) {
  const [error, setError] = useState('')

  const validateGrid = (gridCode) => {
    if (!gridCode) {
      setError('')
      return true
    }

    // Check if exactly 5 digits
    if (!/^\d{5}$/.test(gridCode)) {
      setError('Grid code must be exactly 5 digits (e.g., 15217)')
      return false
    }

    setError('')
    return true
  }

  const handleChange = (e) => {
    const newValue = e.target.value
    validateGrid(newValue)
    onChange(newValue)
  }

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="e.g., 15217 (optional)"
        maxLength={5}
        pattern="\d{5}"
        style={{
          width: '100%',
          padding: '0.75rem',
          border: error ? '2px solid #dc2626' : '1px solid #d1d5db',
          borderRadius: '4px',
          fontSize: '1rem',
          fontFamily: 'monospace',
          letterSpacing: '0.1em'
        }}
      />
      {error && (
        <div style={{
          color: '#dc2626',
          fontSize: '0.875rem',
          marginTop: '0.25rem'
        }}>
          {error}
        </div>
      )}
      <div style={{
        fontSize: '0.75rem',
        color: '#6b7280',
        marginTop: '0.5rem',
        lineHeight: '1.4'
      }}>
        💡 <strong>How to find your grid code:</strong>
        <div style={{ marginTop: '0.25rem', marginLeft: '1.25rem' }}>
          • Check your GPS plotter/chart plotter<br/>
          • Use NavionicsⓇ or similar chart app<br/>
          • Or leave blank and add GPS when logging catches
        </div>
      </div>
    </div>
  )
}
