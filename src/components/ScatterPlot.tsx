import type { ClimateRegion } from '../lib/types'

interface Props {
  regions: ClimateRegion[]
  referenceId: string
  selectedId: string | null
  onSelect: (id: string) => void
}

/** GS mean temp vs annual precip when precip exists; else GS temp vs annual mean temp. */
export function ScatterPlot({ regions, referenceId, selectedId, onSelect }: Props) {
  const w = 480
  const h = 320
  const pad = { t: 20, r: 20, b: 44, l: 52 }
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b

  const precipCount = regions.filter((r) => r.annual_precip_mm != null).length
  const usePrecip = precipCount >= 3

  const xs = regions.map((r) => r.growing_season_mean_c)
  const ys = regions.map((r) =>
    usePrecip ? (r.annual_precip_mm ?? NaN) : r.annual_mean_c,
  )
  const finite = regions
    .map((r, i) => ({ r, x: xs[i], y: ys[i] }))
    .filter((p) => Number.isFinite(p.y))

  const xmin = Math.min(...finite.map((p) => p.x)) - 0.5
  const xmax = Math.max(...finite.map((p) => p.x)) + 0.5
  const ymin = Math.min(...finite.map((p) => p.y)) - (usePrecip ? 20 : 0.5)
  const ymax = Math.max(...finite.map((p) => p.y)) + (usePrecip ? 20 : 0.5)

  const xScale = (v: number) => pad.l + ((v - xmin) / (xmax - xmin || 1)) * innerW
  const yScale = (v: number) => pad.t + innerH - ((v - ymin) / (ymax - ymin || 1)) * innerH

  return (
    <div className="scatter-wrap">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Growing-season temperature vs climate axis"
      >
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + innerH} stroke="#ccc" />
        <line
          x1={pad.l}
          y1={pad.t + innerH}
          x2={pad.l + innerW}
          y2={pad.t + innerH}
          stroke="#ccc"
        />
        <text x={pad.l + innerW / 2} y={h - 8} textAnchor="middle" fontSize="12" fill="#444">
          Growing-season mean temp (°C)
        </text>
        <text
          x={14}
          y={pad.t + innerH / 2}
          textAnchor="middle"
          fontSize="12"
          fill="#444"
          transform={`rotate(-90 14 ${pad.t + innerH / 2})`}
        >
          {usePrecip ? 'Annual precip (mm)' : 'Annual mean temp (°C)'}
        </text>
        {finite.map(({ r, x, y }) => {
          const isRef = r.id === referenceId
          const isSel = r.id === selectedId
          const cx = xScale(x)
          const cy = yScale(y)
          return (
            <g key={r.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(r.id)}>
              <circle
                cx={cx}
                cy={cy}
                r={isRef ? 7 : isSel ? 6 : 4.5}
                fill={isRef ? '#111' : isSel ? '#444' : '#fff'}
                stroke="#111"
                strokeWidth={isRef || isSel ? 2 : 1.25}
              />
              {(isRef || isSel) && (
                <text x={cx + 9} y={cy + 4} fontSize="11" fill="#111">
                  {r.name}
                </text>
              )}
              <title>
                {r.name}: GS {r.growing_season_mean_c}°C
                {usePrecip && r.annual_precip_mm != null
                  ? `, annual precip ${r.annual_precip_mm} mm`
                  : `, annual ${r.annual_mean_c}°C`}
              </title>
            </g>
          )
        })}
      </svg>
      <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>
        Filled black = reference. Click a point to select.
        {usePrecip
          ? ' Y-axis = annual precip where fetched; sites without precip omitted from plot.'
          : ' Y-axis = annual mean temp (precip pending for most sites).'}
      </p>
    </div>
  )
}
