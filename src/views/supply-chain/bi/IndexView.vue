<template>
  <main
    class="bi-cockpit"
    :class="{ 'bi-cockpit--expanded': expanded }"
    :aria-label="dashboardTitle"
  >
    <header class="cockpit-header">
      <div class="cockpit-heading">
        <span class="live-dot" :class="{ 'live-dot--error': errorMessage }" />
        <h1>{{ dashboardTitle }}</h1>
        <span class="scope-date">{{ rangeLabel }}</span>
      </div>
      <div class="cockpit-tools">
        <span v-if="lastUpdated" class="updated-time">查询 {{ lastUpdated }}</span>
        <el-tooltip content="运营跟进" placement="bottom"
          ><el-button
            text
            circle
            :icon="Tickets"
            aria-label="运营跟进"
            @click="openOperations('actions')"
        /></el-tooltip>
        <el-tooltip content="经营目标" placement="bottom"
          ><el-button
            text
            circle
            :icon="Aim"
            aria-label="经营目标"
            @click="openOperations('targets')"
        /></el-tooltip>
        <el-tooltip
          v-if="effectiveScope?.globalGovernance"
          content="飞书数据对账"
          placement="bottom"
        >
          <el-button
            text
            circle
            :icon="Connection"
            aria-label="飞书数据对账"
            @click="reconciliationCenterVisible = true"
          />
        </el-tooltip>
        <el-tooltip
          v-if="effectiveScope?.globalGovernance && authStore.hasPermission('iam:data-scope:write')"
          content="看板数据权限"
          placement="bottom"
        >
          <el-button
            text
            circle
            :icon="Lock"
            aria-label="看板数据权限"
            @click="scopeSettingsVisible = true"
          />
        </el-tooltip>
        <el-tooltip content="每60秒更新看板" placement="bottom"
          ><el-switch v-model="autoRefresh" size="small" aria-label="自动更新看板"
        /></el-tooltip>
        <el-tooltip content="刷新看板" placement="bottom"
          ><el-button
            text
            circle
            :icon="Refresh"
            :loading="loading"
            aria-label="刷新看板"
            @click="refreshDashboard"
        /></el-tooltip>
        <el-tooltip content="指标口径与数据同步" placement="bottom"
          ><el-button
            text
            :icon="InfoFilled"
            aria-label="指标口径与数据同步"
            @click="openGovernance()"
            >口径说明</el-button
          ></el-tooltip
        >
        <el-tooltip :content="expanded ? '退出大屏' : '大屏模式'" placement="bottom"
          ><el-button
            text
            circle
            :icon="expanded ? Close : FullScreen"
            :aria-label="expanded ? '退出大屏' : '大屏模式'"
            @click="expanded = !expanded"
        /></el-tooltip>
      </div>
    </header>

    <form v-if="section !== 'activity'" class="cockpit-filters" @submit.prevent="loadDashboard()">
      <el-radio-group
        v-model="quickPeriod"
        size="small"
        aria-label="经营周期"
        @change="applyQuickPeriod"
      >
        <el-radio-button value="latest">最新</el-radio-button
        ><el-radio-button value="today">今日</el-radio-button
        ><el-radio-button value="month">本月</el-radio-button
        ><el-radio-button value="last-month">上月</el-radio-button
        ><el-radio-button value="year">本年</el-radio-button>
      </el-radio-group>
      <div class="date-filter">
        <el-date-picker
          v-model="filters.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          range-separator="至"
          aria-label="日期范围"
          size="small"
          @change="quickPeriod = 'custom'"
        />
      </div>
      <el-select
        v-model="filters.regionCode"
        filterable
        placeholder="全部城市"
        aria-label="城市"
        :clearable="effectiveScope?.accessLevel === 'TENANT'"
        class="dimension-filter"
        size="small"
        ><el-option
          v-for="item in regionOptions"
          :key="item.optionValue"
          :value="item.optionValue"
          :label="item.optionLabel"
      /></el-select>
      <el-select
        v-model="filters.ownerStaffCode"
        filterable
        clearable
        placeholder="全部销售"
        aria-label="销售"
        :disabled="effectiveScope?.accessLevel === 'SELF'"
        class="dimension-filter"
        size="small"
        ><el-option
          v-for="item in filterOptions.salesOwners"
          :key="item.optionValue"
          :value="item.optionValue"
          :label="item.optionLabel"
      /></el-select>
      <ProductCategorySelect
        v-if="categoryFilterSupported"
        v-model="filters.productCategoryId"
        :categories="productCategories"
        class="dimension-filter"
        size="small"
        aria-label="商品分类"
        placeholder="全部商品分类"
      />
      <el-tooltip content="更多筛选" placement="bottom"
        ><el-button
          text
          circle
          :icon="Filter"
          aria-label="更多筛选"
          :aria-expanded="moreFilters"
          @click="moreFilters = !moreFilters"
      /></el-tooltip>
      <el-button size="small" type="primary" :icon="Search" :loading="loading" native-type="submit"
        >查询</el-button
      >
      <el-tooltip content="重置筛选" placement="bottom"
        ><el-button text circle :icon="RefreshLeft" aria-label="重置筛选" @click="resetFilters"
      /></el-tooltip>
      <div v-if="moreFilters" class="extended-filters">
        <el-select
          v-model="filters.customerTypeCode"
          filterable
          clearable
          placeholder="全部客户类型"
          aria-label="客户类型"
          size="small"
          ><el-option
            v-for="item in filterOptions.customerTypes"
            :key="item.optionValue"
            :value="item.optionValue"
            :label="item.optionLabel"
        /></el-select>
        <el-select
          v-model="filters.sourceSystemCode"
          clearable
          placeholder="全部订单来源"
          aria-label="订单来源"
          size="small"
          ><el-option
            v-for="item in filterOptions.sourceSystems"
            :key="item.optionValue"
            :value="item.optionValue"
            :label="item.optionLabel"
        /></el-select>
      </div>
    </form>
    <div v-if="scopeTags.length && section !== 'activity'" class="scope-tags">
      <el-tag
        v-for="tag in scopeTags"
        :key="tag.key"
        size="small"
        closable
        @close="clearDimension(tag.key)"
        >{{ tag.label }}</el-tag
      >
    </div>
    <el-alert
      v-if="errorMessage"
      type="error"
      :title="errorMessage"
      :closable="false"
      show-icon
      class="load-error"
    >
      <el-button v-if="authenticationRequired" link type="primary" @click="restoreLogin"
        >重新登录</el-button
      >
    </el-alert>
    <div v-if="filterError" class="filter-error">
      {{ filterError }}
      <el-button link type="primary" @click="loadFilterOptions">重试筛选项</el-button>
    </div>

    <template v-if="overview && !errorMessage">
      <div class="cockpit-kpis" aria-label="核心经营指标">
        <div
          v-for="kpi in headlineKpis"
          :key="kpi.label"
          class="cockpit-kpi"
          :style="{ '--metric-color': kpi.color }"
          :title="
            [kpi.definition, comparisonLabel(comparison, kpi.label), comparisonPeriod]
              .filter(Boolean)
              .join('；')
          "
        >
          <span
            >{{ kpi.label }} <small v-if="kpi.sample" class="sample-label">样例</small>
            <button
              class="metric-info"
              type="button"
              :aria-label="`${kpi.label}口径说明`"
              title="口径说明"
              @click="openGovernance(`kpi:${kpi.label}`)"
            >
              <el-icon><InfoFilled /></el-icon>
            </button>
          </span>
          <component
            :is="kpi.section ? 'button' : 'div'"
            :type="kpi.section ? 'button' : undefined"
            class="cockpit-kpi__value"
            :class="{ 'cockpit-kpi--link': kpi.section }"
            @click="kpi.section && openSection(kpi.section)"
          >
            <strong>{{ kpi.value }}</strong>
            <small
              v-if="
                comparison &&
                comparison.previous.orderCount > 0 &&
                comparisonLabel(comparison, kpi.label)
              "
              class="kpi-comparison"
              :title="comparisonPeriod"
              >{{ comparisonLabel(comparison, kpi.label) }}</small
            >
          </component>
        </div>
      </div>
      <div class="workspace-navigation">
        <div
          class="workspace-tabs"
          role="tablist"
          aria-label="经营分析"
          aria-orientation="horizontal"
          @keydown="onAnalysisKeydown"
        >
          <button
            v-for="view in workspaceTabs"
            :id="`${workspaceId}-tab-${view.id}`"
            :key="view.id"
            type="button"
            role="tab"
            :aria-selected="activeAnalysis === view.id"
            :aria-controls="`${workspaceId}-panel`"
            :tabindex="activeAnalysis === view.id ? 0 : -1"
            @click="activeAnalysis = view.id"
          >
            {{ view.label }}
          </button>
        </div>
        <div class="workspace-navigation__tools">
          <el-button
            v-if="section === 'customer'"
            size="small"
            @click="customerAttributesVisible = true"
            >客户属性</el-button
          >
          <el-select
            v-if="isInventory"
            v-model="chartOptions.inventoryUnit"
            size="small"
            aria-label="库存计量单位"
            class="inventory-unit"
          >
            <el-option
              v-for="unit in inventoryUnits"
              :key="unit"
              :value="unit"
              :label="unitName(unit)"
            />
          </el-select>
          <el-radio-group
            v-if="['sales', 'sales-collection'].includes(section)"
            :model-value="section"
            size="small"
            aria-label="销售分析视图"
            @change="openSection($event === 'sales' ? 'sales' : 'sales-collection')"
            ><el-radio-button value="sales">销售</el-radio-button
            ><el-radio-button value="sales-collection">回款</el-radio-button></el-radio-group
          >
          <el-button
            v-if="['overview', 'city-operating', 'product-sales'].includes(section)"
            size="small"
            :icon="Download"
            @click="openCityProductReport()"
            >城市商品报表</el-button
          >
          <el-button
            v-if="appliedFilters.regionCode && section === 'city-operating'"
            link
            type="primary"
            @click="clearDimension('regionCode')"
            >返回全部城市</el-button
          >
        </div>
      </div>
      <div v-if="inventoryFilterConflict" class="inventory-scope-notice">
        库存快照尚不支持城市／销售／客户类型／订单来源筛选，已暂停展示库存汇总。<el-button
          link
          type="primary"
          @click="clearInventoryFilters"
          >清除不适用筛选</el-button
        >
      </div>
      <div v-if="analysisError" class="inventory-scope-notice" role="status">
        城市品类、复购或前期分析加载失败，当前主指标仍可查看。
        <el-button link type="primary" @click="refreshDashboard">重试</el-button>
      </div>
      <div v-if="comparisonError" class="inventory-scope-notice" role="status">
        前期比较暂不可用，当前期间指标不受影响。
        <el-button link type="primary" @click="refreshDashboard">重试</el-button>
      </div>
      <section
        :id="`${workspaceId}-panel`"
        role="tabpanel"
        :aria-labelledby="`${workspaceId}-tab-${activeAnalysis}`"
        tabindex="0"
      >
        <KeepAlive :key="workspaceCacheKey" :max="6">
          <CockpitWorkspace
            :key="`${section}-${activeAnalysis}`"
            :main="workspace.main"
            :aside="workspace.aside"
            :actions="section === 'activity' ? [] : model.actions"
            :aria-busy="loading"
            v-loading="loading"
            @inspect="inspectFigure"
            @explain="openMetricExplanation"
            @resolve-empty="resolveEmpty"
            @action="inspectAction"
          >
            <template #figure-tools="{ figure }">
              <el-radio-group
                v-if="['trend', 'city-trend', 'receipt-trend'].includes(figure.id)"
                v-model="chartOptions.period"
                size="small"
                aria-label="趋势粒度"
                ><el-radio-button value="month">月</el-radio-button
                ><el-radio-button value="day">日</el-radio-button></el-radio-group
              >
              <el-radio-group
                v-if="figure.id === 'performance-ranking'"
                v-model="chartOptions.rankingMetric"
                size="small"
                aria-label="业绩排名指标"
                ><el-radio-button value="salesAmount">销售额</el-radio-button
                ><el-radio-button value="paidAmount">累计回款</el-radio-button></el-radio-group
              >
              <el-radio-group
                v-if="
                  ['product-sales', 'gross-profit'].includes(section) &&
                  ['products', 'product-profit'].includes(figure.id)
                "
                v-model="chartOptions.productDimension"
                size="small"
                aria-label="商品分析维度"
                ><el-radio-button value="PRODUCT">商品</el-radio-button
                ><el-radio-button value="SKU">规格/型号</el-radio-button
                ><el-radio-button value="CATEGORY">分类</el-radio-button
                ><el-radio-button value="BRAND">品牌</el-radio-button></el-radio-group
              >
            </template>
            <template #figure-summary="{ figure }">
              <div
                v-if="section === 'overview' && figure.id === 'cost-bridge'"
                class="cost-readings"
              >
                <button
                  v-for="kpi in costKpis"
                  :key="kpi.label"
                  type="button"
                  :title="kpi.definition"
                  @click="openSection('city-cost')"
                >
                  <span
                    >{{ kpi.label }}
                    <small v-if="kpi.sample" class="sample-label">样例</small></span
                  >
                  <strong :style="{ color: kpi.color }">{{ kpi.value }}</strong>
                </button>
              </div>
            </template>
          </CockpitWorkspace>
        </KeepAlive>
      </section>
    </template>
    <div
      v-else-if="loading"
      class="initial-loading"
      v-loading="loading"
      aria-label="正在加载经营数据"
    />
    <el-empty v-else-if="!errorMessage" description="暂无经营数据"
      ><el-button @click="refreshDashboard">重新加载</el-button></el-empty
    >


    <CustomerAttributeAnalyticsDialog
      v-model="customerAttributesVisible"
      :query="employeeAnalyticsQuery"
      :scope-label="employeeAnalyticsScope"
    />
    <BiScopeSettings v-model="scopeSettingsVisible" @changed="refreshDashboard" />
    <CityProductReport
      v-model="cityProductReportVisible"
      :query="cityProductReportQuery"
      :product-categories="productCategories"
      :filter-options="cityProductReportOptions"
    />
    <el-drawer
      v-model="reconciliationCenterVisible"
      title="飞书数据对账"
      size="min(1280px, 98vw)"
      destroy-on-close
    >
      <BiReconciliationCenter
        v-if="reconciliationCenterVisible && effectiveScope?.globalGovernance"
        :from="queryFor(appliedFilters).from"
        :to="queryFor(appliedFilters).to"
      />
    </el-drawer>
    <el-drawer
      v-model="operationsVisible"
      title="经营目标与跟进"
      size="min(980px, 96vw)"
      destroy-on-close
    >
      <BiOperationsWorkbench
        v-if="operationsVisible"
        :initial-tab="operationsTab"
        :month="(appliedFilters.dateRange?.[1] || dateText(new Date())).slice(0, 7)"
        :region-code="operationsScope.regionCode"
        :owner-staff-code="operationsScope.ownerStaffCode"
        :regions="cityProductReportOptions.region"
        :sales-owners="cityProductReportOptions.owner"
        :action-seed="actionSeed"
        @changed="operationsChanged"
        @open-business="openActionBusiness"
      />
    </el-drawer>
    <el-drawer
      v-model="detailVisible"
      :title="activeFigure?.title || '数据明细'"
      size="min(1000px, 96vw)"
      destroy-on-close
    >
      <div class="detail-toolbar">
        <el-input
          v-model="detailSearch"
          clearable
          placeholder="搜索名称或数据"
          :prefix-icon="Search"
          aria-label="搜索明细"
        />
        <el-popover trigger="click" :width="320" placement="bottom-end">
          <template #reference
            ><el-button :icon="Grid" aria-label="选择导出表头">导出字段</el-button></template
          >
          <div class="detail-export-fields">
            <el-checkbox
              :model-value="detailExportColumns.length === availableDetailExportColumns.length"
              :indeterminate="
                detailExportColumns.length > 0 &&
                detailExportColumns.length < availableDetailExportColumns.length
              "
              @change="toggleDetailExportColumns"
              >全选</el-checkbox
            >
            <el-checkbox-group v-model="detailExportColumns" aria-label="导出表头">
              <el-checkbox
                v-for="column in availableDetailExportColumns"
                :key="column"
                :value="column"
                :disabled="column === '数据类型' && detailContainsSample"
                >{{ column }}</el-checkbox
              >
            </el-checkbox-group>
          </div>
        </el-popover>
        <el-button
          :icon="Download"
          :loading="detailExporting"
          :disabled="!detailExportColumns.length"
          @click="exportDetail"
          >导出 Excel</el-button
        >
      </div>
      <p v-if="activeFigure?.sample" class="detail-note">含样例数据；导出保留样例标记。</p>
      <p v-if="activeFigure?.note" class="detail-note">{{ activeFigure.note }}</p>
      <el-table :data="pagedDetailRows" stripe max-height="calc(100vh - 280px)">
        <el-table-column prop="name" label="名称" min-width="170" fixed
          ><template #default="scope"
            >{{ scope.row.name }}
            <el-tag v-if="scope.row.sample" size="small" type="warning">样例</el-tag></template
          ></el-table-column
        >
        <el-table-column
          v-for="column in detailColumns"
          :key="column"
          :label="column"
          min-width="125"
          ><template #default="scope">{{
            scope.row.cells[column] || '—'
          }}</template></el-table-column
        >
        <!-- @vue-generic {DetailRow} -->
        <el-table-column
          v-if="detailRows.some((row) => row.kind)"
          label="操作"
          :min-width="activeFigure?.comparison || activeFigure?.performance ? 235 : 145"
          fixed="right"
          ><template #default="scope"
            ><el-button
              v-if="scope.row.kind && !scope.row.sample"
              link
              type="primary"
              @click="openDetailRow(scope.row)"
              >{{ rowActionLabel(scope.row) }}</el-button
            ><el-button
              v-if="['city', 'sales'].includes(scope.row.kind || '')"
              link
              type="primary"
              @click="openOrders(scope.row)"
              >订单</el-button
            ><el-button
              v-if="
                (activeFigure?.comparison || activeFigure?.performance) &&
                ['city', 'sales'].includes(scope.row.kind || '')
              "
              link
              type="primary"
              @click="openCollectionScope(scope.row, 'customer')"
              >客户</el-button
            ><el-button
              v-if="
                (activeFigure?.comparison || activeFigure?.performance) &&
                ['city', 'sales'].includes(scope.row.kind || '')
              "
              link
              type="primary"
              @click="openCollectionScope(scope.row, 'payment-risk')"
              >回款跟进</el-button
            ><el-button
              v-if="canRegisterFollowup(scope.row)"
              link
              type="primary"
              @click="registerFollowup(scope.row)"
              >登记跟进</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="detailPage"
        :page-size="20"
        layout="total, prev, pager, next"
        :total="filteredDetailRows.length"
        class="detail-pagination"
      />
    </el-drawer>

    <el-drawer
      v-model="governanceVisible"
      title="指标口径与数据同步"
      size="min(780px, 96vw)"
      destroy-on-close
    >
      <el-tabs v-model="governanceTab">
        <el-tab-pane label="业务口径" name="definitions">
          <CockpitMetricGuide
            :entries="metricExplanations"
            :scope="methodologyScope"
            :focus="governanceFocus"
          />
        </el-tab-pane>
        <el-tab-pane label="源指标定义" name="source-definitions">
          <dl class="definition-list">
            <template v-for="item in overview?.definitions || []" :key="item.metricCode"
              ><dt>{{ item.metricName }}</dt>
              <dd>
                {{ item.formula }}<br />{{ item.source }}<br />{{ item.exclusionRule }}
              </dd></template
            >
          </dl>
          <p class="detail-note">
            经营结余＝销售额－经营成本，尚未覆盖全部财务调整项。成本分类、人力汇总、SKU损耗、活动数据中的样例独立标记；采购参考价毛利不等于财务净利润。
          </p>
        </el-tab-pane>
        <el-tab-pane v-if="effectiveScope?.globalGovernance" label="同步与核对" name="sync">
          <div v-if="canRefreshData" class="sync-toolbar">
            <el-select v-model="refreshMode" aria-label="同步范围"
              ><el-option
                v-for="mode in refreshModes"
                :key="mode.key"
                :label="mode.label"
                :value="mode.key" /></el-select
            ><el-button type="primary" :icon="Refresh" :loading="refreshing" @click="triggerRefresh"
              >同步最新数据</el-button
            >
          </div>
          <el-button :loading="reconciliationLoading" @click="loadReconciliation"
            >核对当前期间</el-button
          >
          <p class="detail-note">
            来源为已接收的导入快照，不代表飞书在线表格的当前版本。
            退款排除记录需结合导入结果核对，不能仅凭行数差异判定漏导。
          </p>
          <el-alert
            v-if="reconciliationError"
            :title="reconciliationError"
            type="error"
            :closable="false"
          />
          <p v-if="reconciliation" class="detail-note">
            核对结果：{{ reconciliation.status }} · {{ reconciliation.generatedAt }}
          </p>
          <el-table :data="reconciliation?.items || []">
            <el-table-column type="expand"
              ><template #default="scope"
                ><p class="detail-note">{{ scope.row.description }}</p>
                <p class="detail-note">
                  导入快照 {{ scope.row.sourceRowCount }} 行 / 业务
                  {{ scope.row.businessRowCount }} 行 / BI {{ scope.row.biRowCount }} 行
                </p>
                <p class="detail-note">
                  导入快照 {{ exactAmount(scope.row.sourceAmount) }} / 业务
                  {{ exactAmount(scope.row.businessAmount) }} / BI
                  {{ exactAmount(scope.row.biAmount) }}
                </p></template
              ></el-table-column
            >
            <el-table-column prop="subjectName" label="业务" min-width="115" />
            <el-table-column label="导入快照→业务差异" min-width="170"
              ><template #default="scope"
                >{{ scope.row.sourceBusinessRowDiff }} 行 /
                {{ exactAmount(scope.row.sourceBusinessAmountDiff) }}</template
              ></el-table-column
            >
            <el-table-column label="业务→BI差异" min-width="150"
              ><template #default="scope"
                >{{ scope.row.businessBiRowDiff }} 行 /
                {{ exactAmount(scope.row.businessBiAmountDiff) }}</template
              ></el-table-column
            >
            <el-table-column prop="status" label="状态" width="75" />
          </el-table>
          <el-alert v-if="trustError" :title="trustError" type="warning" :closable="false" />
          <dl v-if="dataTrust" class="definition-list">
            <template v-for="source in dataTrust.sources" :key="source.sourceCode"
              ><dt>{{ source.sourceName }} · {{ source.checkpointStatus }}</dt>
              <dd>
                水位 {{ source.checkpointWatermarkTime || '无' }} · 最近成功
                {{ source.lastSuccessTime || '无' }}<br />拉取 {{ source.pulledCount }} / 更新
                {{ source.upsertedCount }} / 跳过 {{ source.skippedCount }}<br />{{
                  source.failureReason || source.description
                }}
              </dd></template
            >
          </dl>
          <dl class="definition-list">
            <template v-for="source in overview?.freshness || []" :key="source.sourceCode"
              ><dt>{{ source.sourceName }} · {{ source.status }}</dt>
              <dd>
                {{ source.latestUpdatedTime || '暂无更新时间' }}<br />{{ source.description }}
              </dd></template
            >
          </dl>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </main>
