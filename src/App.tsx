import { useEffect, useMemo, useRef, useState } from 'react'
import tzlookup from 'tz-lookup'
import { Globe } from './Globe'
import {
  calculateShadowPath,
  calculateLocalSky,
  calculateSunTimes,
  calculateVisibilityArea,
  coordinateLabel,
  findEclipses,
  findLocalEclipse,
  regionLabel,
  shadowPointAt,
  type EclipseEvent,
} from './astronomy'
import { languageInfo, languages, translator, type Locale, type TranslationKey } from './i18n'
import { LocalSunView } from './LocalSunView'
import { DEFAULT_LOCATION, loadLocationIndex, locationCopy, searchLocations, type Location } from './locations'

function typeClass(type: EclipseEvent['type']) {
  return type === 'Total' ? 'total' : type === 'Ringförmig' ? 'annular' : 'partial'
}

function typeKey(type: EclipseEvent['type'], title = false): TranslationKey {
  if (type === 'Total') return title ? 'totalTitle' : 'total'
  if (type === 'Ringförmig') return title ? 'annularTitle' : 'annular'
  return title ? 'partialTitle' : 'partial'
}

const regionKeys: Record<string, TranslationKey> = {
  'Globale partielle Finsternis': 'regionPartial', 'Arktische Breiten': 'regionArctic', 'Antarktische Breiten': 'regionAntarctic',
  'Nordamerika': 'regionNorthAmerica', 'Südamerika / Atlantik': 'regionSouthAtlantic', 'Europa / Nordatlantik': 'regionEuropeAtlantic',
  'Afrika / Mittelmeerraum': 'regionAfrica', 'Asien': 'regionAsia', 'Australien / Pazifik': 'regionPacific', 'Ozeanische Zentralzone': 'regionOcean',
}

