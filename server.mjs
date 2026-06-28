import { appendFile, createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const logDirectory = join(homedir(), 'Library', 'Logs', 'UMBRA')
const appLog = join(logDirectory, 'app.log')
const privateConfig = join(homedir(), 'Library', 'Application Support', 'UMBRA', '.env')
const port = 5173
mkdirSync(logDirectory, { recursive: true })

function loadEnvironment(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

loadEnvironment(join(fileURLToPath(new URL('.', import.meta.url)), '.env'))
loadEnvironment(privateConfig)

const locationCache = new Map()
const locationSchema = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Canonical city or populated-place name.' },
          country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code.' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          note: { type: 'string', description: 'Very short explanation in the requested language.' },
        },
        required: ['name', 'country', 'latitude', 'longitude', 'confidence', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
}

function readJsonBody(request, limit = 4096) {
  return new Promise((resolve, reject) => {
    let body = ''
    let tooLarge = false
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      if (tooLarge) return
      body += chunk
      if (body.length > limit) {
        tooLarge = true
        body = ''
        reject(new Error('request-too-large'))
      }
    })
    request.on('end', () => {
      if (tooLarge) return
      try { resolve(JSON.parse(body)) } catch { reject(new Error('invalid-json')) }
    })
    request.on('error', reject)
  })
}

function responseText(data) {
  return (data.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('')
}

async function resolveLocation(query, locale) {
  const cacheKey = `${locale}:${query.toLocaleLowerCase()}`
  if (locationCache.has(cacheKey)) return locationCache.get(cacheKey)
  if (!process.env.OPENAI_API_KEY) throw new Error('openai-not-configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_LOCATION_MODEL || 'gpt-5.4-mini',
        store: false,
        reasoning: { effort: 'none' },
        max_output_tokens: 1200,
        input: [
          { role: 'system', content: 'Resolve a user-entered geographic place into likely populated places. Correct typing errors, transliterations, exonyms, and local spellings. Never turn a weak spelling resemblance into an unrelated place. If the input names only a country or region, suggest its most practical major city and say so in the note. Return at most five best candidates, most likely first. Use WGS84 coordinates and two-letter ISO country codes. Keep notes under eight words.' },
          { role: 'user', content: `Language: ${locale}\nPlace entered: ${query}` },
        ],
        text: { format: { type: 'json_schema', name: 'location_candidates', strict: true, schema: locationSchema } },
      }),
    })
    if (!apiResponse.ok) throw new Error(`openai-${apiResponse.status}`)
    const data = await apiResponse.json()
    const parsed = JSON.parse(responseText(data))
    const result = {
      candidates: (parsed.candidates ?? []).filter((item) =>
        typeof item.name === 'string' && /^[A-Z]{2}$/.test(item.country) &&
        Number.isFinite(item.latitude) && Math.abs(item.latitude) <= 90 &&
        Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180,
      ).map((item) => ({ ...item, population: 0 })),
    }
    locationCache.set(cacheKey, result)
    if (locationCache.size > 100) locationCache.delete(locationCache.keys().next().value)
    return result
  } finally {
    clearTimeout(timeout)
  }
}
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

createServer(async (request, response) => {
  const requestPath = decodeURIComponent((request.url ?? '/').split('?')[0])
  if (request.method === 'POST' && requestPath === '/__umbra_log') {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => { if (body.length < 65_536) body += chunk })
    request.on('end', () => {
      appendFile(appLog, `${body.replace(/[\r\n]+/g, ' ')}\n`, () => undefined)
      response.writeHead(204, { 'Cache-Control': 'no-store' })
      response.end()
    })
    return
  }
  if (request.method === 'POST' && requestPath === '/__umbra_location') {
    try {
      const origin = request.headers.origin
      if (origin && origin !== `http://127.0.0.1:${port}`) throw new Error('invalid-origin')
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) throw new Error('invalid-content-type')
      const body = await readJsonBody(request)
      const query = typeof body.query === 'string' ? body.query.trim().slice(0, 200) : ''
      const locale = typeof body.locale === 'string' ? body.locale.slice(0, 12) : 'de'
      if (query.length < 2) throw new Error('invalid-query')
      const result = await resolveLocation(query, locale)
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify(result))
    } catch (error) {
      const message = String(error)
      const status = message.includes('not-configured') ? 503 : message.includes('too-large') ? 413 : message.includes('invalid') ? 400 : 502
      const safeMessage = process.env.OPENAI_API_KEY ? message.replace(process.env.OPENAI_API_KEY, '[secret]') : message
      appendFile(appLog, `${JSON.stringify({ timestamp: new Date().toISOString(), type: 'location-resolver-error', status, message: safeMessage })}\n`, () => undefined)
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ error: 'location-resolution-unavailable' }))
    }
    return
  }
  const safePath = normalize(requestPath).replace(/^(\.\.[/\\])+/, '')
  let file = join(root, safePath === '/' ? 'index.html' : safePath)

  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(root, 'index.html')
  }

  response.writeHead(200, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  createReadStream(file).pipe(response)
}).listen(port, '127.0.0.1')
