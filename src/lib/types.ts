export type TempUnit = 'C' | 'F'
export type PrecipUnit = 'mm' | 'in'

export interface ClimateRegion {
  id: string
  name: string
  country: string
  station: string
  hemisphere: 'NH' | 'SH'
  typical_grapes: string
  style_note: string
  requested: { lat: number; lon: number }
  grid: { latitude: number; longitude: number; elevation_m: number | null }
  period: { start: string; end: string }
  model: string
  units: {
    temp: string
    precip: string
    gdd: string
    huglin?: string
    elevation?: string
  }
  annual_mean_c: number
  growing_season_mean_c: number
  growing_season_months: string
  annual_precip_mm: number | null
  growing_season_precip_mm: number | null
  mean_diurnal_range_c: number | null
  gdd_base10_gs: number | null
  heat_days_tmax30_gs: number | null
  frost_days_tmin0_year: number | null
  winkler_region: string | null
  winkler_gdd_c?: number | null
  huglin_index: number | null
  huglin_band: string | null
  huglin_k?: number | null
  sample_days: number | null
  growing_season_days: number | null
  years: number
}

export interface ClimateFile {
  source: string
  generated_at: string
  period: { start: string; end: string }
  model: string
  feature_notes: Record<string, string>
  regions: ClimateRegion[]
}

export interface TwinResult {
  region: ClimateRegion
  distance: number
  deltas: {
    annual_mean_c: number
    growing_season_mean_c: number
    annual_precip_mm: number | null
    growing_season_precip_mm: number | null
    mean_diurnal_range_c: number | null
    gdd_base10_gs: number | null
    heat_days_tmax30_gs: number | null
    frost_days_tmin0_year: number | null
    huglin_index: number | null
  }
}
