// ── Lightweight SVG chart helpers ──────────────────────────────────────────

export interface LinePoint {
  x: number
  y: number
}

interface ChartOptions {
  width: number
  height: number
  padL?: number
  padR?: number
  padT?: number
  padB?: number
}

function lerp(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return (outMin + outMax) / 2
  return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin)
}

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}

function polyline(points: LinePoint[], color: string, width = 2, dashed = false): SVGElement {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return svgEl('path', {
    d,
    fill: 'none',
    stroke: color,
    'stroke-width': width,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    ...(dashed ? { 'stroke-dasharray': '5,4' } : {}),
  })
}

/** Conversion rate over time — dual line chart */
export function drawConversionChart(
  container: HTMLElement,
  seriesA: number[],
  seriesB: number[],
  opts: ChartOptions,
): void {
  const { width, height, padL = 48, padR = 16, padT = 12, padB = 32 } = opts
  const W = width - padL - padR
  const H = height - padT - padB

  const allVals = [...seriesA, ...seriesB]
  const yMin = Math.max(0, Math.min(...allVals) * 0.85)
  const yMax = Math.max(...allVals) * 1.12

  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}` })

  // Grid lines
  const ticks = 4
  for (let i = 0; i <= ticks; i++) {
    const y = padT + (H / ticks) * i
    const val = lerp(y, padT, padT + H, yMax, yMin)
    const line = svgEl('line', { x1: padL, x2: padL + W, y1: y, y2: y, stroke: 'var(--grid)', 'stroke-width': 1 })
    svg.appendChild(line)
    const label = svgEl('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 10 })
    label.textContent = `${(val * 100).toFixed(1)}%`
    svg.appendChild(label)
  }

  // X axis labels (every ~7 days)
  const n = seriesA.length
  const step = Math.ceil(n / 6)
  for (let i = 0; i < n; i += step) {
    const x = padL + lerp(i, 0, n - 1, 0, W)
    const label = svgEl('text', { x, y: padT + H + 18, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 10 })
    label.textContent = `D${i + 1}`
    svg.appendChild(label)
  }

  const toPoint = (val: number, i: number): LinePoint => ({
    x: padL + lerp(i, 0, n - 1, 0, W),
    y: padT + lerp(val, yMin, yMax, H, 0),
  })

  // Area fill for A
  const aPoints = seriesA.map((v, i) => toPoint(v, i))
  const areaA = svgEl('path', {
    d: [
      ...aPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`),
      `L${aPoints[aPoints.length - 1].x},${padT + H}`,
      `L${padL},${padT + H}Z`,
    ].join(' '),
    fill: 'var(--a-fill)',
  })
  svg.appendChild(areaA)

  // Lines
  svg.appendChild(polyline(aPoints, 'var(--a)', 2.5))
  svg.appendChild(polyline(seriesB.map((v, i) => toPoint(v, i)), 'var(--b)', 2.5))

  container.innerHTML = ''
  container.appendChild(svg)
}

