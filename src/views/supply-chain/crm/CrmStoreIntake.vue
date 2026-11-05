<template>
  <el-dialog
    :model-value="true"
    :title="lead ? '修改门店提报' : '新增门店'"
    width="min(780px, calc(100vw - 32px))"
    align-center
    class="store-intake-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    @update:model-value="!$event && close()"
  >
    <div v-if="completed" class="intake-complete" role="status">
      <el-icon class="success-icon"><CircleCheck /></el-icon>
      <h3>{{ completed.storeId ? '门店已进入公海' : '门店已提交审核' }}</h3>
      <p>
        {{
          completed.storeId
            ? '门店资料已保存，前往公海认领后即可开展作业。'
            : '可在门店提报查看进度；审核通过后进入公海，再认领作业。'
        }}
      </p>
    </div>
    <template v-else>
      <p class="intake-note">先查公司已有门店。高德核验、查重通过后直接入公海；手动填写需审核。</p>
      <el-alert
        v-if="contextError"
        :title="contextError"
        type="error"
        :closable="false"
        show-icon
      />
      <el-form
        label-position="top"
        :disabled="saving || loadingContext || !!contextError"
        @submit.prevent="lookup"
      >
        <div class="search-grid">
          <el-form-item label="门店名称" required>
            <el-input
              v-model="form.name"
              aria-label="新增门店名称"
              maxlength="200"
              placeholder="输入完整门店名称"
              @keyup.enter="lookup"
            />
          </el-form-item>
          <el-form-item label="查找地区 · 省 / 市 / 区县" required>
            <el-select-v2
              v-model="searchArea"
              :options="searchAreaOptions"
              filterable
              aria-label="新增查找地区"
              placeholder="选择城市或区县"
              :loading="loadingContext"
            />
          </el-form-item>
        </div>
        <div class="search-actions">
          <el-button type="primary" plain :loading="searching === 'LOCAL'" @click="lookup"
            ><el-icon><Search /></el-icon>查找已有门店</el-button
          >
          <span v-if="context">新增范围：{{ context.scopeLabel }}</span>
        </div>
        <section
          v-if="lookupDone || searching === 'LOCAL'"
          class="intake-results"
          aria-label="公司门店查询结果"
          :aria-busy="searching === 'LOCAL'"
        >
          <div class="section-heading">
            <strong>{{
              searching === 'LOCAL' ? '正在查询公司门店…' : `找到 ${existing.length} 家可见门店`
            }}</strong
            ><span>最多展示 20 家，入库时还会全库查重</span>
          </div>
          <div v-for="row in existing" :key="row.id" class="candidate">
            <div class="candidate-copy">
              <strong>{{ row.name }}</strong
              ><span>{{ row.address }}</span
              ><small
                >{{ businessLabel(row.businessStatus) }} ·
                {{
                  row.poolType === 'PRIVATE' ? '已在私海' : workBlocked(row) ? '暂停认领' : '在公海'
                }}</small
              >
            </div>
            <el-button
              v-if="destination(row)"
              link
              type="primary"
              @click="emit('navigate', destination(row)!, row.id)"
              >使用原档案</el-button
            >
            <span v-else class="hint">请联系管理员核验</span>
          </div>
          <p v-if="lookupDone && !existing.length" class="hint">
            当前可见范围未找到匹配门店。继续从高德查找，或手动提报缺失门店。
          </p>
          <div v-if="lookupDone" class="source-actions">
            <el-button v-if="!lead" :loading="searching === 'AMAP'" @click="searchAmap"
              >从高德查找</el-button
            >
            <el-button link type="primary" @click="manual()">手动填写</el-button>
          </div>
        </section>
        <p v-if="queryError" class="error" role="alert">{{ queryError }}</p>
        <section v-if="poiSearched" class="intake-results" aria-label="高德候选门店">
          <div class="section-heading">
            <strong>{{
              searching === 'AMAP' ? '正在查询高德…' : `高德候选 ${candidates.length} 家`
            }}</strong
            ><span>核对名称、地址和位置后选择</span>
          </div>
          <div
            v-for="poi in candidates"
            :key="poi.id"
            class="candidate"
            :class="{ selected: selectedPoi?.id === poi.id }"
          >
            <div class="candidate-copy">
              <strong>{{ poi.name }}</strong
              ><span>{{ areaLabel(poi.areaCode) }} · {{ poi.address || '地址未提供' }}</span
              ><small>{{ poiType(poi) }} · {{ poi.publicPhone || '未提供电话' }}</small
              ><small>POI {{ poi.id }} · {{ poi.longitude }}, {{ poi.latitude }}</small>
            </div>
            <el-button
              size="small"
              :type="selectedPoi?.id === poi.id ? 'primary' : 'default'"
              @click="selectPoi(poi)"
              >{{ selectedPoi?.id === poi.id ? '已选择' : '选择门店' }}</el-button
            >
          </div>
          <p v-if="!searching && !candidates.length" class="hint">
            未找到候选门店，可调整名称或地区，也可以手动提报。
          </p>
        </section>
        <div v-if="selectedPoi" class="selected-note" role="status">
          <el-icon><CircleCheck /></el-icon><span>将核验「{{ selectedPoi.name }}」并查重入库。</span
          ><el-button link type="primary" @click="manual(selectedPoi)"
            >资料不符，改为手动提报</el-button
          >
        </div>
        <section v-if="mode === 'MANUAL'" class="manual-fields" aria-label="手动门店资料">
          <div class="section-heading">
            <strong>手动提报资料</strong><span>审核通过后入公海</span>
          </div>
          <el-form-item label="门店所属区县" required
            ><el-select-v2
              v-model="form.areaCode"
              :options="countyOptions"
              filterable
              aria-label="新增所属区县"
              placeholder="请选择完整省市区县"
          /></el-form-item>
          <el-form-item label="详细地址" required
            ><el-input
              v-model="form.address"
              aria-label="新增详细地址"
              maxlength="500"
              placeholder="街道、门牌号、楼层等"
          /></el-form-item>
          <div class="search-grid">
            <el-form-item label="门店类型" required
              ><el-cascader
                v-model="form.storeTypeCode"
                :options="catalog.options"
                :props="{ emitPath: false, checkStrictly: true }"
                filterable
                aria-label="新增门店类型"
                placeholder="选择门店分类"
            /></el-form-item>
            <el-form-item label="公开电话"
              ><el-input
                v-model="form.publicPhone"
                aria-label="新增公开电话"
                maxlength="50"
                placeholder="选填，未核实可留空"
            /></el-form-item>
          </div>
          <el-form-item label="门店位置" required
            ><p v-if="locationNeedsCheck" class="hint">
              所属区县已变化，请重新定位门店或在地图选点。
            </p>
            <CrmStoreLocationPicker
              :longitude="form.longitude"
              :latitude="form.latitude"
              :coordinate-system="form.coordinateSystem"
              :area-code="form.areaCode"
              :disabled="saving"
              @picked="pickPosition"
          /></el-form-item>
        </section>
      </el-form>
      <p v-if="saveError" class="error" role="alert">{{ saveError }}</p>
    </template>
    <template #footer>
      <div class="intake-footer">
        <span class="hint">{{
          completed ? '入库不会自动分配负责人' : '已有门店请维护原档案，包含私海和停业门店'
        }}</span>
        <div v-if="completed">
          <el-button @click="emit('close')">完成</el-button
          ><el-button
            v-if="completed.storeId && context?.permissions.includes('crm:pool:public-read')"
            type="primary"
            @click="emit('navigate', 'PUBLIC', completed.storeId)"
            >前往公海</el-button
          ><el-button
            v-else-if="!completed.storeId && context?.permissions.includes('crm:lead:read')"
            type="primary"
            @click="emit('navigate', 'LEADS')"
            >查看提报</el-button
          >
        </div>
        <div v-else>
          <el-button :disabled="saving" @click="close">取消</el-button
          ><el-button v-if="selectedPoi" type="primary" :loading="saving" @click="admit"
            >确认入公海</el-button
          ><el-button
            v-else-if="mode === 'MANUAL'"
            type="primary"
            :loading="saving"
            :disabled="loadingContext || !!contextError"
            @click="submit"
            >{{ lead ? '重新提交审核' : '提交审核' }}</el-button
          >
        </div>
      </div>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { CircleCheck, Search } from '@element-plus/icons-vue'
