import {
  AstroTime,
  Body,
  EclipseKind,
  GeoMoon,
  GeoVector,
  KM_PER_AU,
  NextGlobalSolarEclipse,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  SearchGlobalSolarEclipse,
  SearchLocalSolarEclipse,
  SiderealTime,
  Vector,
} from 'astronomy-engine'

const EARTH_RADIUS_KM = 6378.137
const EARTH_FLATTENING = 0.996647180302104
const RAD2DEG = 180 / Math.PI

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

export interface LocalEclipse {
  peak: Date
  begin: Date
  end: Date
  type: EclipseType
  obscuration: number
  sunAltitude: number
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
