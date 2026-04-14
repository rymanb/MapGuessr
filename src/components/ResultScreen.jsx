import { useState, useEffect } from 'react'
import './ResultScreen.css'

export default function ResultScreen({ result, totalScore, onPlayAgain, onHome }) {
  const { guessedYear, targetYear, diff, score } = result
  const [fillProg, setFillProg] = useState(0)
  const [phase, setPhase] = useState(0) // 0=waiting 1=filling 2=revealed 3=score

  const halflife = targetYear >= 1700 ? 15 : targetYear >= 1000 ? 35 : 60

  const accuracy =
    diff === 0              ? 'Perfect!' :
    diff <= halflife * 0.33 ? 'Outstanding' :
    diff <= halflife * 1    ? 'Excellent' :
    diff <= halflife * 2    ? 'Good' :
    diff <= halflife * 4    ? 'Close' :
    'Way off'

  // Green to red based on how far off guess was
  const colorT = Math.min(1, diff / (halflife * 4))
  const hue = Math.round(120 * (1 - colorT))
  const diffColor = `hsl(${hue}, 72%, 55%)`

  // Timeline range: pad each side so markers aren't at the edges
  const pad = diff === 0 ? 15 : Math.max(15, Math.round(diff * 0.3))
  const rMin = Math.max(0, Math.min(guessedYear, targetYear) - pad)
  const rMax = Math.min(2026, Math.max(guessedYear, targetYear) + pad)
  const span = Math.max(rMax - rMin, 1)
  const gPct = ((guessedYear - rMin) / span) * 100
  const aPct = ((targetYear - rMin) / span) * 100
  const fillW = Math.abs(aPct - gPct)
  const goRight = targetYear >= guessedYear

  const FILL_MS = diff === 0 ? 0 : Math.min(2500, Math.max(900, diff * 18))

  useEffect(() => {
    const timers = []
    let raf

    if (diff === 0) {
      setFillProg(1)
      setPhase(2)
      timers.push(setTimeout(() => setPhase(3), 600))
      return () => timers.forEach(clearTimeout)
    }

    timers.push(setTimeout(() => {
      setPhase(1)
      const start = performance.now()
      const tick = (now) => {
        const p = Math.min((now - start) / FILL_MS, 1)
        const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
        setFillProg(e)
        if (p < 1) {
          raf = requestAnimationFrame(tick)
        } else {
          setFillProg(1)
          timers.push(setTimeout(() => {
            setPhase(2)
            timers.push(setTimeout(() => setPhase(3), 800))
          }, 200))
        }
      }
      raf = requestAnimationFrame(tick)
    }, 500))

    return () => { timers.forEach(clearTimeout); if (raf) cancelAnimationFrame(raf) }
  }, [])

  const fillStyle = {
    position: 'absolute',
    top: 0, bottom: 0,
    borderRadius: 3,
    background: goRight
      ? `linear-gradient(to right, hsl(120,72%,55%), ${diffColor})`
      : `linear-gradient(to left, hsl(120,72%,55%), ${diffColor})`,
    ...(goRight
      ? { left: `${gPct}%`, width: `${fillW * fillProg}%` }
      : { right: `${100 - gPct}%`, width: `${fillW * fillProg}%` })
  }

  return (
    <div className="result-screen">
      <div className="result-card">
        <h2 className="result-title">{accuracy}</h2>

        <div className="timeline-wrap">
          <div className="timeline-track">
            {/* Animated fill */}
            <div style={fillStyle} />

            {/* Guess pin */}
            <div className="t-pin" style={{ left: `${gPct}%` }}>
              <div className={`t-pin-dot t-pin-guess${phase >= 2 && diff === 0 ? ' t-pin-perfect' : ''}`}
                style={phase >= 2 && diff === 0 ? { background: diffColor, boxShadow: `0 0 0 5px ${diffColor}44` } : {}}
              />
              <span className="t-label t-label-below">{guessedYear}</span>
            </div>

            {/* Actual pin - appears after fill completes */}
            {phase >= 2 && diff > 0 && (
              <div className="t-pin" style={{ left: `${aPct}%` }}>
                <div className="t-pin-dot t-pin-actual pop"
                  style={{ background: diffColor, boxShadow: `0 0 0 5px ${diffColor}44` }}
                />
                <span className="t-label t-label-above pop" style={{ color: diffColor }}>
                  {targetYear}
                </span>
              </div>
            )}
          </div>

          <div className="timeline-axis">
            <span>{rMin}</span>
            <span>{rMax}</span>
          </div>
        </div>

        {phase >= 3 && (
          <div className="score-section fade-in">
            <p className="diff-line">
              {diff === 0 ? 'Exact match!' : `Off by ${diff} year${diff !== 1 ? 's' : ''}`}
            </p>
            <div className="score-display">
              <span className="score-num" style={{ color: diffColor }}>
                +{score.toLocaleString()}
              </span>
              <span className="score-label">pts</span>
            </div>
            <div className="total-score">
              {totalScore.toLocaleString()} total
            </div>
            <div className="result-actions">
              <button className="action-btn primary" onClick={onPlayAgain}>Play Again</button>
              <button className="action-btn secondary" onClick={onHome}>Home</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
