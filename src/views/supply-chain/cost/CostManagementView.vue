<template>
  <div class="supply-page supply-page--list supply-page--filtered-list cost-page">
    <div class="page-heading">
      <div>
        <SupplyPageTitle>{{ title }}</SupplyPageTitle>
        <p>{{ description }}</p>
      </div>
      <el-button v-if="can(permission + ':write')" type="primary" @click="edit()"
        >新增{{ title }}</el-button
      >
    </div>
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <SupplyListFilters :loading="loading" @search="search" @reset="reset">
      <el-form-item label="费用单号">
        <el-input
          v-model="filters.documentNo"
          clearable
          maxlength="100"
          placeholder="请输入费用单号"
          aria-label="费用单号"
        />
      </el-form-item>
      <el-form-item label="费用事项">
        <el-input
          v-model="filters.title"
          clearable
          maxlength="200"
          placeholder="请输入费用事项"
          aria-label="费用事项"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input
          v-model="filters.remark"
          clearable
          maxlength="1000"
          placeholder="请输入备注内容"
          aria-label="备注"
        />
      </el-form-item>
      <el-form-item
        v-if="typeDictionary"
        :label="category === 'logistics' ? '物流类型' : '费用类型'"
      >
        <CostDictSelect
          v-model="filters.typeCode"
          :code="typeDictionary"
          clearable
          placeholder="全部类型"
          :aria-label="category === 'logistics' ? '物流类型' : '费用类型'"
        />
      </el-form-item>
      <el-form-item label="归属城市">
        <el-select
          v-model="filters.cityCode"
          clearable
          filterable
          placeholder="全部城市"
          aria-label="归属城市"
        >
          <el-option
            v-for="city in cities"
            :key="city.code"
            :label="city.name"
            :value="city.code"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="hasEmployee" label="费用归属人">
        <el-select
          v-model="filters.ownerEmployeeCode"
          filterable
          clearable
          placeholder="全部归属人"
          aria-label="费用归属人"
        >
          <el-option
            v-for="e in employees"
            :key="e.employeeCode"
            :label="employeeLabel(e)"
            :value="e.employeeCode"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="category === 'warehouse-rentals'" label="所属仓库">
        <el-select
          v-model="filters.warehouseId"
          filterable
          clearable
          placeholder="全部仓库"
          aria-label="所属仓库"
        >
          <el-option v-for="w in warehouses" :key="w.value" :label="w.label" :value="w.value" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="category === 'warehouse-rentals'" label="租赁合同号">
        <el-input
          v-model="filters.contractNo"
          clearable
          maxlength="100"
          placeholder="请输入租赁合同号"
          aria-label="租赁合同号"
        />
      </el-form-item>
      <el-form-item v-if="category === 'logistics'" label="运单号">
        <el-input
          v-model="filters.trackingNo"
          clearable
          maxlength="100"
          placeholder="请输入运单号"
          aria-label="运单号"
        />
      </el-form-item>
      <el-form-item v-if="category === 'logistics'" label="来源单号">
        <el-input
          v-model="filters.sourceDocumentNo"
          clearable
          maxlength="100"
          placeholder="请输入来源单号"
          aria-label="来源单号"
        />
      </el-form-item>
      <el-form-item label="确认状态">
        <CostDictSelect
          v-model="filters.statusCode"
          code="COST_STATUS"
          clearable
          placeholder="全部确认状态"
          aria-label="确认状态"
        />
      </el-form-item>
      <el-form-item label="付款状态">
        <CostDictSelect
          v-model="filters.paymentStatusCode"
          code="COST_PAYMENT_STATUS"
          clearable
          placeholder="全部付款状态"
          aria-label="付款状态"
        />
      </el-form-item>
      <el-form-item label="费用开始日期">
        <el-date-picker
          v-model="filters.dateFrom"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择开始日期"
          aria-label="费用开始日期"
        />
      </el-form-item>
      <el-form-item label="费用截止日期">
        <el-date-picker
          v-model="filters.dateTo"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择截止日期"
          aria-label="费用截止日期"
        />
      </el-form-item>
    </SupplyListFilters>
    <el-card shadow="never" class="list-card">
      <div class="supply-list-toolbar">
        <span v-if="!loadError"
          >共 {{ page.total }} 条<span v-if="page.confirmedAmount != null">
            · 已确认成本 ¥{{ costMoney(page.confirmedAmount) }} · 已付款 ¥{{
              costMoney(page.paidAmount)
            }}
            · 待确认 {{ page.pendingCount }} 条</span
          ></span
        >
        <span v-else>查询失败，请重试</span>
        <div class="supply-list-actions">
          <el-button :disabled="loading || !page.items.length" @click="exportPage"
            >导出当前页</el-button
          ><el-button :loading="loading" @click="load">刷新</el-button>
        </div>
      </div>
      <el-table
        v-loading="loading"
        :data="page.items"
        row-key="id"
        height="100%"
        border
        class="business-table supply-scroll-table"
      >
        <el-table-column label="费用单号" width="200" fixed="left"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="showDetail(row as CostRecord)">{{
              row.documentNo
            }}</el-button></template
          ></el-table-column
        >
        <el-table-column prop="data.title" label="费用事项" min-width="190" show-overflow-tooltip />
        <el-table-column v-if="typeDictionary" label="类型" width="180"
          ><template #default="{ row }">{{
            costLabel(typeDictionary, row.data.logistics?.legCode || row.data.typeCode)
          }}</template></el-table-column
        >
        <el-table-column prop="data.cityName" label="归属城市" width="120" />
        <el-table-column v-if="hasEmployee" prop="ownerEmployeeName" label="归属人" width="120" />
        <el-table-column
          v-if="category === 'warehouse-rentals'"
          prop="warehouseName"
          label="仓库"
          width="160"
        />
        <el-table-column prop="data.costDate" label="费用日期" width="115" />
        <el-table-column label="金额（元）" width="135" align="right"
          ><template #default="{ row }">{{ costMoney(row.data.amount) }}</template></el-table-column
        >
        <el-table-column v-if="category === 'logistics'" label="承担方" width="100"
          ><template #default="{ row }">{{
            costLabel('COST_PAYER', row.data.logistics?.payerCode)
          }}</template></el-table-column
        >
        <el-table-column label="付款状态" width="100"
          ><template #default="{ row }">{{
            costLabel('COST_PAYMENT_STATUS', row.data.paymentStatusCode)
          }}</template></el-table-column
        >
        <el-table-column label="确认状态" width="100"
          ><template #default="{ row }"
            ><el-tag
              :type="
                row.statusCode === 'CONFIRMED'
                  ? 'success'
                  : row.statusCode === 'VOID'
                    ? 'info'
                    : 'warning'
              "
              >{{ costLabel('COST_STATUS', row.statusCode) }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column label="操作" fixed="right" width="205"
          ><template #default="{ row }"
            ><el-button
              v-if="row.statusCode !== 'VOID' && can(permission + ':write')"
              link
              type="primary"
              @click="edit(row as CostRecord)"
              >编辑</el-button
            ><el-button
              v-if="row.statusCode === 'DRAFT' && can(permission + ':confirm')"
              link
              type="primary"
              :disabled="saving"
              @click="transition(row as CostRecord, 'confirm')"
              >确认</el-button
            ><el-button
              v-if="row.statusCode !== 'VOID' && can(permission + ':void')"
              link
              type="danger"
              :disabled="saving"
              @click="transition(row as CostRecord, 'void')"
              >作废</el-button
            ><el-button link @click="showHistory(row as CostRecord)">记录</el-button></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        v-show="!loadError"
        class="supply-list-pagination"
        :current-page="currentPage"
        :page-size="pageSize"
        :total="page.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        :disabled="loading"
        @current-change="changePage"
        @size-change="changePageSize"
    /></el-card>
    <el-dialog
      v-model="editorVisible"
      :title="(editingId ? '编辑' : '新增') + title"
      width="800px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-alert v-if="editorError" :title="editorError" type="error" :closable="false" />
      <el-alert
        v-if="editingConfirmed"
        title="已确认费用修改后将重新进入待确认状态，请填写变更原因。"
        type="warning"
        :closable="false"
      />
      <el-form label-width="115px" class="cost-editor">
        <el-form-item label="费用事项" required
          ><el-input v-model="form.title" maxlength="200"
        /></el-form-item>
        <el-form-item v-if="form.logistics" label="物流类型" required
          ><CostDictSelect
            v-model="form.logistics.legCode"
            code="COST_LOGISTICS_LEG"
            @update:model-value="clearSources"
        /></el-form-item>
        <template v-if="form.logistics">
          <el-form-item label="来源单据" required
            ><div class="full-width">
              <el-input v-model="sourceKeyword" placeholder="输入来源单号查询"
                ><template #append
                  ><el-button :loading="sourceLoading" @click="searchSources"
                    >查询单据</el-button
                  ></template
                ></el-input
              ><el-select
                v-model="form.logistics.sourceIds"
                multiple
                filterable
                class="full-width"
                placeholder="同一趟运输可合并多张单据"
                @change="selectSources"
                ><el-option
                  v-for="s in sources"
                  :key="s.id"
                  :value="s.id"
                  :label="
                    s.documentNo + ' · ' + (s.senderName || '—') + ' → ' + (s.receiverName || '—')
                  "
              /></el-select>
              <p class="field-hint">
                按同一归属城市、发收仓库和供应商合并；一次运输只登记一笔费用。
              </p>
            </div></el-form-item
          >
          <el-form-item label="承运方"
            ><el-input v-model="form.logistics.carrierName" maxlength="120" /></el-form-item
          ><el-form-item label="运单号"
            ><el-input v-model="form.logistics.trackingNo" maxlength="100"
          /></el-form-item>
          <el-form-item label="运输方式" required
            ><CostDictSelect
              v-model="form.logistics.transportMethodCode"
              code="COST_TRANSPORT_METHOD" /></el-form-item
          ><el-form-item label="费用承担方" required
            ><CostDictSelect v-model="form.logistics.payerCode" code="COST_PAYER"
          /></el-form-item>
        </template>
        <el-form-item
          v-if="category === 'marketing' || category === 'expenses'"
          label="费用类型"
          required
          ><CostDictSelect v-model="form.typeCode" :code="typeDictionary"
        /></el-form-item>
        <el-form-item label="归属城市" required
          ><el-select
            v-model="form.cityCode"
            filterable
            :disabled="category === 'logistics'"
            placeholder="选择城市"
            @change="selectCity"
            ><el-option
              v-for="city in editorCities"
              :key="city.code"
              :label="city.name"
              :value="city.code" /></el-select
        ></el-form-item>
        <el-form-item v-if="hasEmployee" label="归属人" required
          ><el-select v-model="form.ownerEmployeeCode" filterable @change="selectEmployee"
            ><el-option
              v-for="e in employees"
              :key="e.employeeCode"
              :label="employeeLabel(e)"
              :value="e.employeeCode" /></el-select
        ></el-form-item>
        <template v-if="form.rental">
          <el-form-item label="所属仓库" required
            ><el-select v-model="form.rental.warehouseId" filterable
              ><el-option
                v-for="w in warehouses"
                :key="w.value"
                :label="w.label"
                :value="w.value" /></el-select
          ></el-form-item>
          <el-form-item label="合同号" required
            ><el-input v-model="form.rental.contractNo" maxlength="100" /></el-form-item
          ><el-form-item label="租赁面积（㎡）" required
            ><el-input-number v-model="form.rental.area" :min="0" :precision="2"
          /></el-form-item>
          <el-form-item label="租期开始" required
            ><el-date-picker
              v-model="form.rental.leaseFrom"
              value-format="YYYY-MM-DD" /></el-form-item
          ><el-form-item label="租期截止" required
            ><el-date-picker
              v-model="form.rental.leaseTo"
              value-format="YYYY-MM-DD" /></el-form-item
          ><el-form-item label="押金（元）"
            ><div>
              <el-input-number v-model="form.rental.deposit" :min="0" :precision="2" /><span
                class="field-hint"
              >
                押金单列，不计成本</span
              >
            </div></el-form-item
          >
        </template>
        <el-form-item label="费用日期" required
          ><el-date-picker v-model="form.costDate" value-format="YYYY-MM-DD" /></el-form-item
        ><el-form-item label="费用金额（元）" :required="category !== 'logistics'"
          ><div>
            <el-input-number
              v-model="form.amount"
              :min="0"
              :precision="2"
              :max="99999999999999.99"
            /><span v-if="category === 'logistics'" class="field-hint">
              留空为待补录，0 元需确认说明</span
            >
          </div></el-form-item
        >
        <el-form-item label="付款状态" required
          ><CostDictSelect v-model="form.paymentStatusCode" code="COST_PAYMENT_STATUS"
        /></el-form-item>
        <el-form-item label="备注"
          ><el-input
            v-model="form.remark"
            type="textarea"
            maxlength="1000"
            show-word-limit /></el-form-item
        ><el-form-item v-if="editingId" label="变更原因" :required="editingConfirmed"
          ><el-input v-model="form.reason" type="textarea" maxlength="500"
        /></el-form-item> </el-form
      ><template #footer
        ><el-button @click="editorVisible = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save">保存</el-button></template
      >
    </el-dialog>
    <el-drawer v-model="detailVisible" :title="detail?.documentNo" size="min(900px, 95vw)"
      ><template v-if="detail"
        ><el-descriptions :column="2" border
          ><el-descriptions-item label="事项">{{ detail.data.title }}</el-descriptions-item
          ><el-descriptions-item label="金额"
            >¥{{ costMoney(detail.data.amount) }}</el-descriptions-item
          ><el-descriptions-item label="归属城市">{{ detail.data.cityName }}</el-descriptions-item
          ><el-descriptions-item label="费用日期">{{ detail.data.costDate }}</el-descriptions-item
          ><el-descriptions-item label="归属人">{{
            detail.ownerEmployeeName || '—'
          }}</el-descriptions-item
          ><el-descriptions-item label="确认状态">{{
            costLabel('COST_STATUS', detail.statusCode)
          }}</el-descriptions-item
          ><el-descriptions-item label="备注">{{
            detail.data.remark || '—'
          }}</el-descriptions-item></el-descriptions
        ><template v-if="detail.data.logistics"
          ><h3>运输信息</h3>
          <el-descriptions :column="2" border
            ><el-descriptions-item label="承运方">{{
              detail.data.logistics.carrierName || '—'
            }}</el-descriptions-item
            ><el-descriptions-item label="运单号">{{
              detail.data.logistics.trackingNo || '—'
            }}</el-descriptions-item
            ><el-descriptions-item label="承担方">{{
              costLabel('COST_PAYER', detail.data.logistics.payerCode)
            }}</el-descriptions-item
            ><el-descriptions-item label="运输方式">{{
              costLabel('COST_TRANSPORT_METHOD', detail.data.logistics.transportMethodCode)
            }}</el-descriptions-item></el-descriptions
          >
          <h3>来源单据</h3>
          <el-table :data="detail.sources" border
            ><el-table-column prop="documentNo" label="单号" min-width="180" /><el-table-column
              prop="senderName"
              label="发货方" /><el-table-column
              prop="receiverName"
              label="收货方" /></el-table></template
        ><template v-if="detail.data.rental"
          ><h3>租赁信息</h3>
          <el-descriptions :column="2" border
            ><el-descriptions-item label="仓库">{{ detail.warehouseName }}</el-descriptions-item
            ><el-descriptions-item label="合同号">{{
              detail.data.rental.contractNo
            }}</el-descriptions-item
            ><el-descriptions-item label="租期"
              >{{ detail.data.rental.leaseFrom }} 至
              {{ detail.data.rental.leaseTo }}</el-descriptions-item
            ><el-descriptions-item label="面积"
              >{{ detail.data.rental.area }} ㎡</el-descriptions-item
            ><el-descriptions-item label="押金"
              >¥{{ costMoney(detail.data.rental.deposit) }}</el-descriptions-item
            ></el-descriptions
          ></template
        ></template
      ></el-drawer
    >
    <el-drawer v-model="historyVisible" title="操作记录" size="min(700px, 95vw)"
      ><el-alert
        v-if="historyError"
        :title="historyError"
        type="error"
        :closable="false"
      /><el-timeline v-loading="historyLoading"
        ><el-timeline-item
          v-for="(item, index) in history"
          :key="index"
          :timestamp="item.occurredTime"
          ><strong>{{ auditLabel(item.action) }}</strong>
          <p>{{ item.reason || '—' }}</p>
          <p class="field-hint">操作人：{{ item.actorId }}</p>
          <el-collapse
            ><el-collapse-item title="查看当时记录">
              <el-descriptions :column="1" border>
                <el-descriptions-item
                  v-for="field in costSnapshotFields(
                    item.snapshot ?? parseSnapshot(item.snapshotJson),
                  )"
                  :key="field.label"
                  :label="field.label"
                  >{{ field.value }}</el-descriptions-item
                >
              </el-descriptions>
            </el-collapse-item></el-collapse
          ></el-timeline-item
        ></el-timeline
      ></el-drawer
    >
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import SupplyListFilters from '@/components/supply/SupplyListFilters.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { errorMessage } from '@/api/core/error'
import { getCostCities } from '@/api/core/cost'
import {
  changeCostStatus,
  getCostEmployees,
  getCostHistory,
  getCostSources,
  getCostWarehouses,
  getCosts,
  saveCost,
  type CostAudit,
  type CostCategory,
  type CostCommand,
  type CostEmployee,
  type CostPage,
  type CostQuery,
  type CostRecord,
  type CostSource,
  type CostWarehouse,
} from '@/api/core/cost'
import CostDictSelect from './CostDictSelect.vue'
import { costLabel, costMoney, loadCostDictionaries } from './cost-dictionaries'
import { exportCostRows } from './cost-export'
import { auditLabel, parseSnapshot, costSnapshotFields } from './cost-audit'
const route = useRoute(),
  { can } = useSupplyPermissions()
