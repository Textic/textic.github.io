export type ThemeName = 'crimson' | 'cyber' | 'matrix' | 'synthwave' | 'amber' | 'night' | 'day'
export type ScreenMode = 'matrix' | 'terminal' | 'textools' | 'stats' | 'eq' | 'off'
export type SideScreenMode = 'code' | 'logs' | 'git' | 'off'
export type CameraPreset = 'isometric' | 'desk' | 'pc' | 'arcade' | 'server' | 'window'
export type HologramMode = 'orbit' | 'helix' | 'pulse' | 'off'
export type WeatherMode = 'neon_night' | 'cyber_rain' | 'sunset_grid' | 'blinds_closed'
export type ArcadeGameMode = 'invaders' | 'snake' | 'tetris' | 'attract' | 'off'
export type DeviceTarget = 'pc' | 'arcade' | 'room' | 'server_rack' | 'desk_lamp' | 'holo_core' | 'speakers'
export type ScenePresetName = 'coding' | 'overclock' | 'arcade_night' | 'stealth' | 'daylight'

export interface McpToolProperty {
  type: string
  description: string
  enum?: string[]
}

export interface McpTool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, McpToolProperty>
    required: string[]
  }
}

export interface RoomState {
  lightsOn: boolean
  currentTheme: ThemeName
  lightColor: string
  lightIntensity: number
  rgbCycle: boolean
  pcOn: boolean
  arcadeOn: boolean
  arcadeMode: ArcadeGameMode
  serverRackOn: boolean
  deskLampOn: boolean
  speakersOn: boolean
  screenMode: ScreenMode
  sideScreenMode: SideScreenMode
  cameraPreset: CameraPreset
  autoOrbit: boolean
  isOverclocked: boolean
  fanSpeedMultiplier: number
  deskHeight: number // 0.0 (Sit: 74cm) to 1.0 (Stand: 118cm)
  keyboardRgb: boolean
  hologramMode: HologramMode
  weatherMode: WeatherMode
  chairSpin: boolean
}

export interface ThemeConfig {
  label: string
  hex: number
  css: string
  ceilingHex: number
  dirIntensity: number
  hemiIntensity: number
  bgHex: number
}

export const THEME_CONFIGS: Record<ThemeName, ThemeConfig> = {
  crimson: {
    label: 'Crimson',
    hex: 0xff1e42,
    css: '#ff1e42',
    ceilingHex: 0xfff0f5,
    dirIntensity: 2.0,
    hemiIntensity: 1.25,
    bgHex: 0x0c1017
  },
  cyber: {
    label: 'Cyber Cyan',
    hex: 0x00f0ff,
    css: '#00f0ff',
    ceilingHex: 0xe0faff,
    dirIntensity: 2.0,
    hemiIntensity: 1.3,
    bgHex: 0x09111c
  },
  matrix: {
    label: 'Matrix Green',
    hex: 0x00ff66,
    css: '#00ff66',
    ceilingHex: 0xe6fff0,
    dirIntensity: 1.85,
    hemiIntensity: 1.15,
    bgHex: 0x08130d
  },
  synthwave: {
    label: 'Synthwave',
    hex: 0xd946ef,
    css: '#d946ef',
    ceilingHex: 0xfce7f3,
    dirIntensity: 1.9,
    hemiIntensity: 1.2,
    bgHex: 0x120a1c
  },
  amber: {
    label: 'Amber Focus',
    hex: 0xf59e0b,
    css: '#f59e0b',
    ceilingHex: 0xfffbeb,
    dirIntensity: 2.1,
    hemiIntensity: 1.25,
    bgHex: 0x110e09
  },
  night: {
    label: 'Night Mood',
    hex: 0x3b82f6,
    css: '#3b82f6',
    ceilingHex: 0x93c5fd,
    dirIntensity: 0.45,
    hemiIntensity: 0.35,
    bgHex: 0x060911
  },
  day: {
    label: 'Daylight',
    hex: 0xffe4c4,
    css: '#ffe4c4',
    ceilingHex: 0xffffff,
    dirIntensity: 2.8,
    hemiIntensity: 1.65,
    bgHex: 0x131926
  }
}

