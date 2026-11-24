import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, expect, it, vi } from 'vitest'
import ConsoleSalesDownload from '@/components/console/ConsoleSalesDownload.vue'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it.each([true, false])(
  'reflects the available Harmony package in the existing console (published: %s)',
  async (published) => {
    const harmony = published
      ? { version: '1', url: 'https://download.example.org/manifest.json5' }
      : null
    const fetch = vi.fn().mockResolvedValue(Response.json({ harmony }))
    vi.stubEnv('VITE_SALES_DOWNLOAD_ORIGIN', 'http://192.168.1.8:5100')
    vi.stubGlobal('fetch', fetch)
    const wrapper = mount(ConsoleSalesDownload, {
      attachTo: document.body,
      global: { plugins: [ElementPlus], stubs: { transition: false } },
    })
    try {
      await wrapper.get('[aria-label="下载销售工作台"]').trigger('click')
      await flushPromises()
      await vi.waitFor(() => {
        const card = [...document.querySelectorAll('section.platform')].find((s) =>
          s.textContent?.includes('鸿蒙原生版'),
        )
        expect(fetch).toHaveBeenCalledWith('/downloads/sales/releases.json', { cache: 'no-store' })
        expect(card).toBeDefined()
        if (published) {
          expect(card?.querySelector('[aria-label="鸿蒙原生版 安装二维码"] svg')).toBeTruthy()
          expect(card?.querySelector('a')?.textContent).toBe('下载安装')
          expect(card?.querySelector('a')?.getAttribute('href')).toMatch(
            /^store:\/\/enterprise\/manifest\?url=/,
          )
        } else {
          expect(card?.textContent).toContain('暂未开放')
          expect(card?.querySelector('a, svg')).toBeNull()
        }
      })
      expect(fetch).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
    }
  },
)
