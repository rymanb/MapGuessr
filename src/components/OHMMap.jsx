import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { constrainFilterByDateRange, dateRangeFromDate } from '@openhistoricalmap/maplibre-gl-dates'
import 'maplibre-gl/dist/maplibre-gl.css'
import './OHMMap.css'

const OHM_STYLE = 'https://www.openhistoricalmap.org/map-styles/main/main.json'

// Strips parenthetical suffixes from place names so dates don't show on labels
const EN_NAME_EXPR = [
  'let', 'n', ['coalesce', ['get', 'name_en'], ['get', 'name']],
  ['let', 'i', ['index-of', ' (', ['var', 'n']],
    ['case',
      ['>=', ['var', 'i'], 0],
      ['slice', ['var', 'n'], 0, ['var', 'i']],
      ['var', 'n'],
    ]
  ]
]

function toEnglishName(expr) {
  if (!Array.isArray(expr)) return expr
  if (expr[0] === 'get' && expr[1] === 'name') return EN_NAME_EXPR
  return expr.map(toEnglishName)
}

function applyEnglishLabels(style) {
  style.layers = style.layers.map(layer => {
    const tf = layer.layout?.['text-field']
    if (!tf) return layer
    if (typeof tf === 'string') {
      return /\{name/.test(tf)
        ? { ...layer, layout: { ...layer.layout, 'text-field': EN_NAME_EXPR } }
        : layer
    }
    return { ...layer, layout: { ...layer.layout, 'text-field': toEnglishName(tf) } }
  })
}

function applyDateFiltersToStyle(style, dateStr) {
  const dateRange = dateRangeFromDate(dateStr)
  style.layers = style.layers.map(layer => {
    if (!('source-layer' in layer)) return layer
    return { ...layer, filter: constrainFilterByDateRange(layer.filter, dateRange) }
  })
}

// Removes terrain and hillshade layers
function stripDeadLayers(style) {
  delete style.terrain
  const deadSources = new Set(
    Object.entries(style.sources)
      .filter(([, s]) => s.type === 'raster-dem')
      .map(([k]) => k)
  )
  style.layers = style.layers.filter(l => !deadSources.has(l.source) && l.type !== 'hillshade')
  deadSources.forEach(k => delete style.sources[k])
}


function addAdminPolygonsToStyle(style) {
  style.sources['ohm_admin'] = {
    type: 'vector',
    tiles: ['https://vtiles.openhistoricalmap.org/maps/ohm_admin/{z}/{x}/{y}.pbf'],
    minzoom: 0,
    maxzoom: 5,
    promoteId: { boundaries: 'name_en' },
  }

  // Golden-angle palette of 50 CSS color strings — safe for MapLibre fill-color
  const PALETTE = Array.from({ length: 50 }, (_, i) => {
    const h = (i * 137.508) % 360
    const s = 52 + (i % 3) * 9
    const l = 53 - (i % 2) * 8
    return `hsl(${Math.round(h)},${s}%,${l}%)`
  })

  // Hash country name to a float index in [0, 50) using character positions × primes.
  // Uses step (threshold comparisons) instead of match (exact equality) so floats work.
  const nm = ['downcase', ['coalesce', ['get', 'name_en'], ['get', 'name'], 'x']]
  const hashVal = ['%', ['+',
    ['*', ['length', nm], 137],
    ['*', ['max', ['index-of', 'a', nm], 0], 103],
    ['*', ['max', ['index-of', 'e', nm], 0], 79],
    ['*', ['max', ['index-of', 'i', nm], 0], 61],
    ['*', ['max', ['index-of', 'o', nm], 0], 43],
    ['*', ['max', ['index-of', 'r', nm], 0], 31],
    ['*', ['max', ['index-of', 'n', nm], 0], 23],
  ], PALETTE.length]

  // step: returns PALETTE[0] if hashVal < 1, PALETTE[1] if 1 ≤ hashVal < 2, etc.
  const colorExpr = [
    'step', hashVal,
    PALETTE[0],
    ...PALETTE.slice(1).flatMap((c, i) => [i + 1, c]),
  ]

  // Insert below country labels so text stays on top
  const labelIdx = style.layers.findIndex(l =>
    l.type === 'symbol' && /country|state|province|region/i.test(l.id)
  )
  const at = labelIdx >= 0 ? labelIdx : style.layers.length

  const adminFilter = ['any',
    ['all', ['==', ['get', 'admin_level'], 1], ['!=', ['get', 'border_type'], 'empire']],
    ['==', ['get', 'admin_level'], 2],
  ]

  const hovered = ['boolean', ['feature-state', 'hover'], false]

  style.layers.splice(at, 0,
    {
      id: 'ohm-admin-fills',
      type: 'fill',
      source: 'ohm_admin',
      'source-layer': 'boundaries',
      filter: adminFilter,
      // Smaller territories sort on top so colonies render over empire outlines
      layout: { 'fill-sort-key': ['*', -1, ['to-number', ['get', 'area_km2'], 0]] },
      paint: { 'fill-color': colorExpr, 'fill-opacity': 0.35 },
    },
    {
      id: 'ohm-admin-borders',
      type: 'line',
      source: 'ohm_admin',
      'source-layer': 'boundaries',
      filter: adminFilter,
      paint: {
        'line-color': 'rgba(0,0,0,0.55)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 1.5, 10, 2.5],
      },
    },
    // Brightens the hovered country by layering its own color at extra opacity
    {
      id: 'ohm-admin-hover-fill',
      type: 'fill',
      source: 'ohm_admin',
      'source-layer': 'boundaries',
      filter: adminFilter,
      layout: { 'fill-sort-key': ['*', -1, ['to-number', ['get', 'area_km2'], 0]] },
      paint: {
        'fill-color': colorExpr,
        'fill-opacity': ['case', hovered, 0.3, 0],
      },
    },
    // Thin border highlight on hover, scales width with zoom
    {
      id: 'ohm-admin-hover-edge',
      type: 'line',
      source: 'ohm_admin',
      'source-layer': 'boundaries',
      filter: adminFilter,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ffd166',
        'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1.5, 6, 2.5, 10, 4],
        'line-opacity': ['case', hovered, 1, 0],
      },
    },
  )
}

