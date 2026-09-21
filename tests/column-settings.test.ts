import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import ElementPlus from 'element-plus'
import { nextTick } from 'vue'
import { useColumnSettings, type ColumnSetting } from '@/composables/useColumnSettings'
import TableColumnSettings from '@/components/supply/TableColumnSettings.vue'

const COLUMNS: ColumnSetting[] = [
  { key: 'main', label: '主列', locked: true },
  { key: 'audit', label: '审计列', defaultVisible: false },
  { key: 'normal', label: '普通列' },
]

describe('列设置偏好', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('默认值：锁定列与普通列显示，defaultVisible=false 的列隐藏', () => {
    const settings = useColumnSettings('test-default', COLUMNS)
    expect(settings.isVisible('main')).toBe(true)
    expect(settings.isVisible('normal')).toBe(true)
    expect(settings.isVisible('audit')).toBe(false)
  })

  it('修改后持久化，新实例读取同一份偏好', () => {
    const settings = useColumnSettings('test-persist', COLUMNS)
    settings.setVisible('normal', false)
    const reloaded = useColumnSettings('test-persist', COLUMNS)
    expect(reloaded.isVisible('normal')).toBe(false)
    expect(reloaded.isVisible('audit')).toBe(false)
  })

  it('锁定列不可隐藏', () => {
    const settings = useColumnSettings('test-lock', COLUMNS)
    settings.setVisible('main', false)
    expect(settings.isVisible('main')).toBe(true)
  })

  it('恢复默认清除本地偏好', () => {
    const settings = useColumnSettings('test-reset', COLUMNS)
    settings.setVisible('audit', true)
    settings.setVisible('normal', false)
    settings.reset()
    expect(settings.isVisible('audit')).toBe(false)
    expect(settings.isVisible('normal')).toBe(true)
    const reloaded = useColumnSettings('test-reset', COLUMNS)
    expect(reloaded.isVisible('normal')).toBe(true)
  })

  it('本地偏好损坏时回退默认', () => {
    window.localStorage.setItem('scdp.column-settings.v1.test-corrupt', '{oops')
    const settings = useColumnSettings('test-corrupt', COLUMNS)
    expect(settings.isVisible('normal')).toBe(true)
    expect(settings.isVisible('audit')).toBe(false)
  })

  it('已有偏好下新增列回退默认值', () => {
    const settings = useColumnSettings('test-new-column', COLUMNS)
    settings.setVisible('normal', false)
    const extended = useColumnSettings('test-new-column', [...COLUMNS, { key: 'later', label: '新列' }])
    expect(extended.isVisible('later')).toBe(true)
    expect(extended.isVisible('normal')).toBe(false)
  })
})

describe('列设置组件', () => {
  it('打开后勾选变化发出 change，恢复默认发出 reset', async () => {
    const wrapper = mount(TableColumnSettings, {
      props: {
        columns: COLUMNS,
        visibility: { main: true, audit: false, normal: true },
      },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    const trigger = wrapper.findAll('button').find((node) => node.text() === '列设置')
    await trigger!.trigger('click')
    await nextTick()

    const auditCheckbox = wrapper
      .findAll('.el-checkbox')
      .find((node) => node.text().includes('审计列'))
    await auditCheckbox!.find('input').setValue(true)
    await nextTick()
    expect(wrapper.emitted('change')).toBeTruthy()
    expect(wrapper.emitted('change')![0]).toEqual(['audit', true])

    const resetButton = wrapper.findAll('button').find((node) => node.text() === '恢复默认')
    await resetButton!.trigger('click')
    expect(wrapper.emitted('reset')).toBeTruthy()
    wrapper.unmount()
  })
})
