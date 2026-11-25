import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { loadBackgroundMedia } from '@/utils/background-media'

it('limits automatic transfers and removes queued work when the page is left', async () => {
  let finishFirst!: (value: string) => void
  let finishSecond!: (value: string) => void
  const first = loadBackgroundMedia(
    new AbortController().signal,
    () => new Promise<string>((resolve) => { finishFirst = resolve }),
  )
  const second = loadBackgroundMedia(
    new AbortController().signal,
    () => new Promise<string>((resolve) => { finishSecond = resolve }),
  )
  const leftPage = new AbortController()
  const canceled = vi.fn(async () => 'unused')
  const queued = loadBackgroundMedia(leftPage.signal, canceled)
  const canceledResult = expect(queued).rejects.toMatchObject({ name: 'AbortError' })
  const nextLoad = vi.fn(async () => 'next')
  const next = loadBackgroundMedia(new AbortController().signal, nextLoad)

  await flushPromises()
  expect(nextLoad).not.toHaveBeenCalled()
  leftPage.abort()
  await canceledResult
  expect(canceled).not.toHaveBeenCalled()
  finishFirst('first')
  await expect(first).resolves.toBe('first')
  await expect(next).resolves.toBe('next')
  finishSecond('second')
  await expect(second).resolves.toBe('second')
})
