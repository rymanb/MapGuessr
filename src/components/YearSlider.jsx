import './YearSlider.css'

export default function YearSlider({ value, onChange, min, max }) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="year-slider-wrap">
      <span className="slider-label">{min}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="year-slider"
        style={{ '--pct': `${pct}%` }}
      />
      <span className="slider-label">{max}</span>
    </div>
  )
}
