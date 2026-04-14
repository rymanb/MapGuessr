# MapGuessr - Historical Edition

**[Play Now →](https://map-guessr-nine.vercel.app/)**

A GeoGuessr-style browser game built on [OpenHistoricalMap](https://www.openhistoricalmap.org/). You're shown a historical map from anywhere between antiquity and the present day - study the borders, country names, and geography, then guess the year it depicts.

## How to Play

1. A map is loaded for a random year from history
2. Pan and zoom freely to gather clues from borders, labels, and territory shapes
3. Use the slider or type directly to pick your year guess
4. Submit - your score is shown on an animated timeline revealing how close you were
5. Play again to cycle through different eras; years don't repeat until the full pool is exhausted

## Scoring

Scoring uses exponential decay based on how many years off your guess was. The stricter the era, the faster the decay.

| Era | Half-life |
|-----|-----------|
| 1700 and later | 15 years |
| 1000 – 1699 | 35 years |
| Before 1000 | 60 years |

- **Exact year → 5,000 pts**
- At one half-life off → ~2,500 pts
- At four half-lives off → ~0 pts

## Features

- **47 handpicked years** spanning 395 AD to 2015, covering major historical turning points
- **Era-aware scoring** - ancient guesses are graded more leniently than modern ones
- **Animated result timeline** - watch the gap between your guess and the answer fill in
- **Flag lookup** - click any country on the map to see its flag from that period, sourced from [flaglog.com](https://flaglog.com/historical) with Wikimedia Commons as a fallback
- **Cumulative score** - tracked across rounds; years don't repeat per session
- **Country hover highlight** - borders glow amber on hover

## Tech Stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [MapLibre GL JS](https://maplibre.org/) v4.7.1
- [OpenHistoricalMap](https://www.openhistoricalmap.org/) tile server + Overpass API
- [@openhistoricalmap/maplibre-gl-dates](https://www.npmjs.com/package/@openhistoricalmap/maplibre-gl-dates) for date filtering

## Development

```bash
npm install
npm run dev
```

The flag lookup proxies requests to `flaglog.com` through the Vite dev server to bypass CORS and hotlink protection. This only works in development - a production deployment would need a backend proxy.

## Notes

- Map tiles are served by OpenHistoricalMap's public infrastructure; loading times vary
- Country names on the map reflect OHM tile data which may differ slightly from historical names
- The flag system covers most countries and territories but is not exhaustive
