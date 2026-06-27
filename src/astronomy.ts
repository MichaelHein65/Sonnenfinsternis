import {
  AstroTime,
  Body,
  Equator,
  EclipseKind,
  GeoMoon,
  GeoVector,
  Horizon,
  KM_PER_AU,
  NextGlobalSolarEclipse,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  SearchGlobalSolarEclipse,
  SearchLocalSolarEclipse,
  SearchRiseSet,
  SiderealTime,
  Vector,
} from 'astronomy-engine'

const EARTH_RADIUS_KM = 6378.137
const EARTH_FLATTENING = 0.996647180302104
const RAD2DEG = 180 / Math.PI
const DEG2RAD = Math.PI / 180
const SUN_RADIUS_KM = 695700
const MOON_RADIUS_KM = 1737.4

export type EclipseType = 'Total' | 'Ringförmig' | 'Partiell'

export interface EclipseEvent {
  id: string
  peak: Date
  type: EclipseType
  latitude?: number
  longitude?: number
  obscuration?: number
  distance: number
}

export interface ShadowPoint {
  time: Date
  latitude: number
  longitude: number
}

export interface VisibilityPoint {
  latitude: number
  longitude: number
  intensity: number
}

export interface LocalEclipse {
  peak: Date
  begin: Date
  end: Date
  type: EclipseType
  obscuration: number
  sunAltitude: number
}

export interface LocalSkyView {
  moonOffsetX: number
  moonOffsetY: number
  moonRadiusRatio: number
  obscuration: number
  sunAltitude: number
  separation: number
}

export interface SunTimes {
  sunrise: Date | null
  sunset: Date | null
  polarDay: boolean
  polarNight: boolean
}

function eclipseType(kind: EclipseKind): EclipseType {
  if (kind === EclipseKind.Total) return 'Total'
  if (kind === EclipseKind.Annular) return 'Ringförmig'
  return 'Partiell'
}

export function findEclipses(center = new Date(), pastCount = 5, futureCount = 8): EclipseEvent[] {
  const start = new Date(Date.UTC(center.getUTCFullYear() - 5, 0, 1))
  const end = new Date(Date.UTC(center.getUTCFullYear() + 8, 11, 31))
  const all: EclipseEvent[] = []
  let item = SearchGlobalSolarEclipse(start)

  while (item.peak.date <= end) {
    all.push({
      id: item.peak.date.toISOString(),
      peak: item.peak.date,
      type: eclipseType(item.kind),
      latitude: item.latitude,
      longitude: item.longitude,
      obscuration: item.obscuration,
      distance: item.distance,
    })
    item = NextGlobalSolarEclipse(item.peak)
  }

  const split = all.findIndex((event) => event.peak >= center)
  const pivot = split < 0 ? all.length : split
  return all.slice(Math.max(0, pivot - pastCount), pivot + futureCount)
}

function moonShadow(time: Date) {
  const astroTime = new AstroTime(time)
  const sun = GeoVector(Body.Sun, astroTime, true)
  const moon = GeoMoon(astroTime)
  const earthFromMoon = new Vector(-moon.x, -moon.y, -moon.z, astroTime)
  const direction = new Vector(moon.x - sun.x, moon.y - sun.y, moon.z - sun.z, astroTime)
  return { time: astroTime, target: earthFromMoon, direction }
}

/** Intersects the instantaneous Moon-shadow axis with the oblate Earth. */
export function shadowPointAt(time: Date): ShadowPoint | null {
  const shadow = moonShadow(time)
  const rotation = Rotation_EQJ_EQD(shadow.time)
  const vector = RotateVector(rotation, shadow.direction)
  const earth = RotateVector(rotation, shadow.target)

  vector.x *= KM_PER_AU
  vector.y *= KM_PER_AU
  vector.z *= KM_PER_AU / EARTH_FLATTENING
  earth.x *= KM_PER_AU
  earth.y *= KM_PER_AU
  earth.z *= KM_PER_AU / EARTH_FLATTENING

  const a = vector.x ** 2 + vector.y ** 2 + vector.z ** 2
  const b = -2 * (vector.x * earth.x + vector.y * earth.y + vector.z * earth.z)
  const c = earth.x ** 2 + earth.y ** 2 + earth.z ** 2 - EARTH_RADIUS_KM ** 2
  const discriminant = b ** 2 - 4 * a * c
  if (discriminant <= 0) return null

  const u = (-b - Math.sqrt(discriminant)) / (2 * a)
  const x = u * vector.x - earth.x
  const y = u * vector.y - earth.y
  const z = (u * vector.z - earth.z) * EARTH_FLATTENING
  const projected = Math.hypot(x, y) * EARTH_FLATTENING ** 2
  const latitude = projected === 0 ? (z > 0 ? 90 : -90) : RAD2DEG * Math.atan(z / projected)
  let longitude = (RAD2DEG * Math.atan2(y, x) - 15 * SiderealTime(shadow.time)) % 360
  if (longitude <= -180) longitude += 360
  if (longitude > 180) longitude -= 360
  return { time, latitude, longitude }
}

