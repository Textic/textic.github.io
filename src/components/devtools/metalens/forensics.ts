import type {
  AiProvenance,
  AiTrace,
  CameraInfo,
  GpsInfo,
  PrivacyAudit,
  PrivacyFinding,
  SoftwareAiInfo,
  TechnicalInfo
} from './types'

export function formatDms(coord: number | undefined, posRef: string, negRef: string): string | undefined {
  if (coord === undefined || isNaN(coord)) return undefined
  const abs = Math.abs(coord)
  const deg = Math.floor(abs)
  const minFloat = (abs - deg) * 60
  const min = Math.floor(minFloat)
  const sec = ((minFloat - min) * 60).toFixed(2)
  const dir = coord >= 0 ? posRef : negRef
  return `${deg}° ${min}' ${sec}" ${dir}`
}

interface ComfyParsed {
  positive?: string
  negative?: string
  model?: string
  seed?: string
  sampler?: string
  scheduler?: string
  steps?: string
  cfg?: string
  rawPretty?: string
}

/**
 * Parse ComfyUI `prompt` API graph JSON to extract positive/negative text prompts,
 * KSampler hyperparameters, and checkpoint/UNET model names.
 */
function parseComfyPromptGraph(rawJson: string): ComfyParsed | null {
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null

    // Handle either prompt-format dict { "3": { class_type, inputs } } or workflow-format { nodes: [...] }
    const nodesList: Array<{ id: string; classType: string; inputs: Record<string, unknown> }> = []

    if (Array.isArray(parsed.nodes)) {
      // ComfyUI UI workflow format
      let model = ''
      let positive = ''
      const negative = ''
      for (const n of parsed.nodes as Array<Record<string, unknown>>) {
        const type = String(n.type || '')
        const widgets = Array.isArray(n.widgets_values) ? n.widgets_values : []
        if (/CheckpointLoader|UNETLoader/i.test(type) && typeof widgets[0] === 'string') {
          model = widgets[0]
        } else if (/CLIPTextEncode/i.test(type) && typeof widgets[0] === 'string' && !positive) {
          positive = widgets[0]
        }
      }
      return {
        positive: positive || undefined,
        negative: negative || undefined,
        model: model || undefined,
        rawPretty: JSON.stringify(parsed, null, 2)
      }
    }

    const nodeById = new Map<string, { classType: string; inputs: Record<string, unknown> }>()
    for (const [id, val] of Object.entries(parsed)) {
      if (val && typeof val === 'object' && 'class_type' in val) {
        const nodeObj = val as { class_type?: unknown; inputs?: Record<string, unknown> }
        const entry = {
          classType: String(nodeObj.class_type || ''),
          inputs: nodeObj.inputs || {}
        }
        nodeById.set(id, entry)
        nodesList.push({ id, ...entry })
      }
    }

    if (nodesList.length === 0) return null

    const result: ComfyParsed = {
      rawPretty: JSON.stringify(parsed, null, 2)
    }

    const resolveTextFromRef = (refVal: unknown, depth = 0): string | undefined => {
      if (depth > 4) return undefined
      if (typeof refVal === 'string') return refVal
      if (Array.isArray(refVal) && refVal.length >= 1) {
        const targetId = String(refVal[0])
        const targetNode = nodeById.get(targetId)
        if (!targetNode) return undefined
        if (typeof targetNode.inputs.text === 'string') return targetNode.inputs.text
        if (typeof targetNode.inputs.clip_l === 'string') return targetNode.inputs.clip_l
        if (typeof targetNode.inputs.t5xxl === 'string') return targetNode.inputs.t5xxl
        if (targetNode.inputs.conditioning) {
          return resolveTextFromRef(targetNode.inputs.conditioning, depth + 1)
        }
        if (targetNode.inputs.positive) {
          return resolveTextFromRef(targetNode.inputs.positive, depth + 1)
        }
      }
      return undefined
    }

    for (const node of nodesList) {
      if (/KSampler|SamplerCustom/i.test(node.classType)) {
        const inp = node.inputs
        if (inp.steps !== undefined) result.steps = String(inp.steps)
        if (inp.cfg !== undefined) result.cfg = String(inp.cfg)
        if (inp.sampler_name !== undefined) result.sampler = String(inp.sampler_name)
        if (inp.scheduler !== undefined) result.scheduler = String(inp.scheduler)
        if (inp.seed !== undefined) result.seed = String(inp.seed)
        else if (inp.noise_seed !== undefined) result.seed = String(inp.noise_seed)

        if (inp.positive && !result.positive) {
          result.positive = resolveTextFromRef(inp.positive)
        }
        if (inp.negative && !result.negative) {
          result.negative = resolveTextFromRef(inp.negative)
        }
      } else if (/CheckpointLoader|UNETLoader|DiffusionModelLoader/i.test(node.classType)) {
        const ckpt = node.inputs.ckpt_name || node.inputs.unet_name || node.inputs.model_name
        if (typeof ckpt === 'string' && !result.model) {
          result.model = ckpt
        }
      }
    }

    // Fallback: collect first CLIPTextEncode if sampler links weren't resolved
    if (!result.positive) {
      for (const node of nodesList) {
        if (/CLIPTextEncode/i.test(node.classType) && typeof node.inputs.text === 'string') {
          const txt = node.inputs.text.trim()
          if (txt) {
            result.positive = txt
            break
          }
        }
      }
    }

    return result
  } catch {
    return null
  }
}