import {
  crmStoreApi,
  type StoreAdmission,
  type StoreContext,
  type StoreLead,
  type StoreLeadCommand,
  type StorePoi,
  type StoreMatch,
  type StoreView,
} from '@/api/core/crm-store'
import type { DictItemView } from '@/api/core/business-settings'
import {
  storeLeadAreaOptions,
  storePoiErrorMessage,
  STORE_BUSINESS_STATUS_LABELS,
  storeWorkBlocked,
} from '@/utils/crm-store'
import { storeClassificationCatalog } from '@/utils/crm-store-classification'
import CrmStoreLocationPicker from './CrmStoreLocationPicker.vue'
const props = defineProps<{
  storeTypes: DictItemView[]
  statuses: DictItemView[]
  lead?: StoreLead
  initialArea?: string
  initialKeyword?: string
}>()
const emit = defineEmits<{ close: []; saved: []; navigate: [view: StoreView, id?: string] }>()
const context = ref<StoreContext | null>(null),
  loadingContext = ref(true),
  contextError = ref('')
const mode = ref<'SEARCH' | 'MANUAL'>(props.lead ? 'MANUAL' : 'SEARCH')
const form = reactive({
  requestId: crypto.randomUUID(),
  name: props.lead?.name ?? props.initialKeyword ?? '',
  address: props.lead?.address ?? '',
  areaCode: props.lead?.areaCode ?? '',
  longitude: props.lead?.longitude ?? undefined,
  latitude: props.lead?.latitude ?? undefined,
  coordinateSystem: props.lead?.coordinateSystem ?? 'GCJ02',
  storeTypeCode: props.lead?.storeTypeCode ?? '',
  publicPhone: props.lead?.publicPhone ?? '',
})
const locationNeedsCheck = ref(false)
watch(
  () => form.areaCode,
  () => {
    locationNeedsCheck.value = form.longitude != null || form.latitude != null
    form.longitude = undefined
    form.latitude = undefined
  },
  { flush: 'sync' },
)
const searchArea = ref(props.lead?.areaCode ?? props.initialArea ?? '')
const searchAreaOptions = computed(() => storeLeadAreaOptions(context.value?.areas ?? [], true))
const countyOptions = computed(() => storeLeadAreaOptions(context.value?.areas ?? []))
const labels = computed(() => new Map(searchAreaOptions.value.map((a) => [a.value, a.label])))
const areaLabel = (code: string) => labels.value.get(code) ?? code
const catalog = computed(() => storeClassificationCatalog(props.storeTypes))
const businessLabel = (code: string) =>
  props.statuses.find((s) => s.dictionaryItemCode === code)?.dictionaryItemName ??
  STORE_BUSINESS_STATUS_LABELS[code] ??
  code
