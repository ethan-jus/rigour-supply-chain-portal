<template>
  <el-dialog
    :model-value="true"
    title="维护门店资料"
    width="min(760px, calc(100vw - 32px))"
    align-center
    class="store-editor-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    @update:model-value="!$event && close()"
  >
    <el-form label-position="top" :disabled="saving" @submit.prevent>
      <section class="editor-section" aria-label="门店匹配">
        <div class="section-heading">
          <h3>门店匹配</h3>
          <span>按名称与地区查询，核对后填入</span>
        </div>
        <el-form-item label="门店名称" required>
          <el-input
            v-model="form.name"
            aria-label="维护门店名称"
            maxlength="200"
            placeholder="输入完整门店名称，提高匹配准确度"
          />
        </el-form-item>
        <el-form-item label="所属地区 · 省 / 市 / 区县" required>
          <div class="area-search">
            <el-select-v2
              v-model="form.areaCode"
              :options="areaOptions"
              filterable
              :loading="loadingAreas"
              aria-label="维护所属地区"
              placeholder="搜索省、市或区县，选择完整地区"
            />
            <el-button
              type="primary"
              plain
              :loading="searching"
              :disabled="
                saving ||
                loadingAreas ||
                !!areaError ||
                !form.name.trim() ||
                !areaLabels.has(form.areaCode)
              "
              @click="searchPoi"
            >
              <el-icon><Search /></el-icon><span>从高德补全</span>
            </el-button>
          </div>
          <span v-if="areaError" class="error" role="alert">{{ areaError }}</span>
        </el-form-item>
        <section
          v-if="searched || searching"
          class="poi-results"
          aria-label="高德候选门店"
          :aria-busy="searching"
        >
          <div class="result-heading">
            <strong>{{
              searching
                ? '正在查询门店…'
                : searchError
                  ? '查询未完成'
                  : `找到 ${candidates.length} 家候选门店`
            }}</strong>
            <span v-if="!searchError && !searching" class="hint">最多展示 20 家</span>
          </div>
          <div v-if="searchError" class="query-error" role="alert">
            <p>{{ searchError }}</p>
            <span class="hint">可继续手动完善资料并保存。</span>
            <el-button link type="primary" @click="searchPoi">重新查询</el-button>
          </div>
          <p v-else-if="!searching && !candidates.length" class="hint">
            所选地区未找到门店，可调整名称或区县后重试。
          </p>
          <div v-for="poi in candidates" :key="poi.id" class="poi-candidate">
            <div class="poi-copy">
              <strong>{{ poi.name }}</strong>
              <span>{{ areaLabel(poi.areaCode) }} · {{ poi.address || '地址未提供' }}</span>
              <span class="hint">{{ poiTypeLabel(poi) }}</span>
              <span class="hint">{{ poi.publicPhone || '未提供公开电话' }} · POI {{ poi.id }}</span>
            </div>
            <el-button
              size="small"
              :type="selectedPoi?.id === poi.id ? 'primary' : 'default'"
              @click="applyPoi(poi)"
            >
              {{ selectedPoi?.id === poi.id ? '已填入' : '确认填入' }}
            </el-button>
          </div>
        </section>
        <div v-if="selectedPoi" class="poi-confirmed" role="status">
          <el-icon><CircleCheck /></el-icon>
          <div>
            <strong>已填入「{{ selectedPoi.name }}」</strong
            ><span>地址、坐标、类型和电话按高德返回补全，缺失字段保留原值；保存后生效。</span>
          </div>
          <el-button link type="primary" @click="undoPoi">撤销填入</el-button>
        </div>
      </section>
      <section class="editor-section" aria-label="门店资料">
        <div class="section-heading">
          <h3>门店资料</h3>
          <span class="poi-identity"
            >POI {{ selectedPoi?.id || store.primaryPoi || '未关联' }}</span
          >
        </div>
        <el-form-item label="详细地址" required>
          <el-input
            v-model="form.address"
            aria-label="维护详细地址"
            maxlength="500"
            placeholder="街道、门牌号、楼层等"
          />
        </el-form-item>
        <div class="form-grid two-columns">
          <el-form-item label="门店类型">
            <el-cascader
              v-model="form.storeTypeCode"
              :options="catalog.options"
              :props="{ emitPath: false, checkStrictly: true }"
              filterable
              clearable
              aria-label="维护门店类型"
              placeholder="选择门店行业分类"
            />
          </el-form-item>
          <el-form-item label="公开电话">
            <el-input
              v-model="form.publicPhone"
              aria-label="维护公开电话"
              maxlength="50"
              placeholder="门店公开联系电话"
            />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="经度"
            ><el-input
              v-model.number="form.longitude"
              aria-label="维护经度"
              :disabled="saving || !!selectedPoi"
          /></el-form-item>
          <el-form-item label="纬度"
            ><el-input
              v-model.number="form.latitude"
              aria-label="维护纬度"
              :disabled="saving || !!selectedPoi"
          /></el-form-item>
          <el-form-item label="坐标系">
            <el-select
              v-model="form.coordinateSystem"
              aria-label="维护坐标系"
              :disabled="saving || !!selectedPoi"
            >
              <el-option label="高德 GCJ-02" value="GCJ02" /><el-option
                label="GPS WGS-84"
                value="WGS84"
              />
            </el-select>
          </el-form-item>
        </div>
      </section>
      <section class="editor-section" aria-label="经营情况与变更依据">
        <el-form-item label="经营状态">
          <el-select
            v-model="form.businessStatus"
            aria-label="维护经营状态"
            :disabled="saving || store.recordStatus !== 'ACTIVE' || !statusOptions.length"
            placeholder="选择核实后的经营状态"
          >
            <el-option
              v-for="item in statusOptions"
              :key="item.dictionaryItemCode"
              :value="item.dictionaryItemCode"
              :label="item.dictionaryItemName"
            />
          </el-select>
          <span v-if="!statusOptions.length" class="hint"
            >经营状态字典未加载，可先维护其他资料。</span
          >
        </el-form-item>
        <el-alert
          v-if="statusChanged && form.businessStatus === 'CLOSED'"
          title="已停业将结束当前归属，原归属人进入48小时认领冷却，停止认领及新作业；门店、拜访和成交历史保留。"
          type="warning"
          :closable="false"
          show-icon
          class="status-notice"
        />
        <el-alert
          v-else-if="statusChanged && form.businessStatus === 'TEMP_CLOSED'"
          title="暂时停业保留归属和原保护期限，暂停新拜访与开单。"
          type="info"
          :closable="false"
          class="status-notice"
        />
        <el-alert
          v-else-if="statusChanged && store.businessStatus === 'CLOSED'"
          title="恢复可作业状态后进入公海，不恢复历史归属；原归属人的48小时冷却继续生效。"
          type="info"
          :closable="false"
          class="status-notice"
        />
        <el-form-item :label="statusChanged ? '修改原因 / 经营状态核实依据' : '修改原因'" required>
          <el-input
            v-model="reason"
            type="textarea"
            aria-label="维护修改原因"
            maxlength="500"
            :placeholder="
              statusChanged
                ? '说明资料变更和经营状态的核实依据，例如：现场确认已撤店，更新联系电话'
                : '例如：核对门头与地址，确认高德候选门店并补全资料'
            "
            :rows="2"
          />
        </el-form-item>
        <p v-if="saveError" class="error save-error" role="alert">{{ saveError }}</p>
      </section>
    </el-form>
    <template #footer>
      <div class="editor-footer">
        <span class="hint">变更记录包含修改人、时间及修改前后内容</span>
        <div>
          <el-button :disabled="saving" @click="close">取消</el-button
          ><el-button
            type="primary"
            :loading="saving"
            :disabled="loadingAreas || !!areaError"
            @click="save"
            >保存并留痕</el-button
          >
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, Search } from '@element-plus/icons-vue'
import { crmStoreApi, type AdminArea, type StorePoi, type StoreRow } from '@/api/core/crm-store'
import type { DictItemView } from '@/api/core/business-settings'
import { storeLeadAreaOptions, storePoiErrorMessage } from '@/utils/crm-store'
import { storeClassificationCatalog } from '@/utils/crm-store-classification'

