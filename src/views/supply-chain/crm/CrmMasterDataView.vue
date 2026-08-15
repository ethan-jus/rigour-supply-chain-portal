<template>
  <div class="crm-master-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <span>CRM · 订货宝客户主数据</span>
            <h1>{{ currentView.title }}</h1>
            <p>{{ currentView.description }}</p>
          </div>
          <el-button v-if="canSync" type="primary" :loading="syncing" @click="synchronize">
            同步{{ currentView.syncLabel }}
          </el-button>
        </div>
      </template>

      <el-alert
        class="boundary-alert"
        type="info"
        :closable="false"
        show-icon
        title="页面只查询 CRM 本地数据；右上角同步按钮按当前页面传递对象类型，由 CRM 服务编排 Integration 访问订货宝。"
      />

      <el-alert
        v-if="lastSync"
        class="sync-result-alert"
        type="success"
        :closable="false"
        show-icon
        :title="syncResultSummary(lastSync)"
      />

      <el-alert
        v-if="syncConflict"
        class="sync-result-alert"
        type="warning"
        :closable="false"
        show-icon
      >
        <template #title>当前{{ currentView.syncLabel }}已有同步任务运行中</template>
        <template #default>
          可能是定时同步或其他页面发起的任务，请等待任务完成后再重试。
          <el-button link type="primary" @click="refreshAfterSyncConflict">刷新数据</el-button>
        </template>
      </el-alert>

      <div class="query-panel">
        <el-form class="query-bar" inline @submit.prevent="query">
          <el-form-item label="搜索条件">
            <el-input
              v-model="filters.keyword"
              clearable
              :placeholder="currentView.placeholder"
              @keyup.enter="query"
            />
          </el-form-item>
          <el-form-item v-if="currentView.key === 'customers'" label="CRM客户状态">
            <el-select v-model="filters.status" clearable placeholder="全部客户状态" style="width: 150px">
              <el-option label="启用" value="ACTIVE" />
              <el-option label="停用" value="INACTIVE" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="query">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="result-heading">
        <div>
          <h2>{{ currentView.title }}列表</h2>
          <p>
            共 {{ pageData.total }} 条数据，本页 {{ pageData.items.length }} 条<span
              v-if="currentView.key === 'customers'"
            >；列表字段按订货宝业务含义拆分，点击客户行可查看完整资料和收货地址</span><span
              v-else-if="currentView.key === 'addresses'"
            >；地址簿展示订货宝同步的全部客户收货地址</span>。
          </p>
        </div>
        <div v-if="currentView.key === 'customers'" class="page-status-summary">
          <span><i class="status-dot is-active" />本页 CRM 启用客户 {{ customerPageStats.active }}</span>
        </div>
      </div>

      <el-table
        v-if="currentView.key === 'customers'"
        v-loading="loading"
        class="business-table is-clickable"
        :data="customerRows"
        row-key="id"
        @row-click="openCustomerDetail"
      >
        <el-table-column label="客户名称" width="285" fixed="left">
          <template #default="scope">
            <div class="record-identity">
              <span class="record-avatar">{{ avatarText(scope.row.name) }}</span>
              <div class="record-identity-content">
                <strong :title="value(scope.row.name)">{{ value(scope.row.name) }}</strong>
                <span>客户编号 {{ value(scope.row.code) }}</span>
                <small>登录账号 {{ value(scope.row.account) }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="客户类型" min-width="145">
          <template #default="scope">{{ value(scope.row.typeName) }}</template>
        </el-table-column>
        <el-table-column label="归属地区" min-width="165">
          <template #default="scope">{{ value(scope.row.areaName) }}</template>
        </el-table-column>
        <el-table-column label="联系人" min-width="145">
          <template #default="scope">{{ value(scope.row.contactName) }}</template>
        </el-table-column>
        <el-table-column label="联系电话" min-width="150">
          <template #default="scope">{{ value(scope.row.phone) }}</template>
        </el-table-column>
        <el-table-column label="主业务员" min-width="150">
          <template #default="scope">{{ value(scope.row.staffName) }}</template>
        </el-table-column>
        <el-table-column label="辅业务员" min-width="190">
          <template #default="scope">
            <div class="stacked-cell">
              <span>{{ assignmentNames(scope.row.salesAssignments, 'SECONDARY') }}</span>
              <small v-if="assignmentIds(scope.row.salesAssignments, 'SECONDARY') !== '—'">
                {{ assignmentIds(scope.row.salesAssignments, 'SECONDARY') }}
              </small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="CRM客户状态" width="135">
          <template #default="scope">
            <el-tag
              :type="sourceStatusTag(scope.row.internalStatus)"
              effect="light"
              size="small"
            >
              {{ statusLabel(scope.row.internalStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="订货宝客户状态" width="145">
          <template #default="scope">
            <div class="status-cell">
              <el-tag
                :type="sourceStatusTag(scope.row.sourceStatus)"
                effect="light"
                size="small"
              >
                {{ sourceStatusLabel(scope.row.sourceStatus, 'DHB_CUSTOMER_STATUS', '客户状态') }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最近同步时间" width="165">
          <template #default="scope">
            <span class="sync-time">{{ formatTime(scope.row.syncedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="86" fixed="right" align="center">
          <template #default="scope">
            <el-button link type="primary" @click.stop="openCustomerDetail(scope.row)">
              详情
            </el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无本地客户数据，可手动同步后重试" /></template>
      </el-table>

      <el-table
        v-else-if="currentView.key === 'addresses'"
        v-loading="loading"
        class="business-table"
        :data="addressRows"
        row-key="id"
      >
        <el-table-column label="所属客户" width="245" fixed="left">
          <template #default="scope">
            <div class="record-identity">
              <span class="record-avatar is-address">{{ avatarText(scope.row.customerName) }}</span>
              <div class="record-identity-content">
                <el-button link type="primary" @click="openCustomerDetailById(scope.row.customerId)">
                  {{ value(scope.row.customerName) }}
                </el-button>
                <small>客户编号 {{ value(scope.row.customerCode) }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="收货人" min-width="145">
          <template #default="scope">{{ value(scope.row.consignee || scope.row.contact) }}</template>
        </el-table-column>
        <el-table-column label="联系电话" min-width="150">
          <template #default="scope">{{ value(scope.row.phone) }}</template>
        </el-table-column>
        <el-table-column label="收货地址" min-width="320">
          <template #default="scope">
            <span class="address-cell">{{ value(scope.row.fullAddress || joinAddress(scope.row)) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="默认收货地址" width="135">
          <template #default="scope">
            <el-tag :type="scope.row.defaultAddress ? 'success' : 'info'" effect="light" size="small">
              {{ scope.row.defaultAddress ? '默认地址' : '普通地址' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="收货地址状态" width="135">
          <template #default="scope">
            <el-tag :type="sourceStatusTag(scope.row.status)" effect="light" size="small">
              {{ sourceText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近同步时间" width="165">
          <template #default="scope">{{ formatTime(scope.row.syncedAt) }}</template>
        </el-table-column>
        <template #empty><el-empty description="暂无本地收货地址，可点击右上角同步全部收货地址" /></template>
      </el-table>

      <el-table
        v-else-if="currentView.key === 'staff'"
        v-loading="loading"
        class="business-table"
        :data="staffRows"
        row-key="id"
      >
        <el-table-column label="员工姓名" width="220">
          <template #default="scope">
            <div class="record-identity">
              <span class="record-avatar is-staff">{{ avatarText(scope.row.staffName) }}</span>
              <div class="record-identity-content">
                <strong>{{ value(scope.row.staffName) }}</strong>
                <span>订货宝员工ID {{ value(scope.row.sourceStaffId) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="登录账号" min-width="180">
          <template #default="scope">{{ value(scope.row.accountName || scope.row.accountId) }}</template>
        </el-table-column>
        <el-table-column label="所属组织" min-width="170">
          <template #default="scope">{{ value(scope.row.branchName) }}</template>
        </el-table-column>
        <el-table-column label="职务" min-width="150">
          <template #default="scope">{{ value(scope.row.title || scope.row.roleName) }}</template>
        </el-table-column>
        <el-table-column label="手机号" min-width="150">
          <template #default="scope">{{ value(scope.row.mobile || scope.row.accountMobile) }}</template>
        </el-table-column>
        <el-table-column label="邮箱" min-width="200">
          <template #default="scope">{{ value(scope.row.email) }}</template>
        </el-table-column>
        <el-table-column label="员工类型" width="140">
          <template #default="scope">{{ staffTypeLabel(scope.row.staffType) }}</template>
        </el-table-column>
        <el-table-column label="员工状态" width="120">
          <template #default="scope">
            <el-tag :type="sourceStatusTag(scope.row.sourceStatus)" effect="light" size="small">
              {{ sourceStatusLabel(scope.row.sourceStatus, 'DHB_STAFF_STATUS', '员工状态') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近同步时间" width="165">
          <template #default="scope">{{ formatTime(scope.row.syncedAt) }}</template>
        </el-table-column>
        <template #empty><el-empty description="暂无本地员工数据，可手动同步后重试" /></template>
      </el-table>

      <div v-else-if="currentView.key === 'customer-areas'" class="area-tree">
        <template v-if="areaTree.length">
          <section v-for="province in areaTree" :key="province.key" class="area-tree-group">
            <button
              v-if="province.children.length"
              type="button"
              class="area-tree-parent"
              @click="toggleAreaNode(province.key)"
            >
              <span class="area-tree-caret">{{ isAreaExpanded(province.key) ? '−' : '+' }}</span>
              <span class="record-avatar is-dictionary">{{ avatarText(province.name) }}</span>
              <span class="area-tree-parent-name">{{ province.name }}</span>
              <small>{{ areaChildrenLabel(province) }}</small>
              <span v-if="!province.isVirtual" class="area-tree-code">地区编码 {{ value(province.code) }}</span>
              <el-tag v-if="!province.isVirtual" :type="province.status === 'ACTIVE' ? 'success' : 'info'" effect="light" size="small">
                {{ statusLabel(province.status) }}
              </el-tag>
              <span v-if="!province.isVirtual" class="area-tree-time">最近同步时间 {{ formatTime(province.syncedAt) }}</span>
            </button>
            <div v-else class="area-tree-parent is-leaf">
              <span class="area-tree-caret">·</span>
              <span class="record-avatar is-dictionary">{{ avatarText(province.name) }}</span>
              <span class="area-tree-parent-name">{{ province.name }}</span>
              <small>{{ areaLevelLabel(province.level) }}</small>
              <span v-if="!province.isVirtual" class="area-tree-code">地区编码 {{ value(province.code) }}</span>
              <el-tag v-if="!province.isVirtual" :type="province.status === 'ACTIVE' ? 'success' : 'info'" effect="light" size="small">
                {{ statusLabel(province.status) }}
              </el-tag>
              <span v-if="!province.isVirtual" class="area-tree-time">最近同步时间 {{ formatTime(province.syncedAt) }}</span>
            </div>

            <div v-if="province.children.length && isAreaExpanded(province.key)" class="area-tree-children">
              <div v-for="area in province.children" :key="area.key" class="area-tree-row">
                <div class="area-tree-name">
                  <span class="area-tree-branch">└</span>
                  <strong>{{ area.name }}</strong>
                  <small>{{ areaLevelLabel(area.level) }}</small>
                </div>
                <span>地区编码 {{ value(area.code) }}</span>
                <el-tag :type="area.status === 'ACTIVE' ? 'success' : 'info'" effect="light">
                  {{ statusLabel(area.status) }}
                </el-tag>
                <span>最近同步时间 {{ formatTime(area.syncedAt) }}</span>
              </div>
            </div>
          </section>
        </template>
        <el-empty v-else description="暂无本地归属地区，可手动同步后重试" />
      </div>

      <el-table
        v-else
        v-loading="loading"
        class="business-table"
        :data="dictionaryRows"
        row-key="id"
      >
        <el-table-column :label="dictionaryNameLabel" min-width="280">
          <template #default="scope">
            <div class="record-identity">
              <span class="record-avatar is-dictionary">{{ avatarText(scope.row.name) }}</span>
              <div class="record-identity-content">
                <strong>{{ value(scope.row.name) }}</strong>
                <span>{{ dictionaryCodeLabel }} {{ value(scope.row.code) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="字典状态" width="140">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'ACTIVE' ? 'success' : 'info'" effect="light">
              {{ statusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近同步时间" min-width="190">
          <template #default="scope">{{ formatTime(scope.row.syncedAt) }}</template>
        </el-table-column>
        <template #empty><el-empty :description="`暂无本地${currentView.title}数据，可手动同步后重试`" /></template>
      </el-table>

      <el-pagination
        v-if="currentView.key !== 'customer-areas'"
        class="pagination"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="pageData.total"
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="[20, 50, 100]"
        @current-change="changeCurrentPage"
        @size-change="changePageSize"
      />
    </el-card>

    <el-drawer
      v-model="detailVisible"
      class="customer-detail-drawer"
      size="min(960px, 92vw)"
      :with-header="false"
    >
      <div v-loading="detailLoading" class="customer-detail">
        <header class="detail-hero">
          <div class="detail-hero-main">
            <span class="detail-avatar">{{ avatarText(selectedCustomer?.name) }}</span>
            <div class="detail-title-block">
              <span>客户详情</span>
              <h2>{{ value(selectedCustomer?.name) }}</h2>
              <p>客户编号 {{ value(selectedCustomer?.code) }} · 登录账号 {{ value(selectedCustomer?.account) }}</p>
              <div v-if="selectedCustomer" class="detail-tags">
                <el-tag
                  :type="selectedCustomer.internalStatus === 'ACTIVE' ? 'success' : 'info'"
                >
                  {{ statusLabel(selectedCustomer.internalStatus) }}
                </el-tag>
          </div>
            </div>
          </div>
          <el-button circle plain aria-label="关闭客户详情" @click="detailVisible = false">×</el-button>
        </header>

        <template v-if="selectedCustomer">
          <div class="detail-metrics">
            <div><span>客户类型</span><strong>{{ value(selectedCustomer.typeName) }}</strong></div>
            <div><span>经营地区</span><strong>{{ value(selectedCustomer.areaName) }}</strong></div>
            <div><span>主业务员</span><strong>{{ value(selectedCustomer.staffName) }}</strong></div>
            <div><span>辅业务员</span><strong>{{ assignmentNames(selectedCustomer.salesAssignments, 'SECONDARY') }}</strong></div>
            <div><span>最近同步时间</span><strong class="metric-time">{{ formatTime(selectedCustomer.syncedAt) }}</strong></div>
          </div>

          <el-tabs v-model="detailTab" class="detail-tabs">
            <el-tab-pane label="客户概览" name="overview">
              <section class="detail-section">
                <div class="section-heading"><h3>基础资料</h3><p>按订货宝客户档案字段归一化展示</p></div>
                <dl class="info-grid">
                  <div><dt>客户名称</dt><dd>{{ value(selectedCustomer.name) }}</dd></div>
                  <div><dt>客户编号</dt><dd>{{ value(selectedCustomer.code) }}</dd></div>
                  <div><dt>登录账号</dt><dd>{{ value(selectedCustomer.account) }}</dd></div>
                  <div><dt>订货宝客户GUID</dt><dd>{{ value(selectedCustomer.source?.clientGuid) }}</dd></div>
                  <div><dt>客户类型</dt><dd>{{ value(selectedCustomer.typeName) }}</dd></div>
                  <div><dt>订货宝客户类型ID</dt><dd>{{ value(selectedCustomer.source?.typeId) }}</dd></div>
                  <div><dt>经营地区</dt><dd>{{ value(selectedCustomer.areaName) }}</dd></div>
                  <div><dt>订货宝地区ID</dt><dd>{{ value(selectedCustomer.source?.areaId) }}</dd></div>
                  <div><dt>订货宝地区GUID</dt><dd>{{ value(selectedCustomer.source?.areaGuid) }}</dd></div>
                  <div><dt>城市</dt><dd>{{ value(selectedCustomer.city) }}</dd></div>
                  <div><dt>邀请人</dt><dd>{{ value(selectedCustomer.inviter) }}</dd></div>
                  <div><dt>CRM客户状态</dt><dd>{{ statusLabel(selectedCustomer.internalStatus) }}</dd></div>
                  <div><dt>订货宝客户状态</dt><dd>{{ sourceStatusLabel(selectedCustomer.source?.statusCode || selectedCustomer.sourceStatus, 'DHB_CUSTOMER_STATUS', '客户状态') }}</dd></div>
                  <div><dt>结算方式</dt><dd>{{ settlementLabel(selectedCustomer.source?.clearingFormCode || selectedCustomer.settlementMode) }}</dd></div>
                  <div><dt>主业务员</dt><dd>{{ value(selectedCustomer.staffName) }}</dd></div>
                  <div><dt>辅业务员</dt><dd>{{ assignmentNames(selectedCustomer.salesAssignments, 'SECONDARY') }}</dd></div>
                  <div class="wide"><dt>备注</dt><dd>{{ value(selectedCustomer.remark) }}</dd></div>
                </dl>
              </section>
              <section class="detail-section">
                <div class="section-heading"><h3>主要联系方式</h3><p>订货宝客户档案当前返回的联系人资料</p></div>
                <dl class="info-grid">
                  <div><dt>联系人</dt><dd>{{ value(selectedCustomer.contactName) }}</dd></div>
                  <div><dt>联系电话</dt><dd>{{ value(selectedCustomer.phone) }}</dd></div>
                  <div><dt>邮箱</dt><dd>{{ value(selectedCustomer.email) }}</dd></div>
                  <div class="wide"><dt>客户地址</dt><dd>{{ value(selectedCustomer.address) }}</dd></div>
                </dl>
              </section>
              <section class="detail-section">
                <div class="section-heading"><h3>订货宝来源时间</h3><p>订货宝业务时间与 CRM 同步时间分开保存</p></div>
                <dl class="info-grid">
                  <div><dt>订货宝创建时间</dt><dd>{{ formatTime(selectedCustomer.sourceCreatedAt) }}</dd></div>
                  <div><dt>订货宝更新时间</dt><dd>{{ formatTime(selectedCustomer.sourceUpdatedAt) }}</dd></div>
                  <div><dt>最近同步时间</dt><dd>{{ formatTime(selectedCustomer.syncedAt) }}</dd></div>
                </dl>
              </section>
            </el-tab-pane>

            <el-tab-pane :label="`收货地址 (${selectedCustomer.shippingAddresses.length})`" name="addresses">
              <div v-if="selectedCustomer.shippingAddresses.length" class="address-list">
                <article v-for="address in selectedCustomer.shippingAddresses" :key="address.id">
                  <header>
                    <div>
                      <strong>{{ value(address.consignee || address.contact) }}</strong>
                      <span>{{ value(address.phone) }}</span>
                    </div>
                    <el-tag v-if="address.defaultAddress" type="success" effect="plain">默认地址</el-tag>
                  </header>
                  <p>{{ value(address.fullAddress || joinAddress(address)) }}</p>
                  <small>订货宝更新时间 {{ formatTime(address.sourceUpdatedAt) }}</small>
                </article>
              </div>
              <el-empty v-else description="当前客户没有已同步的收货地址" />
            </el-tab-pane>

          </el-tabs>
        </template>

        <el-empty v-else-if="!detailLoading" description="客户详情加载失败，请关闭后重试" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getCrmCustomer,
  getCrmShippingAddresses,
  getCrmCustomerAreas,
  getCrmCustomers,
  getCrmCustomerTypes,
  getCrmExternalStaff,
  syncCrmData,
  type CrmAddress,
  type CrmCustomerDetail,
  type CrmCustomerSummary,
  type CrmDictionaryItem,
  type CrmExternalStaff,
  type CrmPage,
  type CrmShippingAddress,
  type CrmSyncObjectType,
  type CrmSyncResult,
} from '@/api'
import { useAuthStore } from '@/stores/auth'
import { businessDictionaryLabel, loadBusinessDictionaries, sourceText } from '@/utils/business-dictionary'
import { createLatestRequestGuard } from '@/utils/latest-request'

type CrmViewType = 'customers' | 'addresses' | 'customer-types' | 'customer-areas' | 'staff'
type PageItem = CrmCustomerSummary | CrmShippingAddress | CrmDictionaryItem | CrmExternalStaff

interface ViewDefinition {
  key: CrmViewType
  routeKey: string
  objectType: Exclude<CrmSyncObjectType, 'ALL'>
  syncLabel: string
  title: string
  description: string
  placeholder: string
}

const views: ViewDefinition[] = [
  { key: 'customers', routeKey: 'supply.crm.customers.profiles', objectType: 'CUSTOMER', syncLabel: '客户档案', title: '客户档案', description: '对应订货宝客户档案；客户名称、类型、归属地区、联系人和客户状态分开查看。', placeholder: '输入客户编号、名称或登录账号' },
  { key: 'addresses', routeKey: 'supply.crm.customers.shipping-addresses', objectType: 'ADDRESS', syncLabel: '全部收货地址', title: '收货地址簿', description: '对应订货宝客户收货地址；所属客户、收货人、联系电话、地址状态分开查看。', placeholder: '输入客户名称、收货人、联系电话或地址' },
  { key: 'customer-types', routeKey: 'supply.crm.customers.levels-tags', objectType: 'CUSTOMER_TYPE', syncLabel: '客户类型', title: '客户类型', description: '对应订货宝客户类型字典；类型名称、类型编码和启用状态分开查看。', placeholder: '输入客户类型名称或编码' },
  { key: 'customer-areas', routeKey: 'supply.crm.customers.areas', objectType: 'CUSTOMER_AREA', syncLabel: '归属地区', title: '归属地区', description: '对应订货宝客户归属地区；按省、市和自定义地区层级查看。', placeholder: '输入地区名称或编码' },
  { key: 'staff', routeKey: 'supply.crm.assignments.external-staff', objectType: 'STAFF', syncLabel: '外部员工', title: '外部员工', description: '对应订货宝员工目录；姓名、登录账号、所属组织、职务、联系方式和员工状态分开查看。', placeholder: '输入员工姓名、登录账号或联系电话' },
]

const route = useRoute()
const auth = useAuthStore()
const listRequest = createLatestRequestGuard()
const canSync = computed(() => auth.hasPermission('crm:customer:write'))
const currentView = computed(() => {
  const routeKey = typeof route.meta.routeKey === 'string' ? route.meta.routeKey : ''
  return views.find((item) => item.routeKey === routeKey) ?? views[0] as ViewDefinition
})
const dictionaryNameLabel = computed(() => currentView.value.key === 'customer-types' ? '客户类型名称'
  : currentView.value.key === 'customer-areas' ? '地区名称' : '字典名称')
const dictionaryCodeLabel = computed(() => currentView.value.key === 'customer-types' ? '客户类型编码'
  : currentView.value.key === 'customer-areas' ? '地区编码' : '字典编码')
const loading = ref(false)
const syncing = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', status: '' })
const pageData = ref<CrmPage<PageItem>>({ total: 0, begin: 0, step: 20, items: [] })
const lastSync = ref<CrmSyncResult | null>(null)
const syncConflict = ref(false)
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailTab = ref('overview')
const selectedCustomer = ref<CrmCustomerDetail | null>(null)

type CrmAreaLevel = 'NATIONAL' | 'PROVINCE' | 'CITY' | 'OTHER'

interface CrmAreaTreeNode {
  key: string
  name: string
  code: string | null
  status: string | null
  syncedAt: string | null
  level: CrmAreaLevel
  isVirtual: boolean
  parentId: string | null
  parentCode: string | null
  children: CrmAreaTreeNode[]
}

// getArea 当前只返回 AreaName、AreaID、ERPID，没有父级地区字段；这里仅对标准名称和
// 已确认的城市名称做展示归类，其他自定义地区不猜测归属，统一留在未归类节点下。
const PROVINCE_NAMES = new Set([
  '北京市', '天津市', '上海市', '重庆市', '河北省', '山西省', '辽宁省', '吉林省',
  '黑龙江省', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省',
  '湖北省', '湖南省', '广东省', '海南省', '四川省', '贵州省', '云南省', '陕西省',
  '甘肃省', '青海省', '台湾省', '内蒙古自治区', '广西壮族自治区', '西藏自治区',
  '宁夏回族自治区', '新疆维吾尔自治区', '香港特别行政区', '澳门特别行政区',
])

const MUNICIPALITY_NAMES = new Set(['北京市', '天津市', '上海市', '重庆市'])

const CITY_PROVINCE_HINTS: Record<string, string> = {
  东莞市: '广东省', 广州市: '广东省', 深圳市: '广东省', 佛山市: '广东省', 惠州市: '广东省',
  中山市: '广东省', 珠海市: '广东省', 江门市: '广东省', 肇庆市: '广东省', 汕头市: '广东省',
  湛江市: '广东省', 清远市: '广东省', 韶关市: '广东省', 梅州市: '广东省', 阳江市: '广东省',
  茂名市: '广东省', 揭阳市: '广东省', 云浮市: '广东省',
  南京市: '江苏省', 苏州市: '江苏省', 无锡市: '江苏省', 常州市: '江苏省', 徐州市: '江苏省',
  南通市: '江苏省', 连云港市: '江苏省', 淮安市: '江苏省', 盐城市: '江苏省', 扬州市: '江苏省',
  镇江市: '江苏省', 泰州市: '江苏省', 宿迁市: '江苏省',
  成都市: '四川省', 绵阳市: '四川省', 德阳市: '四川省', 乐山市: '四川省', 宜宾市: '四川省',
  南充市: '四川省', 泸州市: '四川省', 达州市: '四川省', 眉山市: '四川省', 遂宁市: '四川省',
  北京市: '北京市', 天津市: '天津市', 上海市: '上海市', 重庆市: '重庆市',
}

const collapsedAreaNodes = reactive<Record<string, boolean>>({})

const customerRows = computed(() => pageData.value.items as CrmCustomerSummary[])
const addressRows = computed(() => pageData.value.items as CrmShippingAddress[])
const dictionaryRows = computed(() => pageData.value.items as CrmDictionaryItem[])
const staffRows = computed(() => pageData.value.items as CrmExternalStaff[])
const areaTree = computed(() => buildAreaTree(dictionaryRows.value))
const customerPageStats = computed(() => ({
  active: customerRows.value.filter((item) => ['ACTIVE', 'ENABLED'].includes(item.internalStatus.toUpperCase())).length,
}))

async function load() {
  const request = listRequest.begin()
  const targetView = currentView.value
  loading.value = true
  const begin = (currentPage.value - 1) * pageSize.value
  const common = {
    begin,
    step: pageSize.value,
    q: filters.keyword.trim() || undefined,
  }
  try {
    let nextPage: CrmPage<PageItem>
    if (targetView.key === 'customers') {
      nextPage = await getCrmCustomers({
        ...common,
        status: filters.status || undefined,
      }) as unknown as CrmPage<PageItem>
    } else if (targetView.key === 'addresses') {
      nextPage = await getCrmShippingAddresses(common) as unknown as CrmPage<PageItem>
    } else if (targetView.key === 'customer-types') {
      nextPage = await getCrmCustomerTypes(common) as unknown as CrmPage<PageItem>
    } else if (targetView.key === 'customer-areas') {
      nextPage = await loadAllCustomerAreas(common.q)
    } else {
      nextPage = await getCrmExternalStaff(common) as unknown as CrmPage<PageItem>
    }
    if (!listRequest.isCurrent(request)) return
    pageData.value = nextPage
  } catch (reason) {
    if (!listRequest.isCurrent(request)) return
    pageData.value = { total: 0, begin, step: pageSize.value, items: [] }
    ElMessage.error(errorMessage(reason, `${targetView.title}加载失败`))
  } finally {
    if (listRequest.isCurrent(request)) loading.value = false
  }
}

async function loadAllCustomerAreas(query?: string) {
  const step = 200
  const items: PageItem[] = []
  let begin = 0
  let total = 0

  while (true) {
    const page = await getCrmCustomerAreas({ begin, step, q: query }) as unknown as CrmPage<PageItem>
    total = page.total
    items.push(...page.items)
    if (!page.items.length || items.length >= total) break
    begin += page.items.length
  }

  return { total, begin: 0, step: items.length || step, items }
}

async function synchronize() {
  if (!canSync.value) return
  syncing.value = true
  syncConflict.value = false
  try {
    lastSync.value = await syncCrmData(currentView.value.objectType) as unknown as CrmSyncResult
    ElMessage.success(syncResultSummary(lastSync.value))
    await load()
  } catch (reason) {
    if (isSyncConflict(reason)) {
      syncConflict.value = true
      ElMessage.warning(`当前${currentView.value.syncLabel}已有同步任务运行中，请稍后重试`)
      return
    }
    ElMessage.error(errorMessage(reason, 'CRM 主数据同步失败'))
  } finally {
    syncing.value = false
  }
}

async function refreshAfterSyncConflict() {
  syncConflict.value = false
  await load()
}

async function openCustomerDetail(row: CrmCustomerSummary) {
  await openCustomerDetailById(row.id)
}

async function openCustomerDetailById(id: string) {
  detailVisible.value = true
  detailLoading.value = true
  detailTab.value = 'overview'
  selectedCustomer.value = null
  try {
    const customer = await getCrmCustomer(id) as unknown as CrmCustomerDetail
    selectedCustomer.value = {
      ...customer,
      // 客户详情接口直接返回 CRM 已同步的收货地址，旧版本响应缺失时按空列表兼容。
      shippingAddresses: Array.isArray(customer.shippingAddresses) ? customer.shippingAddresses : [],
    }
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '客户详情加载失败'))
  } finally {
    detailLoading.value = false
  }
}

async function query() {
  currentPage.value = 1
  await load()
}

async function resetFilters() {
  filters.keyword = ''
  filters.status = ''
  await query()
}

async function changeCurrentPage(value: number) {
  currentPage.value = value
  await load()
}

async function changePageSize(value: number) {
  pageSize.value = value
  currentPage.value = 1
  await load()
}

function syncResultSummary(result: CrmSyncResult) {
  const totals = result.objects.reduce(
    (summary, item) => ({
      fetched: summary.fetched + item.fetched,
      created: summary.created + item.created,
      changed: summary.changed + item.changed,
      repaired: summary.repaired + item.repaired,
      rejected: summary.rejected + item.rejected,
      unmapped: summary.unmapped + item.unmapped,
    }),
    { fetched: 0, created: 0, changed: 0, repaired: 0, rejected: 0, unmapped: 0 },
  )
  const dictionaryWarning = totals.unmapped > 0 ? `，字典未解析 ${totals.unmapped} 项` : ''
  return `同步完成：${result.objects.length} 类，获取 ${totals.fetched} 条，新增 ${totals.created} 条，变更 ${totals.changed} 条，修复 ${totals.repaired} 条，拒绝 ${totals.rejected} 条${dictionaryWarning}`
}

function avatarText(name: string | null | undefined) {
  const normalized = name?.trim()
  return normalized ? normalized.slice(0, 1) : '?'
}

function assignmentsOf(assignments: CrmCustomerSummary['salesAssignments'] | undefined,
                       type: string) {
  return (assignments ?? []).filter((item) => item.assignmentType === type)
}

function assignmentNames(assignments: CrmCustomerSummary['salesAssignments'] | undefined,
                         type: string) {
  const names = assignmentsOf(assignments, type).map((item) => item.staffName).filter(Boolean)
  return names.length ? names.join('、') : '—'
}

function assignmentIds(assignments: CrmCustomerSummary['salesAssignments'] | undefined,
                       type: string) {
  const ids = assignmentsOf(assignments, type).map((item) => item.sourceStaffId).filter(Boolean)
  return ids.length ? `员工ID：${ids.join('、')}` : '—'
}

function statusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    ACTIVE: '启用', INACTIVE: '停用', ENABLED: '启用', DISABLED: '停用',
    LOCKED: '锁定', SUSPENDED: '暂停', EXPIRED: '已过期', CLOSED: '已关闭',
    PENDING: '待处理', RUNNING: '运行中', FAILED: '失败', COMPLETED: '已完成',
  }
  if (!status) return '-'
  const normalized = status.toUpperCase()
  return labels[normalized] || (/[^\u0000-\u007f]/.test(status) ? status : `未知状态（${status}）`)
}

function sourceStatusTag(status: string | null) {
  if (!status) return 'info'
  if (isSourceActive(status)) return 'success'
  const normalized = status.toUpperCase()
  if (['F', 'INACTIVE', 'DISABLED', '停用', '禁用'].includes(normalized)) return 'info'
  return 'warning'
}

function isSourceActive(status: string | null | undefined) {
  const normalized = status?.toUpperCase()
  return ['T', 'ACTIVE', 'ENABLED', '正常', '启用'].includes(normalized ?? '')
}

function sourceStatusLabel(status: string | null | undefined,
                           dictCode = 'DHB_CUSTOMER_STATUS', subject = '客户状态') {
  return businessDictionaryLabel('CRM', dictCode, status, subject)
}

function settlementLabel(mode: string | null | undefined) {
  return businessDictionaryLabel('CRM', 'DHB_CUSTOMER_CLEARING_FORM', mode, '结算方式')
}

function staffTypeLabel(value: string | null | undefined) {
  return businessDictionaryLabel('CRM', 'DHB_STAFF_TYPE', value, '员工类型')
}

function normalizeAreaName(name: string | null | undefined) {
  return name?.trim().replace(/\s+/g, '') ?? ''
}

function areaLeafName(name: string) {
  const parts = name.split(/[\\/／|｜>＞、,，—–-]+/).filter(Boolean)
  return parts[parts.length - 1] ?? name
}

function isProvinceName(name: string) {
  return PROVINCE_NAMES.has(name)
    || name.endsWith('省')
    || name.endsWith('自治区')
    || name.endsWith('特别行政区')
}

function areaLevel(name: string): CrmAreaLevel {
  const normalized = normalizeAreaName(name)
  if (normalized === '全国') return 'NATIONAL'
  if (isProvinceName(normalized)) return 'PROVINCE'
  if (MUNICIPALITY_NAMES.has(normalized)) return 'PROVINCE'
  // “默认地区”等是订货宝常见的自定义归属名称，不能仅因“地区”后缀就当作行政市级。
  if (normalized.endsWith('市') || normalized.endsWith('自治州') || normalized.endsWith('盟')) return 'CITY'
  return 'OTHER'
}

function provinceForCity(name: string) {
  const normalized = normalizeAreaName(name)
  const parts = normalized.split(/[\\/／|｜>＞、,，—–-]+/).filter(Boolean)
  const prefix = parts.find((part) => isProvinceName(part))
  if (prefix) return prefix
  return CITY_PROVINCE_HINTS[areaLeafName(normalized)] ?? null
}

function areaNode(item: CrmDictionaryItem, level: CrmAreaLevel, name = item.name): CrmAreaTreeNode {
  return {
    key: `area:${item.id || item.code || name}`,
    name,
    code: item.code,
    status: item.status,
    syncedAt: item.syncedAt,
    level,
    isVirtual: false,
    parentId: item.parentId ?? null,
    parentCode: item.parentCode ?? null,
    children: [],
  }
}

function buildAreaTree(items: CrmDictionaryItem[]) {
  if (items.some((item) => item.parentId || item.parentCode)) {
    return buildLinkedAreaTree(items)
  }
  // 兼容历史同步记录：这些记录没有 parentID，只能沿用旧页面的保守展示归类；
  // 新同步只要返回父级关系，就完全走上面的来源关系树。
  return buildLegacyAreaTree(items)
}

function buildLinkedAreaTree(items: CrmDictionaryItem[]) {
  const nodes = items
    .filter((item) => normalizeAreaName(item.name))
    .map((item) => areaNode(item, areaLevel(normalizeAreaName(item.name))))
  const byId = new Map(nodes.map((node) => [node.key.replace(/^area:/, ''), node]))
  const byCode = new Map(nodes.filter((node) => node.code).map((node) => [node.code as string, node]))
  const roots: CrmAreaTreeNode[] = []
  let unresolvedParent: CrmAreaTreeNode | null = null

  for (const node of nodes) {
    const parent = (node.parentId ? byId.get(node.parentId) : undefined)
      ?? (node.parentCode ? byCode.get(node.parentCode) : undefined)
    if (parent && parent !== node) {
      parent.children.push(node)
      continue
    }
    if ((node.parentId || node.parentCode) && !parent) {
      unresolvedParent ??= {
        key: 'virtual-area:unresolved-parent', name: '未同步上级地区', code: null,
        status: null, syncedAt: null, level: 'OTHER', isVirtual: true,
        parentId: null, parentCode: null, children: [],
      }
      unresolvedParent.children.push(node)
      continue
    }
    roots.push(node)
  }

  if (unresolvedParent) roots.push(unresolvedParent)
  const sortNodes = (values: CrmAreaTreeNode[]) => {
    values.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    values.forEach((item) => sortNodes(item.children))
  }
  sortNodes(roots)
  const national = roots.filter((item) => item.level === 'NATIONAL')
  return [...national, ...roots.filter((item) => item.level !== 'NATIONAL')]
}

function buildLegacyAreaTree(items: CrmDictionaryItem[]) {
  const parents = new Map<string, CrmAreaTreeNode>()
  const national: CrmAreaTreeNode[] = []
  const unmatchedCities: CrmAreaTreeNode[] = []
  const otherAreas: CrmAreaTreeNode[] = []

  const ensureParent = (name: string, source?: CrmDictionaryItem, level: CrmAreaLevel = 'PROVINCE') => {
    const key = normalizeAreaName(name)
    const existing = parents.get(key)
    if (existing) {
      if (source) {
        existing.code = source.code
        existing.status = source.status
        existing.syncedAt = source.syncedAt
        existing.isVirtual = false
        existing.key = `area:${source.id || source.code || name}`
      }
      return existing
    }
    const created = source
      ? areaNode(source, level, name)
      : { key: `virtual-area:${key}`, name, code: null, status: null, syncedAt: null, level,
          isVirtual: true, parentId: null, parentCode: null, children: [] }
    parents.set(key, created)
    return created
  }

  for (const item of items) {
    const name = normalizeAreaName(item.name)
    if (!name) continue
    const level = areaLevel(name)
    if (level === 'NATIONAL') {
      national.push(areaNode(item, level))
      continue
    }
    if (level === 'PROVINCE') {
      ensureParent(name, item, level)
      continue
    }
    if (level === 'CITY') {
      const parentName = provinceForCity(name)
      if (parentName) {
        ensureParent(parentName).children.push(areaNode(item, level))
      } else {
        unmatchedCities.push(areaNode(item, level))
      }
      continue
    }
    otherAreas.push(areaNode(item, level))
  }

  if (unmatchedCities.length) ensureParent('未匹配省份', undefined, 'OTHER').children.push(...unmatchedCities)
  if (otherAreas.length) ensureParent('未归类地区', undefined, 'OTHER').children.push(...otherAreas)

  for (const parent of parents.values()) parent.children.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  const parentRows = [...parents.values()].sort((left, right) => {
    const special = (name: string) => name === '未匹配省份' || name === '未归类地区'
    if (special(left.name) !== special(right.name)) return special(left.name) ? 1 : -1
    return left.name.localeCompare(right.name, 'zh-CN')
  })
  return [...national, ...parentRows]
}

function areaChildrenLabel(area: CrmAreaTreeNode) {
  const cityCount = area.children.filter((item) => item.level === 'CITY').length
  return cityCount === area.children.length ? `${cityCount} 个市级地区` : `${area.children.length} 个下级地区`
}

function areaLevelLabel(level: CrmAreaLevel) {
  if (level === 'NATIONAL') return '全国'
  if (level === 'PROVINCE') return '省级'
  if (level === 'CITY') return '市级'
  return '自定义'
}

function isAreaExpanded(key: string) {
  return collapsedAreaNodes[key] !== true
}

function toggleAreaNode(key: string) {
  collapsedAreaNodes[key] = isAreaExpanded(key)
}

function joinAddress(address: Pick<CrmAddress, 'regionText' | 'areaName' | 'addressDetail'>) {
  return [address.regionText, address.areaName, address.addressDetail].filter(Boolean).join(' ')
}

function value(item: unknown) {
  return item === null || item === undefined || item === '' ? '-' : String(item)
}

function formatTime(item: string | null | undefined) {
  if (!item) return '-'
  const date = new Date(item)
  return Number.isNaN(date.getTime()) ? item : date.toLocaleString('zh-CN', { hour12: false })
}

function errorMessage(reason: unknown, fallback: string) {
  if (typeof reason === 'object' && reason !== null && 'message' in reason) {
    const message = (reason as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

function isSyncConflict(reason: unknown) {
  if (!reason || typeof reason !== 'object') return false
  const value = reason as { code?: unknown; message?: unknown }
  return value.code === 'CONFLICT'
    || (typeof value.message === 'string' && value.message.includes('已有同步任务运行中'))
}

watch(() => route.meta.routeKey, async () => {
  currentPage.value = 1
  filters.keyword = ''
  filters.status = ''
  lastSync.value = null
  syncConflict.value = false
  detailVisible.value = false
  await load()
})

onMounted(() => {
  void loadBusinessDictionaries([
    { moduleCode: 'CRM', code: 'DHB_CUSTOMER_STATUS' },
    { moduleCode: 'CRM', code: 'DHB_CUSTOMER_CLEARING_FORM' },
    { moduleCode: 'CRM', code: 'DHB_STAFF_STATUS' },
    { moduleCode: 'CRM', code: 'DHB_STAFF_TYPE' },
    { moduleCode: 'CRM', code: 'INTERNAL_STATUS' },
  ])
  void load()
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.crm-master-page { padding-bottom: $spacing-lg; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: $spacing-lg; }
.page-header > div:first-child > span { color: $color-text-secondary; font-size: $font-size-sm; }
.page-header h1 { margin: 5px 0; color: $color-text-primary; font-size: $font-size-xl; }
.page-header p { margin: 0; color: $color-text-secondary; }
.boundary-alert, .sync-result-alert { margin-bottom: $spacing-md; }
.query-panel { margin-bottom: $spacing-lg; padding: $spacing-md $spacing-md 0; border: 1px solid $color-border-base; border-radius: $border-radius-base; background: $color-bg-base; }
.query-bar :deep(.el-form-item) { margin-bottom: $spacing-md; }
.query-bar :deep(.el-input) { width: 250px; }
.result-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: $spacing-lg; margin-bottom: $spacing-md; }
.result-heading h2 { margin: 0 0 5px; color: $color-text-primary; font-size: $font-size-lg; }
.result-heading p { margin: 0; color: $color-text-secondary; font-size: $font-size-sm; }
.page-status-summary { display: flex; gap: $spacing-md; color: $color-text-secondary; font-size: $font-size-sm; }
.page-status-summary span { display: inline-flex; align-items: center; gap: 6px; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: $color-info; }
.status-dot.is-active { background: $color-success; }
.business-table { overflow: hidden; border: 1px solid $color-border-base; border-radius: $border-radius-base; }
.business-table :deep(.el-table__header th) { height: 48px; background: $color-bg-muted; color: $color-text-secondary; font-weight: 600; }
.business-table :deep(.el-table__row td) { padding: 12px 0; }
.business-table.is-clickable :deep(.el-table__row:hover > td) { background: #eff6ff !important; }
.business-table.is-clickable :deep(.el-table__row) { cursor: pointer; }
.record-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
.record-avatar, .detail-avatar { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; border: 1px solid #bfdbfe; border-radius: $border-radius-lg; background: #eff6ff; color: $color-primary; font-weight: 700; }
.record-avatar { width: 46px; height: 46px; font-size: $font-size-md; }
.record-avatar.is-staff { border-color: #c7d2fe; background: #eef2ff; color: #4f46e5; }
.record-avatar.is-dictionary { border-color: #bae6fd; background: #f0f9ff; color: #0369a1; }
.record-avatar.is-address { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; }
.record-identity-content { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.record-identity-content strong { overflow: hidden; color: $color-text-primary; text-overflow: ellipsis; white-space: nowrap; }
.record-identity-content span { color: $color-text-regular; font-size: $font-size-sm; }
.record-identity-content small, .stacked-cell small, .status-cell small { color: $color-text-secondary; font-size: $font-size-xs; }
.stacked-cell, .status-cell { display: flex; align-items: flex-start; flex-direction: column; gap: 5px; min-width: 0; }
.stacked-cell > span { overflow: hidden; max-width: 100%; color: $color-text-regular; text-overflow: ellipsis; white-space: nowrap; }
.status-cell small.is-warning { color: $color-warning; }
.sync-time { color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.5; }
.address-cell { display: block; overflow: hidden; color: $color-text-regular; line-height: 1.6; text-overflow: ellipsis; white-space: nowrap; }
.area-tree { overflow: hidden; border: 1px solid $color-border-base; border-radius: $border-radius-base; background: $color-bg-white; }
.area-tree-group + .area-tree-group { border-top: 1px solid $color-border-lighter; }
.area-tree-parent { display: flex; align-items: center; gap: $spacing-md; width: 100%; padding: 14px $spacing-md; border: 0; background: $color-bg-white; color: $color-text-regular; text-align: left; cursor: pointer; }
.area-tree-parent:hover { background: #f8fbff; }
.area-tree-parent.is-leaf { cursor: default; }
.area-tree-caret { display: inline-flex; align-items: center; justify-content: center; width: 20px; color: $color-primary; font-size: $font-size-lg; }
.area-tree-parent-name { min-width: 130px; color: $color-text-primary; font-weight: 600; }
.area-tree-parent small, .area-tree-code, .area-tree-time { color: $color-text-secondary; font-size: $font-size-xs; }
.area-tree-code { margin-left: auto; }
.area-tree-children { padding: 0 $spacing-md $spacing-sm 62px; background: #fbfdff; }
.area-tree-row { display: grid; grid-template-columns: minmax(180px, 1fr) 140px 90px 170px; align-items: center; gap: $spacing-md; min-height: 48px; border-top: 1px dashed $color-border-lighter; color: $color-text-secondary; font-size: $font-size-sm; }
.area-tree-name { display: flex; align-items: center; gap: $spacing-sm; min-width: 0; }
.area-tree-name strong { overflow: hidden; color: $color-text-regular; text-overflow: ellipsis; white-space: nowrap; }
.area-tree-name small { color: $color-text-secondary; font-size: $font-size-xs; }
.area-tree-branch { color: $color-primary; font-size: $font-size-md; }
.area-tree-time { white-space: nowrap; }
.pagination { justify-content: flex-end; margin-top: $spacing-lg; }
:deep(.customer-detail-drawer) { background: $color-bg-page; }
:deep(.customer-detail-drawer .el-drawer__body) { padding: 0; }
.customer-detail { min-height: 100%; background: $color-bg-page; }
.detail-hero { position: sticky; z-index: 4; top: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: $spacing-lg; padding: $spacing-lg $spacing-xl; border-bottom: 1px solid $color-border-base; background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(10px); }
.detail-hero-main { display: flex; align-items: center; gap: $spacing-md; min-width: 0; }
.detail-avatar { width: 78px; height: 78px; font-size: 28px; }
.detail-title-block { min-width: 0; }
.detail-title-block > span { color: $color-primary; font-size: $font-size-xs; }
.detail-title-block h2 { overflow: hidden; margin: 4px 0; color: $color-text-primary; font-size: 24px; text-overflow: ellipsis; white-space: nowrap; }
.detail-title-block p { margin: 0; color: $color-text-secondary; }
.detail-tags { display: flex; flex-wrap: wrap; gap: $spacing-sm; margin-top: 10px; }
.detail-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $spacing-md; padding: $spacing-lg $spacing-xl 0; }
.detail-metrics > div { display: flex; flex-direction: column; gap: 8px; padding: $spacing-md; border: 1px solid $color-border-base; border-radius: $border-radius-lg; background: $color-bg-white; }
.detail-metrics span { color: $color-text-secondary; font-size: $font-size-xs; }
.detail-metrics strong { overflow: hidden; color: $color-text-primary; text-overflow: ellipsis; white-space: nowrap; }
.detail-metrics .metric-time { font-size: $font-size-sm; }
.detail-tabs { padding: $spacing-md $spacing-xl $spacing-xl; }
.detail-section { margin-bottom: $spacing-lg; padding: $spacing-lg; border: 1px solid $color-border-base; border-radius: $border-radius-lg; background: $color-bg-white; }
.section-heading { margin-bottom: $spacing-md; }
.section-heading h3 { margin: 0 0 4px; color: $color-text-primary; font-size: $font-size-md; }
.section-heading p { margin: 0; color: $color-text-secondary; font-size: $font-size-xs; }
.info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; margin: 0; border-top: 1px solid $color-border-lighter; border-left: 1px solid $color-border-lighter; }
.info-grid > div { display: grid; grid-template-columns: 120px minmax(0, 1fr); min-height: 46px; border-right: 1px solid $color-border-lighter; border-bottom: 1px solid $color-border-lighter; }
.info-grid > div.wide { grid-column: 1 / -1; }
.info-grid dt, .info-grid dd { margin: 0; padding: 12px; }
.info-grid dt { background: $color-bg-muted; color: $color-text-secondary; font-size: $font-size-sm; }
.info-grid dd { overflow-wrap: anywhere; color: $color-text-regular; }
.address-list { display: grid; gap: $spacing-md; }
.address-list article { padding: $spacing-lg; border: 1px solid $color-border-base; border-radius: $border-radius-lg; background: $color-bg-white; }
.address-list header { display: flex; align-items: center; justify-content: space-between; gap: $spacing-md; }
.address-list header div { display: flex; align-items: center; gap: $spacing-md; }
.address-list header span, .address-list small { color: $color-text-secondary; font-size: $font-size-sm; }
.address-list p { margin: 12px 0 8px; color: $color-text-regular; }

@media (max-width: 900px) {
  .page-header, .result-heading { align-items: stretch; flex-direction: column; }
  .detail-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); padding-right: $spacing-md; padding-left: $spacing-md; }
  .detail-tabs { padding-right: $spacing-md; padding-left: $spacing-md; }
  .area-tree-row { grid-template-columns: minmax(160px, 1fr) 120px 80px; }
  .area-tree-row > span:last-child { display: none; }
}

@media (max-width: 600px) {
  .detail-hero { padding: $spacing-md; }
  .detail-avatar { width: 56px; height: 56px; }
  .detail-metrics, .info-grid { grid-template-columns: 1fr; }
  .info-grid > div.wide { grid-column: auto; }
  .area-tree-parent { flex-wrap: wrap; gap: $spacing-sm; }
  .area-tree-parent-name { min-width: 100px; }
  .area-tree-code { margin-left: 36px; }
  .area-tree-children { padding-left: $spacing-md; }
  .area-tree-row { grid-template-columns: 1fr auto; gap: $spacing-sm; padding: 8px 0; }
  .area-tree-row > span:nth-child(2), .area-tree-row > span:last-child { display: none; }
}
</style>