export function calculateShadowPath(event: EclipseEvent): ShadowPoint[] {
  const points: ShadowPoint[] = []
  for (let minutes = -210; minutes <= 210; minutes += 3) {
    const time = new Date(event.peak.getTime() + minutes * 60_000)
    const point = shadowPointAt(time)
    if (point) points.push(point)
  }
  return points
}

/** Samples the instantaneous penumbral footprint on the Earth's surface. */
export function calculateVisibilityArea(time: Date, stepDegrees = 3): VisibilityPoint[] {
  const shadow = moonShadow(time)
  const rotation = Rotation_EQJ_EQD(shadow.time)
  const direction = RotateVector(rotation, shadow.direction)
  const earthFromMoon = RotateVector(rotation, shadow.target)
  const directionLengthSquared = direction.x ** 2 + direction.y ** 2 + direction.z ** 2
  const gast = 15 * SiderealTime(shadow.time) * DEG2RAD
  const earthRadiusAu = EARTH_RADIUS_KM / KM_PER_AU
  const points: VisibilityPoint[] = []

  for (let latitude = -90 + stepDegrees / 2; latitude < 90; latitude += stepDegrees) {
    const lat = latitude * DEG2RAD
    const cosLat = Math.cos(lat)
    const z = earthRadiusAu * Math.sin(lat) * EARTH_FLATTENING
    for (let longitude = -180; longitude < 180; longitude += stepDegrees) {
      const angle = longitude * DEG2RAD + gast
      const observer = {
        x: earthFromMoon.x + earthRadiusAu * cosLat * Math.cos(angle),
        y: earthFromMoon.y + earthRadiusAu * cosLat * Math.sin(angle),
        z: earthFromMoon.z + z,
      }
      const u = (direction.x * observer.x + direction.y * observer.y + direction.z * observer.z) / directionLengthSquared
      const dx = u * direction.x - observer.x
      const dy = u * direction.y - observer.y
      const dz = u * direction.z - observer.z
      const distance = KM_PER_AU * Math.hypot(dx, dy, dz)
      const penumbraRadius = -SUN_RADIUS_KM + (1 + u) * (SUN_RADIUS_KM + MOON_RADIUS_KM)
      if (penumbraRadius > 0 && distance <= penumbraRadius) {
        points.push({ latitude, longitude, intensity: 1 - distance / penumbraRadius })
      }
    }
  }
  return points
}

export function findLocalEclipse(latitude: number, longitude: number, start = new Date()): LocalEclipse {
  const result = SearchLocalSolarEclipse(start, new Observer(latitude, longitude, 0))
  return {
    peak: result.peak.time.date,
    begin: result.partial_begin.time.date,
    end: result.partial_end.time.date,
    type: eclipseType(result.kind),
    obscuration: result.obscuration,
    sunAltitude: result.peak.altitude,
  }
}

function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

/** Finds sunrise and sunset on the observer's local calendar date. */
export function calculateSunTimes(latitude: number, longitude: number, date: Date, timeZone: string): SunTimes {
  const observer = new Observer(latitude, longitude, 0)
  const targetDate = localDateKey(date, timeZone)
  const searchStart = new Date(date.getTime() - 36 * 3_600_000)

  const findOnDate = (direction: 1 | -1) => {
    let cursor = searchStart
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = SearchRiseSet(Body.Sun, observer, direction, cursor, 3)
      if (!result) return null
      const resultDate = localDateKey(result.date, timeZone)
      if (resultDate === targetDate) return result.date
      if (resultDate > targetDate) return null
      cursor = new Date(result.date.getTime() + 60_000)
    }
    return null
  }

  const sunrise = findOnDate(1)
  const sunset = findOnDate(-1)
  let polarDay = false
  let polarNight = false
  if (!sunrise && !sunset) {
    const sun = Equator(Body.Sun, date, observer, true, true)
    const altitude = Horizon(date, observer, sun.ra, sun.dec, 'normal').altitude
    polarDay = altitude > 0
    polarNight = !polarDay
  }
  return { sunrise, sunset, polarDay, polarNight }
}