export interface ToolCallInstruction {
  name: string
  args: Record<string, unknown>
}

export interface ScenePresetDef {
  id: ScenePresetName
  label: string
  icon: string
  calls: ToolCallInstruction[]
}

export const SCENE_PRESETS: ScenePresetDef[] = [
  {
    id: 'coding',
    label: 'Deep Coding',
    icon: '💻',
    calls: [
      { name: 'set_ambient_lighting', args: { theme: 'cyber', intensity: 1.5, rgbCycle: false } },
      { name: 'power_device', args: { target: 'pc', state: true } },
      { name: 'power_device', args: { target: 'desk_lamp', state: true } },
      { name: 'set_screen_mode', args: { mode: 'terminal', sideMode: 'code' } },
      { name: 'set_hologram_mode', args: { mode: 'orbit' } },
      { name: 'set_window_weather', args: { weather: 'cyber_rain' } },
      { name: 'overclock_system', args: { enabled: false } }
    ]
  },
  {
    id: 'overclock',
    label: 'Overclock Stress',
    icon: '🔥',
    calls: [
      { name: 'overclock_system', args: { enabled: true } },
      { name: 'set_screen_mode', args: { mode: 'stats', sideMode: 'logs' } },
      { name: 'set_hologram_mode', args: { mode: 'pulse' } },
      { name: 'power_device', args: { target: 'server_rack', state: true } },
      { name: 'set_camera_view', args: { preset: 'pc' } }
    ]
  },
  {
    id: 'arcade_night',
    label: 'Arcade Night',
    icon: '🕹️',
    calls: [
      { name: 'set_ambient_lighting', args: { theme: 'synthwave', intensity: 1.6, rgbCycle: true } },
      { name: 'power_device', args: { target: 'arcade', state: true } },
      { name: 'play_arcade_game', args: { game: 'invaders' } },
      { name: 'set_screen_mode', args: { mode: 'eq', sideMode: 'git' } },
      { name: 'set_window_weather', args: { weather: 'sunset_grid' } },
      { name: 'set_camera_view', args: { preset: 'arcade' } }
    ]
  },
  {
    id: 'stealth',
    label: 'Stealth Dark',
    icon: '🌙',
    calls: [
      { name: 'set_ambient_lighting', args: { theme: 'night', intensity: 0.25, rgbCycle: false } },
      { name: 'power_device', args: { target: 'desk_lamp', state: false } },
      { name: 'set_screen_mode', args: { mode: 'matrix', sideMode: 'code' } },
      { name: 'set_hologram_mode', args: { mode: 'helix' } },
      { name: 'set_window_weather', args: { weather: 'neon_night' } },
      { name: 'overclock_system', args: { enabled: false } }
    ]
  },
  {
    id: 'daylight',
    label: 'Daylight Studio',
    icon: '☀️',
    calls: [
      { name: 'set_ambient_lighting', args: { theme: 'day', intensity: 2.2, rgbCycle: false } },
      { name: 'power_device', args: { target: 'room', state: true } },
      { name: 'power_device', args: { target: 'desk_lamp', state: true } },
      { name: 'set_screen_mode', args: { mode: 'textools', sideMode: 'git' } },
      { name: 'control_desk_setup', args: { posture: 'stand' } },
      { name: 'set_window_weather', args: { weather: 'sunset_grid' } }
    ]
  }
]

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'set_ambient_lighting',
    description: 'Adjust room lighting theme, hex color, intensity (0.0-3.0), and RGB cycle mode.',
    parameters: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description: 'Lighting theme preset',
          enum: ['crimson', 'cyber', 'matrix', 'synthwave', 'amber', 'night', 'day']
        },
        color: { type: 'string', description: 'Optional custom hex color (e.g. #ff1e42)' },
        intensity: { type: 'number', description: 'Light intensity multiplier from 0.0 to 3.0' },
        rgbCycle: { type: 'boolean', description: 'Animate smooth rainbow RGB cycle across room accents' }
      },
      required: ['theme']
    }
  },
  {
    name: 'power_device',
    description: 'Toggle power on room devices: PC, Arcade, Room Lights, Server Rack, Desk Lamp, Holo-Core, or Speakers.',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Target hardware device',
          enum: ['pc', 'arcade', 'room', 'server_rack', 'desk_lamp', 'holo_core', 'speakers']
        },
        state: { type: 'boolean', description: 'True for ON, false for OFF' }
      },
      required: ['target', 'state']
    }
  },
  {
    name: 'set_screen_mode',
    description: 'Set output mode for the ultrawide curved main monitor and vertical coding monitor.',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          description: 'Primary curved ultrawide monitor mode',
          enum: ['matrix', 'terminal', 'textools', 'stats', 'eq', 'off']
        },
        sideMode: {
          type: 'string',
          description: 'Secondary vertical coding monitor mode',
          enum: ['code', 'logs', 'git', 'off']
        }
      },
      required: ['mode']
    }
  },
  {
    name: 'set_camera_view',
    description: 'Smoothly transition the camera to an inspection preset or toggle automatic orbit.',
    parameters: {
      type: 'object',
      properties: {
        preset: {
          type: 'string',
          description: 'Camera preset angle',
          enum: ['isometric', 'desk', 'pc', 'arcade', 'server', 'window']
        },
        autoOrbit: { type: 'boolean', description: 'Enable or disable automatic 360-degree camera orbit' }
      },
      required: ['preset']
    }
  },
  {
    name: 'overclock_system',
    description: 'Engage extreme PC overclocking, accelerating cooling fans and pulsing crimson hardware RGB.',
    parameters: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'Enable or disable overclock mode' }
      },
      required: ['enabled']
    }
  },
  {
    name: 'control_desk_setup',
    description: 'Adjust motorized standing desk height (sit/stand or 0.0-1.0) and toggle keyboard RGB wave.',
    parameters: {
      type: 'object',
      properties: {
        posture: { type: 'string', description: 'Desk posture preset', enum: ['sit', 'mid', 'stand'] },
        height: { type: 'number', description: 'Normalized height between 0.0 (74cm) and 1.0 (118cm)' },
        keyboardRgb: { type: 'boolean', description: 'Enable or disable mechanical keyboard RGB backlight' }
      },
      required: []
    }
  },
  {
    name: 'set_hologram_mode',
    description: 'Configure the 3D holographic AI Core emitter animation on the workstation desk.',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          description: 'Hologram visual pattern',
          enum: ['orbit', 'helix', 'pulse', 'off']
        }
      },
      required: ['mode']
    }
  },
  {
    name: 'set_window_weather',
    description: 'Change the cyberpunk city skyline atmosphere and weather outside the room window.',
    parameters: {
      type: 'object',
      properties: {
        weather: {
          type: 'string',
          description: 'City skyline weather condition',
          enum: ['neon_night', 'cyber_rain', 'sunset_grid', 'blinds_closed']
        }
      },
      required: ['weather']
    }
  },
  {
    name: 'play_arcade_game',
    description: 'Switch the active retro game running on the arcade cabinet CRT display.',
    parameters: {
      type: 'object',
      properties: {
        game: {
          type: 'string',
          description: 'Arcade CRT cartridge mode',
          enum: ['invaders', 'snake', 'tetris', 'attract', 'off']
        }
      },
      required: ['game']
    }
  },
  {
    name: 'apply_scene_preset',
    description: 'Apply a coordinated multi-device battlestation environment preset.',
    parameters: {
      type: 'object',
      properties: {
        preset: {
          type: 'string',
          description: 'Preconfigured environment preset',
          enum: ['coding', 'overclock', 'arcade_night', 'stealth', 'daylight']
        },
        chairSpin: { type: 'boolean', description: 'Optional chair gentle swivel animation' }
      },
      required: ['preset']
    }
  }
]

