# Wine climate twins

Like-for-like **climate analogues** for wine regions: pick a reference (default St-Émilion) and rank peers by Open-Meteo ERA5 temperature (and rainfall where fetched), 1991–2020.

**Live:** https://kfguiang-spec.github.io/wine-climate-twins/

Related: [French wine regions](https://kfguiang-spec.github.io/french-wine-regions/) · [US wine regions](https://kfguiang-spec.github.io/us-wine-regions/) · [Wine varietal map](https://kfguiang-spec.github.io/wine-varietal-map/) · [Grape lineage](https://kfguiang-spec.github.io/grape-lineage/) · [WSET tasting guide](https://kfguiang-spec.github.io/wset-tasting-guide/)

## Caveat

St-Émilion / Pomerol are typically **Merlot-led Right Bank**; Napa Cab is **Cabernet Sauvignon**. Climate similarity ≠ same grape or style.

## Features (real Open-Meteo ERA5 only)

| Feature | Status in this PoC |
| --- | --- |
| Annual mean temp °C | All 18 regions |
| Growing-season mean temp °C | All 18 (NH Apr–Oct) |
| Annual precipitation mm | 8 French sites from direct archive fetch |
| GS precip / diurnal range / GDD | Pending re-fetch after API daily quota |

Similarity uses z-scored features present on both regions. Temps always; precip when both have real values. Nothing invented.

## Develop

```bash
npm install
npm run fetch:climate   # Open-Meteo archive; space requests
npm run dev
npm run build:pages
node scripts/deploy-pages.mjs
```

## Attribution

[Open-Meteo](https://open-meteo.com/) Historical Weather API (ERA5).
