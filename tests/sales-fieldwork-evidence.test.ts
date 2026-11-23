import {defineComponent} from 'vue'
import {mount,flushPromises} from '@vue/test-utils'
import {beforeEach,it,expect,vi} from 'vitest'
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}))
const permissions=vi.hoisted(()=>new Set<string>())
vi.mock('@/api/core/client',()=>({apiClient:api}))
vi.mock('@/stores/auth',()=>({useAuthStore:()=>({user:{tenantId:'tenant',id:'one',permissions:[]},hasPermission:(p:string)=>permissions.has(p)})}))
import Evidence from '@/views/supply-chain/sales/SalesVisitEvidence.vue'
import FieldVisitDetails from '@/views/supply-chain/sales/FieldVisitDetails.vue'
import type { ReportVisit } from '@/api/core/sales-fieldwork-report'
const slot=defineComponent({template:'<div><slot/></div>'})
const alert=defineComponent({props:['title'],template:'<div>{{title}}</div>'})
const visit={sequence:1,reviewStatus:'PENDING_REVIEW',visitId:'visit',storeId:'store',storeName:'测试门店',visitType:'FIRST_VISIT',checkedInAt:'2026-11-12T01:00:00Z',checkedOutAt:'2026-11-12T02:00:00Z',dwellMinutes:60,longitude:116,latitude:40}
function render(){return mount(Evidence,{props:{visit,employeeName:'测试销售'},global:{stubs:{ElButton:slot,ElTabs:slot,ElTabPane:slot,ElTag:slot,ElAlert:alert,ElInput:slot,ElSelect:slot,ElOption:slot,ElEmpty:slot,SalesFieldworkCasePanel:slot}}})}
beforeEach(()=>{permissions.clear();vi.clearAllMocks();api.get.mockImplementation((url:string)=>url.endsWith('/recordings')?Promise.resolve({clips:[{clipId:'clip',clipIndex:1,clientDurationMs:60000}]}):Promise.reject(Error('转写暂不可用')));URL.createObjectURL=vi.fn(()=> 'blob:private');URL.revokeObjectURL=vi.fn()})
it('没有敏感权限时不请求原录音和原文',async()=>{const w=render();await flushPromises();expect(api.get).not.toHaveBeenCalled();expect(w.text()).toContain('暂无录音查看权限');w.unmount()})
it('转写接口失败仍保留可播放录音，读取不使用展示缓存',async()=>{permissions.add('sales:recording:sensitive:play');const w=render();await flushPromises();expect(w.text()).toContain('转写暂不可用');const state=w.vm as unknown as {selectedClip:string;clips:unknown[]};expect(state.selectedClip).toBe('clip');expect(state.clips).toHaveLength(1);expect(api.get).toHaveBeenCalledWith('/sales/management/visits/visit/recordings',expect.objectContaining({cacheBypass:true,signal:expect.any(AbortSignal)}));w.unmount()})
it('离开详情时迟到的媒体响应不能恢复播放器',async()=>{permissions.add('sales:recording:sensitive:play');const w=render();await flushPromises();let finish:(b:Blob)=>void=()=>{};api.get.mockImplementationOnce(()=>new Promise<Blob>(resolve=>{finish=resolve}));const state=w.vm as unknown as {playAt:(ms:number)=>Promise<void>};const pending=state.playAt(0);w.unmount();finish(new Blob(['audio']));await pending;expect(URL.createObjectURL).not.toHaveBeenCalled()})

it('管理端只读取统一转写结果，查看与搜索不发起识别或重复保存',async()=>{
 permissions.add('sales:recording:sensitive:play')
 api.get.mockImplementation((url:string)=>Promise.resolve(url.endsWith('/recordings')?{clips:[{clipId:'shared-clip',clipIndex:0,clientDurationMs:193600}]}:{visitId:'visit',processingEnabled:true,speakers:[{id:1,name:'陈小明',role:'SALESPERSON'}],clips:[{clipId:'shared-clip',status:'SUCCEEDED',transcript:'同一份持久化原文',segments:[{startMs:38000,endMs:42000,text:'同一份持久化原文',speakerId:1}],summaryStatus:'NOT_REQUESTED'}]}))
 const w=render();await flushPromises();expect(w.text()).toContain('同一份持久化原文');expect(w.text()).toContain('陈小明：');expect(w.text()).not.toContain('暂无摘要')
 expect(api.get).toHaveBeenCalledWith('/sales/management/visits/visit/recording-analysis',expect.objectContaining({cacheBypass:true}));expect(api.post).not.toHaveBeenCalled();w.unmount()
})

it('详情按权限显示片段，仅使用服务端已核时长', async () => {
  const record: ReportVisit = {
    id: 'visit',
    profileId: 'sales',
    name: '测试销售',
    employee: 'EMP',
    date: '2026-11-12',
    store: '测试店',
    customer: null,
    status: 'CHECKED_OUT',
    arrived: '2026-11-12T01:00:00Z',
    departed: '2026-11-12T01:08:00Z',
    receivedAt: '2026-11-12T01:10:00Z',
    result: null,
    outcome: null,
    intention: null,
    planId: null,
    sequence: 2,
    assessment: 'PENDING',
    reason: 'DWELL_TOO_SHORT',
    ruleVersion: 'v7',
    minimumMinutes: 10,
    objective: null,
    photos: 1,
    files: 2,
    verifiedFiles: 1,
    verifiedMillis: 20_000,
  }
  const drawer = defineComponent({
    props: ['modelValue'],
    template: '<div v-if="modelValue"><slot name="header" title-id="drawer" :close="() => {}" /><slot /><slot name="footer" /></div>',
  })
  const open = () => mount(FieldVisitDetails, {
    props: { visit: record },
    global: { stubs: { ElDrawer: drawer, ElButton: slot } },
  })
  const summary = open()
  await flushPromises()
  expect(api.get).not.toHaveBeenCalled()
  expect(summary.text()).toContain('09:10')
  expect(summary.text()).toContain('停留时长不足')
  summary.unmount()

  permissions.add('sales:recording:sensitive:play')
  api.get.mockResolvedValueOnce({ clips: [
    { clipId: 'clip-verified', clipIndex: 0, uploadStatus: 'RECEIVED', verifyStatus: 'VERIFIED', verifiedDurationMs: 20_000, clientDurationMs: 90_000 },
    { clipId: 'clip-pending', clipIndex: 1, uploadStatus: 'RECEIVED', verifyStatus: 'PENDING', verifiedDurationMs: null, clientDurationMs: 55_000 },
  ] })
  const detail = open()
  await flushPromises()
  expect(detail.findAll('tbody tr').map((row) => row.findAll('td').map((cell) => cell.text())))
    .toEqual([['片段 01', '已核', '0分20秒'], ['片段 02', '已收 · 待核', '—']])
  detail.unmount()
})
