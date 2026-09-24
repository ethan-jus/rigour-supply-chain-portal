import { expect, it } from 'vitest'
import { memberPasswordError } from '@/utils/member-password'

it.each(['R7!mK2xp', 'R7!mK2xpQ9#v'])('接受边界长度密码 %s', value => {
  expect(memberPasswordError(value)).toBe('')
})

it.each([null, '', 'R7!mK2x', 'R7!mK2xpQ9#vZ', 'abcdefgh', 'ABCDEFGH', '12345678',
  'Abcdef12', 'abcdef1!', 'ABCDEF1!', 'Abcdefg!', 'Aa12! xy', 'Aa12!中文xx',
  'Password1!', 'Admin123!', 'Qwerty12!'])('拦截长度、复杂度或常见弱密码 %s', value => {
  expect(memberPasswordError(value)).not.toBe('')
})
