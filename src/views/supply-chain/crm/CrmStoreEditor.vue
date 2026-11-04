<template>
  <el-dialog
    :model-value="true"
    title="完善门店资料"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="!$event && emit('close')"
  >
    <el-form label-position="top" @submit.prevent>
      <el-form-item label="门店名称" required>
        <el-input v-model="form.name" aria-label="维护门店名称" maxlength="200" />
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
            :loading="searching"
            :disabled="loadingAreas || !!areaError"
            @click="searchPoi"
          >
            从高德补全
          </el-button>
        </div>
        <span v-if="areaError" class="error" role="alert">{{ areaError }}</span>
      </el-form-item>
      <section v-if="searched || searching" class="poi-results" aria-label="高德候选门店">
        <div class="result-heading">
          <span>核对同名门店后填入资料</span>
          <span class="hint">最多 20 条，可修改名称缩小范围</span>
        </div>
        <p v-if="searchError" class="error" role="alert">{{ searchError }}</p>
        <p v-else-if="!searching && !candidates.length" class="hint">
          所选地区未找到可确认的门店，请核对名称和区县，也可以手动维护。
        </p>
        <div v-for="poi in candidates" :key="poi.id" class="poi-candidate">
          <div class="poi-copy">
            <strong>{{ poi.name }}</strong>
            <span>{{ areaLabel(poi.areaCode) }} · {{ poi.address || '地址未提供' }}</span>
            <span class="hint">{{ poi.id }} · {{ poi.publicPhone || '未提供公开电话' }}</span>
          </div>
          <el-button
            size="small"
            :type="selectedPoi?.id === poi.id ? 'primary' : 'default'"
            @click="applyPoi(poi)"
            >{{ selectedPoi?.id === poi.id ? '已填入' : '确认填入' }}</el-button
          >
        </div>
      </section>
      <p class="poi-status" aria-live="polite">
        高德 POI：{{ selectedPoi?.id || store.primaryPoi || '未关联' }}
        <span v-if="selectedPoi" class="hint">本次确认，保存后生效</span>
        <el-button v-if="selectedPoi" link type="primary" @click="undoPoi">撤销填入</el-button>
      </p>
      <el-form-item label="详细地址" required>
        <el-input v-model="form.address" aria-label="维护详细地址" maxlength="500" />
      </el-form-item>
      <div class="form-grid">
        <el-form-item label="经度">
          <el-input
            v-model.number="form.longitude"
            aria-label="维护经度"
            :disabled="!!selectedPoi"
          />
        </el-form-item>
        <el-form-item label="纬度">
          <el-input
            v-model.number="form.latitude"
            aria-label="维护纬度"
            :disabled="!!selectedPoi"
          />
        </el-form-item>
        <el-form-item label="坐标系">
          <el-select
            v-model="form.coordinateSystem"
            aria-label="维护坐标系"
            :disabled="!!selectedPoi"
          >
            <el-option label="高德 GCJ-02" value="GCJ02" />
            <el-option label="GPS WGS-84" value="WGS84" />
          </el-select>
        </el-form-item>
      </div>
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
          <el-input v-model="form.publicPhone" aria-label="维护公开电话" maxlength="50" />
        </el-form-item>
      </div>
      <el-form-item label="修改原因" required>
        <el-input
          v-model="reason"
          type="textarea"
          aria-label="维护修改原因"
          maxlength="500"
          placeholder="说明核实依据，例如：核对门头和地址，修正所属区县"
          :rows="2"
        />
      </el-form-item>
      <p class="hint">地区变更会同步更新区域统计和数据可见范围；高德未提供的字段保留原值。</p>
    </el-form>
    <template #footer>
      <el-button :disabled="saving" @click="emit('close')">取消</el-button>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="loadingAreas || !!areaError"
        @click="save"
      >
        保存并留痕
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { crmStoreApi, type AdminArea, type StorePoi, type StoreRow } from '@/api/core/crm-store'
import type { DictItemView } from '@/api/core/business-settings'
import { storeLeadAreaOptions, storePoiErrorMessage } from '@/utils/crm-store'
import { storeClassificationCatalog } from '@/utils/crm-store-classification'

const props = defineProps<{ store: StoreRow; storeTypes: DictItemView[] }>()
const emit = defineEmits<{ close: []; saved: [id: string] }>()
const form = reactive({ ...props.store })
const reason = ref('')
const areas = ref<AdminArea[]>([])
const loadingAreas = ref(true),
  areaError = ref('')
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

onMounted(async () => {
  try {
    areas.value = (await crmStoreApi.context('ALL')).areas
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
  () => form.areaCode,
  () => {
    generation++
    candidates.value = []
    selectedPoi.value = null
    searched.value = false
    searching.value = false
    searchError.value = ''
  },
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
  if (!selectedPoi.value) beforePoi = { ...form }
  selectedPoi.value = poi
  form.name = poi.name
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
  if (beforePoi) Object.assign(form, beforePoi)
  selectedPoi.value = null
  beforePoi = null
}
async function save() {
  if (
    !form.name.trim() ||
    !form.address.trim() ||
    !reason.value.trim() ||
    !areaLabels.value.has(form.areaCode)
  ) {
    ElMessage.warning('请填写门店名称、所属地区、详细地址和修改原因')
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
    )
    ElMessage.success('已保存并记录变更')
    emit('saved', form.id)
  } catch (error) {
    ElMessage.error(errorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.area-search {
  display: flex;
  width: 100%;
  gap: 10px;
}
.area-search :deep(.el-select-v2) {
  flex: 1;
  min-width: 0;
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
  border-block: 1px solid var(--el-border-color-lighter);
  margin: 0 0 12px;
  padding: 10px 0;
  max-height: 240px;
  overflow: auto;
}
.result-heading,
.poi-candidate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.result-heading {
  font-size: 13px;
  margin-bottom: 6px;
}
.poi-candidate {
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.poi-candidate:last-child {
  border: 0;
}
.poi-copy {
  display: grid;
  gap: 4px;
  font-size: 12px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.poi-copy strong {
  font-size: 14px;
}
.poi-status {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin: 0 0 16px;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.error {
  color: var(--el-color-danger);
  font-size: 12px;
}
@media (max-width: 600px) {
  .form-grid,
  .two-columns {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .result-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 0;
  }
}
</style>
