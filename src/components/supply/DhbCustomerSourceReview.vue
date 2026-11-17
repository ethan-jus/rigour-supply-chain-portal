<template>
  <el-button v-if="can('integration:dhb:read') && can('crm:customer:read')" @click="open"
    >客户资料待完善</el-button
  >
  <el-dialog
    v-model="visible"
    title="客户资料待完善"
    width="min(1100px, 96vw)"
    :close-on-click-modal="false"
  >
    <el-alert v-if="error" :title="error" type="warning" :closable="false" />
    <el-alert v-if="message" :title="message" type="success" :closable="false" />
    <div class="review-query">
      <el-input
        v-model="query"
        clearable
        placeholder="客户名称或编号"
        aria-label="客户名称或编号"
      /><el-button :loading="loading" @click="load">刷新</el-button>
    </div>
    <el-table
      :data="pageRows"
      v-loading="loading"
      max-height="420"
      :empty-text="error ? '资料未加载' : '暂无待完善客户'"
    >
      <el-table-column prop="sourceCode" label="订货宝客户编号" width="160" />
      <el-table-column prop="customerName" label="客户" min-width="180" />
      <el-table-column label="业务员／地区" min-width="180"
        ><template #default="{ row }"
          >{{ row.salespersonName || '-' }}／{{ row.areaName || '-' }}</template
        ></el-table-column
      >
      <el-table-column prop="issueMessage" label="待完善内容" min-width="240" />
      <!-- @vue-generic {CustomerSourceReview} -->
      <el-table-column label="操作" width="140"
        ><template #default="{ row }"
          ><span v-if="row.issueCode === 'CUSTOMER_REVIEW_SAVED'">等待复核</span>
          <span v-else-if="row.issueCode === 'CUSTOMER_OWNER_REQUIRED'">在订货宝完善业务员</span>
          <el-button v-else link type="primary" @click="handle(row)">{{
            actionLabel(row)
          }}</el-button></template
        ></el-table-column
      >
    </el-table>
    <el-pagination
      v-if="filtered.length > 20"
      v-model:current-page="page"
      :page-size="20"
      :total="filtered.length"
      layout="total, prev, pager, next"
    />
    <template #footer><el-button @click="visible = false">关闭</el-button></template>
  </el-dialog>
  <el-dialog
    v-model="decisionVisible"
    title="核对客户"
    width="min(640px, 96vw)"
    :close-on-click-modal="false"
  >
    <p>{{ chosen?.sourceCode }} · {{ chosen?.customerName }}</p>
    <el-radio-group v-model="mode" :disabled="saving"
      ><el-radio value="EXISTING">关联已有客户</el-radio
      ><el-radio v-if="can('crm:customer:create')" value="INDEPENDENT"
        >确认独立门店</el-radio
      ></el-radio-group
    >
    <el-form label-position="top" class="decision-form">
      <el-form-item v-if="mode === 'EXISTING'" label="本系统客户" required>
        <el-select
          v-model="customerId"
          filterable
          remote
          :remote-method="search"
          :loading="searching"
          :disabled="saving"
          placeholder="按客户名称搜索并核对"
          style="width: 100%"
        >
          <el-option
            v-for="row in customers"
            :key="row.id"
            :value="String(row.id)"
            :label="`${row.customerCode} · ${row.customerName} · ${customerArea(row)} · ${row.ownerEmployeeNameSnapshot || '-'} `"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="核对说明" required
        ><el-input
          v-model="reason"
          type="textarea"
          :maxlength="1000"
          :disabled="saving"
          placeholder="填写核对结果"
      /></el-form-item>
    </el-form>
    <el-alert v-if="decisionError" :title="decisionError" type="warning" :closable="false" />
    <template #footer
      ><el-button :disabled="saving" @click="decisionVisible = false">取消</el-button
      ><el-button
        type="primary"
        :disabled="
          !can('crm:customer:write') ||
          !can('integration:dhb:write') ||
          !reason.trim() ||
          (mode === 'EXISTING' && !customerId)
        "
        :loading="saving"
        @click="save"
        >保存核对结果</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  getAllCrmCustomerAreas,
  getInternalCrmCustomers,
  type InternalCrmCustomerSummary,
} from '@/api/core/crm'
import {
  getCustomerSourceReviews,
  decideCustomerSource,
  type CustomerSourceReview,
} from '@/api/core/crm-source-reviews'
const props = defineProps<{ connectorId?: string }>()
const emit = defineEmits<{ saved: [] }>()
const { can } = useSupplyPermissions(),
  router = useRouter()
const visible = ref(false),
  loading = ref(false),
  rows = ref<CustomerSourceReview[]>([]),
  query = ref(''),
  page = ref(1),
  error = ref(''),
  message = ref('')
