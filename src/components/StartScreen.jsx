import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { constrainFilterByDateRange, dateRangeFromDate } from '@openhistoricalmap/maplibre-gl-dates'
import { COUNTRY_PALETTE, addAdminPolygonsToStyle } from './OHMMap'
import 'maplibre-gl/dist/maplibre-gl.css'
import './StartScreen.css'

const OHM_STYLE = 'https://www.openhistoricalmap.org/map-styles/main/main.json'
const BG_DATE = '1900-01-01'

export default function StartScreen({ onStart }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (mapRef.current) return

    fetch(OHM_STYLE)
      .then(r => r.json())
      .then(style => {
        // Date filter
        const dateRange = dateRangeFromDate(BG_DATE)
        style.layers = style.layers.map(layer =>
          'source-layer' in layer
            ? { ...layer, filter: constrainFilterByDateRange(layer.filter, dateRange) }
            : layer
        )
        // Strip terrain / hillshade
        delete style.terrain
        const deadSources = new Set(
          Object.entries(style.sources)
            .filter(([, s]) => s.type === 'raster-dem')
            .map(([k]) => k)
        )
        style.layers = style.layers.filter(l => !deadSources.has(l.source) && l.type !== 'hillshade')
        deadSources.forEach(k => delete style.sources[k])

        // Add colored admin polygons
        addAdminPolygonsToStyle(style)

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: [15, 45],
          zoom: 3.8,
          interactive: false,
          attributionControl: false,
          fadeDuration: 0,
        })

        let lng = 15
        let raf
        map.once('load', () => {
          const tick = () => {
            lng += 0.004
            map.setCenter([lng, 45])
            raf = requestAnimationFrame(tick)
          }
          raf = requestAnimationFrame(tick)
        })

        mapRef.current = { map, raf: () => raf }
      })
      .catch(() => {})

    return () => {
      if (mapRef.current) {
        const { map, raf } = mapRef.current
        cancelAnimationFrame(raf())
        map.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <div className="start-screen">
      <div ref={containerRef} className="start-map-bg" />
      <div className="start-vignette" />

      <div className="start-card">
        <div className="start-heading">
          <h1 className="start-title">MapGuessr</h1>
          <p className="start-subtitle">Guess the year</p>
        </div>

        <p className="start-desc">
          You'll be shown a historical map from anywhere between antiquity and the present day.
          Try to guess the year it is from.
        </p>

        <div className="rules-grid">
          <div className="rule-item">
            <span className="rule-text">Explore the map freely before guessing</span>
          </div>
          <div className="rule-item">
            <span className="rule-text">Type or slide to pick your year</span>
          </div>
          <div className="rule-item">
            <span className="rule-text">Up to 5,000 pts - closer guess, higher score</span>
          </div>
          <div className="rule-item">
            <span className="rule-text">Modern eras are scored stricter than ancient ones</span>
          </div>
        </div>

        <button className="start-btn" onClick={onStart}>
          Start Game
        </button>
      </div>
    </div>
  )
}