export function extractSoftwareAndAiInfo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tags: any,
  software: string | undefined,
  artist: string | undefined,
  copyright: string | undefined,
  userComment: string | undefined
): SoftwareAiInfo {
  const pngText = (tags.pngText || tags.png || {}) as Record<string, { description?: string; value?: string }>
  const rawParams =
    pngText['parameters']?.description ||
    pngText['parameters']?.value ||
    pngText['Parameters']?.description ||
    pngText['Description']?.description ||
    pngText['Comment']?.description ||
    ''
  const comfyPromptRaw = pngText['prompt']?.description || pngText['prompt']?.value || ''
  const comfyWorkflowRaw = pngText['workflow']?.description || pngText['workflow']?.value || ''

  let aiPrompt = ''
  let aiNeg = ''
  let aiRawWorkflow = ''
  let aiEngine = ''
  let aiModel = ''
  let aiSeed = ''
  let aiSampler = ''
  let aiScheduler = ''
  let aiSteps = ''
  let aiCfg = ''

  // 1. Try ComfyUI prompt graph first (gives exact hyperparameters + prompts)
  if (comfyPromptRaw.trim().startsWith('{')) {
    const comfy = parseComfyPromptGraph(comfyPromptRaw)
    if (comfy) {
      aiEngine = 'ComfyUI'
      aiPrompt = comfy.positive || ''
      aiNeg = comfy.negative || ''
      aiModel = comfy.model || ''
      aiSeed = comfy.seed || ''
      aiSampler = comfy.sampler || ''
      aiScheduler = comfy.scheduler || ''
      aiSteps = comfy.steps || ''
      aiCfg = comfy.cfg || ''
      aiRawWorkflow = comfy.rawPretty || comfyPromptRaw
    }
  }

  if (!aiRawWorkflow && comfyWorkflowRaw.trim().startsWith('{')) {
    const wf = parseComfyPromptGraph(comfyWorkflowRaw)
    if (wf) {
      aiEngine = aiEngine || 'ComfyUI'
      if (!aiPrompt && wf.positive) aiPrompt = wf.positive
      if (!aiModel && wf.model) aiModel = wf.model
      aiRawWorkflow = wf.rawPretty || comfyWorkflowRaw
    }
  }

  // 2. Fallback / Automatic1111 / Forge / NovelAI / UserComment parser
  const a1111Source =
    rawParams || (userComment && (userComment.includes('Steps:') || userComment.includes('Seed:')) ? userComment : '')

  if (a1111Source && !aiPrompt) {
    if (a1111Source.trim().startsWith('{')) {
      const parsedJson = parseComfyPromptGraph(a1111Source)
      if (parsedJson) {
        aiEngine = 'ComfyUI / JSON'
        aiPrompt = parsedJson.positive || a1111Source
        aiNeg = parsedJson.negative || ''
        aiRawWorkflow = parsedJson.rawPretty || a1111Source
      } else {
        aiPrompt = a1111Source
      }
    } else {
      aiEngine = a1111Source.includes('Steps:') ? 'Automatic1111 / Forge' : 'Embedded Text Chunk'
      const negIdx = a1111Source.search(/Negative prompt:/i)
      const stepsIdx = a1111Source.search(/Steps:/i)
      if (negIdx > 0) {
        aiPrompt = a1111Source.slice(0, negIdx).trim()
      } else if (stepsIdx > 0) {
        aiPrompt = a1111Source.slice(0, stepsIdx).trim()
      } else {
        aiPrompt = a1111Source.trim()
      }

      const negMatch = a1111Source.match(/Negative prompt:\s*([\s\S]+?)(?=Steps:|$)/i)
      if (negMatch?.[1]) aiNeg = negMatch[1].trim()

      const stepsMatch = a1111Source.match(/Steps:\s*(\d+)/i)
      if (stepsMatch?.[1]) aiSteps = stepsMatch[1]

      const samplerMatch = a1111Source.match(/Sampler:\s*([^,\n]+)/i)
      if (samplerMatch?.[1]) aiSampler = samplerMatch[1].trim()

      const schedMatch = a1111Source.match(/Schedule type:\s*([^,\n]+)/i)
      if (schedMatch?.[1]) aiScheduler = schedMatch[1].trim()

      const cfgMatch = a1111Source.match(/CFG scale:\s*([\d.]+)/i)
      if (cfgMatch?.[1]) aiCfg = cfgMatch[1]

      const seedMatch = a1111Source.match(/Seed:\s*(\d+)/i)
      if (seedMatch?.[1]) aiSeed = seedMatch[1]

      const modelMatch = a1111Source.match(/Model:\s*([^,\n]+)/i)
      if (modelMatch?.[1]) aiModel = modelMatch[1].trim()
    }
  }

  const isPostProcessed = Boolean(
    software &&
      /Adobe|Photoshop|Lightroom|GIMP|Snapseed|Darktable|Capture One|Luminar|Canva|Affinity|Pixelmator|PicsArt|WhatsApp|Instagram/i.test(
        software
      )
  )

  return {
    software,
    artist,
    copyright,
    aiPrompt: aiPrompt || undefined,
    aiNegativePrompt: aiNeg || undefined,
    aiRawWorkflow: aiRawWorkflow || undefined,
    aiEngine: aiEngine || undefined,
    aiModel: aiModel || undefined,
    aiSeed: aiSeed || undefined,
    aiSampler: aiSampler || undefined,
    aiScheduler: aiScheduler || undefined,
    aiSteps: aiSteps || undefined,
    aiCfg: aiCfg || undefined,
    hasAiData: Boolean(aiPrompt || aiRawWorkflow),
    isPostProcessed
  }
}

