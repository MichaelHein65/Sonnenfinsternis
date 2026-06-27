import type { Locale } from './i18n'

type CityTuple = [name: string, country: string, longitude: number, latitude: number, population: number]

export type Location = {
  name: string
  country: string
  latitude: number
  longitude: number
  population: number
}

type IndexedLocation = Location & { terms: string[]; simpleTerms: string[] }

export const DEFAULT_LOCATION: Location = {
  name: 'Berlin', country: 'DE', latitude: 52.52, longitude: 13.405, population: 3_645_000,
}

const overrides: Record<string, { name?: string; aliases: string[] }> = {
  'Munich|DE': { name: 'München', aliases: ['Munich', 'Muenchen', 'München'] },
  'Köln|DE': { aliases: ['Cologne', 'Koeln', 'Köln'] },
  'Vienna|AT': { name: 'Wien', aliases: ['Vienna', 'Wien'] },
  'Zürich|CH': { aliases: ['Zurich', 'Zuerich', 'Zürich'] },
  'Reykjavík|IS': { aliases: ['Reykjavik', 'Reykjavík'] },
  'Rome|IT': { name: 'Roma', aliases: ['Rome', 'Roma'] },
  'Prague|CZ': { name: 'Praha', aliases: ['Prague', 'Prag', 'Praha'] },
  'Warsaw|PL': { name: 'Warszawa', aliases: ['Warsaw', 'Warschau', 'Warszawa'] },
  'Moscow|RU': { name: 'Moskau', aliases: ['Moscow', 'Moskva', 'Moskau', 'Москва'] },
  'Beijing|CN': { aliases: ['Beijing', 'Peking', '北京'] },
  'Florence|IT': { name: 'Firenze', aliases: ['Florence', 'Florenz', 'Firenze'] },
  'Venice|IT': { name: 'Venezia', aliases: ['Venice', 'Venedig', 'Venezia'] },
  'Lisbon|PT': { name: 'Lisboa', aliases: ['Lisbon', 'Lissabon', 'Lisboa'] },
  'Brussels|BE': { name: 'Brüssel', aliases: ['Brussels', 'Bruxelles', 'Brussel', 'Brüssel'] },
  'Copenhagen|DK': { name: 'København', aliases: ['Copenhagen', 'Kopenhagen', 'København'] },
  'Gothenburg|SE': { name: 'Göteborg', aliases: ['Gothenburg', 'Goeteborg', 'Göteborg'] },
}

const copy: Record<Locale, { placeholder: string; noResults: string; loading: string }> = {
  de: { placeholder: 'Ort eingeben …', noResults: 'Kein passender Ort gefunden', loading: 'Ortsverzeichnis wird geladen …' },
  en: { placeholder: 'Enter a place …', noResults: 'No matching place found', loading: 'Loading place directory …' },
  es: { placeholder: 'Introducir lugar …', noResults: 'No se encontró ningún lugar', loading: 'Cargando lugares …' },
  fr: { placeholder: 'Saisir un lieu …', noResults: 'Aucun lieu correspondant', loading: 'Chargement des lieux …' },
  pt: { placeholder: 'Introduzir local …', noResults: 'Nenhum local encontrado', loading: 'A carregar locais …' },
  zh: { placeholder: '输入地点…', noResults: '未找到匹配地点', loading: '正在加载地点…' },
  ar: { placeholder: 'أدخل مكانًا…', noResults: 'لم يتم العثور على مكان مطابق', loading: 'جارٍ تحميل الأماكن…' },
  hi: { placeholder: 'स्थान लिखें…', noResults: 'कोई मिलता-जुलता स्थान नहीं मिला', loading: 'स्थान सूची लोड हो रही है…' },
  ja: { placeholder: '場所を入力…', noResults: '一致する場所がありません', loading: '場所一覧を読み込み中…' },
  hr: { placeholder: 'Unesite mjesto …', noResults: 'Nije pronađeno odgovarajuće mjesto', loading: 'Učitavanje popisa mjesta …' },
}

export function locationCopy(locale: Locale) {
  return copy[locale]
}

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function simplify(value: string) {
  return normalize(value).replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/ß/g, 'ss')
}

function boundedDistance(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row]
    let rowMin = row
    for (let column = 1; column <= b.length; column += 1) {
      const value = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      )
      current[column] = value
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin > limit) return limit + 1
    previous = current
  }
  return previous[b.length]
}

let cachedIndex: IndexedLocation[] | null = null

export async function loadLocationIndex() {
  if (cachedIndex) return cachedIndex
  const module = await import('./data/cities.json')
  cachedIndex = (module.default as CityTuple[]).map(([sourceName, country, longitude, latitude, population]) => {
    const override = overrides[`${sourceName}|${country}`]
    const name = override?.name ?? sourceName
    const aliases = Array.from(new Set([sourceName, name, ...(override?.aliases ?? [])]))
    return { name, country, longitude, latitude, population, terms: aliases.map(normalize), simpleTerms: aliases.map(simplify) }
  })
  return cachedIndex
}

export function searchLocations(index: IndexedLocation[], query: string, limit = 7): Location[] {
  const term = normalize(query)
  const simple = simplify(query)
  if (!term) return []

  const matches: Array<{ location: IndexedLocation; score: number }> = []
  for (const location of index) {
    let score = Number.POSITIVE_INFINITY
    for (let i = 0; i < location.terms.length; i += 1) {
      const candidate = location.terms[i]
      const simpleCandidate = location.simpleTerms[i]
      if (candidate === term) score = Math.min(score, 0)
      else if (simpleCandidate === simple) score = Math.min(score, 1)
      else if (candidate.startsWith(term) || simpleCandidate.startsWith(simple)) score = Math.min(score, 10 + Math.abs(candidate.length - term.length))
      else if (candidate.split(' ').some((word) => word.startsWith(term))) score = Math.min(score, 25 + Math.abs(candidate.length - term.length))
    }
    if (Number.isFinite(score)) matches.push({ location, score })
  }

  if (term.length >= 3 && matches.length < limit) {
    const allowed = term.length <= 5 ? 1 : term.length <= 9 ? 2 : 3
    for (const location of index) {
      if (matches.some((match) => match.location === location)) continue
      let distance = allowed + 1
      for (const candidate of location.simpleTerms) {
        if (candidate[0] !== simple[0] || Math.abs(candidate.length - simple.length) > allowed) continue
        distance = Math.min(distance, boundedDistance(simple, candidate, allowed))
      }
      if (distance <= allowed) matches.push({ location, score: 50 + distance * 5 })
    }
  }

  return matches
    .sort((a, b) => a.score - b.score || b.location.population - a.location.population)
    .slice(0, limit)
    .map(({ location: { terms: _terms, simpleTerms: _simpleTerms, ...location } }) => location)
}
