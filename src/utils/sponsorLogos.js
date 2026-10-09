// ─── sponsorLogos.js ─────────────────────────────────────────────────────────
// Sponsor logos for a competition: uploaded once on the Reports tab
// (Sponsor / Branding), then shown on the PDF results report, the public
// Scoreboard and the big-screen TV display.
//
// Logos are stored INSIDE the competition's own report settings
// (competitions.report_settings.sponsor_logos), as small PNG images
// encoded as text ("data URLs"). That keeps them with the competition,
// needs no separate file storage, and lets the PDF and the TV draw them
// instantly with no extra downloads. Each logo is shrunk on upload to at
// most 480 × 240 pixels — plenty for a PDF header or a TV title bar — so a
// logo is typically only tens of kilobytes.
//
// Shape of one logo:  { name, dataUrl, w, h }   (w/h = pixel size, for aspect)

export const MAX_LOGOS = 6
const MAX_W = 480
const MAX_H = 240
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

// The logos saved for a competition (empty list if none).
export function getSponsorLogos(competition) {
  const list = competition?.report_settings?.sponsor_logos
  return Array.isArray(list) ? list.filter(l => l && typeof l.dataUrl === 'string' && l.dataUrl.startsWith('data:image/')) : []
}

// Read an image file chosen by the user, shrink it to fit MAX_W × MAX_H
// (never enlarged), and return it as a PNG data URL. PNG keeps transparent
// backgrounds transparent.
export function readLogoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file chosen'))
    if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/i.test(file.type)) {
      return reject(new Error('Please choose a PNG, JPG, GIF, WebP or SVG image'))
    }
    if (file.size > MAX_UPLOAD_BYTES) return reject(new Error('That image is over 10 MB — please use a smaller file'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not an image the browser can open'))
      img.onload = () => {
        const srcW = img.naturalWidth || img.width || MAX_W
        const srcH = img.naturalHeight || img.height || MAX_H
        const scale = Math.min(1, MAX_W / srcW, MAX_H / srcH)
        const w = Math.max(1, Math.round(srcW * scale))
        const h = Math.max(1, Math.round(srcH * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, w, h)
        const name = file.name.replace(/\.[^.]+$/, '')
        resolve({ name, dataUrl: canvas.toDataURL('image/png'), w, h })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// Width a logo should be drawn at for a given height, keeping its shape.
export function logoWidthFor(logo, height) {
  const w = Number(logo?.w) || 2, h = Number(logo?.h) || 1
  return height * (w / h)
}
