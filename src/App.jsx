import { useState } from 'react'
import Game from './components/Game.jsx'
import StartScreen from './components/StartScreen.jsx'
import ResultScreen from './components/ResultScreen.jsx'
import './App.css'

export default function App() {
  const [phase, setPhase] = useState('start')
  const [result, setResult] = useState(null)
  const [totalScore, setTotalScore] = useState(0)
  const [usedYears, setUsedYears] = useState([])

  function calcScore(diff, targetYear) {
    if (targetYear >= 1900) {
      // Max error = 8 yrs; quadratic dropoff so precision is heavily rewarded
      return Math.max(0, Math.round(5000 * Math.pow(Math.max(0, 1 - diff / 12), 1.5)))
    }
    const halflife = targetYear >= 1700 ? 15 : targetYear >= 1000 ? 35 : 60
    return Math.max(0, Math.round(5000 * Math.pow(0.5, diff / halflife)))
  }

  function handleStart() {
    setTotalScore(0)
    setUsedYears([])
    setPhase('playing')
  }

  function handleGuess(guessedYear, targetYear) {
    const diff = Math.abs(guessedYear - targetYear)
    const score = calcScore(diff, targetYear)
    setTotalScore(prev => prev + score)
    setUsedYears(prev => [...prev, targetYear])
    setResult({ guessedYear, targetYear, diff, score })
    setPhase('result')
  }

  function handlePlayAgain() {
    setResult(null)
    setPhase('playing')
  }

  function handleHome() {
    setResult(null)
    setTotalScore(0)
    setUsedYears([])
    setPhase('start')
  }

  return (
    <div className="app">
      {phase === 'start' && <StartScreen onStart={handleStart} />}
      {phase === 'playing' && (
        <Game
          onGuess={handleGuess}
          totalScore={totalScore}
          usedYears={usedYears}
        />
      )}
      {phase === 'result' && (
        <ResultScreen
          result={result}
          totalScore={totalScore}
          onPlayAgain={handlePlayAgain}
          onHome={handleHome}
        />
      )}
    </div>
  )
}
