const YEARS = [
  395, 500, 550, 840, 843, 1060, 1100, 1200,
  1715, 1740, 1780, 1790, 1800, 1817, 1830, 1848, 1862, 1871, 1880, 1885, 1890,
  1900, 1905, 1910, 1914, 1918, 1921, 1925, 1930,
  1935, 1938, 1942, 1945, 1950, 1955, 1960, 1965,
  1970, 1975, 1980, 1985, 1990, 1992, 2000, 2010, 2015,
]

export const TOTAL_YEARS = YEARS.length

export function getRandomRound(usedYears = []) {
  const available = YEARS.filter(y => !usedYears.includes(y))
  const pool = available.length > 0 ? available : YEARS
  const year = pool[Math.floor(Math.random() * pool.length)]
  return {
    targetYear: year,
    filterDate: `${year}-06-15`,
  }
}