function circleOverlapFraction(sunRadius: number, moonRadius: number, separation: number): number {
  if (separation >= sunRadius + moonRadius) return 0
  if (separation <= Math.abs(sunRadius - moonRadius)) {
    return moonRadius >= sunRadius ? 1 : (moonRadius * moonRadius) / (sunRadius * sunRadius)
  }
  const sunPart = sunRadius * sunRadius * Math.acos((separation ** 2 + sunRadius ** 2 - moonRadius ** 2) / (2 * separation * sunRadius))
  const moonPart = moonRadius * moonRadius * Math.acos((separation ** 2 + moonRadius ** 2 - sunRadius ** 2) / (2 * separation * moonRadius))
  const triangle = 0.5 * Math.sqrt(
    (-separation + sunRadius + moonRadius) *
    (separation + sunRadius - moonRadius) *
    (separation - sunRadius + moonRadius) *
    (separation + sunRadius + moonRadius),
  )
  return Math.max(0, Math.min(1, (sunPart + moonPart - triangle) / (Math.PI * sunRadius * sunRadius)))
}

/** Calculates the apparent Sun and Moon discs for a topocentric observer. */
export function calculateLocalSky(latitude: number, longitude: number, time: Date): LocalSkyView {
  const observer = new Observer(latitude, longitude, 0)
  const sun = Equator(Body.Sun, time, observer, true, true)
  const moon = Equator(Body.Moon, time, observer, true, true)
  let deltaRaHours = moon.ra - sun.ra
  if (deltaRaHours > 12) deltaRaHours -= 24
  if (deltaRaHours < -12) deltaRaHours += 24
  const offsetX = -15 * deltaRaHours * Math.cos(sun.dec * DEG2RAD)
  const offsetY = moon.dec - sun.dec
  const separation = Math.hypot(offsetX, offsetY)
  const sunRadius = Math.atan(SUN_RADIUS_KM / (sun.dist * KM_PER_AU)) * RAD2DEG
  const moonRadius = Math.atan(MOON_RADIUS_KM / (moon.dist * KM_PER_AU)) * RAD2DEG
  const horizon = Horizon(time, observer, sun.ra, sun.dec, 'normal')
  return {
    moonOffsetX: offsetX / sunRadius,
    moonOffsetY: -offsetY / sunRadius,
    moonRadiusRatio: moonRadius / sunRadius,
    obscuration: circleOverlapFraction(sunRadius, moonRadius, separation),
    sunAltitude: horizon.altitude,
    separation,
  }
}

export function coordinateLabel(latitude?: number, longitude?: number): string {
  if (latitude == null || longitude == null) return 'Rand der Sichtbarkeitszone'
  const ns = latitude >= 0 ? 'N' : 'S'
  const ew = longitude >= 0 ? 'O' : 'W'
  return `${Math.abs(latitude).toFixed(2)}° ${ns}, ${Math.abs(longitude).toFixed(2)}° ${ew}`
}

export function regionLabel(latitude?: number, longitude?: number): string {
  if (latitude == null || longitude == null) return 'Globale partielle Finsternis'
  if (latitude > 60) return 'Arktische Breiten'
  if (latitude < -60) return 'Antarktische Breiten'
  if (longitude < -100 && latitude > 15) return 'Nordamerika'
  if (longitude < -30 && latitude < 20) return 'Südamerika / Atlantik'
  if (longitude < 20 && latitude > 30) return 'Europa / Nordatlantik'
  if (longitude < 55 && latitude > 5) return 'Afrika / Mittelmeerraum'
  if (longitude < 145 && latitude > 0) return 'Asien'
  if (longitude > 110 && latitude < 0) return 'Australien / Pazifik'
  return 'Ozeanische Zentralzone'
}