// Overrides for OHM base style boundary layers to make borders more visible
const BOUNDARY_OVERRIDES = {
  'admin_country_lines_z10': {
    'line-color': ['interpolate', ['linear'], ['zoom'],
      0, 'rgba(90, 110, 100, 1)',
      8, 'rgba(70, 90, 80, 1)',
    ],
    'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1.5, 4, 2.5, 8, 3.5, 12, 5],
    'line-opacity': 1,
  },
  'admin_country_lines_z10_case': {
    'line-color': 'rgba(160, 190, 170, 0.55)',
    'line-width': ['interpolate', ['linear'], ['zoom'], 0, 5, 4, 9, 8, 13, 12, 18],
    'line-opacity': 0.55,
  },
  'state_lines_admin_4': {
    'line-color': 'rgba(130, 155, 140, 0.9)',
    'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.75, 6, 1.5, 12, 3, 15, 4],
    'line-opacity': 0.9,
  },
  'state_lines_admin_4-case': {
    'line-color': 'rgba(190, 210, 195, 0.3)',
    'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 10, 15, 14],
    'line-opacity': 0.3,
  },
}

function enhanceBoundaryLines(style) {
  style.layers = style.layers.map(layer => {
    const overrides = BOUNDARY_OVERRIDES[layer.id]
    if (!overrides) return layer
    return { ...layer, paint: { ...layer.paint, ...overrides } }
  })
}

