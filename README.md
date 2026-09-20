# Wine climate twins

Like-for-like **climate analogues** for wine regions: pick a reference (default St-Émilion) and rank peers by Open-Meteo ERA5 climate features, 1991–2020. Metrics are **precomputed** into `public/data/climate.json` — no LLM at runtime.

**Live:** https://kfguiang-spec.github.io/wine-climate-twins/

Related: [French wine regions](https://kfguiang-spec.github.io/french-wine-regions/) · [US wine regions](https://kfguiang-spec.github.io/us-wine-regions/) · [Wine varietal map](https://kfguiang-spec.github.io/wine-varietal-map/) · [Grape lineage](https://kfguiang-spec.github.io/grape-lineage/) · [WSET tasting guide](https://kfguiang-spec.github.io/wset-tasting-guide/)

## Caveats

- **Climate ≠ grape or style.** St-Émilion / Pomerol are typically Merlot-led Right Bank; Napa Cab is Cabernet Sauvignon. Similarity is for scouting, not marketing identity.
- **ERA5 reanalysis** (~0.25° grid) is not vineyard microclimate. Elevation is the Open-Meteo returned grid elevation.
- Growing season: **NH Apr–Oct**, **SH Oct–Apr**. Numbers are never invented — only archive daily fields.

## Features (all regions)

| Feature | Method |
| --- | --- |
| Annual / GS mean temp °C | Mean of daily `temperature_2m_mean` |
| Annual / GS precip mm | Mean annual sum of `precipitation_sum` |
| Mean diurnal range °C | Mean `(tmax − tmin)` over **GS days only** |
| GDD base 10°C | Mean annual Σ `max(0, Tmean − 10)` in GS |
| Heat days | Mean annual count of **GS** days with `tmax ≥ 30°C` |
| Frost days | Mean annual count of **calendar-year** days with `tmin ≤ 0°C` |
| Winkler I–V | From GDD °C: I&lt;1390, II&lt;1670, III&lt;1940, IV&lt;2220, V≥2220 |
| Huglin index | Σ `((max(0,Tmean−10)+max(0,Tmax−10))/2)×K` over Apr–Sep (NH) / Oct–Mar (SH); `K = 1 + 0.006×clamp(\|lat\|−40, 0, 10)` |
| Elevation + lat/lon | Open-Meteo archive response grid + requested coords |

## Coverage (2026-09-20)

**32 / 33 regions** have the full ERA5 feature set (rain + GDD + diurnal + heat/frost + Winkler/Huglin + elevation). Catalog spans France, Italy, Spain, Portugal, Germany, United States, Argentina, South Africa, New Zealand, and Australia.

**Pending** (Open-Meteo daily quota; re-run `npm run fetch:climate` tomorrow to resume — resume-friendly, will not wipe complete rows):

- Coonawarra (`coonawarra`) — listed in `src/data/regions.json`

Backfilled this run: Finger Lakes, Bordeaux city ref.

## Similarity

Z-scored Euclidean distance on available features. User sliders weight three groups:

1. **Temperature** — annual + GS mean °C  
2. **Rain** — annual + GS precip  
3. **Heat / seasonality** — GDD + diurnal range + heat days + frost days  

## Develop

```bash
npm install
npm run fetch:climate   # Open-Meteo archive; resumes incomplete rows; spaced + 429 retry
npm run dev
npm run build:pages
node scripts/deploy-pages.mjs
```

## Attribution

[Open-Meteo](https://open-meteo.com/) Historical Weather API (ERA5).