const props = defineProps<{
  store: StoreRow
  storeTypes: DictItemView[]
  statuses: DictItemView[]
}>()
const emit = defineEmits<{ close: []; saved: [id: string] }>()
const form = reactive({ ...props.store })
const reason = ref('')
const statusChanged = computed(() => form.businessStatus !== props.store.businessStatus)
const statusOptions = computed(() =>
  props.statuses.filter(
    (item) =>
      item.enabled !== false &&
      ['UNKNOWN', 'OPEN', 'TEMP_CLOSED', 'CLOSED'].includes(item.dictionaryItemCode),
  ),
)
const areas = ref<AdminArea[]>([])
const loadingAreas = ref(true),
  areaError = ref('')
const saveError = ref('')
const areaOptions = computed(() => storeLeadAreaOptions(areas.value))
const areaLabels = computed(
  () => new Map(areaOptions.value.map((option) => [option.value, option.label])),
)
const catalog = computed(() => storeClassificationCatalog(props.storeTypes))
const candidates = ref<StorePoi[]>([])
const selectedPoi = ref<StorePoi | null>(null)
let beforePoi: StoreRow | null = null
const searching = ref(false),
  searched = ref(false),
  searchError = ref(''),
  saving = ref(false)
let generation = 0
const errorMessage = storePoiErrorMessage
const areaLabel = (code: string) => areaLabels.value.get(code) ?? code
const poiTypeLabel = (poi: StorePoi) =>
  poi.typeCode
    ?.split(';')
    .map((code) => catalog.value.paths.get(`POI_${code}`))
    .find(Boolean) || '高德未提供可匹配的分类'