// Searches Wikimedia Commons File namespace for the best matching flag image
// Manual overrides for names that don't map cleanly to flaglog keys
// Keys must match the post-transform format: lowercase, only a-z and spaces
const FLAG_ALIASES = {
  'austro hungarian empire':  ['austria'],
  'austria hungary':          ['austria'],
  'austriahungary':           ['austria'],
  'austrohungarian empire':   ['austria'],
  'austrohungarianempire':    ['austria'],
  'russian empire':           ['russia'],
  'holy roman empire':        ['holyroman'],
  'ottoman empire':           ['ottoman', 'turkey'],
  'british empire':           ['unitedkingdom'],
  'french empire':            ['france'],
  'united kingdom':                                    ['unitedkingdom'],
  'united kingdom of great britain and ireland':       ['unitedkingdom'],
  'united kingdom of great britain and northern ireland': ['unitedkingdom'],
  'great britain':                                     ['unitedkingdom', 'greatbritain'],
  'kingdom of great britain':                          ['unitedkingdom', 'greatbritain'],
  'united states':            ['unitedstates'],
  'united states of america': ['unitedstates'],
  'republic of china':        ['republicofchina', 'taiwan'],
  'french republic':          ['france'],
  'second french republic':   ['france'],
  'third french republic':    ['france'],
  'fourth french republic':   ['france'],
  'fifth french republic':    ['france'],
}

// Returns all candidate keys to search for in flaglog filenames
function flaglogKeys(name) {
  const lower = name.toLowerCase().replace(/[^a-z ]/g, '').trim()
  const manual = FLAG_ALIASES[lower]
  if (manual) return manual

  const keys = new Set()
  keys.add(lower.replace(/ /g, ''))

  const stripped = lower
    .replace(/\b(duchy|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|empire|kingdom|republic|peoples|regency|democratic|soviet|union|federation|sultanate|caliphate|raj|dominion|principality|protectorate|duchy|grand|tsardom|county|margraviate|commonwealth|colony|province|territory|mandate|khanate|emirate|reich|of the|of)\b/g, '')
    .replace(/\s+/g, ' ').trim()
  keys.add(stripped.replace(/ /g, ''))

  return [...keys].filter(k => k.length > 1)
}

async function blobUrl(imgSrc) {
  const imgUrl = imgSrc.startsWith('http') ? imgSrc : `https://flaglog.com/${imgSrc.replace(/^\//, '')}`
  const res = await fetch(imgUrl.replace('https://flaglog.com', '/flaglog'))
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

// Wikimedia Commons fallback - searches for the best matching flag
async function fetchFlagFromCommons(name) {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent('Flag of ' + name)}&srnamespace=6&srlimit=10&format=json&origin=*`
    const res = await fetch(searchUrl)
    const data = await res.json()

    // Meaningful words from the country name (skip short/common words)
    const nameWords = name.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !/^(the|and|of|for)$/.test(w))

    const results = (data.query?.search ?? [])
      .filter(r => {
        const t = r.title.toLowerCase()
        // Filename must start with "flag" - excludes "LGBT flag...", "Map of flags...", etc.
        const filename = t.replace(/^file:/, '').trimStart()
        return filename.startsWith('flag') && nameWords.some(w => t.includes(w))
      })
      .sort((a, b) => a.title.length - b.title.length)

    if (!results.length) return []

    // Fetch image URLs for all candidates in one request
    const titles = results.map(r => r.title).join('|')
    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url&iiurlwidth=320&format=json&origin=*`
    const infoRes = await fetch(infoUrl)
    const infoData = await infoRes.json()
    const pages = Object.values(infoData.query?.pages ?? {})
      .filter(p => {
        if (p.pageid < 0) return false
        const url = p.imageinfo?.[0]?.url ?? ''
        // Exclude PDFs and other non-image formats
        return /\.(svg|png|jpg|jpeg|gif|webp)/i.test(url) && !url.includes('.pdf')
      })

    if (!pages.length) return []
    const url = pages[0].imageinfo[0].thumburl || pages[0].imageinfo[0].url
    return [{ label: pages[0].title.replace('File:', ''), url, source: 'wikipedia' }]
  } catch {
    return []
  }
}

