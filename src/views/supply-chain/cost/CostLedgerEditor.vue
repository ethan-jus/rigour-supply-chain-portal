<template>
  <el-form label-position="top" class="ledger-editor">
    <el-alert
      v-if="plan?.sourceSync?.differencePending"
      title="采购约定已变化，请核对实际费用并填写变更原因。"
      type="warning"
      :closable="false"
    />
    <section class="ledger-panel">
      <h3>{{ logistics ? '运输信息' : '仓储信息' }}</h3>
      <div class="field-grid">
        <el-form-item :label="logistics ? '运输日期' : '登记日期'" required
          ><el-date-picker v-model="form.costDate" type="date" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item label="费用归属城市" required
          ><el-select v-model="form.cityCode" filterable @change="cityChanged"
            ><el-option
              v-for="c in cities"
              :key="c.code"
              :label="c.name"
              :value="c.code" /></el-select
        ></el-form-item>
        <el-form-item label="付款状态" required
          ><CostDictSelect v-model="form.paymentStatusCode" code="COST_PAYMENT_STATUS"
        /></el-form-item>
        <template v-if="logistics">
          <el-form-item label="费用归属月份" required
            ><el-date-picker v-model="plan.costMonth" type="month" value-format="YYYY-MM"
          /></el-form-item>
          <el-form-item label="运输类型" required
            ><CostDictSelect v-model="plan.transportPurposeCode" code="COST_TRANSPORT_PURPOSE"
          /></el-form-item>
          <el-form-item
            v-if="plan.transportPurposeCode === 'OTHER'"
            label="其他费用用途说明"
            required
            ><el-input
              v-model="plan.nonSalesPurposeCode"
              maxlength="200"
              placeholder="活动、领用、赠送、品鉴等"
          /></el-form-item>
          <el-form-item label="承运方式" required
            ><CostDictSelect v-model="plan.deliveryModeCode" code="COST_DELIVERY_MODE"
          /></el-form-item>
          <el-form-item v-if="plan.deliveryModeCode === 'THIRD_PARTY'" label="物流公司" required
            ><CostDictSelect v-model="plan.carrierCode" code="COST_CARRIER"
          /></el-form-item>
          <el-form-item label="运单号"
            ><el-input v-model="plan.trackingNo" maxlength="100"
          /></el-form-item>
          <el-form-item
            v-if="plan.deliveryModeCode === 'THIRD_PARTY' && !plan.trackingNo"
            label="无运单号原因"
            ><el-input
              v-model="plan.noTrackingReason"
              maxlength="500"
              placeholder="确认前须填写运单号或无单号原因"
          /></el-form-item>
          <el-form-item label="运输方式"
            ><CostDictSelect
              v-model="plan.transportMethodCode"
              code="COST_TRANSPORT_KIND"
              clearable
          /></el-form-item>
          <template v-if="plan.deliveryModeCode === 'SELF'"
            ><el-form-item label="司机"
              ><el-input v-model="plan.driverName" maxlength="100" /></el-form-item
            ><el-form-item label="车牌号"
              ><el-input v-model="plan.vehicleNo" maxlength="50" /></el-form-item
          ></template>
        </template>
        <template v-else>
          <el-form-item label="仓库" required
            ><CostLedgerPartySelect
              v-model="warehouse.warehouseCode"
              :logistics="false"
              kind="WAREHOUSE"
              :name="warehouseName"
              @selected="warehouseChanged"
          /></el-form-item>
          <el-form-item label="收费方"
            ><CostLedgerPartySelect
              v-model="warehouse.serviceProviderCode"
              :logistics="false"
              kind="SUPPLIER"
          /></el-form-item>
          <el-form-item v-if="!warehouse.serviceProviderCode" label="其他收费方名称"
            ><el-input
              v-model="form.payeeName"
              maxlength="200"
              placeholder="无供应商档案时填写实际收款方名称"
          /></el-form-item>
          <el-form-item label="合同号"
            ><el-input v-model="warehouse.contractNo" maxlength="100"
          /></el-form-item>
          <el-form-item label="付款日期" :required="form.paymentStatusCode === 'PAID'"
            ><el-date-picker v-model="warehouse.paymentDate" type="date" value-format="YYYY-MM-DD"
          /></el-form-item>
          <el-form-item label="押金（不计入费用）"
            ><el-input-number
              v-model="warehouse.depositAmount"
              :min="0"
              :precision="2"
              :controls="false"
          /></el-form-item>
        </template>
        <el-form-item label="费用负责人"
          ><el-select
            v-model="form.ownerEmployeeCode"
            filterable
            clearable
            @change="employeeChanged"
            ><el-option
              v-for="employee in employees"
              :key="employee.employeeCode"
              :label="employee.employeeName"
              :value="employee.employeeCode" /></el-select
        ></el-form-item>
      </div>
    </section>

    <template v-if="logistics">
      <section class="ledger-panel">
        <h3>发货信息</h3>
        <CostLedgerPartyFields v-model="plan.sender" :cities="cities" />
      </section>
      <section class="ledger-panel">
        <div class="section-toolbar">
          <h3><span class="required">*</span> 收货信息</h3>
          <el-button @click="plan.receivingPoints.push(newParty(form.cityCode))"
            >添加收货方</el-button
          >
        </div>
        <div
          v-for="(point, i) in plan.receivingPoints"
          :key="point.pointCode"
          class="receiving-point"
        >
          <div class="section-toolbar">
            <b>收货方 {{ i + 1 }}</b
            ><el-button
              v-if="plan.receivingPoints.length > 1"
              link
              type="danger"
              @click="removePoint(point.pointCode)"
              >移除</el-button
            >
          </div>
          <CostLedgerPartyFields
            v-model="plan.receivingPoints[i]!"
            receiver
            :cities="cities"
            @changed="syncPoint(point)"
          />
        </div>
      </section>
      <section class="ledger-panel">
        <div class="section-toolbar">
          <h3><span class="required">*</span> 费用项目</h3>
          <el-button @click="addFee">新增费用项目</el-button>
        </div>
        <el-table :data="plan.feeItems" border>
          <el-table-column label="费用项目" min-width="170"
            ><template #default="{ row }"
              ><CostDictSelect v-model="row.feeTypeCode" code="COST_LOGISTICS_FEE_TYPE" /></template
          ></el-table-column>
          <el-table-column label="承担方" min-width="165"
            ><template #default="{ row }"
              ><el-select v-model="row.bearerCode" @change="feeChanged(row as LedgerFee)"
                ><el-option label="我方承担" value="COMPANY" /><el-option
                  label="供应商承担"
                  value="SUPPLIER" /><el-option label="客户承担" value="CUSTOMER" /><el-option
                  label="共同承担"
                  value="SHARED" /></el-select></template
          ></el-table-column>
          <el-table-column label="费用总额（元）" min-width="160"
            ><template #default="{ row }"
              ><el-input-number
                v-model="row.feeAmount"
                :min="0"
                :precision="2"
                :controls="false"
                placeholder="未知可空"
                @change="feeChanged(row as LedgerFee)" /></template
          ></el-table-column>
          <el-table-column label="我方费用（元）" min-width="160"
            ><template #default="{ row }"
              ><el-input-number
                v-model="row.ourAmount"
                :min="0"
                :precision="2"
                :controls="false"
                :disabled="row.bearerCode !== 'SHARED'" /></template
          ></el-table-column>
          <el-table-column label="分摊方式" min-width="160"
            ><template #default="{ row }"
              ><el-select v-model="row.allocationMethodCode"
                ><el-option
                  v-for="m in allocationMethods"
                  :key="m.value"
                  :label="m.label"
                  :value="m.value" /></el-select></template
          ></el-table-column>
          <el-table-column label="零元原因 / 说明" min-width="230"
            ><template #default="{ row }"
              ><el-input
                v-if="row.ourAmount === 0"
                v-model="row.zeroCostReason"
                maxlength="500"
                placeholder="厂家包邮、货价含运费等" /><el-input
                v-else
                v-model="row.remark"
                maxlength="500"
                placeholder="费用说明" /></template
          ></el-table-column>
          <el-table-column label="操作" width="75"
            ><template #default="{ row }"
              ><el-button link type="danger" @click="removeFee(row.feeKey)"
                >移除</el-button
              ></template
            ></el-table-column
          >
        </el-table>
      </section>
      <section
        v-if="plan.feeItems.some((f) => f.allocationMethodCode === 'QUANTITY')"
        class="ledger-panel"
      >
        <h3>数量分摊口径</h3>
        <el-form-item
          v-for="fee in plan.feeItems.filter((f) => f.allocationMethodCode === 'QUANTITY')"
          :key="fee.feeKey"
          :label="costLabel('COST_LOGISTICS_FEE_TYPE', fee.feeTypeCode) + ' · 统一基数单位'"
          required
        >
          <CostDictSelect v-model="fee.basisUnitCode" code="PRODUCT_UNIT" />
          <p class="help">各分摊行的数量须先换算到此单位，再填写基数。</p>
        </el-form-item>
      </section>
      <section class="ledger-panel">
        <div class="section-toolbar">
          <h3>关联单据</h3>
          <div>
            <el-button @click="addNoSource">无关联单据</el-button
            ><el-button type="primary" plain @click="picker = true">选择单据</el-button>
          </div>
        </div>
        <el-table :data="plan.sources" border empty-text="选择关联单据，或登记无关联单据的真实原因">
          <el-table-column label="订单类型" min-width="150"
            ><template #default="{ row }">{{
              sourceTypeLabel(row.orderTypeCode)
            }}</template></el-table-column
          >
          <el-table-column label="单据编号" min-width="230"
            ><template #default="{ row }">{{
              row.orderCode || '无关联单据'
            }}</template></el-table-column
          >
          <el-table-column label="关联用途" min-width="165"
            ><template #default="{ row }"
              ><el-select
                v-model="row.linkRoleCode"
                @change="sourceRoleChanged(row as LedgerSource)"
                ><el-option label="成本归属" value="COST" /><el-option
                  label="仅业务追溯"
                  value="TRACE" /></el-select></template
          ></el-table-column>
          <el-table-column label="无单据原因" min-width="240"
            ><template #default="{ row }"
              ><el-input
                v-if="row.orderTypeCode === 'NONE'"
                v-model="row.noSourceReason"
                maxlength="500"
                placeholder="填写活动、领用或其他实际原因"
              /><span v-else>—</span></template
            ></el-table-column
          >
          <el-table-column label="操作" width="75"
            ><template #default="{ $index }"
              ><el-button link type="danger" @click="plan.sources.splice($index, 1)"
                >移除</el-button
              ></template
            ></el-table-column
          >
        </el-table>
        <div class="section-toolbar">
          <h3>费用分摊</h3>
          <div>
            <el-button @click="addAllocation">添加分摊行</el-button
            ><el-button @click="recalculate">计算分摊</el-button>
          </div>
        </div>
        <el-table :data="allocations" border empty-text="请为成本归属单据添加费用分摊">
          <el-table-column label="费用项目" min-width="170"
            ><template #default="{ row }"
              ><el-select v-model="row.allocation.feeKey"
                ><el-option
                  v-for="f in plan.feeItems"
                  :key="f.feeKey"
                  :label="costLabel('COST_LOGISTICS_FEE_TYPE', f.feeTypeCode)"
                  :value="f.feeKey" /></el-select></template
          ></el-table-column>
          <el-table-column label="关联单据" min-width="220"
            ><template #default="{ row }">{{
              row.source.orderCode || '无单据费用'
            }}</template></el-table-column
          >
          <el-table-column label="收货方" min-width="210"
            ><template #default="{ row }"
              ><el-select
                v-model="row.allocation.receivingPointCode"
                @change="allocationPointChanged(row.allocation)"
                ><el-option
                  v-for="p in plan.receivingPoints"
                  :key="p.pointCode"
                  :label="partyName(p)"
                  :value="p.pointCode" /></el-select></template
          ></el-table-column>
          <el-table-column label="归属城市" min-width="130"
            ><template #default="{ row }">{{
              cities.find((c) => c.code === row.allocation.cityCode)?.name ||
              row.allocation.cityCode ||
              '待选择'
            }}</template></el-table-column
          >
          <el-table-column label="分摊基数" min-width="150"
            ><template #default="{ row }"
              ><el-input-number
                v-model="row.allocation.basis"
                :min="0"
                :precision="6"
                :controls="false" /></template
          ></el-table-column>
          <el-table-column label="分摊金额（元）" min-width="165"
            ><template #default="{ row }"
              ><el-input-number
                v-model="row.allocation.amount"
                :min="0"
                :precision="2"
                :controls="false" /></template
          ></el-table-column>
          <el-table-column label="操作" width="75"
            ><template #default="{ row }"
              ><el-button link type="danger" @click="row.source.allocations.splice(row.index, 1)"
                >移除</el-button
              ></template
            ></el-table-column
          >
        </el-table>
        <p v-for="fee in plan.feeItems" :key="fee.feeKey" class="balance">
          {{ costLabel('COST_LOGISTICS_FEE_TYPE', fee.feeTypeCode) }}：我方费用
          {{ costMoney(fee.ourAmount) }}，已分摊 {{ costMoney(allocated(fee.feeKey)) }}，未分摊
          {{
            fee.ourAmount == null
              ? '待补金额'
              : costMoney(
                  (Math.round(fee.ourAmount * 100) - Math.round(allocated(fee.feeKey) * 100)) / 100,
                )
          }}
        </p>
      </section>
      <CostLedgerSourcePicker
        v-model="picker"
        :selected-keys="plan.sources.map((s) => `${s.orderTypeCode}:${s.orderCode}`)"
        @selected="picked"
      />
    </template>

    <template v-else>
      <section class="ledger-panel">
        <div class="section-toolbar">
          <h3><span class="required">*</span> 费用项目</h3>
          <el-button @click="warehouse.feeItems.push(newWarehouseFee(form.costDate))"
            >新增费用项目</el-button
          >
        </div>
        <div v-for="(fee, i) in warehouse.feeItems" :key="fee.feeKey" class="warehouse-fee">
          <div class="section-toolbar">
            <b>费用项目 {{ i + 1 }}</b
            ><el-button
              v-if="warehouse.feeItems.length > 1"
              link
              type="danger"
              @click="warehouse.feeItems.splice(i, 1)"
              >移除</el-button
            >
          </div>
          <div class="field-grid">
            <el-form-item label="费用项目" required
              ><CostDictSelect v-model="fee.feeTypeCode" code="COST_WAREHOUSE_FEE_TYPE"
            /></el-form-item>
            <el-form-item label="费用金额（元）"
              ><el-input-number
                v-model="fee.feeAmount"
                :disabled="fee.quantity != null && fee.unitPrice != null"
                :min="0"
                :precision="2"
                :controls="false"
                placeholder="待补金额"
                @change="previewWarehouseFee(fee)"
            /></el-form-item>
            <el-form-item label="费用归属方式" required
              ><CostDictSelect
                v-model="fee.allocationMethodCode"
                code="COST_WAREHOUSE_ALLOCATION_METHOD"
                @update:model-value="previewWarehouseFee(fee)"
            /></el-form-item>
            <el-form-item label="计费数量"
              ><el-input-number
                v-model="fee.quantity"
                :min="0"
                :precision="6"
                :controls="false"
                placeholder="固定费用可空"
                @change="previewWarehouseFee(fee)"
            /></el-form-item>
            <el-form-item label="计费单位"
              ><CostDictSelect v-model="fee.unitCode" code="PRODUCT_UNIT" clearable
            /></el-form-item>
            <el-form-item label="计费单价（元）"
              ><el-input-number
                v-model="fee.unitPrice"
                :min="0"
                :precision="6"
                :controls="false"
                @change="previewWarehouseFee(fee)"
            /></el-form-item>
            <el-form-item
              v-if="fee.allocationMethodCode === 'SINGLE_DATE'"
              label="费用归属日期"
              required
              ><el-date-picker
                v-model="fee.attributionDate"
                type="date"
                value-format="YYYY-MM-DD"
                @change="previewWarehouseFee(fee)"
            /></el-form-item>
            <template v-else
              ><el-form-item label="服务起始日期" required
                ><el-date-picker
                  v-model="fee.serviceFrom"
                  type="date"
                  value-format="YYYY-MM-DD"
                  @change="previewWarehouseFee(fee)" /></el-form-item
              ><el-form-item label="服务截止日期" required
                ><el-date-picker
                  v-model="fee.serviceTo"
                  type="date"
                  value-format="YYYY-MM-DD"
                  @change="previewWarehouseFee(fee)" /></el-form-item
            ></template>
            <el-form-item label="备注"
              ><el-input v-model="fee.remark" maxlength="500"
            /></el-form-item>
          </div>
          <template v-if="fee.allocationMethodCode === 'MANUAL'">
            <el-table :data="fee.monthAllocations" border
              ><el-table-column label="归属月份"
                ><template #default="{ row }"
                  ><el-date-picker
                    v-model="row.month"
                    type="month"
                    value-format="YYYY-MM" /></template></el-table-column
              ><el-table-column label="归属金额（元）"
                ><template #default="{ row }"
                  ><el-input-number
                    v-model="row.amount"
                    :min="0"
                    :precision="2"
                    :controls="false" /></template></el-table-column
              ><el-table-column label="操作" width="80"
                ><template #default="{ $index }"
                  ><el-button link type="danger" @click="fee.monthAllocations.splice($index, 1)"
                    >移除</el-button
                  ></template
                ></el-table-column
              ></el-table
            >
            <el-button
              class="add-month"
              @click="fee.monthAllocations.push({ month: form.costDate.slice(0, 7), amount: null })"
              >添加归属月份</el-button
            >
          </template>
        </div>
      </section>
      <section class="ledger-panel">
        <h3>月度归属预览</h3>
        <el-table
          :data="warehouseMonths(warehouse)"
          border
          empty-text="填写费用金额与归属规则后预览"
          ><el-table-column prop="month" label="费用归属月份" /><el-table-column
            label="归属费用（元）"
            align="right"
            ><template #default="{ row }">{{ costMoney(row.amount) }}</template></el-table-column
          ></el-table
        >
        <p class="balance">
          本单费用总额 {{ costMoney(totalFees(warehouse.feeItems)) }}；押金
          {{ costMoney(warehouse.depositAmount ?? 0) }} 不计入费用。
        </p>
      </section>
    </template>
    <section class="ledger-panel">
      <h3>备注与变更说明</h3>
      <el-form-item label="备注"
        ><el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          maxlength="1000"
          show-word-limit /></el-form-item
      ><el-form-item label="变更原因" :required="confirmed"
        ><el-input
          v-model="form.reason"
          maxlength="500"
          :placeholder="
            confirmed ? '修改已确认费用必须填写原因，保存后重新确认' : '补充登记或更正说明（选填）'
          "
      /></el-form-item>
    </section>
  </el-form>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { CostCommand, CostEmployee } from '@/api/core/cost'
