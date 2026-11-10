<template>
  <div class="ledger-workspace">
    <el-radio-group
      v-if="logistics && can(permission + ':write')"
      v-model="activePanel"
      class="ledger-tabs"
    >
      <el-radio-button value="RECORDS">运输记录</el-radio-button
      ><el-radio-button value="SOURCES">货拉拉待关联</el-radio-button
      ><el-radio-button v-if="can('order:logistics-cost:manage-imports')" value="DIFFERENCES"
        >来源差异</el-radio-button
      >
    </el-radio-group>
    <CostCarrierOrdersPanel
      v-if="logistics && activePanel !== 'RECORDS'"
      :cities="cities"
      :employees="employees"
      :references-ready="referencesReady"
      :differences-only="activePanel === 'DIFFERENCES'"
      @generated="search"
      @open-cost="viewCarrierCost"
    />
    <section v-show="activePanel === 'RECORDS'" class="filter-panel">
      <el-form class="filters" label-position="left" label-width="96px" @submit.prevent="search">
        <el-form-item label="费用单号"
          ><el-input
            v-model="filters.documentNo"
            placeholder="输入费用单号"
            clearable
            @keyup.enter="search"
        /></el-form-item>
        <template v-if="logistics">
          <el-form-item label="货拉拉／运单号"
            ><el-input
              v-model="filters.trackingNo"
              placeholder="输入货拉拉订单号或运单号"
              clearable
              @keyup.enter="search"
          /></el-form-item>
          <el-form-item label="业务单号"
            ><el-input
              v-model="filters.sourceDocumentNo"
              placeholder="输入业务单号"
              clearable
              @keyup.enter="search"
          /></el-form-item>
          <el-form-item v-if="!purchaseHistory" label="运输类型"
            ><CostDictSelect v-model="filters.typeCode" code="COST_TRANSPORT_PURPOSE" clearable
          /></el-form-item>
          <el-form-item label="运输日期"
            ><el-date-picker
              v-model="dateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              start-placeholder="开始日期"
              end-placeholder="截止日期"
              range-separator="至"
          /></el-form-item>
          <el-form-item label="单据状态"
            ><CostDictSelect v-model="filters.statusCode" code="COST_STATUS" clearable
          /></el-form-item>
          <template v-if="moreFilters">
            <el-form-item label="订单类型"
              ><el-select v-model="filters.orderTypeCode" clearable
                ><el-option
                  v-for="t in sourceTypes"
                  :key="t.value"
                  :label="t.label"
                  :value="t.value" /></el-select
            ></el-form-item>
            <el-form-item label="客户／收货方"
              ><el-input v-model="filters.receiverName" clearable @keyup.enter="search"
            /></el-form-item>
            <el-form-item label="业务员"
              ><el-input v-model="filters.sourceEmployeeName" clearable @keyup.enter="search"
            /></el-form-item>
            <el-form-item label="归属部门"
              ><el-input v-model="filters.sourceDepartmentName" clearable @keyup.enter="search"
            /></el-form-item>
            <el-form-item label="物流公司"
              ><CostDictSelect v-model="filters.carrierCode" code="COST_CARRIER" clearable
            /></el-form-item>
          </template>
        </template>
        <template v-else
          ><el-form-item label="仓库"
            ><CostLedgerPartySelect
              v-model="warehouseFilter"
              :logistics="false"
              kind="WAREHOUSE"
              placeholder="搜索并选择仓库" /></el-form-item
          ><el-form-item label="费用项目"
            ><CostDictSelect
              v-model="filters.ledgerFeeType"
              code="COST_WAREHOUSE_FEE_TYPE"
              clearable /></el-form-item
        ></template>
        <el-form-item v-if="!logistics" label="登记日期"
          ><el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="截止日期"
        /></el-form-item>
        <el-form-item v-if="moreFilters || !logistics" label="费用归属月份"
          ><el-date-picker
            v-model="filters.costMonth"
            type="month"
            value-format="YYYY-MM"
            clearable
        /></el-form-item>
        <el-form-item v-if="!logistics" label="单据状态"
          ><CostDictSelect v-model="filters.statusCode" code="COST_STATUS" clearable
        /></el-form-item>
        <el-form-item v-if="moreFilters" label="付款状态"
          ><CostDictSelect v-model="filters.paymentStatusCode" code="COST_PAYMENT_STATUS" clearable
        /></el-form-item>
        <template v-if="moreFilters"
          ><el-form-item label="费用归属城市"
            ><CostCitySelect
              v-model="cityFilter"
              :action="permission + ':read'"
              clearable
              @loaded="cities = $event" /></el-form-item
          ><el-form-item label="费用负责人"
            ><el-select v-model="filters.ownerEmployeeCode" clearable filterable
              ><el-option
                v-for="e in employees"
                :key="e.employeeCode"
                :label="e.employeeName"
                :value="e.employeeCode" /></el-select></el-form-item
        ></template>
      </el-form>
      <div class="filter-actions">
        <div class="filter-secondary-actions">
          <el-button link @click="moreFilters = !moreFilters">{{
            moreFilters ? '收起条件' : '更多条件'
          }}</el-button>
          <el-checkbox v-if="logistics && moreFilters" v-model="purchaseHistory" @change="search"
            >查看历史采购运费</el-checkbox
          >
        </div>
        <div>
          <el-button @click="reset">重置</el-button
          ><el-button type="primary" :loading="loading" @click="search">查询</el-button>
        </div>
      </div>
    </section>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="referenceError" :title="referenceError" type="error" :closable="false" />
    <el-alert
      v-if="logistics && purchaseHistory"
      title="历史采购运费仅支持查看、作废及查询操作记录。"
      type="info"
      :closable="false"
    />
    <section v-show="activePanel === 'RECORDS'" class="list-panel">
      <div class="list-toolbar">
        <div>
          <strong>{{ title }}</strong
          ><span class="count">{{ listReady ? result.total : '—' }} 条</span>
        </div>
        <div>
          <template v-if="logistics && !purchaseHistory && can(permission + ':write')">
            <el-button @click="downloadCarrierTemplate">下载导入模板</el-button>
            <el-button :disabled="!referencesReady" @click="activePanel = 'SOURCES'"
              >导入货拉拉报表</el-button
            >
          </template>
          <el-popover v-if="logistics" placement="bottom-end" width="220" trigger="click">
            <template #reference><el-button>显示列</el-button></template>
            <el-checkbox-group v-model="visibleLogisticsColumns" class="column-options">
              <el-checkbox
                v-for="item in logisticsColumnOptions"
                :key="item.key"
                :value="item.key"
                >{{ item.label }}</el-checkbox
              >
            </el-checkbox-group>
          </el-popover>
          <el-button
            v-if="can(permission + ':export')"
            :loading="exporting"
            :disabled="loading || !listReady"
            @click="openExport"
            >自定义导出</el-button
          ><el-button
            v-if="can(permission + ':write')"
            type="primary"
            :disabled="loading || saving || !referencesReady"
            @click="edit()"
            >新增{{ logistics ? '运输记录' : '仓储费用' }}</el-button
          >
        </div>
      </div>
      <div class="metrics" aria-label="筛选结果汇总" :aria-busy="loading">
        <div class="metric primary">
          <span>{{ logistics ? '已确认我方费用' : '本期已确认归属费用' }}</span
          ><strong>{{ summaryMoney(result.confirmedAmount) }}</strong>
        </div>
        <div class="metric green">
          <span>{{ logistics ? '待确认我方费用' : '本期待确认归属费用' }}</span
          ><strong>{{ summaryMoney(pendingAmount) }}</strong>
        </div>
        <div class="metric amber">
          <span>待补金额记录</span
          ><strong>{{ summaryCount(result.missingAmountCount, '条') }}</strong>
        </div>
        <div class="metric">
          <span>{{ logistics ? '第三方承担运输' : '涉及仓库' }}</span
          ><strong>{{
            summaryCount(
              logistics ? result.thirdPartyCount : result.warehouseCount,
              logistics ? '单' : '个',
            )
          }}</strong>
        </div>
      </div>
      <div v-if="selectedRows.length" class="selection-toolbar" aria-live="polite">
        <span
          >已勾选 <strong>{{ selectedRows.length }}</strong> 条</span
        >
        <el-button link type="primary" :disabled="exporting" @click="clearSelection"
          >取消勾选</el-button
        >
      </div>
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="result.items"
        border
        row-key="id"
        class="ledger-table"
        :empty-text="error ? '费用列表暂不可用，请重试' : '暂无符合条件的记录'"
        max-height="max(320px, calc(100vh - 390px))"
        @selection-change="selectionChanged"
      >
        <el-table-column
          v-if="can(permission + ':export')"
          type="selection"
          fixed="left"
          width="44"
          reserve-selection
          :selectable="() => !exporting"
        />
        <el-table-column label="费用单号" fixed="left" width="218" show-overflow-tooltip
          ><template #default="{ row }"
            ><el-button link type="primary" class="code-link" @click="view(row as CostRecord)">{{
              row.documentNo
            }}</el-button>
            <div v-if="row.data.ledger?.sourceSync?.differencePending" class="source-warning">
              来源变化待核实
            </div>
            <div
              v-else-if="row.data.ledger?.sourceSync && !row.data.ledger.sourceSync.manuallyChanged"
              class="muted"
            >
              采购约定待核实
            </div></template
          ></el-table-column
        >
        <template v-if="logistics"
          ><el-table-column
            v-if="visibleLogisticsColumns.includes('tracking')"
            label="货拉拉／运单号"
            min-width="180"
            show-overflow-tooltip
            ><template #default="{ row }"
              ><span class="nowrap">{{
                row.data.ledger?.trackingNo || row.data.logistics?.trackingNo || '—'
              }}</span></template
            ></el-table-column
          ><el-table-column
            v-if="visibleLogisticsColumns.includes('type')"
            label="运输类型"
            width="122"
            ><template #default="{ row }">{{
              purpose(row as CostRecord)
            }}</template></el-table-column
          ><el-table-column
            v-if="visibleLogisticsColumns.includes('date')"
            label="运输日期"
            width="112"
            ><template #default="{ row }"
              ><span class="nowrap">{{ row.data.costDate }}</span></template
            ></el-table-column
          ><el-table-column
            v-if="visibleLogisticsColumns.includes('sender')"
            label="发货方"
            min-width="180"
            show-overflow-tooltip
            ><template #default="{ row }">{{
              senderName(row as CostRecord)
            }}</template></el-table-column
          >
          <el-table-column
            v-if="visibleLogisticsColumns.includes('receiver')"
            label="收货方"
            min-width="210"
            ><template #default="{ row }"
              ><div class="recipient-names">
                <div v-for="(name, i) in receiverNames(row as CostRecord)" :key="i">{{ name }}</div>
              </div></template
            ></el-table-column
          >
          <el-table-column label="本单我方费用（元）" width="148" align="right"
            ><template #default="{ row }"
              ><strong>{{ costMoney(row.data.amount) }}</strong></template
            ></el-table-column
          >
          <el-table-column
            v-if="visibleLogisticsColumns.includes('carrier')"
            label="物流公司"
            width="140"
            show-overflow-tooltip
            ><template #default="{ row }">{{
              carrier(row as CostRecord)
            }}</template></el-table-column
          ><el-table-column
            v-if="visibleLogisticsColumns.includes('sources')"
            label="关联单据"
            min-width="200"
            ><template #default="{ row }"
              ><div v-for="code in sourceCodes(row as CostRecord)" :key="code" class="nowrap">
                {{ code }}
              </div></template
            ></el-table-column
          >
          <el-table-column
            v-if="visibleLogisticsColumns.includes('department')"
            label="归属部门"
            min-width="150"
            ><template #default="{ row }"
              ><div
                v-for="name in attributionNames(row as CostRecord, 'departmentName')"
                :key="name"
              >
                {{ name }}
              </div></template
            ></el-table-column
          ><el-table-column
            v-if="visibleLogisticsColumns.includes('salesperson')"
            label="业务员"
            min-width="120"
            ><template #default="{ row }"
              ><div v-for="name in attributionNames(row as CostRecord, 'employeeName')" :key="name">
                {{ name }}
              </div></template
            ></el-table-column
          ><el-table-column
            v-if="visibleLogisticsColumns.includes('payment')"
            label="付款状态"
            width="110"
            ><template #default="{ row }">{{
              costLabel('COST_PAYMENT_STATUS', row.data.paymentStatusCode)
            }}</template></el-table-column
          >
        </template>
        <template v-else
          ><el-table-column label="仓库" min-width="132" show-overflow-tooltip
            ><template #default="{ row }">{{
              row.warehouseName ||
              row.data.warehouseLedger?.warehouseCode ||
              row.data.rental?.premisesName ||
              '—'
            }}</template></el-table-column
          ><el-table-column label="服务期间" width="132"
            ><template #default="{ row }"
              ><div class="service-period">
                <span
                  v-for="(date, i) in servicePeriod(row as CostRecord).split(' 至 ')"
                  :key="i"
                  >{{ i ? `至 ${date}` : date }}</span
                >
              </div></template
            ></el-table-column
          ><el-table-column label="费用项目" width="88"
            ><template #default="{ row }"
              ><div v-for="name in warehouseFeeNames(row as CostRecord)" :key="name">
                {{ name }}
              </div></template
            ></el-table-column
          ><el-table-column label="登记日期" width="104"
            ><template #default="{ row }">{{ row.data.costDate }}</template></el-table-column
          ></template
        >
        <el-table-column v-if="!logistics" label="本单费用总额（元）" width="140" align="right"
          ><template #default="{ row }"
            ><strong>{{ costMoney(row.data.amount) }}</strong></template
          ></el-table-column
        >
        <el-table-column v-if="!logistics" label="筛选期归属费用（元）" width="150" align="right"
          ><template #default="{ row }">{{
            costMoney(row.periodAmount === undefined ? row.data.amount : row.periodAmount)
          }}</template></el-table-column
        >
        <el-table-column label="单据状态" width="100" align="center"
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
        ><el-table-column label="创建人" width="90" show-overflow-tooltip
          ><template #default="{ row }">{{
            displayRecordActor(row.createdBy)
          }}</template></el-table-column
        >
        <el-table-column label="操作" fixed="right" width="170"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="view(row as CostRecord)">查看</el-button
            ><el-button
              v-if="!purchaseHistory && row.statusCode === 'DRAFT' && can(permission + ':write')"
              link
              type="primary"
              :disabled="!referencesReady"
              @click="edit(row as CostRecord)"
              >编辑</el-button
            ><el-button
              v-if="!purchaseHistory && row.statusCode === 'DRAFT' && can(permission + ':confirm')"
              link
              type="primary"
              @click="act(row as CostRecord, 'confirm')"
              >确认</el-button
            ><el-button
              v-if="row.statusCode === 'DRAFT' && can(permission + ':void')"
              link
              type="danger"
              @click="act(row as CostRecord, 'void')"
              >作废</el-button
            ><el-button
              v-if="row.statusCode === 'CONFIRMED' && can(permission + ':confirm')"
              link
              type="primary"
              @click="act(row as CostRecord, 'revoke')"
              >撤销</el-button
            ><el-button
              v-if="row.statusCode === 'VOID' && can(permission + ':void')"
              link
              type="danger"
              @click="act(row as CostRecord, 'delete')"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <div class="pagination">
        <span v-if="!logistics" class="muted">归属费用按所选月份统计，押金不计入费用。</span
        ><el-pagination
          v-model:current-page="page"
          v-model:page-size="step"
          :page-sizes="[20, 50, 100]"
          :total="result.total"
          layout="total, sizes, prev, pager, next"
          @change="load"
        />
      </div>
    </section>
    <CostExportDialog
      v-model="exportOpen"
      v-model:fields="exportFields"
      :columns="exportColumns"
      :scope="
        exportIds.length
          ? `已勾选的 ${exportIds.length} 条记录`
          : `全部筛选结果（${exportTotal} 条）`
      "
      :busy="exporting"
      :error="exportError"
      :empty="!exportIds.length && !exportTotal"
      @confirm="exportRows"
    />
    <el-dialog
      v-model="editorOpen"
      :title="`${editing ? '编辑' : '新增'}${logistics ? '物流运输记录' : '仓储费用'}`"
      width="min(1460px, 96vw)"
      top="3vh"
      class="cost-ledger-dialog"
      :close-on-click-modal="false"
      :before-close="beforeClose"
      destroy-on-close
    >
      <el-alert v-if="saveError" :title="saveError" type="error" :closable="false">
        <template v-if="warehouseMaintenanceNeeded" #default>
          <el-link
            href="#/supply-chain/erp/inventory/warehouses"
            target="_blank"
            rel="noopener"
            type="primary"
            >打开仓库信息维护</el-link
          >
        </template>
      </el-alert>
      <el-alert
        v-if="editing && !editing.data.ledger && !editing.data.warehouseLedger"
        title="请补齐收发信息和费用归属。"
        type="info"
        :closable="false"
      />
      <CostLedgerEditor
        v-model="form"
        :logistics="logistics"
        :cities="cities"
        :employees="employees"
        :warehouse-name="editing?.warehouseName"
        :confirmed="editing?.statusCode === 'CONFIRMED'"
      />
      <section class="attachment-panel">
        <CostAttachmentEditor
          v-model="files"
          title="相关附件"
          :category="category"
          :row="editing"
          :disabled="saving"
          @busy="uploadBusy = $event"
        />
      </section>
      <template #footer
        ><div class="editor-footer">
          <span
            >{{ logistics ? '我方费用合计' : '本单费用总额' }}
            <strong>{{ costMoney(editorTotal) }}</strong></span
          >
          <div>
            <el-button :disabled="saving" @click="requestClose">取消</el-button
            ><el-button type="primary" :loading="saving" :disabled="uploadBusy" @click="save"
              >保存</el-button
            >
          </div>
        </div></template
      >
    </el-dialog>
    <el-dialog
      v-model="detailOpen"
      :title="logistics ? '物流运输记录详情' : '仓储费用详情'"
      width="min(1400px, 96vw)"
      top="3vh"
      class="cost-ledger-dialog"
      destroy-on-close
      ><CostLedgerDetail
        v-if="detail"
        :row="detail"
        :category="category"
        :show-carrier-source="!viewingSnapshot"
      /><template #footer
        ><el-button v-if="detail" @click="history(detail)">操作记录</el-button
        ><el-button @click="detailOpen = false">关闭</el-button></template
      ></el-dialog
    >
    <el-dialog
      :model-value="!!auditEvidence"
      title="来源核对记录"
      width="min(760px,94vw)"
      @close="auditEvidence = null"
    >
      <el-descriptions :column="1" border>
        <el-descriptions-item v-if="auditEvidence?.amount != null" label="核对净费用（元）">{{
          costMoney(Number(auditEvidence.amount))
        }}</el-descriptions-item>
        <el-descriptions-item v-if="auditEvidence?.reason" label="核对说明">{{
          auditEvidence.reason
        }}</el-descriptions-item>
        <el-descriptions-item v-if="auditEvidence?.sourceOrderNo" label="货拉拉订单号">{{
          auditEvidence.sourceOrderNo
        }}</el-descriptions-item>
        <el-descriptions-item v-if="auditEvidence?.previous" label="原平台账单（元）">{{
          evidenceBill(auditEvidence.previous)
        }}</el-descriptions-item>
        <el-descriptions-item v-if="auditEvidence?.accepted" label="已接受平台账单（元）">{{
          evidenceBill(auditEvidence.accepted)
        }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
    <el-dialog v-model="historyOpen" title="操作记录" width="min(1100px, 94vw)"
      ><el-alert
        v-if="historyError"
        :title="historyError"
        type="error"
        :closable="false"
      /><el-table :data="audits" border
        ><el-table-column label="操作时间" width="200"
          ><template #default="{ row }">{{
            displayRecordDateTime(row.occurredTime)
          }}</template></el-table-column
        ><el-table-column label="操作"
          ><template #default="{ row }">{{ auditLabel(row.action) }}</template></el-table-column
        ><el-table-column label="操作人"
          ><template #default="{ row }">{{
            displayRecordActor(row.actorId)
          }}</template></el-table-column
        ><el-table-column prop="reason" label="原因" min-width="230" /><el-table-column
          label="快照"
          width="100"
          ><template #default="{ row }"
            ><el-button
              v-if="row.snapshot"
              link
              type="primary"
              @click="showSnapshot(row.snapshot as CostRecord)"
              >查看</el-button
            ><el-button
              v-if="row.evidence"
              link
              type="primary"
              @click="auditEvidence = row.evidence"
              >查看</el-button
            ></template
          ></el-table-column
        ></el-table
      ></el-dialog
    >
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type TableInstance } from 'element-plus'
import {
  getCosts,
  getCost,
  getCostCities,
  getCostEmployees,
  getCostHistory,
  changeCostStatus,
  type CostCategory,
  type CostQuery,
  type CostPage,
  type CostRecord,
  type CostEmployee,
  type CostAudit,
  type CostCommand,
} from '@/api/core/cost'
import {
  getLedgerParties,
  getLedgerExport,
  getSelectedLogisticsExport,
} from '@/api/core/cost-ledger'
import { errorMessage } from '@/api/core/error'
import CostCarrierOrdersPanel from './CostCarrierOrdersPanel.vue'
import { lalamoveTemplate } from './lalamove-import'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { displayRecordActor, displayRecordDateTime } from '@/utils/business-display'
import {
  createLedgerCommand,
  receiverNames,
  partyName,
  newParty,
  newLogisticsFee,
  newWarehouseFee,
  previewWarehouseFee,
  totalFees,
  moneyCents,
} from './cost-ledger'
const auditEvidence = ref<Record<string, unknown> | null>(null)
function evidenceBill(value: unknown) {
  const v = value as { facts?: { billAmount?: number }; paidAmount?: number }
  return costMoney(v.facts?.billAmount ?? v.paidAmount ?? null)
}
const viewingSnapshot = ref(false)
const activePanel = ref('RECORDS')
const logisticsColumnOptions = [
  { key: 'type', label: '运输类型' },
  { key: 'date', label: '运输日期' },
  { key: 'sender', label: '发货方' },
  { key: 'receiver', label: '收货方' },
  { key: 'carrier', label: '物流公司' },
  { key: 'tracking', label: '货拉拉／运单号' },
  { key: 'sources', label: '关联单据' },
  { key: 'department', label: '归属部门' },
  { key: 'salesperson', label: '业务员' },
  { key: 'payment', label: '付款状态' },
]
const visibleLogisticsColumns = ref(['tracking', 'type', 'date', 'receiver'])
function attributionNames(row: CostRecord, field: 'employeeName' | 'departmentName') {
  const values =
    row.data.ledger?.sources
      .filter((s) => s.linkRoleCode === 'COST')
      .map((s) => s[field])
      .filter((value): value is string => typeof value === 'string' && !!value) || []
  return values.length ? [...new Set(values)] : ['-']
}
async function viewCarrierCost(id: string) {
  await view({ id } as CostRecord)
}
async function downloadCarrierTemplate() {
  try {
    await lalamoveTemplate()
  } catch (e) {
    ElMessage.error(errorMessage(e, '模板下载失败'))
  }
}
import { costLabel, costOptions, costMoney, loadCostDictionaries } from './cost-dictionaries'
import { auditLabel } from './cost-audit'
import { logisticsOrderTypes, transportTypeLabel } from './cost-transport-types'
import { exportCostRows } from './cost-export'
import CostExportDialog from './CostExportDialog.vue'
import { collectCostExportRows, selectedCostColumns } from './custom-cost-export'
import { CostAttachmentSaveSession, type CostAttachmentDraft } from './cost-attachment-draft'
import CostDictSelect from './CostDictSelect.vue'
import CostCitySelect from './CostCitySelect.vue'
import CostLedgerPartySelect from './CostLedgerPartySelect.vue'
import CostLedgerEditor from './CostLedgerEditor.vue'
import CostLedgerDetail from './CostLedgerDetail.vue'
import CostAttachmentEditor from './CostAttachmentEditor.vue'
const route = useRoute(),
  { can } = useSupplyPermissions()