async function fetchFlags(name, year) {
  const clampedYear = Math.min(2026, Math.max(1848, year))

  try {
    const res = await fetch(`/flaglog/${clampedYear}`)
    const html = await res.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const imgs = Array.from(doc.querySelectorAll('img[src]'))

    function findMatches(searchName) {
      const keys = flaglogKeys(searchName)
      // exact: key + digits suffix (e.g. russia1918) - versioned by year
      // named: key + text suffix (e.g. russiabolshevik) - distinct political entity
      const exact = []
      const named = []
      const seen = new Set()

      for (const key of keys) {
        for (const img of imgs) {
          const src = img.getAttribute('src') || ''
          const file = src.split('/').pop().toLowerCase().replace(/\.\w+$/, '')
          if (!file.startsWith(key) || seen.has(src)) continue
          seen.add(src)
          const label = img.getAttribute('alt') || file
          const suffix = file.slice(key.length)
          if (/^\d*$/.test(suffix)) {
            // Pure digit suffix (e.g. russia1918) - a dated version of the flag
            exact.push({ label, src })
          } else if (!/^\d+[a-z]/.test(suffix)) {
            // Anything that doesn't start with digits-then-letters is a valid named variant
            // (covers "bolshevik", "y1933" from partial key matches, etc.)
            named.push({ label, src })
          }
          // Suffix like "1918a" (digits then letters) = scan artifact → ignored
        }
      }

      // Show all variants - named (political entities/state flags) first, then dated versions
      return [...named, ...exact]
    }

    // If the name contains a hyphen or dash, look up each part separately
    if (/[-–—]/.test(name)) {
      const parts = name.split(/[-–—]/).map(p => p.trim()).filter(Boolean)
      const results = []
      for (const part of parts) {
        const m = findMatches(part)
        if (m.length) results.push(m[0])
      }
      if (results.length) {
        return await Promise.all(results.map(async m => ({ label: m.label, url: await blobUrl(m.src) })))
      }
      // Both parts missed on flaglog - fall through to Commons below
    }

    const matches = findMatches(name)
    if (matches.length) {
      return await Promise.all(matches.map(async m => ({ label: m.label, url: await blobUrl(m.src) })))
    }

    // For "X and Y" compound states, try each part individually
    if (name.toLowerCase().includes(' and ')) {
      const parts = name.split(/\s+and\s+/i).map(p => p.trim()).filter(Boolean)
      const results = []
      for (const part of parts) {
        const m = findMatches(part)
        if (m.length) results.push(m[0])
      }
      if (results.length) {
        return await Promise.all(results.map(async m => ({ label: m.label, url: await blobUrl(m.src) })))
      }
    }
  } catch {
    // flaglog failed, fall through to Commons
  }

  return fetchFlagFromCommons(name)
}

async function loadFilteredStyle(dateStr) {
  const res = await fetch(OHM_STYLE)
  const style = await res.json()
  stripDeadLayers(style)
  applyEnglishLabels(style)
  addAdminPolygonsToStyle(style)
  applyDateFiltersToStyle(style, dateStr)
  enhanceBoundaryLines(style)
  // Hide layers that add visual noise without helping the player
  const shouldHide = id =>
    /rail|road|transport|building|amenity|landuse|barrier|power|pier/i.test(id)
  style.layers = style.layers.map(layer =>
    shouldHide(layer.id)
      ? { ...layer, layout: { ...layer.layout, visibility: 'none' } }
      : layer
  )
  return style
}

