import type { ClimateRegion, TwinResult } from './types'

export type FeatureKey =
  | 'annual_mean_c'
  | 'growing_season_mean_c'
  | 'annual_precip_mm'
  | 'growing_season_precip_mm'
  | 'mean_diurnal_range_c'
  | 'gdd_base10_gs'
  | 'heat_days_tmax30_gs'
  | 'frost_days_tmin0_year'

/** Mean temperature features */
const TEMP_FEATURES: FeatureKey[] = ['annual_mean_c', 'growing_season_mean_c']

/** Precipitation features */
const RAIN_FEATURES: FeatureKey[] = ['annual_precip_mm', 'growing_season_precip_mm']

/** Heat / seasonality / extremes (GDD + diurnal + heat/frost days) */
const HEAT_FEATURES: FeatureKey[] = [
  'gdd_base10_gs',
  'mean_diurnal_range_c',
  'heat_days_tmax30_gs',
  'frost_days_tmin0_year',
]

export const ALL_FEATURES: FeatureKey[] = [
  ...TEMP_FEATURES,
  ...RAIN_FEATURES,
  ...HEAT_FEATURES,
]

function mean(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function std(vals: number[]): number {
  const m = mean(vals)
  const v = mean(vals.map((x) => (x - m) ** 2))
  return Math.sqrt(v) || 1
}

function num(v: number | null | undefined): v is number {
  return v != null && !Number.isNaN(v)
}

/** Z-score stats from non-null values only. */
export function computeStats(
  regions: ClimateRegion[],
): Partial<Record<FeatureKey, { mean: number; std: number }>> {
  const stats: Partial<Record<FeatureKey, { mean: number; std: number }>> = {}
  for (const key of ALL_FEATURES) {
    const vals = regions.map((r) => r[key]).filter(num)
    if (vals.length >= 2) stats[key] = { mean: mean(vals), std: std(vals) }
  }
  return stats
}

function z(value: number, s: { mean: number; std: number }): number {
  return (value - s.mean) / s.std
}

/**
 * Weighted Euclidean distance on z-scored features that exist on both regions.
 * Three weight groups: Temperature / Rain / Heat-seasonality.
 * Missing values are skipped (never invented).
 */
export function rankTwins(
  regions: ClimateRegion[],
  referenceId: string,
  tempWeight: number,
  rainWeight: number,
  heatWeight: number,
): TwinResult[] {
  const ref = regions.find((r) => r.id === referenceId)
  if (!ref) return []

  const stats = computeStats(regions)
  const tw = Math.max(0.05, tempWeight)
  const rw = Math.max(0.05, rainWeight)
  const hw = Math.max(0.05, heatWeight)

  const activeTemp = TEMP_FEATURES.filter((k) => stats[k] && num(ref[k]))
  const activeRain = RAIN_FEATURES.filter((k) => stats[k] && num(ref[k]))
  const activeHeat = HEAT_FEATURES.filter((k) => stats[k] && num(ref[k]))

  const featureWeight = (key: FeatureKey): number => {
    if (TEMP_FEATURES.includes(key)) {
      return activeTemp.length ? tw / activeTemp.length : 0
    }
    if (RAIN_FEATURES.includes(key)) {
      return activeRain.length ? rw / activeRain.length : 0
    }
    return activeHeat.length ? hw / activeHeat.length : 0
  }

  const active = [...activeTemp, ...activeRain, ...activeHeat]
  const results: TwinResult[] = []

  /** Prefer like-for-like feature coverage so temp-only rows do not falsely rank near enriched refs. */
  const refEnriched = num(ref.annual_precip_mm) && num(ref.gdd_base10_gs)

  for (const r of regions) {
    if (r.id === referenceId) continue
    if (refEnriched && !(num(r.annual_precip_mm) && num(r.gdd_base10_gs))) continue

    let distSq = 0
    let used = 0
    for (const key of active) {
      const rv = r[key]
      const fv = ref[key]
      const s = stats[key]
      if (!num(rv) || !num(fv) || !s) continue
      const w = featureWeight(key)
      const dz = z(rv, s) - z(fv, s)
      distSq += w * dz * dz
      used++
    }
    if (!used) continue

    results.push({
      region: r,
      distance: Math.sqrt(distSq),
      deltas: {
        annual_mean_c: r.annual_mean_c - ref.annual_mean_c,
        growing_season_mean_c: r.growing_season_mean_c - ref.growing_season_mean_c,
        annual_precip_mm:
          num(r.annual_precip_mm) && num(ref.annual_precip_mm)
            ? r.annual_precip_mm - ref.annual_precip_mm
            : null,
        growing_season_precip_mm:
          num(r.growing_season_precip_mm) && num(ref.growing_season_precip_mm)
            ? r.growing_season_precip_mm - ref.growing_season_precip_mm
            : null,
        mean_diurnal_range_c:
          num(r.mean_diurnal_range_c) && num(ref.mean_diurnal_range_c)
            ? r.mean_diurnal_range_c - ref.mean_diurnal_range_c
            : null,
        gdd_base10_gs:
          num(r.gdd_base10_gs) && num(ref.gdd_base10_gs)
            ? r.gdd_base10_gs - ref.gdd_base10_gs
            : null,
        heat_days_tmax30_gs:
          num(r.heat_days_tmax30_gs) && num(ref.heat_days_tmax30_gs)
            ? r.heat_days_tmax30_gs - ref.heat_days_tmax30_gs
            : null,
        frost_days_tmin0_year:
          num(r.frost_days_tmin0_year) && num(ref.frost_days_tmin0_year)
            ? r.frost_days_tmin0_year - ref.frost_days_tmin0_year
            : null,
        huglin_index:
          num(r.huglin_index) && num(ref.huglin_index)
            ? r.huglin_index - ref.huglin_index
            : null,
      },
    })
  }

  results.sort((a, b) => a.distance - b.distance)
  return results
}