export function analyzeAiProvenance(
  buffer: ArrayBuffer,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tags: any,
  camera: CameraInfo,
  technical: TechnicalInfo,
  softwareAi: SoftwareAiInfo
): AiProvenance {
  const scanLimit = Math.min(buffer.byteLength, 4 * 1024 * 1024)
  const headerBytes = new Uint8Array(buffer.slice(0, scanLimit))
  const headerLatin1 = new TextDecoder('latin1').decode(headerBytes)

  let trailerLatin1 = ''
  if (buffer.byteLength > scanLimit) {
    const trailerOffset = Math.max(0, buffer.byteLength - 512 * 1024)
    const trailerBytes = new Uint8Array(buffer.slice(trailerOffset))
    trailerLatin1 = new TextDecoder('latin1').decode(trailerBytes)
  }
  const rawBufferText = headerLatin1 + ' ' + trailerLatin1

  const iptcCredit = String(tags.iptc?.['Credit']?.description || tags.xmp?.['Credit']?.description || '')
  const digitalSourceType = String(
    tags.iptc?.['Digital Source Type']?.description ||
      tags.xmp?.['DigitalSourceType']?.description ||
      tags.xmp?.['Iptc4xmpExt:DigitalSourceType']?.description ||
      ''
  )
  const creatorTool = String(tags.xmp?.['CreatorTool']?.description || '')
  const xmpRaw = String(tags.xmp?._raw || '')
  const softwareTag = softwareAi.software || ''
  const pngText = (tags.pngText || tags.png || {}) as Record<string, { description?: string; value?: string }>
  const textualChunks = [
    softwareTag,
    creatorTool,
    iptcCredit,
    xmpRaw,
    pngText['Description']?.description || '',
    pngText['Comment']?.description || '',
    pngText['Software']?.description || '',
    pngText['Author']?.description || ''
  ].join(' ')

  const traces: AiTrace[] = []

  // A. C2PA / CAI Manifest
  const c2paFound =
    rawBufferText.includes('urn:c2pa:') ||
    rawBufferText.includes('c2pa.assertions') ||
    rawBufferText.includes('c2pa.claim') ||
    rawBufferText.includes('claim_generator') ||
    rawBufferText.includes('c2pa.action')

  if (c2paFound) {
    traces.push({
      label: 'C2PA Content Credentials Manifest',
      description: 'Embedded Coalition for Content Provenance and Authenticity (C2PA) cryptographic manifest.',
      category: 'C2PA'
    })
  }

  // B. IPTC Digital Source Type
  const hasTrainedMedia =
    digitalSourceType.includes('trainedAlgorithmicMedia') || rawBufferText.includes('trainedAlgorithmicMedia')
  const hasCompositeAi =
    digitalSourceType.includes('compositeWithTrainedAlgorithmicMedia') ||
    rawBufferText.includes('compositeWithTrainedAlgorithmicMedia')

  if (hasTrainedMedia) {
    traces.push({
      label: 'IPTC: trainedAlgorithmicMedia',
      description: 'Official IPTC marker indicating full generative AI synthesis.',
      category: 'IPTC'
    })
  }
  if (hasCompositeAi) {
    traces.push({
      label: 'IPTC: compositeWithTrainedAlgorithmicMedia',
      description: 'IPTC marker indicating real image edited or composited with generative AI tools.',
      category: 'IPTC'
    })
  }

  // C. OpenAI / ChatGPT (DALL-E 3 / GPT Image)
  const hasOpenAi =
    /DALL[\u00B7.-]E/i.test(textualChunks) ||
    /ChatGPT/i.test(textualChunks) ||
    /DALL[\u00B7.-]E/i.test(rawBufferText) ||
    /GPT-4o|GPT Image/i.test(rawBufferText) ||
    (c2paFound && (/OpenAI/i.test(rawBufferText) || /openai\.com/i.test(rawBufferText)))

  if (hasOpenAi) {
    traces.push({
      label: 'OpenAI Generative Signature',
      description: 'C2PA claim or metadata signatures match OpenAI ChatGPT / DALL-E / GPT Image.',
      category: 'C2PA'
    })
  }

  // D. Google Gemini / Imagen / SynthID
  const hasGoogleCredit = /Made with Google AI/i.test(iptcCredit) || /Made with Google AI/i.test(rawBufferText)
  const hasGoogleImagen = /Google Imagen|Google AI/i.test(textualChunks) || /Google Imagen/i.test(rawBufferText)
  const hasSynthId = /SynthID/i.test(rawBufferText)
  const hasGoogleTrust =
    c2paFound && (/Google LLC|pki\.goog|Google Trust Services/i.test(rawBufferText))

  if (hasGoogleCredit) {
    traces.push({
      label: 'IPTC Credit: "Made with Google AI"',
      description: 'Google provenance credit badge embedded in IPTC/XMP metadata.',
      category: 'IPTC'
    })
  }
  if (hasGoogleImagen) {
    traces.push({
      label: 'Creator Tool: Google Imagen / Gemini',
      description: 'Generation metadata identifies Google Gemini / Imagen imaging pipeline.',
      category: 'EXIF'
    })
  }
  if (hasSynthId) {
    traces.push({
      label: 'SynthID Digital Watermark Marker',
      description: 'Google DeepMind SynthID provenance metadata marker detected.',
      category: 'WATERMARK'
    })
  }
  if (hasGoogleTrust) {
    traces.push({
      label: 'Google Trust Services C2PA Anchor',
      description: 'C2PA cryptographic manifest signed by Google LLC Certificate Authority.',
      category: 'C2PA'
    })
  }
  const isGoogleGemini = hasGoogleCredit || hasGoogleImagen || hasSynthId || hasGoogleTrust

  // E. Adobe Firefly / Photoshop Generative Fill
  const hasAdobeFirefly =
    /Adobe Firefly/i.test(textualChunks) ||
    /Adobe Firefly/i.test(rawBufferText) ||
    (c2paFound && /adobe\.com|Adobe Inc/i.test(rawBufferText) && (hasTrainedMedia || hasCompositeAi))

  if (hasAdobeFirefly) {
    traces.push({
      label: hasCompositeAi ? 'Adobe Photoshop Generative Edit' : 'Adobe Firefly Generative AI',
      description: hasCompositeAi
        ? 'Adobe C2PA manifest reports real photography modified with Generative Fill / AI tools.'
        : 'Adobe C2PA credentials identify synthetic Firefly generation.',
      category: 'C2PA'
    })
  }

  // F. Grok (xAI) / Meta AI / Ideogram
  const hasGrok = /xAI|Grok|Aurora/i.test(textualChunks) || (c2paFound && /x\.ai/i.test(rawBufferText))
  const hasMetaAi = /Meta AI|Imagine with Meta/i.test(textualChunks) || /Meta AI/i.test(rawBufferText)
  const hasIdeogram = /Ideogram/i.test(textualChunks) || /ideogram\.ai/i.test(rawBufferText)

  if (hasGrok) {
    traces.push({ label: 'xAI / Grok Signature', description: 'Metadata traces identify xAI Grok imaging.', category: 'EXIF' })
  }
  if (hasMetaAi) {
    traces.push({ label: 'Meta AI Provenance Marker', description: 'Metadata traces identify Meta AI generation.', category: 'IPTC' })
  }
  if (hasIdeogram) {
    traces.push({ label: 'Ideogram Generator Marker', description: 'Metadata identifies Ideogram generative engine.', category: 'CHUNK' })
  }

  // G. Midjourney (checked strictly in textual metadata chunks, not raw binary pixels!)
  const isMidjourney =
    /Midjourney/i.test(textualChunks) ||
    (/--v\s+[1-7](\.\d+)?\b/i.test(textualChunks) && /--ar\s+\d+:\d+|--stylize|--niji/i.test(textualChunks)) ||
    /--niji\s+[456]/i.test(textualChunks)

  if (isMidjourney && !hasOpenAi && !isGoogleGemini) {
    traces.push({
      label: 'Midjourney Prompt & Engine Chunk',
      description: 'Textual metadata contains Midjourney flags or generator attribution.',
      category: 'CHUNK'
    })
  }

  // H. Stable Diffusion / ComfyUI / Flux
  const isStableDiffusion =
    softwareAi.hasAiData ||
    /Black Forest Labs|FLUX\.1|NovelAI|InvokeAI|Automatic1111|ComfyUI/i.test(textualChunks)

  if (isStableDiffusion && !hasOpenAi && !isGoogleGemini && !isMidjourney) {
    traces.push({
      label: `${softwareAi.aiEngine || 'Stable Diffusion / ComfyUI'} Parameters`,
      description: 'Embedded generation prompts, sampler parameters, or node workflow JSON detected.',
      category: 'CHUNK'
    })
  }

  const hasCameraHardware = Boolean(
    camera.make && (camera.model || camera.fNumber || camera.iso || camera.exposureTime)
  )

  if (hasOpenAi) {
    return {
      isAi: true,
      platform: 'chatgpt',
      platformName: 'ChatGPT (OpenAI Image)',
      platformIcon: '🤖',
      confidence: 'HIGH',
      confidencePercent: 99,
      summary: 'Contains verified metadata / C2PA credentials originating from OpenAI generative models.',
      digitalSourceType: hasTrainedMedia ? 'trainedAlgorithmicMedia (IPTC)' : undefined,
      c2paManifestFound: c2paFound,
      detectedTraces: traces
    }
  }
  if (isGoogleGemini) {
    return {
      isAi: true,
      platform: 'gemini',
      platformName: 'Google Gemini (Imagen)',
      platformIcon: '✨',
      confidence: 'HIGH',
      confidencePercent: 99,
      summary: 'Contains verified Google provenance attribution, SynthID, or Google Trust Services C2PA anchor.',
      digitalSourceType: hasTrainedMedia ? 'trainedAlgorithmicMedia (IPTC)' : undefined,
      c2paManifestFound: c2paFound,
      detectedTraces: traces
    }
  }
  if (hasAdobeFirefly) {
    return {
      isAi: true,
      platform: 'firefly',
      platformName: hasCompositeAi ? 'Adobe AI-Edited Photo' : 'Adobe Firefly',
      platformIcon: '🔥',
      confidence: hasCompositeAi && hasCameraHardware ? 'AI_EDITED' : 'HIGH',
      confidencePercent: 97,
      summary: hasCompositeAi
        ? 'Camera photo modified using Adobe generative AI compositing / Generative Fill.'
        : 'Synthetically generated by Adobe Firefly with C2PA Content Credentials.',
      digitalSourceType: hasCompositeAi ? 'compositeWithTrainedAlgorithmicMedia' : 'trainedAlgorithmicMedia',
      c2paManifestFound: c2paFound,
      detectedTraces: traces
    }
  }
  if (hasGrok || hasMetaAi || hasIdeogram) {
    return {
      isAi: true,
      platform: hasGrok ? 'grok' : hasMetaAi ? 'meta' : 'ideogram',
      platformName: hasGrok ? 'Grok (xAI)' : hasMetaAi ? 'Meta AI' : 'Ideogram AI',
      platformIcon: '⚡',
      confidence: 'HIGH',
      confidencePercent: 95,
      summary: 'Contains explicit platform attribution markers for generative AI synthesis.',
      digitalSourceType: hasTrainedMedia ? 'trainedAlgorithmicMedia' : undefined,
      c2paManifestFound: c2paFound,
      detectedTraces: traces
    }
  }
  if (isMidjourney) {
    return {
      isAi: true,
      platform: 'midjourney',
      platformName: 'Midjourney',
      platformIcon: '🎨',
      confidence: 'HIGH',
      confidencePercent: 98,
      summary: 'Metadata chunks match Midjourney prompt parameters and generator signature.',
      digitalSourceType: hasTrainedMedia ? 'trainedAlgorithmicMedia' : undefined,
      c2paManifestFound: c2paFound,
      detectedTraces: traces
    }
  }
  if (isStableDiffusion) {
    return {
      isAi: true,
      platform: 'stablediffusion',
      platformName: softwareAi.aiEngine ? `Local AI (${softwareAi.aiEngine})` : 'Stable Diffusion / ComfyUI / Flux',
      platformIcon: '🧠',
      confidence: 'HIGH',
      confidencePercent: 99,
      summary: 'Embedded generation prompts, sampler settings, or node workflow chunks found in file.',
      digitalSourceType: hasTrainedMedia ? 'trainedAlgorithmicMedia' : undefined,
      c2paManifestFound: c2paFound,
      detectedTraces: traces
    }
  }
  if (hasTrainedMedia || hasCompositeAi || c2paFound) {
    return {
      isAi: true,
      platform: 'c2pa_generic',
      platformName: hasCompositeAi ? 'AI-Composited Media (C2PA)' : 'C2PA Certified Generative AI',
      platformIcon: '🛡️',
      confidence: hasCompositeAi ? 'AI_EDITED' : 'HIGH',
      confidencePercent: 95,
      summary: 'Complies with C2PA/IPTC provenance standards for AI-generated or AI-composited content.',
      digitalSourceType: hasCompositeAi ? 'compositeWithTrainedAlgorithmicMedia' : 'trainedAlgorithmicMedia',
      c2paManifestFound: c2paFound,
      detectedTraces: traces
    }
  }
  if (hasCameraHardware) {
    const edited = Boolean(softwareAi.isPostProcessed || technical.dimensionMismatch)
    return {
      isAi: false,
      platform: 'none',
      platformName: edited ? 'Camera Capture (Post-Processed)' : 'Authentic Camera Capture',
      platformIcon: edited ? '🖌️' : '📸',
      confidence: edited ? 'CAMERA_EDITED' : 'AUTHENTIC_CAMERA',
      confidencePercent: edited ? 82 : 98,
      summary: edited
        ? `Hardware EXIF (${camera.make} ${camera.model || ''}) present, but ${
            technical.dimensionMismatch
              ? 'pixel dimensions differ from EXIF metadata (cropped/resized)'
              : `software tag indicates editing (${softwareAi.software})`
          }.`
        : `Captured by optical sensor hardware: ${camera.make} ${camera.model || ''}. Authentic exposure and lens parameters detected.`,
      c2paManifestFound: false,
      detectedTraces: []
    }
  }

  return {
    isAi: false,
    platform: 'none',
    platformName: 'No Provenance Metadata',
    platformIcon: 'ℹ️',
    confidence: 'INCONCLUSIVE',
    confidencePercent: 0,
    summary:
      'No camera hardware EXIF or AI provenance tags found. Messaging apps & social networks (WhatsApp, X, Instagram) strip metadata automatically.',
    c2paManifestFound: false,
    detectedTraces: []
  }
}

