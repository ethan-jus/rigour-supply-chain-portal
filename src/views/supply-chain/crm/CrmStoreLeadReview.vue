<template>
  <el-dialog
    :model-value="true"
    :title="readOnly ? '门店提报详情' : approve ? '审核门店提报' : '退回门店提报'"
    width="min(680px, calc(100vw - 32px))"
    align-center
    :close-on-click-modal="false"
    :show-close="!saving"
    :close-on-press-escape="!saving"
    @update:model-value="!$event && !saving && emit('close')"
  >
    <el-descriptions :column="1" border>
      <el-descriptions-item label="提报人">{{
        auditActorLabel(lead.submitterUserId)
      }}</el-descriptions-item>
      <el-descriptions-item label="审核人">{{
        lead.reviewerUserId ? auditActorLabel(lead.reviewerUserId) : '尚未审核'
      }}</el-descriptions-item>
      <el-descriptions-item label="门店名称">{{ lead.name }}</el-descriptions-item>
      <el-descriptions-item label="地区">{{ areaLabel }}</el-descriptions-item>
      <el-descriptions-item label="地址">{{ lead.address }}</el-descriptions-item>
      <el-descriptions-item label="门店类型">{{ typeLabel }}</el-descriptions-item>
      <el-descriptions-item label="公开电话">{{
        lead.publicPhone || '未提供'
      }}</el-descriptions-item>
      <el-descriptions-item label="门店位置"
        ><span>{{ lead.longitude }}, {{ lead.latitude }} · {{ lead.coordinateSystem }}</span
        ><a v-if="mapUrl" :href="mapUrl" target="_blank" rel="noopener noreferrer" class="map-link"
          >地图核对</a
        ></el-descriptions-item
      >
    </el-descriptions>
    <el-descriptions v-if="readOnly" :column="1" border class="submission-facts">
      <el-descriptions-item label="数据来源">手动提报</el-descriptions-item>
      <el-descriptions-item label="审核状态">{{
        leadStatusLabels[lead.status] ?? lead.status
      }}</el-descriptions-item>
      <el-descriptions-item label="提交时间">{{ time(lead.submittedAt) }}</el-descriptions-item>
      <el-descriptions-item label="审核时间">{{ time(lead.reviewedAt) }}</el-descriptions-item>
      <el-descriptions-item label="审核意见">{{ lead.reviewReason || '—' }}</el-descriptions-item>
      <el-descriptions-item label="入库结果"
        ><el-button
          v-if="lead.resultStoreId && canViewResult"
          link
          type="primary"
          @click="emit('result', lead)"
          >查看门店</el-button
        ><span v-else>{{ lead.resultStoreId ? '已入库' : '尚未入库' }}</span></el-descriptions-item
      >
    </el-descriptions>
    <el-form
      v-if="!readOnly"
      label-position="top"
      :disabled="saving"
      class="review-form"
      @submit.prevent="save"
    >
      <template v-if="approve">
        <el-radio-group v-model="linkExisting" aria-label="审核入库方式"
          ><el-radio :value="false">核实为新门店</el-radio
          ><el-radio :value="true">关联已有门店</el-radio></el-radio-group
        >
        <div class="lookup-row">
          <el-input
            v-model="keyword"
            aria-label="审核查找门店"
            placeholder="按名称核对商家库"
          /><el-button :loading="searching" @click="lookup">查重核对</el-button>
        </div>
        <p v-if="searchError" class="error" role="alert">{{ searchError }}</p>
        <div v-if="searched" class="matches">
          <p v-if="!matches.length" class="hint">
            当前审核权限范围未查到匹配门店，入库仍会执行全库查重。
          </p>
          <div v-for="row in matches" :key="row.id" class="match">
            <div>
              <strong>{{ row.name }}</strong
              ><span>{{ row.address }}</span
              ><small
                >{{ statusLabel(row.businessStatus) }} ·
                {{ row.poolType === 'PRIVATE' ? '私海' : '无负责人' }}</small
              >
            </div>
            <el-button
              size="small"
              :type="existingId === row.id ? 'primary' : 'default'"
              @click="selectExisting(row.id)"
              >{{ existingId === row.id ? '已选择' : '关联此门店' }}</el-button
            >
          </div>
        </div>
        <el-checkbox v-if="!linkExisting" v-model="distinctConfirmed"
          >如有疑似同名门店，已核实地址与位置，确认为不同门店</el-checkbox
        >
        <p class="hint">
          {{
            linkExisting
              ? '只关联本次提报，不合并或改写已有门店的客户、归属和历史记录。'
              : '通过后进入公海，不自动认领。资料缺失或不能确认时，请退回补充。'
          }}
        </p>
      </template>
      <el-form-item :label="approve ? '审核依据' : '退回原因'" required
        ><el-input
          v-model="reason"
          type="textarea"
          :rows="3"
          maxlength="1000"
          aria-label="提报审核说明"
          placeholder="说明现场、电话或其他核验依据"
      /></el-form-item>
    </el-form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <template #footer
      ><el-button :disabled="saving" @click="emit('close')">取消</el-button
      ><el-button
        v-if="!readOnly"
        :type="approve ? 'primary' : 'danger'"
        :loading="saving"
        :disabled="!reason.trim() || (approve && linkExisting && !existingId)"
        @click="save"
        >{{ approve ? (linkExisting ? '确认关联' : '审核通过') : '退回补充' }}</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { crmStoreApi, type StoreLead, type StoreMatch, type AdminArea } from '@/api/core/crm-store'
