<template>
  <div class="order-register-page supply-page supply-page--business-main">
    <OrderRegisterFilterCard :loading="loading" query-first @search="search" @reset="resetFilters">
      <template #actions>
        <el-button plain :loading="exporting" @click="exportCsv">导出</el-button>
        <el-button type="primary" @click="monthlyExportVisible = true">月业绩导出</el-button>
        <TableColumnSettings
          plain
          :columns="orderColumns.columns"
          :visibility="orderColumns.visibility"
          @change="orderColumns.setVisible"
          @reset="orderColumns.reset"
        />
        <OrderPackageSyncButton plain @completed="loadOrders" />
      </template>
      <template #primary>
        <el-date-picker
          v-model="filters.orderDateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="~"
          start-placeholder="下单开始日期"
          end-placeholder="下单结束日期"
          aria-label="下单时间"
          style="width: 280px"
        />
        <el-date-picker
          v-model="pageFilters.paymentTimeRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="~"
          start-placeholder="收款开始日期"
          end-placeholder="收款结束日期"
          aria-label="收款日期"
          style="width: 280px"
        />
        <el-input v-model="filters.orderNo" aria-label="订单号" clearable placeholder="订单号" style="width: 190px" @keyup.enter="search" />
        <el-input v-model="pageFilters.dhbOrderNo" aria-label="订货宝单号" clearable placeholder="订货宝单号" style="width: 220px" @keyup.enter="search" />
        <el-input v-model="filters.customerName" aria-label="客户名称" clearable placeholder="客户名称" style="width: 220px" @keyup.enter="search" />
        <el-tree-select
          v-model="filters.regionCode"
          v-clear-filter-on-empty-input="() => (filters.regionCode = '')"
          :data="areaTree"
          :props="areaTreeProps"
          node-key="code"
          check-strictly
          :render-after-expand="false"
          :default-expanded-keys="areaTree.map((row) => row.code)"
          aria-label="归属地区"
          clearable
          filterable
          placeholder="归属地区"
          popper-class="order-register-tree-popper"
          style="width: 180px"
        />
        <el-select
          v-model="filters.ownerEmployeeCode"
          v-clear-filter-on-empty-input="() => (filters.ownerEmployeeCode = '')"
          aria-label="业务员"
          clearable
          filterable
          remote
          reserve-keyword
          placeholder="搜索业务员"
          :remote-method="searchEmployees"
          :loading="employeeLoading"
          style="width: 140px"
        >
          <el-option
            v-for="item in employeeOptions"
            :key="item.employeeCode"
            :label="item.employeeName"
            :value="item.employeeCode"
          />
        </el-select>
        <el-tree-select
          v-model="filters.departmentId"
          v-clear-filter-on-empty-input="() => (filters.departmentId = null)"
          :data="departmentOptionsTree"
          :props="departmentTreeProps"
          node-key="id"
          check-strictly
          :render-after-expand="false"
          :default-expanded-keys="departmentOptionsTree.map((row) => row.id)"
          aria-label="部门"
          clearable
          filterable
          placeholder="选择部门"
          popper-class="order-register-tree-popper"
          style="width: 180px"
        />
        <el-checkbox v-model="filters.includeSubDepartments">含子部门</el-checkbox>
        <el-select v-model="pageFilters.discountStatus" aria-label="优惠情况" clearable placeholder="优惠情况" style="width: 115px">
          <el-option label="全部" value="" />
          <el-option label="有优惠" value="true" />
          <el-option label="无优惠" value="false" />
        </el-select>
        <el-select v-model="pageFilters.orderStatusCode" aria-label="订单状态" clearable placeholder="订单状态" style="width: 115px">
          <el-option v-for="item in orderStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="pageFilters.paymentStatusCode" aria-label="收款状态" clearable placeholder="收款状态" style="width: 115px">
          <el-option v-for="item in paymentStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="pageFilters.dhbLinked" aria-label="订货宝关联单" clearable placeholder="订货宝关联单" style="width: 140px">
          <el-option label="已关联" value="true" />
          <el-option label="未关联" value="false" />
        </el-select>
        <el-checkbox v-model="pageFilters.hasUnpaid">仅看待回款</el-checkbox>
        <el-select v-model="pageFilters.invoiceStatusCode" aria-label="发票状态" clearable placeholder="发票状态" style="width: 115px">
          <el-option v-for="item in invoiceStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select
          v-model="filters.createdBy"
          v-clear-filter-on-empty-input="() => (filters.createdBy = '')"
          aria-label="创建人"
          clearable
          filterable
          placeholder="创建人"
          style="width: 125px"
        >
          <el-option v-for="name in creatorOptions" :key="name" :label="name" :value="name" />
        </el-select>
      </template>
    </OrderRegisterFilterCard>

    <el-alert v-if="totals.missingLineOrderCount" :closable="false" type="warning"
      :title="`当前筛选有 ${totals.missingLineOrderCount} 笔订单缺少明细，订货金额、优惠额及优惠率暂无法完整计算。`" />
    <div class="order-summary" aria-label="金额统计">
      <div class="order-summary__metric order-summary__metric--payable">
        <span class="order-summary__label">订单金额</span>
        <strong class="order-summary__value">{{ moneyText(totals.payableAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--paid">
        <el-tooltip content="所选订单累计回款，包含订货宝待财务确认和已确认金额；已取消回款不计入。" placement="top">
          <span class="order-summary__label">回款金额</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ moneyText(totals.paidAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--paid">
        <el-tooltip content="当前筛选订单的累计回款÷订单金额；按收款日期筛选时取整单最近一次有效收款日期，订单金额为零时不计算。" placement="top">
          <span class="order-summary__label">回款率</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ repaymentRateText(totals.paidAmount, totals.payableAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--unpaid">
        <span class="order-summary__label">待收金额</span>
        <strong class="order-summary__value">{{ moneyText(totals.unpaidAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--count">
        <el-tooltip content="当前筛选全部下单客户，按客户ID去重；未关联客户不计入。" placement="top">
          <span class="order-summary__label">客户数</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ totals.customerCount ?? '-' }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--ordered">
        <el-tooltip content="当前筛选全部订单的有效明细：单价×数量合计。" placement="top">
          <span class="order-summary__label">订货金额</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ moneyText(totals.originalAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--discount">
        <span class="order-summary__label">优惠额</span>
        <strong class="order-summary__value">{{ moneyText(totals.discountAmount) }}</strong>
      </div>
      <div class="order-summary__metric order-summary__metric--discount">
        <el-tooltip content="（订货金额合计－订单金额合计）÷订货金额合计；不平均各订单优惠率。订货金额为零时不计算。" placement="top">
          <span class="order-summary__label">优惠率</span>
        </el-tooltip>
        <strong class="order-summary__value">{{ discountRateText(totals.discountRate) }}</strong>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          class="business-table supply-scroll-table order-register-table"
          height="100%"
          v-loading="loading"
          :data="pageData.items"
          row-key="id"
          :default-sort="{ prop: 'createdTime', order: 'descending' }"
          @sort-change="changeSort"
        >
          <template #empty>
            <div v-if="loadFailed" class="order-load-failed">
              <span>订单列表加载失败，当前没有可展示的数据。</span>
              <el-button link type="primary" @click="loadOrders">重新加载</el-button>
            </div>
            <span v-else>暂无数据</span>
          </template>
          <el-table-column type="index" label="序号" width="70" fixed="left" :index="tableRowIndex" />
          <el-table-column label="订单号" width="170" fixed="left" sortable="custom" prop="orderNo">
            <template #default="{ row }">
              <el-link type="primary" underline="never" @click.stop="openDetail(row)">
                <span class="order-no-cell">{{ row.orderNo || '-' }}</span>
              </el-link>
            </template>
          </el-table-column>
          <el-table-column prop="customerName" label="客户名称" width="190" fixed="left" show-overflow-tooltip>
            <template #default="{ row }"><strong class="order-party-name">{{ row.customerName || '-' }}</strong></template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('ownerEmployee')" label="业务员" width="120">
            <template #default="{ row }"><strong class="order-party-name">{{ employeeLabel(row.ownerEmployeeCode, row.ownerEmployeeName) }}</strong></template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('payableAmount')" label="订单金额" width="120" align="right" prop="payableAmount" sortable="custom">
            <template #header>
              <el-tooltip content="折扣、优惠后真实下单的实际应收金额。" placement="top">
                <span class="column-header-hint">订单金额</span>
              </el-tooltip>
            </template>
            <template #default="{ row }">
              <span class="amount amount--strong">{{ moneyText(row.payableAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('paidAmount')" label="收款金额" width="120" align="right" prop="paidAmount">
            <template #default="{ row }">
              <span class="amount amount--paid">{{ moneyText(row.paidAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('unpaidAmount')" label="待收金额" width="120" align="right" prop="unpaidAmount">
            <template #default="{ row }">
              <span class="amount" :class="Number(row.unpaidAmount) > 0 ? 'amount--due' : 'amount--muted'">
                {{ moneyText(row.unpaidAmount) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('paymentStatus')" label="收款状态" width="110">
            <template #default="{ row }">
              <el-tag class="order-status-tag" :type="orderPaymentStatusTag(row.paymentStatusCode)" effect="light">
                {{ row.paymentStatusCode === 'UNPAID' ? '未收款' : orderPaymentStatusLabel(row.paymentStatusCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('paymentTime')" label="收款日期" width="170" sortable="custom" prop="paymentTime">
            <template #header>
              <el-tooltip content="整单最近一次有效收款日期；查询当月结清业绩时，请同时选择收款状态“已收款”。"><span class="column-header-hint">收款日期</span></el-tooltip>
            </template>
            <template #default="{ row }">
              <el-link
                v-if="row.paymentTime && canViewOrders"
                class="payment-time-link"
                type="primary"
                underline="hover"
                title="查看此订单的回款记录"
                @click.stop="openPayments(row)"
              >{{ displayDateTime(row.paymentTime) }}</el-link>
              <span v-else-if="row.paymentTime">{{ displayDateTime(row.paymentTime) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('orderDate')" label="下单时间" width="170" sortable="custom" prop="orderDate">
            <template #default="{ row }">{{ displayDateTime(row.orderDate) }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('departmentName')" label="部门" width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ departmentLabel(row.departmentId, row.departmentName) }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('regionName')" label="归属地区" width="140">
            <template #default="{ row }">{{ areaLabel(row.regionCode, row.regionName) }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('originalAmount')" label="订货金额" width="120" align="right" prop="originalAmount">
            <template #header>
              <el-tooltip content="所有有效订单明细的单价×数量合计；缺少明细时不以订单头金额代替。" placement="top">
                <span class="column-header-hint">订货金额</span>
              </el-tooltip>
            </template>
            <template #default="{ row }">
              <span class="amount amount--muted">{{ moneyText(row.originalAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('discountAmount')" label="优惠额" width="120" align="right" prop="discountAmount" sortable="custom">
            <template #default="{ row }">{{ moneyText(row.discountAmount) }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('discountRate')" label="优惠率" width="100" align="right" prop="discountRate" sortable="custom">
            <template #default="{ row }">{{ discountRateText(row.discountRate) }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('orderStatus')" label="订单状态" width="110">
            <template #default="{ row }">
              <el-tooltip
                :disabled="!orderStatusHint(row as OrderRegisterOrderItem)"
                :content="orderStatusHint(row as OrderRegisterOrderItem)"
                placement="top"
              >
                <el-tag class="order-status-tag" :type="orderStatusTone(row as OrderRegisterOrderItem)" effect="light">
                {{ orderStatusText(row as OrderRegisterOrderItem) }}
              </el-tag>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('invoiceStatus')" label="发票状态" width="110">
            <template #default="{ row }">
              <el-tag class="order-status-tag" :type="orderInvoiceStatusTag(row.invoiceStatusCode)" effect="light">
                {{ orderInvoiceStatusText(row as OrderRegisterOrderItem) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('checkedAmount')" label="已核对金额" width="120" align="right" prop="checkedAmount">
            <template #default="{ row }">
              <span class="amount amount--muted">{{ moneyText(row.checkedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('shipmentTime')" label="发货时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.shipmentTime) }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('dhbOrderNo')" label="订货宝订单号" width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.dhbOrderNo || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('sourceOrderNo')" label="来源单号" width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.sourceOrderNo || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('createdBy')" label="创建人" width="110" show-overflow-tooltip>
            <template #header>
              <el-tooltip content="来源系统真实创建人；无来源时为本系统记录人。" placement="top">
                <span class="column-header-hint">创建人</span>
              </el-tooltip>
            </template>
            <template #default="{ row }">{{ row.createdBy || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('createdTime')" label="创建时间" width="170" sortable="custom" prop="createdTime">
            <template #default="{ row }">{{ displayDateTime(row.createdTime) }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('updatedBy')" label="修改人" width="110" show-overflow-tooltip>
            <template #header>
              <el-tooltip content="来源系统真实修改人；无来源时为本系统记录人。" placement="top">
                <span class="column-header-hint">修改人</span>
              </el-tooltip>
            </template>
            <template #default="{ row }">{{ row.updatedBy || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('updatedTime')" label="修改时间" width="170">
            <template #default="{ row }">{{ displayDateTime(row.updatedTime) }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('syncedBy')" label="同步人" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.syncedBy || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="orderColumns.isVisible('syncedAt')" label="同步时间" width="170" sortable="custom" prop="syncedAt">
            <template #default="{ row }">{{ displayDateTime(row.syncedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right" class-name="order-actions-cell">
            <template #default="{ row }">
              <el-button
                v-if="canViewOrders"
                class="order-action order-action--detail"
                link
                type="primary"
                size="small"
                @click="openLines(row)"
              >
                明细
              </el-button>
              <el-button
                v-if="canInvoiceOrders && isInvoiceNotApplied(row as OrderRegisterOrderItem)"
                class="order-action order-action--invoice-apply"
                link
                type="primary"
                title="申请发票"
                size="small"
                @click="openInvoiceApply(row as OrderRegisterOrderItem)"
              >
                发票
              </el-button>
              <el-button
                v-else-if="canInvoiceOrders"
                class="order-action order-action--invoice-view"
                link
                type="primary"
                title="查看发票"
                size="small"
                @click="openInvoice(row as OrderRegisterOrderItem)"
              >
                发票
              </el-button>
              <el-button
                v-if="canDeleteOrder(row as OrderRegisterOrderItem)"
                class="order-action order-action--delete"
                link
                type="danger"
                size="small"
                @click="deleteDraftOrder(row as OrderRegisterOrderItem)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="pageData.total"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="onPageSizeChange"
          @current-change="loadOrders"
        />
      </div>
    </el-card>

    <el-dialog v-model="monthlyExportVisible" title="月业绩导出" width="580px">
      <p>导出城市、销售两张汇总表，包含所选月份的交易额、回款额和未回款额。</p>
      <el-date-picker v-model="monthlyRange" type="monthrange" value-format="YYYY-MM"
        start-placeholder="开始月份" end-placeholder="结束月份" range-separator="至" aria-label="业绩月份"
        :disabled-date="(date: Date) => date.getTime() > Date.now()" style="width: 100%" />
      <p class="monthly-export-note">交易额按下单月份、回款额按实际回款月份，未回款额为月末累计欠款（当前月截至导出时）。导出全部可见订单，不受列表筛选和分页影响。</p>
      <template #footer>
        <el-button @click="monthlyExportVisible = false">取消</el-button>
        <el-button type="primary" :loading="monthlyExporting" @click="exportMonthlyPerformance">导出 Excel</el-button>
      </template>
    </el-dialog>
    <OrderRegisterDetailDrawer
      v-model="detailVisible"
      :order-id="detailOrderId"
      :initial-tab="detailTab"
    />

    <OrderInvoiceApplyDialog
      v-model="invoiceApplyVisible"
      :order-no="invoiceApplyOrderNo"
      @applied="loadOrders"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { businessMonth } from '@/utils/business-date'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import OrderPackageSyncButton from '@/components/supply/OrderPackageSyncButton.vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import OrderRegisterDetailDrawer from './components/OrderRegisterDetailDrawer.vue'
import OrderInvoiceApplyDialog from './components/OrderInvoiceApplyDialog.vue'
import TableColumnSettings from '@/components/supply/TableColumnSettings.vue'
import { displayDateTime } from '@/utils/business-date'
import {
  moneyText,
  repaymentRateText,
  orderPaymentStatusLabel,
  orderPaymentStatusTag,
  orderStatusLabel,
  orderStatusTag,
} from '@/utils/order-register-status'
import { orderInvoiceStatusLabel, orderInvoiceStatusTag } from '@/utils/order-invoice-status'
import { dateRangeParams, empty, orderRegisterDateParams } from '@/utils/order-register-query'
import { csvFilename, downloadBlob } from '@/utils/file-download'
import {
  exportOrderRegisterCsv,
  getMonthlyPerformance,
  getOrderRegisterOrders,
  type OrderRegisterCoverage,
  type OrderRegisterOrderItem,
  type OrderRegisterOrderPage,
} from '@/api/core/order-register'
import { deleteSalesOrder } from '@/api/core/order-sales'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { vClearFilterOnEmptyInput } from '@/utils/filter-select-clear'
import { useOrderRegisterCommonFilters } from '@/composables/useOrderRegisterQuery'
import { useOrderRegisterOptions } from '@/composables/useOrderRegisterOptions'
import { useColumnSettings } from '@/composables/useColumnSettings'

const router = useRouter()
const route = useRoute()
const { can } = useSupplyPermissions()
const canViewOrders = computed(() => can('order:read'))
const canInvoiceOrders = computed(() => can('order:invoice:write'))

const orderColumns = useColumnSettings('order-list', [
  { key: 'customerName', label: '客户名称', locked: true },
  { key: 'ownerEmployee', label: '业务员' },
  { key: 'payableAmount', label: '订单金额' },
  { key: 'paidAmount', label: '收款金额' },
  { key: 'unpaidAmount', label: '待收金额' },
  { key: 'paymentStatus', label: '收款状态' },
  { key: 'paymentTime', label: '收款日期' },
  { key: 'orderDate', label: '下单时间' },
  { key: 'departmentName', label: '部门' },
  { key: 'regionName', label: '归属地区' },
  { key: 'originalAmount', label: '订货金额' },
  { key: 'discountAmount', label: '优惠额' },
  { key: 'discountRate', label: '优惠率' },
  { key: 'orderStatus', label: '订单状态' },
  { key: 'invoiceStatus', label: '发票状态' },
  { key: 'checkedAmount', label: '已核对金额' },
  { key: 'shipmentTime', label: '发货时间' },
  { key: 'dhbOrderNo', label: '订货宝订单号' },
  { key: 'sourceOrderNo', label: '来源单号' },
  { key: 'createdBy', label: '创建人', defaultVisible: false },
  { key: 'createdTime', label: '创建时间', defaultVisible: false },
  { key: 'updatedBy', label: '修改人', defaultVisible: false },
  { key: 'updatedTime', label: '修改时间', defaultVisible: false },
  { key: 'syncedBy', label: '同步人', defaultVisible: false },
  { key: 'syncedAt', label: '同步时间', defaultVisible: false },
])
const {
  areaTree,
  departmentOptionsTree,
  employeeOptions,
  employeeLoading,
  creatorOptions,
  areaTreeProps,
  departmentTreeProps,
  loadOptions,
  searchEmployees,
  areaLabel,
  departmentLabel,
  employeeLabel,
} = useOrderRegisterOptions()
const { filters, resetCommonFilters } = useOrderRegisterCommonFilters()
const pageFilters = reactive({
  paymentTimeRange: null as [string, string] | null,
  hasUnpaid: false,
  discountStatus: '' as string | undefined,
  dhbOrderNo: '',
  orderStatusCode: '',
  paymentStatusCode: '',
  invoiceStatusCode: '',
  /** '' 不过滤；'true' 已关联订货宝订单号；'false' 未关联。 */
  dhbLinked: '',
})

const orderStatusOptions = [
  { value: 'DRAFT', label: '草稿（含待完善）' },
  { value: 'PENDING_OUTBOUND', label: '待出库' },
  { value: 'PENDING_SHIPPED', label: '待发货' },
  { value: 'RECEIVED', label: '已收货' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
  { value: 'RETURNED', label: '已退货' },
  { value: 'SUBMITTED', label: '已提交（飞书历史）' },
]
const paymentStatusOptions = [
  { value: 'UNPAID', label: '未收款' },
  { value: 'PARTIAL_PAID', label: '部分收款' },
  { value: 'PAID', label: '已收款' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'REFUNDED', label: '已退款' },
  { value: 'CANCELLED', label: '已取消' },
]
/** 与列表展示口径一致：已撤回和没有发票行都按“未申请”处理。 */
const invoiceStatusOptions = [
  { value: 'NOT_APPLIED', label: '未申请' },
  { value: 'PENDING', label: '待开票' },
  { value: 'INVOICED', label: '已开票' },
]

const loading = ref(false)
const loadFailed = ref(false)
const exporting = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const sortBy = ref<'createdTime' | 'orderDate' | 'syncedAt' | 'orderNo' | 'payableAmount' | 'discountAmount' | 'discountRate' | 'paymentTime'>('createdTime')
const sortDirection = ref<'asc' | 'desc'>('desc')
const pageData = ref<OrderRegisterOrderPage>({
  total: 0,
  begin: 0,
  step: 20,
  items: [],
  totals: {
    originalAmount: 0,
    payableAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    checkedAmount: 0,
  },
  coverage: null,
})
const totals = computed(() => pageData.value.totals)

function discountRateText(value: number | null | undefined): string {
  return value == null ? '-' : `${(value * 100).toFixed(2)}%`
}

const monthlyExportVisible = ref(false)
const monthlyExporting = ref(false)
const reportNow = businessMonth(new Date())
const reportYear = Number(reportNow.slice(0, 4))
const reportMonth = Number(reportNow.slice(5))
const monthlyRange = ref<[string, string] | null>([
  `${reportMonth < 4 ? reportYear - 1 : reportYear}-04`, `${reportYear}-${String(reportMonth).padStart(2, '0')}`,
])
async function exportMonthlyPerformance() {
  if (!monthlyRange.value?.[0] || !monthlyRange.value?.[1]) { ElMessage.warning('请选择业绩月份'); return }
  monthlyExporting.value = true
  try {
    const { performanceMonths, monthlyPerformanceBlob } = await import('@/utils/monthly-performance-export')
    const [monthFrom, monthTo] = monthlyRange.value
    performanceMonths(monthFrom, monthTo)
    const report = await getMonthlyPerformance({ monthFrom, monthTo })
    const blob = await monthlyPerformanceBlob(report)
    downloadBlob(blob, `月业绩汇总_${monthFrom}_${monthTo}.xlsx`)
    monthlyExportVisible.value = false
  } catch (reason) { ElMessage.error(errorMessage(reason, '月业绩导出失败，请重试')) }
  finally { monthlyExporting.value = false }
}

const detailVisible = ref(false)
const detailOrderId = ref<string | number | null>(null)
const detailTab = ref('overview')

const invoiceApplyVisible = ref(false)
const invoiceApplyOrderNo = ref('')

/** 列表入口只在未申请（含已撤回）时出现；已申请的发票在发票管理页处理。 */
function isInvoiceNotApplied(row: { invoiceStatusCode?: string | null }) {
  const status = row.invoiceStatusCode
  return !status || status === 'NOT_APPLIED' || status === 'REVOKED'
}

function openInvoice(row: { orderNo?: string; invoiceStatusCode?: string | null }) {
  if (isInvoiceNotApplied(row)) {
    openInvoiceApply(row)
    return
  }
  // 已申请（待开票/已开票）：跳到发票管理页并按订单号过滤，集中处理
  void router.push({
    path: '/supply-chain/order/invoices',
    query: { orderNo: row.orderNo },
  })
}

function openInvoiceApply(row: { orderNo?: string }) {
  if (!row.orderNo) return
  invoiceApplyOrderNo.value = row.orderNo
  invoiceApplyVisible.value = true
}

function coverageText(coverage: OrderRegisterCoverage | null): string {
  if (!coverage) return ''
  if (coverage.message) return coverage.message
  if (coverage.historyComplete === false) {
    return coverage.coverageFrom
      ? `历史数据仅可从 ${coverage.coverageFrom} 起准确回溯，此前范围不完整。`
      : '历史数据覆盖不完整，未回款等历史口径不能视为已确认。'
  }
  return ''
}

/** 历史覆盖提示改成可关闭的轻提示，不再常驻占用列表高度。 */
function notifyCoverage(coverage: OrderRegisterCoverage | null) {
  const message = coverageText(coverage)
  if (!message) return
  ElMessage.warning({ message, showClose: true, duration: 8000, grouping: true })
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}

function buildQuery() {
  const dateParams = orderRegisterDateParams(filters.orderDateRange)
  return {
    begin: (currentPage.value - 1) * pageSize.value,
    step: pageSize.value,
    orderNo: empty(filters.orderNo),
    dhbOrderNo: empty(pageFilters.dhbOrderNo),
    customerName: empty(filters.customerName),
    regionCode: empty(filters.regionCode),
    ownerEmployeeCode: empty(filters.ownerEmployeeCode),
    departmentId: filters.departmentId ?? undefined,
    includeSubDepartments: filters.includeSubDepartments,
    createdBy: empty(filters.createdBy),
    orderStatusCode: empty(pageFilters.orderStatusCode),
    paymentStatusCode: empty(pageFilters.paymentStatusCode),
    invoiceStatusCode: empty(pageFilters.invoiceStatusCode),
    dhbLinked: empty(pageFilters.dhbLinked) == null ? undefined : pageFilters.dhbLinked === 'true',
    hasUnpaid: pageFilters.hasUnpaid || undefined,
    hasDiscount: empty(pageFilters.discountStatus) == null ? undefined : pageFilters.discountStatus === 'true',
    sortBy: sortBy.value,
    sortDirection: sortDirection.value,
    ...dateParams,
    ...dateRangeParams(pageFilters.paymentTimeRange, 'paymentTimeFrom', 'paymentTimeTo'),
  }
}

async function loadOrders() {
  loading.value = true
  loadFailed.value = false
  try {
    pageData.value = await getOrderRegisterOrders(buildQuery())
    notifyCoverage(pageData.value.coverage)
  } catch (reason) {
    loadFailed.value = true
    ElMessage.error({
      message: errorMessage(reason, '订单列表加载失败，请稍后重试'),
      showClose: true,
      grouping: true,
    })
  } finally {
    loading.value = false
  }
}

function search() {
  currentPage.value = 1
  void loadOrders()
}

function clearFilters() {
  pageFilters.paymentTimeRange = null
  pageFilters.hasUnpaid = false
  pageFilters.discountStatus = ''
  resetCommonFilters()
  pageFilters.orderStatusCode = ''
  pageFilters.paymentStatusCode = ''
  pageFilters.invoiceStatusCode = ''
  pageFilters.dhbLinked = ''
  pageFilters.dhbOrderNo = ''
  sortBy.value = 'createdTime'
  sortDirection.value = 'desc'
}

function resetFilters() { clearFilters(); search() }

function onPageSizeChange() {
  currentPage.value = 1
  void loadOrders()
}

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

function changeSort({ prop, order }: { prop: string | null; order: string | null }) {
  const allowed = new Set(['createdTime', 'orderDate', 'syncedAt', 'orderNo', 'payableAmount', 'discountAmount', 'discountRate', 'paymentTime'])
  if (prop && order && allowed.has(prop)) {
    sortBy.value = prop as typeof sortBy.value
    sortDirection.value = order === 'ascending' ? 'asc' : 'desc'
  } else {
    sortBy.value = 'createdTime'
    sortDirection.value = 'desc'
  }
  search()
}

function openDetail(row: { id?: string | number }, tab = 'overview') {
  detailTab.value = tab
  detailOrderId.value = row.id ?? null
  detailVisible.value = true
}

/** 草稿且资料待完善的历史单据单独展示为“待完善”，避免误读为可提交草稿。 */
function needsCompletion(row: OrderRegisterOrderItem) {
  return row.orderStatusCode === 'DRAFT' && row.dataQualityStatusCode === 'NEEDS_REVIEW'
}

function orderStatusText(row: OrderRegisterOrderItem) {
  return needsCompletion(row) ? '待完善' : orderStatusLabel(row.orderStatusCode)
}

function orderStatusTone(row: OrderRegisterOrderItem) {
  return needsCompletion(row) ? 'warning' : orderStatusTag(row.orderStatusCode)
}

function orderStatusHint(row: OrderRegisterOrderItem) {
  if (needsCompletion(row)) return '飞书历史单据：资料待补齐，历史回款已入账；补齐客户与商品后可提交'
  return ''
}

function orderInvoiceStatusText(row: OrderRegisterOrderItem) {
  if (row.invoiceStatusCode === 'REVOKED') return '未申请'
  return row.invoiceStatusName || orderInvoiceStatusLabel(row.invoiceStatusCode)
}

function openLines(row: { orderNo?: string }) {
  if (row.orderNo) {
    void router.push({ path: '/supply-chain/order/lines', query: { orderNo: row.orderNo } })
  }
}

function openPayments(row: { orderNo?: string }) {
  if (row.orderNo) {
    void router.push({ path: '/supply-chain/order/sales-payments', query: { orderNo: row.orderNo } })
  }
}

/** 与订单编辑一致：只有草稿可删，订货宝来源不允许在这里删除。 */
function canDeleteOrder(row: OrderRegisterOrderItem) {
  return (
    can('order:delete') &&
    row.orderStatusCode === 'DRAFT' &&
    (!row.sourceSystemCode || row.sourceSystemCode === 'FEISHU')
  )
}

async function deleteDraftOrder(row: OrderRegisterOrderItem) {
  try {
    await ElMessageBox.confirm(`确认删除草稿订单 ${row.orderNo}？`, '删除草稿订单', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteSalesOrder(row.id, row.revision)
    if (String(detailOrderId.value) === String(row.id)) {
      detailVisible.value = false
    }
    ElMessage.success('草稿订单已删除')
    await loadOrders()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error({ message: errorMessage(reason, '草稿订单删除失败'), showClose: true, grouping: true })
  }
}

async function exportCsv() {
  exporting.value = true
  try {
    const query = buildQuery()
    const params: Record<string, unknown> = { ...query }
    delete params.begin
    delete params.step
    const blob = await exportOrderRegisterCsv('orders', params)
    downloadBlob(blob, csvFilename('订单列表'))
  } catch (reason) {
    ElMessage.error({ message: errorMessage(reason, '导出失败，请稍后重试'), showClose: true, grouping: true })
  } finally {
    exporting.value = false
  }
}

watch(
  () => [route.query.homeTask, route.query.orderNo],
  ([task, orderNo]) => {
    if (task !== 'shipment' && task !== 'unpaid' && typeof orderNo !== 'string') return
    clearFilters()
    pageFilters.orderStatusCode = task === 'shipment' ? 'PENDING_SHIPPED' : ''
    pageFilters.hasUnpaid = task === 'unpaid'
    filters.orderNo = typeof orderNo === 'string' ? orderNo.trim() : ''
    search()
  },
  { immediate: true },
)
onMounted(() => {
  void loadOptions()
  if (!route.query.orderNo && !['shipment', 'unpaid'].includes(String(route.query.homeTask))) void loadOrders()
})


/** 归属地区变化时清空业务员并按地区级联重载业务员选项。 */
watch(
  () => filters.regionCode,
  (value) => {
    filters.ownerEmployeeCode = ''
    void searchEmployees('', value)
  },
)

</script>

<style scoped>
.monthly-export-note { color: #64748b; font-size: 13px; line-height: 1.7; }
.order-register-page {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

/* 查询区不加卡片外框：条件与操作按钮直接落在页面背景上，留白更宽敞。 */
.supply-page.order-register-page > .filter-card {
  margin-bottom: 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.supply-page.order-register-page > .filter-card :deep(.el-card__body) {
  padding: 0;
}

.supply-page.order-register-page > .list-card {
  border-radius: 0 0 var(--supply-radius) var(--supply-radius);
}

/* 表头加粗放大，长列表滚动时更容易定位列。 */
.order-register-table :deep(.el-table__header-wrapper tr th.el-table__cell) {
  color: var(--supply-text);
  font-size: 13px;
  font-weight: 700;
}

.order-load-failed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-color-danger);
}

/* 金额列：来源金额弱化、有效金额加重、回款与待收用语义色，数字等宽便于纵向比较。 */
.amount {
  font-variant-numeric: tabular-nums;
}

.amount--muted {
  color: var(--supply-text-muted);
}

.amount--strong {
  color: var(--supply-text);
  font-weight: 600;
}

.amount--paid {
  color: #047857;
  font-weight: 600;
}

.amount--due {
  color: #b45309;
  font-weight: 600;
}

/* 常用操作保持单行，用轻量文字按钮减少固定列占用。 */
.order-register-table :deep(.order-actions-cell) {
  white-space: nowrap;
}

.order-register-table :deep(.el-table__row .order-action) {
  height: 24px;
  min-height: 24px;
  padding: 0;
  font-size: 12px;
}

.order-register-table :deep(.el-table__row .order-action + .order-action) {
  margin-left: 12px;
}

.payment-time-link {
  font-size: inherit;
  font-weight: inherit;
  white-space: nowrap;
}


.order-no-cell {
  font-weight: 600;
}

.column-header-hint {
  border-bottom: 1px dashed var(--el-border-color);
  cursor: help;
}


</style>

<style scoped src="./order-summary.css"></style>

<style scoped src="./order-status.css"></style>