export function computePrivacyAudit(
  camera: CameraInfo,
  gps: GpsInfo,
  softwareAi: SoftwareAiInfo,
  hasThumbnail: boolean,
  rawTagCount: number
): PrivacyAudit {
  const findings: PrivacyFinding[] = []
  let score = 0

  if (gps.hasGps) {
    score += 40
    findings.push({
      id: 'gps',
      severity: 'high',
      title: 'Exact GPS Coordinates Exposed',
      detail: `${gps.latitude?.toFixed(5)}°, ${gps.longitude?.toFixed(5)}° pinpoints exact capture location.`
    })
  }

  if (camera.bodySerial || camera.lensSerial) {
    score += 22
    findings.push({
      id: 'serial',
      severity: 'high',
      title: 'Hardware Serial Number Found',
      detail: `Unique hardware ID (${camera.bodySerial || camera.lensSerial}) can link photos to your device.`
    })
  }

  if (hasThumbnail) {
    score += 16
    findings.push({
      id: 'thumb',
      severity: 'medium',
      title: 'Embedded EXIF Thumbnail Present',
      detail: 'Hidden preview inside EXIF may reveal the uncropped original frame before edits.'
    })
  }

  if (camera.dateTaken) {
    score += 10
    findings.push({
      id: 'date',
      severity: 'low',
      title: 'Exact Capture Timestamp',
      detail: `Date/time recorded: ${camera.dateTaken}`
    })
  }

  if (softwareAi.artist || softwareAi.copyright) {
    score += 12
    findings.push({
      id: 'author',
      severity: 'medium',
      title: 'Author / Copyright Identity',
      detail: `${softwareAi.artist || softwareAi.copyright}`
    })
  }

  if (camera.make || camera.model || softwareAi.software || softwareAi.hasAiData) {
    score += 8
    findings.push({
      id: 'device',
      severity: 'low',
      title: 'Device / Software Fingerprint',
      detail: `${[camera.make, camera.model, softwareAi.software].filter(Boolean).join(' • ') || 'Embedded AI/Chunk Data'}`
    })
  }

  score = Math.min(100, score)

  let riskLevel: PrivacyAudit['riskLevel'] = 'CLEAN'
  let summary = 'Zero sensitive personal or hardware metadata detected. Safe to share.'

  if (score >= 40) {
    riskLevel = 'HIGH'
    summary = `High privacy exposure (${rawTagCount} tags). Location or device identifiers are embedded.`
  } else if (score >= 18) {
    riskLevel = 'MEDIUM'
    summary = `Moderate metadata footprint (${rawTagCount} tags). Consider sanitizing before public sharing.`
  } else if (score > 0) {
    riskLevel = 'LOW'
    summary = `Minimal technical metadata (${rawTagCount} tags) with no GPS coordinates.`
  }

  return { riskLevel, score, summary, findings }
}
