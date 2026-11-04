import { describe, it, expect } from 'vitest'
import { filterAuditGroups } from '../src/utils/payment-voucher-audit'
import type { AuditGroup } from '../src/api/core/payment-voucher-audit'
const g = { auditStatusCode:'PENDING_REVIEW',reasonCodes:['DUPLICATE_ALLOCATION'],reviewMethod:'SYSTEM',kind:'TRANSACTION',imageKey:null,reasons:[],unresolvedPayments:0,fingerprint:'f', key:'G', result:'EXCESS', transactionNo:'T', allocatedAmount:600, voucherAmount:300, excessAmount:300, reviewStale:false,reviews:[], payments:[{orderId:'1',status:'CHECKED',excluded:false,primaryTransaction:'T',attachmentKeys:[],evidence:[],id:'1',paymentNo:'P1',orderNo:'SO1',salesperson:'张三',customer:'客户',time:'2026-08-01T00:00:00Z',amount:300},{orderId:'2',status:'CHECKED',excluded:false,primaryTransaction:'T',attachmentKeys:[],evidence:[],id:'2',paymentNo:'P2',orderNo:'SO2',salesperson:'张三',customer:'客户',time:'2026-09-02T00:00:00Z',amount:300}] } as AuditGroup
const filters = {result:'ATTENTION',keyword:'',salesperson:'',customer:'',dates:[],review:''}
describe('voucher audit group filters',()=>{
 it('keeps cross-month amounts and linked payments when filtering September',()=>{const out=filterAuditGroups([g],{...filters,dates:['2026-09-01','2026-09-30']});expect(out[0].allocatedAmount).toBe(600);expect(out[0].payments).toHaveLength(2)})
 it('hides balanced groups by default but allows explicit selection',()=>{const balanced={...g,result:'BALANCED',auditStatusCode:'NORMAL' as const};expect(filterAuditGroups([balanced],filters)).toHaveLength(0);expect(filterAuditGroups([balanced],{...filters,result:'NORMAL'})).toHaveLength(1)})
 it('reopens stale reviews and combines customer and salesperson on one matched payment',()=>{expect(filterAuditGroups([{...g,reviewStale:true,reviews:[{id:'r',fingerprint:'old',conclusion:'NORMAL_COMBINED',note:'已核对',actor:'u',time:'2026-09-01T00:00:00Z',paymentIds:['1','2']}]}],{...filters,review:'PENDING'})).toHaveLength(1);expect(filterAuditGroups([g],{...filters,salesperson:'李四'})).toHaveLength(0)})
})

import { sortVoucherGroups, voucherTimeLabels, voucherTimeText } from '../src/utils/payment-voucher-audit'
describe('原图付款时间筛选排序', () => {
 const withTime = (key: string, time: string, txn = 'T'): AuditGroup => ({...structuredClone(g), key, payments: g.payments.map((p,i) => ({...p, attachmentKeys:['image'], evidence:[{key:'image',amount:300,transactionNo:txn,note:null,paidTime:time,paidTimePrecision:'SECOND'}], excluded:i===1}))})
 it('只使用匹配交易的原图时间，不回退系统时间，筛选保留整个核查组', () => {
  const a=withTime('A','2026-10-10T12:37:52Z')
  expect(filterAuditGroups([a],{...filters,voucherDates:['2026-10-10','2026-10-10']})).toHaveLength(1)
  expect(filterAuditGroups([a],{...filters,voucherDates:['2026-10-10','2026-10-10']})[0].payments).toHaveLength(2)
  expect(filterAuditGroups([g,withTime('B','2026-10-10T12:37:52Z','OTHER')],{...filters,voucherDates:['2026-10-10','2026-10-10']})).toHaveLength(0)
  expect(voucherTimeLabels(a)).toEqual(['2026-10-10 20:37:52'])
 })
 it('分页前全量排序，无日期在升序降序都置后，保留日期精度', () => {
  const a=withTime('A','2026-10-10T00:00:00Z'),b=withTime('B','2026-10-11T00:00:00Z')
  expect(sortVoucherGroups([g,b,a],'ascending').map(x=>x.key)).toEqual(['A','B','G'])
  expect(sortVoucherGroups([g,a,b],'descending').map(x=>x.key)).toEqual(['B','A','G'])
  expect(voucherTimeText('2026-10-10T12:37:00Z','MINUTE')).toBe('2026-10-10 20:37')
  expect(voucherTimeText('2026-10-09T16:00:00Z','DAY')).toBe('2026-10-10')
 })
})
