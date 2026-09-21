import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ElementPlus, { ElImage } from 'element-plus'
import FundAttachmentThumbnails from '@/components/supply/FundAttachmentThumbnails.vue'

describe('凭证缩略图', () => {
  it('默认渲染小缩略图', () => {
    const wrapper = mount(FundAttachmentThumbnails, {
      props: {
        attachments: [
          { objectKey: 't1/fund-attachments/a.png', fileName: null, url: 'https://cos.example/a.png' },
        ],
      },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    expect(wrapper.find('.fund-attachment-thumbnails--small').exists()).toBe(true)
    const image = wrapper.findComponent(ElImage)
    expect(image.exists()).toBe(true)
    expect(image.props('src')).toContain('cos.example/a.png')
    wrapper.unmount()
  })

  it('详情模式渲染大图', () => {
    const wrapper = mount(FundAttachmentThumbnails, {
      props: {
        size: 'large',
        attachments: [
          { objectKey: 't1/fund-attachments/a.png', fileName: null, url: 'https://cos.example/a.png' },
        ],
      },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    expect(wrapper.find('.fund-attachment-thumbnails--large').exists()).toBe(true)
    expect(wrapper.findComponent(ElImage).exists()).toBe(true)
    wrapper.unmount()
  })

  it('多张图片都可点击预览且共享预览列表', () => {
    const wrapper = mount(FundAttachmentThumbnails, {
      props: {
        attachments: [
          { objectKey: 't1/fund-attachments/a.png', fileName: null, url: 'https://cos.example/a.png' },
          { objectKey: 't1/fund-attachments/b.png', fileName: null, url: 'https://cos.example/b.png' },
        ],
      },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    const images = wrapper.findAllComponents(ElImage)
    expect(images).toHaveLength(2)
    expect(images[0].props('previewSrcList')).toEqual([
      'https://cos.example/a.png',
      'https://cos.example/b.png',
    ])
    wrapper.unmount()
  })

  it('非图片凭证显示文件名链接', () => {
    const wrapper = mount(FundAttachmentThumbnails, {
      props: {
        attachments: [
          { objectKey: 't1/fund-attachments/a.pdf', fileName: '对账单.pdf', url: 'https://cos.example/a.pdf' },
        ],
      },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    expect(wrapper.findComponent(ElImage).exists()).toBe(false)
    expect(wrapper.text()).toContain('对账单.pdf')
    wrapper.unmount()
  })

  it('详情模式的内嵌 PDF 直接渲染，不用点开', () => {
    const wrapper = mount(FundAttachmentThumbnails, {
      props: {
        size: 'large',
        attachments: [
          { objectKey: 't1/fund-attachments/a.pdf', fileName: '对账单.pdf', url: 'https://cos.example/a.pdf' },
        ],
      },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    const frame = wrapper.find('iframe')
    expect(frame.exists()).toBe(true)
    expect(frame.attributes('src')).toContain('cos.example/a.pdf')
    wrapper.unmount()
  })

  it('未签发预览地址时显示占位符，不暴露对象键', () => {
    const wrapper = mount(FundAttachmentThumbnails, {
      props: { attachments: ['t1/fund-attachments/secret-key-hash.png'] },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    expect(wrapper.findComponent(ElImage).exists()).toBe(false)
    expect(wrapper.text()).toContain('-')
    expect(wrapper.text()).not.toContain('secret-key-hash')
    wrapper.unmount()
  })
})
