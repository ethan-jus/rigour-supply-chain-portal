import { afterEach, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { AxiosError } from 'axios'
import { apiClient } from '@/api/core/client'
import RequestFailureNotice from '@/components/RequestFailureNotice.vue'
import ConsoleTabPane from '@/components/console/ConsoleTabPane.vue'
import { publishRequestFailure, requestFailureNotices, dismissRequestFailure } from '@/utils/request-feedback'
import { isPageRenderFailure } from '@/utils/page-error'

afterEach(() => {
  for (const notice of requestFailureNotices.value) dismissRequestFailure(notice.id)
  document.body.innerHTML = ''
})

it('即使调用方捕获错误，接口失败也显示可关闭的持续提示', async () => {
  const wrapper = mount(RequestFailureNotice)
  await apiClient.post('/test-role', {}, { adapter: async config => {
    throw new AxiosError('Bad Request', 'ERR_BAD_REQUEST', config, undefined, {
      config, status: 400, statusText: 'Bad Request', headers: {}, data: {
        code: 'VALIDATION_FAILED', message: '角色编码已存在', requestId: 'trace-test',
      },
    })
  } }).catch(() => undefined)
  await flushPromises()
  expect(document.body.textContent).toContain('角色编码已存在')
  expect(document.body.textContent).toContain('trace-test')
  const close = document.querySelector<HTMLButtonElement>('[aria-label="关闭错误提示"]')!
  close.click()
  await flushPromises()
  expect(document.body.querySelector('[role="alert"]')).toBeNull()
  wrapper.unmount()
})

it('合并重复故障，取消请求不提醒，表单校验展示字段原因', () => {
  publishRequestFailure({ code: 'ERR_CANCELED' })
  expect(requestFailureNotices.value).toHaveLength(0)
  publishRequestFailure({ code: 'VALIDATION_FAILED', message: '参数校验失败', details: [{ message: '请选择所属页面' }] })
  publishRequestFailure({ code: 'VALIDATION_FAILED', message: '参数校验失败', details: [{ message: '请选择所属页面' }] })
  expect(requestFailureNotices.value).toHaveLength(1)
  expect(requestFailureNotices.value[0]).toMatchObject({ message: '请选择所属页面', count: 2 })
})

it('异步按钮接口失败保留页面，不再变成 [object Object] 整页错误', async () => {
  const page = defineComponent({ setup: () => () => h('button', {
    onClick: async () => { throw { code: 'CONFLICT', message: '菜单已被修改，请刷新' } },
  }, '保存排序') })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: page }] })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(ConsoleTabPane, {
    props: { active: true, route: router.currentRoute.value }, global: { plugins: [router] },
  })
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(wrapper.get('button').text()).toBe('保存排序')
  expect(wrapper.text()).not.toContain('页面加载失败')
  expect(requestFailureNotices.value[0].message).toBe('菜单已被修改，请刷新')
  wrapper.unmount()
})

it('只让页面初始化和渲染错误进入兜底，兼容生产错误编号', () => {
  expect(isPageRenderFailure('render function')).toBe(true)
  expect(isPageRenderFailure('https://vuejs.org/error-reference/#runtime-1')).toBe(true)
  expect(isPageRenderFailure('component event handler')).toBe(false)
  expect(isPageRenderFailure('https://vuejs.org/error-reference/#runtime-6')).toBe(false)
})
