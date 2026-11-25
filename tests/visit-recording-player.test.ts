import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import VisitRecordingPlayer from '@/views/supply-chain/sales/VisitRecordingPlayer.vue'
import { evidenceBlob, visitRecordings } from '@/api/core/sales-fieldwork-review'

vi.mock('@/api/core/sales-fieldwork-review', async (original) => ({
  ...(await original<typeof import('@/api/core/sales-fieldwork-review')>()),
  evidenceBlob: vi.fn(),
  visitRecordings: vi.fn(),
}))

const popover = { template: '<div><slot name="reference" /><slot /></div>' }

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it('点击一次按采集顺序连续播放，切换行时释放音频', async () => {
  vi.mocked(visitRecordings).mockResolvedValue({
    clips: [2, 1].map((index) => ({
      clipId: String(index),
      clipIndex: index,
      clientDurationMs: 300000,
      uploadStatus: 'RECEIVED',
    })),
  })
  vi.mocked(evidenceBlob).mockResolvedValue(new Blob(['audio']))
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  const revoke = vi.fn()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = () => 'blob:test'
      static revokeObjectURL = revoke
    },
  )
  const wrapper = mount(VisitRecordingPlayer, {
    global: { stubs: { ElPopover: popover } },
    props: { visit: 'v', store: '示例门店', active: true, totalMillis: 600000 },
  })
  expect(visitRecordings).not.toHaveBeenCalled()
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(evidenceBlob).toHaveBeenNthCalledWith(
    1,
    'v',
    'recordings/clips',
    '1',
    expect.any(AbortSignal),
  )
  await wrapper.get('audio').trigger('playing')
  expect(wrapper.get('.voice-total').text()).toBe('10:00')
  expect(wrapper.get('.playback-time').text()).toContain('00:00 / 10:00')
  expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
  await wrapper.get('button').trigger('click')
  expect(pause).toHaveBeenCalledTimes(1)
  await wrapper.get('audio').trigger('pause')
  await wrapper.get('button').trigger('click')
  await flushPromises()
  await wrapper.get('audio').trigger('ended')
  await flushPromises()
  expect(evidenceBlob).toHaveBeenNthCalledWith(
    2,
    'v',
    'recordings/clips',
    '2',
    expect.any(AbortSignal),
  )
  expect(evidenceBlob).toHaveBeenCalledTimes(2)
  expect(play).toHaveBeenCalledTimes(3)
  expect(wrapper.get('.playback-time').text()).toContain('05:00 / 10:00')
  await wrapper.get('select').setValue('1.5')
  const media = wrapper.get('audio').element
  expect(media.playbackRate).toBe(1.5)
  await wrapper.get('audio').trigger('pause')
  await wrapper.get('input').setValue('12000')
  await flushPromises()
  expect(media.currentTime).toBe(12)
  expect(evidenceBlob).toHaveBeenLastCalledWith(
    'v',
    'recordings/clips',
    '1',
    expect.any(AbortSignal),
  )
  expect(play).toHaveBeenCalledTimes(3)
  await wrapper.get('input').setValue('316000')
  await flushPromises()
  expect(media.currentTime).toBe(16)
  expect(wrapper.get('.playback-time').text()).toContain('05:16 / 10:00')
  expect(media.playbackRate).toBe(1.5)
  await wrapper.get('button:last-of-type:not(.voice-player)').trigger('click')
  await flushPromises()
  expect(media.currentTime).toBe(0)
  expect(wrapper.get('.playback-time').text()).toContain('00:00 / 10:00')
  expect(play).toHaveBeenCalledTimes(4)
  await wrapper.setProps({ active: false })
  expect(wrapper.get('audio').attributes('src')).toBeUndefined()
  expect(revoke).toHaveBeenCalledTimes(5)
  wrapper.unmount()
})

it('未核验旧录音从上传时长补齐总时长，打开列表不会下载音频', async () => {
  vi.mocked(visitRecordings).mockResolvedValue({
    clips: [
      {
        clipId: '1',
        clipIndex: 1,
        clientDurationMs: 296000,
        verifyStatus: 'PENDING',
        uploadStatus: 'RECEIVED',
      },
    ],
  })
  const wrapper = mount(VisitRecordingPlayer, {
    props: { visit: 'old', store: '门店', active: false, totalMillis: null },
    global: { stubs: { ElPopover: popover } },
  })
  await flushPromises()
  expect(wrapper.get('.voice-total').text()).toBe('04:56')
  expect(evidenceBlob).not.toHaveBeenCalled()
  wrapper.unmount()
})
