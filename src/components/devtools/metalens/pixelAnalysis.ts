import type { DominantColor, PixelAnalysis } from './types'

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image cannot be decoded by browser canvas'))
    img.src = src
  })
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase()
}

export async function computePixelAnalysis(dataUrl: string): Promise<PixelAnalysis | null> {
  try {
    const img = await loadImageElement(dataUrl)
    const maxDim = 280
    const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * ratio))
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)

    const histR = Array.from({ length: 256 }, () => 0)
    const histG = Array.from({ length: 256 }, () => 0)
    const histB = Array.from({ length: 256 }, () => 0)
    const histL = Array.from({ length: 256 }, () => 0)

    // 12-bit RGB quantization buckets (4 bits per channel) for fast dominant color extraction
    const buckets = new Map<number, { rSum: number; gSum: number; bSum: number; count: number }>()
    let opaqueCount = 0

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      const a = data[i + 3] ?? 255
      if (a < 32) continue

      opaqueCount++
      histR[r] = (histR[r] ?? 0) + 1
      histG[g] = (histG[g] ?? 0) + 1
      histB[b] = (histB[b] ?? 0) + 1
      const luma = Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b))
      histL[luma] = (histL[luma] ?? 0) + 1

      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const existing = buckets.get(key)
      if (existing) {
        existing.rSum += r
        existing.gSum += g
        existing.bSum += b
        existing.count++
      } else {
        buckets.set(key, { rSum: r, gSum: g, bSum: b, count: 1 })
      }
    }

    const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count)
    const picked: Array<{ r: number; g: number; b: number; count: number }> = []

    for (const b of sorted) {
      const r = Math.round(b.rSum / b.count)
      const g = Math.round(b.gSum / b.count)
      const bl = Math.round(b.bSum / b.count)
      const tooClose = picked.some((p) => Math.hypot(p.r - r, p.g - g, p.b - bl) < 34)
      if (!tooClose) {
        picked.push({ r, g, b: bl, count: b.count })
      }
      if (picked.length >= 6) break
    }

    const total = Math.max(1, opaqueCount)
    const dominantColors: DominantColor[] = picked.map((p) => ({
      hex: `#${toHex(p.r)}${toHex(p.g)}${toHex(p.b)}`,
      pct: Math.max(1, Math.round((p.count / total) * 100))
    }))

    return {
      histogramR: histR,
      histogramG: histG,
      histogramB: histB,
      histogramL: histL,
      dominantColors
    }
  } catch {
    return null
  }
}

export function drawHistogramCanvas(
  canvas: HTMLCanvasElement,
  analysis: PixelAnalysis,
  options: { r: boolean; g: boolean; b: boolean; l: boolean }
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#080b12'
  ctx.fillRect(0, 0, W, H)

  // Subtle vertical quarters grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    const x = (W / 4) * i
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }

  const activeSeries: Array<{ bins: number[]; stroke: string; fill: string }> = []
  if (options.l) activeSeries.push({ bins: analysis.histogramL, stroke: 'rgba(248, 250, 252, 0.85)', fill: 'rgba(248, 250, 252, 0.12)' })
  if (options.r) activeSeries.push({ bins: analysis.histogramR, stroke: 'rgba(255, 59, 92, 0.9)', fill: 'rgba(255, 59, 92, 0.16)' })
  if (options.g) activeSeries.push({ bins: analysis.histogramG, stroke: 'rgba(16, 185, 129, 0.9)', fill: 'rgba(16, 185, 129, 0.16)' })
  if (options.b) activeSeries.push({ bins: analysis.histogramB, stroke: 'rgba(56, 189, 248, 0.9)', fill: 'rgba(56, 189, 248, 0.16)' })

  if (activeSeries.length === 0) return

  // Normalize against 98th percentile bin so single flat spikes don't flatten the rest of the chart
  const allVals: number[] = []
  for (const s of activeSeries) {
    for (let i = 2; i < 254; i++) {
      allVals.push(s.bins[i] ?? 0)
    }
  }
  allVals.sort((a, b) => a - b)
  const peak = Math.max(1, allVals[Math.floor(allVals.length * 0.985)] ?? 1)

  for (const series of activeSeries) {
    ctx.beginPath()
    ctx.moveTo(0, H)
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * W
      const norm = Math.min(1, (series.bins[i] ?? 0) / peak)
      const y = H - norm * (H - 8)
      ctx.lineTo(x, y)
    }
    ctx.lineTo(W, H)
    ctx.closePath()
    ctx.fillStyle = series.fill
    ctx.fill()

    ctx.beginPath()
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * W
      const norm = Math.min(1, (series.bins[i] ?? 0) / peak)
      const y = H - norm * (H - 8)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = series.stroke
    ctx.lineWidth = 1.6
    ctx.stroke()
  }
}

/**
 * Compute Error Level Analysis (ELA) heatmap by recompressing at target JPEG quality
 * and amplifying absolute per-channel pixel differences.
 */
export async function generateElaDataUrl(
  dataUrl: string,
  quality = 0.9,
  amplification = 16
): Promise<string | null> {
  try {
    const img = await loadImageElement(dataUrl)
    const maxW = 760
    const scale = Math.min(1, maxW / Math.max(1, img.naturalWidth || 1))
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale))
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale))

    const origCanvas = document.createElement('canvas')
    origCanvas.width = w
    origCanvas.height = h
    const origCtx = origCanvas.getContext('2d')
    if (!origCtx) return null
    origCtx.drawImage(img, 0, 0, w, h)
    const origData = origCtx.getImageData(0, 0, w, h).data

    const recompUrl = origCanvas.toDataURL('image/jpeg', quality)
    const recompImg = await loadImageElement(recompUrl)

    const diffCanvas = document.createElement('canvas')
    diffCanvas.width = w
    diffCanvas.height = h
    const diffCtx = diffCanvas.getContext('2d')
    if (!diffCtx) return null
    diffCtx.drawImage(recompImg, 0, 0, w, h)

    const recompImageData = diffCtx.getImageData(0, 0, w, h)
    const recompData = recompImageData.data

    for (let i = 0; i < origData.length; i += 4) {
      const dr = Math.abs((origData[i] ?? 0) - (recompData[i] ?? 0)) * amplification
      const dg = Math.abs((origData[i + 1] ?? 0) - (recompData[i + 1] ?? 0)) * amplification
      const db = Math.abs((origData[i + 2] ?? 0) - (recompData[i + 2] ?? 0)) * amplification
      recompData[i] = Math.min(255, dr)
      recompData[i + 1] = Math.min(255, dg)
      recompData[i + 2] = Math.min(255, db)
      recompData[i + 3] = 255
    }

    diffCtx.putImageData(recompImageData, 0, 0)
    return diffCanvas.toDataURL('image/png')
  } catch {
    return null
  }
}
