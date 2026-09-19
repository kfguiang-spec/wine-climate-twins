import { useEffect, useMemo, useState } from 'react'
import { ScatterPlot } from './components/ScatterPlot'
import { rankTwins } from './lib/similarity'
import type { ClimateFile, ClimateRegion, PrecipUnit, TempUnit } from './lib/types'
import {
  formatPrecip,
  formatPrecipDelta,
  formatTemp,
  formatTempDelta,
} from './lib/units'

const RELATED = [
  { href: 'https://kfguiang-spec.github.io/french-wine-regions/', label: 'French wine regions' },
  { href: 'https://kfguiang-spec.github.io/us-wine-regions/', label: 'US wine regions' },
  { href: 'https://kfguiang-spec.github.io/wine-varietal-map/', label: 'Wine varietal map' },
  { href: 'https://kfguiang-spec.github.io/grape-lineage/', label: 'Grape lineage' },
  { href: 'https://kfguiang-spec.github.io/wset-tasting-guide/', label: 'WSET tasting guide' },
]

export default function App() {
  const [climate, setClimate] = useState<ClimateFile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refId, setRefId] = useState('st-emilion')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tempWeight, setTempWeight] = useState(1.2)
  const [precipWeight, setPrecipWeight] = useState(1)
  const [tempUnit, setTempUnit] = useState<TempUnit>('F')
  const [precipUnit, setPrecipUnit] = useState<PrecipUnit>('mm')

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}data/climate.json`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load climate.json (${res.status})`)
        return res.json() as Promise<ClimateFile>
      })
      .then((data) => {
        setClimate(data)
        setLoading(false)
      })
      .catch((e: Error) => {
        setLoadError(e.message)
        setLoading(false)
      })
  }, [])

  const regions = climate?.regions ?? []
  const ref = regions.find((r) => r.id === refId) ?? null

  const twins = useMemo(() => {
    if (!regions.length) return []
    return rankTwins(regions, refId, tempWeight, precipWeight)
  }, [regions, refId, tempWeight, precipWeight])

  useEffect(() => {
    if (twins.length && (!selectedId || selectedId === refId)) {
      setSelectedId(twins[0].region.id)
    }
  }, [twins, refId, selectedId])

  const selected = regions.find((r) => r.id === selectedId) ?? null
  const selectedTwin = twins.find((t) => t.region.id === selectedId) ?? null

  if (loading) {
    return (
      <div className="app">
        <div className="status">Loading climate data…</div>
      </div>
    )
  }

  if (loadError || !climate || !ref) {
    return (
      <div className="app">
        <div className="status">
          <div className="error">{loadError ?? 'Climate data unavailable.'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <h1>Wine climate twins</h1>
          <p className="tagline">
            Like-for-like climate analogues from Open-Meteo ERA5 (1991–2020). Pick a reference
            region — find comparable climates worldwide by temperature and rainfall.
          </p>
        </div>
        <p className="caveat">
          <strong>Style ≠ climate.</strong> St-Émilion and Pomerol are typically Merlot-led Right
          Bank Bordeaux; Napa Cab is Cabernet Sauvignon. Climate similarity is useful for
          scouting — it does not mean the same grape or wine style. Annual precip is filled for
          eight French sites from a direct archive fetch; other sites show temps only until
          Open-Meteo daily quota resets (never invented).
        </p>
        <nav className="nav-links" aria-label="Related projects">
          {RELATED.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
        </nav>
      </header>

      <div className="main">
        <aside className="sidebar">
          <div className="controls">
            <div className="control-block">
              <label htmlFor="ref">Reference region</label>
              <select
                id="ref"
                className="ref-select"
                value={refId}
                onChange={(e) => {
                  setRefId(e.target.value)
                  setSelectedId(null)
                }}
              >
                {groupOptions(regions)}
              </select>
            </div>

            <div className="control-block">
              <label htmlFor="temp-w">Temperature weight</label>
              <div className="slider-row">
                <input
                  id="temp-w"
                  type="range"
                  min={0.2}
                  max={2}
                  step={0.1}
                  value={tempWeight}
                  onChange={(e) => setTempWeight(Number(e.target.value))}
                />
                <span className="slider-val">{tempWeight.toFixed(1)}</span>
              </div>
            </div>

            <div className="control-block">
              <label htmlFor="precip-w">Rainfall weight</label>
              <div className="slider-row">
                <input
                  id="precip-w"
                  type="range"
                  min={0.2}
                  max={2}
                  step={0.1}
                  value={precipWeight}
                  onChange={(e) => setPrecipWeight(Number(e.target.value))}
                />
                <span className="slider-val">{precipWeight.toFixed(1)}</span>
              </div>
            </div>

            <div className="control-block">
              <label>Units</label>
              <div className="control-row">
                <button
                  type="button"
                  className={tempUnit === 'F' ? 'active' : ''}
                  onClick={() => setTempUnit('F')}
                >
                  °F
                </button>
                <button
                  type="button"
                  className={tempUnit === 'C' ? 'active' : ''}
                  onClick={() => setTempUnit('C')}
                >
                  °C
                </button>
                <button
                  type="button"
                  className={precipUnit === 'mm' ? 'active' : ''}
                  onClick={() => setPrecipUnit('mm')}
                >
                  mm
                </button>
                <button
                  type="button"
                  className={precipUnit === 'in' ? 'active' : ''}
                  onClick={() => setPrecipUnit('in')}
                >
                  inches
                </button>
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: 0 }}>Nearest climate twins</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Ranked by weighted z-scored distance. Temps always used; precip only when both sites have real Open-Meteo precip. Lower = closer.
          </p>
          <ol className="twin-list">
            {twins.map((t, i) => (
              <li key={t.region.id}>
                <button
                  type="button"
                  className={`twin-item${selectedId === t.region.id ? ' active' : ''}`}
                  onClick={() => setSelectedId(t.region.id)}
                >
                  <span className="rank">#{i + 1}</span>
                  <span className="name">{t.region.name}</span>
                  <span className="meta">
                    {t.region.country} · dist {t.distance.toFixed(2)} · GS{' '}
                    {formatTemp(t.region.growing_season_mean_c, tempUnit)} ·{' '}
                    {formatPrecip(t.region.annual_precip_mm, precipUnit)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <section className="panel">
          <h2>
            {ref.name}
            {selected ? ` → ${selected.name}` : ''}
          </h2>
          <p className="muted">
            Reference station: {ref.station} ({ref.requested.lat.toFixed(2)},{' '}
            {ref.requested.lon.toFixed(2)}). Growing season {ref.growing_season_months}. Model:{' '}
            {climate.model.toUpperCase()} {climate.period.start.slice(0, 4)}–
            {climate.period.end.slice(0, 4)}.
          </p>

          {selected && selectedTwin && (
            <>
              <h3>Side-by-side climate</h3>
              <div className="table-wrap">
                <table className="climate">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>{ref.name}</th>
                      <th>{selected.name}</th>
                      <th>Δ (twin − ref)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Annual mean temp</td>
                      <td className="num">{formatTemp(ref.annual_mean_c, tempUnit)}</td>
                      <td className="num">{formatTemp(selected.annual_mean_c, tempUnit)}</td>
                      <td className="num">
                        {formatTempDelta(selectedTwin.deltas.annual_mean_c, tempUnit)}
                      </td>
                    </tr>
                    <tr>
                      <td>Growing-season mean temp</td>
                      <td className="num">{formatTemp(ref.growing_season_mean_c, tempUnit)}</td>
                      <td className="num">
                        {formatTemp(selected.growing_season_mean_c, tempUnit)}
                      </td>
                      <td className="num">
                        {formatTempDelta(selectedTwin.deltas.growing_season_mean_c, tempUnit)}
                      </td>
                    </tr>
                    <tr>
                      <td>Annual precipitation</td>
                      <td className="num">{formatPrecip(ref.annual_precip_mm, precipUnit)}</td>
                      <td className="num">
                        {formatPrecip(selected.annual_precip_mm, precipUnit)}
                      </td>
                      <td className="num">
                        {formatPrecipDelta(selectedTwin.deltas.annual_precip_mm, precipUnit)}
                      </td>
                    </tr>
                    <tr>
                      <td>Growing-season precipitation</td>
                      <td className="num">
                        {formatPrecip(ref.growing_season_precip_mm, precipUnit)}
                      </td>
                      <td className="num">
                        {formatPrecip(selected.growing_season_precip_mm, precipUnit)}
                      </td>
                      <td className="num">
                        {formatPrecipDelta(
                          selectedTwin.deltas.growing_season_precip_mm,
                          precipUnit,
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>Mean diurnal range (tmax−tmin)</td>
                      <td className="num">{formatTemp(ref.mean_diurnal_range_c, tempUnit)}</td>
                      <td className="num">
                        {formatTemp(selected.mean_diurnal_range_c, tempUnit)}
                      </td>
                      <td className="num">
                        {formatTempDelta(selectedTwin.deltas.mean_diurnal_range_c, tempUnit)}
                      </td>
                    </tr>
                    <tr>
                      <td>GDD base 10°C (growing season)</td>
                      <td className="num">{ref.gdd_base10_gs == null ? '—' : Math.round(ref.gdd_base10_gs)}</td>
                      <td className="num">{selected.gdd_base10_gs == null ? '—' : Math.round(selected.gdd_base10_gs)}</td>
                      <td className="num">
                        {selectedTwin.deltas.gdd_base10_gs == null
                          ? '—'
                          : `${selectedTwin.deltas.gdd_base10_gs > 0 ? '+' : ''}${Math.round(selectedTwin.deltas.gdd_base10_gs)}`}
                      </td>
                    </tr>
                    <tr>
                      <td>Elevation (grid)</td>
                      <td className="num">{ref.grid.elevation_m == null ? '—' : `${Math.round(ref.grid.elevation_m)} m`}</td>
                      <td className="num">{selected.grid.elevation_m == null ? '—' : `${Math.round(selected.grid.elevation_m)} m`}</td>
                      <td className="num">—</td>
                    </tr>
                    <tr>
                      <td>Distance score</td>
                      <td className="num">0 (ref)</td>
                      <td className="num">{selectedTwin.distance.toFixed(3)}</td>
                      <td className="num">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3>Typical grapes (educational)</h3>
              <p>
                <strong>{ref.name}:</strong> {ref.typical_grapes}
              </p>
              <p>
                <strong>{selected.name}:</strong> {selected.typical_grapes}
              </p>
              <p className="muted">
                {ref.style_note} {selected.style_note} Labeled educational — not a planting
                census.
              </p>
            </>
          )}

          <h3>Scatter: GS temp vs precip (or annual temp)</h3>
          <ScatterPlot
            regions={regions}
            referenceId={refId}
            selectedId={selectedId}
            onSelect={(id) => {
              if (id === refId) return
              setSelectedId(id)
            }}
          />

          <h3>Where is Napa?</h3>
          <NapaNote twins={twins} refName={ref.name} />
        </section>
      </div>

      <footer className="footer">
        Climate data: {climate.source} · Attribution:{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>{' '}
        (ERA5). Generated {new Date(climate.generated_at).toLocaleDateString('en-US')}. Features
        never invented — pre-fetched archive daily fields only.
      </footer>
    </div>
  )
}

function groupOptions(regions: ClimateRegion[]) {
  const byCountry = new Map<string, ClimateRegion[]>()
  for (const r of regions) {
    const list = byCountry.get(r.country) ?? []
    list.push(r)
    byCountry.set(r.country, list)
  }
  return [...byCountry.entries()].map(([country, list]) => (
    <optgroup key={country} label={country}>
      {list.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </optgroup>
  ))
}

function NapaNote({
  twins,
  refName,
}: {
  twins: ReturnType<typeof rankTwins>
  refName: string
}) {
  const idx = twins.findIndex((t) => t.region.id === 'napa')
  if (idx < 0) {
    return <p className="muted">Napa is the reference (or missing from this set).</p>
  }
  const t = twins[idx]
  return (
    <p>
      Relative to <strong>{refName}</strong>, <strong>Napa Valley</strong> ranks{' '}
      <strong>#{idx + 1}</strong> of {twins.length} (distance {t.distance.toFixed(2)}). GS temp Δ{' '}
      {t.deltas.growing_season_mean_c > 0 ? '+' : ''}
      {t.deltas.growing_season_mean_c.toFixed(1)}°C
      {t.deltas.annual_precip_mm == null
        ? ' (Napa precip pending re-fetch).'
        : `; annual precip Δ ${t.deltas.annual_precip_mm > 0 ? '+' : ''}${Math.round(t.deltas.annual_precip_mm)} mm.`}{' '}
      Marketing “Napa Cab ≈ Right Bank” is not a climate identity.
    </p>
  )
}
