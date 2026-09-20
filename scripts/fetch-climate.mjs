/**
 * Pre-fetch Open-Meteo Historical Weather (ERA5) daily fields 1991–2020.
 * Batches multiple locations per HTTP request (full period) to minimize calls.
 * Resumes from public/data/climate.json if interrupted; re-fetches incomplete rows.
 *
 * Formulas (documented in feature_notes + README):
 * - GDD base 10°C (GS): mean annual Σ max(0, Tmean − 10) over GS months
 * - Winkler: same GDD Apr–Oct (NH) / Oct–Apr (SH); band from °C thresholds
 * - Huglin: mean annual Σ ((Tmean−10)+(Tmax−10))/2 × K over Apr–Sep (NH) /
 *   Oct–Mar (SH); K = 1.0 + 0.006×clamp(lat−40, 0, 10) using |lat|
 * - Diurnal: mean(tmax−tmin) over GS days only
 * - Heat days: mean annual count of GS days with tmax ≥ 30°C
 * - Frost days: mean annual count of calendar-year days with tmin ≤ 0°C
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
const BATCH = 1
const DELAY_MS = 45000
const outDir = join(root, 'public/data')
const outPath = join(outDir, 'climate.json')

const REQUIRED = [
  'annual_mean_c',
  'growing_season_mean_c',
  'annual_precip_mm',
  'growing_season_precip_mm',
  'mean_diurnal_range_c',
  'gdd_base10_gs',
  'heat_days_tmax30_gs',
  'frost_days_tmin0_year',
  'winkler_region',
  'huglin_index',
]

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

/** Huglin months: Apr–Sep NH; Oct–Mar SH */
function inHuglinSeason(month, hemisphere) {
  if (hemisphere === 'SH') return month >= 10 || month <= 3
  return month >= 4 && month <= 9
}

function huglinK(latAbs) {
  return 1.0 + 0.006 * Math.max(0, Math.min(10, latAbs - 40))
}

/** Winkler region from GDD °C·days base 10 (standard °C equivalents of °F bands). */
function winklerFromGdd(gdd) {
  if (gdd == null) return null
  if (gdd < 1390) return 'I'
  if (gdd < 1670) return 'II'
  if (gdd < 1940) return 'III'
  if (gdd < 2220) return 'IV'
  return 'V'
}

function huglinBand(hi) {
  if (hi == null) return null
  if (hi <= 1500) return 'very cool'
  if (hi <= 1800) return 'cool'
  if (hi <= 2100) return 'temperate'
  if (hi <= 2400) return 'warm temperate'
  if (hi <= 2700) return 'warm'
  if (hi <= 3000) return 'very warm'
  return 'hot'
}

function isComplete(row) {
  if (!row) return false
  for (const k of REQUIRED) {
    if (row[k] == null) return false
  }
  if (row.grid?.elevation_m == null) return false
  if (row.grid?.latitude == null || row.grid?.longitude == null) return false
  return true
}

function summarize(region, data) {
  const times = data.daily.time
  const tmean = data.daily.temperature_2m_mean
  const tmax = data.daily.temperature_2m_max
  const tmin = data.daily.temperature_2m_min
  const precip = data.daily.precipitation_sum
  const years = new Set(times.map((t) => t.slice(0, 4)))
  const nYears = years.size || 30
  const latAbs = Math.abs(region.lat)
  const k = huglinK(latAbs)

  const gsTemps = []
  const gsPrecip = []
  const gsDiurnal = []
  let gdd = 0
  let huglin = 0
  let heatDays = 0
  let frostDays = 0

  for (let i = 0; i < times.length; i++) {
    const month = Number(times[i].slice(5, 7))
    const gs = inGrowingSeason(month, region.hemisphere)
    const hug = inHuglinSeason(month, region.hemisphere)

    if (tmin[i] != null && tmin[i] <= 0) frostDays++

    if (gs) {
      if (tmean[i] != null) {
        gsTemps.push(tmean[i])
        gdd += Math.max(0, tmean[i] - 10)
      }
      if (precip[i] != null) gsPrecip.push(precip[i])
      if (tmax[i] != null && tmin[i] != null) gsDiurnal.push(tmax[i] - tmin[i])
      if (tmax[i] != null && tmax[i] >= 30) heatDays++
    }

    if (hug && tmean[i] != null && tmax[i] != null) {
      const term = (Math.max(0, tmean[i] - 10) + Math.max(0, tmax[i] - 10)) / 2
      huglin += term * k
    }
  }

  const precipTotal = sum(precip)
  const annualPrecip = precipTotal == null ? null : precipTotal / nYears
  const gsPrecipTotal = sum(gsPrecip)
  const gsPrecipAnnual = gsPrecipTotal == null ? null : gsPrecipTotal / nYears
  const gddAnnual = gsTemps.length ? gdd / nYears : null
  const huglinAnnual = huglin > 0 ? huglin / nYears : null
  const winkler = winklerFromGdd(gddAnnual)

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
      elevation_m: data.elevation ?? null,
    },
    period: { start: START, end: END },
    model: MODEL,
    units: {
      temp: '°C',
      precip: 'mm',
      gdd: '°C·days base 10',
      huglin: '°C·days (lat-adjusted)',
      elevation: 'm',
    },
    annual_mean_c: round1(mean(tmean)),
    growing_season_mean_c: round1(mean(gsTemps)),
    growing_season_months: region.hemisphere === 'SH' ? 'Oct–Apr' : 'Apr–Oct',
    annual_precip_mm: round0(annualPrecip),
    growing_season_precip_mm: round0(gsPrecipAnnual),
    mean_diurnal_range_c: round1(mean(gsDiurnal)),
    gdd_base10_gs: round0(gddAnnual),
    heat_days_tmax30_gs: round1(heatDays / nYears),
    frost_days_tmin0_year: round1(frostDays / nYears),
    winkler_region: winkler,
    winkler_gdd_c: round0(gddAnnual),
    huglin_index: round0(huglinAnnual),
    huglin_band: huglinBand(huglinAnnual),
    huglin_k: round1(k),
    sample_days: times.length,
    growing_season_days: gsTemps.length,
    years: nYears,
  }
}

