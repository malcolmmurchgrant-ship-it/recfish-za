import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SpeciesLookup() {
  const [species, setSpecies] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSpecies, setSelectedSpecies] = useState(null)

  useEffect(() => {
    loadSpecies()
  }, [searchTerm])

  const loadSpecies = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('species')
        .select('*')
        .order('catalogue_name')
        .limit(50)

      if (searchTerm) {
        query = query.or(
          `catalogue_name.ilike.%${searchTerm}%,` +
          `common_name.ilike.%${searchTerm}%,` +
          `scientific_name.ilike.%${searchTerm}%,` +
          `afrikaans_name.ilike.%${searchTerm}%`
        )
      }

      const { data, error } = await query

      if (error) throw error
      setSpecies(data || [])
    } catch (error) {
      console.error('Error loading species:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Species Lookup
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Search through 497 South African fish species
      </p>

      {/* Search Box */}
      <div style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="Search by name (English, Afrikaans, scientific)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '1rem',
            border: '2px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '1rem'
          }}
        />
      </div>

      {loading ? (
        <div>Searching...</div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Species Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem'
          }}>
            {species.map((sp) => (
              <div
                key={sp.id}
                onClick={() => setSelectedSpecies(sp)}
                style={{
                  background: 'white',
                  padding: '1rem',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  gap: '1rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {/* Fish Image Thumbnail */}
                {sp.lowres_image_url && (
                  <div style={{
                    width: '80px',
                    height: '80px',
                    flexShrink: 0,
                    borderRadius: '4px',
                    overflow: 'hidden',
                    background: '#f3f4f6'
                  }}>
                    <img 
                      src={sp.lowres_image_url} 
                      alt={sp.catalogue_name || sp.common_name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>
                )}

                {/* Fish Info */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                    {sp.catalogue_name || sp.common_name}
                  </h3>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    fontStyle: 'italic',
                    marginBottom: '0.5rem'
                  }}>
                    {sp.scientific_name}
                  </p>
                  {sp.common_name && sp.catalogue_name && sp.common_name !== sp.catalogue_name && (
                    <p style={{ fontSize: '0.875rem', color: '#6366f1' }}>
                      Also: {sp.common_name}
                    </p>
                  )}
                  {sp.afrikaans_name && (
                    <p style={{ fontSize: '0.875rem', color: '#059669' }}>
                      {sp.afrikaans_name}
                    </p>
                  )}
                  <div style={{
                    marginTop: '0.5rem',
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    {sp.bag_limit && (
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        background: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: '4px'
                      }}>
                        Bag: {sp.bag_limit}
                      </span>
                    )}
                    {sp.minimum_size_cm && (
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        background: '#fef3c7',
                        color: '#92400e',
                        borderRadius: '4px'
                      }}>
                        Min: {sp.minimum_size_cm}cm
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {species.length === 0 && (
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              No species found. Try a different search term.
            </div>
          )}
        </div>
      )}

      {/* Species Detail Modal */}
      {selectedSpecies && (
        <div
          onClick={() => setSelectedSpecies(null)}
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
              borderRadius: '8px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '2rem'
            }}
          >
            {/* Main Fish Image */}
            {selectedSpecies.lowres_image_url && (
              <div style={{
                width: '100%',
                height: '300px',
                marginBottom: '1.5rem',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#f3f4f6'
              }}>
                <img 
                  src={selectedSpecies.lowres_image_url}
                  alt={selectedSpecies.common_name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              </div>
            )}

            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {selectedSpecies.common_name}
            </h2>
            <p style={{
              fontSize: '1rem',
              color: '#6b7280',
              fontStyle: 'italic',
              marginBottom: '1rem'
            }}>
              {selectedSpecies.scientific_name}
            </p>

            {selectedSpecies.catalogue_name && selectedSpecies.catalogue_name !== selectedSpecies.common_name && (
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Catalogue name:</strong> {selectedSpecies.catalogue_name}
              </p>
            )}

            {selectedSpecies.afrikaans_name && (
              <p style={{ marginBottom: '1rem', color: '#059669' }}>
                <strong>Afrikaans:</strong> {selectedSpecies.afrikaans_name}
              </p>
            )}

            {selectedSpecies.family_common && (
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Family:</strong> {selectedSpecies.family_common}
                {selectedSpecies.family_scientific && ` (${selectedSpecies.family_scientific})`}
              </p>
            )}

            {/* High Resolution Image Gallery */}
            {selectedSpecies.highres_image_urls && selectedSpecies.highres_image_urls.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '1rem' }}>
                  Image Gallery ({selectedSpecies.highres_image_urls.length} photos)
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '0.5rem'
                }}>
                  {selectedSpecies.highres_image_urls.map((url, index) => (
                    <div
                      key={index}
                      style={{
                        width: '100%',
                        height: '120px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        background: '#f3f4f6',
                        cursor: 'pointer'
                      }}
                      onClick={() => window.open(url, '_blank')}
                      title="Click to view full size"
                    >
                      <img 
                        src={url}
                        alt={`${selectedSpecies.common_name} ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </div>
                  ))}
                </div>
                <p style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  marginTop: '0.5rem',
                  fontStyle: 'italic'
                }}>
                  Click any image to view full size
                </p>
              </div>
            )}

            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: '4px'
            }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Regulations</h3>
              {selectedSpecies.bag_limit && (
                <p><strong>Bag Limit:</strong> {selectedSpecies.bag_limit}</p>
              )}
              {selectedSpecies.minimum_size_cm && (
                <p><strong>Minimum Size:</strong> {selectedSpecies.minimum_size_cm} cm</p>
              )}
              {selectedSpecies.closed_season && (
                <p><strong>Closed Season:</strong> {selectedSpecies.closed_season}</p>
              )}
              {!selectedSpecies.bag_limit && !selectedSpecies.minimum_size_cm && !selectedSpecies.closed_season && (
                <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No specific regulations listed</p>
              )}
            </div>

            {selectedSpecies.iucn_status && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Conservation Status:</strong> {selectedSpecies.iucn_status}
              </div>
            )}

            <button
              onClick={() => setSelectedSpecies(null)}
              style={{
                marginTop: '1.5rem',
                width: '100%',
                padding: '0.75rem',
                background: '#1e3a8a',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
