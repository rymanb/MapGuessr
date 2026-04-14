import { useState } from 'react'
import OHMMap from './OHMMap.jsx'
import YearSlider from './YearSlider.jsx'
import { getRandomRound } from '../data/rounds.js'
import './Game.css'

export default function Game({ onGuess, totalScore, usedYears }) {
  const [round] = useState(() => getRandomRound(usedYears))
  const [guessYear, setGuessYear] = useState(1900)
  const [inputVal, setInputVal] = useState('1900')

  function handleSlider(v) {
    setGuessYear(v)
    setInputVal(String(v))
  }

  function handleInput(e) {
    setInputVal(e.target.value)
    const n = parseInt(e.target.value, 10)
    if (!isNaN(n) && n >= 0 && n <= 2026) setGuessYear(n)
  }

  function handleInputBlur() {
    const n = parseInt(inputVal, 10)
    if (isNaN(n) || n < 0) { setGuessYear(0); setInputVal('0') }
    else if (n > 2026) { setGuessYear(2026); setInputVal('2026') }
    else { setGuessYear(n); setInputVal(String(n)) }
  }

  return (
    <div className="game">
      <div className="map-area">
        <OHMMap
          filterDate={round.filterDate}
          center={[15, 50]}
          zoom={3}
        />
        <div className="score-hud">
          {totalScore.toLocaleString()} pts
        </div>
      </div>

      <div className="guess-panel">
        <h2>What year is this?</h2>
        <div className="slider-section">
          <YearSlider value={guessYear} onChange={handleSlider} min={0} max={2026} />
        </div>
        <input
          className="guess-year-display"
          type="number"
          min={0}
          max={2026}
          value={inputVal}
          onChange={handleInput}
          onBlur={handleInputBlur}
        />
        <button className="submit-btn" onClick={() => onGuess(guessYear, round.targetYear)}>
          Submit
        </button>
      </div>
    </div>
  )
}
