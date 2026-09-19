import type { PrecipUnit, TempUnit } from './types'

export function cToF(c: number): number {
  return (c * 9) / 5 + 32
}

export function formatTemp(c: number | null | undefined, unit: TempUnit, digits = 1): string {
  if (c == null || Number.isNaN(c)) return '—'
  const v = unit === 'F' ? cToF(c) : c
  return `${v.toFixed(digits)}°${unit}`
}

export function formatTempDelta(dc: number | null | undefined, unit: TempUnit, digits = 1): string {
  if (dc == null || Number.isNaN(dc)) return '—'
  const v = unit === 'F' ? (dc * 9) / 5 : dc
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(digits)}°${unit}`
}

export function mmToIn(mm: number): number {
  return mm / 25.4
}

export function formatPrecip(mm: number | null | undefined, unit: PrecipUnit): string {
  if (mm == null || Number.isNaN(mm)) return '—'
  if (unit === 'in') return `${mmToIn(mm).toFixed(1)} in`
  return `${Math.round(mm)} mm`
}

export function formatPrecipDelta(dmm: number | null | undefined, unit: PrecipUnit): string {
  if (dmm == null || Number.isNaN(dmm)) return '—'
  if (unit === 'in') {
    const v = mmToIn(dmm)
    const sign = v > 0 ? '+' : ''
    return `${sign}${v.toFixed(1)} in`
  }
  const sign = dmm > 0 ? '+' : ''
  return `${sign}${Math.round(dmm)} mm`
}