</template>

<script setup lang="ts">
import {
  businessDate,
  businessDateRange,
  businessMonthRange,
  businessPeriodRange,
  BUSINESS_TIME_ZONE,
} from '@/utils/business-date'
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
  useId,
  watch,
} from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Aim,
  Close,
  Connection,
  Download,
  Filter,
  FullScreen,
  Grid,
  InfoFilled,
  Lock,
  Refresh,
  RefreshLeft,
  Search,
  Tickets,
} from '@element-plus/icons-vue'
import {
  createSupplyDashboardRefreshRun,
  getSupplyDashboardFilterOptions,
  getSupplyDashboardOverview,
  getSupplyDashboardOperatingAnalysis,
  type SupplyDashboardOperatingAnalysis,
  getSupplyDashboardDataTrust,
  getSupplyDashboardReconciliation,
  type SupplyDashboardOverview,
  type SupplyDashboardDataTrust,
  type SupplyDashboardQuery,
  type SupplyDashboardFilterOptions,
  type SupplyDashboardReconciliation,
  type SupplyDashboardRefreshSourceCode,
} from '@/api/core/bi'
import { getCrmCustomerAreas, getInternalCrmCustomer } from '@/api/core/crm'
import { getSalesOrder } from '@/api/core/order-sales'
import type { ErpProductCategoryView } from '@/api/core/erp-internal'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import ProductCategorySelect from '@/components/supply/ProductCategorySelect.vue'
import CockpitWorkspace from './components/CockpitWorkspace.vue'
import CockpitMetricGuide from './components/CockpitMetricGuide.vue'
import { buildMetricExplanations } from './cockpit-methodology'
import CityProductReport from './components/CityProductReport.vue'
import BiOperationsWorkbench from './components/BiOperationsWorkbench.vue'
import { biErrorMessage as errorText, biNeedsLogin } from './bi-error'
import BiReconciliationCenter from './components/BiReconciliationCenter.vue'
import BiScopeSettings from './components/BiScopeSettings.vue'
import { getBiEffectiveScope, type BiEffectiveScope } from '@/api/core/bi-access'
import type { BiAction, BiActionSeed } from '@/api/core/bi-operations'
import type { CityProductReportQuery } from '@/api/core/bi-city-product-report'
import { buildCockpitDetailExcel } from './cockpit-export'
import { loadReportDictionaries, reportSourceName } from './report-format'
import CustomerAttributeAnalyticsDialog from './components/CustomerAttributeAnalyticsDialog.vue'
import { getCityContactAnalytics, type CityContactAnalytics } from '@/api/core/bi-city-contacts'
import { cityContactFigure } from './cockpit-city-contacts'
import {
  buildCockpit,
  cockpitSections,
  unitName,
  type CockpitSection,
  type CockpitOptions,
  type DetailRow,
  type Figure,
  type CockpitAction,
} from './cockpit-model'
import { exactAmount } from './cockpit-charts'
import { concreteDimension, drillScope, supportsCategoryFilter } from './cockpit-scope'
import { analysisSections } from './cockpit-analysis'
import { cockpitLayout } from './cockpit-layout'
import { getBiComparison, type BiComparison } from '@/api/core/bi-comparison'
import { comparisonLabel, comparisonSections, growthFigure } from './cockpit-comparison'

