import CryptoJS from 'crypto-js'
import type { BinarySegment, FileHashes } from './types'

function readAscii(bytes: Uint8Array, start: number, len: number): string {
  const end = Math.min(bytes.length, start + len)
  let out = ''
  for (let i = start; i < end; i++) {
    const b = bytes[i]
    if (b === undefined) break
    out += String.fromCharCode(b)
  }
  return out
}

export function inferMimeAndExt(
  fileName: string,
  declaredType: string,
  buffer: ArrayBuffer
): { mime: string; ext: string } {
  const bytes = new Uint8Array(buffer, 0, Math.min(24, buffer.byteLength))

  // Check magic bytes first for accuracy even when file.type is empty
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mime: 'image/png', ext: 'png' }
  }
  if (bytes.length >= 12 && readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 4) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' }
  }
  if (bytes.length >= 6 && (readAscii(bytes, 0, 6) === 'GIF87a' || readAscii(bytes, 0, 6) === 'GIF89a')) {
    return { mime: 'image/gif', ext: 'gif' }
  }
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return { mime: 'image/tiff', ext: 'tiff' }
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { mime: 'image/bmp', ext: 'bmp' }
  }
  if (bytes.length >= 12 && readAscii(bytes, 4, 4) === 'ftyp') {
    const brand = readAscii(bytes, 8, 4).toLowerCase()
    if (brand.includes('avif') || brand.includes('avis')) {
      return { mime: 'image/avif', ext: 'avif' }
    }
    if (brand.includes('heic') || brand.includes('heix') || brand.includes('mif1')) {
      return { mime: 'image/heic', ext: 'heic' }
    }
  }

  const extMatch = fileName.match(/\.([a-z0-9]+)$/i)
  const ext = extMatch?.[1]?.toLowerCase() || 'bin'
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    heic: 'image/heic',
    gif: 'image/gif',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    bmp: 'image/bmp'
  }
  const mime = declaredType || mimeMap[ext] || 'application/octet-stream'
  return { mime, ext }
}

export async function computeFileHashes(buffer: ArrayBuffer): Promise<FileHashes> {
  let sha256 = 'Unavailable'
  try {
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    sha256 = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    sha256 = 'SHA-256 error'
  }

  let md5 = 'Unavailable'
  try {
    const wordArray = CryptoJS.lib.WordArray.create(new Uint8Array(buffer))
    md5 = CryptoJS.MD5(wordArray).toString()
  } catch {
    md5 = 'MD5 error'
  }

  return { sha256, md5 }
}

function describeJpegAppSegment(marker: number, payload: Uint8Array): { label: string; desc: string; isMeta: boolean } {
  const num = marker - 0xe0
  const header = readAscii(payload, 0, Math.min(32, payload.length))
  if (num === 0 && header.startsWith('JFIF')) {
    return { label: 'APP0 (JFIF)', desc: 'Standard JPEG File Interchange header', isMeta: false }
  }
  if (num === 1 && header.startsWith('Exif')) {
    return { label: 'APP1 (EXIF)', desc: 'Camera hardware, timestamps, GPS & thumbnail metadata', isMeta: true }
  }
  if (num === 1 && header.includes('ns.adobe.com/xap')) {
    return { label: 'APP1 (XMP)', desc: 'Adobe XMP / AI provenance & editing metadata packet', isMeta: true }
  }
  if (num === 2 && header.startsWith('ICC_PROFILE')) {
    return { label: 'APP2 (ICC)', desc: 'Embedded color space calibration profile', isMeta: false }
  }
  if (num === 2 && header.startsWith('MPF')) {
    return { label: 'APP2 (MPF)', desc: 'Multi-Picture Format auxiliary image container', isMeta: true }
  }
  if (num === 11 || header.includes('jumb')) {
    return { label: `APP${num} (JUMBF/C2PA)`, desc: 'C2PA Content Credentials cryptographic manifest', isMeta: true }
  }
  if (num === 13 && header.startsWith('Photoshop')) {
    return { label: 'APP13 (IPTC/PS)', desc: 'Photoshop IRB & IPTC editorial metadata', isMeta: true }
  }
  if (num === 14 && header.startsWith('Adobe')) {
    return { label: 'APP14 (Adobe)', desc: 'Adobe color transform header', isMeta: false }
  }
  return { label: `APP${num}`, desc: 'Application-specific metadata segment', isMeta: num !== 0 }
}

/**
 * Find the byte offset right after entropy-coded scan data following a JPEG SOS marker.
 */
function findNextJpegMarkerAfterScan(bytes: Uint8Array, scanStart: number): number {
  let i = scanStart
  while (i < bytes.length - 1) {
    if (bytes[i] === 0xff) {
      const next = bytes[i + 1]
      if (next === undefined) break
      // 0x00 is byte-stuffing; 0xD0..0xD7 are RST0..RST7; 0xFF is fill padding
      if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
        i += 2
        continue
      }
      if (next === 0xff) {
        i++
        continue
      }
      return i
    }
    i++
  }
  return bytes.length
}