export default function OHMMap({ filterDate, center, zoom }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (mapRef.current) return

    let cancelled = false

    loadFilteredStyle(filterDate).then(style => {
      if (cancelled) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center,
        zoom,
        attributionControl: false,
        fadeDuration: 0,
        maxTileCacheSize: 1000,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

      map.once('load', () => {
        if (!cancelled) setLoading(false)
      })

      let hoveredId = null

      map.on('mousemove', 'ohm-admin-fills', (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const id = e.features[0]?.id
        if (id == null || id === hoveredId) return
        if (hoveredId !== null) {
          map.setFeatureState({ source: 'ohm_admin', sourceLayer: 'boundaries', id: hoveredId }, { hover: false })
        }
        hoveredId = id
        map.setFeatureState({ source: 'ohm_admin', sourceLayer: 'boundaries', id: hoveredId }, { hover: true })
      })

      map.on('mouseleave', 'ohm-admin-fills', () => {
        map.getCanvas().style.cursor = ''
        if (hoveredId !== null) {
          map.setFeatureState({ source: 'ohm_admin', sourceLayer: 'boundaries', id: hoveredId }, { hover: false })
          hoveredId = null
        }
      })

      let flagPopup = null

      map.on('click', 'ohm-admin-fills', async (e) => {
        const feature = e.features[0]
        if (!feature) return

        const props = feature.properties
        const osmId = feature.id

        // Fallback name from tile properties (strips date suffix)
        let name = props.name_en || props.name || ''
        const parenIdx = name.indexOf(' (')
        if (parenIdx >= 0) name = name.slice(0, parenIdx)
        if (!name) return

        // Try to get the period-accurate name from OHM Overpass
        if (osmId != null) {
          try {
            const overpassQuery = `[out:json][date:"${filterDate}T00:00:00Z"];relation(${osmId});out tags;`
            const res = await fetch('https://overpass-api.openhistoricalmap.org/api/interpreter', {
              method: 'POST',
              body: `data=${encodeURIComponent(overpassQuery)}`,
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            })
            const data = await res.json()
            const tags = data.elements?.[0]?.tags ?? {}
            const historicalName = tags['name:en'] || tags['name'] || ''
            const cleanHistorical = historicalName.replace(/ \(.*\)$/, '').trim()
            if (cleanHistorical) name = cleanHistorical
          } catch {
            // Overpass failed, use tile name as fallback
          }
        }

        if (flagPopup) flagPopup.remove()

        flagPopup = new maplibregl.Popup({ closeButton: true, maxWidth: '200px', className: 'flag-popup' })
          .setLngLat(e.lngLat)
          .setHTML(`<div class="flag-popup-inner"><div class="flag-spinner"></div></div>`)
          .addTo(map)

        try {
          const year = parseInt(filterDate, 10)
          const flags = await fetchFlags(name, year)
          if (flagPopup.isOpen()) {
            if (flags.length) {
              const fromWiki = flags.some(f => f.source === 'wikipedia')
              const imgs = flags.map(f =>
                `<div class="flag-entry">
                  <img class="flag-img" src="${f.url}" alt="${f.label}" />
                </div>`
              ).join('')
              flagPopup.setHTML(
                `<div class="flag-popup-inner">
                  ${imgs}
                  <span class="flag-label">${name}</span>
                  ${fromWiki ? '<span class="flag-source">via Wikipedia</span>' : ''}
                </div>`
              )
            } else {
              flagPopup.setHTML(
                `<div class="flag-popup-inner"><span class="flag-label flag-missing">No flag found for<br/>${name}</span></div>`
              )
            }
          }
        } catch {
          if (flagPopup.isOpen()) {
            flagPopup.setHTML(
              `<div class="flag-popup-inner"><span class="flag-label flag-missing">Failed to load flag</span></div>`
            )
          }
        }
      })

      mapRef.current = map
    }).catch(err => {
      console.error('Failed to load OHM style:', err)
      setLoading(false)
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <div className="ohm-map-container">
      <div ref={containerRef} className="ohm-map" />
      {loading && (
        <div className="map-loading">
          <div className="map-loading-inner">
            <div className="spinner" />
            <span>Loading historical map…</span>
          </div>
        </div>
      )}
    </div>
  )
}
