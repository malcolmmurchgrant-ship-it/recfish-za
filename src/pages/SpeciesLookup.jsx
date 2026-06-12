import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function SpeciesLookup() {
  const { user } = useAuth()
  const [species, setSpecies] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSpecies, setSelectedSpecies] = useState(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState(new Set())

  useEffect(() => {
    loadFavorites()
  }, [user])

  useEffect(() => {
    loadSpecies()
  }, [searchTerm, showFavoritesOnly, favorites])

  const loadFavorites = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_favorite_species')
        .select('species_id')
        .eq('user_id', user.id)

      if (error) throw error

      const favoriteIds = new Set(data.map(f => f.species_id))
      setFavorites(favoriteIds)
    } catch (error) {
      console.error('Error loading favorites:', error)
    }
  }

  const loadSpecies = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('species')
        .select('*')
        .order('catalogue_name')

      if (searchTerm) {
        query = query.or(
          `catalogue_name.ilike.%${searchTerm}%,` +
          `common_name.ilike.%${searchTerm}%,` +
          `scientific_name.ilike.%${searchTerm}%,` +
          `afrikaans_name.ilike.%${searchTerm}%,` +
          `other_names.cs.["${searchTerm}"]`
        )
      }

      const { data, error } = await query

      if (error) throw error

      let results = data || []

      // Also catch partial matches inside other_names (Supabase cs only matches exact elements)
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const fromOtherNames = (data || []).filter(sp =>
          Array.isArray(sp.other_names) &&
          sp.other_names.some(n => n.toLowerCase().includes(term))
        )
        // Merge without duplicates
        const ids = new Set(results.map(s => s.id))
        fromOtherNames.forEach(sp => { if (!ids.has(sp.id)) results.push(sp) })
      }

      if (showFavoritesOnly && user) {
        results = results.filter(sp => favorites.has(sp.id))
      }

      setSpecies(results)
    } catch (error) {
      console.error('Error loading species:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = async (speciesId, e) => {
    e.stopPropagation()

    if (!user) {
      alert('Please log in to save favorites')
      return
    }

    const isFavorite = favorites.has(speciesId)

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('user_favorite_species')
          .delete()
          .eq('user_id', user.id)
          .eq('species_id', speciesId)

        if (error) throw error

        setFavorites(prev => {
          const newSet = new Set(prev)
          newSet.delete(speciesId)
          return newSet
        })
      } else {
        const { error } = await supabase
          .from('user_favorite_species')
          .insert([{
            user_id: user.id,
            species_id: speciesId
          }])

        if (error) throw error

        setFavorites(prev => new Set(prev).add(speciesId))
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
      alert('Error updating favorites: ' + error.message)
    }
  }

  // ── Regulations rendering ──────────────────────────────────────────────────

  const RegulationsPanel = ({ sp }) => {
    const hasZoneRegs = sp.zone_regulations && sp.zone_regulations.length > 0
    const hasFlatRegs = sp.bag_limit || sp.minimum_size_cm || sp.closed_season || sp.protected

    // Zone-based regulations (Kob and Elf-style zone rules)
    if (hasZoneRegs) {
      // Check whether zone regs are catch rules (Kob) or season-only (Elf)
      const isCatchRules = sp.zone_regulations.some(z => z.minimum_size_cm || z.bag_limit)
      const isSeasonOnly = sp.zone_regulations.every(z => z.closed_season && !z.minimum_size_cm && !z.bag_limit)

      return (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: '4px' }}>
          <h3 style={{ fontWeight: '600', marginBottom: '0.75rem' }}>Regulations</h3>

          {/* General flat regs still shown if present alongside zone regs (e.g. Elf has general regs + KZN closed season) */}
          {hasFlatRegs && (
            <div style={{ marginBottom: '1rem' }}>
              {sp.bag_limit && <p><strong>Bag Limit:</strong> {sp.bag_limit}</p>}
              {sp.minimum_size_cm && <p><strong>Minimum Size:</strong> {sp.minimum_size_cm} cm</p>}
              {sp.closed_season && <p><strong>Closed Season:</strong> {sp.closed_season}</p>}
              {sp.protected && (
                <p style={{ color: '#dc2626', fontWeight: '600' }}>⚠️ Protected Species — No take</p>
              )}
            </div>
          )}

          {/* Zone-specific closed seasons (e.g. Elf KZN) */}
          {isSeasonOnly && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '4px',
              padding: '0.75rem',
              marginBottom: '0.5rem'
            }}>
              <p style={{ fontWeight: '600', color: '#92400e', marginBottom: '0.25rem' }}>
                Zone-Specific Closed Season
              </p>
              {sp.zone_regulations.map((zone, i) => (
                <p key={i} style={{ fontSize: '0.9rem', color: '#78350f' }}>
                  <strong>{zone.zone}:</strong> Closed {zone.closed_season}
                </p>
              ))}
            </div>
          )}

          {/* Zone-based catch regulations table (e.g. Kob) */}
          {isCatchRules && (
            <>
              <p style={{
                fontSize: '0.8rem',
                color: '#6b7280',
                fontStyle: 'italic',
                marginBottom: '0.75rem'
              }}>
                Regulations vary by area and method of capture
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem'
                }}>
                  <thead>
                    <tr style={{ background: '#1e3a8a', color: 'white' }}>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', borderRadius: '4px 0 0 0' }}>
                        Area / Method
                      </th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        Min Size
                      </th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap', borderRadius: '0 4px 0 0' }}>
                        Bag Limit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sp.zone_regulations.map((zone, i) => (
                      <tr
                        key={i}
                        style={{ background: i % 2 === 0 ? 'white' : '#f3f4f6' }}
                      >
                        <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                          {zone.zone}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                          {zone.minimum_size_cm ? `${zone.minimum_size_cm} cm` : '—'}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                          {zone.bag_limit ? (
                            <span>
                              {zone.bag_limit}
                              {zone.slot_limit_size && (
                                <span style={{
                                  display: 'block',
                                  fontSize: '0.75rem',
                                  color: '#dc2626',
                                  fontStyle: 'italic',
                                  whiteSpace: 'nowrap'
                                }}>
                                  max {zone.slot_limit_max_above} &gt; {zone.slot_limit_size} cm/day
                                </span>
                              )}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Slot limit callout note */}
              {sp.zone_regulations.some(z => z.slot_limit_size) && (
                <p style={{
                  marginTop: '0.6rem',
                  fontSize: '0.8rem',
                  color: '#dc2626',
                  fontStyle: 'italic'
                }}>
                  ⚠️ Where applicable: only {sp.zone_regulations.find(z => z.slot_limit_size)?.slot_limit_max_above} fish
                  over {sp.zone_regulations.find(z => z.slot_limit_size)?.slot_limit_size} cm may be retained per day.
                </p>
              )}
            </>
          )}
        </div>
      )
    }

    // Standard flat regulations display
    return (
      <div style={{ marginTop: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: '4px' }}>
        <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Regulations</h3>
        {sp.protected && (
          <p style={{ color: '#dc2626', fontWeight: '600' }}>⚠️ Protected Species — No take</p>
        )}
        {sp.bag_limit && (
          <p><strong>Bag Limit:</strong> {sp.bag_limit}</p>
        )}
        {sp.minimum_size_cm && (
          <p><strong>Minimum Size:</strong> {sp.minimum_size_cm} cm
            {sp.minimum_size_note && (
              <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                ({sp.minimum_size_note})
              </span>
            )}
          </p>
        )}
        {sp.bag_limit_note && (
          <p style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
            {sp.bag_limit_note}
          </p>
        )}
        {sp.closed_season && (
          <p><strong>Closed Season:</strong> {sp.closed_season}</p>
        )}
        {!sp.protected && !sp.bag_limit && !sp.minimum_size_cm && !sp.closed_season && (
          <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No specific regulations listed</p>
        )}
      </div>
    )
  }

  // ── Species card badge (grid view) ────────────────────────────────────────

  const RegulationBadges = ({ sp }) => {
    // For zone-regulated species show a single indicator badge instead of misleading flat values
    if (sp.zone_regulations && sp.zone_regulations.length > 0) {
      const isCatchRules = sp.zone_regulations.some(z => z.minimum_size_cm || z.bag_limit)
      return (
        <span style={{
          fontSize: '0.75rem',
          padding: '0.25rem 0.5rem',
          background: isCatchRules ? '#fce7f3' : '#fef3c7',
          color: isCatchRules ? '#9d174d' : '#92400e',
          borderRadius: '4px'
        }}>
          {isCatchRules ? 'Zone regulations apply' : 'KZN closed season'}
        </span>
      )
    }

    return (
      <>
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
            Min: {sp.minimum_size_cm} cm
          </span>
        )}
      </>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Species Lookup
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Search through 497 South African fish species
      </p>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <button
          onClick={() => setShowFavoritesOnly(false)}
          style={{
            padding: '0.75rem 1.5rem',
            background: !showFavoritesOnly ? 'white' : 'transparent',
            border: 'none',
            borderBottom: !showFavoritesOnly ? '3px solid #1e3a8a' : 'none',
            color: !showFavoritesOnly ? '#1e3a8a' : '#6b7280',
            fontWeight: !showFavoritesOnly ? '600' : '400',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          All Species ({species.length})
        </button>
        <button
          onClick={() => setShowFavoritesOnly(true)}
          style={{
            padding: '0.75rem 1.5rem',
            background: showFavoritesOnly ? 'white' : 'transparent',
            border: 'none',
            borderBottom: showFavoritesOnly ? '3px solid #1e3a8a' : 'none',
            color: showFavoritesOnly ? '#1e3a8a' : '#6b7280',
            fontWeight: showFavoritesOnly ? '600' : '400',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          ★ Favorites ({favorites.size})
        </button>
      </div>

      {/* Search Box */}
      <div style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="Search by name (English, Afrikaans, other common names, scientific)..."
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
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
                  gap: '1rem',
                  position: 'relative'
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
                {/* Favorite Star */}
                {user && (
                  <button
                    onClick={(e) => toggleFavorite(sp.id, e)}
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      background: 'none',
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      lineHeight: 1,
                      zIndex: 10
                    }}
                    title={favorites.has(sp.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {favorites.has(sp.id) ? '★' : '☆'}
                  </button>
                )}

                {/* Fish Image Thumbnail */}
                {sp.lowres_image_url && (
                  <div style={{
                    width: '120px',
                    height: '120px',
                    flexShrink: 0,
                    borderRadius: '4px',
                    overflow: 'hidden',
                    background: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={sp.lowres_image_url}
                      alt={sp.catalogue_name || sp.common_name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        padding: '4px'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>
                )}

                {/* Fish Info */}
                <div style={{ flex: 1, paddingRight: '2rem' }}>
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
                  {(() => {
                    const altNames = []
                    if (sp.common_name && sp.catalogue_name && sp.common_name !== sp.catalogue_name)
                      altNames.push(sp.common_name)
                    if (Array.isArray(sp.other_names))
                      altNames.push(...sp.other_names)
                    return altNames.length > 0 ? (
                      <p style={{ fontSize: '0.875rem', color: '#6366f1', marginBottom: '0.25rem' }}>
                        Also: {altNames.join(', ')}
                      </p>
                    ) : null
                  })()}
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
                    <RegulationBadges sp={sp} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {species.length === 0 && (
            <div style={{
              background: 'white',
              padding: '3rem',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              {showFavoritesOnly ? (
                <>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>★</div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No favorites yet</h3>
                  <p>Click the ☆ star on any species to add it to your favorites!</p>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No species found</h3>
                  <p>Try a different search term.</p>
                </>
              )}
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
              maxWidth: '900px',
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
                height: '400px',
                marginBottom: '1.5rem',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img
                  src={selectedSpecies.lowres_image_url}
                  alt={selectedSpecies.common_name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    padding: '8px'
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
              <p style={{ marginBottom: '0.5rem', color: '#059669' }}>
                <strong>Afrikaans:</strong> {selectedSpecies.afrikaans_name}
              </p>
            )}

            {Array.isArray(selectedSpecies.other_names) && selectedSpecies.other_names.length > 0 && (
              <p style={{ marginBottom: '1rem', color: '#6366f1' }}>
                <strong>Other Names:</strong> {selectedSpecies.other_names.join(', ')}
              </p>
            )}

            {selectedSpecies.family_common && (
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Family:</strong> {selectedSpecies.family_common}
                {selectedSpecies.family_scientific && ` (${selectedSpecies.family_scientific})`}
              </p>
            )}

            {/* Regulations Panel — handles flat, zone-based, and slot limit */}
            <RegulationsPanel sp={selectedSpecies} />

            {selectedSpecies.iucn_status && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Conservation Status:</strong> {selectedSpecies.iucn_status}
              </div>
            )}

            {/* High Resolution Image Gallery */}
            {selectedSpecies.highres_image_urls && selectedSpecies.highres_image_urls.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '1rem' }}>
                  Image Gallery ({selectedSpecies.highres_image_urls.length} photos)
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '0.75rem'
                }}>
                  {selectedSpecies.highres_image_urls.map((url, index) => (
                    <div
                      key={index}
                      style={{
                        width: '100%',
                        height: '150px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        background: '#f3f4f6',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #e5e7eb',
                        transition: 'transform 0.2s ease'
                      }}
                      onClick={() => window.open(url, '_blank')}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      title="Click to view full size"
                    >
                      <img
                        src={url}
                        alt={`${selectedSpecies.common_name} ${index + 1}`}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          padding: '4px'
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
