import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ElementPlus, { ElPagination } from 'element-plus'
import CompactPagination from '@/components/supply/CompactPagination.vue'

function mountPager(currentPage = 1, total = 2440) {
  return mount(CompactPagination, {
    props: { currentPage, total, pageSize: 20 },
    global: { plugins: [ElementPlus] },
  })
}

describe('紧凑列表分页', () => {
  it.each([
    [1, ['1', '2', '3', '122']],
    [60, ['1', '59', '60', '61', '122']],
    [122, ['1', '120', '121', '122']],
  ])('第 %i 页保留当前页、相邻页和首末页', (page, expected) => {
    const wrapper = mountPager(page)
    expect(wrapper.findAll('.compact-pagination__pages button').map(button => button.text())).toEqual(expected)
    expect(wrapper.get('[aria-current="page"]').text()).toBe(String(page))
    wrapper.unmount()
  })

  it('空数据时只有第一页，前后翻页均禁用', () => {
    const wrapper = mountPager(1, 0)
    expect(wrapper.findAll('.compact-pagination__pages button')).toHaveLength(1)
    expect(wrapper.get('.btn-prev').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.btn-next').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('点击页码更新页码并且只触发一次查询，点击当前页不重复查询', async () => {
    const wrapper = mountPager()
    await wrapper.get('[aria-label="第 1 页"]').trigger('click')
    expect(wrapper.emitted('current-change')).toBeUndefined()
    await wrapper.get('[aria-label="第 3 页"]').trigger('click')
    expect(wrapper.emitted('update:currentPage')).toEqual([[3]])
    expect(wrapper.emitted('current-change')).toEqual([[3]])
    wrapper.unmount()
  })

  it('保留上一页下一页和每页条数的事件，切换条数重新计算末页', async () => {
    const wrapper = mountPager(2)
    await wrapper.get('.btn-prev').trigger('click')
    await wrapper.get('.btn-next').trigger('click')
    expect(wrapper.emitted('current-change')).toEqual([[1], [3]])
    const pagination = wrapper.getComponent(ElPagination)
    pagination.vm.$emit('update:page-size', 50)
    pagination.vm.$emit('size-change', 50)
    expect(wrapper.emitted('update:pageSize')).toEqual([[50]])
    expect(wrapper.emitted('size-change')).toEqual([[50]])
    await wrapper.setProps({ pageSize: 50 })
    expect(wrapper.findAll('.compact-pagination__pages button').at(-1)?.text()).toBe('49')
    wrapper.unmount()
  })
})
