import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { describe, expect, it } from 'vitest'

import FundAttachmentPreviewList from '@/components/supply/FundAttachmentPreviewList.vue'

describe('付款凭证列表', () => {
  it('兼容订单登记接口返回的附件对象键字符串', () => {
    const wrapper = mount(FundAttachmentPreviewList, {
      props: {
        attachments: ['tenant/orders/payment/receipt-001.jpg'],
        direction: 'row',
      },
      global: { plugins: [ElementPlus] },
    })

    expect(wrapper.text()).toContain('receipt-001.jpg')
    expect(wrapper.text()).toContain('待补偿')
    wrapper.unmount()
  })

  it('完整附件对象仍保留预览入口', () => {
    const wrapper = mount(FundAttachmentPreviewList, {
      props: {
        attachments: [{
          objectKey: 'tenant/orders/payment/receipt-002.pdf',
          fileName: '付款凭证.pdf',
          url: 'https://example.test/receipt-002.pdf',
        }],
      },
      global: { plugins: [ElementPlus] },
    })

    expect(wrapper.text()).toContain('付款凭证.pdf')
    expect(wrapper.text()).toContain('查看')
    wrapper.unmount()
  })
})
