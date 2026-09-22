import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatFileSize, isWithinSizeLimit } from '../utils/photoUtils'
import { isValidVideo, getVideoDuration, isWithinDurationLimit, MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_SIZE_MB } from '../utils/videoUtils'

// VideoUpload — release-video attachment for a catch logger row.
// Deliberately NOT wired into every competition: only rendered where a
// species_config entry sets require_video_evidence (see
// UniversalCatchLogger.jsx). Existing competitions that don't set that
// flag - including the Gamefish Nationals Kingfish rule this borrows its
// row-styling from - never render this at all and are unaffected.
export default function VideoUpload({ onVideoUploaded, existingVideoUrl }) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(existingVideoUrl || null)
  const [error, setError] = useState('')
  const [progressNote, setProgressNote] = useState('')

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')

    if (!isValidVideo(file)) {
      setError('Please select an MP4 or MOV video file')
      return
    }

    if (!isWithinSizeLimit(file, MAX_VIDEO_SIZE_MB)) {
      setError(`Video must be under ${MAX_VIDEO_SIZE_MB}MB (this file is ${formatFileSize(file.size)})`)
      return
    }

    let duration
    try {
      duration = await getVideoDuration(file)
    } catch (err) {
      setError(err.message)
      return
    }

    if (!isWithinDurationLimit(duration)) {
      const mins = Math.floor(duration / 60)
      const secs = Math.round(duration % 60)
      setError(`Video must be ${MAX_VIDEO_DURATION_SECONDS / 60} minutes or shorter (this one is ${mins}:${secs.toString().padStart(2, '0')})`)
      return
    }

    await uploadVideo(file)
  }

  const uploadVideo = async (file) => {
    try {
      setUploading(true)
      setError('')
      setProgressNote(`Uploading ${formatFileSize(file.size)}...`)

      // No compression - uploaded exactly as filmed. Phone cameras and
      // WhatsApp already compress; further compression risks losing the
      // detail a verifier needs (species markings, hook position, fish
      // condition).
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(7)
      const ext = file.type === 'video/quicktime' ? 'mov' : 'mp4'
      const filename = `${user.id}/${timestamp}-${randomStr}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('release-videos')
        .upload(filename, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('release-videos')
        .getPublicUrl(filename)

      setUploaded(publicUrl)
      setProgressNote('')

      onVideoUploaded({
        videoUrl: publicUrl,
        metadata: {
          originalFilename: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        },
      })
    } catch (err) {
      console.error('Error uploading video:', err)
      setError('Failed to upload video: ' + err.message)
      setProgressNote('')
    } finally {
      setUploading(false)
    }
  }

  const removeVideo = () => {
    setUploaded(null)
    onVideoUploaded(null)
  }

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      {uploaded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <video
            src={uploaded}
            controls
            style={{ width: 160, height: 120, borderRadius: 6, background: '#000' }}
          />
          <button
            onClick={removeVideo}
            type="button"
            style={{
              background: 'rgba(220, 38, 38, 0.9)', color: 'white', border: 'none',
              borderRadius: 6, padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <label style={{
          padding: '0.5rem 1rem', background: uploading ? '#9ca3af' : '#c2410c', color: 'white',
          border: 'none', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600,
          cursor: uploading ? 'not-allowed' : 'pointer', display: 'inline-flex',
          alignItems: 'center', gap: '0.4rem',
        }}>
          <span>🎥</span>
          <span>{uploading ? (progressNote || 'Uploading…') : 'Attach release video'}</span>
          <input
            type="file"
            accept="video/mp4,video/quicktime"
            onChange={handleFileSelect}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      )}

      {error && (
        <div style={{
          marginTop: '0.4rem', padding: '0.5rem 0.6rem', background: '#fee2e2',
          color: '#991b1b', borderRadius: 6, fontSize: '0.78rem', maxWidth: 280,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
