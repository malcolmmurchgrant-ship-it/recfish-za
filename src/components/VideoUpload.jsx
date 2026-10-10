import { useState, useEffect, useRef, useCallback } from 'react'
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
//
// Unreliable-connection handling (added after testing the club wifi,
// which drops whenever the phone switches to another app or site):
//   - The selected file is kept after a failed upload, so the scorer
//     taps "Retry upload" instead of hunting for the clip again.
//   - Going offline mid-upload marks it failed straight away, rather
//     than leaving a spinner that never finishes.
//   - When the connection comes back, a failed upload retries itself
//     automatically (once per reconnect).
//   - A generous size-based timeout catches uploads that hang silently
//     without the browser ever reporting "offline".
//   - Retries reuse the same storage filename. If an earlier attempt
//     actually reached the server before the connection dropped, the
//     retry's "already exists" reply is treated as success - no
//     duplicate files, no false failure.
// Saving the catch is still blocked by UniversalCatchLogger until a
// video URL exists, so a failed upload can never save as a 0-point
// release with nothing for the verifier to watch.

const BUCKET = 'release-videos'

// 2 minutes base + 10 seconds per MB: a 27MB clip gets ~6.5 minutes,
// a 75MB clip ~14.5 minutes. Only a backstop for silent hangs.
function uploadTimeoutMs(file) {
  const mb = file.size / (1024 * 1024)
  return (120 + Math.ceil(mb) * 10) * 1000
}

function isAlreadyExistsError(err) {
  const msg = (err?.message || '').toLowerCase()
  return err?.statusCode === '409' || err?.statusCode === 409 ||
    msg.includes('already exists') || msg.includes('duplicate')
}

function friendlyError(err, offline) {
  if (offline) return 'Connection lost. The video is still selected — it will retry when the connection returns, or tap Retry upload.'
  if (err?.name === 'TimeoutError') return 'Upload took too long, probably a weak connection. Tap Retry upload.'
  const msg = (err?.message || '').toLowerCase()
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('load failed')) {
    return 'Upload failed: no connection. Tap Retry upload once the signal is back.'
  }
  return 'Upload failed: ' + (err?.message || 'unknown error') + '. Tap Retry upload.'
}

export default function VideoUpload({ onVideoUploaded, existingVideoUrl, label = 'Attach release video' }) {
  const { user } = useAuth()
  const [status, setStatus] = useState(existingVideoUrl ? 'done' : 'idle') // idle | uploading | failed | done
  const [uploaded, setUploaded] = useState(existingVideoUrl || null)
  const [error, setError] = useState('')
  const [progressNote, setProgressNote] = useState('')
  const [pendingFile, setPendingFile] = useState(null) // kept for retry
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  const pendingRef = useRef(null)      // { file, filename }
  const attemptRef = useRef(0)         // ignores results from superseded attempts
  const statusRef = useRef(status)
  const inputRef = useRef(null)
  useEffect(() => { statusRef.current = status }, [status])

  const uploadVideo = useCallback(async () => {
    const pending = pendingRef.current
    if (!pending || !user) return
    const { file, filename } = pending
    const attempt = ++attemptRef.current

    setStatus('uploading')
    setError('')
    setProgressNote(`Uploading ${formatFileSize(file.size)}…`)

    let timer
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          const e = new Error('Upload timed out')
          e.name = 'TimeoutError'
          reject(e)
        }, uploadTimeoutMs(file))
      })

      // No compression - uploaded exactly as filmed. Phone cameras and
      // WhatsApp already compress; further compression risks losing the
      // detail a verifier needs (species markings, hook position, fish
      // condition).
      const upload = supabase.storage.from(BUCKET).upload(filename, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

      const { error: uploadError } = await Promise.race([upload, timeout])
      if (uploadError && !isAlreadyExistsError(uploadError)) throw uploadError

      if (attempt !== attemptRef.current) return // a newer attempt took over

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename)

      pendingRef.current = null
      setPendingFile(null)
      setUploaded(publicUrl)
      setProgressNote('')
      setStatus('done')

      onVideoUploaded({
        videoUrl: publicUrl,
        metadata: {
          originalFilename: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        },
      })
    } catch (err) {
      if (attempt !== attemptRef.current) return
      console.error('Error uploading video:', err)
      setError(friendlyError(err, !navigator.onLine))
      setProgressNote('')
      setStatus('failed')
    } finally {
      clearTimeout(timer)
    }
  }, [user, onVideoUploaded])

  // Watch the connection: fail fast when it drops mid-upload, retry
  // automatically when it comes back.
  useEffect(() => {
    const goOffline = () => {
      setIsOnline(false)
      if (statusRef.current === 'uploading') {
        attemptRef.current++ // abandon the in-flight attempt
        setError(friendlyError(null, true))
        setProgressNote('')
        setStatus('failed')
      }
    }
    const goOnline = () => {
      setIsOnline(true)
      if (statusRef.current === 'failed' && pendingRef.current) {
        uploadVideo()
      }
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [uploadVideo])

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    // Reset so the same clip can be picked again later if needed.
    if (inputRef.current) inputRef.current.value = ''
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

    // One filename per selected file, reused on every retry.
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const ext = file.type === 'video/quicktime' ? 'mov' : 'mp4'
    pendingRef.current = { file, filename: `${user.id}/${timestamp}-${randomStr}.${ext}` }
    setPendingFile(file)

    await uploadVideo()
  }

  const cancelPending = () => {
    attemptRef.current++
    pendingRef.current = null
    setPendingFile(null)
    setError('')
    setProgressNote('')
    setStatus('idle')
  }

  const removeVideo = () => {
    setUploaded(null)
    setStatus('idle')
    onVideoUploaded(null)
  }

  const btn = (bg, disabled) => ({
    padding: '0.5rem 1rem', background: disabled ? '#9ca3af' : bg, color: 'white',
    border: 'none', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex',
    alignItems: 'center', gap: '0.4rem',
  })

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      {status === 'done' && uploaded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <video
            src={uploaded}
            controls
            style={{ width: 160, height: 120, borderRadius: 6, background: '#000' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>✓ Video uploaded</span>
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
        </div>
      ) : status === 'failed' && pendingFile ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <button type="button" onClick={uploadVideo} disabled={!isOnline} style={btn('#c2410c', !isOnline)}>
            <span>↻</span>
            <span>{isOnline ? 'Retry upload' : 'Waiting for connection…'}</span>
          </button>
          <button
            type="button"
            onClick={cancelPending}
            style={{
              background: 'none', border: '1px solid #d1d5db', color: '#374151',
              borderRadius: 6, padding: '0.45rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            Choose a different video
          </button>
        </div>
      ) : (
        <label style={btn('#c2410c', status === 'uploading')}>
          <span>🎥</span>
          <span>{status === 'uploading' ? (progressNote || 'Uploading…') : label}</span>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime"
            onChange={handleFileSelect}
            disabled={status === 'uploading'}
            style={{ display: 'none' }}
          />
        </label>
      )}

      {status === 'uploading' && (
        <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#6b7280', maxWidth: 280 }}>
          Keep this screen open until the upload finishes. Switching to WhatsApp or another app can interrupt it.
        </div>
      )}

      {status === 'failed' && pendingFile && (
        <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#6b7280', maxWidth: 280 }}>
          Selected: {pendingFile.name} ({formatFileSize(pendingFile.size)})
        </div>
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