function obscurationLabel(value: number, type: EclipseEvent['type'], locale: string) {
  const percent = value * 100
  if (type === 'Partiell' && percent >= 99.95) return `99${locale.startsWith('de') ? ',' : '.'}9 %`
  return `${percent.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

function Icon({ name }: { name: 'play' | 'pause' | 'pin' | 'chevron' | 'sun' }) {
  const paths = {
    play: <path d="m9 7 8 5-8 5V7Z" fill="currentColor" />,
    pause: <><path d="M8 7h3v10H8zM13 7h3v10h-3z" fill="currentColor" /></>,
    pin: <><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function savedLocation(): Location {
  try {
    const value = JSON.parse(localStorage.getItem('umbra-location') ?? '') as Location
    if (value.name && value.country && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)) return value
  } catch { /* use Berlin */ }
  return DEFAULT_LOCATION
}

export function App() {
  const now = useMemo(() => new Date(), [])
  const [futureEventCount, setFutureEventCount] = useState(8)
  const events = useMemo(() => findEclipses(now, 5, futureEventCount), [now, futureEventCount])
  const initialIndex = Math.max(0, events.findIndex((event) => event.peak >= now))
  const [selectedIndex, setSelectedIndex] = useState(initialIndex)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(600)
  const [location, setLocation] = useState<Location>(savedLocation)
  const [locationQuery, setLocationQuery] = useState(location.name)
  const [locationOptions, setLocationOptions] = useState<Location[]>([])
  const [locationOpen, setLocationOpen] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [activeLocation, setActiveLocation] = useState(0)
  const [locale, setLocale] = useState<Locale>(() => {
    const stored = localStorage.getItem('umbra-language')
    return languages.some((language) => language.code === stored) ? stored as Locale : 'de'
  })
  const lastFrame = useRef<number | null>(null)
  const languageMenuRef = useRef<HTMLDetailsElement>(null)
  const locationSearchRef = useRef<HTMLDivElement>(null)
  const eventGridRef = useRef<HTMLDivElement>(null)
  const language = languageInfo(locale)
  const t = useMemo(() => translator(locale), [locale])
  const dateLong = useMemo(() => new Intl.DateTimeFormat(language.locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }), [language.locale])
  const dateShort = useMemo(() => new Intl.DateTimeFormat(language.locale, { day: '2-digit', month: 'short', year: 'numeric' }), [language.locale])
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(language.locale, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }), [language.locale])
  const countryNames = useMemo(() => new Intl.DisplayNames([language.locale], { type: 'region' }), [language.locale])
  const locationText = locationCopy(locale)

  const event = events[selectedIndex]
  const path = useMemo(() => calculateShadowPath(event), [event])
  const eventVisibilityPoints = useMemo(() => calculateVisibilityArea(event.peak), [event])
  const startTime = new Date(event.peak.getTime() - 3 * 3_600_000)
  const endTime = new Date(event.peak.getTime() + 3 * 3_600_000)
  const currentTime = new Date(startTime.getTime() + progress * (endTime.getTime() - startTime.getTime()))
  const currentPoint = useMemo(() => shadowPointAt(currentTime), [currentTime.getTime()])
  const localSkyTime = Math.round(currentTime.getTime() / 30_000) * 30_000
  const visibilityTime = Math.round(currentTime.getTime() / 120_000) * 120_000
  const visibilityPoints = useMemo(() => calculateVisibilityArea(new Date(visibilityTime)), [visibilityTime])
  const localEclipse = useMemo(() => findLocalEclipse(location.latitude, location.longitude, now), [location, now])
  const locationTimeZone = useMemo(() => tzlookup(location.latitude, location.longitude), [location])
  const localDateShort = useMemo(() => new Intl.DateTimeFormat(language.locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: locationTimeZone }), [language.locale, locationTimeZone])
  const localTimeFormat = useMemo(() => new Intl.DateTimeFormat(language.locale, { hour: '2-digit', minute: '2-digit', timeZone: locationTimeZone }), [language.locale, locationTimeZone])
  const sunTimes = useMemo(() => calculateSunTimes(location.latitude, location.longitude, localEclipse.peak, locationTimeZone), [location, localEclipse.peak, locationTimeZone])
  const localSky = useMemo(() => calculateLocalSky(location.latitude, location.longitude, new Date(localSkyTime)), [location, localSkyTime])
  const regionName = t(regionKeys[regionLabel(event.latitude, event.longitude)] ?? 'regionOcean')
  const eastLabel = locale === 'de' ? 'O' : 'E'

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('umbra-language', locale)
  }, [locale])

  useEffect(() => {
    localStorage.setItem('umbra-location', JSON.stringify(location))
  }, [location])

  useEffect(() => {
    if (!locationOpen || !locationQuery.trim()) {
      setLocationOptions([])
      return
    }
    let cancelled = false
    setLocationLoading(true)
    loadLocationIndex().then((index) => {
      if (cancelled) return
      setLocationOptions(searchLocations(index, locationQuery))
      setActiveLocation(0)
      setLocationLoading(false)
    })
    return () => { cancelled = true }
  }, [locationOpen, locationQuery])

  useEffect(() => {
    setProgress(0)
    setPlaying(true)
  }, [selectedIndex])

  useEffect(() => {
    if (futureEventCount <= 8) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const grid = eventGridRef.current
        const firstNewCard = grid?.querySelectorAll<HTMLElement>('.event-card')[futureEventCount - 5]
        if (grid && firstNewCard) grid.scrollLeft = Math.max(0, firstNewCard.offsetLeft - grid.offsetLeft)
      })
    })
  }, [futureEventCount])

  useEffect(() => {
    if (!playing) { lastFrame.current = null; return }
    let frame = 0
    const tick = (timestamp: number) => {
      if (lastFrame.current != null) {
        const elapsedRealMs = timestamp - lastFrame.current
        setProgress((value) => {
          const next = value + (elapsedRealMs * speed) / (endTime.getTime() - startTime.getTime())
          if (next >= 1) { setPlaying(false); return 1 }
          return next
        })
      }
      lastFrame.current = timestamp
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, startTime.getTime(), endTime.getTime()])

  const selectEvent = (index: number) => {
    setSelectedIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectLocation = (nextLocation: Location) => {
    setLocation(nextLocation)
    setLocationQuery(nextLocation.name)
    setLocationOpen(false)
  }

  const handleLocationKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setLocationOpen(true)
      setActiveLocation((value) => Math.min(value + 1, Math.max(0, locationOptions.length - 1)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveLocation((value) => Math.max(0, value - 1))
    } else if (event.key === 'Enter' && locationOptions[activeLocation]) {
      event.preventDefault()
      selectLocation(locationOptions[activeLocation])
    } else if (event.key === 'Escape') {
      setLocationOpen(false)
      setLocationQuery(location.name)
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Umbra">
          <span className="brand-mark"><span /></span>
          <span>UMBRA<small>{t('brandSubtitle')}</small></span>
        </a>
        <div className="top-actions">
          <span className="offline has-tooltip" data-tooltip={t('tipOffline')}><i /> {t('offline')}</span>
          <div
            className="location-search has-tooltip"
            data-tooltip={t('tipLocation')}
            ref={locationSearchRef}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setLocationOpen(false) }}
          >
            <Icon name="pin" />
            <span className="location-input-wrap"><small>{t('myLocation')}</small>
              <input
                value={locationQuery}
                placeholder={locationText.placeholder}
                onFocus={() => setLocationOpen(true)}
                onChange={(event) => { setLocationQuery(event.target.value); setLocationOpen(true) }}
                onKeyDown={handleLocationKey}
                role="combobox"
                aria-label={t('myLocation')}
                aria-autocomplete="list"
                aria-expanded={locationOpen}
                aria-controls="location-results"
                aria-activedescendant={locationOptions[activeLocation] ? `location-option-${activeLocation}` : undefined}
                autoComplete="off"
                spellCheck="false"
              />
            </span>
            {locationOpen && locationQuery.trim() && (
              <div className="location-results" id="location-results" role="listbox">
                {locationLoading && <span className="location-message">{locationText.loading}</span>}
                {!locationLoading && locationOptions.map((item, index) => (
                  <button
                    type="button"
                    id={`location-option-${index}`}
                    role="option"
                    aria-selected={index === activeLocation}
                    className={index === activeLocation ? 'active' : ''}
                    key={`${item.name}-${item.country}-${item.latitude}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveLocation(index)}
                    onClick={() => selectLocation(item)}
                  >
                    <strong>{item.name}</strong><span>{countryNames.of(item.country) ?? item.country}</span>
                  </button>
                ))}
                {!locationLoading && locationOptions.length === 0 && <span className="location-message">{locationText.noResults}</span>}
              </div>
            )}
          </div>
          <details className="language-picker" ref={languageMenuRef}>
            <summary className="has-tooltip" data-tooltip={t('chooseLanguage')} aria-label={t('chooseLanguage')}><span>{language.flag}</span><small>{locale.toUpperCase()}</small></summary>
            <div className="language-menu">
              {languages.map((item) => (
                <button key={item.code} className={`has-tooltip ${locale === item.code ? 'active' : ''}`} data-tooltip={item.name} aria-label={item.name} onClick={() => { setLocale(item.code); languageMenuRef.current?.removeAttribute('open') }}>
                  <span>{item.flag}</span><small>{item.code.toUpperCase()}</small>
                </button>
              ))}
            </div>
          </details>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span>{selectedIndex === initialIndex ? t('nextGlobal') : t('selectedGlobal')}</span><i /></div>
          <span className={`type-pill ${typeClass(event.type)}`}>{t(typeKey(event.type, true))}</span>
          <h1>{regionName}</h1>
          <p className="coordinates" dir="ltr"><Icon name="pin" /> {coordinateLabel(event.latitude, event.longitude).replace(' O', ` ${eastLabel}`)}</p>
          <div className="date-display">
            <strong>{event.peak.toLocaleDateString(language.locale, { day: '2-digit' })}</strong>
            <span>{event.peak.toLocaleDateString(language.locale, { month: 'long' })}<small>{event.peak.getFullYear()}</small></span>
          </div>
          <p className="weekday">{dateLong.format(event.peak)} · {t('maximum')} {timeFormat.format(event.peak)}</p>

          <div className="facts">
            <div className="has-tooltip" data-tooltip={t('tipType')}><span>{t('type')}</span><strong>{t(typeKey(event.type))}</strong></div>
            <div className="has-tooltip" data-tooltip={t('tipCoverage')}><span>{t('coverage')}</span><strong>{event.obscuration == null ? t('locationDependent') : obscurationLabel(event.obscuration, event.type, language.locale)}</strong></div>
            <div className="has-tooltip" data-tooltip={t('tipAxis')}><span>{t('axis')}</span><strong>{event.distance.toLocaleString(language.locale, { maximumFractionDigits: 0 })} km</strong></div>
          </div>
        </div>

        <div className="visual-stage">
          <Globe event={event} path={path} currentPoint={currentPoint} visibilityPoints={visibilityPoints} focusPoints={eventVisibilityPoints} observerLatitude={location.latitude} observerLongitude={location.longitude} tooltip={t('tipGlobe')} />
          <div className="globe-label">
            <span>{t('shadowCenter')}</span>
            <strong dir={currentPoint ? 'ltr' : undefined}>{currentPoint ? coordinateLabel(currentPoint.latitude, currentPoint.longitude).replace(' O', ` ${eastLabel}`) : t('outsideEarth')}</strong>
          </div>
          <div className={`track-explanation ${path.length > 0 ? 'has-track' : 'no-track'}`}>
            <span><i />{t('shadowTrack')}</span>
            <strong>{path.length > 0 ? t('trackAvailable') : t('trackUnavailable')}</strong>
          </div>
          <div className="simulation-card">
            <div className="sim-time"><small>{t('simulatedTime')}</small><strong>{timeFormat.format(currentTime)}</strong><span>{dateShort.format(currentTime)}</span></div>
            <button className="play-button has-tooltip" data-tooltip={t('tipPlay')} onClick={() => { if (progress >= 1) setProgress(0); setPlaying(!playing) }} aria-label={t('tipPlay')}>
              <Icon name={playing ? 'pause' : 'play'} />
            </button>
            <div className="timeline-wrap has-tooltip" data-tooltip={t('tipTimeline')}><input className="timeline" type="range" min="0" max="1" step="0.001" value={progress} onChange={(e) => { setProgress(Number(e.target.value)); setPlaying(false) }} aria-label={t('tipTimeline')} /></div>
            <div className="timeline-labels"><span>{timeFormat.format(startTime)}</span><span>{t('maximum')}</span><span>{timeFormat.format(endTime)}</span></div>
            <div className="speed-control"><span>{t('speed')}</span>{[300, 600, 1200].map((value) => <button key={value} className={`has-tooltip ${speed === value ? 'active' : ''}`} data-tooltip={t('tipSpeed')} onClick={() => setSpeed(value)}>{value}×</button>)}</div>
          </div>
        </div>
      </section>

      <section className="local-card has-tooltip" data-tooltip={t('tipLocal')}>
        <div className="local-icon"><Icon name="sun" /></div>
        <div className="local-location"><span>{t('nextAtLocation')}</span><h2>{location.name}</h2><small>{locationTimeZone}</small></div>
        <div className="local-date">
          <strong>{localDateShort.format(localEclipse.peak)}</strong>
          <span>{t(typeKey(localEclipse.type))} · {obscurationLabel(localEclipse.obscuration, localEclipse.type, language.locale)} {t('covered')}</span>
          <span className="visible-period">{t('visiblePeriod')} <b>{localTimeFormat.format(localEclipse.begin)}–{localTimeFormat.format(localEclipse.end)}</b></span>
        </div>
        <div className="local-time">
          <span>{t('localMaximum')}</span><strong>{localTimeFormat.format(localEclipse.peak)}</strong><small>{t('sunAltitude')} {localEclipse.sunAltitude.toLocaleString(language.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°</small>
          <div className="sun-times">
            <span><em>↗</em>{t('sunrise')}<strong>{sunTimes.sunrise ? localTimeFormat.format(sunTimes.sunrise) : t('noRise')}</strong></span>
            <span><em>↘</em>{t('sunset')}<strong>{sunTimes.sunset ? localTimeFormat.format(sunTimes.sunset) : t('noSet')}</strong></span>
          </div>
          {(sunTimes.polarDay || sunTimes.polarNight) && <small className="polar-state">{t(sunTimes.polarDay ? 'polarDay' : 'polarNight')}</small>}
        </div>
        <LocalSunView
          view={localSky}
          location={location.name}
          coverageLabel={t('coverage')}
          altitudeLabel={t('sunAltitude')}
          coverageValue={obscurationLabel(localSky.obscuration, event.type, language.locale)}
          altitudeValue={`${localSky.sunAltitude.toLocaleString(language.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°`}
          timeLabel={localTimeFormat.format(currentTime)}
        />
      </section>

      <section className="events-section">
        <div className="section-heading"><div><span>{t('timeTravel')}</span><h2>{t('eventsHeading')}</h2></div><p>{t('calculatedHere')}</p></div>
        <div className="event-grid" ref={eventGridRef}>
          {events.map((item, index) => {
            const past = item.peak < now
            const itemRegion = t(regionKeys[regionLabel(item.latitude, item.longitude)] ?? 'regionOcean')
            return (
              <button key={item.id} className={`event-card has-tooltip ${index === selectedIndex ? 'selected' : ''}`} data-tooltip={t('tipEvent')} onClick={() => selectEvent(index)}>
                <div><span className={`event-dot ${typeClass(item.type)}`} /><small>{past ? t('past') : index === initialIndex ? t('next') : t('upcoming')}</small><Icon name="chevron" /></div>
                <strong>{item.peak.toLocaleDateString(language.locale, { day: '2-digit' })}<span>{item.peak.toLocaleDateString(language.locale, { month: 'short' })}<small>{item.peak.toLocaleDateString(language.locale, { year: 'numeric' })}</small></span></strong>
                <p>{t(typeKey(item.type, true))}</p>
                <span>{itemRegion}</span>
              </button>
            )
          })}
        </div>
        <div className="events-actions"><button type="button" onClick={() => setFutureEventCount((count) => count + 10)}>+ {t('loadMoreEvents')}</button></div>
        <div className="legend"><span><i className="total" /> {t('total')}</span><span><i className="annular" /> {t('annular')}</span><span><i className="partial" /> {t('partial')}</span></div>
      </section>

      <footer><span>{t('localCalculation')}</span><a href="https://www.geonames.org/" target="_blank" rel="noreferrer">Ortsdaten: GeoNames</a><span>{t('noInternet')}</span></footer>
    </main>
  )
}