export function parseBinarySegments(buffer: ArrayBuffer, ext: string): BinarySegment[] {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const segments: BinarySegment[] = []

  // JPEG Marker Parser
  if (ext === 'jpg' || ext === 'jpeg' || (bytes[0] === 0xff && bytes[1] === 0xd8)) {
    let offset = 2
    segments.push({ offset: 0, name: 'SOI', size: 2, description: 'Start of JPEG Image', isMetadata: false })

    while (offset < bytes.length - 1 && segments.length < 150) {
      if (bytes[offset] !== 0xff) {
        offset++
        continue
      }
      while (offset < bytes.length && bytes[offset] === 0xff) offset++
      const marker = bytes[offset]
      if (marker === undefined) break
      const markerStart = offset - 1
      offset++

      if (marker === 0xd9) {
        segments.push({ offset: markerStart, name: 'EOI', size: 2, description: 'End of JPEG Image', isMetadata: false })
        break
      }
      if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) continue
      if (offset + 2 > bytes.length) break

      const segLen = view.getUint16(offset, false)
      const segTotal = 2 + segLen

      if (marker >= 0xe0 && marker <= 0xef) {
        const payload = bytes.subarray(offset + 2, Math.min(bytes.length, offset + 2 + 36))
        const info = describeJpegAppSegment(marker, payload)
        segments.push({
          offset: markerStart,
          name: info.label,
          size: segTotal,
          description: info.desc,
          isMetadata: info.isMeta
        })
      } else if (marker === 0xfe) {
        segments.push({
          offset: markerStart,
          name: 'COM',
          size: segTotal,
          description: 'Embedded JPEG text comment',
          isMetadata: true
        })
      } else if (marker === 0xdb) {
        segments.push({
          offset: markerStart,
          name: 'DQT',
          size: segTotal,
          description: 'Quantization Table (compression matrix)',
          isMetadata: false
        })
      } else if (marker === 0xc4) {
        segments.push({
          offset: markerStart,
          name: 'DHT',
          size: segTotal,
          description: 'Huffman Coding Table',
          isMetadata: false
        })
      } else if (marker === 0xc0 || marker === 0xc2) {
        segments.push({
          offset: markerStart,
          name: marker === 0xc0 ? 'SOF0 (Baseline)' : 'SOF2 (Progressive)',
          size: segTotal,
          description: 'Image frame dimensions & sampling',
          isMetadata: false
        })
      } else if (marker === 0xda) {
        const scanEnd = findNextJpegMarkerAfterScan(bytes, offset + segLen)
        segments.push({
          offset: markerStart,
          name: 'SOS + Scan Data',
          size: scanEnd - markerStart,
          description: 'Compressed image entropy bitstream',
          isMetadata: false
        })
        offset = scanEnd
        continue
      } else {
        segments.push({
          offset: markerStart,
          name: `0xFF${marker.toString(16).toUpperCase().padStart(2, '0')}`,
          size: segTotal,
          description: 'JPEG structural marker',
          isMetadata: false
        })
      }

      offset += segLen
    }
    return segments
  }

  // PNG Chunk Parser
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    let offset = 8
    const chunkDescriptions: Record<string, { desc: string; isMeta: boolean }> = {
      IHDR: { desc: 'PNG Image Header (dimensions, bit depth, color type)', isMeta: false },
      PLTE: { desc: 'Indexed color palette', isMeta: false },
      IDAT: { desc: 'Compressed image pixel data', isMeta: false },
      IEND: { desc: 'End of PNG datastream', isMeta: false },
      tRNS: { desc: 'Alpha transparency lookup table', isMeta: false },
      sRGB: { desc: 'Standard sRGB rendering intent', isMeta: false },
      gAMA: { desc: 'Image gamma value', isMeta: false },
      cHRM: { desc: 'Primary chromaticities & white point', isMeta: false },
      iCCP: { desc: 'Embedded ICC color profile', isMeta: false },
      pHYs: { desc: 'Physical pixel aspect / DPI ratio', isMeta: false },
      tEXt: { desc: 'Uncompressed text metadata (prompts, software, author)', isMeta: true },
      zTXt: { desc: 'Compressed text metadata chunk', isMeta: true },
      iTXt: { desc: 'International UTF-8 text / XMP / ComfyUI workflow JSON', isMeta: true },
      eXIf: { desc: 'Embedded EXIF metadata block', isMeta: true },
      tIME: { desc: 'Last modification timestamp chunk', isMeta: true },
      caBX: { desc: 'C2PA Content Credentials provenance box', isMeta: true }
    }

    while (offset + 12 <= bytes.length && segments.length < 150) {
      const length = view.getUint32(offset, false)
      const type = readAscii(bytes, offset + 4, 4)
      const total = 12 + length
      const metaInfo = chunkDescriptions[type] ?? { desc: 'Auxiliary PNG chunk', isMeta: false }

      segments.push({
        offset,
        name: type,
        size: total,
        description: metaInfo.desc,
        isMetadata: metaInfo.isMeta
      })

      if (type === 'IEND') break
      offset += total
    }
    return segments
  }

  // WebP RIFF Parser
  if (bytes.length >= 12 && readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 4) === 'WEBP') {
    let offset = 12
    const webpMap: Record<string, { desc: string; isMeta: boolean }> = {
      VP8X: { desc: 'Extended WebP feature flags (ICC, Alpha, EXIF, XMP)', isMeta: false },
      'VP8 ': { desc: 'Lossy VP8 bitstream frame', isMeta: false },
      VP8L: { desc: 'Lossless VP8L bitstream frame', isMeta: false },
      ALPH: { desc: 'WebP alpha transparency plane', isMeta: false },
      ANIM: { desc: 'Animation global parameters', isMeta: false },
      ANMF: { desc: 'Animated frame chunk', isMeta: false },
      ICCP: { desc: 'Embedded ICC color profile', isMeta: false },
      EXIF: { desc: 'Embedded EXIF metadata block', isMeta: true },
      'XMP ': { desc: 'Embedded Adobe XMP / C2PA metadata', isMeta: true }
    }

    while (offset + 8 <= bytes.length && segments.length < 150) {
      const fourcc = readAscii(bytes, offset, 4)
      const length = view.getUint32(offset + 4, true)
      const padded = length + (length % 2)
      const info = webpMap[fourcc] ?? { desc: 'RIFF subchunk', isMeta: false }

      segments.push({
        offset,
        name: fourcc.trim() || fourcc,
        size: 8 + padded,
        description: info.desc,
        isMetadata: info.isMeta
      })
      offset += 8 + padded
    }
    return segments
  }

  return segments
}

