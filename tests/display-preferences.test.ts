import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DISPLAY,
  DISPLAY_STORAGE_KEY,
  applyDisplay,
  loadPreviewFont,
  isLocalFontAvailable,
  normalizeDisplay,
  readDisplay,
  saveDisplay,
} from '@/utils/display-preferences'
beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('style')
})
describe('统一显示设置', () => {
  it('非法或旧存储不会导致页面失败，字号保留可读下限', () => {
    localStorage.setItem(DISPLAY_STORAGE_KEY, '{bad')
    expect(readDisplay()).toEqual(DEFAULT_DISPLAY)
    expect(
      normalizeDisplay({ font: '__proto__', body: 10, menu: 100, tableHeader: null }),
    ).toMatchObject({ font: 'noto', body: 14, menu: 18, tableHeader: 14 })
  })
  it('保存后重新读取，正文、表头、菜单与行高分别生效', () => {
    saveDisplay({
      ...DEFAULT_DISPLAY,
      font: 'serif',
      body: 16,
      tableHeader: 17,
      menu: 15,
      rowHeight: 44,
    })
    const restored = readDisplay()
    expect(restored).toMatchObject({
      font: 'serif',
      body: 16,
      tableHeader: 17,
      menu: 15,
      rowHeight: 44,
    })
    applyDisplay(restored)
    const style = document.documentElement.style
    expect(style.getPropertyValue('--app-font-size-base')).toBe('16px')
    expect(style.getPropertyValue('--app-table-header-size')).toBe('17px')
    expect(style.getPropertyValue('--app-menu-font-size')).toBe('15px')
    expect(style.getPropertyValue('--app-table-row-height')).toBe('44px')
    saveDisplay(DEFAULT_DISPLAY)
    expect(readDisplay()).toEqual(DEFAULT_DISPLAY)
  })
})

describe('内置字体预览', () => {
  it('实际加载预览字形和正文、表头两种字重，缺失字体不能冒充成功', async () => {
    const load = vi.fn().mockResolvedValue([{} as FontFace])
    await loadPreviewFont('serif', { load })
    expect(load.mock.calls[0]?.[0]).toContain('400 14px "Noto Serif SC Variable"')
    expect(load.mock.calls[1]?.[0]).toContain('600 14px "Noto Serif SC Variable"')
    expect(load.mock.calls[0]?.[1]).toContain('地区名称')
    load.mockResolvedValue([])
    await expect(loadPreviewFont('noto', { load })).rejects.toThrow('字体文件未加载')
    load.mockClear()
    await loadPreviewFont('system', { load })
    expect(load).not.toHaveBeenCalled()
  })
})

describe('新增字体', () => {
  it.each([
    ['misans', 'MiSans'],
    ['wenkai', 'LXGW WenKai'],
  ] as const)('内置 %s 加载中文预览', async (font, family) => {
    const load = vi.fn().mockResolvedValue([{} as FontFace])
    await loadPreviewFont(font, { load })
    expect(load.mock.calls[0]?.[0]).toContain(family)
    saveDisplay({ ...DEFAULT_DISPLAY, font })
    expect(readDisplay().font).toBe(font)
  })
  it('本机字体缺失时不能显示为成功预览', async () => {
    const load = vi.fn().mockRejectedValue(new Error('missing font'))
    vi.stubGlobal(
      'FontFace',
      class {
        load = load
      },
    )
    try {
      expect(await isLocalFontAvailable('yahei')).toBe(false)
      await expect(loadPreviewFont('yahei', { load: vi.fn() })).rejects.toThrow('本机未安装')
      load.mockResolvedValue({})
      expect(await isLocalFontAvailable('yahei')).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
