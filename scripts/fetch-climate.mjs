/**
 * Pre-fetch Open-Meteo Historical Weather (ERA5) daily fields 1991–2020.
 * Batches multiple locations per HTTP request (full period) to minimize calls.
 * Resumes from public/data/climate.json if interrupted.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const regions = JSON.parse(readFileSync(join(root, 'src/data/regions.json'), 'utf8'))

const START = '1991-01-01'
const END = '2020-12-31'
const MODEL = 'era5'
const SOURCE =
  'Open-Meteo Historical Weather API (ERA5 reanalysis). Daily temperature_2m_mean/max/min and precipitation_sum, 1991–2020.'
const DAILY =
  'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum'
const BATCH = 3
const DELAY_MS = 15000
const outDir = join(root, 'public/data')
const outPath = join(outDir, 'climate.json')

function mean(arr) {
  const vals = arr.filter((v) => v != null && !Number.isNaN(v))
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function sum(arr) {
  const vals = arr.filter((v) => v != null && !Number.isNaN(v))
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0)
}

function round1(n) {
  return n == null ? null : Math.round(n * 10) / 10
}

function round0(n) {
  return n == null ? null : Math.round(n)
}

function inGrowingSeason(month, hemisphere) {
  if (hemisphere === 'SH') return month >= 10 || month <= 4
  return month >= 4 && month <= 10
}

function summarize(region, data) {
  const times = data.daily.time
  const tmean = data.daily.temperature_2m_mean
  const tmax = data.daily.temperature_2m_max
  const tmin = data.daily.temperature_2m_min
  const precip = data.daily.precipitation_sum
  const years = new Set(times.map((t) => t.slice(0, 4)))
  const nYears = years.size || 30

  const gsTemps = []
  const gsPrecip = []
  const diurnal = []
  let gdd = 0

  for (let i = 0; i < times.length; i++) {
    const month = Number(times[i].slice(5, 7))
    const gs = inGrowingSeason(month, region.hemisphere)
    if (tmax[i] != null && tmin[i] != null) diurnal.push(tmax[i] - tmin[i])
    if (gs) {
      if (tmean[i] != null) {
        gsTemps.push(tmean[i])
        gdd += Math.max(0, tmean[i] - 10)
      }
      if (precip[i] != null) gsPrecip.push(precip[i])
    }
  }

  const precipTotal = sum(precip)
  const annualPrecip = precipTotal == null ? null : precipTotal / nYears
  const gsPrecipTotal = sum(gsPrecip)
  const gsPrecipAnnual = gsPrecipTotal == null ? null : gsPrecipTotal / nYears
  const gddAnnual = gsTemps.length ? gdd / nYears : null

  return {
    id: region.id,
    name: region.name,
    country: region.country,
    station: region.station,
    hemisphere: region.hemisphere,
    typical_grapes: region.typical_grapes,
    style_note: region.style_note,
    requested: { lat: region.lat, lon: region.lon },
    grid: {
      latitude: data.latitude,
      longitude: data.longitude,
      elevation_m: data.elevation,
    },
    period: { start: START, end: END },
    model: MODEL,
    units: { temp: '°C', precip: 'mm', gdd: '°C·days base 10' },
    annual_mean_c: round1(mean(tmean)),
    growing_season_mean_c: round1(mean(gsTemps)),
    growing_season_months: region.hemisphere === 'SH' ? 'Oct–Apr' : 'Apr–Oct',
    annual_precip_mm: round0(annualPrecip),
    growing_season_precip_mm: round0(gsPrecipAnnual),
    mean_diurnal_range_c: round1(mean(diurnal)),
    gdd_base10_gs: round0(gddAnnual),
    sample_days: times.length,
    growing_season_days: gsTemps.length,
    years: nYears,
  }
}

function writePayload(climates) {
  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        source: SOURCE,
        generated_at: new Date().toISOString(),
        period: { start: START, end: END },
        model: MODEL,
        feature_notes: {
          annual_mean_c: 'Mean of daily temperature_2m_mean over full years',
          growing_season_mean_c:
            'Mean of daily temperature_2m_mean in GS months (NH Apr–Oct; SH Oct–Apr)',
          annual_precip_mm: 'Mean annual sum of precipitation_sum',
          growing_season_precip_mm: 'Mean annual sum of precipitation_sum in GS months',
          mean_diurnal_range_c:
            'Mean of (temperature_2m_max − temperature_2m_min) over all days',
          gdd_base10_gs:
            'Mean annual growing-degree days: sum max(0, daily mean − 10) in GS',
        },
        regions: climates,
      },
      null,
      2,
    ) + '\n',
  )
}

function loadExisting() {
  if (!existsSync(outPath)) return new Map()
  try {
    const data = JSON.parse(readFileSync(outPath, 'utf8'))
    return new Map((data.regions || []).map((r) => [r.id, r]))
  } catch {
    return new Map()
  }
}

async function fetchBatch(batch) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', batch.map((r) => r.lat).join(','))
  url.searchParams.set('longitude', batch.map((r) => r.lon).join(','))
  url.searchParams.set('start_date', START)
  url.searchParams.set('end_date', END)
  url.searchParams.set('daily', DAILY)
  url.searchParams.set('timezone', 'GMT')
  url.searchParams.set('models', MODEL)

  console.log(`  GET ${batch.map((r) => r.id).join(', ')}`)
  const res = await fetch(url)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw Object.assign(new Error(`non-JSON ${res.status} ${text.slice(0, 120)}`), {
      status: res.status,
    })
  }
  if (!res.ok || data.error) {
    throw Object.assign(new Error(`HTTP ${res.status} ${data.reason || text.slice(0, 200)}`), {
      status: res.status,
    })
  }
  return Array.isArray(data) ? data : [data]
}

async function fetchWithRetry(batch) {
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      return await fetchBatch(batch)
    } catch (e) {
      const hourly = String(e.message).includes('Hourly')
      const wait = hourly ? 600000 : e.status === 429 ? 90000 : 5000 * attempt
      console.warn(`  attempt ${attempt}: ${e.message}; waiting ${Math.round(wait / 1000)}s`)
      if (attempt === 12) throw e
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

async function main() {
  const byId = loadExisting()
  console.log(`Cached: ${byId.size}/${regions.length}`)
  const pending = regions.filter((r) => !byId.has(r.id))

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH)
    console.log(`\nBatch ${Math.floor(i / BATCH) + 1}/${Math.ceil(pending.length / BATCH)}`)
    const results = await fetchWithRetry(batch)
    if (results.length !== batch.length) {
      throw new Error(`Expected ${batch.length} results, got ${results.length}`)
    }
    for (let j = 0; j < batch.length; j++) {
      const row = summarize(batch[j], results[j])
      byId.set(row.id, row)
      console.log(
        `  OK ${row.id}: annual=${row.annual_mean_c}°C gs=${row.growing_season_mean_c}°C precip=${row.annual_precip_mm}mm gdd=${row.gdd_base10_gs}`,
      )
    }
    const snapshot = regions.map((r) => byId.get(r.id)).filter(Boolean)
    writePayload(snapshot)
    console.log(`  Saved ${snapshot.length}/${regions.length}`)
    if (i + BATCH < pending.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  }

  const climates = regions.map((r) => byId.get(r.id)).filter(Boolean)
  if (climates.length !== regions.length) {
    throw new Error(`Incomplete: ${climates.length}/${regions.length}`)
  }
  writePayload(climates)
  console.log(`\nWrote ${climates.length} regions → ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
