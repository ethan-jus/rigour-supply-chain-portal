import {defineComponent} from 'vue'
import {mount,flushPromises} from '@vue/test-utils'
import {it,expect,vi,beforeEach} from 'vitest'
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}))
const permissions=vi.hoisted(()=>new Set<string>())
vi.mock('@/api/core/client',()=>({apiClient:api}))
vi.mock('@/stores/auth',()=>({useAuthStore:()=>({user:{tenantId:'tenant',id:'user',permissions:[]},hasPermission:(p:string)=>permissions.has(p)})}))
import Appeals from '@/views/supply-chain/sales/SalesVisitAppeals.vue'
const slot=defineComponent({template:'<div><slot/></div>'})
const row={storeId:'1',storeName:'测试门店',visitId:'2',captureRef:null,employeeCode:'E1',visitedAt:'2026-11-17T01:00:00Z',appeal:{id:'3',status:'PENDING',reason:'请核对原录音',originalState:'FAILED',originalReason:'DWELL_TOO_SHORT',submittedAt:'2026-11-17T02:00:00Z',decision:null,reviewNote:null,reviewedAt:null}}
function render(){return mount(Appeals,{global:{stubs:Object.fromEntries(['ElResult','ElTable','ElTableColumn','ElDrawer','ElAlert','ElSelect','ElOption','ElButton','ElRadioGroup','ElRadio','ElInput','ListTableFooter','CompactPagination','CrmVisitEvidence'].map(n=>[n,n==='ElTableColumn'?true:slot]))}})}
beforeEach(()=>{permissions.clear();vi.clearAllMocks();api.get.mockImplementation((url:string)=>Promise.resolve(url.includes('visit-appeals')?{items:[row],total:1,page:1,pageSize:20}:{visitId:'2',state:'APPEALED',revision:7,canAppeal:false,appeals:[row.appeal]}))})
it('没有核验权限时不读取任何申诉',async()=>{const w=render();await flushPromises();expect(api.get).not.toHaveBeenCalled();w.unmount()})
it('仅处理已提交的申诉，必填依据并防止重复提交',async()=>{
 permissions.add('crm:store:visit-review');const w=render();await flushPromises()
 const state=w.vm as unknown as {select:(r:typeof row)=>Promise<void>;submit:()=>Promise<void>;decision:string;note:string;detailError:string}
 await state.select(row);await state.submit();expect(api.post).not.toHaveBeenCalled();expect(state.detailError).toContain('处理依据')
 state.decision='EFFECTIVE';state.note='核对原录音确认符合要求';let finish:(v:unknown)=>void=()=>{};api.post.mockImplementationOnce(()=>new Promise(r=>{finish=r}))
 const pending=state.submit();await state.submit();expect(api.post).toHaveBeenCalledTimes(1)
 expect(api.post).toHaveBeenCalledWith('/crm/stores/1/visits/2/review',{revision:7,decision:'EFFECTIVE',reason:'核对原录音确认符合要求'},expect.anything())
 finish({});await pending;w.unmount()
})
