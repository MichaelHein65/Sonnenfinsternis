import type { LocalSkyView } from './astronomy'

interface LocalSunViewProps {
  view: LocalSkyView
  location: string
  coverageLabel: string
  altitudeLabel: string
  coverageValue: string
  altitudeValue: string
  timeLabel: string
}

export function LocalSunView({ view, location, coverageLabel, altitudeLabel, coverageValue, altitudeValue, timeLabel }: LocalSunViewProps) {
  const sunRadius = 64
  const rawX = view.moonOffsetX * sunRadius
  const rawY = view.moonOffsetY * sunRadius
  const distance = Math.hypot(rawX, rawY)
  const frameLimit = 116
  const clampScale = distance > frameLimit ? frameLimit / distance : 1
  const moonX = rawX * clampScale
  const moonY = rawY * clampScale
  const moonRadius = sunRadius * view.moonRadiusRatio
  const belowHorizon = view.sunAltitude < 0
  const showHorizon = view.sunAltitude < 6
  const horizonY = Math.max(-120, Math.min(120, view.sunAltitude * 18))

  return (
    <div className={`local-sun-view ${belowHorizon ? 'below-horizon' : ''}`} aria-label={`${location}: ${coverageLabel} ${coverageValue}`}>
      <div className="local-sun-heading"><span>{location}</span><small>{timeLabel}</small></div>
      <svg viewBox="-150 -150 300 300" role="img" aria-hidden="true">
        <defs>
          <radialGradient id="sunDisc" cx="42%" cy="38%">
            <stop offset="0" stopColor="#fff4b8" />
            <stop offset=".52" stopColor="#f4b54d" />
            <stop offset="1" stopColor="#cf7623" />
          </radialGradient>
          <filter id="sunGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <linearGradient id="horizonFade" x1="0" y1={horizonY - 18} x2="0" y2={horizonY + 115} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#111c27" stopOpacity="0" />
            <stop offset=".24" stopColor="#111c27" stopOpacity=".48" />
            <stop offset="1" stopColor="#071018" stopOpacity=".94" />
          </linearGradient>
        </defs>
        <circle r="82" fill="#e9a94a" opacity=".16" filter="url(#sunGlow)" />
        <circle r="70" fill="none" stroke="#e9a94a" strokeOpacity=".26" strokeWidth="2" />
        <circle r={sunRadius} fill="url(#sunDisc)" />
        <circle r={sunRadius - 3} fill="none" stroke="#ffe7a1" strokeOpacity=".45" />
        {distance > frameLimit && <line x1={moonX * .76} y1={moonY * .76} x2={moonX * .92} y2={moonY * .92} stroke="#9eabb4" strokeDasharray="4 5" opacity=".6" />}
        <g transform={`translate(${moonX} ${moonY})`}>
          <circle r={moonRadius + 2} fill="none" stroke="#a9bbc6" strokeOpacity=".35" />
          <circle r={moonRadius} fill="#03070c" />
        </g>
        {showHorizon && (
          <>
            <path d={`M-180 ${horizonY + 12} Q0 ${horizonY - 14} 180 ${horizonY + 12} L180 180 L-180 180Z`} fill="url(#horizonFade)" />
            <path d={`M-180 ${horizonY + 12} Q0 ${horizonY - 14} 180 ${horizonY + 12}`} fill="none" stroke="#9babb5" strokeWidth="2" strokeOpacity=".62" />
          </>
        )}
      </svg>
      <div className="local-sun-stats">
        <span>{coverageLabel}<strong>{coverageValue}</strong></span>
        <span>{altitudeLabel}<strong>{altitudeValue}</strong></span>
      </div>
    </div>
  )
}