import type { DictItemView } from '@/api/core/business-settings'
import { storeLeadAreaOptions, storeMapUrl, STORE_BUSINESS_STATUS_LABELS } from '@/utils/crm-store'
import { auditActorLabel } from '@/utils/audit-actor'
import { storeClassificationCatalog } from '@/utils/crm-store-classification'
const props = defineProps<{
  lead: StoreLead
  approve: boolean
  readOnly?: boolean
  canViewResult?: boolean
  areas: AdminArea[]
  storeTypes: DictItemView[]
  statuses: DictItemView[]
}>()
const emit = defineEmits<{ close: []; saved: []; result: [lead: StoreLead] }>()
const leadStatusLabels: Record<string, string> = {
  PENDING_REVIEW: '待审核',
  APPROVED: '已通过',
  REJECTED: '已退回',
  WITHDRAWN: '已撤回',
}
const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    : '—'
const areaLabel = computed(
  () =>
    storeLeadAreaOptions(props.areas).find((a) => a.value === props.lead.areaCode)?.label ??
    props.lead.areaCode,
)
const typeLabel = computed(
  () =>
    storeClassificationCatalog(props.storeTypes).paths.get(props.lead.storeTypeCode ?? '') ??
    '未分类，需退回补充',
)
const mapUrl = computed(() => storeMapUrl(props.lead))
const requestId = crypto.randomUUID()
const reason = ref(''),
  saving = ref(false),
  error = ref(''),
  linkExisting = ref(false),
  distinctConfirmed = ref(false),
  existingId = ref('')
const keyword = ref(props.lead.name),
  matches = ref<StoreMatch[]>([]),
  searching = ref(false),
  searched = ref(false),
  searchError = ref('')
const statusLabel = (code: string) =>
  props.statuses.find((item) => item.dictionaryItemCode === code)?.dictionaryItemName ??
  STORE_BUSINESS_STATUS_LABELS[code] ??
  code
let lookupGeneration = 0
watch(
  keyword,
  () => {
    lookupGeneration++
    matches.value = []
    existingId.value = ''
    searched.value = false
    searching.value = false
  },
  { flush: 'sync' },
)
onBeforeUnmount(() => {
  lookupGeneration++
})
function selectExisting(id: string) {
  existingId.value = id
  linkExisting.value = true
}
async function lookup() {
  if (searching.value || !keyword.value.trim()) return
  const current = ++lookupGeneration
  searching.value = true
  searchError.value = ''
  matches.value = []
  try {
    const result = await crmStoreApi.reviewLookup(keyword.value.trim(), props.lead.areaCode)
    if (current === lookupGeneration) {
      matches.value = result
      searched.value = true
    }
  } catch (e) {
    if (current === lookupGeneration)
      searchError.value = e instanceof Error ? e.message : '查询失败'
  } finally {
    if (current === lookupGeneration) searching.value = false
  }
}
async function save() {
  if (
    props.readOnly ||
    saving.value ||
    !reason.value.trim() ||
    (props.approve && linkExisting.value && !existingId.value)
  )
    return
  saving.value = true
  error.value = ''
  try {
    await crmStoreApi.review(
      props.lead.id,
      props.lead.revision,
      props.approve,
      reason.value.trim(),
      {
        requestId,
        existingStoreId: props.approve && linkExisting.value ? existingId.value : undefined,
        distinctConfirmed: props.approve && !linkExisting.value && distinctConfirmed.value,
      },
    )
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '审核失败'
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.submission-facts {
  margin-top: 12px;
}
.review-form {
  margin-top: 16px;
}
.lookup-row {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}
.matches {
  max-height: 220px;
  overflow-y: auto;
}
.match {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding: 10px 0;
}
.match > div {
  display: grid;
  gap: 4px;
  font-size: 13px;
}
.match span,
.match small,
.hint {
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.hint {
  font-size: 12px;
}
.error {
  color: var(--el-color-danger);
}
.map-link {
  margin-left: 10px;
  color: var(--el-color-primary);
}
</style>