const category = computed<CostCategory>(() =>
  route.path.endsWith('/expenses')
    ? 'expenses'
    : route.path.endsWith('/warehouse-rentals')
      ? 'warehouse-rentals'
      : route.path.endsWith('/marketing')
        ? 'marketing'
        : 'logistics',
)
const titles: Record<CostCategory, string> = {
  logistics: '物流费用',
  marketing: '营销费用',
  'warehouse-rentals': '仓库租赁',
  expenses: '报销费用',
}
const title = computed(() => titles[category.value])
const permission = computed(() =>
  category.value === 'expenses'
    ? 'hr:expense'
    : category.value === 'logistics'
      ? 'order:logistics-cost'
      : 'erp:cost:' + (category.value === 'warehouse-rentals' ? 'rental' : 'marketing'),
)
const hasEmployee = computed(() => category.value === 'marketing' || category.value === 'expenses')
const typeDictionary = computed(() =>
  category.value === 'logistics'
    ? 'COST_LOGISTICS_LEG'
    : category.value === 'marketing'
      ? 'MARKETING_EXPENSE_TYPE'
      : category.value === 'expenses'
        ? 'REIMBURSEMENT_EXPENSE_TYPE'
        : '',
)
const description = computed(() =>
  category.value === 'logistics'
    ? '按运输趟次登记；仅已确认、本公司承担的费用计入成本。'
    : category.value === 'warehouse-rentals'
      ? '租金按费用日期归集，押金单独记录。'
      : '按归属城市、人员及费用类型登记，确认后计入成本。',
)
const emptyFilters = () => ({
  documentNo: '',
  title: '',
  remark: '',
  trackingNo: '',
  sourceDocumentNo: '',
  contractNo: '',
  dateFrom: '',
  dateTo: '',
  typeCode: '',
  cityCode: '',
  statusCode: '',
  paymentStatusCode: '',
  ownerEmployeeCode: '',
  warehouseId: '',
})
const filters = ref(emptyFilters()),
  currentPage = ref(1),
  pageSize = ref(20)