const workBlocked = storeWorkBlocked
const poiType = (poi: StorePoi) =>
  poi.typeCode
    ?.split(';')
    .map((c) => catalog.value.paths.get(`POI_${c}`))
    .find(Boolean) ?? '分类待核实'
const existing = ref<StoreMatch[]>([]),
  candidates = ref<StorePoi[]>([]),
  selectedPoi = ref<StorePoi | null>(null)
const lookupDone = ref(false),
  poiSearched = ref(false),
  searching = ref<'LOCAL' | 'AMAP' | null>(null),
  queryError = ref(''),
  saveError = ref(''),
  saving = ref(false)
const completed = ref<StoreAdmission | { storeId: null } | null>(null)
let generation = 0,
  disposed = false
onBeforeUnmount(() => {
  disposed = true
  generation++
})
onMounted(async () => {
  try {
    const result = await crmStoreApi.intakeContext()
    if (disposed) return
    context.value = result
    if (result.emptyScopeReason) contextError.value = result.emptyScopeReason
    if (!searchAreaOptions.value.some((a) => a.value === searchArea.value)) searchArea.value = ''
    if (!searchArea.value) {
      const cities = result.areas.filter((a) => a.level === 'PREFECTURE')
      if (cities.length === 1) searchArea.value = cities[0].code
    }
  } catch (e) {
    contextError.value = storePoiErrorMessage(e)
  } finally {
    loadingContext.value = false
  }
})
watch(
  () => [form.name, searchArea.value],
  () => {
    generation++
    existing.value = []
    candidates.value = []
    selectedPoi.value = null
    lookupDone.value = false
    poiSearched.value = false
    searching.value = null
    queryError.value = ''
    saveError.value = ''
  },
  { flush: 'sync' },
)
function close() {
  if (!saving.value) emit('close')
}
function destination(row: StoreMatch): StoreView | null {
  const permissions = context.value?.permissions ?? []
  if (
    row.poolType === 'PUBLIC' &&
    !storeWorkBlocked(row) &&
    row.recordStatus === 'ACTIVE' &&
    permissions.includes('crm:pool:public-read')
  )
    return 'PUBLIC'
  return permissions.includes('crm:store:library-read') ? 'ALL' : null
}
function searchValid() {
  if (loadingContext.value || contextError.value || saving.value) return false
  if (!form.name.trim() || !labels.value.has(searchArea.value)) {
    queryError.value = '请填写门店名称并选择查找地区'
    return false
  }
  return true
}
async function lookup() {
  if (!searchValid()) return
  const current = ++generation
  searching.value = 'LOCAL'
  queryError.value = ''
  existing.value = []
  candidates.value = []
  selectedPoi.value = null
  poiSearched.value = false
  lookupDone.value = false
  try {
    const rows = await crmStoreApi.intakeLookup(form.name.trim(), searchArea.value)
    if (current === generation) {
      existing.value = rows
      lookupDone.value = true
    }
  } catch (e) {
    if (current === generation) queryError.value = storePoiErrorMessage(e)
  } finally {
    if (current === generation) searching.value = null
  }
}
async function searchAmap() {
  if (props.lead || !searchValid() || !lookupDone.value) return
  const current = ++generation
  searching.value = 'AMAP'
  queryError.value = ''
  poiSearched.value = true
  selectedPoi.value = null
  candidates.value = []
  try {
    const rows = await crmStoreApi.intakeCandidates(form.name.trim(), searchArea.value)
    if (current === generation) candidates.value = rows
  } catch (e) {
    if (current === generation) queryError.value = `${storePoiErrorMessage(e)} 可手动提报。`
  } finally {
    if (current === generation) searching.value = null
  }
}
function selectPoi(poi: StorePoi) {
  if (saving.value) return
  selectedPoi.value = poi
  mode.value = 'SEARCH'
  saveError.value = ''
  form.requestId = crypto.randomUUID()
}
function manual(poi?: StorePoi) {
  if (saving.value) return
  if (poi) {
    form.name = poi.name
    form.areaCode = poi.areaCode
    form.address = poi.address ?? ''
    form.longitude = poi.longitude
    form.latitude = poi.latitude
    form.coordinateSystem = 'GCJ02'
    locationNeedsCheck.value = false
    form.publicPhone = poi.publicPhone ?? ''
    form.storeTypeCode =
      poi.typeCode
        ?.split(';')
        .map((c) => catalog.value.byCode.get(`POI_${c}`))
        .find((v) => v && v.enabled !== false)?.dictionaryItemCode ?? ''
  } else if (countyOptions.value.some((a) => a.value === searchArea.value))
    form.areaCode = searchArea.value
  selectedPoi.value = null
  mode.value = 'MANUAL'
  saveError.value = ''
  form.requestId = crypto.randomUUID()
}
function pickPosition(longitude: number, latitude: number, coordinateSystem: string) {
  Object.assign(form, { longitude, latitude, coordinateSystem })
  locationNeedsCheck.value = false
}
async function admit() {
  if (props.lead || !selectedPoi.value || saving.value || contextError.value) return
  saving.value = true
  saveError.value = ''
  try {
    completed.value = await crmStoreApi.admit(selectedPoi.value.id, form.requestId)
    emit('saved')
  } catch (e) {
    saveError.value = storePoiErrorMessage(e)
  } finally {
    saving.value = false
  }
}
async function submit() {
  if (saving.value || loadingContext.value || contextError.value) return
  if (
    !form.name.trim() ||
    !form.address.trim() ||
    !countyOptions.value.some((a) => a.value === form.areaCode) ||
    !form.storeTypeCode ||
    form.longitude == null ||
    form.latitude == null
  ) {
    saveError.value = '请补全名称、区县、详细地址、门店类型和门店位置'
    return
  }
  saving.value = true
  saveError.value = ''
  const command: StoreLeadCommand = {
    ...form,
    name: form.name.trim(),
    address: form.address.trim(),
    longitude: form.longitude,
    latitude: form.latitude,
    publicPhone: form.publicPhone.trim() || null,
  }
  try {
    if (props.lead) await crmStoreApi.resubmit(props.lead, command)
    else await crmStoreApi.submit(command)
    completed.value = { storeId: null }
    emit('saved')
  } catch (e) {
    saveError.value = storePoiErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.intake-note,
.hint,
.section-heading > span,
.search-actions > span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.intake-note {
  margin: 0 0 16px;
}
.search-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.search-grid :deep(.el-cascader),
:deep(.el-select-v2) {
  width: 100%;
}
.search-actions,
.source-actions,
.section-heading,
.candidate,
.selected-note,
.intake-footer {
  display: flex;
  align-items: center;
  gap: 12px;
}
.section-heading,
.intake-footer {
  justify-content: space-between;
}
.section-heading {
  margin-bottom: 8px;
  font-size: 13px;
}
.intake-results,
.manual-fields {
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 16px;
  padding-top: 14px;
}
.intake-results {
  max-height: 280px;
  overflow: auto;
}
.candidate {
  justify-content: space-between;
  padding: 10px 8px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.candidate.selected {
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
}
.candidate-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.candidate-copy strong {
  color: var(--el-text-color-primary);
}
.candidate-copy span,
.candidate-copy small {
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.candidate :deep(.el-button) {
  flex-shrink: 0;
}
.source-actions {
  margin-top: 12px;
}
.selected-note {
  margin-top: 12px;
  flex-wrap: wrap;
  color: var(--el-color-primary);
  font-size: 13px;
}
.error {
  color: var(--el-color-danger);
  margin: 12px 0 0;
  line-height: 1.6;
}
.intake-complete {
  text-align: center;
  padding: 28px 12px;
}
.intake-complete p {
  color: var(--el-text-color-secondary);
}
.success-icon {
  color: var(--el-color-success);
  font-size: 32px;
}
.intake-footer > div {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}
.intake-footer :deep(.el-button + .el-button) {
  margin-left: 0;
}
@media (max-width: 600px) {
  .search-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .intake-footer,
  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .intake-footer > div {
    align-self: flex-end;
  }
}
</style>
<style>
.store-intake-dialog .el-dialog__body {
  max-height: calc(100dvh - 190px);
  overflow-y: auto;
}
</style>