const logistics = computed(() => route.path.endsWith('/logistics'))
const category = computed<CostCategory>(() => (logistics.value ? 'logistics' : 'warehouse-rentals'))
const permission = computed(() => (logistics.value ? 'order:logistics-cost' : 'erp:cost:rental'))
const title = computed(() => (logistics.value ? '物流运输记录' : '仓储费用'))
const empty = (): CostPage => ({ total: 0, begin: 0, step: 20, items: [] })
const result = ref<CostPage>(empty()),
  listReady = ref(false),
  filters = ref<Partial<CostQuery>>({}),
  dateRange = ref<string[]>([]),
  warehouseFilter = ref<string | null>(null)
const tableRef = ref<TableInstance>(),
  selectedRows = ref<CostRecord[]>([]),
  exportOpen = ref(false),
  exportIds = ref<string[]>([]),
  exportTotal = ref(0),
  exportFields = ref<string[]>([]),
  exportError = ref('')
let exportQuery: CostQuery | null = null
let appliedQuery: CostQuery | null = null
let exportGeneration = 0
const cityFilter = computed({
  get: () => filters.value.cityCode || '',
  set: (value: string) => {
    filters.value.cityCode = value
  },
})
const page = ref(1),
  purchaseHistory = ref(false),
  step = ref(20),
  loading = ref(false),
  referencesReady = ref(false),
  referenceError = ref(''),
  exporting = ref(false),
  error = ref(''),
  moreFilters = ref(false)