interface Filters {
  dateRange: string[] | null
  regionCode: string
  ownerStaffCode: string
  customerTypeCode: string
  productCategoryId: string
  sourceSystemCode: string
}
type DimensionKey = Exclude<keyof Filters, 'dateRange'>
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const navigationStore = useNavigationStore()
const section = computed<CockpitSection>(() =>
  route.meta.dashboardSection === 'sales' && route.query.view === 'collection'
    ? 'sales-collection'
    : (String(route.meta.dashboardSection || 'overview') as CockpitSection),
)
const categoryFilterSupported = computed(() => supportsCategoryFilter(section.value))
const dashboardTitle = computed(() => cockpitSections[section.value] || cockpitSections.overview)
const emptyFilters = (): Filters => ({
  dateRange: currentRange('year'),
  regionCode: '',
  ownerStaffCode: '',
  customerTypeCode: '',
  productCategoryId: '',
  sourceSystemCode: '',
})
const filters = reactive<Filters>(emptyFilters())
const customerAttributesVisible = ref(false)
const cityContacts = ref<CityContactAnalytics | null>(null)
const cityContactError = ref('')
const employeeAnalyticsQuery = computed(() => {
  const { from, to, regionCode, ownerStaffCode } = queryFor(appliedFilters.value)
  return { from, to, regionCode, ownerStaffCode }
})
const employeeAnalyticsScope = computed(() => `${rangeLabel.value} · ${
  appliedFilters.value.regionCode ? filterDisplayValue('regionCode') : '全部城市'
} · ${appliedFilters.value.ownerStaffCode ? filterDisplayValue('ownerStaffCode') : '全部员工'}`)