const FEATURE_NOTES = {
  annual_mean_c: 'Mean of daily temperature_2m_mean over full years',
  growing_season_mean_c:
    'Mean of daily temperature_2m_mean in GS months (NH Apr–Oct; SH Oct–Apr)',
  annual_precip_mm: 'Mean annual sum of precipitation_sum',
  growing_season_precip_mm: 'Mean annual sum of precipitation_sum in GS months',
  mean_diurnal_range_c:
    'Mean of (temperature_2m_max − temperature_2m_min) over GS days only',
  gdd_base10_gs:
    'Mean annual growing-degree days: Σ max(0, daily mean − 10°C) in GS months',
  heat_days_tmax30_gs:
    'Mean annual count of growing-season days with tmax ≥ 30°C',
  frost_days_tmin0_year:
    'Mean annual count of calendar-year days with tmin ≤ 0°C',
  winkler_region:
    'Winkler I–V from gdd_base10_gs (°C): I<1390, II<1670, III<1940, IV<2220, V≥2220',
  huglin_index:
    'Mean annual Huglin: Σ ((max(0,Tmean−10)+max(0,Tmax−10))/2)×K over Apr–Sep (NH) / Oct–Mar (SH); K=1+0.006×clamp(|lat|−40,0,10)',
  elevation_m: 'Open-Meteo archive response elevation (m) for returned grid cell',
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
        feature_notes: FEATURE_NOTES,
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

function msUntilNextUtcDay(bufferMin = 5) {
  const now = Date.now()
  const d = new Date(now)
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, bufferMin, 0)
  return Math.max(60_000, next - now)
}


function msUntilNextUtcHour(bufferMin = 2) {
  const now = Date.now()
  const d = new Date(now)
  const next = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours() + 1,
    bufferMin,
    0,
  )
  return Math.max(60_000, next - now)
}

async function fetchWithRetry(batch) {
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      return await fetchBatch(batch)
    } catch (e) {
      const msg = String(e.message)
      const daily = /Daily API request limit/i.test(msg)
      const hourly = /Hourly API request limit/i.test(msg)
      let wait
      if (daily) wait = msUntilNextUtcDay(5)
      else if (hourly) wait = msUntilNextUtcHour(2)
      else if (/Minutely/i.test(msg)) wait = 75_000
      else if (e.status === 429) wait = 90_000
      else wait = 5_000 * attempt
      console.warn(
        `  attempt ${attempt}: ${msg}; waiting ${Math.round(wait / 1000)}s` +
          (daily ? ' (until next UTC day)' : hourly ? ' (until next UTC hour)' : ''),
      )
      if (attempt === 20) throw e
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

async function main() {
  const byId = loadExisting()
  const complete = [...byId.values()].filter(isComplete).length
  console.log(`Cached complete: ${complete}/${regions.length} (raw rows: ${byId.size})`)
  const pending = regions.filter((r) => !isComplete(byId.get(r.id)))
  console.log(`Pending: ${pending.map((r) => r.id).join(', ') || '(none)'}`)

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
        `  OK ${row.id}: ann=${row.annual_mean_c}°C gs=${row.growing_season_mean_c}°C precip=${row.annual_precip_mm}mm gdd=${row.gdd_base10_gs} winkler=${row.winkler_region} huglin=${row.huglin_index} elev=${row.grid.elevation_m}m heat=${row.heat_days_tmax30_gs} frost=${row.frost_days_tmin0_year}`,
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
  const incomplete = climates.filter((r) => !isComplete(r))
  if (climates.length !== regions.length || incomplete.length) {
    throw new Error(
      `Incomplete: ${climates.length}/${regions.length}; missing fields on: ${incomplete.map((r) => r.id).join(', ')}`,
    )
  }
  writePayload(climates)
  console.log(`\nWrote ${climates.length} complete regions → ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