/** p-value over time — line + significance threshold */
export function drawPValueChart(
  container: HTMLElement,
  pValues: number[],
  opts: ChartOptions,
): void {
  const { width, height, padL = 48, padR = 16, padT = 12, padB = 32 } = opts
  const W = width - padL - padR
  const H = height - padT - padB
  const n = pValues.length

  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}` })

  // Grid
  ;[0, 0.25, 0.5, 0.75, 1.0].forEach(v => {
    const y = padT + lerp(v, 0, 1, H, 0)
    svg.appendChild(svgEl('line', { x1: padL, x2: padL + W, y1: y, y2: y, stroke: 'var(--grid)', 'stroke-width': 1 }))
    const label = svgEl('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end', fill: 'var(--muted)', 'font-size': 10 })
    label.textContent = v.toFixed(2)
    svg.appendChild(label)
  })

  // Threshold line at p=0.05
  const threshY = padT + lerp(0.05, 0, 1, H, 0)
  svg.appendChild(svgEl('line', { x1: padL, x2: padL + W, y1: threshY, y2: threshY, stroke: 'var(--sig)', 'stroke-width': 1.5, 'stroke-dasharray': '6,3' }))
  const threshLabel = svgEl('text', { x: padL + W - 2, y: threshY - 4, 'text-anchor': 'end', fill: 'var(--sig)', 'font-size': 9 })
  threshLabel.textContent = 'α = 0.05'
  svg.appendChild(threshLabel)

  // X labels
  const step = Math.ceil(n / 6)
  for (let i = 0; i < n; i += step) {
    const x = padL + lerp(i, 0, n - 1, 0, W)
    const label = svgEl('text', { x, y: padT + H + 18, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 10 })
    label.textContent = `D${i + 1}`
    svg.appendChild(label)
  }

  const points = pValues.map((v, i) => ({
    x: padL + lerp(i, 0, n - 1, 0, W),
    y: padT + lerp(Math.min(v, 1), 0, 1, H, 0),
  }))

  // Shade area below threshold (significant zone)
  svg.appendChild(svgEl('rect', { x: padL, y: threshY, width: W, height: padT + H - threshY, fill: 'var(--sig-fill)' }))
  svg.appendChild(polyline(points, 'var(--p-line)', 2))

  container.innerHTML = ''
  container.appendChild(svg)
}

/** CI bar chart for final rates */
export function drawCIChart(
  container: HTMLElement,
  ciA: { lower: number; upper: number; p: number },
  ciB: { lower: number; upper: number; p: number },
  opts: ChartOptions,
): void {
  const { width, height, padL = 60, padR = 20, padT = 20, padB = 20 } = opts
  const W = width - padL - padR
  const H = height - padT - padB

  const allVals = [ciA.lower, ciA.upper, ciB.lower, ciB.upper]
  const xMin = Math.max(0, Math.min(...allVals) * 0.9)
  const xMax = Math.min(1, Math.max(...allVals) * 1.1)

  const toX = (v: number) => padL + lerp(v, xMin, xMax, 0, W)

  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}` })

  // X grid
  const ticks = 5
  for (let i = 0; i <= ticks; i++) {
    const v = xMin + (i / ticks) * (xMax - xMin)
    const x = toX(v)
    svg.appendChild(svgEl('line', { x1: x, x2: x, y1: padT, y2: padT + H, stroke: 'var(--grid)', 'stroke-width': 1 }))
    const label = svgEl('text', { x, y: padT + H + 14, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 10 })
    label.textContent = `${(v * 100).toFixed(1)}%`
    svg.appendChild(label)
  }

  const drawCI = (ci: typeof ciA, yCenter: number, color: string, label: string) => {
    const barH = 14
    // CI range bar
    svg.appendChild(svgEl('rect', {
      x: toX(ci.lower), y: yCenter - barH / 2,
      width: toX(ci.upper) - toX(ci.lower), height: barH,
      fill: color, opacity: 0.25, rx: 3,
    }))
    // Mean dot
    svg.appendChild(svgEl('circle', { cx: toX(ci.p), cy: yCenter, r: 6, fill: color }))
    // Whiskers
    ;[ci.lower, ci.upper].forEach(v => {
      svg.appendChild(svgEl('line', { x1: toX(v), x2: toX(v), y1: yCenter - barH / 2, y2: yCenter + barH / 2, stroke: color, 'stroke-width': 2 }))
    })
    // Label
    const lbl = svgEl('text', { x: padL - 8, y: yCenter + 4, 'text-anchor': 'end', fill: color, 'font-size': 11, 'font-weight': 600 })
    lbl.textContent = label
    svg.appendChild(lbl)
    // Value
    const val = svgEl('text', { x: toX(ci.p) + 10, y: yCenter - 10, fill: 'var(--fg)', 'font-size': 10 })
    val.textContent = `${(ci.p * 100).toFixed(2)}%`
    svg.appendChild(val)
  }

  drawCI(ciA, padT + H * 0.33, 'var(--a)', 'A')
  drawCI(ciB, padT + H * 0.67, 'var(--b)', 'B')

  container.innerHTML = ''
  container.appendChild(svg)
}