const cities = ref<{ code: string; name: string }[]>([]),
  employees = ref<CostEmployee[]>([])
const editorOpen = ref(false),
  editing = ref<CostRecord | null>(null),
  form = ref(createLedgerCommand(true)),
  saving = ref(false),
  saveError = ref(''),
  warehouseMaintenanceNeeded = ref(false),
  files = ref<CostAttachmentDraft[]>([]),
  uploadBusy = ref(false)
const detail = ref<CostRecord | null>(null),
  detailOpen = ref(false),
  historyOpen = ref(false),
  audits = ref<CostAudit[]>([]),
  historyError = ref('')
let generation = 0,
  interaction = 0,
  initialSignature = '',
  saveSession = new CostAttachmentSaveSession()
const pendingAmount = computed(
  () =>
    result.value.pendingAmount ??
    (result.value.registeredAmount != null && result.value.confirmedAmount != null
      ? result.value.registeredAmount - result.value.confirmedAmount
      : null),
)
const summaryMoney = (value: number | null | undefined) =>
  listReady.value && !loading.value && value != null ? `¥${costMoney(value)}` : '—'
const summaryCount = (value: number | null | undefined, unit: string) =>
  listReady.value && !loading.value && value != null ? `${value} ${unit}` : '—'
const sourceTypes = logisticsOrderTypes
const editorTotal = computed(() =>
  form.value.ledger
    ? form.value.ledger.feeItems.some((f) => f.ourAmount == null)
      ? null
      : Number(form.value.ledger.feeItems.reduce((n, f) => n + moneyCents(f.ourAmount!), 0n)) / 100
    : form.value.warehouseLedger
      ? totalFees(form.value.warehouseLedger.feeItems)
      : null,
)
const senderName = (row: CostRecord) =>
  row.data.ledger
    ? partyName(row.data.ledger.sender)
    : row.data.logistics?.senderName || row.sources[0]?.senderName || '—'