const includesAny = (query: string, keywords: string[]): boolean => {
  return keywords.some(kw => query.includes(kw))
}

/**
 * Bilingual (EN / ES) multi-intent interpreter translating natural language prompts
 * into structured WebMCP tool call sequences.
 */
export function interpretNaturalLanguagePrompt(rawQuery: string): ToolCallInstruction[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return []

  const calls: ToolCallInstruction[] = []

  // Presets check
  if (includesAny(query, ['coding mode', 'modo coding', 'modo programar', 'deep work'])) {
    calls.push({ name: 'apply_scene_preset', args: { preset: 'coding' } })
    return calls
  }
  if (includesAny(query, ['arcade night', 'noche arcade', 'retro party', 'fiesta retro'])) {
    calls.push({ name: 'apply_scene_preset', args: { preset: 'arcade_night' } })
    return calls
  }
  if (includesAny(query, ['stealth', 'sigilo', 'modo oscuro'])) {
    calls.push({ name: 'apply_scene_preset', args: { preset: 'stealth' } })
    return calls
  }
  if (includesAny(query, ['daylight', 'luz de dia', 'luz natural', 'modo dia'])) {
    calls.push({ name: 'apply_scene_preset', args: { preset: 'daylight' } })
    return calls
  }

  // 1. Lights ON/OFF
  const wantsLightsOff = includesAny(query, [
    'turn off light', 'lights off', 'light off', 'switch off light', 'dark',
    'apaga la luz', 'apagar la luz', 'apaga las luces', 'apagar las luces',
    'apaga luz', 'apagar luz', 'sin luz', 'noche', 'night'
  ])
  const wantsLightsOn = !wantsLightsOff && includesAny(query, [
    'turn on light', 'lights on', 'light on', 'switch on light',
    'prende la luz', 'prender la luz', 'prende las luces', 'prender las luces',
    'enciende la luz', 'encender la luz', 'enciende las luces', 'encender las luces', 'day', 'dia'
  ])

  if (wantsLightsOff) {
    calls.push({ name: 'set_ambient_lighting', args: { theme: 'night', intensity: 0.2 } })
  } else if (wantsLightsOn) {
    calls.push({ name: 'set_ambient_lighting', args: { theme: 'crimson', intensity: 1.8 } })
  }

  // 2. Rainbow / RGB Cycle
  if (includesAny(query, ['rainbow', 'arcoiris', 'rgb cycle', 'ciclo rgb', 'party', 'fiesta'])) {
    calls.push({ name: 'set_ambient_lighting', args: { theme: 'synthwave', intensity: 1.8, rgbCycle: true } })
  }

  // 3. Specific Color Themes
  if (!wantsLightsOff) {
    if (includesAny(query, ['crimson', 'red', 'rojo', 'rojas', 'carmesi'])) {
      calls.push({ name: 'set_ambient_lighting', args: { theme: 'crimson', color: '#ff1e42', intensity: 1.8, rgbCycle: false } })
    } else if (includesAny(query, ['cyan', 'cyber', 'blue', 'azul', 'celeste'])) {
      calls.push({ name: 'set_ambient_lighting', args: { theme: 'cyber', color: '#00f0ff', intensity: 1.8, rgbCycle: false } })
    } else if (includesAny(query, ['green', 'verde'])) {
      calls.push({ name: 'set_ambient_lighting', args: { theme: 'matrix', color: '#00ff66', intensity: 1.7, rgbCycle: false } })
    } else if (includesAny(query, ['purple', 'violet', 'synthwave', 'morado', 'violeta', 'pink', 'rosa'])) {
      calls.push({ name: 'set_ambient_lighting', args: { theme: 'synthwave', color: '#d946ef', intensity: 1.8, rgbCycle: false } })
    } else if (includesAny(query, ['amber', 'orange', 'gold', 'naranja', 'dorado', 'ambar', 'warm', 'calido'])) {
      calls.push({ name: 'set_ambient_lighting', args: { theme: 'amber', color: '#f59e0b', intensity: 1.7, rgbCycle: false } })
    }
  }

  // 4. Screen / PC Power
  const wantsScreenOff = includesAny(query, [
    'turn off screen', 'screen off', 'display off', 'turn off monitor', 'monitor off',
    'turn off pc', 'power off pc', 'pc off', 'shutdown',
    'apaga la pantalla', 'apagar la pantalla', 'apaga pantalla', 'apagar pantalla',
    'apaga el monitor', 'apagar el monitor', 'apaga el pc', 'apagar el pc',
    'apaga pc', 'apagar pc', 'apaga el computador', 'apagar el computador'
  ])
  const wantsScreenOn = !wantsScreenOff && includesAny(query, [
    'turn on screen', 'screen on', 'turn on pc', 'power on pc', 'boot pc', 'start pc', 'pc on',
    'prende la pantalla', 'prender la pantalla', 'enciende la pantalla', 'encender la pantalla',
    'prende el pc', 'prender el pc', 'enciende el pc', 'encender el pc', 'iniciar pc'
  ])

  if (wantsScreenOff) {
    calls.push({ name: 'power_device', args: { target: 'pc', state: false } })
    calls.push({ name: 'set_screen_mode', args: { mode: 'off', sideMode: 'off' } })
  } else if (wantsScreenOn) {
    calls.push({ name: 'power_device', args: { target: 'pc', state: true } })
    calls.push({ name: 'set_screen_mode', args: { mode: 'matrix', sideMode: 'code' } })
  }

  // 5. Screen Modes
  if (!wantsScreenOff) {
    if (includesAny(query, ['matrix', 'rain', 'lluvia'])) {
      calls.push({ name: 'set_screen_mode', args: { mode: 'matrix' } })
    } else if (includesAny(query, ['terminal', 'console', 'consola'])) {
      calls.push({ name: 'set_screen_mode', args: { mode: 'terminal' } })
    } else if (includesAny(query, ['stats', 'telemetry', 'cpu', 'gpu', 'benchmark', 'estadisticas'])) {
      calls.push({ name: 'set_screen_mode', args: { mode: 'stats', sideMode: 'logs' } })
    } else if (includesAny(query, ['music', 'equalizer', 'audio', 'eq', 'spectrum', 'musica', 'ecualizador'])) {
      calls.push({ name: 'set_screen_mode', args: { mode: 'eq' } })
    } else if (includesAny(query, ['logo', 'textools'])) {
      calls.push({ name: 'set_screen_mode', args: { mode: 'textools' } })
    }
  }

  // 6. Standing Desk Height
  if (includesAny(query, ['stand up', 'standing', 'raise desk', 'sube el escritorio', 'subir escritorio', 'de pie', 'parado'])) {
    calls.push({ name: 'control_desk_setup', args: { posture: 'stand' } })
  } else if (includesAny(query, ['sit down', 'sitting', 'lower desk', 'baja el escritorio', 'bajar escritorio', 'sentado'])) {
    calls.push({ name: 'control_desk_setup', args: { posture: 'sit' } })
  }

  // 7. Hologram Core
  if (includesAny(query, ['holo off', 'turn off hologram', 'apaga holograma', 'apagar holograma'])) {
    calls.push({ name: 'set_hologram_mode', args: { mode: 'off' } })
  } else if (includesAny(query, ['helix', 'dna', 'helice'])) {
    calls.push({ name: 'set_hologram_mode', args: { mode: 'helix' } })
  } else if (includesAny(query, ['hologram', 'holo', 'reactor', 'core', 'holograma', 'nucleo'])) {
    calls.push({ name: 'set_hologram_mode', args: { mode: 'orbit' } })
  }

  // 8. City Window Weather
  if (includesAny(query, ['rain', 'storm', 'lluvia', 'tormenta'])) {
    calls.push({ name: 'set_window_weather', args: { weather: 'cyber_rain' } })
  } else if (includesAny(query, ['sunset', 'atardecer', 'synthwave city'])) {
    calls.push({ name: 'set_window_weather', args: { weather: 'sunset_grid' } })
  } else if (includesAny(query, ['close blinds', 'cerrar persianas', 'persianas'])) {
    calls.push({ name: 'set_window_weather', args: { weather: 'blinds_closed' } })
  }

  // 9. Desk Lamp
  if (includesAny(query, ['lamp off', 'apaga lampara', 'apagar lampara'])) {
    calls.push({ name: 'power_device', args: { target: 'desk_lamp', state: false } })
  } else if (includesAny(query, ['lamp on', 'lamp', 'prende lampara', 'enciende lampara', 'lampara'])) {
    calls.push({ name: 'power_device', args: { target: 'desk_lamp', state: true } })
  }

  // 10. Server Rack
  if (includesAny(query, ['server off', 'apaga servidor', 'apagar servidor'])) {
    calls.push({ name: 'power_device', args: { target: 'server_rack', state: false } })
  } else if (includesAny(query, ['server', 'rack', 'nas', 'homelab', 'servidor'])) {
    calls.push({ name: 'power_device', args: { target: 'server_rack', state: true } })
    calls.push({ name: 'set_camera_view', args: { preset: 'server' } })
  }

  // 11. Arcade Cabinet & Games
  if (includesAny(query, ['snake', 'culebra'])) {
    calls.push({ name: 'power_device', args: { target: 'arcade', state: true } })
    calls.push({ name: 'play_arcade_game', args: { game: 'snake' } })
    calls.push({ name: 'set_camera_view', args: { preset: 'arcade' } })
  } else if (includesAny(query, ['tetris', 'blocks', 'bloques'])) {
    calls.push({ name: 'power_device', args: { target: 'arcade', state: true } })
    calls.push({ name: 'play_arcade_game', args: { game: 'tetris' } })
    calls.push({ name: 'set_camera_view', args: { preset: 'arcade' } })
  } else if (includesAny(query, ['arcade', 'maquinita', 'fichines'])) {
    calls.push({ name: 'power_device', args: { target: 'arcade', state: true } })
    calls.push({ name: 'set_camera_view', args: { preset: 'arcade' } })
  }

  // 12. Camera Views
  if (includesAny(query, ['orbit', 'tour', 'showcase', 'girar', 'recorrido'])) {
    calls.push({ name: 'set_camera_view', args: { preset: 'isometric', autoOrbit: true } })
  } else if (includesAny(query, ['pc view', 'case', 'internals', 'gabinete', 'torre', 'gpu'])) {
    calls.push({ name: 'set_camera_view', args: { preset: 'pc', autoOrbit: false } })
  } else if (includesAny(query, ['window', 'city', 'ventana', 'ciudad'])) {
    calls.push({ name: 'set_camera_view', args: { preset: 'window', autoOrbit: false } })
  } else if (includesAny(query, ['desk', 'monitor', 'workstation', 'escritorio'])) {
    calls.push({ name: 'set_camera_view', args: { preset: 'desk', autoOrbit: false } })
  } else if (includesAny(query, ['room', 'isometric', 'overview', 'reset', 'general', 'habitacion', 'cuarto'])) {
    calls.push({ name: 'set_camera_view', args: { preset: 'isometric', autoOrbit: false } })
  }

  // 13. Overclock
  if (includesAny(query, ['normal', 'stock', 'cool down', 'enfriar', 'stop overclock'])) {
    calls.push({ name: 'overclock_system', args: { enabled: false } })
  } else if (includesAny(query, ['overclock', 'turbo', 'boost', 'sobrecarga', 'sobrecargar'])) {
    calls.push({ name: 'overclock_system', args: { enabled: true } })
  }

  // 14. Chair Spin
  if (includesAny(query, ['spin chair', 'girar silla', 'silla'])) {
    calls.push({ name: 'apply_scene_preset', args: { preset: 'coding', chairSpin: true } })
  }

  // Fallback
  if (calls.length === 0) {
    calls.push({ name: 'set_ambient_lighting', args: { theme: 'cyber', intensity: 1.8 } })
  }

  return calls
}
