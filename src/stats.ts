// ── Types ──────────────────────────────────────────────────────────────────

export interface ZTestResult {
  z: number
  pValue: number
  significant: boolean
}

export interface ConfidenceInterval {
  lower: number
  upper: number
  p: number
}

export interface DayPoint {
  day: number
  usersA: number
  convA: number
  rateA: number
  usersB: number
  convB: number
  rateB: number
  pValue: number
  significant: boolean
  z: number
}

export interface SimConfig {
  nA: number
  nB: number
  trueRateA: number
  trueRateB: number
  days: number
}

export interface SampleSizeResult {
  perVariant: number
  total: number
}

// ── Normal distribution helpers ────────────────────────────────────────────

function normalCDF(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = z < 0 ? -1 : 1
  const absZ = Math.abs(z) / Math.sqrt(2)
  const t = 1 / (1 + p * absZ)
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absZ * absZ)
  return 0.5 * (1 + sign * y)
}

function normalInv(p: number): number {
  const a = [0, -3.969683028665376e1, 2.209460984245205e2,
    -2.759285104469687e2, 1.383577518672690e2,
    -3.066479806614716e1, 2.506628277459239]
  const b = [0, -5.447609879822406e1, 1.615858368580409e2,
    -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [0, -7.784894002430293e-3, -3.223964580411365e-1,
    -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783]
  const d = [0, 7.784695709041462e-3, 3.224671290700398e-1,
    2.445134137142996, 3.754408661907416]

  const pLow = 0.02425
  const pHigh = 1 - pLow

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) /
           ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1)
  }
  if (p <= pHigh) {
    const q = p - 0.5
    const r = q * q
    return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q /
           (((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1)
  }
  const q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) /
          ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1)
}

// ── Core statistics ────────────────────────────────────────────────────────

/** Two-proportion z-test */
export function zTest(convA: number, nA: number, convB: number, nB: number): ZTestResult {
  const pA = convA / nA
  const pB = convB / nB
  const pPool = (convA + convB) / (nA + nB)
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB))
  if (se === 0) return { z: 0, pValue: 1, significant: false }
  const z = (pB - pA) / se
  const pValue = 2 * (1 - normalCDF(Math.abs(z)))
  return { z, pValue, significant: pValue < 0.05 }
}

/** Wilson 95% confidence interval for a proportion */
export function confidenceInterval(conv: number, n: number): ConfidenceInterval {
  const z = 1.96
  const p = conv / n
  const margin = z * Math.sqrt((p * (1 - p)) / n)
  return {
    lower: Math.max(0, p - margin),
    upper: Math.min(1, p + margin),
    p,
  }
}

/** Relative uplift of B over A in percent */
export function uplift(pA: number, pB: number): number {
  if (pA === 0) return 0
  return ((pB - pA) / pA) * 100
}

/** Required sample size per variant (two-sided, α=0.05, power=0.80) */
export function sampleSize(
  baseRate: number,
  mde: number,
  alpha = 0.05,
  power = 0.8,
): SampleSizeResult {
  const zAlpha = normalInv(1 - alpha / 2)
  const zBeta = normalInv(power)
  const pB = baseRate * (1 + mde)
  const pAvg = (baseRate + pB) / 2
  const n = Math.ceil(
    2 * pAvg * (1 - pAvg) * Math.pow(zAlpha + zBeta, 2) / Math.pow(pB - baseRate, 2),
  )
  return { perVariant: n, total: n * 2 }
}

/** Simulate daily cumulative data for a test run */
export function simulate(config: SimConfig): DayPoint[] {
  const { nA, nB, trueRateA, trueRateB, days } = config
  const usersPerDay = Math.round((nA + nB) / days)
  let cumA = 0, cumConvA = 0, cumB = 0, cumConvB = 0
  const series: DayPoint[] = []

  for (let d = 1; d <= days; d++) {
    const dayUsers = usersPerDay + Math.round((Math.random() - 0.5) * usersPerDay * 0.3)
    const aUsers = Math.round(dayUsers / 2)
    const bUsers = dayUsers - aUsers

    const noise = () => Math.random() * 2 - 1
    const convA = Math.min(aUsers, Math.max(0, Math.round(
      aUsers * trueRateA + Math.sqrt(aUsers * trueRateA * (1 - trueRateA)) * noise()
    )))
    const convB = Math.min(bUsers, Math.max(0, Math.round(
      bUsers * trueRateB + Math.sqrt(bUsers * trueRateB * (1 - trueRateB)) * noise()
    )))

    cumA += aUsers; cumConvA += convA
    cumB += bUsers; cumConvB += convB

    const test = zTest(cumConvA, cumA, cumConvB, cumB)
    series.push({
      day: d,
      usersA: cumA, convA: cumConvA, rateA: cumConvA / cumA,
      usersB: cumB, convB: cumConvB, rateB: cumConvB / cumB,
      pValue: test.pValue,
      significant: test.significant,
      z: test.z,
    })
  }
  return series
}