const carrier = (row: CostRecord) =>
  row.data.ledger
    ? row.data.ledger.deliveryModeCode === 'SELF'
      ? '自营'
      : row.data.ledger.carrierCode
        ? costLabel('COST_CARRIER', row.data.ledger.carrierCode)
        : '待补承运方'
    : row.data.logistics?.carrierName || '—'
const purpose = (row: CostRecord) =>
  transportTypeLabel(row.data.ledger?.transportPurposeCode || row.data.logistics?.legCode)
const sourceCodes = (row: CostRecord) =>
  row.data.ledger
    ? row.data.ledger.sources.map((s) => s.orderCode || '无关联单据')
    : row.sources.length
      ? row.sources.map((s) => s.documentNo)
      : [row.data.logistics?.externalDocumentNo || '—']
const warehouseFeeNames = (row: CostRecord) =>
  row.data.warehouseLedger
    ? [
        ...new Set(
          row.data.warehouseLedger.feeItems.map((f) =>
            costLabel('COST_WAREHOUSE_FEE_TYPE', f.feeTypeCode),
          ),
        ),
      ]
    : ['租金']
function servicePeriod(row: CostRecord) {
  const fees = row.data.warehouseLedger?.feeItems
  if (!fees)
    return row.data.rental?.leaseFrom
      ? `${row.data.rental.leaseFrom} 至 ${row.data.rental.leaseTo}`
      : '—'
  const dates = fees
    .flatMap((f) => [f.serviceFrom || f.attributionDate, f.serviceTo || f.attributionDate])
    .filter((v): v is string => !!v)
    .sort()
  return dates.length ? `${dates[0]} 至 ${dates[dates.length - 1]}` : '—'
}
function query(begin = (page.value - 1) * step.value, size = step.value): CostQuery {
  return {
    ...filters.value,
    typeCode: logistics.value && purchaseHistory.value ? 'PURCHASE' : filters.value.typeCode,
    begin,
    step: size,
    dateFrom: dateRange.value?.[0],
    dateTo: dateRange.value?.[1],
    warehouseCode: warehouseFilter.value || undefined,
  }
}
async function load() {
  const current = ++generation
  loading.value = true
  listReady.value = false
  error.value = ''
  try {
    const conditions = query()
    const data = await getCosts(category.value, conditions)
    if (current === generation) {
      result.value = data
      appliedQuery = { ...conditions }
      listReady.value = true
    }
  } catch (e) {
    if (current === generation) {
      result.value = empty()
      error.value = errorMessage(e, '费用列表加载失败')
    }
  } finally {
    if (current === generation) loading.value = false
  }
}
function search() {
  clearSelection()
  page.value = 1
  void load()
}
function clearSelection() {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}
function selectionChanged(rows: CostRecord[]) {
  selectedRows.value = rows
}
function reset() {
  purchaseHistory.value = false
  filters.value = {}
  dateRange.value = []
  warehouseFilter.value = null
  search()
}
let initialization = 0
async function init() {
  const current = ++initialization
  ++exportGeneration
  exportOpen.value = false
  exportIds.value = []
  exportFields.value = []
  exportQuery = null
  clearSelection()
  ++generation
  ++interaction
  listReady.value = false
  loading.value = true
  referencesReady.value = false
  referenceError.value = ''
  cities.value = []
  employees.value = []
  const selectedCategory = category.value
  const selectedPermission = permission.value
  editorOpen.value = false
  detailOpen.value = false
  historyOpen.value = false
  result.value = empty()
  filters.value = {}
  page.value = 1
  purchaseHistory.value = false
  dateRange.value = []
  warehouseFilter.value = null
  // 列表不依赖编辑目录；并行加载，目录迟到或失败不阻断已授权的列表和汇总。
  await Promise.all([
    load(),
    (async () => {
      try {
        const [, catalog, people] = await Promise.all([
          loadCostDictionaries(selectedCategory),
          getCostCities(selectedPermission + ':read'),
          getCostEmployees(selectedCategory),
        ])
        if (current !== initialization) return
        cities.value = catalog
        employees.value = people
        referencesReady.value = true
      } catch (e) {
        if (current === initialization)
          referenceError.value = errorMessage(e, '费用目录加载失败，请刷新后重试')
      }
    })(),
  ])
  if (current !== initialization) return
  const id = route.query.sourceId || route.query.costId || route.query.id
  if (typeof id === 'string') await view({ id } as CostRecord)
}
watch(
  category,
  () => {
    activePanel.value = 'RECORDS'
    void init()
  },
  { immediate: true },
)
watch(
  () => route.query.sourceId,
  (id) => {
    if (typeof id === 'string') void view({ id } as CostRecord)
  },
)
async function view(row: CostRecord) {
  const current = ++interaction,
    selectedCategory = category.value
  try {
    const value = await getCost(selectedCategory, row.id)
    if (current !== interaction || selectedCategory !== category.value) return
    viewingSnapshot.value = false
    detail.value = value
    detailOpen.value = true
  } catch (e) {
    if (current === interaction) ElMessage.error(errorMessage(e, '详情加载失败'))
  }
}
async function edit(row?: CostRecord) {
  if (!referencesReady.value) return
  const token = ++interaction,
    selectedCategory = category.value,
    isLogistics = logistics.value
  try {
    const current = row ? await getCost(selectedCategory, row.id) : null
    if (token !== interaction || selectedCategory !== category.value) return
    if (current && current.statusCode !== 'DRAFT')
      throw new Error('只有待确认费用可编辑，已确认费用请先撤销')
    const draft =
      current?.data.ledger || current?.data.warehouseLedger
        ? structuredClone(current.data)
        : createLedgerCommand(isLogistics)
    if (current) {
      draft.requestId = current.data.requestId
      draft.revision = current.revision
      draft.reason = ''
      if (!current.data.ledger && !current.data.warehouseLedger)
        await convertLegacy(current, draft, isLogistics)
    } else if (cities.value.length === 1) {
      draft.cityCode = cities.value[0]!.code
      draft.cityName = cities.value[0]!.name
      if (draft.ledger) draft.ledger.receivingPoints[0]!.cityCode = draft.cityCode
    }
    if (token !== interaction || selectedCategory !== category.value) return
    if (draft.ledger?.transportPurposeCode === 'NON_SALES')
      draft.ledger.transportPurposeCode = 'OTHER'
    editing.value = current
    files.value = []
    saveError.value = ''
    warehouseMaintenanceNeeded.value = false
    saveSession = new CostAttachmentSaveSession()
    form.value = draft
    if (draft.warehouseLedger) draft.warehouseLedger.feeItems.forEach(previewWarehouseFee)
    initialSignature = JSON.stringify(form.value)
    editorOpen.value = true
  } catch (e) {
    if (token === interaction) ElMessage.error(errorMessage(e, '编辑信息加载失败'))
  }
}
async function convertLegacy(row: CostRecord, draft: CostCommand, isLogistics: boolean) {
  const old = row.data
  Object.assign(draft, {
    cityCode: old.cityCode,
    cityName: old.cityName,
    costDate: old.costDate,
    paymentStatusCode: old.paymentStatusCode,
    departmentId: old.departmentId,
    ownerEmployeeCode: old.ownerEmployeeCode,
    remark: old.remark,
  })
  if (isLogistics) {
    const p = draft.ledger!,
      l = old.logistics
    p.transportPurposeCode = l?.legCode === 'NON_SALES' ? 'OTHER' : l?.legCode || 'OTHER'
    p.costMonth = old.costMonth || old.costDate.slice(0, 7)
    p.trackingNo = l?.trackingNo || ''
    p.carrierCode =
      costOptions('COST_CARRIER').find((o) => o.label === l?.carrierName)?.value || null
    p.sender = {
      ...newParty(old.cityCode),
      partyTypeCode: 'OTHER',
      manualName: l?.senderName || row.sources[0]?.senderName || '',
      address: l?.originAddress || row.sources[0]?.originAddress || '',
    }
    p.receivingPoints = receiverNames(row).map((name) => ({
      ...newParty(old.cityCode),
      partyTypeCode: 'OTHER',
      manualName: name === '—' ? '' : name,
      address: l?.destinationAddress || '',
    }))
    const fee = newLogisticsFee()
    fee.feeAmount = old.amount
    fee.ourAmount = old.amount
    p.feeItems = [fee]
    p.sources = row.sources.map((s) => ({
      orderTypeCode:
        (
          {
            PURCHASE: 'PURCHASE_ORDER',
            TRANSFER: 'TRANSFER_ORDER',
            DELIVERY: 'SALES_ORDER',
          } as Record<string, string>
        )[s.sourceType] || s.sourceType,
      orderCode: s.documentNo,
      linkRoleCode: 'COST',
      allocations: [],
    }))
    if (!p.sources.length)
      p.sources.push({
        orderTypeCode: 'NONE',
        orderCode: null,
        linkRoleCode: 'COST',
        allocations: [],
        noSourceReason: old.logistics?.noSourceReason || '',
      })
    if (p.sources.length === 1)
      p.sources[0]!.allocations.push({
        feeKey: fee.feeKey,
        receivingPointCode: p.receivingPoints[0]!.pointCode,
        cityCode: old.cityCode,
        basis: null,
        amount: fee.ourAmount,
      })
  } else {
    const w = draft.warehouseLedger!,
      rental = old.rental
    if (rental?.warehouseId) {
      const refs = await getLedgerParties(false, 'WAREHOUSE', { id: String(rental.warehouseId) })
      w.warehouseCode = refs[0]?.code || null
    }
    w.contractNo = rental?.contractNo || ''
    w.depositAmount = rental?.deposit ?? null
    const fee = newWarehouseFee(old.costDate)
    fee.feeAmount = old.amount
    fee.attributionDate = old.costMonth ? `${old.costMonth}-01` : old.costDate
    w.feeItems = [fee]
    previewWarehouseFee(fee)
  }
}
function validateForm() {
  if (!form.value.cityCode && form.value.ledger?.receivingPoints[0]?.cityCode)
    form.value.cityCode = form.value.ledger.receivingPoints[0].cityCode
  form.value.cityName =
    cities.value.find((c) => c.code === form.value.cityCode)?.name || form.value.cityName
  if (!form.value.cityCode || !form.value.cityName) throw new Error('请选择费用归属城市')
  if (!form.value.costDate) throw new Error('请选择日期')
  if (!form.value.paymentStatusCode) throw new Error('请选择付款状态')
  if (form.value.warehouseLedger) form.value.warehouseLedger.feeItems.forEach(previewWarehouseFee)
  form.value.amount = editorTotal.value
}
async function save() {
  if (saving.value || uploadBusy.value) return
  const token = interaction,
    selectedCategory = category.value,
    draft = form.value
  saveError.value = ''
  warehouseMaintenanceNeeded.value = false
  saving.value = true
  try {
    await checkWarehouseRegions()
    if (token !== interaction || selectedCategory !== category.value || draft !== form.value) return
    validateForm()
    const saved = await saveSession.save(
      category.value,
      editing.value?.id || null,
      form.value,
      files.value,
      (row) => {
        editing.value = row
        form.value.revision = row.revision
      },
    )
    initialSignature = JSON.stringify(form.value)
    editorOpen.value = false
    ElMessage.success('费用已保存，待确认')
    await load()
    if (detail.value?.id === saved.id) detail.value = saved
  } catch (e) {
    if (token === interaction && selectedCategory === category.value && draft === form.value)
      saveError.value = errorMessage(e, '费用保存失败，请核对填写内容')
  } finally {
    saving.value = false
  }
}
async function checkWarehouseRegions() {
  const draft = form.value,
    isLogistics = logistics.value
  const codes = new Set(
    draft.ledger
      ? [draft.ledger.sender, ...draft.ledger.receivingPoints]
          .filter((p) => p.partyTypeCode === 'WAREHOUSE' && p.partyCode)
          .map((p) => p.partyCode!)
      : draft.warehouseLedger?.warehouseCode
        ? [draft.warehouseLedger.warehouseCode]
        : [],
  )
  for (const code of codes) {
    // 每次保存重新读取主档，业务在另一页面补齐后无需重建本单。
    const rows = await getLedgerParties(isLogistics, 'WAREHOUSE', { code })
    if (draft !== form.value) return
    const row = rows.find((r) => r.code === code)
    if (!row) throw new Error(`仓库“${code}”不存在、已停用或无权限，请重新选择`)
    if (!row.cityCode?.trim()) {
      warehouseMaintenanceNeeded.value = true
      throw new Error(
        `仓库“${row.name}（${code}）”未维护业务归属地区，请到仓库信息补齐后重新保存；所在地区不能替代业务归属地区`,
      )
    }
    if (!cities.value.some((c) => c.code === row.cityCode)) {
      warehouseMaintenanceNeeded.value = true
      throw new Error(
        `仓库“${row.name}（${code}）”的业务归属地区不在可用费用城市中，请核对仓库业务归属地区和城市权限`,
      )
    }
  }
}
async function act(row: CostRecord, action: 'confirm' | 'void' | 'revoke' | 'delete') {
  const current = ++interaction,
    selectedCategory = category.value
  try {
    let reason = ''
    if (action !== 'confirm') {
      const label = { void: '作废', revoke: '撤销', delete: '删除' }[action]
      const input = await ElMessageBox.prompt(
        `请填写${label}原因，操作记录和附件将保留。`,
        `${label}费用`,
        { inputValidator: (value) => !!value?.trim() || `请填写${label}原因` },
      )
      reason = input.value.trim()
    } else
      await ElMessageBox.confirm(
        '确认后计入正式费用统计，请核对费用承担方、收货信息和分摊金额。',
        '确认费用',
        { type: 'warning' },
      )
    if (current !== interaction || selectedCategory !== category.value) return
    await changeCostStatus(selectedCategory, row, action, reason)
    if (current !== interaction || selectedCategory !== category.value) return
    ElMessage.success(
      {
        confirm: '费用已确认',
        void: '费用已作废',
        revoke: '已撤销，费用回到待确认',
        delete: '费用已删除',
      }[action],
    )
    await load()
  } catch (e) {
    if (current === interaction && e !== 'cancel' && e !== 'close')
      ElMessage.error(errorMessage(e, '操作失败，请刷新后重试'))
  }
}
function showSnapshot(row: CostRecord) {
  viewingSnapshot.value = true
  ++interaction
  detail.value = row
  detailOpen.value = true
}
async function history(row: CostRecord) {
  const current = ++interaction,
    selectedCategory = category.value
  audits.value = []
  historyError.value = ''
  historyOpen.value = true
  try {
    const values = await getCostHistory(selectedCategory, row.id)
    if (current === interaction && selectedCategory === category.value) audits.value = values
  } catch (e) {
    if (current === interaction) historyError.value = errorMessage(e, '操作记录加载失败')
  }
}
async function allowClose() {
  if (saving.value || uploadBusy.value) return false
  if (
    editorOpen.value &&
    (JSON.stringify(form.value) !== initialSignature ||
      files.value.some((f) => f.status !== 'uploaded'))
  ) {
    try {
      await ElMessageBox.confirm('当前内容或附件尚未全部保存，确认关闭？', '关闭编辑', {
        type: 'warning',
      })
      return true
    } catch {
      return false
    }
  }
  return true
}
async function beforeClose(done: () => void) {
  if (await allowClose()) done()
}
async function requestClose() {
  if (await allowClose()) editorOpen.value = false
}
onBeforeRouteLeave(allowClose)
onBeforeRouteUpdate(allowClose)
onBeforeUnmount(() => {
  ++initialization
  ++generation
  ++interaction
  ++exportGeneration
})
type LogisticsExportKey =
  | 'documentNo'
  | 'type'
  | 'date'
  | 'sender'
  | 'receivers'
  | 'carrier'
  | 'tracking'
  | 'sources'
  | 'amount'
  | 'status'
  | 'creator'
  | 'warehouse'
  | 'servicePeriod'
  | 'feeNames'
  | 'periodAmount'