import type { LedgerPartyReference } from '@/api/core/cost-ledger'
import CostDictSelect from './CostDictSelect.vue'
import CostLedgerPartyFields from './CostLedgerPartyFields.vue'
import CostLedgerPartySelect from './CostLedgerPartySelect.vue'
import { logisticsOrderTypeLabel } from './cost-transport-types'
import CostLedgerSourcePicker, { type PickedLedgerSource } from './CostLedgerSourcePicker.vue'
import { costMoney, costLabel } from './cost-dictionaries'
import {
  newParty,
  newLogisticsFee,
  newWarehouseFee,
  partyName,
  previewWarehouseFee,
  warehouseMonths,
  totalFees,
  splitMoney,
  moneyCents,
  type LedgerAllocation,
  type LedgerFee,
  type LedgerParty,
  type LedgerSource,
} from './cost-ledger'
const form = defineModel<CostCommand>({ required: true })
const props = defineProps<{
  logistics: boolean
  cities: { code: string; name: string }[]
  employees: CostEmployee[]
  warehouseName?: string | null
  confirmed?: boolean
}>()
const plan = computed(() => form.value.ledger!)
const warehouse = computed(() => form.value.warehouseLedger!)
const picker = ref(false)
const allocationMethods = [
  { value: 'MANUAL', label: '手工分摊' },
  { value: 'EQUAL', label: '均分' },
  { value: 'WEIGHT', label: '按重量' },
  { value: 'VOLUME', label: '按体积' },
  { value: 'AMOUNT', label: '按金额' },
  { value: 'QUANTITY', label: '按数量（统一单位）' },
]
const allocations = computed(
  () =>
    plan.value?.sources.flatMap((source) =>
      (source.allocations || []).map((allocation, index) => ({ source, allocation, index })),
    ) || [],
)
const sourceTypeLabel = logisticsOrderTypeLabel
function cityChanged() {
  form.value.cityName = props.cities.find((c) => c.code === form.value.cityCode)?.name || ''
  if (props.logistics) {
    if (!plan.value.sender.cityCode) plan.value.sender.cityCode = form.value.cityCode
    plan.value.receivingPoints.forEach((p) => {
      if (!p.cityCode) p.cityCode = form.value.cityCode
    })
  }
}
function employeeChanged() {
  form.value.departmentId =
    props.employees.find((e) => e.employeeCode === form.value.ownerEmployeeCode)?.departmentId ??
    null
}
function warehouseChanged(row: LedgerPartyReference | null) {
  if (!row) return
  if (!row.cityCode?.trim() || !props.cities.some((c) => c.code === row.cityCode)) {
    form.value.cityCode = ''
    cityChanged()
    ElMessage.warning(
      row.cityCode?.trim()
        ? '仓库归属城市未关联经营城市，请先维护仓库档案'
        : '仓库未配置归属城市，请先维护仓库档案',
    )
    return
  }
  form.value.cityCode = row.cityCode
  cityChanged()
}
function syncPoint(point: LedgerParty) {
  allocations.value
    .filter((r) => r.allocation.receivingPointCode === point.pointCode)
    .forEach((r) => {
      r.allocation.cityCode = point.cityCode
    })
}
function allocationPointChanged(row: LedgerAllocation) {
  row.cityCode =
    plan.value.receivingPoints.find((p) => p.pointCode === row.receivingPointCode)?.cityCode || ''
}
function removePoint(key: string) {
  if (allocations.value.some((a) => a.allocation.receivingPointCode === key)) {
    ElMessage.warning('请先调整关联此收货方的分摊行')
    return
  }
  plan.value.receivingPoints = plan.value.receivingPoints.filter((p) => p.pointCode !== key)
}
function feeChanged(fee: LedgerFee) {
  if (fee.bearerCode === 'COMPANY') fee.ourAmount = fee.feeAmount ?? null
  else if (['SUPPLIER', 'CUSTOMER'].includes(fee.bearerCode)) fee.ourAmount = 0
}
function addFee() {
  const fee = newLogisticsFee()
  plan.value.feeItems.push(fee)
  for (const source of plan.value.sources.filter((s) => s.linkRoleCode === 'COST')) {
    const pointCodes = new Set(source.allocations.map((a) => a.receivingPointCode))
    const points = plan.value.receivingPoints.filter((p) => pointCodes.has(p.pointCode))
    for (const point of points.length ? points : [plan.value.receivingPoints[0]!])
      appendAllocation(source, fee, point)
  }
}
function removeFee(key: string) {
  if (plan.value.feeItems.length === 1) {
    ElMessage.warning('至少保留一项费用')
    return
  }
  plan.value.feeItems = plan.value.feeItems.filter((f) => f.feeKey !== key)
  plan.value.sources.forEach((s) => {
    s.allocations = s.allocations.filter((a) => a.feeKey !== key)
  })
}
function appendAllocation(source: LedgerSource, fee: LedgerFee, point: LedgerParty) {
  if (
    !source.allocations.some(
      (a) => a.feeKey === fee.feeKey && a.receivingPointCode === point.pointCode,
    )
  )
    source.allocations.push({
      feeKey: fee.feeKey,
      receivingPointCode: point.pointCode,
      cityCode: point.cityCode,
      basis: null,
      amount: 0,
    })
}
function addAllocation() {
  for (const source of plan.value.sources.filter((s) => s.linkRoleCode === 'COST'))
    for (const fee of plan.value.feeItems)
      for (const point of plan.value.receivingPoints)
        if (
          !source.allocations.some(
            (a) => a.feeKey === fee.feeKey && a.receivingPointCode === point.pointCode,
          )
        ) {
          appendAllocation(source, fee, point)
          return
        }
  ElMessage.info('请先选择成本归属单据，或修改已有分摊行')
}
function addNoSource() {
  if (plan.value.sources.some((s) => s.orderTypeCode === 'NONE')) return
  const source: LedgerSource = {
    orderTypeCode: 'NONE',
    orderCode: null,
    linkRoleCode: 'COST',
    noSourceReason: '',
    allocations: [],
  }
  plan.value.sources.push(source)
  for (const fee of plan.value.feeItems)
    appendAllocation(source, fee, plan.value.receivingPoints[0]!)
}
function sourceRoleChanged(source: LedgerSource) {
  if (source.linkRoleCode === 'TRACE') source.allocations = []
  else
    for (const fee of plan.value.feeItems)
      appendAllocation(source, fee, plan.value.receivingPoints[0]!)
}
function allocated(feeKey: string) {
  return (
    Number(
      allocations.value
        .filter((r) => r.allocation.feeKey === feeKey)
        .reduce((sum, r) => sum + moneyCents(r.allocation.amount ?? 0), 0n),
    ) / 100
  )
}
function recalculate() {
  try {
    for (const fee of plan.value.feeItems) {
      const rows = allocations.value
        .filter((r) => r.allocation.feeKey === fee.feeKey)
        .sort((a, b) => {
          const x = `${a.source.orderTypeCode}|${a.source.orderCode || ''}|${a.allocation.receivingPointCode}`,
            y = `${b.source.orderTypeCode}|${b.source.orderCode || ''}|${b.allocation.receivingPointCode}`
          return x < y ? -1 : x > y ? 1 : 0
        })
      if (fee.ourAmount == null || !rows.length) continue
      if (rows.length === 1) {
        rows[0]!.allocation.amount = fee.ourAmount
        continue
      }
      if (fee.allocationMethodCode === 'MANUAL') continue
      const result = splitMoney(
        fee.ourAmount,
        rows.map((r) => (fee.allocationMethodCode === 'EQUAL' ? 1 : (r.allocation.basis ?? 0))),
      )
      rows.forEach((r, i) => {
        r.allocation.amount = result[i]!
      })
    }
  } catch (e) {
    ElMessage.warning((e as Error).message)
  }
}
function picked(rows: PickedLedgerSource[]) {
  for (const row of rows) {
    if (!plan.value.sender.partyCode && !plan.value.sender.manualName && row.senderCode)
      plan.value.sender = {
        ...plan.value.sender,
        partyTypeCode: row.orderTypeCode === 'PURCHASE_ORDER' ? 'SUPPLIER' : 'WAREHOUSE',
        partyCode: row.senderCode,
        displayName: row.senderName,
        cityCode: row.orderTypeCode === 'PURCHASE_ORDER' ? form.value.cityCode : '',
        address: row.originAddress || plan.value.sender.address,
      }
    let point = row.receiverCode
      ? plan.value.receivingPoints.find(
          (p) =>
            p.partyCode === row.receiverCode &&
            (!row.destinationAddress || p.address === row.destinationAddress),
        )
      : undefined
    if (!point && row.receiverCode) {
      point = plan.value.receivingPoints.find((p) => !p.partyCode && !p.manualName)
      if (!point) {
        point = newParty(row.cityCode || form.value.cityCode)
        plan.value.receivingPoints.push(point)
      }
      Object.assign(point, {
        partyTypeCode: ['PURCHASE_ORDER', 'TRANSFER_ORDER'].includes(row.orderTypeCode)
          ? 'WAREHOUSE'
          : 'CUSTOMER',
        partyCode: row.receiverCode,
        displayName: row.receiverName,
        cityCode: row.cityCode || form.value.cityCode,
        address: row.destinationAddress || point.address,
      })
    }
    if (!point && !row.receiverCode && row.receiverName) {
      point = plan.value.receivingPoints.find(
        (p) =>
          p.partyTypeCode === 'OTHER' &&
          p.manualName === row.receiverName &&
          p.address === (row.destinationAddress || ''),
      )
      if (!point) {
        point =
          plan.value.receivingPoints.find((p) => !p.partyCode && !p.manualName) ||
          newParty(row.cityCode || form.value.cityCode)
        if (!plan.value.receivingPoints.includes(point)) plan.value.receivingPoints.push(point)
        Object.assign(point, {
          partyTypeCode: 'OTHER',
          manualName: row.receiverName,
          partyCode: null,
          cityCode: row.cityCode || form.value.cityCode,
          address: row.destinationAddress || '',
        })
      }
    }
    point ||= plan.value.receivingPoints[0]!
    const source: LedgerSource = {
      orderTypeCode: row.orderTypeCode,
      orderCode: row.documentNo,
      linkRoleCode: 'COST',
      allocations: [],
    }
    plan.value.sources.push(source)
    for (const fee of plan.value.feeItems) appendAllocation(source, fee, point)
  }
  recalculate()
}
</script>
<style scoped>
.ledger-editor {
  padding: 2px;
}
.ledger-panel {
  background: white;
  border: 1px solid #dce4ee;
  border-radius: 8px;
  padding: 22px;
  margin-bottom: 18px;
}
.ledger-panel h3 {
  font-size: 16px;
  margin: 0 0 20px;
  color: #172238;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 22px;
}
.field-grid :deep(.el-select),
.field-grid :deep(.el-date-editor),
.field-grid :deep(.el-input-number) {
  width: 100%;
}
.section-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin: 0 0 16px;
}
.section-toolbar h3 {
  margin: 0;
}
.receiving-point,
.warehouse-fee {
  border-top: 1px solid #e2e8f0;
  padding-top: 18px;
  margin-top: 18px;
}
.receiving-point:first-of-type {
  border-top: 0;
}
.required {
  color: var(--el-color-danger);
}
.balance {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 12px 0 0;
}
.add-month {
  margin-top: 12px;
}
:deep(.el-table .el-input-number) {
  width: 100%;
}
:deep(.el-form-item) {
  margin-bottom: 18px;
}
@media (max-width: 900px) {
  .field-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
  .ledger-panel {
    padding: 15px;
  }
}
</style>
