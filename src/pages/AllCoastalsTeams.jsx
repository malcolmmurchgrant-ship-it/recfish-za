// AllCoastalsTeams.jsx
// Displays all 12 teams for the SADSAA 2026 All Coastal Bottomfish Inter-Provincial
// with province logos and captains listed first.
//
// Route: /allcoastals-teams
// Place in: src/pages/AllCoastalsTeams.jsx
// Logo data: src/data/logos_b64.js  (generated file — copy as-is)
// Team data: src/data/allCoastalsTeamData.js

import React from 'react'
import { useNavigate } from 'react-router-dom'

// ─── inline logo data (copy logos_b64.js to src/data/logos_b64.js) ──────────
// Then replace this import with: import { PROVINCE_LOGOS } from '../data/logos_b64'
// For now we pull logos from props/data below so the component is self-contained.

const NAVY = '#1a3a5c'
const GOLD = '#c9a84c'

// ─── Province logo map ───────────────────────────────────────────────────────
// After copying logos_b64.js, change to:
//   import { PROVINCE_LOGOS } from '../data/logos_b64'
// and remove PROVINCE_LOGOS below.
// For initial rendering without the file, logos gracefully absent.
let PROVINCE_LOGOS = {}
try {
  // eslint-disable-next-line
  PROVINCE_LOGOS = require('../data/logos_b64').PROVINCE_LOGOS
} catch (_) {}

// ─── Team definitions ────────────────────────────────────────────────────────
const TEAMS = [
  {
    id: 'EPDSAA_A',
    name: 'EPDSAA A',
    logo: 'EPDSAA',
    accent: '#cc0000',
    captain: 'Wayne Gerber',
    anglers: ['Wayne Gerber', 'Brian Gerber', 'Donald Brown'],
  },
  {
    id: 'EPDSAA_B',
    name: 'EPDSAA B',
    logo: 'EPDSAA',
    accent: '#cc0000',
    captain: 'Brett Potgieter',
    anglers: ['Brett Potgieter', 'Jacques Bekker', 'Deon van Jaarsveld'],
  },
  {
    id: 'EP_LADIES_A',
    name: 'EP Ladies A',
    logo: 'EPDSAA',
    accent: '#c2185b',
    captain: 'Lisa Bekker',
    anglers: ['Lisa Bekker', 'Sheena Gerber', 'Maggie Kolesky'],
  },
  {
    id: 'EP_LADIES_B',
    name: 'EP Ladies B',
    logo: 'EPDSAA',
    accent: '#c2185b',
    captain: 'Brenda Weyer',
    anglers: ['Brenda Weyer', 'Madelein Fourie', 'Joelene Lerm'],
  },
  {
    id: 'BORDER_WHITE',
    name: 'Border White',
    logo: 'BORDER',
    accent: '#2e7d32',
    captain: 'Andrew Sparg',
    anglers: ['Andrew Sparg', 'Dennis Ford', 'Tim Wood'],
  },
  {
    id: 'BORDER_BLUE',
    name: 'Border Blue',
    logo: 'BORDER',
    accent: '#1565c0',
    captain: 'Michael Swanepoel',
    anglers: ['Michael Swanepoel', 'Peter Mansvelt', 'Wayne Voogt'],
  },
  {
    id: 'SOUTHERN_CAPE_MEN',
    name: 'Southern Cape Men',
    logo: 'SOUTHERN_CAPE',
    accent: '#1b5e20',
    captain: 'Kobus Oosthuizen',
    anglers: ['Kobus Oosthuizen', 'Pieter Strobos', 'Wessel Havenga'],
  },
  {
    id: 'SOUTHERN_CAPE_JNR_WHITE',
    name: 'SC Juniors White',
    logo: 'SOUTHERN_CAPE',
    accent: '#388e3c',
    captain: 'Joshua Du Plessis',
    anglers: ['Joshua Du Plessis', 'Jaden De Villiers', 'Saxon Ansley'],
  },
  {
    id: 'SOUTHERN_CAPE_JNR_GREEN',
    name: 'SC Juniors Green',
    logo: 'SOUTHERN_CAPE',
    accent: '#33691e',
    captain: 'Jack Magerla',
    anglers: ['Jack Magerla', 'Owen Lineker', 'Ben Groenewald'],
  },
  {
    id: 'WESTERN_PROVINCE',
    name: 'Western Province',
    logo: 'WESTERN_PROVINCE',
    accent: '#1a237e',
    captain: 'Stephen Flemming',
    anglers: ['Stephen Flemming', 'Ossie Sauermann', 'Gareth Decker'],
  },
  {
    id: 'NATAL',
    name: 'Natal',
    logo: 'NATAL',
    accent: '#4a148c',
    captain: 'Riaz Hussain',
    anglers: ['Riaz Hussain', 'Brandon Hooke', 'Sayed Cassiem'],
  },
  {
    id: 'FREE_STATE',
    name: 'Free State',
    logo: 'FREE_STATE',
    accent: '#e65100',
    captain: 'Andrea Papachristoforou',
    anglers: ['Andrea Papachristoforou', 'Xavier Truluck', 'Phillip Papachristoforou'],
  },
]

