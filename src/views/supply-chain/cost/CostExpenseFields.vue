<template>
  <section v-if="form.expense" class="expense-fields">
    <h3 class="cost-section-title">用途与明细</h3>
    <el-form-item label="费用用途 / 出差事由" required>
      <el-input
        v-model="form.expense.purpose"
        type="textarea"
        maxlength="1000"
        placeholder="填写实际办理的业务事项、用途及受益对象"
      />
    </el-form-item>
    <div v-if="monthly" class="expense-grid">
      <el-form-item label="费用所属月份" required>
        <el-date-picker v-model="form.costMonth" type="month" value-format="YYYY-MM" />
      </el-form-item>
    </div>
    <div v-if="courier && form.expense.courier" class="expense-grid">
      <el-form-item label="寄送内容" required>
        <el-input
          v-model="form.expense.courier.contents"
          maxlength="200"
          placeholder="如合作合同、业务资料、非销售样品"
        />
      </el-form-item>
      <el-form-item label="收件客户 / 合作方" required>
        <el-input v-model="form.expense.courier.recipientName" maxlength="200" />
      </el-form-item>
      <el-form-item label="快递公司" required>
        <el-input v-model="form.expense.courier.companyName" maxlength="100" />
      </el-form-item>
      <el-form-item label="运单号" required>
        <el-input v-model="form.expense.courier.trackingNo" maxlength="100" />
      </el-form-item>
    </div>
    <template v-else-if="travel">
      <div class="expense-grid">
        <el-form-item label="关联出差编号"
          ><el-input
            v-model="form.expense.tripReference"
            maxlength="100"
            placeholder="同次出差的各项明细可填写相同编号"
        /></el-form-item>
        <el-form-item label="物品或服务"
          ><el-input
            v-model="form.expense.itemName"
            maxlength="200"
            placeholder="如高铁二等座、标准间、出租车"
        /></el-form-item>
        <el-form-item label="开始日期" required
          ><el-date-picker v-model="form.expense.startDate" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item label="结束日期" required
          ><el-date-picker v-model="form.expense.endDate" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item v-if="form.typeCode !== 'ACCOMMODATION'" label="出发地" required
          ><el-input
            v-model="form.expense.departure"
            maxlength="300"
            placeholder="车站、机场或地址"
        /></el-form-item>
        <el-form-item label="目的地 / 住宿地点" required
          ><el-input v-model="form.expense.destination" maxlength="300"
        /></el-form-item>
      </div>
      <p class="field-hint">车票、住宿、打车分别登记明细金额，同次出差不再额外录入一笔总额。</p>
    </template>
    <div v-else class="expense-grid">
      <el-form-item label="物品或服务" :required="goods"
        ><el-input v-model="form.expense.itemName" maxlength="200"
      /></el-form-item>
    </div>
    <el-form-item label="收款对象（登记信息）">
      <el-input
        v-model="form.expense.payeeName"
        maxlength="200"
        placeholder="填写实际收款员工或单位，与报销员工不同时请注明"
      />
      <span class="field-hint">报销员工是费用归属人，录入人由系统记录。</span>
    </el-form-item>
    <div v-if="goods || form.typeCode === 'ACCOMMODATION'" class="expense-grid">
      <el-form-item label="数量" :required="goods"
        ><el-input-number
          v-model="form.expense.quantity"
          :min="0.000001"
          :precision="6"
          :controls="false"
      /></el-form-item>
      <el-form-item label="单位" :required="goods"
        ><el-input v-model="form.expense.unit" maxlength="30" placeholder="包、件、间夜等"
      /></el-form-item>
      <el-form-item label="单价（元）"
        ><el-input-number
          v-model="form.expense.unitPrice"
          :min="0"
          :precision="6"
          :controls="false"
      /></el-form-item>
      <el-form-item label="金额差异说明"
        ><el-input
          v-model="form.expense.amountReason"
          maxlength="500"
          placeholder="实报金额与数量 × 单价不一致时填写"
      /></el-form-item>
    </div>
    <el-form-item v-if="form.expense.costCategory === 'freight'" label="运输环节" required>
      <CostDictSelect v-model="form.expense.freightLeg" code="COST_LOGISTICS_LEG" />
    </el-form-item>
    <el-collapse v-if="!travel && sourceCategory">
      <el-collapse-item title="这笔费用已经在成本台账登记？关联已有单据">
        <p>
          选择已确认的原费用，自动带出金额、月份及已有资料。原费用计入成本，本条报销保留来源，核对一致后不再累计一次。
        </p>
        <el-form-item label="已确认原费用">
          <CostReferenceSelect
            v-model="selectedId"
            :loader="originals"
            :reset-key="`${sourceCategory}:${form.cityCode}`"
            :snapshot="selectedLabel"
            :disabled="!form.cityCode"
            placeholder="按原费用单号搜索"
            @change="chooseOriginal"
          />
        </el-form-item>
        <el-button v-if="form.expense.relatedCost" link type="primary" @click="clearLink"
          >取消关联，作为独立费用登记</el-button
        >
        <p v-if="linkError" role="alert" class="reference-error">{{ linkError }}</p>
      </el-collapse-item>
    </el-collapse>
    <h3 class="cost-section-title">费用凭据</h3>
    <slot name="evidence" />
    <div class="expense-grid">
      <el-form-item label="发票 / 票据编号"
        ><el-input v-model="form.expense.evidenceNo" maxlength="200"
      /></el-form-item>
      <el-form-item label="无凭据说明"
        ><el-input
          v-model="form.expense.noEvidenceReason"
          maxlength="500"
          placeholder="无法提供票据时说明原因"
      /></el-form-item>
    </div>
    <p class="field-hint">确认前请提供费用票据、凭据编号或无凭据说明。</p>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  getCosts,
  getCost,
  type CostCategory,
  type CostCommand,
  type ExpenseCostCategory,
} from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
import CostReferenceSelect, { type ReferenceOption } from './CostReferenceSelect.vue'
import CostDictSelect from './CostDictSelect.vue'
import { expenseCostCategory } from './expense-cost-policy'
const form = defineModel<CostCommand>({ required: true })
const courier = computed(() => form.value.typeCode === 'COURIER')
const travel = computed(() =>
  ['TRAVEL', 'ACCOMMODATION', 'TAXI'].includes(form.value.typeCode || ''),
)
watch(
  () => [form.value, courier.value],
  () => {
    if (courier.value) {
      form.value.expense ??= { costCategory: 'expense', purpose: '' }
      form.value.expense.courier ??= {
        contents: '',
        recipientName: '',
        companyName: '',
        trackingNo: '',
      }
    }
  },
  { immediate: true },
)
const monthly = computed(() =>
  ['OFFICE_RENT', 'WAREHOUSE_RENT', 'NETWORK'].includes(form.value.typeCode || ''),
)
const goods = computed(() =>
  ['OFFICE', 'OFFICE_SUPPLIES', 'CONSUMABLE', 'CONSUMABLES', 'FIXED_ASSET'].includes(
    form.value.typeCode || '',
  ),
)
const originalCategories: Partial<Record<ExpenseCostCategory, CostCategory>> = {
  office: 'office-rentals',
  warehouse: 'warehouse-rentals',
  freight: 'logistics',
  marketing: 'marketing',
  purchase: 'purchases',
}
const sourceCategory = computed(
  () => originalCategories[form.value.expense?.costCategory || 'expense'] || null,
)
const selectedId = computed({
  get: () => form.value.expense?.relatedCost?.id || null,
  set: (value) => {
    if (!value) clearLink()
  },
})
const selectedLabel = ref(form.value.expense?.relatedCost ? '已关联原费用（展开重新核对）' : '')
const linkError = ref('')
let linkGeneration = 0
function clearLink() {
  linkGeneration++
  if (form.value.expense) form.value.expense.relatedCost = null
  selectedLabel.value = ''
  linkError.value = ''
}
function defaultCategory(): ExpenseCostCategory {
  return expenseCostCategory(form.value.typeCode)
}
watch(
  () => form.value,
  () => {
    form.value.expense ??= { costCategory: defaultCategory(), purpose: '' }
    form.value.expense.costCategory = defaultCategory()
  },
  { immediate: true },
)
watch(
  () => form.value.typeCode,
  () => {
    if (form.value.expense) {
      clearLink()
      form.value.expense.costCategory = defaultCategory()
    }
  },
)
watch(
  () => [form.value.costDate, monthly.value],
  () => {
    if (!monthly.value || !form.value.costMonth)
      form.value.costMonth = form.value.costDate?.slice(0, 7) || null
  },
  { immediate: true },
)
watch(() => form.value.cityCode, clearLink)
async function originals(keyword: string, begin: number): Promise<ReferenceOption[]> {
  if (!sourceCategory.value || !form.value.cityCode) return []
  const page = await getCosts(sourceCategory.value, {
    begin,
    step: 50,
    statusCode: 'CONFIRMED',
    cityCode: form.value.cityCode,
    documentNo: keyword || undefined,
    ...(sourceCategory.value === 'logistics' ? { payerCode: 'COMPANY' } : {}),
  })
  return page.items.map((row) => ({
    id: row.id,
    label: `${row.documentNo} · ${row.data.title} · ¥${row.data.amount}`,
    name: row.data.title,
  }))
}
async function chooseOriginal(option: ReferenceOption | null) {
  if (!option || !sourceCategory.value || !form.value.expense) {
    clearLink()
    return
  }
  const serial = ++linkGeneration,
    category = sourceCategory.value
  linkError.value = ''
  try {
    const row = await getCost(category, option.id)
    if (serial !== linkGeneration || !form.value.expense) return
    if (row.statusCode !== 'CONFIRMED' || row.data.cityCode !== form.value.cityCode)
      throw new Error('原费用状态或城市已变化，请重新选择')
    form.value.expense.relatedCost = {
      source: category === 'logistics' ? 'ORDER' : 'ERP',
      category:
        category === 'logistics'
          ? 'LOGISTICS'
          : category === 'purchases'
            ? 'PURCHASE'
            : category === 'marketing'
              ? 'MARKETING'
              : 'RENTAL',
      id: row.id,
      revision: row.revision,
    }
    selectedLabel.value = `${row.documentNo} · ${row.data.title}`
    form.value.costDate = row.data.costDate
    form.value.costMonth = row.data.costMonth || row.data.costDate.slice(0, 7)
    form.value.amount = row.data.amount
    form.value.expense.itemName =
      row.data.goods?.productName || row.data.rental?.premisesName || row.data.title
    form.value.expense.payeeName =
      row.data.payeeName ||
      row.data.goods?.supplierName ||
      row.data.rental?.landlordName ||
      row.data.logistics?.carrierName ||
      ''
    form.value.expense.freightLeg = row.data.logistics?.legCode || null
    if (row.data.goods) {
      form.value.expense.quantity = row.data.goods.quantity
      form.value.expense.unit = row.data.goods.unit
      form.value.expense.unitPrice = row.data.goods.unitPrice
    }
  } catch (e) {
    if (serial === linkGeneration) linkError.value = errorMessage(e, '原费用读取失败，请重新选择')
  }
}
</script>
<style scoped>
.expense-fields {
  grid-column: 1 / -1;
}
.expense-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 20px;
}
.expense-grid :deep(.el-select),
.expense-grid :deep(.el-date-editor),
.expense-grid :deep(.el-input-number) {
  width: 100%;
}
.field-hint {
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.reference-error {
  color: var(--el-color-danger);
}
@media (max-width: 640px) {
  .expense-grid {
    grid-template-columns: 1fr;
  }
}
</style>
