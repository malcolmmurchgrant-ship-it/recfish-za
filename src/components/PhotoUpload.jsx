import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { compressToWebP, generateThumbnail, isValidImage, isWithinSizeLimit, formatFileSize } from '../utils/photoUtils'

export default function PhotoUpload({ onPhotoUploaded, existingPhotoUrl }) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(existingPhotoUrl || null)
  const [error, setError] = useState('')

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')

    // Validate file
    if (!isValidImage(file)) {
      setError('Please select a valid image file (JPEG, PNG, WebP)')
      return
    }

    if (!isWithinSizeLimit(file, 5)) {
      setError('Image must be under 5MB')
      return
    }

    await uploadPhoto(file)
  }

  const handleCameraCapture = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    await uploadPhoto(file)
  }

  const uploadPhoto = async (file) => {
    try {
      setUploading(true)
      setError('')

      console.log('Original file size:', formatFileSize(file.size))

      // Compress to WebP (~500KB target)
      const compressedBlob = await compressToWebP(file, 1920, 0.85)
      console.log('Compressed size:', formatFileSize(compressedBlob.size))

      // Generate thumbnail
      const thumbnailBlob = await generateThumbnail(file, 300)
      console.log('Thumbnail size:', formatFileSize(thumbnailBlob.size))

      // Create unique filename
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(7)
      const filename = `${user.id}/${timestamp}-${randomStr}.webp`
      const thumbnailFilename = `${user.id}/${timestamp}-${randomStr}-thumb.webp`

      // Upload main photo
      const { data: photoData, error: photoError } = await supabase.storage
        .from('catch-photos')
        .upload(filename, compressedBlob, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false
        })

      if (photoError) throw photoError

      // Upload thumbnail
      const { data: thumbData, error: thumbError } = await supabase.storage
        .from('catch-photos')
        .upload(thumbnailFilename, thumbnailBlob, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false
        })

      if (thumbError) throw thumbError

      // Get public URLs
      const { data: { publicUrl: photoUrl } } = supabase.storage
        .from('catch-photos')
        .getPublicUrl(filename)

      const { data: { publicUrl: thumbUrl } } = supabase.storage
        .from('catch-photos')
        .getPublicUrl(thumbnailFilename)

      setPreview(thumbUrl)
      
      // Return URLs to parent component
      onPhotoUploaded({
        photoUrl,
        thumbnailUrl: thumbUrl,
        metadata: {
          originalFilename: file.name,
          originalSize: file.size,
          compressedSize: compressedBlob.size,
          uploadedAt: new Date().toISOString()
        }
      })

      console.log('✅ Photo uploaded successfully')
    } catch (error) {
      console.error('Error uploading photo:', error)
      setError('Failed to upload photo: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = () => {
    setPreview(null)
    onPhotoUploaded(null)
  }

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
        📷 Photo (Optional)
      </label>
      
      {preview ? (
        // Show preview if photo uploaded
        <div style={{
          position: 'relative',
          width: '200px',
          height: '200px',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '2px solid #d1d5db'
        }}>
          <img
            src={preview}
            alt="Catch preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          <button
            onClick={removePhoto}
            type="button"
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: 'rgba(220, 38, 38, 0.9)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>
      ) : (
        // Show upload buttons if no photo
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Camera button (mobile) */}
          <label style={{
            padding: '0.75rem 1.5rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: uploading ? 0.5 : 1
          }}>
            <span>📸</span>
            <span>{uploading ? 'Uploading...' : 'Take Photo'}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraCapture}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>

          {/* Gallery button */}
          <label style={{
            padding: '0.75rem 1.5rem',
            background: 'white',
            color: '#3b82f6',
            border: '2px solid #3b82f6',
            borderRadius: '4px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: uploading ? 0.5 : 1
          }}>
            <span>📁</span>
            <span>{uploading ? 'Uploading...' : 'Upload Photo'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.75rem',
          background: '#fee2e2',
          color: '#991b1b',
          borderRadius: '4px',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      <div style={{
        marginTop: '0.5rem',
        fontSize: '0.75rem',
        color: '#6b7280'
      }}>
        💡 <strong>Competition Photo Tips:</strong>
        <ul style={{ marginTop: '0.25rem', marginLeft: '1.5rem', lineHeight: '1.4' }}>
          <li>Place fish snout against measuring board stop</li>
          <li>Show tail end on ruler</li>
          <li>Include ID bracelet on wrist</li>
          <li>Ensure species clearly visible</li>
          <li>Multiple attempts OK if boat moving</li>
        </ul>
      </div>
    </div>
  )
}