function close() {
  if (!saving.value) emit('close')
}

onMounted(async () => {
  try {
    areas.value = (await crmStoreApi.maintenanceContext(props.store.id)).areas
  } catch (error) {
    areaError.value = errorMessage(error)
  } finally {
    loadingAreas.value = false
  }
})
onBeforeUnmount(() => {
  generation++
})
watch(
  () => [form.name, form.areaCode],
  () => {
    generation++
    candidates.value = []
    selectedPoi.value = null
    searched.value = false
    searching.value = false
    searchError.value = ''
    beforePoi = null
  },
  { flush: 'sync' },
)
async function searchPoi() {
  if (!form.name.trim() || !areaLabels.value.has(form.areaCode)) {
    ElMessage.warning('请先填写门店名称，并选择所属省市区县')
    return
  }
  const current = ++generation
  searching.value = true
  searched.value = true
  searchError.value = ''
  candidates.value = []
  try {
    const result = await crmStoreApi.poiCandidates(form.id, form.name.trim(), form.areaCode)
    if (current === generation) candidates.value = result
  } catch (error) {
    if (current === generation) searchError.value = errorMessage(error)
  } finally {
    if (current === generation) searching.value = false
  }
}
function applyPoi(poi: StorePoi) {
  if (poi.areaCode !== form.areaCode) return
  const original = beforePoi ?? { ...form }
  form.name = poi.name
  beforePoi = original
  selectedPoi.value = poi
  if (poi.address?.trim()) form.address = poi.address
  if (poi.publicPhone?.trim()) form.publicPhone = poi.publicPhone
  form.longitude = poi.longitude
  form.latitude = poi.latitude
  form.coordinateSystem = 'GCJ02'
  const type = poi.typeCode
    ?.split(';')
    .map((code) => catalog.value.byCode.get(`POI_${code}`))
    .find((item) => item && item.enabled !== false)
  if (type) form.storeTypeCode = type.canonicalItemCode || type.dictionaryItemCode
}
function undoPoi() {
  if (beforePoi) Object.assign(form, beforePoi, { businessStatus: form.businessStatus })
  selectedPoi.value = null
  beforePoi = null
}
async function save() {
  if (saving.value) return
  if (
    !form.name.trim() ||
    !form.address.trim() ||
    !reason.value.trim() ||
    !areaLabels.value.has(form.areaCode)
  ) {
    ElMessage.warning('请填写门店名称、所属地区、详细地址和修改原因')
    return
  }
  if (
    statusChanged.value &&
    (props.store.recordStatus !== 'ACTIVE' ||
      !statusOptions.value.some((item) => item.dictionaryItemCode === form.businessStatus))
  ) {
    ElMessage.warning('请选择字典中启用的经营状态，归档门店不可修改经营状态')
    return
  }
  const longitude =
    form.longitude === null || String(form.longitude).trim() === '' ? null : Number(form.longitude)
  const latitude =
    form.latitude === null || String(form.latitude).trim() === '' ? null : Number(form.latitude)
  if (
    (longitude === null) !== (latitude === null) ||
    (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180)) ||
    (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) ||
    (longitude !== null && !['GCJ02', 'WGS84'].includes(form.coordinateSystem ?? ''))
  ) {
    ElMessage.warning('请填写成对的有效经纬度并选择坐标系')
    return
  }
  saveError.value = ''
  saving.value = true
  try {
    await crmStoreApi.update(
      {
        ...form,
        longitude,
        latitude,
        coordinateSystem: longitude === null ? null : form.coordinateSystem,
      },
      reason.value.trim(),
      selectedPoi.value?.id,
      statusChanged.value
        ? { status: form.businessStatus, reason: reason.value.trim() }
        : undefined,
    )
    ElMessage.success('已保存并记录变更')
    emit('saved', form.id)
  } catch (error) {
    saveError.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.editor-section + .editor-section {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 16px;
  margin-top: 16px;
}
.section-heading,
.result-heading,
.poi-candidate,
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.section-heading {
  margin-bottom: 14px;
}
.section-heading h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}
.section-heading > span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.editor-section :deep(.el-form-item) {
  margin-bottom: 16px;
}
.editor-section :deep(.el-form-item__label) {
  margin-bottom: 6px;
}
.status-notice {
  margin-bottom: 16px;
}
.area-search {
  display: flex;
  width: 100%;
  gap: 10px;
}
.area-search :deep(.el-select-v2) {
  flex: 1;
  min-width: 0;
}
.area-search .el-button {
  flex-shrink: 0;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.two-columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.form-grid :deep(.el-cascader),
.form-grid :deep(.el-select) {
  width: 100%;
}
.poi-results {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px;
  max-height: 228px;
  overflow: auto;
}
.result-heading {
  font-size: 13px;
}
.poi-candidate {
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.poi-candidate:last-child {
  border: 0;
  padding-bottom: 0;
}
.poi-candidate .el-button {
  flex-shrink: 0;
}
.poi-copy {
  display: grid;
  gap: 4px;
  font-size: 13px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.poi-copy strong {
  font-size: 14px;
}
.poi-confirmed {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  margin-top: 12px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.poi-confirmed > div {
  display: grid;
  flex: 1;
  gap: 4px;
  font-size: 13px;
}
.poi-confirmed span {
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.6;
}
.poi-identity {
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.query-error p,
.error {
  color: var(--el-color-danger);
  font-size: 13px;
  line-height: 1.6;
}
.query-error p {
  margin: 8px 0 4px;
}
.query-error .el-button {
  margin-left: 10px;
}
.save-error {
  margin: 0;
}
.editor-footer > div {
  display: flex;
  flex-shrink: 0;
}
@media (max-width: 600px) {
  .form-grid,
  .two-columns {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .section-heading,
  .editor-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
  .editor-footer > div {
    align-self: flex-end;
  }
  .area-search {
    flex-wrap: wrap;
  }
  .area-search :deep(.el-select-v2) {
    flex-basis: 100%;
  }
}
</style>
<style>
.store-editor-dialog {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 40px);
}
.store-editor-dialog .el-dialog__body {
  min-height: 0;
  overflow: auto;
}
.store-editor-dialog .el-dialog__header {
  padding-bottom: 16px;
}
.store-editor-dialog .el-dialog__footer {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 14px;
}
</style>
