import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}))
const permissions=vi.hoisted(()=>new Set<string>())
vi.mock('@/api/core/client',()=>({apiClient:api}))
vi.mock('@/stores/auth',()=>({useAuthStore:()=>({user:{tenantId:'tenant',id:'admin',permissions:[]},hasPermission:(p:string)=>permissions.has(p)})}))
vi.mock('@/utils/amap-js-api',()=>({isAmapJsConfigured:()=>false,loadAmapJsApi:vi.fn()}))
import Inspector from '@/views/supply-chain/sales/SalesFieldworkInspector.vue'
import Day from '@/views/supply-chain/sales/SalesFieldworkDay.vue'
import History from '@/views/supply-chain/sales/SalesVisitHistory.vue'
import type { FieldTrack,FieldPersonDay } from '@/api/core/sales-fieldwork'
const slot=defineComponent({template:'<div><slot/></div>'}),alert=defineComponent({props:['title'],template:'<div>{{title}}</div>'})
const stubs={ElButton:slot,ElTag:slot,ElAlert:alert,ElEmpty:slot,ElInput:slot,SalesFieldworkCasePanel:slot}
const person={salesProfileId:'profile',employeeName:'测试销售'} as FieldPersonDay
const track={workDayId:'day',businessDate:'2026-11-13',status:'ACTIVE',points:[],legs:[],gaps:[],punches:[],visits:[],segments:[],distanceAvailable:false,totalDistanceMeters:0,trackedDurationMinutes:0} as FieldTrack
function inspector(kind:'DEVICE'|'LOCATION'='DEVICE'){return mount(Inspector,{props:{kind,person,date:'2026-11-13',workDayId:'day',track,cases:[]},global:{stubs,directives:{loading:()=>{}}}})}
beforeEach(()=>{permissions.clear();vi.clearAllMocks();api.get.mockResolvedValue({events:[],installationComparison:'UNKNOWN',proofStatus:'NOT_OBTAINED',registrationStatus:'NOT_CONNECTED'})})
it('无核查权限不读取设备证据',async()=>{const w=inspector();await flushPromises();expect(api.get).not.toHaveBeenCalled();expect(w.text()).toContain('暂无核查查看权限');w.unmount()})
it('安装标识一致仍明确缺少设备证明',async()=>{permissions.add('sales:risk:read');api.get.mockResolvedValue({events:[],installationComparison:'SAME',proofStatus:'NOT_OBTAINED',registrationStatus:'NOT_CONNECTED'});const w=inspector();await flushPromises();expect(w.text()).toContain('一致（仅标识）');expect(w.text()).toContain('未获得');expect(w.text()).not.toContain('已备案');w.unmount()})
it('未确认区域不推断居住地或离开时间',async()=>{permissions.add('sales:risk:read');permissions.add('sales:location:sensitive:read');const w=inspector('LOCATION');await flushPromises();expect(w.text()).toContain('尚无本人确认的区域');expect(w.text()).toContain('暂无区域依据，无法判断');expect(w.text()).toContain('无法计算');expect(api.get).not.toHaveBeenCalled();w.unmount()})
it('只有核查权限时不显示地点事实或发起地点核查',async()=>{permissions.add('sales:risk:read');permissions.add('sales:risk:write');const w=inspector('LOCATION');await flushPromises();expect(w.text()).toContain('暂无精确位置权限');expect(w.text()).not.toContain('签到至首访');expect(w.text()).not.toContain('请销售说明');expect(w.find('.inspector-map').exists()).toBe(false);w.unmount()})
it('说明提交失败重试复用请求标识且卸载后不发更新',async()=>{permissions.add('sales:risk:read');permissions.add('sales:risk:write');const w=inspector();await flushPromises();const vm=w.vm as unknown as {note:string;start:()=>Promise<void>};vm.note='需要核实换机原因';api.post.mockRejectedValueOnce(Error('网络中断'));await vm.start();const key=api.post.mock.calls[0]?.[1].requestId;let finish:(value:unknown)=>void=()=>{};api.post.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));const pending=vm.start();expect(api.post.mock.calls[1]?.[1].requestId).toBe(key);w.unmount();finish({id:'case'});await pending;expect(w.emitted('changed')).toBeUndefined()})
it('未关联门店的历史不显示零次结论',async()=>{permissions.add('sales:risk:read');api.get.mockResolvedValue({storeLinked:false,current:{},items:[],total:0});const w=mount(History,{props:{visitId:'visit'},global:{stubs,directives:{loading:()=>{}}}});await flushPromises();expect(w.text()).toContain('尚未关联正式 CRM 门店');expect(w.text()).not.toContain('0次');w.unmount()})
it('切换拜访后旧历史响应不能覆盖当前记录',async()=>{permissions.add('sales:risk:read');let finish:(value:unknown)=>void=()=>{};api.get.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));const w=mount(History,{props:{visitId:'old'},global:{stubs,directives:{loading:()=>{}}}});api.get.mockResolvedValueOnce({storeLinked:false,current:{visitId:'new'},items:[],total:0});await w.setProps({visitId:'new'});await flushPromises();finish({storeLinked:true,current:{visitId:'old'},items:[],total:0});await flushPromises();expect((w.vm as unknown as {history:{current:{visitId:string}}}).history.current.visitId).toBe('new');w.unmount()})

it('只有核查权限仍可从人员日期进入设备核查而不读取轨迹',async()=>{permissions.add('sales:risk:read');api.get.mockResolvedValue([]);const w=mount(Day,{props:{person:{...person,workDayId:'day'},date:'2026-11-13'},global:{stubs:{...stubs,ElDatePicker:slot,ElSelect:slot,ElOption:slot,ElSlider:slot,ElTable:slot,ElTableColumn:true,ElDrawer:true},directives:{loading:()=>{}}}});await flushPromises();expect(w.text()).toContain('暂无精确轨迹查看权限');expect((w.vm as unknown as {inspectorDayId:string}).inspectorDayId).toBe('day');expect(api.get).toHaveBeenCalledWith('/sales/management/profiles/profile/work-days/day/cases',expect.anything());expect(api.get.mock.calls.every(c=>!c[0].includes('/track'))).toBe(true);w.unmount()})
