import { expect, it } from 'vitest'
import { fieldMapPaths } from '@/api/core/sales-fieldwork'

it('往返共用的路段只画一次，坏坐标和采样断点分开画', () => {
  const point = (longitude: number) => ({ longitude, latitude: 40 })
  const paths = fieldMapPaths([
    { points: [116, 116.01, 116, NaN, 116.02, 116.03].map(point) },
    { confirmed: true, points: [116.03, 116.02, 116.04].map(point) },
  ])
  expect(paths).toEqual([
    {
      path: [
        [116, 40],
        [116.01, 40],
      ],
      showDir: true,
    },
    {
      path: [
        [116.02, 40],
        [116.03, 40],
      ],
      showDir: true,
    },
    {
      path: [
        [116.02, 40],
        [116.04, 40],
      ],
      showDir: false,
    },
  ])
})
