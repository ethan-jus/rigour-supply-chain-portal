export const FONT_PRESETS = {
  system: {
    label: '系统默认（本机字体）',
    family:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    webFamily: '',
    localFamily: '',
  },
  noto: {
    label: '思源黑体 / Noto Sans（内置）',
    family: "'Noto Sans SC Variable', sans-serif",
    webFamily: 'Noto Sans SC Variable',
    localFamily: '',
  },
  serif: {
    label: '思源宋体 / Noto Serif（内置）',
    family: "'Noto Serif SC Variable', serif",
    webFamily: 'Noto Serif SC Variable',
    localFamily: '',
  },
  misans: {
    label: 'MiSans 小米黑体（内置）',
    family: "'MiSans', sans-serif",
    webFamily: 'MiSans',
    localFamily: '',
  },
  wenkai: {
    label: '霞鹜文楷（内置楷体）',
    family: "'LXGW WenKai', serif",
    webFamily: 'LXGW WenKai',
    localFamily: '',
  },
  yahei: {
    label: '微软雅黑',
    family: "'Microsoft YaHei', sans-serif",
    webFamily: '',
    localFamily: 'Microsoft YaHei',
  },
  simhei: {
    label: '黑体',
    family: "'SimHei', sans-serif",
    webFamily: '',
    localFamily: 'SimHei',
  },
  kaiti: {
    label: '楷体',
    family: "'KaiTi', serif",
    webFamily: '',
    localFamily: 'KaiTi',
  },
} as const

export async function isLocalFontAvailable(font: keyof typeof FONT_PRESETS) {
  const family = FONT_PRESETS[font].localFamily
  if (!family) return true
  try {
    await new FontFace('LocalFontProbe', `local("${family}")`).load()
    return true
  } catch {
    return false
  }
}

export const FONT_PREVIEW_TEXT = '效果预览订单列表客户档案地区名称行政编码浙江省杭州市330000330100'
export async function loadPreviewFont(
  font: keyof typeof FONT_PRESETS,
  fontSet: Pick<FontFaceSet, 'load'> = document.fonts,
) {
  if (!(await isLocalFontAvailable(font))) throw new Error('本机未安装此字体，请选择内置字体。')
  const family = FONT_PRESETS[font].webFamily
  if (!family) return
  const faces = await Promise.all(
    [400, 600].map((weight) => fontSet.load(`${weight} 14px "${family}"`, FONT_PREVIEW_TEXT)),
  )
  if (faces.some((result) => !result.length)) throw new Error('字体文件未加载')
}

export interface DisplayPreferences {
  font: keyof typeof FONT_PRESETS
  body: number
  tableHeader: number
  menu: number
  heading: number
  rowHeight: number
}
export const DEFAULT_DISPLAY: DisplayPreferences = {
  font: 'noto',
  body: 14,
  tableHeader: 14,
  menu: 14,
  heading: 18,
  rowHeight: 40,
}
export const DISPLAY_STORAGE_KEY = 'scdp.display-preferences.v1'
export function normalizeDisplay(value: unknown): DisplayPreferences {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const size = (key: keyof DisplayPreferences, min: number, max: number) =>
    typeof source[key] === 'number' && Number.isFinite(source[key])
      ? Math.min(max, Math.max(min, Math.round(source[key] as number)))
      : (DEFAULT_DISPLAY[key] as number)
  return {
    font:
      typeof source.font === 'string' && Object.hasOwn(FONT_PRESETS, source.font)
        ? (source.font as DisplayPreferences['font'])
        : DEFAULT_DISPLAY.font,
    body: size('body', 14, 18),
    tableHeader: size('tableHeader', 14, 18),
    menu: size('menu', 14, 18),
    heading: size('heading', 16, 24),
    rowHeight: size('rowHeight', 36, 52),
  }
}
export function readDisplay(): DisplayPreferences {
  try {
    return normalizeDisplay(JSON.parse(localStorage.getItem(DISPLAY_STORAGE_KEY) || 'null'))
  } catch {
    return { ...DEFAULT_DISPLAY }
  }
}
export function displayVariables(value: DisplayPreferences): Record<string, string> {
  const p = normalizeDisplay(value)
  return {
    '--app-font-family': FONT_PRESETS[p.font].family,
    '--app-font-size-base': `${p.body}px`,
    '--app-font-size-small': `${Math.max(13, p.body - 1)}px`,
    '--app-font-size-caption': `${Math.max(12, p.body - 2)}px`,
    '--app-font-size-heading': `${p.heading}px`,
    '--app-table-header-size': `${p.tableHeader}px`,
    '--app-menu-font-size': `${p.menu}px`,
    '--app-table-row-height': `${p.rowHeight}px`,
  }
}
export function applyDisplay(value: DisplayPreferences) {
  Object.entries(displayVariables(value)).forEach(([key, val]) =>
    document.documentElement.style.setProperty(key, val),
  )
}
export function saveDisplay(value: DisplayPreferences) {
  const normalized = normalizeDisplay(value)
  localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(normalized))
  applyDisplay(normalized)
}
