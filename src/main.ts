import { zTest, confidenceInterval, uplift, sampleSize, simulate } from './stats'
import { drawConversionChart, drawPValueChart, drawCIChart } from './charts'

// ── DOM helpers ────────────────────────────────────────────────────────────

function $<T extends HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel)
  if (!el) throw new Error(`Missing element: ${sel}`)
  return el
}

function num(sel: string): number {
  return parseFloat($<HTMLInputElement>(sel).value)
}

// ── State ──────────────────────────────────────────────────────────────────

let animFrame: number | null = null
let currentDay = 0

// ── Render ─────────────────────────────────────────────────────────────────

function renderResults(convA: number, nA: number, convB: number, nB: number): void {
  const pA = convA / nA
  const pB = convB / nB
  const test = zTest(convA, nA, convB, nB)
  const ciA = confidenceInterval(convA, nA)
  const ciB = confidenceInterval(convB, nB)
  const up = uplift(pA, pB)

  // Stat cards
  $<HTMLElement>('#stat-rate-a').textContent = `${(pA * 100).toFixed(2)}%`
  $<HTMLElement>('#stat-rate-b').textContent = `${(pB * 100).toFixed(2)}%`
  $<HTMLElement>('#stat-uplift').textContent = `${up >= 0 ? '+' : ''}${up.toFixed(2)}%`
  $<HTMLElement>('#stat-uplift').style.color = up >= 0 ? 'var(--b)' : 'var(--sig)'
  $<HTMLElement>('#stat-pvalue').textContent = test.pValue < 0.001 ? '<0.001' : test.pValue.toFixed(4)
  $<HTMLElement>('#stat-z').textContent = test.z.toFixed(3)

  // Verdict
  const verdict = $<HTMLElement>('#verdict')
  if (test.significant) {
    verdict.textContent = up > 0
      ? `✅  B wins — statistically significant at p < 0.05`
      : `⚠️  A wins — B underperforms at p < 0.05`
    verdict.className = 'verdict significant'
  } else {
    verdict.textContent = `⏳  No significant difference yet (p = ${test.pValue.toFixed(3)})`
    verdict.className = 'verdict inconclusive'
  }

  // CI chart
  drawCIChart(
    $<HTMLElement>('#chart-ci'),
    { lower: ciA.lower, upper: ciA.upper, p: pA },
    { lower: ciB.lower, upper: ciB.upper, p: pB },
    { width: chartWidth('#chart-ci'), height: 120 },
  )
}

function chartWidth(sel: string): number {
  return $<HTMLElement>(sel).getBoundingClientRect().width || 600
}

function runSimulation(): void {
  if (animFrame !== null) cancelAnimationFrame(animFrame)
  currentDay = 0

  const config = {
    nA: Math.round(num('#input-n') / 2),
    nB: Math.round(num('#input-n') / 2),
    trueRateA: num('#input-rate-a') / 100,
    trueRateB: num('#input-rate-b') / 100,
    days: Math.round(num('#input-days')),
  }

  const series = simulate(config)
  const totalDays = series.length

  // Sample size suggestion
  const mde = Math.abs(config.trueRateB - config.trueRateA) / config.trueRateA
  const ss = sampleSize(config.trueRateA, mde)
  $<HTMLElement>('#ss-value').textContent =
    `${ss.perVariant.toLocaleString()} per variant  (${ss.total.toLocaleString()} total)`

  function tick(): void {
    currentDay = Math.min(currentDay + 1, totalDays - 1)
    const slice = series.slice(0, currentDay + 1)
    const last = slice[slice.length - 1]

    // Progress
    $<HTMLElement>('#progress-label').textContent = `Day ${last.day} / ${totalDays}`
    $<HTMLInputElement>('#progress-bar').value = String(currentDay)
    $<HTMLInputElement>('#progress-bar').max = String(totalDays - 1)

    // Conversion line chart
    drawConversionChart(
      $<HTMLElement>('#chart-conv'),
      slice.map(d => d.rateA),
      slice.map(d => d.rateB),
      { width: chartWidth('#chart-conv'), height: 180 },
    )

    // p-value line chart
    drawPValueChart(
      $<HTMLElement>('#chart-pvalue'),
      slice.map(d => d.pValue),
      { width: chartWidth('#chart-pvalue'), height: 140 },
    )

    renderResults(last.convA, last.usersA, last.convB, last.usersB)

    if (currentDay < totalDays - 1) {
      animFrame = requestAnimationFrame(tick)
    } else {
      animFrame = null
    }
  }

  tick()
}

// ── Sample size calculator (live) ──────────────────────────────────────────

function updateSS(): void {
  const base = num('#ss-base') / 100
  const mde = num('#ss-mde') / 100
  if (base <= 0 || mde <= 0 || base >= 1) return
  const ss = sampleSize(base, mde)
  $<HTMLElement>('#ss-calc-result').textContent =
    `${ss.perVariant.toLocaleString()} per variant — ${ss.total.toLocaleString()} total users needed`
}

// ── Bootstrap ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  $<HTMLButtonElement>('#btn-run').addEventListener('click', runSimulation)

  // Scrubber
  $<HTMLInputElement>('#progress-bar').addEventListener('input', e => {
    if (animFrame !== null) { cancelAnimationFrame(animFrame); animFrame = null }
    currentDay = parseInt((e.target as HTMLInputElement).value)
    $<HTMLElement>('#progress-label').textContent = `Day ${currentDay + 1}`
  })

  // SS calculator inputs
  ;['#ss-base', '#ss-mde'].forEach(sel => {
    $<HTMLInputElement>(sel).addEventListener('input', updateSS)
  })
  updateSS()

  // Auto-run on load
  runSimulation()
})
