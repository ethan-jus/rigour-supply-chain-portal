<template>
  <div class="customer-management-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">CRM · 客户管理</span>
        <h1>客户管理</h1>
      </div>
    </div>
    <el-card class="filter-card customer-query-card" shadow="never">
      <form
        ref="queryContainer"
        class="customer-query-form"
        aria-label="客户查询条件"
        @submit.prevent="submitSearch"
      >
        <div
          v-for="(line, lineIndex) in queryLines"
          :key="lineIndex"
          class="query-line"
          :class="{ 'query-extra-line': lineIndex > 0 }"
          :id="lineIndex > 0 ? 'customer-extra-filters' : undefined"
          v-show="lineIndex === 0 || expandedFilters"
        >
          <div
            v-for="field in line"
            :key="field.key"
            class="query-field"
            :style="{ width: `${field.width}px` }"
          >
            <el-input
              v-if="field.key === 'name'"
              v-model="filters.customerName"
              aria-label="客户名称"
              clearable
              placeholder="客户名称"
              @keyup.enter="submitSearch"
            />
            <el-input
              v-else-if="field.key === 'account'"
              v-model="filters.loginAccount"
              aria-label="客户账号"
              clearable
              placeholder="客户账号"
              @keyup.enter="submitSearch"
            />
            <el-select
              v-else-if="field.key === 'type'"
              v-model="filters.customerTypeCode"
              aria-label="客户类型"
              clearable
              filterable
              placeholder="客户类型"
            >
              <el-option
                v-for="item in customerTypeOptions"
                :key="item.code"
                :label="item.name"
                :value="item.code"
              />
            </el-select>
            <el-tree-select
              v-else-if="field.key === 'region'"
              v-model="filters.regionCode"
              :data="customerAreaTree"
              :props="areaTreeProps"
              node-key="code"
              check-strictly
              :render-after-expand="false"
              :default-expanded-keys="customerAreaTree.map((row) => row.code)"
              aria-label="归属地区"
              clearable
              filterable
              placeholder="归属地区"
            />
            <el-select
              v-else-if="field.key === 'owner'"
              v-model="filters.ownerEmployeeCode"
              aria-label="所属业务员"
              clearable
              filterable
              remote
              reserve-keyword
              placeholder="所属业务员"
              :remote-method="searchSalesStaff"
              :loading="staffLoading"
            >
              <el-option
                v-for="item in employeeOptions"
                :key="item.employeeCode"
                :label="item.employeeName"
                :value="item.employeeCode"
              />
            </el-select>
            <el-select
              v-else-if="field.key === 'status'"
              v-model="filters.statusCode"
              aria-label="客户状态"
              clearable
              placeholder="客户状态"
            >
              <el-option
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select
              v-else-if="field.key === 'creator'"
              v-model="filters.creatorName"
              aria-label="创建人"
              clearable
              filterable
              placeholder="创建人"
            >
              <el-option v-for="name in creatorOptions" :key="name" :label="name" :value="name" />
            </el-select>
            <el-input
              v-else-if="field.key === 'dhbCode'"
              v-model="filters.dhbCustomerCode"
              aria-label="订货宝客户编码"
              clearable
              placeholder="订货宝客户编码"
              @keyup.enter="submitSearch"
            />
            <el-select
              v-else-if="field.key === 'dhbLink'"
              v-model="filters.dhbLinkStatus"
              aria-label="订货宝关联状态"
              clearable
              placeholder="订货宝关联状态"
            >
              <el-option label="已关联" value="LINKED" /><el-option
                label="未关联"
                value="UNLINKED"
              />
            </el-select>
            <el-date-picker
              v-else
              v-model="filters.createdRange"
              type="daterange"
              aria-label="创建时间范围"
              start-placeholder="创建开始日期"
              end-placeholder="创建结束日期"
              range-separator="至"
              value-format="YYYY-MM-DD"
            />
          </div>
          <div v-if="lineIndex === 0" class="query-actions">
            <div class="query-main-actions">
              <el-button type="primary" :loading="loading" @click="submitSearch">查询</el-button>
              <el-button @click="resetFilters">重置</el-button>
              <el-button
                v-if="can('crm:customer:create', 'crm:customer:write')"
                type="primary"
                @click="openCreate"
                >新增客户</el-button
              >
              <DhbPageSyncButton
                scope="CUSTOMER"
                label="客户"
                button-label="同步客户"
                @completed="loadCustomers"
              />
            </div>
            <el-button
              v-if="hasOverflowFilters"
              class="query-expand"
              link
              type="primary"
              :aria-expanded="expandedFilters"
              aria-controls="customer-extra-filters"
              @click="expandedFilters = !expandedFilters"
            >
              {{ expandedFilters ? '收起' : '展开'
              }}<el-icon :class="{ 'is-expanded': expandedFilters }"><ArrowDown /></el-icon>
            </el-button>
          </div>
        </div>
      </form>
    </el-card>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          class="business-table supply-scroll-table"
          height="100%"
          v-loading="loading"
          :data="pageData.items"
          row-key="id"
          :default-sort="{ prop: 'businessCreatedAt', order: 'descending' }"
          @sort-change="changeSort"
        >
          <el-table-column
            type="index"
            label="序号"
            width="80"
            fixed="left"
            :index="tableRowIndex"
          />
          <!-- @vue-generic {InternalCrmCustomerSummary} -->
          <el-table-column
            prop="customerName"
            label="客户名称"
            width="240"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <div class="customer-name-cell">
                <el-button
                  link
                  type="primary"
                  class="customer-name-link"
                  @click.stop="openDetail(row)"
                  >{{ row.customerName }}</el-button
                >
                <el-button
                  link
                  type="primary"
                  class="customer-name-copy"
                  aria-label="复制客户名称"
                  title="复制客户名称"
                  @click.stop="copyCustomerName(row.customerName)"
                  ><el-icon><DocumentCopy /></el-icon
                ></el-button>
              </div>
            </template>
          </el-table-column>
          <!-- @vue-generic {InternalCrmCustomerSummary} -->
          <el-table-column
            prop="regionCode"
            label="归属地区"
            width="140"
            fixed="left"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ customerAreaText(row) }}</template>
          </el-table-column>
          <el-table-column
            prop="ownerEmployeeNameSnapshot"
            label="所属业务员"
            width="150"
            fixed="left"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{
              row.ownerEmployeeNameSnapshot || row.ownerSalesName || '-'
            }}</template>
          </el-table-column>
          <el-table-column
            prop="loginAccount"
            label="客户账号"
            min-width="180"
            show-overflow-tooltip
            ><template #default="{ row }">{{
              row.loginAccount || '待补充'
            }}</template></el-table-column
          >
          <el-table-column prop="customerTypeCode" label="客户类型" width="130"
            ><template #default="{ row }">{{
              customerTypeLabel(row.customerTypeCode)
            }}</template></el-table-column
          >
          <el-table-column prop="settlementTypeCode" label="结算类型" width="130"
            ><template #default="{ row }">{{
              settlementTypeLabel(row.settlementTypeCode)
            }}</template></el-table-column
          >
          <el-table-column prop="contactName" label="联系人" width="140" show-overflow-tooltip />
          <el-table-column prop="contactPhone" label="联系电话" width="150" show-overflow-tooltip />
          <el-table-column prop="statusCode" label="状态" width="110"
            ><template #default="{ row }"
              ><el-tag :type="row.statusCode === 'ACTIVE' ? 'success' : 'info'">{{
                statusLabel(row.statusCode)
              }}</el-tag></template
            ></el-table-column
          >
          <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
          <el-table-column
            prop="dhbCustomerCode"
            sortable="custom"
            label="订货宝客户编码"
            width="180"
            show-overflow-tooltip
            ><template #default="{ row }">{{
              customerDhbCodes(row).join(' / ') || '未关联'
            }}</template></el-table-column
          >
          <!-- @vue-generic {InternalCrmCustomerSummary} -->
          <el-table-column label="创建人" width="140"
            ><template #default="{ row }">{{
              businessCreatorLabel(row)
            }}</template></el-table-column
          >
          <el-table-column prop="businessCreatedAt" label="创建时间" width="180" sortable="custom"
            ><template #default="{ row }">{{
              row.businessCreatedAt ? formatTime(row.businessCreatedAt) : '待核实'
            }}</template></el-table-column
          >
          <el-table-column label="更新人" width="140"
            ><template #default="{ row }">{{
              actorLabel(row.updatedBy)
            }}</template></el-table-column
          >
          <el-table-column label="修改时间" width="180"
            ><template #default="{ row }">{{
              formatTime(row.updatedTime)
            }}</template></el-table-column
          >
          <el-table-column prop="syncedAt" label="同步时间" width="180" sortable="custom"
            ><template #default="{ row }">{{
              row.syncedAt ? formatTime(row.syncedAt) : '未同步'
            }}</template></el-table-column
          >
          <el-table-column label="同步人" width="140"
            ><template #default="{ row }">{{
              row.syncedAt ? actorLabel(row.syncedBy) : '未同步'
            }}</template></el-table-column
          >
          <!-- @vue-generic {InternalCrmCustomerSummary} -->
          <el-table-column label="操作" width="190" fixed="right" align="center">
            <template #default="scope">
              <el-button
                v-if="can('crm:customer:update', 'crm:customer:write')"
                link
                type="primary"
                @click.stop="openEdit(scope.row)"
                >编辑</el-button
              >
              <el-button
                v-if="can('crm:customer:assign-owner')"
                link
                type="primary"
                @click.stop="responsibilityDrawer?.open(scope.row.id)"
                >归属管理</el-button
              >
              <el-button
                v-if="can('crm:customer:delete', 'crm:customer:write')"
                link
                type="danger"
                @click.stop="deleteCustomer(scope.row)"
                >删除</el-button
              >
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无客户" /></template>
        </el-table>
      </div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="pageData.total"
          @current-change="loadCustomers"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-drawer
      v-model="detailVisible"
      class="customer-detail-drawer"
      size="min(820px, 92vw)"
      :with-header="false"
    >
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>客户详情</span>
            <h2>{{ detail.customerName }}</h2>
            <p>{{ detail.customerCode }} · {{ statusLabel(detail.statusCode) }}</p>
          </div>
          <el-button circle plain aria-label="关闭客户详情" @click="detailVisible = false"
            >×</el-button
          >
        </header>
        <div class="detail-content">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="客户编号">{{ detail.customerCode }}</el-descriptions-item>
            <el-descriptions-item label="客户名称">{{ detail.customerName }}</el-descriptions-item>
            <el-descriptions-item label="客户账号">{{
              detail.loginAccount || '待补充'
            }}</el-descriptions-item>
            <el-descriptions-item label="订货宝客户编码">{{
              customerDhbCodes(detail).join(' / ') || '未关联'
            }}</el-descriptions-item>
            <el-descriptions-item label="同步时间">{{
              detail.syncedAt ? formatTime(detail.syncedAt) : '未同步'
            }}</el-descriptions-item>
            <el-descriptions-item label="同步人">{{
              detail.syncedAt ? actorLabel(detail.syncedBy) : '未同步'
            }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{
              detail.contactName || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{
              detail.contactPhone || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="客户类型">{{
              customerTypeLabel(detail.customerTypeCode)
            }}</el-descriptions-item>
            <el-descriptions-item label="归属地区">{{
              customerAreaText(detail)
            }}</el-descriptions-item>
            <el-descriptions-item label="客户来源">{{
              detail.customerSourceName || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="业务类目">{{
              detail.businessCategoryName || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="所属业务员">
              {{
                detail.ownerEmployeeNameSnapshot ||
                detail.ownerSalesName ||
                detail.ownerEmployeeCode ||
                '-'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="结算类型">{{
              settlementTypeLabel(detail.settlementTypeCode)
            }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{
              statusLabel(detail.statusCode)
            }}</el-descriptions-item>
            <el-descriptions-item label="来源">{{
              sourceLabel(detail.sourceSystemCode)
            }}</el-descriptions-item>
            <el-descriptions-item label="来源单号">{{
              detail.sourceDocumentNo || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="来源创建时间">{{
              formatTime(detail.sourceCreatedAt)
            }}</el-descriptions-item>
            <el-descriptions-item label="来源更新时间">{{
              formatTime(detail.sourceUpdatedAt)
            }}</el-descriptions-item>
            <el-descriptions-item label="客户地址" :span="2">{{
              detail.address || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{
              detail.remark || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="创建人">{{
              detail.businessCreatedByName ||
              (detail.businessCreationSource === 'INTERNAL'
                ? actorLabel(detail.businessCreatedById)
                : '待补充')
            }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{
              detail.businessCreatedAt ? formatTime(detail.businessCreatedAt) : '待核实'
            }}</el-descriptions-item>
            <el-descriptions-item label="建档信息来源">{{
              sourceLabel(detail.businessCreationSource)
            }}</el-descriptions-item>
            <el-descriptions-item label="系统入库时间">{{
              formatTime(detail.createdTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="修改人">{{
              actorLabel(detail.updatedBy)
            }}</el-descriptions-item>
            <el-descriptions-item label="修改时间">{{
              formatTime(detail.updatedTime)
            }}</el-descriptions-item>
          </el-descriptions>
          <CustomerShippingAddresses
            :customer-id="detail.id"
            :can-edit="can('crm:customer:update', 'crm:customer:write')"
            @changed="refreshDetail"
          />
        </div>
      </div>
      <el-skeleton v-else :rows="8" animated />
    </el-drawer>

    <CustomerResponsibilityDrawer ref="responsibilityDrawer" @changed="loadCustomers" />
    <el-dialog
      v-model="editorVisible"
      :title="editingId ? '编辑客户' : '新增客户'"
      width="min(760px, 92vw)"
      destroy-on-close
    >
      <el-form
        ref="editorForm"
        :model="form"
        :rules="editorRules"
        label-width="100px"
        @submit.prevent="saveCustomer"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="客户名称" prop="customerName" required>
              <el-input v-model="form.customerName" clearable placeholder="请输入门店/商家名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户状态" prop="statusCode" required>
              <el-select v-model="form.statusCode" style="width: 100%">
                <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12"
            ><el-form-item label="客户账号" prop="loginAccount" required
              ><el-input
                v-model="form.loginAccount"
                maxlength="160"
                placeholder="订货宝客户信息中的登录账号" /></el-form-item
          ></el-col>
          <el-col :span="12">
            <el-form-item label="客户类型" prop="customerTypeCode" required>
              <el-select
                v-model="form.customerTypeCode"
                clearable
                filterable
                placeholder="选择客户类型"
                style="width: 100%"
              >
                <el-option
                  v-for="item in customerTypeOptions"
                  :key="item.code"
                  :label="item.name"
                  :value="item.code"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="归属地区" prop="regionCode" required>
              <el-tree-select
                v-model="form.regionCode"
                :data="customerAreaTree"
                :props="areaTreeProps"
                node-key="code"
                check-strictly
                :render-after-expand="false"
                :disabled="Boolean(editingId)"
                clearable
                filterable
                placeholder="选择归属地区"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结算类型">
              <el-select
                v-model="form.settlementTypeCode"
                clearable
                placeholder="选择结算类型"
                style="width: 100%"
              >
                <el-option
                  v-for="item in settlementTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属业务员" prop="ownerEmployeeCode" required>
              <el-select
                v-model="form.ownerEmployeeCode"
                :disabled="Boolean(editingId) || !can('crm:customer:assign-owner')"
                clearable
                filterable
                remote
                reserve-keyword
                placeholder="搜索姓名/员工编码"
                :remote-method="searchSalesStaff"
                :loading="staffLoading"
                style="width: 100%"
                @change="selectOwnerStaff"
                @clear="selectOwnerStaff('')"
              >
                <el-option
                  v-for="item in employeeOptions"
                  :key="item.employeeCode"
                  :label="item.employeeName"
                  :value="item.employeeCode"
                >
                  <div class="staff-option">
                    <strong>{{ item.employeeName }}</strong>
                    <span>{{ item.employeeCode }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <template v-if="!editingId">
            <el-col :span="24"
              ><el-divider content-position="left">收货信息</el-divider>
              <p>可添加默认收货地址；填写时请补全收货人、电话、所在地区和详细地址。</p></el-col
            >
            <el-col :span="24"
              ><el-form-item label="收货单位"
                ><el-input
                  v-model="shippingForm.consignee"
                  placeholder="收货单位（选填）" /></el-form-item
            ></el-col>
            <el-col :span="12"
              ><el-form-item label="收货人"
                ><el-input v-model="shippingForm.contact" placeholder="收货人姓名" /></el-form-item
            ></el-col>
            <el-col :span="12"
              ><el-form-item label="联系电话"
                ><el-input
                  v-model="shippingForm.phone"
                  placeholder="手机号或固定电话" /></el-form-item
            ></el-col>
            <el-col :span="24"
              ><el-form-item label="所在地区"
                ><el-input
                  v-model="shippingForm.regionText"
                  placeholder="省 / 市 / 区县" /></el-form-item
            ></el-col>
            <el-col :span="24"
              ><el-form-item label="详细地址"
                ><el-input
                  v-model="shippingForm.addressDetail"
                  placeholder="街道、门牌号等详细地址" /></el-form-item
            ></el-col>
          </template>
          <el-col v-else :span="24">
            <p v-if="!form.regionCode || !form.ownerEmployeeCode" class="ownership-required-hint">
              请先在归属管理中补齐地区和业务员，再保存客户。
              <el-button link type="primary" @click="completeCustomerOwnership">归属管理</el-button>
            </p>
            <p>收货人、联系电话和收货地址在客户详情的“收货信息”中维护。</p></el-col
          >
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="3"
                maxlength="1000"
                show-word-limit
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveCustomer">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { buildAreaTree } from '@/utils/crm-area-tree'
import CustomerShippingAddresses from './CustomerShippingAddresses.vue'
import { auditActorLabel } from '@/utils/audit-actor'
import { displayDateTime } from '@/utils/business-date'
import DhbPageSyncButton from '@/components/supply/DhbPageSyncButton.vue'
import {
  computed,
  nextTick,
  onActivated,
  onMounted,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from 'vue'
import { ArrowDown, DocumentCopy } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  createInternalCrmCustomer,
  deleteInternalCrmCustomer,
  getAllCrmCustomerAreas,
  getCrmCustomerTypes,
  getInternalCrmCustomer,
  getInternalCrmCustomers,
  getInternalCrmCustomerCreators,
  updateInternalCrmCustomer,
  type CrmPage,
  type CrmDictionaryView,
  type InternalCrmCustomerCommand,
  type InternalCrmCustomerDetail,
  type InternalCrmCustomerSummary,
} from '@/api/core/crm'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { responsibilityEmployees } from '@/api/core/customer-responsibility'
import CustomerResponsibilityDrawer from './CustomerResponsibilityDrawer.vue'

const queryContainer = ref<HTMLElement | null>(null)
const queryWidth = ref(1100)
const queryActionsWidth = ref(320)
const creatorOptions = ref<string[]>([])
const queryFields = [
  { key: 'name', width: 200 },
  { key: 'account', width: 180 },
  { key: 'dhbCode', width: 170 },
  { key: 'dhbLink', width: 150 },
  { key: 'type', width: 150 },
  { key: 'region', width: 160 },
  { key: 'owner', width: 160 },
  { key: 'status', width: 140 },
  { key: 'creator', width: 150 },
  { key: 'date', width: 280 },
]
const firstLineCount = computed(() => {
  const total = queryFields.reduce((sum, f) => sum + f.width + 10, 0)
  if (total + queryActionsWidth.value <= queryWidth.value) return queryFields.length
  const available = queryWidth.value - queryActionsWidth.value - 68
  let used = 0,
    count = 0
  for (const field of queryFields) {
    if (used + field.width + 10 > available) break
    used += field.width + 10
    count++
  }
  return Math.max(1, count)
})
const hasOverflowFilters = computed(() => firstLineCount.value < queryFields.length)
const queryLines = computed(() =>
  [queryFields.slice(0, firstLineCount.value), queryFields.slice(firstLineCount.value)].filter(
    (line) => line.length,
  ),
)
let queryObserver: ResizeObserver | undefined
onMounted(async () => {
  await nextTick()
  const resize = () => {
    if (!queryContainer.value) return
    queryWidth.value = queryContainer.value.clientWidth
    queryActionsWidth.value =
      queryContainer.value.querySelector('.query-main-actions')?.getBoundingClientRect().width ||
      320
  }
  queryObserver = new ResizeObserver(resize)
  if (queryContainer.value) queryObserver.observe(queryContainer.value)
  resize()
})
onBeforeUnmount(() => queryObserver?.disconnect())

const route = useRoute()
const { can } = useSupplyPermissions()
const responsibilityDrawer = ref<InstanceType<typeof CustomerResponsibilityDrawer> | null>(null)
const statusOptions = computed(() => businessDictionaryOptions('CRM', 'CUSTOMER_STATUS'))
const settlementTypeOptions = computed(() =>
  businessDictionaryOptions('CRM', 'DHB_CUSTOMER_CLEARING_FORM'),
)

const loading = ref(false)
const saving = ref(false)
const staffLoading = ref(false)
const detailVisible = ref(false)
const editorVisible = ref(false)
const detail = ref<InternalCrmCustomerDetail | null>(null)
const editingId = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const sortBy = ref<'businessCreatedAt' | 'syncedAt' | 'dhbCustomerCode'>('businessCreatedAt')
const sortDirection = ref<'asc' | 'desc'>('desc')
function changeSort({ prop, order }: { prop: string | null; order: string | null }) {
  sortBy.value =
    order && (prop === 'syncedAt' || prop === 'dhbCustomerCode') ? prop : 'businessCreatedAt'
  sortDirection.value = order === 'ascending' ? 'asc' : 'desc'
  currentPage.value = 1
  void loadCustomers()
}
const pageData = ref<CrmPage<InternalCrmCustomerSummary>>({
  total: 0,
  begin: 0,
  step: 20,
  items: [],
})
const employeeOptions = ref<
  { employeeCode: string; employeeName: string; departmentName: string | null }[]
>([])
const customerTypeOptions = ref<CrmDictionaryView[]>([])
const customerAreaOptions = ref<CrmDictionaryView[]>([])
const customerAreaTree = computed(() => buildAreaTree(customerAreaOptions.value))
const areaTreeProps = { value: 'code', label: 'name', children: 'children' }

const expandedFilters = ref(false)
const filters = reactive({
  customerName: '',
  loginAccount: '',
  createdRange: null as [string, string] | null,
  creatorName: '',
  dhbCustomerCode: '',
  dhbLinkStatus: '',
  customerTypeCode: '',
  regionCode: '',
  ownerEmployeeCode: '',
  statusCode: '',
})

const shippingForm = reactive({
  consignee: '',
  contact: '',
  phone: '',
  regionText: '',
  addressDetail: '',
})
const form = reactive({
  loginAccount: '',
  customerName: '',
  contactName: '',
  contactPhone: '',
  customerTypeCode: '',
  regionCode: '',
  ownerSalesUserId: '',
  ownerSalesName: '',
  ownerEmployeeCode: '',
  ownerEmployeeNameSnapshot: '',
  settlementTypeCode: '',
  address: '',
  statusCode: '',
  remark: '',
  revision: null as number | null,
})

const editorForm = ref<FormInstance>()
const editorRules: FormRules = {
  customerName: [{ required: true, whitespace: true, message: '请输入客户名称', trigger: 'blur' }],
  loginAccount: [{ required: true, whitespace: true, message: '请填写客户账号', trigger: 'blur' }],
  customerTypeCode: [{ required: true, message: '请选择客户类型', trigger: 'change' }],
  statusCode: [{ required: true, message: '请选择客户状态', trigger: 'change' }],
  regionCode: [{ required: true, message: '请选择归属地区', trigger: 'change' }],
  ownerEmployeeCode: [{ required: true, message: '请选择所属业务员', trigger: 'change' }],
}

function customerDhbCodes(row: Partial<InternalCrmCustomerSummary>) {
  return row.dhbCustomerCodes?.length ? row.dhbCustomerCodes : row.dhbCustomerCode ? [row.dhbCustomerCode] : []
}

async function copyCustomerName(name: string) {
  try {
    await navigator.clipboard.writeText(name)
    ElMessage.success('客户名称已复制')
  } catch {
    ElMessage.error('复制失败，请选中客户名称后手动复制')
  }
}

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

onMounted(() => {
  applyRouteFilters()
  void loadBusinessDictionaries([
    { moduleCode: 'CRM', code: 'CUSTOMER_STATUS' },
    { moduleCode: 'CRM', code: 'DHB_CUSTOMER_CLEARING_FORM' },
  ])
  void Promise.all([loadCrmMasterOptions(), loadCustomers(), searchSalesStaff(''), loadCreators()])
})

let activatedOnce = false
onActivated(() => {
  // Region maintenance may change labels while this customer tab is cached.
  if (activatedOnce) void loadCrmMasterOptions()
  activatedOnce = true
})

watch(
  () => route.query,
  () => {
    if (!applyRouteFilters()) return
    currentPage.value = 1
    void loadCustomers()
  },
)

async function loadCustomers() {
  loading.value = true
  try {
    pageData.value = await getInternalCrmCustomers({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      sortBy: sortBy.value,
      sortDirection: sortDirection.value,
      customerName: empty(filters.customerName),
      loginAccount: empty(filters.loginAccount),
      createdFrom: filters.createdRange?.[0],
      createdTo: filters.createdRange?.[1],
      creatorName: empty(filters.creatorName),
      dhbCustomerCode: empty(filters.dhbCustomerCode),
      dhbLinkStatus: empty(filters.dhbLinkStatus) as 'LINKED' | 'UNLINKED' | undefined,
      customerTypeCode: empty(filters.customerTypeCode),
      regionCode: empty(filters.regionCode),
      ownerEmployeeCode: empty(filters.ownerEmployeeCode),
      statusCode: empty(filters.statusCode),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '客户列表加载失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.customerName = ''
  filters.loginAccount = ''
  filters.createdRange = null
  filters.creatorName = ''
  filters.dhbCustomerCode = ''
  filters.dhbLinkStatus = ''
  filters.customerTypeCode = ''
  filters.regionCode = ''
  filters.ownerEmployeeCode = ''
  filters.statusCode = ''
  currentPage.value = 1
  void loadCustomers()
}

function submitSearch() {
  currentPage.value = 1
  void loadCustomers()
}

function applyRouteFilters() {
  const customerName = queryText(route.query.customerName)
  const customerTypeCode = queryText(route.query.customerTypeCode)
  const regionCode = queryText(route.query.regionCode)
  const ownerEmployeeCode = queryText(route.query.ownerEmployeeCode)
  let changed = false
  if (customerName && filters.customerName !== customerName) {
    filters.customerName = customerName
    changed = true
  }
  if (customerTypeCode && filters.customerTypeCode !== customerTypeCode) {
    filters.customerTypeCode = customerTypeCode
    changed = true
  }
  if (regionCode && filters.regionCode !== regionCode) {
    filters.regionCode = regionCode
    changed = true
  }
  if (ownerEmployeeCode && filters.ownerEmployeeCode !== ownerEmployeeCode) {
    filters.ownerEmployeeCode = ownerEmployeeCode
    ensureEmployeeOption(ownerEmployeeCode, ownerEmployeeCode)
    changed = true
  }
  return changed
}

function queryText(value: unknown) {
  if (Array.isArray(value)) return String(value[0] || '').trim()
  return typeof value === 'string' ? value.trim() : ''
}

function handleSizeChange() {
  currentPage.value = 1
  void loadCustomers()
}

async function openDetail(row: InternalCrmCustomerSummary) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getInternalCrmCustomer(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '客户详情加载失败'))
  }
}

function openCreate() {
  editingId.value = null
  resetForm()
  editorVisible.value = true
}

async function openEdit(row: InternalCrmCustomerSummary) {
  try {
    const current = await getInternalCrmCustomer(row.id)
    editingId.value = row.id
    form.loginAccount = current.loginAccount || ''
    form.customerName = current.customerName
    form.contactName = current.contactName || ''
    form.contactPhone = current.contactPhone || ''
    form.customerTypeCode = current.customerTypeCode || ''
    form.regionCode = current.regionCode || ''
    form.ownerSalesUserId = current.ownerSalesUserId || ''
    form.ownerSalesName = current.ownerSalesName || current.ownerEmployeeNameSnapshot || ''
    form.ownerEmployeeCode = current.ownerEmployeeCode || ''
    form.ownerEmployeeNameSnapshot =
      current.ownerEmployeeNameSnapshot || current.ownerSalesName || ''
    ensureEmployeeOption(form.ownerEmployeeCode, form.ownerEmployeeNameSnapshot)
    form.settlementTypeCode = current.settlementTypeCode || ''
    form.address = current.address || ''
    form.statusCode = current.statusCode || ''
    form.remark = current.remark || ''
    form.revision = current.revision
    editorVisible.value = true
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '客户信息加载失败'))
  }
}

function completeCustomerOwnership() {
  if (!editingId.value) return
  editorVisible.value = false
  void responsibilityDrawer.value?.open(editingId.value)
}

async function saveCustomer() {
  if (!(await editorForm.value?.validate().catch(() => false))) return
  const command = buildCommand()
  if (!command) return
  saving.value = true
  try {
    if (editingId.value) {
      await updateInternalCrmCustomer(editingId.value, command)
      ElMessage.success('客户已保存')
    } else {
      await createInternalCrmCustomer(command)
      ElMessage.success('客户已新增')
    }
    editorVisible.value = false
    await loadCustomers()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '客户保存失败'))
  } finally {
    saving.value = false
  }
}

async function deleteCustomer(row: InternalCrmCustomerSummary) {
  try {
    await ElMessageBox.confirm(
      `确定删除客户“${row.customerName}”吗？删除后，该客户将不再显示在客户列表中。`,
      '删除客户',
      {
        center: true,
        closeOnClickModal: false,
        confirmButtonClass: 'el-button--danger',
        confirmButtonText: '删除客户',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await deleteInternalCrmCustomer(row.id, row.revision)
    ElMessage.success('客户已删除')
    await loadCustomers()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(errorMessage(reason, '客户删除失败'))
  }
}

function buildCommand(): InternalCrmCustomerCommand | null {
  if (!form.customerName.trim()) {
    ElMessage.warning('请输入客户名称')
    return null
  }
  if (!form.loginAccount.trim()) {
    ElMessage.warning('请填写客户账号')
    return null
  }
  for (const [value, message] of [
    [form.customerTypeCode, '请选择客户类型'],
    [form.statusCode, '请选择客户状态'],
    [form.regionCode, '请选择归属地区'],
    [form.ownerEmployeeCode, '请选择所属业务员'],
  ]) {
    if (!value?.trim()) {
      ElMessage.warning(message)
      return null
    }
  }
  const hasShipping = !editingId.value && Object.values(shippingForm).some((v) => v.trim())
  if (
    hasShipping &&
    ['contact', 'phone', 'regionText', 'addressDetail'].some(
      (k) => !shippingForm[k as keyof typeof shippingForm].trim(),
    )
  ) {
    ElMessage.warning('请补全收货人、联系电话、所在地区和详细地址')
    return null
  }
  return {
    loginAccount: form.loginAccount.trim(),
    shippingAddress: hasShipping ? { ...shippingForm, defaultAddress: true } : null,
    customerName: form.customerName.trim(),
    contactName: empty(form.contactName),
    contactPhone: empty(form.contactPhone),
    customerTypeCode: empty(form.customerTypeCode),
    regionCode: empty(form.regionCode),
    ownerSalesUserId: empty(form.ownerSalesUserId),
    ownerSalesName: empty(form.ownerSalesName),
    ownerEmployeeCode: empty(form.ownerEmployeeCode),
    ownerEmployeeNameSnapshot: empty(form.ownerEmployeeNameSnapshot),
    settlementTypeCode: empty(form.settlementTypeCode),
    address: empty(form.address),
    statusCode: empty(form.statusCode),
    remark: empty(form.remark),
    revision: editingId.value ? form.revision : null,
  }
}

function resetForm() {
  form.loginAccount = ''
  Object.assign(shippingForm, {
    consignee: '',
    contact: '',
    phone: '',
    regionText: '',
    addressDetail: '',
  })
  form.customerName = ''
  form.contactName = ''
  form.contactPhone = ''
  form.customerTypeCode = ''
  form.regionCode = ''
  form.ownerSalesUserId = ''
  form.ownerSalesName = ''
  form.ownerEmployeeCode = ''
  form.ownerEmployeeNameSnapshot = ''
  form.settlementTypeCode = ''
  form.address = ''
  form.statusCode = 'ACTIVE'
  form.remark = ''
  form.revision = null
}

function statusLabel(value: string | null | undefined) {
  return businessDictionaryLabel('CRM', 'CUSTOMER_STATUS', value, '客户状态')
}

function settlementTypeLabel(value: string | null | undefined) {
  return businessDictionaryLabel(
    'CRM',
    'DHB_CUSTOMER_CLEARING_FORM',
    value?.toLowerCase(),
    '结算类型',
  )
}

function customerTypeLabel(value: string | null | undefined) {
  if (!value) return '-'
  return customerTypeOptions.value.find((item) => item.code === value)?.name || value
}

function customerAreaLabel(value: string | null | undefined) {
  if (!value) return '-'
  return customerAreaOptions.value.find((item) => item.code === value)?.name || value
}

function customerAreaText(
  row: Pick<InternalCrmCustomerSummary, 'regionCode' | 'regionName' | 'cityName'>,
) {
  if (row.regionCode) return customerAreaLabel(row.regionCode)
  if (row.regionName && row.cityName) return `${row.regionName} / ${row.cityName}`
  return row.regionName || row.cityName || '-'
}

function sourceLabel(value: string | null | undefined) {
  if (value === 'FEISHU') return '飞书'
  if (value === 'DINGHUOBAO') return '订货宝'
  return value || '-'
}

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

const formatTime = displayDateTime

function businessCreatorLabel(row: InternalCrmCustomerSummary) {
  return (
    row.businessCreatedByName ||
    (row.businessCreationSource === 'INTERNAL'
      ? auditActorLabel(row.businessCreatedById)
      : '待补充')
  )
}
async function refreshDetail() {
  if (detail.value) detail.value = await getInternalCrmCustomer(detail.value.id)
  await loadCustomers()
}
const actorLabel = auditActorLabel

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}

async function searchSalesStaff(query: string) {
  staffLoading.value = true
  try {
    if (!can('crm:customer:assign-owner')) return
    const employees = await responsibilityEmployees(query)
    employeeOptions.value = employees.map((e) => ({
      employeeCode: e.code,
      employeeName: e.name,
      departmentName: e.departmentName,
    }))
  } finally {
    staffLoading.value = false
  }
}

async function loadCreators() {
  try {
    creatorOptions.value = await getInternalCrmCustomerCreators()
  } catch (reason) {
    ElMessage.warning(errorMessage(reason, '创建人选项加载失败'))
  }
}

async function loadCrmMasterOptions() {
  try {
    const [types, areas] = await Promise.all([
      getCrmCustomerTypes({ step: 200 }),
      getAllCrmCustomerAreas(),
    ])
    customerTypeOptions.value = types.items.filter((item) => item.status === 'ACTIVE')
    customerAreaOptions.value = areas.filter((item) => item.status === 'ACTIVE')
  } catch (reason) {
    ElMessage.warning(errorMessage(reason, '客户类型或地区加载失败，可稍后刷新'))
  }
}

function selectOwnerStaff(value: string | number) {
  const code = String(value || '')
  const selected = employeeOptions.value.find((item) => item.employeeCode === code)
  form.ownerEmployeeCode = code
  form.ownerEmployeeNameSnapshot = selected?.employeeName || ''
  form.ownerSalesUserId = ''
  form.ownerSalesName = selected?.employeeName || ''
}

function ensureEmployeeOption(employeeCode: string, employeeName: string) {
  if (!employeeCode || employeeOptions.value.some((item) => item.employeeCode === employeeCode))
    return
  employeeOptions.value = [
    { employeeCode, employeeName: employeeName || employeeCode, departmentName: null },
    ...employeeOptions.value,
  ]
}
</script>

<style scoped lang="scss">
.customer-management-page {
  min-height: 0;
}

.customer-query-form {
  display: block;
  width: 100%;
}
.query-line {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
}
.query-extra-line {
  padding-top: 12px;
  flex-wrap: wrap;
}
.query-field {
  flex: 0 0 auto;
  min-width: 0;
}
.query-field :deep(.el-input),
.query-field :deep(.el-select),
.query-field :deep(.el-date-editor) {
  width: 100%;
  box-sizing: border-box;
}
.query-actions,
.query-main-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}
.query-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.query-expand {
  width: 56px;
  font-weight: 400;
}
.query-expand .el-icon {
  margin-left: 4px;
  font-size: 13px;
  transition: transform 0.15s ease;
}
.query-expand .is-expanded {
  transform: rotate(180deg);
}
.customer-management-page > .customer-query-card {
  flex: 0 0 auto;
  margin-bottom: 12px;
  border-radius: 6px;
  background: #fff;
}
.customer-management-page > .customer-query-card :deep(.el-card__body) {
  padding: 14px 12px;
}
.customer-management-page :deep(.el-table th.el-table__cell) {
  font-weight: 600;
  color: #303742;
  height: 44px;
}
.customer-management-page :deep(.el-table th .cell) {
  font-size: 15px;
  font-weight: 600;
}
.customer-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.customer-name-copy {
  opacity: 0;
  flex: 0 0 22px;
  margin-left: 0 !important;
  transition: opacity 0.12s;
}
.customer-name-cell:hover .customer-name-copy,
.customer-name-cell:focus-within .customer-name-copy {
  opacity: 1;
}
@media (hover: none) {
  .customer-name-copy {
    opacity: 1;
  }
}
.customer-name-link {
  min-width: 0;
  user-select: text;
  font-weight: 600;
  max-width: 100%;
  justify-content: flex-start;
}
.customer-name-link :deep(span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.customer-query-card :deep(.el-card__body) {
  padding: 12px;
}
.staff-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span {
    color: #94a3b8;
    font-size: 12px;
  }
}
</style>