const appliedFilters = ref<Filters>(emptyFilters())
const quickPeriod = ref('year')
const moreFilters = ref(false)
const expanded = ref(false)
const loading = ref(false)
const refreshing = ref(false)
const autoRefresh = ref(false)
const errorMessage = ref('')
const authenticationRequired = ref(false)
async function restoreLogin() {
  try {
    await authStore.login(route.fullPath)
  } catch (error) {
    errorMessage.value = errorText(error, '登录暂不可用，请稍后重试')
  }
}
const effectiveScope = ref<BiEffectiveScope>()
const reconciliationCenterVisible = ref(false)
const scopeSettingsVisible = ref(false)
const filterError = ref('')
const overview = ref<SupplyDashboardOverview | null>(null)
const operatingAnalysis = ref<SupplyDashboardOperatingAnalysis>()
const analysisError = ref('')
const comparison = ref<BiComparison>()
const comparisonError = ref('')
const comparisonPeriod = computed(() =>
  comparison.value
    ? `前期 ${businessDate(comparison.value.previousFrom)} 至 ${businessDate(comparison.value.previousTo)}；相邻等长订单期间，回款累计至当前快照。`
    : '',
)
const cityProductReportVisible = ref(false)
const productReportContext = ref<Partial<CityProductReportQuery>>({})
function openCityProductReport(row?: DetailRow) {
  if (row?.kind === 'product' && row.code?.toUpperCase() === 'UNKNOWN') {
    openDetailRow(row)
    return
  }
  productReportContext.value = {}
  if (row) {
    if (!row.code || !/^[1-9]\d*$/.test(row.code)) {
      ElMessage.warning('该项尚未关联有效的ERP档案，请先核对商品关联')
      return
    }
    const field = (
      {
        CATEGORY: 'productCategoryId',
        BRAND: 'brandId',
        PRODUCT: 'productId',
        SKU: 'skuId',
      } as const
    )[row.dimension || 'PRODUCT']
    productReportContext.value = {
      [field]: row.code,
      regionCode: concreteDimension(row.regionCode) || appliedFilters.value.regionCode || undefined,
    }
  }
  detailVisible.value = false
  cityProductReportVisible.value = true
}
const operationsVisible = ref(false)
const operationsTab = ref<'actions' | 'targets'>('actions')
const actionSeed = ref<BiActionSeed | null>(null)
const operationsScope = ref({ regionCode: '', ownerStaffCode: '' })
function openOperations(tab: 'actions' | 'targets', row?: DetailRow) {
  actionSeed.value = null
  operationsScope.value = {
    regionCode: row?.regionCode || appliedFilters.value.regionCode,
    ownerStaffCode: row?.ownerStaffCode || appliedFilters.value.ownerStaffCode,
  }
  operationsTab.value = tab
  operationsVisible.value = true
}
function operationsChanged(event: { type: 'actions' | 'targets' }) {
  if (event.type === 'targets') void refreshDashboard()
}
function canRegisterFollowup(row: DetailRow) {
  return (
    authStore.hasPermission('analytics:operations:write') &&
    !activeFigure.value?.sample &&
    !row.sample &&
    Boolean(row.code) &&
    ['customer', 'inventory'].includes(row.kind || '')
  )
}
function registerFollowup(row: DetailRow) {
  if (!canRegisterFollowup(row)) return
  operationsScope.value = {
    regionCode: row.regionCode || appliedFilters.value.regionCode,
    ownerStaffCode: row.ownerStaffCode || appliedFilters.value.ownerStaffCode,
  }
  actionSeed.value = {
    kind:
      row.kind === 'inventory'
        ? 'STOCK'
        : section.value === 'payment-risk'
          ? 'COLLECTION'
          : 'CUSTOMER',
    businessRef: `${row.kind === 'inventory' ? 'product-code' : 'customer-code'}:${row.code}`,
    businessLabel: row.name,
    cityCode: row.regionCode,
    employeeCode: row.ownerStaffCode,
    assignee: row.ownerStaffCode,
  }
  operationsTab.value = 'actions'
  detailVisible.value = false
  operationsVisible.value = true
}
async function openActionBusiness(action: BiAction) {
  try {
    operationsVisible.value = false
    if (action.kind === 'STOCK') {
      void router.push({
        path: '/supply-chain/erp/inventory/inventory',
        query: {
          productCode: action.businessRef.replace(/^product-code:/, ''),
          productName: action.businessLabel,
        },
      })
    } else if (
      action.businessRef.startsWith('customer-id:') ||
      action.businessRef.startsWith('customer-code:')
    ) {
      const customerCode = action.businessRef.startsWith('customer-id:')
        ? (await getInternalCrmCustomer(action.businessRef.slice(12))).customerCode
        : action.businessRef.slice(14)
      if (!customerCode) throw new Error('客户尚未具备可追溯业务编码')
      void router.push({
        path: '/supply-chain/crm/customers/profiles',
        query: {
          customerName: action.businessLabel,
          regionCode: action.cityCode || undefined,
          ownerStaffCode: action.employeeCode || undefined,
          customerCode,
        },
      })
    } else {
      if (!action.businessRef.startsWith('order-id:'))
        throw new Error('该跟进尚未关联可追溯业务单据')
      const order = await getSalesOrder(action.businessRef.slice(9))
      void router.push({
        name: 'SupplyOrderSalesOrders',
        query: {
          orderNo: order.orderNo,
          regionCode: action.cityCode || undefined,
          ownerEmployeeCode: action.employeeCode || undefined,
          drillLabel: action.businessLabel,
        },
      })
    }
  } catch (error) {
    ElMessage.error(errorText(error, '业务明细加载失败，请检查访问权限'))
  }
}
const cityProductReportQuery = computed(() => ({
  ...queryFor(appliedFilters.value),
  ...productReportContext.value,
}))
const emptyOptions = (): SupplyDashboardFilterOptions => ({
  regions: [],
  salesOwners: [],
  customerTypes: [],
  productCategories: [],
  sourceSystems: [],
})
const filterOptions = ref<SupplyDashboardFilterOptions>(emptyOptions())
const regionOptions = ref<SupplyDashboardFilterOptions['regions']>([])
const cityProductReportOptions = computed(() => {
  const options = (rows: SupplyDashboardFilterOptions['regions']) =>
    rows
      .filter((row) => concreteDimension(row.optionValue))
      .map((row) => ({ label: row.optionLabel, value: row.optionValue }))
  return {
    region: options(regionOptions.value),
    owner: options(filterOptions.value.salesOwners),
    customerType: options(filterOptions.value.customerTypes),
    source: options(filterOptions.value.sourceSystems),
  }
})
const chartOptions = reactive<CockpitOptions>({
  productDimension: 'PRODUCT',
  period: 'month',
  inventoryUnit: '',
  costGroup: '全部',
  rankingMetric: 'salesAmount',
})
const isInventory = computed(() => ['product-inventory', 'inventory-risk'].includes(section.value))
const inventoryUnits = computed(() => [
  ...new Set(
    [
      ...(overview.value?.inventoryItemSummary || []),
      ...(overview.value?.inventoryReplenishment || []),
    ]
      .map((row) => row.unitCode)
      .filter(Boolean),
  ),
])
watch(inventoryUnits, (units) => {
  if (!units.includes(chartOptions.inventoryUnit)) chartOptions.inventoryUnit = units[0] || ''
})
const inventoryFilterConflict = computed(
  () =>
    isInventory.value &&
    Boolean(
      appliedFilters.value.regionCode ||
      appliedFilters.value.ownerStaffCode ||
      appliedFilters.value.customerTypeCode ||
      appliedFilters.value.sourceSystemCode,
    ),
)
const model = computed(() =>
  overview.value
    ? buildCockpit(overview.value, section.value, {
        ...chartOptions,
        regionCode: concreteDimension(appliedFilters.value.regionCode),
        regionName: regionOptions.value.find(
          (row) => row.optionValue === appliedFilters.value.regionCode,
        )?.optionLabel,
        ownerStaffCode: concreteDimension(appliedFilters.value.ownerStaffCode),
        analysis: operatingAnalysis.value,
        unavailableSubjects: effectiveScope.value?.unavailableSubjects,
        inventoryScopeLimited: inventoryFilterConflict.value,
        targetScopeLimited: Boolean(
          appliedFilters.value.customerTypeCode ||
          appliedFilters.value.sourceSystemCode ||
          appliedFilters.value.productCategoryId,
        ),
        costScopeLimited: Boolean(
          appliedFilters.value.ownerStaffCode ||
          appliedFilters.value.customerTypeCode ||
          appliedFilters.value.sourceSystemCode,
        ),
      })
    : { figures: [], kpis: [], actions: [] },
)
const activeAnalysis = ref('monitor')
const workspaceId = `bi-workspace-${useId()}`
const workspaceDataVersion = ref(0)
watch(overview, () => {
  workspaceDataVersion.value += 1
})
// Inactive tabs retain UI state only within the same data and authorization scope.
const workspaceCacheKey = computed(() =>
  JSON.stringify([
    section.value,
    appliedFilters.value,
    effectiveScope.value,
    authStore.user?.id,
    authStore.user?.tenantId,
    authStore.user?.roles,
    authStore.user?.permissions,
    chartOptions,
    workspaceDataVersion.value,
  ]),
)
const layout = computed(() => cockpitLayout(section.value, [
  ...model.value.figures,
  ...(section.value === 'city-operating' ? [cityContactFigure(cityContacts.value, cityContactError.value)] : []),
]))
const headlineKpis = computed(() =>
  section.value === 'overview' ? model.value.kpis.slice(0, 4) : model.value.kpis,
)
const costKpis = computed(() => (section.value === 'overview' ? model.value.kpis.slice(4) : []))
const workspace = computed(() => {
  if (activeAnalysis.value === 'monitor') return layout.value
  const figures =
    analysisViews.value.find((view) => view.id === activeAnalysis.value)?.figures || []
  return {
    main: figures.filter((figure, index) => index === 0 || (!figure.compact && figure.span !== 4)),
    aside: figures.filter((figure, index) => index > 0 && (figure.compact || figure.span === 4)),
  }
})
const analysisViews = computed(() => [
  ...layout.value.groups,
  ...(comparison.value && comparison.value.previous.orderCount > 0
    ? [{ id: 'growth', label: '增长来源', figures: [growthFigure(comparison.value)] }]
    : []),
])
const workspaceTabs = computed(() => [
  { id: 'monitor', label: layout.value.label },
  ...analysisViews.value.map(({ id, label }) => ({ id, label })),
])
async function onAnalysisKeydown(event: KeyboardEvent) {
  const index = workspaceTabs.value.findIndex((tab) => tab.id === activeAnalysis.value)
  const count = workspaceTabs.value.length
  const next = {
    ArrowRight: (index + 1) % count,
    ArrowLeft: (index + count - 1) % count,
    Home: 0,
    End: count - 1,
  }[event.key]
  if (next == null) return
  event.preventDefault()
  const tablist = event.currentTarget as HTMLElement
  activeAnalysis.value = workspaceTabs.value[next].id
  await nextTick()
  tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
}
watch(
  [section, analysisViews],
  ([, views]) => {
    if (
      activeAnalysis.value !== 'monitor' &&
      !views.some((view) => view.id === activeAnalysis.value)
    )
      activeAnalysis.value = 'monitor'
  },
  { immediate: true },
)
const rangeLabel = computed(() => {
  if (section.value === 'activity') return '活动样例'
  const dates = appliedFilters.value.dateRange || []
  return dates.length === 2 ? `${dates[0]} 至 ${dates[1]}` : ''
})
const lastUpdated = computed(() => {
  const time = overview.value?.generatedAt
  return time
    ? new Date(time).toLocaleString('zh-CN', {
        timeZone: BUSINESS_TIME_ZONE,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : ''
})
const productCategories = computed<ErpProductCategoryView[]>(() =>
  filterOptions.value.productCategories.map((item, index) => ({
    id: item.optionValue,
    categoryCode: item.optionValue,
    categoryName: item.optionLabel,
    parentId: item.parentOptionValue || null,
    categoryLevel: item.categoryLevel ?? null,
    ordinal: item.ordinal ?? index,
    remark: null,
    revision: 0,
    createdBy: null,
    createdTime: '',
    updatedBy: null,
    updatedTime: '',
  })),
)
function filterDisplayValue(key: DimensionKey): string {
  const code = appliedFilters.value[key]
  if (!code) return '全部'
  const sources = {
    regionCode: regionOptions.value,
    ownerStaffCode: filterOptions.value.salesOwners,
    customerTypeCode: filterOptions.value.customerTypes,
    productCategoryId: filterOptions.value.productCategories,
    sourceSystemCode: filterOptions.value.sourceSystems,
  }
  return (
    sources[key].find((row) => String(row.optionValue) === String(code))?.optionLabel ||
    '名称未匹配'
  )
}
const scopeTags = computed(() => {
  const sources: [DimensionKey, string, SupplyDashboardFilterOptions['regions']][] = [
    ['regionCode', '城市', regionOptions.value],
    ['ownerStaffCode', '销售', filterOptions.value.salesOwners],
    ['customerTypeCode', '客户', filterOptions.value.customerTypes],
    ['productCategoryId', '分类', filterOptions.value.productCategories],
    ['sourceSystemCode', '来源', filterOptions.value.sourceSystems],
  ]
  return sources
    .filter(([key]) => appliedFilters.value[key])
    .map(([key, label, rows]) => ({
      key,
      label: `${label}：${rows.find((row) => String(row.optionValue) === String(appliedFilters.value[key]))?.optionLabel || '名称未匹配'}`,
    }))
})

const detailVisible = ref(false)
const detailExporting = ref(false)
const activeFigure = ref<Figure | null>(null)
const selectedRowKey = ref('')
const detailSearch = ref('')
const detailPage = ref(1)
const detailRows = computed(() => {
  const rows = activeFigure.value?.rows || []
  const selected = selectedRowKey.value
    ? rows.filter(
        (row) =>
          row.key === selectedRowKey.value ||
          row.period === selectedRowKey.value ||
          row.groupKey === selectedRowKey.value,
      )
    : rows
  return selected.length ? selected : rows
})
const detailColumns = computed(() => [
  ...new Set(detailRows.value.flatMap((row) => Object.keys(row.cells))),
])
const availableDetailExportColumns = computed(() => ['名称', '数据类型', ...detailColumns.value])
const detailExportColumns = ref<string[]>([])
const detailContainsSample = computed(() =>
  detailRows.value.some((row) => row.sample ?? activeFigure.value?.sample),
)
function toggleDetailExportColumns(checked: boolean | string | number) {
  detailExportColumns.value = checked
    ? [...availableDetailExportColumns.value]
    : detailContainsSample.value
      ? ['数据类型']
      : []
}
const filteredDetailRows = computed(() =>
  detailRows.value.filter((row) =>
    `${row.name} ${Object.values(row.cells).join(' ')}`
      .toLowerCase()
      .includes(detailSearch.value.toLowerCase()),
  ),
)
const pagedDetailRows = computed(() =>
  filteredDetailRows.value.slice((detailPage.value - 1) * 20, detailPage.value * 20),
)
watch(detailSearch, () => {
  detailPage.value = 1
})
function inspectFigure(figure: Figure, rowKey?: string, collectionPart?: 'paid' | 'unpaid') {
  const selected = figure.rows.find((row) => row.key === rowKey)
  if (selected && !figure.sample && !selected.sample && selected.kind) {
    if (selected.kind === 'product') {
      openCityProductReport(selected)
      return
    }
    if (collectionPart && ['city', 'sales'].includes(selected.kind)) {
      openCollectionScope(selected, collectionPart === 'unpaid' ? 'payment-risk' : 'customer')
      return
    }
    if (selected.kind === 'city' && section.value === 'payment-risk') {
      openCollectionScope(selected, 'customer')
      return
    }
    openDetailRow(selected)
    return
  }
  activeFigure.value =
    figure.comparison && selected && collectionPart
      ? {
          ...figure,
          title: `${selected.name} · ${collectionPart === 'unpaid' ? '待回款' : '已回款'}`,
        }
      : figure
  selectedRowKey.value = rowKey || ''
  detailSearch.value = ''
  detailPage.value = 1
  detailExportColumns.value = [...availableDetailExportColumns.value]
  detailVisible.value = true
}
function inspectAction(action: CockpitAction) {
  if (action.row?.kind === 'city' && action.section === 'payment-risk')
    openCollectionScope(action.row, 'payment-risk')
  else if (action.row && !action.row.sample) openDetailRow(action.row)
  else openSection(action.section)
}

const governanceVisible = ref(false)
const governanceTab = ref('definitions')
const governanceFocus = ref('')
const metricExplanations = computed(() =>
  overview.value
    ? buildMetricExplanations(
        overview.value,
        model.value.kpis,
        [
          ...layout.value.primary,
          ...analysisViews.value
            .flatMap((view) => view.figures)
            .filter((figure) => !model.value.figures.some((item) => item.id === figure.id)),
        ],
        { ...chartOptions, ownerStaffCode: appliedFilters.value.ownerStaffCode },
      )
    : [],
)
const methodologyScope = computed(
  () =>
    `${rangeLabel.value} · ${scopeTags.value.map((tag) => tag.label).join(' · ') || '当前账号授权范围'}`,
)
const reconciliation = ref<SupplyDashboardReconciliation | null>(null)
const reconciliationLoading = ref(false)
const reconciliationError = ref('')
const dataTrust = ref<SupplyDashboardDataTrust | null>(null)
const trustError = ref('')
const canRefreshData = computed(
  () =>
    Boolean(effectiveScope.value?.globalGovernance) &&
    authStore.hasPermission('analytics:refresh:write'),
)
const refreshMode = ref('all')
const refreshModes: { key: string; label: string; sources: SupplyDashboardRefreshSourceCode[] }[] =
  [
    {
      key: 'all',
      label: '全链路',
      sources: [
        'CRM_CUSTOMER',
        'ORDER_SALES_ORDER',
        'ORDER_SALES_ORDER_LINE',
        'ORDER_PAYMENT_RECORD',
        'ERP_PRODUCT',
        'ERP_STOCK_BALANCE',
        'ERP_INVENTORY_OPERATION',
        'BI_RECONCILIATION_CURRENT',
        'HR_EMPLOYEE',
        'SALES_SUBMITTED_VISIT',
      ],
    },
    {
      key: 'sales',
      label: '销售与回款',
      sources: [
        'ORDER_SALES_ORDER',
        'ORDER_SALES_ORDER_LINE',
        'ORDER_PAYMENT_RECORD',
        'BI_RECONCILIATION_CURRENT',
      ],
    },
    { key: 'customer', label: '客户', sources: ['CRM_CUSTOMER'] },
    { key: 'people-contacts', label: '员工与建联', sources: ['HR_EMPLOYEE', 'SALES_SUBMITTED_VISIT'] },
    {
      key: 'inventory',
      label: '商品与库存',
      sources: [
        'ERP_PRODUCT',
        'ERP_STOCK_BALANCE',
        'ERP_INVENTORY_OPERATION',
        'BI_RECONCILIATION_CURRENT',
      ],
    },
    {
      key: 'risk',
      label: '回款风险',
      sources: [
        'CRM_CUSTOMER',
        'ORDER_SALES_ORDER',
        'ORDER_PAYMENT_RECORD',
        'BI_RECONCILIATION_CURRENT',
      ],
    },
  ]
function openGovernance(focus = '') {
  governanceFocus.value = focus
  governanceTab.value = 'definitions'
  governanceVisible.value = true
  if (effectiveScope.value?.globalGovernance) void loadDataTrust()
}
function openMetricExplanation(figure: Figure) {
  openGovernance(`figure:${figure.id}`)
}
async function loadDataTrust() {
  trustError.value = ''
  try {
    dataTrust.value = await getSupplyDashboardDataTrust()
  } catch (error) {
    dataTrust.value = null
    trustError.value = errorText(error, '同步水位加载失败')
  }
}
async function loadReconciliation() {
  reconciliationLoading.value = true
  reconciliationError.value = ''
  try {
    reconciliation.value = await getSupplyDashboardReconciliation(queryFor(appliedFilters.value))
  } catch (error) {
    reconciliation.value = null
    reconciliationError.value = errorText(error, '对账结果加载失败')
  } finally {
    reconciliationLoading.value = false
  }
}
async function triggerRefresh() {
  if (refreshing.value || !canRefreshData.value) return
  refreshing.value = true
  try {
    const run = await createSupplyDashboardRefreshRun({
      sourceCodes: refreshModes.find((mode) => mode.key === refreshMode.value)?.sources,
      fullRefresh: true,
    })
    if (run.statusCode === 'SUCCESS' || run.upsertedCount > 0) {
      await refreshDashboard()
      await Promise.all([loadFilterOptions(), loadReconciliation(), loadDataTrust()])
      if (run.statusCode !== 'SUCCESS') ElMessage.warning(run.failureReason || '部分来源同步失败')
      else ElMessage.success('同步完成')
    } else ElMessage.warning(run.failureReason || '同步任务未完成')
  } catch (error) {
    ElMessage.error(errorText(error, '数据同步失败'))
  } finally {
    refreshing.value = false
  }
}

let requestSequence = 0
async function loadDashboard(source: Filters = filters) {
  const sequence = ++requestSequence
  const snapshot: Filters = {
    ...source,
    dateRange: source.dateRange ? [...source.dateRange] : null,
  }
  if (!categoryFilterSupported.value && snapshot.productCategoryId) {
    snapshot.productCategoryId = ''
    filters.productCategoryId = ''
    ElMessage.info('商品分类仅适用于商品、毛利和库存统计，当前专题已清除该条件')
  }
  loading.value = true
  errorMessage.value = ''
  authenticationRequired.value = false
  operatingAnalysis.value = undefined
  analysisError.value = ''
  cityContacts.value = null
  cityContactError.value = '正在加载 Sales 城市建联数据'
  comparison.value = undefined
  comparisonError.value = ''
  try {
    const access = await getBiEffectiveScope()
    if (sequence !== requestSequence) return
    effectiveScope.value = access
    if (access.accessLevel === 'DENIED')
      throw new Error(access.reason || '当前账号尚未具备可验证的经营数据范围')
    if (access.accessLevel !== 'TENANT') {
      snapshot.regionCode ||= access.defaultRegionCode || ''
      snapshot.ownerStaffCode ||= access.defaultOwnerStaffCode || ''
      if (
        !access.regionCodes.includes(snapshot.regionCode) ||
        (access.accessLevel === 'SELF' && snapshot.ownerStaffCode !== access.ownerStaffCode)
      )
        throw new Error('当前筛选超出账号授权范围，请重新选择城市或销售人员')
      filters.regionCode = snapshot.regionCode
      filters.ownerStaffCode = snapshot.ownerStaffCode
    }
    if (
      [snapshot.regionCode, snapshot.ownerStaffCode].some(
        (value) => value && !concreteDimension(value),
      )
    ) {
      throw new Error('城市或销售归属无效，请重新选择筛选条件')
    }
    const data = await getSupplyDashboardOverview(queryFor(snapshot))
    if (sequence !== requestSequence) return
    overview.value = data
    if (!snapshot.dateRange?.length) {
      snapshot.dateRange = [businessDate(data.from), businessDate(data.to)]
      filters.dateRange = [...snapshot.dateRange]
    }
    appliedFilters.value = snapshot
    reconciliation.value = null
    if (section.value === 'city-operating') {
      if (snapshot.customerTypeCode || snapshot.sourceSystemCode || snapshot.productCategoryId) {
        cityContactError.value = 'Sales 建联统计暂不支持客户类型、商品分类或订单来源筛选，请清除这些条件'
      } else {
        void getCityContactAnalytics(queryFor(snapshot))
          .then((result) => {
            if (sequence === requestSequence) { cityContacts.value = result; cityContactError.value = '' }
          })
          .catch((reason: unknown) => {
            if (sequence === requestSequence) cityContactError.value = errorText(reason, 'Sales 城市建联数据加载失败，请刷新重试')
          })
      }
    }

    if (comparisonSections.includes(section.value)) {
      void getBiComparison(queryFor(snapshot))
        .then((data) => {
          if (sequence === requestSequence) comparison.value = data
        })
        .catch((error: unknown) => {
          if (sequence === requestSequence)
            comparisonError.value = errorText(error, '前期比较加载失败')
        })
    }
    if (analysisSections.includes(section.value)) {
      void getSupplyDashboardOperatingAnalysis(queryFor(snapshot))
        .then((analysis) => {
          if (sequence === requestSequence) operatingAnalysis.value = analysis
        })
        .catch((error: unknown) => {
          if (sequence === requestSequence)
            analysisError.value = errorText(error, '补充分析加载失败')
        })
    }
  } catch (error) {
    if (sequence === requestSequence) {
      overview.value = null
      errorMessage.value = errorText(error, '经营数据加载失败，请重试')
      authenticationRequired.value = biNeedsLogin(error)
    }
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}
function refreshDashboard() {
  return loadDashboard(appliedFilters.value)
}
async function loadFilterOptions() {
  filterError.value = ''
  if (!effectiveScope.value || effectiveScope.value.accessLevel === 'DENIED') {
    filterOptions.value = emptyOptions()
    regionOptions.value = []
    return
  }
  const [optionsResult, regionsResult] = await Promise.allSettled([
    getSupplyDashboardFilterOptions(),
    effectiveScope.value.globalGovernance
      ? getCrmCustomerAreas({ begin: 0, step: 200 })
      : Promise.resolve({ items: [] }),
  ])
  if (optionsResult.status === 'fulfilled')
    filterOptions.value = {
      ...optionsResult.value,
      sourceSystems: optionsResult.value.sourceSystems.map((item) => ({
        ...item,
        optionLabel: reportSourceName(item.optionValue, item.optionLabel),
      })),
    }
  else filterError.value = '筛选选项加载失败，已加载数据仍可查看。'
  const regions = new Map(filterOptions.value.regions.map((row) => [row.optionValue, row]))
  if (regionsResult.status === 'fulfilled')
    regionsResult.value.items.forEach((row) => {
      if (row.code && !regions.has(row.code))
        regions.set(row.code, {
          optionType: 'REGION',
          optionValue: row.code,
          optionLabel: row.name || row.code,
          usageCount: 0,
        })
    })
  regionOptions.value = [...regions.values()]
}
function queryFor(value: Filters): SupplyDashboardQuery {
  const [from, to] = value.dateRange || []
  return {
    ...(from && to ? businessDateRange(from, to) : {}),
    regionCode: concreteDimension(value.regionCode),
    ownerStaffCode: concreteDimension(value.ownerStaffCode),
    customerTypeCode: value.customerTypeCode || undefined,
    productCategoryId:
      categoryFilterSupported.value && Number(value.productCategoryId) > 0
        ? value.productCategoryId
        : undefined,
    sourceSystemCode: value.sourceSystemCode || undefined,
  }
}
function dateText(value: Date) {
  return businessDate(value)
}
function currentRange(period: string) {
  return businessPeriodRange(period)
}
function applyQuickPeriod() {
  filters.dateRange = quickPeriod.value === 'latest' ? [] : currentRange(quickPeriod.value)
  void loadDashboard()
}
function resetFilters() {
  Object.assign(filters, emptyFilters())
  quickPeriod.value = 'year'
  void loadDashboard()
}
function clearDimension(key: DimensionKey) {
  filters[key] = ''
  void loadDashboard()
}
function clearInventoryFilters() {
  filters.regionCode = ''
  filters.ownerStaffCode = ''
  filters.customerTypeCode = ''
  filters.sourceSystemCode = ''
  void loadDashboard()
}
function scopeQuery() {
  const f = appliedFilters.value
  return {
    from: f.dateRange?.[0],
    to: f.dateRange?.[1],
    regionCode: f.regionCode || undefined,
    ownerStaffCode: f.ownerStaffCode || undefined,
    customerTypeCode: f.customerTypeCode || undefined,
    productCategoryId: f.productCategoryId || undefined,
    sourceSystemCode: f.sourceSystemCode || undefined,
  }
}
function openSection(target: CockpitSection, overrides: Record<string, string | undefined> = {}) {
  const path = target === 'overview' ? '/supply-chain/bi' : `/supply-chain/bi/${target}`
  const fallback = target === 'sales-collection' && !navigationStore.hasPath('SUPPLY_CHAIN', path)
  const accessiblePath = fallback ? '/supply-chain/bi/sales' : path
  if (!navigationStore.hasPath('SUPPLY_CHAIN', accessiblePath)) {
    ElMessage.warning('当前账号未获该专题访问权限')
    return
  }
  detailVisible.value = false
  void router.push({
    path: accessiblePath,
    query: { ...scopeQuery(), ...(fallback ? { view: 'collection' } : {}), ...overrides },
  })
}
function rowActionLabel(row: DetailRow) {
  if (row.kind === 'product' && row.code?.toUpperCase() === 'UNKNOWN') return '核对商品关联'
  if (row.kind === 'product' && row.dimension === 'CATEGORY') return '商品分析'
  if (row.kind === 'product' && row.dimension === 'BRAND') return '品牌商品'
  if (row.kind === 'product') return '销量与回款'
  return (
    (
      {
        city: '城市经营',
        sales: '销售分析',
        product: '查看订单',
        customer: '客户跟进',
        inventory: '查看库存',
        orders: '查看订单',
        receipt: '查看回款',
        cost: '成本分析',
        target: '目标缺口',
        activity: '活动明细',
      } as Record<string, string>
    )[row.kind || ''] || '查看'
  )
}
function openCollectionScope(row: DetailRow, target: 'customer' | 'payment-risk') {
  const scope = resolveRowScope(row)
  if (!scope) return
  openSection(target, {
    regionCode: scope.regionCode || undefined,
    ownerStaffCode: scope.ownerStaffCode || undefined,
  })
}
function resolveRowScope(row: DetailRow) {
  const scope = drillScope(row, appliedFilters.value)
  if (!scope) ElMessage.warning('该汇总尚未绑定有效城市或销售人员，请先补齐业务归属')
  return scope
}
function periodRange(period?: string) {
  const scope = appliedFilters.value.dateRange || []
  let dates = scope
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    dates = businessMonthRange(period)
  } else if (period && /^\d{4}-\d{2}-\d{2}$/.test(period)) dates = [period, period]
  return [
    scope[0] && scope[0] > dates[0] ? scope[0] : dates[0],
    scope[1] && scope[1] < dates[1] ? scope[1] : dates[1],
  ]
}
function orderQuery(row: DetailRow): LocationQueryRaw | null {
  const scope = resolveRowScope(row)
  if (!scope) return null
  const dates = periodRange(row.period)
  return {
    orderDateFrom: dates[0],
    orderDateTo: dates[1],
    regionCode: scope.regionCode || undefined,
    ownerEmployeeCode: scope.ownerStaffCode || undefined,
    drillLabel: row.name,
  }
}
function warnOrderScope() {
  if (
    appliedFilters.value.productCategoryId ||
    appliedFilters.value.customerTypeCode ||
    appliedFilters.value.sourceSystemCode
  )
    ElMessage.warning(
      '订单明细仅沿用日期、城市、销售和具体商品条件；分类、客户类型、来源筛选以看板导出为准。',
    )
}
function openOrders(row: DetailRow) {
  const query = orderQuery(row)
  if (!query) return
  warnOrderScope()
  void router.push({ name: 'SupplyOrderSalesOrders', query })
}
function openDetailRow(row: DetailRow) {
  if (row.sample) return
  if (row.kind === 'city') {
    const scope = resolveRowScope(row)
    if (scope) openSection('city-operating', { regionCode: scope.regionCode || row.code })
    return
  }
  if (row.kind === 'sales') {
    const scope = resolveRowScope(row)
    if (!scope) return
    openSection('sales', {
      ownerStaffCode: scope.ownerStaffCode || row.code,
      regionCode: scope.regionCode || undefined,
    })
    return
  }
  if (row.kind === 'cost') {
    openSection('city-cost')
    return
  }
  if (row.kind === 'target') {
    detailVisible.value = false
    openOperations('targets', row)
    return
  }
  if (row.kind === 'customer') {
    void router.push({
      path: '/supply-chain/crm/customers/profiles',
      query: {
        customerCode: row.code,
        customerName: row.name,
        regionCode: row.regionCode || undefined,
        ownerStaffCode: row.ownerStaffCode || undefined,
      },
    })
    return
  }
  if (row.kind === 'inventory') {
    void router.push({
      path: '/supply-chain/erp/inventory/inventory',
      query: { productCode: row.code, productName: row.name },
    })
    return
  }
  if (row.kind === 'receipt') {
    const dates = periodRange(row.period)
    void router.push({
      name: 'SupplyOrderSalesPayments',
      query: {
        paymentTimeFrom: dates[0],
        paymentTimeTo: dates[1],
        collectorStaffCode: appliedFilters.value.ownerStaffCode || undefined,
      },
    })
    return
  }
  if (row.kind === 'product') {
    if (row.code?.toUpperCase() === 'UNKNOWN') {
      const query = orderQuery(row)
      if (!query) return
      warnOrderScope()
      detailVisible.value = false
      cityProductReportVisible.value = false
      void router.push({
        name: 'SupplyOrderSalesOrders',
        query: {
          ...query,
          dataQualityStatusCode: 'NEEDS_REVIEW',
          drillLabel: '待完善订单（含商品关联待核对，范围可能大于看板）',
        },
      })
      return
    }
    if (row.code && /^[1-9]\d*$/.test(row.code)) {
      openCityProductReport(row)
      return
    }
    if (row.dimension === 'CATEGORY') {
      ElMessage.info('该分类尚未绑定 ERP 分类档案')
      return
    }
    if (row.dimension === 'BRAND') {
      ElMessage.info('该品牌尚未绑定 ERP 品牌档案，暂不能查看品牌商品')
      return
    }
    const code = String(row.code || '')
    const query = orderQuery(row)
    if (!query) return
    if (row.dimension === 'SKU') {
      if (/^\d+$/.test(code)) query.productVariantId = code
      else {
        query.skuCodeSnapshot = code
        const [name, ...specification] = row.name.split('/')
        query.productNameSnapshot = name.trim()
        query.specificationSnapshot = specification.join('/').trim() || undefined
      }
    } else if (/^\d+$/.test(code)) query.productId = code
    else {
      query.productCodeSnapshot = code
      query.productNameSnapshot = row.name
    }
    warnOrderScope()
    void router.push({ name: 'SupplyOrderSalesOrders', query })
    return
  }
  openOrders(row)
}
function resolveEmpty(action: NonNullable<Figure['emptyAction']>) {
  if (action === 'cost') {
    openSection('city-cost', {
      ownerStaffCode: undefined,
      customerTypeCode: undefined,
      sourceSystemCode: undefined,
      productCategoryId: undefined,
    })
    return
  }
  if (action === 'reset') {
    resetFilters()
    return
  }
  if (action === 'target') {
    detailVisible.value = false
    openOperations('targets')
    return
  }
  if (action === 'inventory' && inventoryFilterConflict.value) {
    clearInventoryFilters()
    return
  }
  const paths = {
    inventory: '/supply-chain/erp/inventory/inventory',
    product: '/supply-chain/erp/master-data/products',
  }
  void router.push({ path: paths[action] })
}
async function exportDetail() {
  if (detailExporting.value) return
  detailExporting.value = true
  try {
    const result = await buildCockpitDetailExcel({
      title: `${activeFigure.value?.title || 'BI'}-${appliedFilters.value.dateRange?.join('_') || ''}`,
      rows: filteredDetailRows.value,
      columns: detailColumns.value,
      selectedColumns: [...detailExportColumns.value],
      sample: activeFigure.value?.sample,
      note: activeFigure.value?.note,
      scope: [
        ['城市', filterDisplayValue('regionCode')],
        ['销售', filterDisplayValue('ownerStaffCode')],
        ['客户类型', filterDisplayValue('customerTypeCode')],
        ['来源', filterDisplayValue('sourceSystemCode')],
        ['商品分类', filterDisplayValue('productCategoryId')],
        ['明细搜索', detailSearch.value],
      ],
    })
    const url = URL.createObjectURL(
      new Blob([result.bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Excel导出失败，请重试')
  } finally {
    detailExporting.value = false
  }
}
function syncRouteFilters() {
  const string = (value: unknown) => (typeof value === 'string' ? value : '')
  const query = route.query
  Object.assign(filters, emptyFilters())
  quickPeriod.value = 'year'
  if (query.from && query.to) {
    filters.dateRange = [string(query.from), string(query.to)]
    quickPeriod.value = 'custom'
  }
  const keys: DimensionKey[] = [
    'regionCode',
    'ownerStaffCode',
    'customerTypeCode',
    'productCategoryId',
    'sourceSystemCode',
  ]
  keys.forEach((key) => {
    if (key in query) filters[key] = string(query[key])
  })
}
let refreshTimer: ReturnType<typeof setInterval> | undefined
function stopTimer() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = undefined
}
function startTimer() {
  stopTimer()
  if (autoRefresh.value)
    refreshTimer = setInterval(() => {
      if (!document.hidden && !loading.value && !refreshing.value) void refreshDashboard()
    }, 60000)
}
watch(autoRefresh, startTimer)
watch(
  () => route.fullPath,
  () => {
    if (route.meta.dashboardSection) {
      detailVisible.value = false
      syncRouteFilters()
      void loadDashboard()
    }
  },
)
onMounted(() => {
  void loadReportDictionaries()
  syncRouteFilters()
  void loadDashboard().then(() => loadFilterOptions())
})
onActivated(startTimer)
onDeactivated(stopTimer)
onBeforeUnmount(() => {
  stopTimer()
  requestSequence += 1
})
</script>

<style scoped lang="scss">
.bi-cockpit {
  background: #fff;
  color: #203049;
  min-width: 0;
  padding: 0 24px 20px;
  letter-spacing: 0;
}
.bi-cockpit--expanded {
  position: fixed;
  inset: 0;
  z-index: 1900;
  overflow: auto;
}
.cockpit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 18px 0 12px;
}
.cockpit-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
h1 {
  font-size: 22px;
  line-height: 1.5;
  font-weight: 650;
  margin: 0;
}
.live-dot {
  width: 7px;
  height: 7px;
  background: #18a999;
  border-radius: 50%;
}
.live-dot--error {
  background: #e26470;
}
.scope-date,
.updated-time {
  font-size: 11px;
  color: #68758a;
}
.cockpit-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}
.cockpit-tools :deep(.el-button + .el-button) {
  margin-left: 0;
}
.cockpit-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 0 0 14px;
  border-bottom: 1px solid #e4eaf2;
}
.date-filter {
  flex: 0 0 280px;
  width: 280px;
  min-width: 0;
}
.date-filter :deep(.el-date-editor) {
  width: 100%;
  box-sizing: border-box;
}
.dimension-filter {
  width: 145px;
}
.extended-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  flex-basis: 100%;
  padding-top: 5px;
}
.extended-filters > * {
  width: 180px;
}
.scope-tags {
  padding: 8px 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cockpit-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  padding: 18px 0;
  gap: 0;
}
.cockpit-kpi {
  font: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  border-right: 1px solid #e4eaf2;
  padding: 0 24px;
  min-width: 0;
  color: inherit;
}
.cockpit-kpi:first-child {
  padding-left: 0;
}
.cockpit-kpi:last-child {
  border-right: 0;
}
.kpi-comparison {
  display: block;
  margin-top: 5px;
  color: #52657c;
  font-size: 12px;
  line-height: 1.5;
}
.cockpit-kpi > span {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #637085;
}
.cockpit-kpi strong {
  display: block;
  font-size: 32px;
  line-height: 1.5;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--metric-color);
  overflow-wrap: anywhere;
}
.cockpit-kpi--link {
  cursor: pointer;
}
.cockpit-kpi__value {
  border: 0;
  padding: 0;
  background: transparent;
  font: inherit;
  text-align: left;
  max-width: 100%;
}
.metric-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  background: transparent;
  color: #667085;
  cursor: pointer;
}
.metric-info:focus-visible,
.cockpit-kpi__value:focus-visible {
  outline: 2px solid #2864e8;
  outline-offset: 2px;
}
.sample-label {
  color: #a86c15;
  background: #fff5df;
  font-size: 10px;
  padding: 1px 4px;
  font-weight: 500;
}
.workspace-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}
.workspace-tabs {
  flex: 1;
  min-width: 0;
  display: flex;
  overflow-x: auto;
}
.workspace-tabs [role='tab'] {
  min-height: 48px;
  flex: 0 0 auto;
  font-size: 14px;
  padding: 0 18px;
  font-family: inherit;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #637085;
  cursor: pointer;
}
.workspace-tabs [role='tab'][aria-selected='true'] {
  color: #2864e8;
  border-bottom-color: #2864e8;
}
.workspace-navigation__tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.inventory-unit {
  width: 100px;
}
.cost-readings {
  display: flex;
  align-items: baseline;
  gap: 38px;
  margin: 2px 0 6px;
}
.cost-readings button {
  display: flex;
  align-items: baseline;
  gap: 12px;
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  cursor: pointer;
}
.cost-readings span {
  font-size: 12px;
  color: #627185;
}
.cost-readings strong {
  font-size: 23px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}
