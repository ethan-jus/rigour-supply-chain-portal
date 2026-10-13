import { describe, it, expect } from 'vitest'
import { filterAuditGroups } from '../src/utils/payment-voucher-audit'
import type { AuditGroup } from '../src/api/core/payment-voucher-audit'
const g = { kind:'TRANSACTION',imageKey:null,reasons:[],unresolvedPayments:0,fingerprint:'f', key:'G', result:'EXCESS', transactionNo:'T', allocatedAmount:600, voucherAmount:300, excessAmount:300, reviewStale:false,reviews:[], payments:[{orderId:'1',status:'CHECKED',excluded:false,primaryTransaction:'T',attachmentKeys:[],evidence:[],id:'1',paymentNo:'P1',orderNo:'SO1',salesperson:'张三',customer:'客户',time:'2026-08-01T00:00:00Z',amount:300},{orderId:'2',status:'CHECKED',excluded:false,primaryTransaction:'T',attachmentKeys:[],evidence:[],id:'2',paymentNo:'P2',orderNo:'SO2',salesperson:'张三',customer:'客户',time:'2026-09-02T00:00:00Z',amount:300}] } as AuditGroup
const filters = {result:'ATTENTION',keyword:'',salesperson:'',customer:'',dates:[],review:''}
describe('voucher audit group filters',()=>{
 it('keeps cross-month amounts and linked payments when filtering September',()=>{const out=filterAuditGroups([g],{...filters,dates:['2026-09-01','2026-09-30']});expect(out[0].allocatedAmount).toBe(600);expect(out[0].payments).toHaveLength(2)})
 it('hides balanced groups by default but allows explicit selection',()=>{const balanced={...g,result:'BALANCED'};expect(filterAuditGroups([balanced],filters)).toHaveLength(0);expect(filterAuditGroups([balanced],{...filters,result:'BALANCED'})).toHaveLength(1)})
 it('reopens stale reviews and combines customer and salesperson on one matched payment',()=>{expect(filterAuditGroups([{...g,reviewStale:true,reviews:[{id:'r',fingerprint:'old',conclusion:'NORMAL_COMBINED',note:'已核对',actor:'u',time:'2026-09-01T00:00:00Z',paymentIds:['1','2']}]}],{...filters,review:'PENDING'})).toHaveLength(1);expect(filterAuditGroups([g],{...filters,salesperson:'李四'})).toHaveLength(0)})
})
