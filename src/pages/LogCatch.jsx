import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSession } from '../contexts/SessionContext'
import ActiveSessionBanner from '../components/ActiveSessionBanner'
import PhotoUpload from '../components/PhotoUpload'
import GPSButton from '../components/GPSButton'
import GridInput from '../components/GridInput'
import { 
  calculateWeight, 
  getFormulaByCatalogueName,
  formatWeight 
} from '../utils/weightCalculations'
import { checkRecord, buildRecordNotification } from '../utils/recordDetection'
import RecordNotification from '../components/RecordNotification'

export default function LogCatch() {
  const { user } = useAuth()
  const { activeSession } = useSession()
  const navigate = useNavigate()
  const [species, setSpecies] = useState([])
  const [selectedSpecies, setSelectedSpecies] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSpeciesDropdown, setShowSpeciesDropdown] = useState(false)
  const [favorites, setFavorites] = useState([])
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const dropdownShouldStayOpen = useRef(true)

  // Photo state
  const [photo, setPhoto] = useState(null)

  // Length type state
  const [lengthType, setLengthType] = useState('TL')

  // Sex variant state (for species with F/M variants)
  const [sexVariant, setSexVariant] = useState('F') // Default to Female
  const [hasSexVariants, setHasSexVariants] = useState(false)

  // GPS state
  const [gpsLat, setGpsLat] = useState('')
  const [gpsLon, setGpsLon] = useState('')
  const [gridReference, setGridReference] = useState('')

  // Weight auto-calculation state
  const [autoWeight, setAutoWeight] = useState(null)
  const [weightSource, setWeightSource] = useState('manual') // 'manual' or 'calculated'
  const [calculatingWeight, setCalculatingWeight] = useState(false)

  // Record detection state
  const [recordNotification, setRecordNotification] = useState(null)

  const [formData, setFormData] = useState({
    species_id: '',
    species_name: '',
    weight_kg: '',
    length_cm: '',
    line_class_kg: '',
    caught_at: new Date().toISOString().slice(0, 16),
    released: false,
    location_description: '',
    notes: ''
  })

  useEffect(() => {
    loadFavorites()
  }, [user])

  // Auto-fill GPS and grid from active session
  useEffect(() => {
    if (activeSession) {
      if (activeSession.grid_reference) {
        setGridReference(activeSession.grid_reference)
      }
    }
  }, [activeSession])

  // Auto-select length type based on species
  useEffect(() => {
    if (selectedSpecies && selectedSpecies.default_length_type) {
      setLengthType(selectedSpecies.default_length_type)
    } else {
      setLengthType('TL')
    }
  }, [selectedSpecies])

  useEffect(() => {
    if (searchTerm.length > 1) {
      searchSpecies()
    } else if (searchTerm.length === 0 && favorites.length > 0) {
      setSpecies(favorites)
      setShowSpeciesDropdown(true)
    } else {
      setSpecies([])
    }
  }, [searchTerm, favorites])

  // Auto-calculate weight when length, species, length type, or sex variant changes
  useEffect(() => {
    if (formData.length_cm && selectedSpecies && lengthType) {
      calculateWeightFromLength()
    } else {
      setAutoWeight(null)
    }
  }, [formData, selectedSpecies, lengthType, sexVariant])

  const calculateWeightFromLength = async () => {
    if (!formData.length_cm || !selectedSpecies) {
      setAutoWeight(null)
      return
    }

    setCalculatingWeight(true)

    try {
      let speciesName = selectedSpecies.catalogue_name || selectedSpecies.common_name
      
      if (hasSexVariants) {
        speciesName = `${speciesName} (${sexVariant})`
      }
      
      const formula = await getFormulaByCatalogueName(supabase, speciesName, lengthType)

      if (!formula) {
        setAutoWeight(null)
        setCalculatingWeight(false)
        return
      }

      const weightKg = calculateWeight(parseFloat(formData.length_cm), formula)

      if (weightKg && weightKg > 0) {
        setAutoWeight(weightKg)
      } else {
        setAutoWeight(null)
      }
    } catch (error) {
      console.error('Error calculating weight:', error)
      setAutoWeight(null)
    }

    setCalculatingWeight(false)
  }

  const loadFavorites = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_favorite_species')
        .select(`
          species_id,
          species:species_id (
            id,
            common_name,
            catalogue_name,
            scientific_name,
            afrikaans_name,
            lowres_image_url,
            default_length_type
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      const favoriteSpecies = data.map(f => f.species).filter(s => s !== null)
      setFavorites(favoriteSpecies)
      setFavoriteIds(new Set(favoriteSpecies.map(s => s.id)))
    } catch (error) {
      console.error('Error loading favorites:', error)
    }
  }

  const searchSpecies = async () => {
    try {
      const { data, error } = await supabase
        .from('species')
        .select('id, common_name, scientific_name, afrikaans_name, catalogue_name, default_length_type')
        .or(
          `catalogue_name.ilike.%${searchTerm}%,` +
          `common_name.ilike.%${searchTerm}%,` +
          `scientific_name.ilike.%${searchTerm}%,` +
          `afrikaans_name.ilike.%${searchTerm}%`
        )
        .limit(20)

      if (error) throw error
      
      const results = data || []
      const favoriteResults = results.filter(s => favoriteIds.has(s.id))
      const otherResults = results.filter(s => !favoriteIds.has(s.id))
      
      setSpecies([...favoriteResults, ...otherResults])
      setShowSpeciesDropdown(true)
    } catch (error) {
      console.error('Error searching species:', error)
    }
  }

  const selectSpecies = (sp) => {
    dropdownShouldStayOpen.current = false
    setSelectedSpecies(sp)
    setFormData({
      ...formData,
      species_id: sp.id,
      species_name: sp.catalogue_name || sp.common_name
    })
    setSearchTerm(sp.catalogue_name || sp.common_name)
    setShowSpeciesDropdown(false)
    
    // Check if this species has sex variants (F/M)
    checkForSexVariants(sp.catalogue_name || sp.common_name)
  }

  const checkForSexVariants = async (speciesName) => {
    try {
      // Check if formulas exist with (F) and (M) variants
      // We need to check if both "SpeciesName (F)" and "SpeciesName (M)" exist
      const femaleCheck = await supabase
        .from('length_weight_formulas')
        .select('catalogue_name, measure_type')
        .eq('catalogue_name', `${speciesName} (F)`)
        .maybeSingle()
      
      const maleCheck = await supabase
        .from('length_weight_formulas')
        .select('catalogue_name, measure_type')
        .eq('catalogue_name', `${speciesName} (M)`)
        .maybeSingle()
      
      console.log('Sex variant check:', {
        speciesName,
        femaleExists: !!femaleCheck.data,
        maleExists: !!maleCheck.data,
        measureType: femaleCheck.data?.measure_type || maleCheck.data?.measure_type
      })
      
      // If both F and M variants exist, enable sex selector
      if (femaleCheck.data || maleCheck.data) {
        setHasSexVariants(true)
        setSexVariant('F') // Default to Female
        
        // Set the length type to match the formula
        const formulaMeasureType = femaleCheck.data?.measure_type || maleCheck.data?.measure_type
        if (formulaMeasureType) {
          setLengthType(formulaMeasureType)
          console.log(`Set length type to ${formulaMeasureType} to match formula`)
        }
        
        console.log('Sex variants detected - showing selector')
      } else {
        setHasSexVariants(false)
        console.log('No sex variants - hiding selector')
      }
    } catch (err) {
      console.error('Error checking for sex variants:', err)
      setHasSexVariants(false)
    }
  }

  const handleGPSCaptured = (lat, lon) => {
    setGpsLat(lat.toFixed(6))
    setGpsLon(lon.toFixed(6))
  }

  const getLengthTypeDescription = (type) => {
    const descriptions = {
      'TL': 'Total Length - Snout tip to tail tip',
      'FL': 'Fork Length - Snout tip to tail fork',
      'DW': 'Disk Width - Widest part of disk (rays)',
      'PCL': 'Pre-Caudal Length - Snout to precaudal pit (sharks)',
      'LBFL': 'Lower Jaw Fork Length - Lower jaw to tail fork (billfish)'
    }
    return descriptions[type] || ''
  }

  const useCalculatedWeight = () => {
    if (autoWeight) {
      setFormData({ ...formData, weight_kg: autoWeight.toFixed(2) })
      setWeightSource('calculated')
    }
  }

  const runRecordCheck = async (savedCatch) => {
    try {
      // Need the scientific name — get it from selectedSpecies
      const scientificName = selectedSpecies?.scientific_name
      const weightKg = savedCatch.weight_kg
      if (!scientificName || !weightKg) return

      // Fetch user profile for gender + DOB
      const { data: profile } = await supabase
        .from('users')
        .select('gender, date_of_birth')
        .eq('id', user.id)
        .single()

      if (!profile?.gender || !profile?.date_of_birth) return

      const result = await checkRecord(supabase, {
        scientificName,
        weightKg: parseFloat(weightKg),
        lineClassKg: savedCatch.line_class_kg || null,
        gender: profile.gender,
        dateOfBirth: profile.date_of_birth,
        catchDate: savedCatch.caught_at
          ? savedCatch.caught_at.split('T')[0]
          : new Date().toISOString().split('T')[0],
      })

      if (result) {
        const notification = buildRecordNotification(result)
        if (notification) setRecordNotification(notification)
      }
    } catch (err) {
      // Record check failure should never block the catch being saved
      console.error('Record check error:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Determine session_id to use
      const sessionId = activeSession?.id || null

      const { data, error} = await supabase
        .from('catches')
        .insert([
          {
            user_id: user.id,
            species_id: formData.species_id,
            weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
            length_cm: formData.length_cm ? parseFloat(formData.length_cm) : null,
            length_type: lengthType,
            caught_at: formData.caught_at,
            released: formData.released,
            notes: formData.notes || null,
            is_competition_entry: false,
            session_id: sessionId,
            grid_reference: gridReference || null,
            gps_lat: gpsLat ? parseFloat(gpsLat) : null,
            gps_lon: gpsLon ? parseFloat(gpsLon) : null,
            line_class_kg: formData.line_class_kg || null,
            photo_url: photo?.photoUrl || null,
            photo_thumbnail_url: photo?.thumbnailUrl || null,
            photo_uploaded_at: photo ? new Date().toISOString() : null,
            photo_metadata: photo?.metadata || null
          }
        ])
        .select()

      if (error) throw error

      // Run record check before resetting form (we still need selectedSpecies)
      if (data && data[0]) {
        await runRecordCheck(data[0])
      }

      alert('Catch logged successfully!')
      
      // Reset form
      setFormData({
        species_id: '',
        species_name: '',
        weight_kg: '',
        length_cm: '',
        line_class_kg: '',
        caught_at: new Date().toISOString().slice(0, 16),
        released: false,
        location_description: '',
        notes: ''
      })
      setSearchTerm('')
      setSelectedSpecies(null)
      setLengthType('TL')
      setPhoto(null)
      setGpsLat('')
      setGpsLon('')
      setAutoWeight(null)
      setWeightSource('manual')
      // Keep grid reference from session
      
      // Don't navigate away - let user log another catch
      
    } catch (error) {
      console.error('Error logging catch:', error)
      
      // Check if it's a foreign key violation
      if (error.message && error.message.includes('foreign key constraint')) {
        alert('Session link error. Your catch will be logged without a session.')
        
        // Try again without session_id
        try {
          const { data, error: retryError } = await supabase
            .from('catches')
            .insert([
              {
                user_id: user.id,
                species_id: formData.species_id,
                weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
                length_cm: formData.length_cm ? parseFloat(formData.length_cm) : null,
                length_type: lengthType,
                caught_at: formData.caught_at,
                released: formData.released,
                notes: formData.notes || null,
                is_competition_entry: false,
                session_id: null,
                grid_reference: gridReference || null,
                gps_lat: gpsLat ? parseFloat(gpsLat) : null,
                gps_lon: gpsLon ? parseFloat(gpsLon) : null,
                photo_url: photo?.photoUrl || null,
                photo_thumbnail_url: photo?.thumbnailUrl || null,
                photo_uploaded_at: photo ? new Date().toISOString() : null,
                photo_metadata: photo?.metadata || null
              }
            ])
            .select()

          if (retryError) throw retryError

          alert('Catch logged successfully (without session)!')
          
          // Reset form
          setFormData({
            species_id: '',
            species_name: '',
            weight_kg: '',
            length_cm: '',
            caught_at: new Date().toISOString().slice(0, 16),
            released: false,
            location_description: '',
            notes: ''
          })
          setSearchTerm('')
          setSelectedSpecies(null)
          setLengthType('TL')
          setPhoto(null)
          setGpsLat('')
          setGpsLon('')
          setAutoWeight(null)
          setWeightSource('manual')
          
        } catch (retryError) {
          console.error('Retry failed:', retryError)
          alert('Error logging catch. Please try again.')
        }
      } else {
        alert('Error logging catch. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Please log in to record catches.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', paddingBottom: '2rem' }}>
      <ActiveSessionBanner />

      {/* Record detection modal */}
      <RecordNotification
        result={recordNotification}
        onClose={() => setRecordNotification(null)}
      />
      
      <div style={{ maxWidth: '42rem', margin: '0 auto', padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#3b82f6',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              marginBottom: '1rem'
            }}
          >
            ← Back to Dashboard
          </button>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.5rem' }}>
            Log a Catch
          </h1>
          <p style={{ color: '#6b7280' }}>
            Record details about your catch
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {/* Species Search */}
          <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Species *
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                if (!showSpeciesDropdown) {
                  dropdownShouldStayOpen.current = true
                  setShowSpeciesDropdown(true)
                }
              }}
              onFocus={() => {
                if (favorites.length > 0 && searchTerm.length === 0) {
                  dropdownShouldStayOpen.current = true
                  setSpecies(favorites)
                  setShowSpeciesDropdown(true)
                }
              }}
              onBlur={() => {
                // Delay closing to allow mousedown to register
                setTimeout(() => {
                  dropdownShouldStayOpen.current = false
                  setShowSpeciesDropdown(false)
                }, 150)
              }}
              placeholder="Search for a species..."
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />

            {/* Dropdown */}
            {showSpeciesDropdown && species.length > 0 && dropdownShouldStayOpen.current && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                marginTop: '0.25rem',
                maxHeight: '300px',
                overflowY: 'auto',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 10
              }}>
                {species.map((sp) => (
                  <div
                    key={sp.id}
                    onMouseDown={(e) => {
                      selectSpecies(sp)
                    }}
                    style={{
                      padding: '0.75rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    {favoriteIds.has(sp.id) && <span>⭐</span>}
                    <div style={{ pointerEvents: 'none' }}>
                      <div style={{ fontWeight: '500' }}>
                        {sp.catalogue_name || sp.common_name}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {sp.scientific_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Length */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Length (cm)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.length_cm}
              onChange={(e) => {
                setFormData({ ...formData, length_cm: e.target.value })
                // Reset weight source when length changes manually
                if (weightSource === 'calculated') {
                  setWeightSource('manual')
                }
              }}
              placeholder="e.g., 65"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>

          {/* Length Type */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Length Type
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
              gap: '0.5rem'
            }}>
              {['TL', 'FL', 'DW', 'PCL', 'LBFL'].map((type) => (
                <label
                  key={type}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.5rem',
                    border: lengthType === type ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: lengthType === type ? '#eff6ff' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="radio"
                    name="lengthType"
                    value={type}
                    checked={lengthType === type}
                    onChange={(e) => setLengthType(e.target.value)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                    {type}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
              {getLengthTypeDescription(lengthType)}
            </div>
          </div>

          {/* Sex Selector - Only show for species with F/M variants */}
          {hasSexVariants && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Sex
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem'
              }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.5rem',
                    border: sexVariant === 'F' ? '2px solid #ec4899' : '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: sexVariant === 'F' ? '#fdf2f8' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="radio"
                    name="sexVariant"
                    value="F"
                    checked={sexVariant === 'F'}
                    onChange={(e) => setSexVariant(e.target.value)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                    ♀ Female
                  </span>
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.5rem',
                    border: sexVariant === 'M' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: sexVariant === 'M' ? '#eff6ff' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="radio"
                    name="sexVariant"
                    value="M"
                    checked={sexVariant === 'M'}
                    onChange={(e) => setSexVariant(e.target.value)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                    ♂ Male
                  </span>
                </label>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                {sexVariant === 'F' ? 'Female individuals are typically larger' : 'Male individuals are typically smaller'}
              </div>
            </div>
          )}

          {/* Line Class */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Line Class
            </label>
            <select
              value={formData.line_class_kg || ''}
              onChange={(e) => setFormData({ ...formData, line_class_kg: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem',
                background: 'white'
              }}
            >
              <option value="">Not specified</option>
              <option value="1">1 kg</option>
              <option value="2">2 kg</option>
              <option value="3">3 kg</option>
              <option value="4">4 kg</option>
              <option value="6">6 kg</option>
              <option value="8">8 kg</option>
              <option value="10">10 kg</option>
              <option value="15">15 kg</option>
              <option value="24">24 kg</option>
              <option value="37">37 kg</option>
              <option value="60">60 kg</option>
            </select>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.3rem' }}>
              Optional — required for SADSAA record consideration
            </p>
          </div>

          {/* Weight with Auto-calculation */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Weight (kg)
            </label>
            
            {/* Auto-calculated weight notification */}
            {autoWeight && (
              <div style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '4px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>📐</span>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: '500' }}>
                        Auto-calculated: {formatWeight(autoWeight)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#3b82f6' }}>
                        Based on length and species formula
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={useCalculatedWeight}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Use This
                  </button>
                </div>
                <div style={{
                  fontSize: '0.7rem',
                  color: '#6b7280',
                  fontStyle: 'italic',
                  lineHeight: '1.3',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #dbeafe'
                }}>
                  ℹ️ Estimates can vary depending on food availability, metabolism, reproductive cycle, environmental and seasonal conditions. Larger individuals display increasing variance.
                </div>
              </div>
            )}

            {calculatingWeight && (
              <div style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                background: '#f3f4f6',
                borderRadius: '4px',
                fontSize: '0.875rem',
                color: '#6b7280',
                textAlign: 'center'
              }}>
                Calculating weight...
              </div>
            )}

            <input
              type="number"
              step="0.01"
              value={formData.weight_kg}
              onChange={(e) => {
                setFormData({ ...formData, weight_kg: e.target.value })
                setWeightSource('manual')
              }}
              placeholder="Enter weight or use calculated"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
            
            {weightSource === 'calculated' && formData.weight_kg && (
              <div style={{ 
                fontSize: '0.75rem', 
                color: '#10b981', 
                marginTop: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <span>✓</span> Using calculated weight
              </div>
            )}
          </div>

          {/* Photo Upload */}
          <PhotoUpload
            photo={photo}
            onPhotoChange={setPhoto}
            catchData={{
              species: selectedSpecies?.catalogue_name || selectedSpecies?.common_name || 'Unknown',
              length: formData.length_cm,
              weight: formData.weight_kg
            }}
          />

          {/* GPS Capture */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              GPS Location
            </label>
            <GPSButton 
              onGPSCaptured={handleGPSCaptured}
              currentLat={gpsLat}
              currentLon={gpsLon}
            />
            {gpsLat && gpsLon && (
              <div style={{ 
                marginTop: '0.5rem', 
                fontSize: '0.875rem', 
                color: '#6b7280',
                background: '#f9fafb',
                padding: '0.5rem',
                borderRadius: '4px'
              }}>
                📍 Location captured: {gpsLat}, {gpsLon}
              </div>
            )}
          </div>

          {/* Grid Reference */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Grid Reference (5-digit code)
            </label>
            <GridInput
              value={gridReference}
              onChange={setGridReference}
            />
            {activeSession && activeSession.grid_reference && (
              <div style={{ 
                fontSize: '0.75rem', 
                color: '#3b82f6', 
                marginTop: '0.25rem' 
              }}>
                Using grid from active session
              </div>
            )}
          </div>

          {/* Date/Time */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Date and Time *
            </label>
            <input
              type="datetime-local"
              value={formData.caught_at}
              onChange={(e) => setFormData({ ...formData, caught_at: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>

          {/* Released */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={formData.released}
                onChange={(e) => setFormData({ ...formData, released: e.target.checked })}
                style={{ width: '1.25rem', height: '1.25rem' }}
              />
              <span style={{ fontWeight: '500' }}>Released</span>
            </label>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional details about the catch..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '1rem',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Logging Catch...' : 'Log Catch'}
          </button>
        </form>
      </div>
    </div>
  )
}