.load-error {
  margin: 12px 0;
}
.filter-error,
.inventory-scope-notice {
  padding: 8px 22px;
  font-size: 12px;
  color: #9b6419;
}
.initial-loading {
  min-height: 580px;
}
.detail-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}
.detail-toolbar .el-input {
  max-width: 330px;
}
.detail-export-fields .el-checkbox-group {
  display: flex;
  flex-direction: column;
  max-height: 360px;
  overflow: auto;
}
.detail-export-fields :deep(.el-checkbox__label) {
  white-space: normal;
  overflow-wrap: anywhere;
}
.detail-note {
  font-size: 12px;
  line-height: 1.7;
  color: #68758a;
}
.detail-pagination {
  margin-top: 18px;
  justify-content: flex-end;
}
.definition-list dt {
  margin-top: 20px;
  font-size: 14px;
  font-weight: 650;
}
.definition-list dd {
  margin: 7px 0 0;
  font-size: 12px;
  line-height: 1.8;
  color: #68758a;
}
.sync-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.sync-toolbar .el-select {
  width: 190px;
}
button:focus-visible {
  outline: 2px solid #2864e8;
  outline-offset: 3px;
}
@media (max-width: 1100px) {
  .cockpit-kpis {
    grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
    gap: 14px 0;
  }
  .cockpit-kpi strong {
    font-size: 24px;
  }
  .updated-time {
    display: none;
  }
}
@media (max-width: 720px) {
  .bi-cockpit {
    padding: 0 12px 12px;
  }
  .cockpit-header {
    padding: 12px 0;
  }
  h1 {
    font-size: 18px;
  }
  .cockpit-filters {
    padding: 0 0 12px;
    gap: 8px;
  }
  .date-filter {
    max-width: 100%;
    flex-basis: 100%;
  }
  .dimension-filter {
    flex: 1 1 120px;
    min-width: 0;
  }
  .cockpit-kpis {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    padding: 16px 0;
  }
  .cockpit-kpi {
    padding: 0 12px;
  }
  .cockpit-kpi strong {
    font-size: 20px;
  }
  .workspace-navigation {
    flex-wrap: wrap;
    gap: 0;
  }
  .workspace-tabs {
    flex-basis: 100%;
  }
  .workspace-navigation__tools {
    padding-bottom: 10px;
  }
  .cost-readings {
    gap: 16px;
    flex-wrap: wrap;
  }
  .cost-readings button {
    gap: 8px;
  }
  .cost-readings strong {
    font-size: 19px;
  }
  .scope-date {
    flex-basis: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
</style>