const appliedFilters = ref<Omit<CostQuery, 'begin' | 'step'>>({})
const page = ref<CostPage>({ total: 0, begin: 0, step: 20, items: [] }),
  loading = ref(false),
  loadError = ref(''),
  saving = ref(false)
const employees = ref<CostEmployee[]>([]),
  warehouses = ref<CostWarehouse[]>([]),
  cities = ref<{ code: string; name: string }[]>([])
const editorVisible = ref(false),
  editorError = ref(''),
  editingId = ref<string | null>(null),
  editingConfirmed = ref(false)
const sources = ref<CostSource[]>([]),
  sourceKeyword = ref(''),
  sourceLoading = ref(false)
const detailVisible = ref(false),
  detail = ref<CostRecord | null>(null),
  historyVisible = ref(false),
  historyLoading = ref(false),
  historyError = ref(''),
  history = ref<CostAudit[]>([])
function blank(): CostCommand {
  return {
    requestId: crypto.randomUUID(),
    revision: null,
    title: '',
    typeCode: null,
    cityCode: '',
    cityName: '',
    departmentId: null,
    ownerEmployeeCode: null,
    costDate: '',
    amount: null,
    paymentStatusCode: 'UNPAID',
    logistics:
      category.value === 'logistics'
        ? {
            legCode: 'PURCHASE',
            sourceIds: [],
            voucherIds: [],
            carrierName: '',
            trackingNo: '',
            transportMethodCode: '',
            payerCode: 'COMPANY',
          }
        : null,
    rental:
      category.value === 'warehouse-rentals'
        ? { warehouseId: null, area: null, contractNo: '', leaseFrom: '', leaseTo: '', deposit: 0 }
        : null,
    remark: '',
    reason: '',
  }
}
const form = ref<CostCommand>(blank())
const editorCities = computed(() =>
  cities.value.some((c) => c.code === form.value.cityCode) || !form.value.cityCode
    ? cities.value
    : [
        ...cities.value,
        { code: form.value.cityCode, name: form.value.cityName || form.value.cityCode },
      ],
)
let requestVersion = 0
async function load() {
  const version = ++requestVersion,
    selected = category.value
  loading.value = true
  loadError.value = ''
  try {
    const result = await getCosts(selected, {
      ...appliedFilters.value,
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
    })
    if (version === requestVersion) page.value = result
  } catch (e) {
    if (version === requestVersion) {
      page.value = {
        ...page.value,
        items: [],
        confirmedAmount: undefined,
        paidAmount: undefined,
        pendingCount: undefined,
      }
      loadError.value = errorMessage(e, '费用查询失败')
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}
function search() {
  if (
    filters.value.dateFrom &&
    filters.value.dateTo &&
    filters.value.dateFrom > filters.value.dateTo
  ) {
    ElMessage.warning('截止日期不能早于开始日期')
    return
  }
  appliedFilters.value = Object.fromEntries(
    Object.entries(filters.value)
      .map(([key, value]) => [key, value?.trim()])
      .filter(([, value]) => !!value),
  )
  currentPage.value = 1
  void load()
}
function reset() {
  filters.value = emptyFilters()
  search()
}
function changePage(value: number) {
  if (currentPage.value === value) return
  currentPage.value = value
  void load()
}
function changePageSize(value: number) {
  if (pageSize.value === value) return
  pageSize.value = value
  currentPage.value = 1
  void load()
}
async function references() {
  const selected = category.value
  const results = await Promise.allSettled([
    loadCostDictionaries(),
    getCostCities(),
    selected === 'marketing' || selected === 'expenses'
      ? getCostEmployees(selected)
      : Promise.resolve([]),
    selected === 'warehouse-rentals' ? getCostWarehouses(selected) : Promise.resolve([]),
  ])
  if (selected !== category.value) return
  const [, area, people, storage] = results
  if (area.status === 'fulfilled') cities.value = area.value
  if (people.status === 'fulfilled') employees.value = people.value
  if (storage.status === 'fulfilled') warehouses.value = storage.value
  for (const result of results)
    if (result.status === 'rejected')
      ElMessage.error(errorMessage(result.reason, '部分业务选项加载失败，请刷新重试'))
}
function employeeLabel(e: CostEmployee) {
  return (
    e.employeeName + ' · ' + e.employeeCode + (e.departmentName ? ' · ' + e.departmentName : '')
  )
}
function edit(row?: CostRecord) {
  editingId.value = row?.id ?? null
  editingConfirmed.value = row?.statusCode === 'CONFIRMED'
  form.value = row
    ? { ...JSON.parse(JSON.stringify(row.data)), revision: row.revision, reason: '' }
    : blank()
  sources.value = row?.sources ? [...row.sources] : []
  sourceKeyword.value = ''
  editorError.value = ''
  editorVisible.value = true
  void references()
}
function clearSources() {
  if (form.value.logistics) form.value.logistics.sourceIds = []
  sources.value = []
  form.value.cityCode = ''
  form.value.cityName = ''
}
async function searchSources() {
  if (!form.value.logistics) return
  sourceLoading.value = true
  const leg = form.value.logistics.legCode
  try {
    const found = await getCostSources(leg, sourceKeyword.value)
    if (leg === form.value.logistics?.legCode) {
      const selected = sources.value.filter((s) => form.value.logistics?.sourceIds.includes(s.id))
      sources.value = Array.from(new Map([...selected, ...found].map((s) => [s.id, s])).values())
      if (!found.length) ElMessage.info('没有符合条件的来源单据')
    }
  } catch (e) {
    editorError.value = errorMessage(e, '来源单据查询失败')
  } finally {
    sourceLoading.value = false
  }
}
function selectSources() {
  const selected = sources.value.find((s) => form.value.logistics?.sourceIds.includes(s.id))
  form.value.cityCode = selected?.cityCode ?? ''
  form.value.cityName =
    cities.value.find((c) => c.code === selected?.cityCode)?.name ?? selected?.cityCode ?? ''
}
function selectCity() {
  form.value.cityName = cities.value.find((c) => c.code === form.value.cityCode)?.name ?? ''
}
function selectEmployee() {
  form.value.departmentId =
    employees.value.find((e) => e.employeeCode === form.value.ownerEmployeeCode)?.departmentId ??
    null
}
async function save() {
  if (
    !form.value.title.trim() ||
    !form.value.cityCode ||
    !form.value.costDate ||
    (hasEmployee.value && !form.value.ownerEmployeeCode) ||
    (category.value !== 'logistics' && form.value.amount == null)
  ) {
    editorError.value = '请填写费用事项、归属城市、日期、金额及归属人等必填信息'
    return
  }
  saving.value = true
  editorError.value = ''
  try {
    await saveCost(category.value, editingId.value, form.value)
    editorVisible.value = false
    ElMessage.success('费用已保存')
    await load()
  } catch (e) {
    editorError.value = errorMessage(e, '保存失败')
  } finally {
    saving.value = false
  }
}
async function transition(row: CostRecord, action: 'confirm' | 'void') {
  const required = action === 'void' || Number(row.data.amount) === 0
  let reason: string
  try {
    const answer = await ElMessageBox.prompt(
      action === 'void'
        ? '作废后不再计入成本，请填写原因。'
        : '确认金额和归属无误后计入成本。0 元费用需填写说明。',
      action === 'void' ? '作废费用' : '确认费用',
      {
        inputPlaceholder: required ? '必填：操作原因' : '操作说明（可选）',
        inputValidator: (value) => !required || !!value?.trim() || '请填写操作原因',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
      },
    )
    reason = answer.value ?? ''
  } catch {
    return
  }
  saving.value = true
  try {
    await changeCostStatus(category.value, row, action, reason)
    ElMessage.success('操作成功')
    await load()
  } catch (e) {
    ElMessage.error(errorMessage(e, '操作失败'))
  } finally {
    saving.value = false
  }
}
function showDetail(row: CostRecord) {
  detail.value = row
  detailVisible.value = true
}
async function showHistory(row: CostRecord) {
  historyVisible.value = true
  historyLoading.value = true
  history.value = []
  historyError.value = ''
  try {
    history.value = await getCostHistory(category.value, row.id)
  } catch (e) {
    historyError.value = errorMessage(e, '操作记录加载失败')
  } finally {
    historyLoading.value = false
  }
}
function exportPage() {
  exportCostRows(
    title.value,
    ['费用单号', '事项', '城市', '归属人', '费用日期', '金额', '确认状态', '付款状态'],
    page.value.items.map((r) => [
      r.documentNo,
      r.data.title,
      r.data.cityName,
      r.ownerEmployeeName,
      r.data.costDate,
      r.data.amount,
      costLabel('COST_STATUS', r.statusCode),
      costLabel('COST_PAYMENT_STATUS', r.data.paymentStatusCode),
    ]),
  )
}
watch(
  category,
  () => {
    editorVisible.value = false
    detailVisible.value = false
    historyVisible.value = false
    employees.value = []
    warehouses.value = []
    cities.value = []
    page.value = { total: 0, begin: 0, step: pageSize.value, items: [] }
    reset()
    void references()
  },
  { immediate: true },
)
</script>
<style scoped lang="scss">
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.page-heading p,
.field-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.cost-editor :deep(.el-select),
.full-width {
  width: 100%;
}
.full-width .el-select {
  margin-top: 8px;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
}
@media (max-width: 768px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