const filtered = computed(() =>
  rows.value.filter((row) => `${row.sourceCode} ${row.customerName}`.includes(query.value.trim())),
)
const pageRows = computed(() => filtered.value.slice((page.value - 1) * 20, page.value * 20))
watch(query, () => (page.value = 1))
let generation = 0
async function open() {
  visible.value = true
  message.value = ''
  await load()
}
async function load() {
  const version = ++generation
  loading.value = true
  error.value = ''
  try {
    const result = await getCustomerSourceReviews(props.connectorId)
    if (version === generation) {
      rows.value = result
      page.value = Math.min(page.value, Math.max(1, Math.ceil(filtered.value.length / 20)))
    }
  } catch {
    if (version === generation) error.value = '客户待完善资料暂时无法读取，请刷新重试。'
  } finally {
    if (version === generation) loading.value = false
  }
}
function actionLabel(row: CustomerSourceReview) {
  if (row.issueCode === 'CUSTOMER_EMPLOYEE_MAPPING_REQUIRED') return '关联业务员'
  if (row.issueCode === 'CUSTOMER_AREA_MAPPING_REQUIRED') return '维护归属地区'
  if (row.issueCode === 'CUSTOMER_IDENTITY_REVIEW_REQUIRED') return '核对客户'
  return '完善客户档案'
}
async function handle(row: CustomerSourceReview) {
  if (row.issueCode === 'CUSTOMER_IDENTITY_REVIEW_REQUIRED') {
    chosen.value = row
    customerId.value = ''
    mode.value = 'EXISTING'
    reason.value = ''
    decisionError.value = ''
    decisionVisible.value = true
    await Promise.all([search(row.customerName), loadAreas()])
    return
  }
  visible.value = false
  const path =
    row.issueCode === 'CUSTOMER_EMPLOYEE_MAPPING_REQUIRED'
      ? '/supply-chain/hr/employees'
      : row.issueCode === 'CUSTOMER_AREA_MAPPING_REQUIRED'
        ? '/supply-chain/crm/customers/areas'
        : '/supply-chain/crm/customers/profiles'
  await router.push(path)
}
const chosen = ref<CustomerSourceReview>(),
  decisionVisible = ref(false),
  mode = ref('EXISTING'),
  customerId = ref(''),
  reason = ref(''),
  decisionError = ref(''),
  saving = ref(false),
  searching = ref(false),
  customers = ref<InternalCrmCustomerSummary[]>([])
const areaNames = ref<Record<string, string>>({})
async function loadAreas() {
  try {
    const areas = await getAllCrmCustomerAreas()
    areaNames.value = Object.fromEntries(areas.map((area) => [area.code, area.name]))
  } catch {
    decisionError.value = '归属地区暂时无法读取，请核对客户资料后重试。'
  }
}
function customerArea(row: InternalCrmCustomerSummary) {
  return (
    (row.regionCode ? areaNames.value[row.regionCode] : null) ||
    row.regionName ||
    row.cityName ||
    '-'
  )
}
let searchGeneration = 0
async function search(text: string) {
  const version = ++searchGeneration
  searching.value = true
  try {
    const result = await getInternalCrmCustomers({
      begin: 0,
      step: 30,
      customerName: text.trim() || chosen.value?.customerName || undefined,
      statusCode: 'ACTIVE',
      dhbLinkStatus: 'LINKED',
    })
    if (version === searchGeneration)
      customers.value = result.items.filter((row) => row.statusCode === 'ACTIVE' && row.dhbLinked)
  } catch {
    if (version === searchGeneration) decisionError.value = '客户暂时无法读取，请重试。'
  } finally {
    if (version === searchGeneration) searching.value = false
  }
}
async function save() {
  const row = chosen.value
  if (
    !row ||
    saving.value ||
    !reason.value.trim() ||
    (mode.value === 'EXISTING' && !customerId.value)
  )
    return
  saving.value = true
  decisionError.value = ''
  try {
    await decideCustomerSource({
      connectorId: row.connectorId,
      sourceId: row.sourceId,
      revision: row.revision,
      independent: mode.value === 'INDEPENDENT',
      customerId: mode.value === 'EXISTING' ? customerId.value : null,
      reason: reason.value.trim(),
    })
    decisionVisible.value = false
    message.value = '核对结果已保存，系统将在后续同步时复核并继续处理相关发货。'
    emit('saved')
    await load()
  } catch (cause) {
    decisionError.value = cause instanceof Error ? cause.message : '保存失败，请刷新后重试。'
  } finally {
    saving.value = false
  }
}
defineExpose({ open })
</script>
<style scoped>
.review-query {
  display: flex;
  gap: 12px;
  margin: 16px 0;
  flex-wrap: wrap;
}
.review-query .el-input {
  width: min(300px, 100%);
}
.decision-form {
  margin-top: 20px;
}
.el-pagination {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
