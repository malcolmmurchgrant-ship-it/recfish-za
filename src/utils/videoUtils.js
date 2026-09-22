// Video validation utilities for release verification uploads.
// Mirrors photoUtils.js's style; reuses formatFileSize/isWithinSizeLimit
// from there rather than duplicating them, since those are format-agnostic.
//
// Limits match the approved CBSC Tuna Invitational proposal (Section 5),
// sanity-checked there against three real WhatsApp clips from last year's
// competition (12s-2:02 long, 2.4MB-27MB) rather than picked arbitrarily:
//   - up to 3 minutes duration
//   - up to 75MB file size
//   - MP4 and MOV (iPhone) accepted
//   - portrait and landscape both fine
//
// Deliberately NOT compressed on upload — phone cameras and WhatsApp
// already compress before it reaches us, and further compression risks
// losing exactly the detail (species markings, hook position, fish
// condition) a verifier needs to judge a release fairly.

export const MAX_VIDEO_DURATION_SECONDS = 180 // 3 minutes
export const MAX_VIDEO_SIZE_MB = 75

const VALID_VIDEO_TYPES = ['video/mp4', 'video/quicktime'] // .mp4, .mov

export function isValidVideo(file) {
  if (!file) return false
  return VALID_VIDEO_TYPES.includes(file.type)
}

// Reads a video file's actual duration by loading it into a hidden
// <video> element - the only reliable way to get this client-side
// without a server round trip. Resolves in seconds, or rejects if the
// file can't be read as a video at all (e.g. corrupt file).
export function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src)
      resolve(video.duration)
    }
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src)
      reject(new Error('Could not read video file - it may be corrupt or an unsupported format'))
    }

    video.src = URL.createObjectURL(file)
  })
}

export function isWithinDurationLimit(durationSeconds, maxSeconds = MAX_VIDEO_DURATION_SECONDS) {
  return durationSeconds <= maxSeconds
}