/**
 * Losslessly strip EXIF, XMP, IPTC, C2PA, and COM metadata from a JPEG ArrayBuffer
 * without recompressing pixel scan data.
 */
export function stripJpegMetadataLossless(buffer: ArrayBuffer): Blob | null {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

  const keptSlices: Uint8Array[] = [bytes.subarray(0, 2)] // Keep SOI
  let offset = 2

  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset++
    const marker = bytes[offset]
    if (marker === undefined) break
    const markerStart = offset - 1
    offset++

    if (marker === 0xd9) {
      keptSlices.push(bytes.subarray(markerStart, offset))
      break
    }
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) break

    const segLen = view.getUint16(offset, false)

    if (marker === 0xda) {
      const scanEnd = findNextJpegMarkerAfterScan(bytes, offset + segLen)
      keptSlices.push(bytes.subarray(markerStart, scanEnd))
      offset = scanEnd
      continue
    }

    const segEnd = Math.min(bytes.length, offset + segLen)

    // Strip APP1..APP15 and COM (0xFE). Keep APP0 (JFIF) and optionally APP2 ICC_PROFILE if desired;
    // keep APP0 + DQT + DHT + SOF + DRI so image decodes identically with zero metadata.
    const isComment = marker === 0xfe
    const isMetaApp = marker >= 0xe1 && marker <= 0xef
    let keepIcc = false
    if (marker === 0xe2) {
      const hdr = readAscii(bytes, offset + 2, 11)
      if (hdr === 'ICC_PROFILE') keepIcc = true
    }

    if (!isComment && (!isMetaApp || keepIcc)) {
      keptSlices.push(bytes.subarray(markerStart, segEnd))
    }

    offset = segEnd
  }

  return new Blob(keptSlices as unknown as BlobPart[], { type: 'image/jpeg' })
}

/**
 * Losslessly strip PNG metadata chunks (tEXt, zTXt, iTXt, eXIf, tIME, caBX)
 * while preserving pixel IDAT chunks bit-for-bit.
 */
export function stripPngMetadataLossless(buffer: ArrayBuffer): Blob | null {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null
  }

  const STRIP_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'caBX'])
  const keptSlices: Uint8Array[] = [bytes.subarray(0, 8)] // PNG signature
  let offset = 8

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false)
    const type = readAscii(bytes, offset + 4, 4)
    const total = 12 + length
    if (offset + total > bytes.length) break

    if (!STRIP_CHUNKS.has(type)) {
      keptSlices.push(bytes.subarray(offset, offset + total))
    }

    offset += total
    if (type === 'IEND') break
  }

  return new Blob(keptSlices as unknown as BlobPart[], { type: 'image/png' })
}
