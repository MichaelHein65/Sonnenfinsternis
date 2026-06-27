import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const cities = require('all-the-cities')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = resolve(root, 'src/data/cities.json')

const compact = cities
  .filter((city) => city.name && city.country && city.loc?.coordinates?.length === 2)
  .map((city) => [
    city.name,
    city.country,
    city.loc.coordinates[0],
    city.loc.coordinates[1],
    city.population || 0,
  ])
  .sort((a, b) => b[4] - a[4])

await mkdir(dirname(target), { recursive: true })
await writeFile(target, JSON.stringify(compact))
console.log(`${compact.length.toLocaleString('de-DE')} Orte geschrieben: ${target}`)
