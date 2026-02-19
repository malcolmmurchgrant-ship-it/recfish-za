// ============================================================
// RecFish ZA: Record Notification Modal
// src/components/RecordNotification.jsx
// ============================================================

const RECORD_CLAIM_URL = 'https://www.sadsaa.co.za/record-catches/'

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    background: 'white',
    borderRadius: '12px',
    maxWidth: '480px',
    width: '100%',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    padding: '1.5rem 1.5rem 1rem',
    textAlign: 'center',
  },
  emoji: {
    fontSize: '3rem',
    lineHeight: 1,
    marginBottom: '0.75rem',
    display: 'block',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '800',
    marginBottom: '0.25rem',
  },
  body: {
    padding: '0 1.5rem 1.5rem',
    textAlign: 'center',
  },
  message: {
    fontSize: '0.95rem',
    lineHeight: 1.6,
    color: '#374151',
    marginBottom: '1.25rem',
  },
  claimBox: {
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1.25rem',
    textAlign: 'left',
  },
  claimTitle: {
    fontWeight: '700',
    color: '#166534',
    fontSize: '0.875rem',
    marginBottom: '0.4rem',
  },
  claimText: {
    fontSize: '0.8rem',
    color: '#15803d',
    lineHeight: 1.5,
  },
  buttonRow: {
    display: 'flex',
    gap: '0.75rem',
  },
  claimButton: {
    flex: 1,
    padding: '0.75rem',
    borderRadius: '8px',
    border: 'none',
    fontWeight: '700',
    fontSize: '0.9rem',
    cursor: 'pointer',
    color: 'white',
    textDecoration: 'none',
    textAlign: 'center',
    display: 'block',
  },
  closeButton: {
    flex: 1,
    padding: '0.75rem',
    borderRadius: '8px',
    border: '2px solid #e5e7eb',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer',
    background: 'white',
    color: '#374151',
  },
}

const TYPE_CONFIG = {
  all_africa: {
    headerBg: 'linear-gradient(135deg, #1e3a8a 0%, #7e22ce 100%)',
    titleColor: 'white',
    emojiChar: '🌍',
    buttonBg: '#7e22ce',
  },
  sadsaa: {
    headerBg: 'linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)',
    titleColor: 'white',
    emojiChar: '🏆',
    buttonBg: '#1e3a8a',
  },
  vacant: {
    headerBg: 'linear-gradient(135deg, #065f46 0%, #0d9488 100%)',
    titleColor: 'white',
    emojiChar: '⭐',
    buttonBg: '#065f46',
  },
}

export default function RecordNotification({ result, onClose }) {
  if (!result) return null

  const config = TYPE_CONFIG[result.type] || TYPE_CONFIG.sadsaa
  const isVacant = result.type === 'vacant'

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Coloured header */}
        <div style={{
          ...styles.header,
          background: config.headerBg,
        }}>
          <span style={styles.emoji}>{config.emojiChar}</span>
          <div style={{ ...styles.title, color: config.titleColor }}>
            {result.title}
          </div>
        </div>

        <div style={styles.body}>
          <p style={styles.message}>{result.message}</p>

          {/* Record claim instructions */}
          {result.showClaimButton && (
            <div style={styles.claimBox}>
              <div style={styles.claimTitle}>
                📋 How to claim your record
              </div>
              <div style={styles.claimText}>
                {isVacant
                  ? 'To be officially recognised as the first SADSAA record holder, you\'ll need to submit a formal claim. At least 3 signatures are required — visit the SADSAA website for the full procedure.'
                  : 'To have your record officially recognised by SADSAA, you\'ll need to submit a formal claim with supporting documentation. At least 3 signatures are required.'}
              </div>
            </div>
          )}

          <div style={styles.buttonRow}>
            {result.showClaimButton && (
              <a
                href={RECORD_CLAIM_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...styles.claimButton,
                  background: config.buttonBg,
                }}
              >
                View Claim Procedure
              </a>
            )}
            <button style={styles.closeButton} onClick={onClose}>
              {result.showClaimButton ? 'Close' : 'OK'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
