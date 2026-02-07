// Photo compression and processing utilities

/**
 * Compress image to WebP format
 * @param {File} file - Original image file
 * @param {number} maxWidth - Maximum width (default 1920px)
 * @param {number} quality - WebP quality 0-1 (default 0.85)
 * @returns {Promise<Blob>} Compressed WebP blob
 */
export async function compressToWebP(file, maxWidth = 1920, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      const img = new Image()
      
      img.onload = async () => {
        // Calculate dimensions maintaining aspect ratio
        let width = img.width
        let height = img.height
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        
        // Draw and compress
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        
        // Convert to WebP
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to compress image'))
            }
          },
          'image/webp',
          quality
        )
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target.result
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Generate thumbnail from image file
 * @param {File} file - Original image file
 * @param {number} size - Thumbnail size (default 300px)
 * @returns {Promise<Blob>} Thumbnail WebP blob
 */
export async function generateThumbnail(file, size = 300) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        // Create square thumbnail
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        
        const ctx = canvas.getContext('2d')
        
        // Calculate crop for square thumbnail
        const minDim = Math.min(img.width, img.height)
        const sx = (img.width - minDim) / 2
        const sy = (img.height - minDim) / 2
        
        // Draw cropped and scaled
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
        
        // Convert to WebP
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to generate thumbnail'))
            }
          },
          'image/webp',
          0.8
        )
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target.result
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Extract EXIF GPS data from image file
 * Note: Requires exif-js library or native browser support
 * @param {File} file - Image file
 * @returns {Promise<{lat: number, lon: number} | null>}
 */
export async function extractGPSFromPhoto(file) {
  // This is a placeholder - in production you'd use exif-js library
  // For now, we'll rely on the GPS capture from the device
  return null
  
  /* With exif-js library:
  return new Promise((resolve) => {
    EXIF.getData(file, function() {
      const lat = EXIF.getTag(this, 'GPSLatitude')
      const lon = EXIF.getTag(this, 'GPSLongitude')
      const latRef = EXIF.getTag(this, 'GPSLatitudeRef')
      const lonRef = EXIF.getTag(this, 'GPSLongitudeRef')
      
      if (lat && lon) {
        const latitude = convertDMSToDD(lat, latRef)
        const longitude = convertDMSToDD(lon, lonRef)
        resolve({ lat: latitude, lon: longitude })
      } else {
        resolve(null)
      }
    })
  })
  */
}

/**
 * Validate file is an image
 * @param {File} file - File to validate
 * @returns {boolean}
 */
export function isValidImage(file) {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
  return validTypes.includes(file.type)
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * Check if file size is within limit
 * @param {File} file - File to check
 * @param {number} maxMB - Maximum size in MB (default 5MB)
 * @returns {boolean}
 */
export function isWithinSizeLimit(file, maxMB = 5) {
  const maxBytes = maxMB * 1024 * 1024
  return file.size <= maxBytes
}
