# Wine climate twins

Like-for-like **climate analogues** for wine regions: pick a reference (default St-Émilion) and rank worldwide peers by Open-Meteo ERA5 temperature and rainfall (1991–2020).

**Live:** https://kfguiang-spec.github.io/wine-climate-twins/

Related: [French wine regions](https://kfguiang-spec.github.io/french-wine-regions/) · [US wine regions](https://kfguiang-spec.github.io/us-wine-regions/) · [Wine varietal map](https://kfguiang-spec.github.io/wine-varietal-map/) · [Grape lineage](https://kfguiang-spec.github.io/grape-lineage/) · [WSET tasting guide](https://kfguiang-spec.github.io/wset-tasting-guide/)

## Caveat

St-Émilion / Pomerol are typically **Merlot-led Right Bank**; Napa Cab is **Cabernet Sauvignon**. Climate similarity ≠ same grape or style — useful for scouting only.

## Climate features (real Open-Meteo only)

Pre-fetched ERA5 daily archive into `public/data/climate.json`:

| Feature | Source |
| --- | --- |
| Annual mean temp °C | mean of `temperature_2m_mean` |
| Growing-season mean temp °C | NH Apr–Oct / SH Oct–Apr |
| Annual precipitation mm | annualized sum of `precipitation_sum` |
| Growing-season precipitation mm | annualized GS precip sum |
| Mean diurnal range °C | mean of `tmax − tmin` |
| GDD base 10°C (GS) | annualized sum of `max(0, daily mean − 10)` |

## Similarity

Z-score features across the curated set; weighted Euclidean distance. Sliders weight temperature vs rainfall (default slightly temp-weighted).

## Develop

```bash
npm install
npm run fetch:climate   # hits Open-Meteo; space requests to avoid 429
npm run dev
```

## Deploy (GitHub Pages)

```bash
npm run build:pages
# push dist/ to gh-pages branch (root)
```

Source on `main`. Built assets on **`gh-pages`** (Pages: branch `gh-pages` / root).

## Attribution

[Open-Meteo](https://open-meteo.com/) Historical Weather API (ERA5 reanalysis).
