import { workNames } from '@/api/core/sales-fieldwork-report'

export const attendanceNames = { ...workNames, ACTIVE: '已签到' } as Record<string, string>

const avatarColors = [
  ['#eaf0fb', '#446ba1'],
  ['#e6f2ef', '#42726c'],
  ['#efeaf6', '#795f91'],
  ['#f8edde', '#8c6a3f'],
  ['#f9e8ee', '#93536e'],
  ['#e3f1f7', '#3d718c'],
] as const

export function teamAvatarColor(index: number) {
  const pair = avatarColors[index]
  if (pair) return { backgroundColor: pair[0], color: pair[1] }
  const hue = (index * 137.508) % 360
  return { backgroundColor: `hsl(${hue}, 44%, 92%)`, color: `hsl(${hue}, 32%, 35%)` }
}