// ─── TeamCard ─────────────────────────────────────────────────────────────────
function TeamCard({ team }) {
  const logoSrc = PROVINCE_LOGOS[team.logo]
  return (
    <div style={{
      background: 'white',
      borderRadius: 10,
      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
      borderLeft: `5px solid ${team.accent}`,
      marginBottom: '1rem',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        background: team.accent,
        color: 'white',
        padding: '0.65rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        {logoSrc && (
          <img
            src={logoSrc}
            alt={team.logo}
            style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0,
                     background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: 2 }}
          />
        )}
        <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: 0.5 }}>
          {team.name}
        </span>
      </div>

      {/* Angler list — captain always first */}
      <div style={{ padding: '0.6rem 1rem 0.75rem' }}>
        {team.anglers.map((angler, i) => {
          const isCaptain = angler === team.captain
          return (
            <div key={angler} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.3rem 0',
              borderBottom: i < team.anglers.length - 1 ? '1px solid #f0f0f0' : 'none',
            }}>
              {isCaptain ? (
                <span title="Captain" style={{ fontSize: '1rem' }}>⚓</span>
              ) : (
                <span style={{ width: '1rem', display: 'inline-block' }} />
              )}
              <span style={{
                fontWeight: isCaptain ? 700 : 400,
                color: isCaptain ? team.accent : '#333',
                fontSize: '0.92rem',
              }}>
                {angler}
              </span>
              {isCaptain && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'white',
                  background: team.accent,
                  borderRadius: 3,
                  padding: '1px 6px',
                  letterSpacing: 0.5,
                }}>
                  CAPTAIN
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Province group ───────────────────────────────────────────────────────────
function ProvinceSection({ provinceLabel, teams }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{
        fontSize: '0.78rem',
        fontWeight: 700,
        color: '#666',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: '0.5rem',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '0.25rem',
      }}>
        {provinceLabel}
      </div>
      {teams.map(t => <TeamCard key={t.id} team={t} />)}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AllCoastalsTeams() {
  const navigate = useNavigate()

  // Group teams by province display label
  const groups = [
    { label: 'Eastern Province (EPDSAA)', ids: ['EPDSAA_A', 'EPDSAA_B', 'EP_LADIES_A', 'EP_LADIES_B'] },
    { label: 'Border',                    ids: ['BORDER_WHITE', 'BORDER_BLUE'] },
    { label: 'Southern Cape',             ids: ['SOUTHERN_CAPE_MEN', 'SOUTHERN_CAPE_JNR_WHITE', 'SOUTHERN_CAPE_JNR_GREEN'] },
    { label: 'Western Province',          ids: ['WESTERN_PROVINCE'] },
    { label: 'Natal',                     ids: ['NATAL'] },
    { label: 'Free State',                ids: ['FREE_STATE'] },
  ]

  const teamById = Object.fromEntries(TEAMS.map(t => [t.id, t]))

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>

      {/* Page header */}
      <div style={{
        background: NAVY,
        color: 'white',
        padding: '1.1rem 1.25rem',
        borderRadius: 8,
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <span style={{ fontSize: '1.5rem' }}>🏆</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
            SADSAA 2026 All Coastal Bottomfish
          </div>
          <div style={{ fontSize: '0.82rem', opacity: 0.8, marginTop: 2 }}>
            Cape St Francis · 12 Teams · 36 Anglers · ⚓ = Captain
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        marginBottom: '1.25rem',
      }}>
        {[
          { label: 'Teams', val: '12' },
          { label: 'Anglers', val: '36' },
          { label: 'Provinces', val: '6' },
          { label: 'Fishing Days', val: '3' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'white',
            borderRadius: 6,
            padding: '0.45rem 0.9rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            textAlign: 'center',
            flex: '1 1 60px',
          }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: NAVY }}>{s.val}</div>
            <div style={{ fontSize: '0.7rem', color: '#666' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Team groups */}
      {groups.map(g => (
        <ProvinceSection
          key={g.label}
          provinceLabel={g.label}
          teams={g.ids.map(id => teamById[id]).filter(Boolean)}
        />
      ))}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/allcoastals')}
          style={{
            background: NAVY, color: 'white', border: 'none',
            borderRadius: 6, padding: '0.6rem 1.1rem', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.9rem',
          }}
        >
          🎣 Enter Catches
        </button>
        <button
          onClick={() => navigate('/allcoastals-scores')}
          style={{
            background: GOLD, color: 'white', border: 'none',
            borderRadius: 6, padding: '0.6rem 1.1rem', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.9rem',
          }}
        >
          📊 Live Scoreboard
        </button>
        <button
          onClick={() => navigate('/competitions')}
          style={{
            background: '#f5f5f5', color: '#333', border: '1px solid #ddd',
            borderRadius: 6, padding: '0.6rem 1.1rem', cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