const exportColumns = computed<{ key: LogisticsExportKey; label: string }[]>(() =>
  logistics.value
    ? [
        { key: 'documentNo', label: '费用单号' },
        { key: 'type', label: '运输类型' },
        { key: 'date', label: '运输日期' },
        { key: 'sender', label: '发货方' },
        { key: 'receivers', label: '收货方' },
        { key: 'carrier', label: '物流公司' },
        { key: 'tracking', label: '货拉拉／运单号' },
        { key: 'sources', label: '关联单据' },
        { key: 'amount', label: '本单我方费用（元）' },
        { key: 'status', label: '单据状态' },
        { key: 'creator', label: '创建人' },
      ]
    : [
        { key: 'documentNo', label: '费用单号' },
        { key: 'warehouse', label: '仓库' },
        { key: 'servicePeriod', label: '服务期间' },
        { key: 'feeNames', label: '费用项目' },
        { key: 'amount', label: '本单费用总额（元）' },
        { key: 'periodAmount', label: '筛选期归属费用（元）' },
        { key: 'status', label: '单据状态' },
        { key: 'creator', label: '创建人' },
      ],
)
function openExport() {
  if (loading.value || !listReady.value || !can(permission.value + ':export')) return
  exportIds.value = [...new Set(selectedRows.value.map((row) => row.id))]
  exportTotal.value = result.value.total
  exportQuery = { ...appliedQuery, begin: 0, step: 200 }
  exportFields.value = exportColumns.value.map((column) => column.key)
  exportError.value = ''
  exportOpen.value = true
}
async function exportRows() {
  if (exporting.value || !can(permission.value + ':export')) return
  exporting.value = true
  exportError.value = ''
  const generation = exportGeneration
  const isLogistics = logistics.value,
    exportTitle = title.value,
    conditions = { ...exportQuery },
    selectedIds = [...exportIds.value]
  try {
    const columns = selectedCostColumns(exportColumns.value, exportFields.value)
    let rows: CostRecord[]
    if (isLogistics && selectedIds.length) {
      rows = []
      for (let begin = 0; begin < selectedIds.length; begin += 200) {
        const chunk = selectedIds.slice(begin, begin + 200)
        const data = await getSelectedLogisticsExport(chunk)
        if (generation !== exportGeneration) return
        const found = new Map(data.map((row) => [row.id, row]))
        if (
          found.size !== chunk.length ||
          data.length !== chunk.length ||
          chunk.some((id) => !found.has(id))
        )
          throw new Error('所选记录已变化，请刷新后重新勾选')
        rows.push(...chunk.map((id) => found.get(id)!))
      }
    } else {
      const collected = await collectCostExportRows({
        fetchPage: (begin, step) => getLedgerExport(isLogistics, { ...conditions, begin, step }),
        key: (row) => row.id,
        selected: selectedIds,
        limit: 20000,
        current: () => generation === exportGeneration,
      })
      if (!collected) return
      rows = collected
    }
    if (generation !== exportGeneration) return
    await exportCostRows(
      exportTitle,
      columns.map((c) => c.label),
      rows.map((r) => {
        const values = {
          documentNo: r.documentNo,
          type: purpose(r),
          date: r.data.costDate,
          sender: senderName(r),
          receivers: receiverNames(r).join('\n'),
          carrier: carrier(r),
          tracking: r.data.ledger?.trackingNo || r.data.logistics?.trackingNo || '',
          sources: sourceCodes(r).join('\n'),
          amount: r.data.amount,
          status: costLabel('COST_STATUS', r.statusCode),
          creator: displayRecordActor(r.createdBy),
          warehouse: r.warehouseName,
          servicePeriod: servicePeriod(r),
          feeNames: warehouseFeeNames(r).join('\n'),
          periodAmount: r.periodAmount === undefined ? r.data.amount : r.periodAmount,
        }
        return columns.map((c) => values[c.key])
      }),
    )
    if (generation === exportGeneration) exportOpen.value = false
  } catch (e) {
    if (generation === exportGeneration) exportError.value = errorMessage(e, '导出失败')
  } finally {
    exporting.value = false
  }
}
</script>
<style scoped>
.column-options {
  display: flex;
  flex-direction: column;
}
.ledger-tabs {
  margin-bottom: 16px;
}
.ledger-workspace {
  padding: 16px;
  background: #f5f7fb;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.filter-panel,
.list-panel {
  background: #fff;
  border: 1px solid #dce4ee;
  border-radius: 9px;
  overflow: hidden;
}
.filter-panel {
  padding: 16px 18px 12px;
}
.filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 20px;
}
.filters :deep(.el-form-item) {
  min-width: 0;
  margin-bottom: 12px;
}
.filters :deep(.el-form-item__label) {
  padding-right: 12px;
  white-space: nowrap;
}
.filters :deep(.el-form-item__content) {
  min-width: 0;
}
.filters :deep(.el-input),
.filters :deep(.el-select),
.filters :deep(.el-date-editor) {
  width: 100%;
}
.filter-actions,
.list-toolbar,
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.filter-secondary-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}
.filter-actions {
  border-top: 1px solid #edf0f5;
  padding-top: 10px;
}
.list-toolbar > div:last-child,
.filter-actions > div:last-child {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.ledger-table :deep(.el-table-fixed-column--right .cell) {
  white-space: nowrap;
}
.ledger-table :deep(.el-button + .el-button) {
  margin-left: 10px;
}
.selection-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #f0f5ff;
  color: #46617f;
  padding: 8px 18px;
  border-top: 1px solid #e4ebf5;
}
.selection-toolbar strong {
  color: #2862ec;
}
.list-toolbar {
  padding: 14px 18px;
  border-bottom: 1px solid #e1e7f0;
}
.list-toolbar strong {
  font-size: 17px;
}
.count {
  color: #2862ec;
  background: #eef4ff;
  padding: 3px 10px;
  margin-left: 12px;
  border-radius: 20px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 14px 18px;
}
.metric {
  border: 1px solid #dce3ed;
  border-top: 3px solid #8396af;
  background: #f7f9fc;
  border-radius: 8px;
  padding: 10px 14px;
  min-width: 0;
}
.metric span {
  display: block;
  color: #6d7f99;
}
.metric strong {
  display: block;
  font-size: 24px;
  line-height: 1.4;
  margin-top: 4px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.metric.primary {
  border-top-color: #2862ec;
  background: #f4f7ff;
}
.metric.primary strong {
  color: #2862ec;
}
.metric.green {
  border-top-color: #078263;
  background: #f2f8f5;
}
.metric.green strong {
  color: #078263;
}
.metric.amber {
  border-top-color: #b66c19;
}
.pagination {
  flex-wrap: wrap;
  justify-content: flex-end;
  padding: 12px 18px;
}
.pagination > .muted {
  margin-right: auto;
}
.source-warning {
  color: var(--el-color-warning);
  font-size: 13px;
}
.muted {
  font-size: 13px;
  color: #718198;
}
.service-period > span {
  display: block;
  white-space: nowrap;
}
.recipient-names {
  display: grid;
  gap: 5px;
}
.recipient-names > div {
  white-space: normal;
  overflow-wrap: anywhere;
}
.nowrap,
.code-link {
  white-space: nowrap;
  word-break: keep-all;
}
.ledger-table :deep(.cell) {
  word-break: normal;
}
.ledger-table :deep(.el-table__cell) {
  padding: 10px 0;
}
.editor-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.editor-footer strong {
  color: #2862ec;
  font-size: 23px;
  margin-left: 12px;
}
.attachment-panel {
  background: white;
  border: 1px solid #dce4ee;
  border-radius: 8px;
  padding: 22px;
}
:deep(.cost-ledger-dialog .el-dialog__body) {
  max-height: calc(94vh - 150px);
  overflow: auto;
  background: #f5f7fb;
  padding: 20px;
}
:deep(.cost-ledger-dialog .el-dialog__footer) {
  border-top: 1px solid #dce4ee;
}
@media (max-width: 1100px) {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 1400px) {
  .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 650px) {
  .filters,
  .metrics,
  .ledger-workspace {
    padding: 10px;
  }
  .pagination,
  .list-toolbar,
  .filter-actions {
    align-items: flex-start;
    flex-direction: column;
  }
  .filter-secondary-actions {
    flex-wrap: wrap;
  }
}
</style>
