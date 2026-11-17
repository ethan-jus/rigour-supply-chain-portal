import { expect, it } from 'vitest'
import { validateManualTransport } from '@/views/supply-chain/cost/transport-validation'
import { transportDraft } from '@/views/supply-chain/cost/transport-records'
function valid() {
  return {
    ...transportDraft(),
    transportType: 'DELIVERY',
    deliveryModeCode: 'THIRD_PARTY',
    date: '2026-11-13',
    shippingTime: '2026-11-13T10:20:30',
    carrierCode: 'SF',
    platformOrderNo: 'SF001',
    senderName: '武汉仓',
    senderAddress: '武汉市仓储路1号',
    orderCodes: ['SO1'],
    receivingPoints: [
      {
        pointCode: 'TO0',
        partyTypeCode: 'CUSTOMER' as const,
        partyCode: 'CUS1',
        manualName: '门店',
        displayName: '门店',
        contactName: '王先生',
        phone: '+86 13900000000',
        address: '武汉市收货路1号',
        cityCode: 'WH',
      },
    ],
  }
}
it('金额待确认可以保存，但缺少收发货资料或第三方单号不可保存', () => {
  const draft = valid()
  expect(validateManualTransport(draft)).toEqual({})
  expect(
    validateManualTransport({ ...draft, senderName: '', platformOrderNo: '', receivingPoints: [] }),
  ).toHaveProperty('senderName')
  expect(validateManualTransport({ ...draft, amount: 0 })).toHaveProperty('zeroReason')
  expect(validateManualTransport({ ...draft, amount: 0, zeroReason: '客户承担运费' })).toEqual({})
})
it('自营可不填配送公司和单号，新字典配送方式仍按实际录入校验', () => {
  const draft = valid()
  expect(
    validateManualTransport({
      ...draft,
      deliveryModeCode: 'SELF',
      carrierCode: null,
      platformOrderNo: null,
    }),
  ).toEqual({})
  expect(validateManualTransport({ ...draft, deliveryModeCode: 'NEW_METHOD' })).toEqual({})
  expect(
    validateManualTransport({ ...draft, deliveryModeCode: 'NEW_METHOD', platformOrderNo: null }),
  ).toHaveProperty('platformOrderNo')
})

it('新增时发货时间必须完整到秒且与业务日期一致', () => {
  expect(validateManualTransport({ ...valid(), shippingTime: null })).toHaveProperty('date')
  expect(validateManualTransport({ ...valid(), shippingTime: '2026-11-13' })).toHaveProperty('date')
  expect(
    validateManualTransport({ ...valid(), shippingTime: '2026-11-12T10:20:30' }),
  ).toHaveProperty('date')
})
