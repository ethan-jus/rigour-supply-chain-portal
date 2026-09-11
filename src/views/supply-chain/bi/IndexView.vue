<template>
  <div class="supply-bi-page supply-page" :class="`supply-bi-page--${dashboardSection}`">
    <section class="filter-panel">
      <div class="bi-filter-head">
        <div class="bi-filter-title">
          <strong>{{ dashboardTitle }}</strong>
          <span>{{ dashboardDescription }}</span>
        </div>
        <div class="bi-filter-tools">
          <div v-if="showQuickPeriodBar" class="quick-period-bar">
            <span>经营周期</span>
            <el-radio-group v-model="quickPeriod" size="small" @change="applyQuickPeriod">
              <el-radio-button value="latest">最新数据</el-radio-button>
              <el-radio-button value="today">今日</el-radio-button>
              <el-radio-button value="month">本月</el-radio-button>
              <el-radio-button value="year">本年</el-radio-button>
            </el-radio-group>
          </div>
          <div class="bi-filter-meta">
            <span>更新 {{ formatTime(latestBusinessDataTime) }}</span>
            <el-popover
              v-if="canRefreshData"
              v-model:visible="refreshPanelVisible"
              placement="bottom-end"
              width="min(560px, calc(100vw - 32px))"
              trigger="click"
              :teleported="false"
            >
              <template #reference>
                <el-button
                  class="bi-refresh-button"
                  size="small"
                  type="primary"
                  plain
                  :icon="Refresh"
                  :loading="refreshing"
                >
                  同步最新数据
                </el-button>
              </template>
              <div class="bi-sync-panel">
                <div class="bi-sync-panel__head">
                  <div>
                    <span>手动入口</span>
                    <strong>同步{{ selectedRefreshMode.label }}</strong>
                    <p>{{ selectedRefreshMode.description }}</p>
                  </div>
                  <el-button
                    size="small"
                    type="primary"
                    :loading="refreshing"
                    @click="triggerRefresh"
                  >
                    同步{{ selectedRefreshMode.label }}
                  </el-button>
                </div>
                <div class="bi-sync-scope-options" role="group" aria-label="BI同步范围">
                  <button
                    v-for="mode in refreshModes"
                    :key="mode.key"
                    type="button"
                    :class="['bi-sync-scope-option', { 'bi-sync-scope-option--active': selectedRefreshModeKey === mode.key }]"
                    :disabled="refreshing"
                    @click="selectRefreshMode(mode.key)"
                  >
                    <strong>{{ mode.label }}</strong>
                    <span>{{ mode.summary }}</span>
                  </button>
                </div>
                <div class="bi-sync-steps">
                  <span v-for="step in selectedRefreshMode.steps" :key="step">{{ step }}</span>
                </div>
                <div class="bi-sync-reconciliation">
                  <div class="bi-sync-reconciliation__head">
                    <strong>同步核对</strong>
                    <el-tag size="small" :type="reconciliationStatusTagType">{{ reconciliationStatusLabel }}</el-tag>
                  </div>
                  <div v-if="reconciliationLoading" class="bi-sync-reconciliation__empty">核对中...</div>
                  <div v-else-if="reconciliationIssueRows.length" class="bi-sync-reconciliation__list">
                    <div v-for="item in reconciliationIssueRows.slice(0, 4)" :key="item.subjectCode" class="bi-sync-reconciliation__item">
                      <strong>{{ item.subjectName }}</strong>
                      <span>
                        源/业务 {{ formatSignedCount(item.sourceBusinessRowDiff) }} 条，业务/BI {{ formatSignedCount(item.businessBiRowDiff) }} 条，
                        源/业务金额 {{ formatSignedMoney(item.sourceBusinessAmountDiff) }}，业务/BI金额 {{ formatSignedMoney(item.businessBiAmountDiff) }}
                      </span>
                    </div>
                  </div>
                  <div v-else class="bi-sync-reconciliation__empty">{{ reconciliationEmptyText }}</div>
                </div>
              </div>
            </el-popover>
          </div>
        </div>
      </div>
      <el-form :model="filters" inline @submit.prevent="loadDashboard">
        <el-form-item class="bi-filter-item--date" label="日期范围">
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            range-separator="至"
            style="width: 260px"
            @change="markCustomPeriod"
          />
        </el-form-item>
        <el-form-item label="城市">
          <el-select v-model="filters.regionCode" filterable clearable placeholder="全部城市" style="width: 160px">
            <el-option
              v-for="option in regionFilterOptions"
              :key="option.optionValue"
              :label="regionOptionLabel(option)"
              :value="option.optionValue"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="销售">
          <el-select v-model="filters.ownerStaffCode" filterable clearable placeholder="全部销售" style="width: 160px">
            <el-option
              v-for="option in filterOptions.salesOwners"
              :key="option.optionValue"
              :label="staffOptionLabel(option)"
              :value="option.optionValue"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="客户类型">
          <el-select v-model="filters.customerTypeCode" filterable clearable placeholder="全部类型" style="width: 150px">
            <el-option
              v-for="option in filterOptions.customerTypes"
              :key="option.optionValue"
              :label="customerTypeOptionLabel(option)"
              :value="option.optionValue"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="商品分类">
          <ProductCategorySelect
            v-model="filters.productCategoryId"
            :categories="productCategoryOptions"
            placeholder="全部分类"
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item label="订单来源">
          <el-select v-model="filters.sourceSystemCode" filterable clearable placeholder="全部来源" style="width: 150px">
            <el-option
              v-for="option in filterOptions.sourceSystems"
              :key="option.optionValue"
              :label="option.optionLabel"
              :value="option.optionValue"
            />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :icon="Search" :loading="loading" native-type="submit">查询</el-button>
          <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <el-alert
      v-if="errorMessage"
      class="dashboard-alert"
      type="error"
      :title="errorMessage"
      show-icon
      :closable="false"
    />

    <section v-if="isOverviewSection" class="overview-command-center" v-loading="loading">
      <div class="overview-command-headline">
        <div>
          <span>经营总览驾驶舱</span>
          <strong>{{ rangeLabel }}</strong>
          <small>首屏只放总 KPI、趋势小图和风险入口；明细进入下级看板。</small>
        </div>
        <div class="overview-command-headline__meta">
          <span>{{ currentMonthTimeline.label }}</span>
          <strong>{{ formatPercent(currentMonthTimeline.rate) }}</strong>
          <small>数据更新 {{ formatTime(latestBusinessDataTime) }}</small>
        </div>
      </div>
      <div class="overview-cockpit-layout">
        <div class="overview-kpi-cluster">
          <button
            v-for="card in overviewKpiCards"
            :key="card.key"
            class="overview-kpi-card"
            :class="`overview-kpi-card--${card.tone}`"
            type="button"
            @click="openDashboardSection(card.section)"
          >
            <span class="overview-kpi-card__label">{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <small>{{ card.summary }}</small>
            <EchartsChart
              class="bi-chart overview-kpi-sparkline"
              :option="card.chartOption"
              :height="52"
              :loading="loading"
            />
            <em>{{ card.actionLabel }}</em>
          </button>
        </div>
        <button
          class="overview-risk-entry"
          :class="`overview-risk-entry--${paymentRiskLevelCode}`"
          type="button"
          @click="openDashboardSection('payment-risk')"
        >
          <span class="overview-risk-entry__eyebrow">风险入口</span>
          <strong>回款{{ paymentRiskLevelLabel }}</strong>
          <div class="overview-risk-entry__amount">
            <span>待回款</span>
            <b>{{ formatMoneyWan(unpaidAmountMetric?.value) }}</b>
          </div>
          <div class="overview-risk-entry__metrics">
            <span>
              <small>回款率</small>
              <b>{{ formatPercent(overviewPaidRate) }}</b>
            </span>
            <span>
              <small>风险金额</small>
              <b>{{ formatMoneyWan(paymentRiskAmountMetric?.value) }}</b>
            </span>
            <span>
              <small>风险客户</small>
              <b>{{ formatNumber(paymentRiskCustomerMetric?.value) }}</b>
            </span>
          </div>
          <em><i :style="{ width: `${boundedPercent(overviewPaidRate)}%` }" /></em>
          <small>进入风险看板查看城市、销售和订单跟进范围</small>
        </button>
      </div>
      <div class="overview-focus-row">
        <div class="overview-customer-funnel">
          <div class="overview-focus-head">
            <strong>客户转化漏斗</strong>
            <span>建联 → 合作 → 复购</span>
          </div>
          <div class="overview-funnel-bars">
            <div
              v-for="item in overviewCustomerFunnelRows"
              :key="item.key"
              class="overview-funnel-row"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <em><i :style="{ width: `${item.percent}%` }" /></em>
            </div>
          </div>
        </div>
        <div class="overview-business-share">
          <div class="overview-focus-head">
            <strong>业务占比</strong>
            <span>{{ overviewShareDescription }}</span>
            <el-radio-group v-model="overviewShareMode" class="overview-share-mode" size="small">
              <el-radio-button value="CITY">城市</el-radio-button>
              <el-radio-button value="CATEGORY">分类</el-radio-button>
              <el-radio-button value="BRAND">品牌</el-radio-button>
              <el-radio-button value="SOURCE">来源</el-radio-button>
            </el-radio-group>
          </div>
          <div v-if="overviewBusinessShareDisplayRows.length" class="overview-business-share__body">
            <EchartsChart
              class="bi-chart overview-business-share__chart"
              :option="overviewBusinessShareChartOption"
              :height="220"
              :loading="loading"
              @chart-click="handleOverviewBusinessShareChartClick"
            />
            <div class="overview-business-share__list">
              <button
                v-for="row in overviewBusinessShareDisplayRows"
                :key="`${row.dimensionCode || row.dimensionName}-${row.rankType || overviewShareMode}`"
                class="overview-business-share-item"
                :class="{ 'is-muted': row.isOther }"
                :disabled="row.isOther"
                type="button"
                @click="handleOverviewBusinessShareEntryClick(row)"
              >
                <span class="overview-business-share-item__main">
                  <i :style="{ background: row.color }" />
                  <b>{{ row.dimensionName || row.dimensionCode || '未分组' }}</b>
                </span>
                <span class="overview-business-share-item__meta">
                  <strong>{{ formatPercent(row.percent) }}</strong>
                  <small>{{ formatMoneyWan(row.salesAmount) }}</small>
                </span>
                <em><i :style="{ width: `${boundedPercent(row.percent)}%`, background: row.color }" /></em>
              </button>
            </div>
          </div>
          <div v-else class="empty-inline">暂无业务占比数据</div>
        </div>
        <div class="overview-drill-grid">
          <button
            v-for="entry in overviewModuleEntrances"
            :key="entry.section"
            class="overview-drill-card"
            :class="`overview-drill-card--${entry.tone}`"
            type="button"
            @click="openDashboardSection(entry.section)"
          >
            <span class="overview-drill-card__icon">
              <el-icon><component :is="entry.icon" /></el-icon>
            </span>
            <span class="overview-drill-card__body">
              <strong>{{ entry.title }}</strong>
              <small>{{ entry.summary }}</small>
            </span>
            <em>{{ entry.value }}</em>
          </button>
        </div>
      </div>
      <div class="overview-operating-grid">
        <div class="overview-operating-panel overview-operating-panel--trend">
          <div class="overview-operating-head">
            <div>
              <strong>销售与回款趋势</strong>
              <span>{{ salesCollectionTrendDescription }}</span>
            </div>
            <el-button link type="primary" @click="openDashboardSection('sales-collection')">看完整趋势</el-button>
          </div>
          <EchartsChart
            v-if="hasOverviewTrend"
            class="bi-chart overview-business-trend"
            :option="overviewBusinessTrendChartOption"
            :height="260"
            :loading="loading"
            @chart-click="handleTrendChartClick"
          />
          <div v-else class="empty-inline">暂无销售与回款趋势数据</div>
        </div>
        <div class="overview-operating-panel overview-operating-panel--city-table">
          <div class="overview-operating-head">
            <div>
              <strong>城市经营总表</strong>
              <span>一个表看城市销售、回款、目标和风险，点击城市进入城市看板</span>
            </div>
            <el-button link type="primary" @click="openDashboardSection('city-operating')">看全部城市</el-button>
          </div>
          <el-table
            class="city-business-table supply-scroll-table"
            :data="overviewCityBusinessRows"
            size="small"
            max-height="340"
            @row-click="selectCityRankingItem"
          >
            <el-table-column prop="dimensionName" label="城市" min-width="128" fixed sortable show-overflow-tooltip>
              <template #default="scope">
                <strong class="city-business-name">{{ scope.row.dimensionName || scope.row.dimensionCode }}</strong>
              </template>
            </el-table-column>
            <el-table-column prop="salesAmount" label="交易额" width="112" align="right" sortable>
              <template #default="scope">{{ formatMoneyWan(scope.row.salesAmount) }}</template>
            </el-table-column>
            <el-table-column prop="paidAmount" label="回款额" width="112" align="right" sortable>
              <template #default="scope">{{ formatMoneyWan(scope.row.paidAmount) }}</template>
            </el-table-column>
            <el-table-column prop="rate" label="回款率" min-width="132" sortable>
              <template #default="scope">
                <div class="target-rate-cell" :class="targetRateClass(scope.row.rate)">
                  <strong>{{ formatPercent(scope.row.rate) }}</strong>
                  <em><i :style="{ width: `${boundedPercent(scope.row.rate)}%` }" /></em>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="orderCount" label="订单/客户" width="112" align="right" sortable>
              <template #default="scope">{{ formatNumber(scope.row.orderCount) }} / {{ formatNumber(scope.row.customerCount) }}</template>
            </el-table-column>
            <el-table-column prop="targetAverageRate" label="目标" min-width="132" sortable>
              <template #default="scope">
                <div class="target-rate-cell" :class="targetRateClass(scope.row.targetAverageRate)">
                  <strong>{{ cityTargetAverageText(scope.row) }}</strong>
                  <small>{{ cityTargetSummaryText(scope.row) }}</small>
                  <em><i :style="{ width: `${boundedPercent(scope.row.targetAverageRate)}%` }" /></em>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="风险" width="92" align="center">
              <template #default="scope">
                <el-tag :type="paymentRiskItemTagType(scope.row.rate)" effect="light" size="small">
                  {{ paymentRiskItemLevelLabel(scope.row.rate) }}
                </el-tag>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无城市经营数据" />
            </template>
          </el-table>
        </div>
      </div>
      <div class="dashboard-formula-strip">
        <span>口径</span>
        <small>交易额=非取消订单应收</small>
        <small>回款额=订单累计已收</small>
        <small>待回款=交易额-回款额</small>
        <small>回款率=回款额/交易额</small>
      </div>
    </section>

    <section v-else-if="isSalesBoardSection" class="sales-command-center" v-loading="loading">
      <div class="sales-command-hero">
        <div class="sales-command-main">
          <span>销售业务总览</span>
          <strong>{{ formatMoneyWan(salesAmountMetric?.value) }}</strong>
          <small>{{ rangeLabel }} · 上方筛选城市、销售、客户类型和订单来源，本页图表与明细同步变化。</small>
          <div class="sales-command-main__chips">
            <button type="button" @click="openMetric('order_count')">
              <span>订单数</span>
              <strong>{{ formatNumber(orderCountMetric?.value) }}</strong>
            </button>
            <button type="button" @click="openMetric('cooperated_customer_count')">
              <span>下单客户</span>
              <strong>{{ formatNumber(cooperatedCustomerMetric?.value) }}</strong>
            </button>
            <button type="button" @click="openMetric('repeat_customer_count')">
              <span>复购客户</span>
              <strong>{{ formatNumber(repeatCustomerMetric?.value) }}</strong>
            </button>
            <button type="button" @click="openDashboardSection('payment-risk')">
              <span>待回款</span>
              <strong>{{ formatMoneyWan(unpaidAmountMetric?.value) }}</strong>
            </button>
          </div>
        </div>
        <button class="sales-progress-card" type="button" @click="openDashboardSection('payment-risk')">
          <div>
            <span>总回款进度</span>
            <strong>{{ formatPercent(overviewPaidRate) }}</strong>
            <small>已回款 {{ formatMoneyWan(paidAmountMetric?.value) }} / 交易额 {{ formatMoneyWan(salesAmountMetric?.value) }}</small>
          </div>
          <EchartsChart
            v-if="Number(salesAmountMetric?.value || 0) > 0"
            class="bi-chart sales-progress-ring"
            :option="salesPaymentProgressChartOption"
            :height="170"
            :loading="loading"
          />
          <div v-else class="empty-inline">暂无交易额</div>
        </button>
        <button
          class="sales-risk-entry"
          :class="`sales-risk-entry--${paymentRiskLevelCode}`"
          type="button"
          @click="openDashboardSection('payment-risk')"
        >
          <span>回款风险</span>
          <strong>{{ paymentRiskLevelLabel }}</strong>
          <small>风险金额 {{ formatMoneyWan(paymentRiskAmountMetric?.value) }}</small>
          <em><i :style="{ width: `${boundedPercent(overviewPaidRate)}%` }" /></em>
          <div>
            <b>{{ formatNumber(paymentRiskCustomerMetric?.value) }}</b>
            <span>风险客户</span>
          </div>
        </button>
      </div>

      <div class="sales-board-grid">
        <div class="sales-board-panel sales-board-panel--ranking">
          <div class="subsection-head">
            <strong>销售业绩排名</strong>
            <small>前三名；完整排行看下方跟进表</small>
          </div>
          <template v-if="salesRanking.length">
            <div class="sales-podium">
              <button
                v-for="(item, index) in salesPodiumRows"
                :key="`sales-podium-${item.dimensionCode}`"
                type="button"
                @click="selectSalesRankingItem(item)"
              >
                <span :class="rankingIndexClass(index)">{{ index + 1 }}</span>
                <strong>{{ item.dimensionName || item.dimensionCode }}</strong>
                <small>{{ salesRankingRegionLabel(item) }}</small>
                <em>{{ formatMoneyWan(item.salesAmount) }}</em>
              </button>
            </div>
            <button class="sales-ranking-footnote" type="button" @click="scrollToPanel('.sales-board-table-panel')">
              完整排行和跟进明细
            </button>
          </template>
          <div v-else class="empty-inline">暂无销售业绩排行</div>
        </div>

        <div class="sales-board-panel">
          <div class="subsection-head">
            <strong>{{ salesAmountComparisonTitle }}</strong>
            <small>{{ salesAmountComparisonDescription }}</small>
          </div>
          <EchartsChart
            v-if="hasSalesPerformanceComparison"
            class="bi-chart bi-chart--sales-monthly"
            :option="salesAmountComparisonChartOption"
            :height="315"
            :loading="loading"
            @chart-click="handleSalesMonthlyChartClick"
          />
          <div v-else class="empty-inline">暂无销售额数据</div>
        </div>

        <div class="sales-board-panel">
          <div class="subsection-head">
            <strong>{{ salesPaidComparisonTitle }}</strong>
            <small>{{ salesPaidComparisonDescription }}</small>
          </div>
          <EchartsChart
            v-if="hasSalesPerformanceComparison"
            class="bi-chart bi-chart--sales-monthly"
            :option="salesPaidComparisonChartOption"
            :height="315"
            :loading="loading"
            @chart-click="handleSalesMonthlyChartClick"
          />
          <div v-else class="empty-inline">暂无回款额数据</div>
        </div>

        <div class="sales-board-panel sales-board-panel--goal">
          <div class="subsection-head">
            <strong>本月目标进度</strong>
            <small>按销售人员目标汇总，未配置目标时不虚构完成率</small>
          </div>
          <div class="sales-timeline-card">
            <div>
              <span>{{ currentMonthTimeline.label }}</span>
              <strong>{{ formatPercent(currentMonthTimeline.rate) }}</strong>
              <small>已过 {{ formatNumber(currentMonthTimeline.elapsedDays) }} 天，剩余 {{ formatNumber(currentMonthTimeline.remainingDays) }} 天</small>
            </div>
            <em><i :style="{ width: `${boundedPercent(currentMonthTimeline.rate)}%` }" /></em>
          </div>
          <div v-if="hasSalesGoalProgress" class="sales-goal-list">
            <div
              v-for="row in salesGoalProgressRows"
              :key="row.metricCode"
              class="sales-goal-row"
            >
              <span>{{ row.label }}</span>
              <strong>{{ targetMetricActualText(row, row.unit) }}</strong>
              <small>目标 {{ targetMetricTargetText(row, row.unit) }} · {{ targetMetricGapText(row, row.unit) }} · 完成率 {{ targetMetricRateText(row) }}</small>
              <em><i :style="{ width: `${boundedPercent(row.achievementRate)}%` }" /></em>
            </div>
          </div>
          <div v-else class="empty-inline empty-inline--compact">暂无销售/回款目标配置</div>
        </div>
      </div>

      <div class="sales-board-table-panel">
        <div class="panel-head panel-head--split">
          <div>
            <h2>销售跟进总表</h2>
            <p>一个表查看销售、城市、交易、回款、目标完成和风险等级；点击行可直接筛选到个人。</p>
          </div>
          <el-button link type="primary" @click="openDashboardSection('payment-risk')">查看回款风险明细</el-button>
        </div>
        <div class="dashboard-formula-strip dashboard-formula-strip--compact">
          <span>口径</span>
          <small>交易额=非取消订单应收</small>
          <small>回款额=订单累计已收</small>
          <small>待回款=交易额-回款额</small>
          <small>健康/预警/高危按回款率分级</small>
        </div>
        <el-table
          class="supply-scroll-table sales-board-table"
          :data="salesBoardTableRows"
          size="small"
          max-height="520"
          @row-click="(row) => selectSalesRankingItem(row)"
        >
          <el-table-column label="排名" width="64" align="center">
            <template #default="scope">
              <span class="ranking-row__index" :class="rankingIndexClass(scope.$index)">{{ scope.$index + 1 }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="dimensionName" label="销售" min-width="150" fixed="left" sortable>
            <template #default="scope">
              <div class="sales-person-cell">
                <strong>{{ scope.row.dimensionName || scope.row.dimensionCode }}</strong>
                <small>{{ salesRankingRegionLabel(scope.row) }}</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="salesAmount" label="交易额" width="120" align="right" sortable>
            <template #default="scope">{{ formatMoneyWan(scope.row.salesAmount) }}</template>
          </el-table-column>
          <el-table-column prop="paidAmount" label="回款额" width="120" align="right" sortable>
            <template #default="scope">{{ formatMoneyWan(scope.row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column prop="unpaidAmount" label="待回款" width="120" align="right" sortable>
            <template #default="scope">{{ formatMoneyWan(scope.row.unpaidAmount) }}</template>
          </el-table-column>
          <el-table-column prop="rate" label="回款率" min-width="145" sortable>
            <template #default="scope">
              <div class="target-rate-cell" :class="targetRateClass(scope.row.rate)">
                <strong>{{ formatPercent(scope.row.rate) }}</strong>
                <em><i :style="{ width: `${boundedPercent(scope.row.rate)}%` }" /></em>
              </div>
            </template>
          </el-table-column>
              <el-table-column prop="orderCount" label="订单/客户" width="120" align="right" sortable>
                <template #default="scope">{{ formatNumber(scope.row.orderCount) }} / {{ formatNumber(scope.row.customerCount) }}</template>
              </el-table-column>
              <el-table-column label="建联目标" min-width="132">
                <template #default="scope">
                  <div class="target-rate-cell" :class="targetRateClass(scope.row.contactedTargetMetric?.achievementRate)">
                    <strong>{{ targetMetricRateText(scope.row.contactedTargetMetric) }}</strong>
                    <small>{{ targetMetricGapText(scope.row.contactedTargetMetric, 'COUNT') }}</small>
                    <em><i :style="{ width: `${targetMetricPercent(scope.row.contactedTargetMetric)}%` }" /></em>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="合作目标" min-width="132">
                <template #default="scope">
                  <div class="target-rate-cell" :class="targetRateClass(scope.row.cooperatedTargetMetric?.achievementRate)">
                    <strong>{{ targetMetricRateText(scope.row.cooperatedTargetMetric) }}</strong>
                    <small>{{ targetMetricGapText(scope.row.cooperatedTargetMetric, 'COUNT') }}</small>
                    <em><i :style="{ width: `${targetMetricPercent(scope.row.cooperatedTargetMetric)}%` }" /></em>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="交易目标" min-width="150">
                <template #default="scope">
                  <div class="target-rate-cell" :class="targetRateClass(scope.row.salesTargetMetric?.achievementRate)">
                <strong>{{ targetMetricRateText(scope.row.salesTargetMetric) }}</strong>
                <small>目标 {{ targetMetricTargetText(scope.row.salesTargetMetric, 'CNY') }} · {{ targetMetricGapText(scope.row.salesTargetMetric, 'CNY') }}</small>
                <em><i :style="{ width: `${targetMetricPercent(scope.row.salesTargetMetric)}%` }" /></em>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="回款目标" min-width="150">
            <template #default="scope">
              <div class="target-rate-cell" :class="targetRateClass(scope.row.paidTargetMetric?.achievementRate)">
                <strong>{{ targetMetricRateText(scope.row.paidTargetMetric) }}</strong>
                <small>目标 {{ targetMetricTargetText(scope.row.paidTargetMetric, 'CNY') }} · {{ targetMetricGapText(scope.row.paidTargetMetric, 'CNY') }}</small>
                <em><i :style="{ width: `${targetMetricPercent(scope.row.paidTargetMetric)}%` }" /></em>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="riskLevelCode" label="风险" width="96" align="center" sortable>
            <template #default="scope">
              <el-tag :type="paymentRiskItemTagType(scope.row.rate)" effect="light" size="small">
                {{ paymentRiskItemLevelLabel(scope.row.rate) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="136" fixed="right">
            <template #default="scope">
              <el-button link type="primary" @click.stop="selectSalesRankingItem(scope.row)">筛选销售</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无销售跟进数据" />
          </template>
        </el-table>
      </div>
    </section>

    <section v-else-if="isCustomerSection" class="customer-command-center" v-loading="loading">
      <div class="customer-command-hero">
        <div class="customer-command-main">
          <span>客户经营驾驶舱</span>
          <strong>{{ formatNumber(customerTotalCount) }}</strong>
          <small>{{ rangeLabel }} · 上方筛选城市、销售和客户类型后，分层、活跃度和流失跟进同步变化。</small>
          <div class="customer-command-main__chips">
            <button
              v-for="metric in customerHeroMetrics"
              :key="metric.key"
              type="button"
              @click="handleCustomerHeroMetricClick(metric)"
            >
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
              <small>{{ metric.summary }}</small>
            </button>
          </div>
        </div>

        <button
          class="customer-risk-summary-card"
          :class="`customer-risk-summary-card--${customerRiskTone}`"
          type="button"
          @click="scrollToPanel('.customer-follow-table-panel')"
        >
          <span>流失预警入口</span>
          <strong>{{ formatNumber(customerRiskCount) }}</strong>
          <small>预警客户 / 客户总数 {{ formatNumber(customerTotalCount) }}</small>
          <em><i :style="{ width: `${boundedPercent(customerRiskRate)}%` }" /></em>
          <b>{{ formatPercent(customerRiskRate) }}</b>
        </button>

      </div>

      <div class="dashboard-formula-strip dashboard-formula-strip--compact">
        <span>口径</span>
        <small>客户数=当前筛选范围内客户</small>
        <small>活跃度=近期成交、订单和回款综合评分</small>
        <small>流失预警=长期未下单或无下单记录</small>
        <small>待回款=交易额-回款额</small>
      </div>

      <div v-if="selectedCustomerSegment || selectedCustomerRiskLevel" class="customer-filter-chip">
        <span>
          当前筛选：
          <template v-if="selectedCustomerSegment">{{ selectedCustomerSegmentName }}</template>
          <template v-if="selectedCustomerSegment && selectedCustomerRiskLevel"> / </template>
          <template v-if="selectedCustomerRiskLevel">{{ customerChurnRiskLabel(selectedCustomerRiskLevel) }}</template>
        </span>
        <el-button link type="primary" @click="clearCustomerFilters">查看全部客户</el-button>
      </div>

      <div class="customer-command-grid">
        <div class="customer-command-panel customer-command-panel--segment">
          <div class="customer-command-panel__head">
            <strong>客户分层分布</strong>
            <span>用图表看客户结构，点击图表联动下方客户清单</span>
          </div>
          <EchartsChart
            v-if="customerSegments.length"
            class="bi-chart bi-chart--customer-segment"
            :option="customerSegmentChartOption"
            :height="260"
            :loading="loading"
            @chart-click="handleCustomerSegmentChartClick"
          />
          <div v-else class="empty-inline">暂无客户分层数据</div>
        </div>

        <div class="customer-command-panel customer-command-panel--activity">
          <div class="customer-command-panel__head">
            <strong>客户价值 / 活跃度矩阵</strong>
            <span>{{ customerValueMatrixSummary }}</span>
          </div>
          <div class="customer-value-matrix">
            <button
              v-for="row in customerValueMatrixRows"
              :key="row.key"
              type="button"
              :class="`customer-value-cell customer-value-cell--${row.tone}`"
              @click="scrollToPanel('.customer-follow-table-panel')"
            >
              <span>{{ row.label }}</span>
              <strong>{{ formatNumber(row.count) }}</strong>
              <small>{{ row.summary }}</small>
              <em><i :style="{ width: `${boundedPercent(row.percent)}%` }" /></em>
            </button>
          </div>
          <EchartsChart
            v-if="showCustomerActivityScatterChart"
            class="bi-chart bi-chart--customer-value"
            :option="customerValueActivityChartOption"
            :height="260"
            :loading="loading"
            @chart-click="handleCustomerActivityChartClick"
          />
          <div v-else class="empty-inline">暂无可绘制的客户价值/活跃度明细，先看上方动作分组和下方跟进表</div>
        </div>

        <div class="customer-command-panel customer-command-panel--risk">
          <div class="customer-command-panel__head">
            <strong>流失预警跟进</strong>
            <span>按风险等级、待回款和最近成交优先处理</span>
          </div>
          <div class="customer-risk-buckets">
            <button
              v-for="bucket in customerRiskBuckets"
              :key="bucket.code"
              class="customer-risk-bucket"
              :class="`customer-risk-bucket--${bucket.tone}`"
              type="button"
              @click="selectCustomerRiskLevel(bucket.code)"
            >
              <span>{{ bucket.label }}</span>
              <strong>{{ formatNumber(bucket.count) }}</strong>
              <small>{{ formatMoneyWan(bucket.amount) }}</small>
            </button>
          </div>
          <div v-if="customerPriorityRows.length" class="customer-priority-list">
            <button
              v-for="row in customerPriorityRows"
              :key="row.customerCode"
              class="customer-priority-row"
              type="button"
              @click="openCustomer(row)"
            >
              <span class="customer-priority-row__risk" :class="`customer-priority-row__risk--${customerChurnTone(row.churnRiskLevel)}`">
                {{ customerChurnRiskLabel(row.churnRiskLevel) }}
              </span>
              <strong>{{ row.customerName || row.customerCode }}</strong>
              <small>{{ regionName(row.regionCode, row.regionName) }} · {{ row.ownerStaffName || row.ownerStaffCode || '未分配销售' }}</small>
              <em>{{ customerInactiveLabel(row) }}</em>
              <b>{{ formatMoneyWan(row.unpaidAmount) }}</b>
            </button>
          </div>
          <div v-else class="empty-inline">暂无流失预警客户</div>
        </div>
      </div>

      <div class="customer-follow-table-panel">
        <div class="customer-command-panel__head">
          <strong>客户跟进总表</strong>
          <span>点击客户进入 CRM 档案；列表随城市、销售、客户类型和分层筛选联动</span>
        </div>
        <el-table
          class="customer-follow-table supply-scroll-table"
          :data="customerFollowRows"
          size="small"
          max-height="420"
          @row-click="openCustomer"
        >
          <el-table-column label="客户" min-width="250" fixed show-overflow-tooltip>
            <template #default="scope">
              <div class="customer-table-customer">
                <strong>{{ scope.row.customerName || scope.row.customerCode }}</strong>
                <span>{{ scope.row.customerTypeName || scope.row.customerTypeCode || '-' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="分层" width="100" align="center">
            <template #default="scope">
              <el-tag :type="customerSegmentTagType(scope.row.segmentCode)" effect="light">
                {{ scope.row.segmentName || scope.row.segmentCode }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="风险" width="100" align="center">
            <template #default="scope">
              <el-tag :type="customerChurnTagType(scope.row.churnRiskLevel)" effect="light">
                {{ customerChurnRiskLabel(scope.row.churnRiskLevel) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="regionName" label="城市" min-width="110" show-overflow-tooltip>
            <template #default="scope">{{ regionName(scope.row.regionCode, scope.row.regionName) }}</template>
          </el-table-column>
          <el-table-column prop="ownerStaffName" label="销售" min-width="120" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.ownerStaffName || scope.row.ownerStaffCode || '-' }}</template>
          </el-table-column>
          <el-table-column label="最近下单" width="140">
            <template #default="scope">{{ customerInactiveLabel(scope.row) }}</template>
          </el-table-column>
          <el-table-column label="交易额" width="130" align="right">
            <template #default="scope">{{ formatMoneyWan(scope.row.salesAmount) }}</template>
          </el-table-column>
          <el-table-column label="回款额" width="130" align="right">
            <template #default="scope">{{ formatMoneyWan(scope.row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column label="待回款" width="130" align="right">
            <template #default="scope">{{ formatMoneyWan(scope.row.unpaidAmount) }}</template>
          </el-table-column>
          <el-table-column label="活跃度" width="140" align="right">
            <template #default="scope">
              <div class="customer-score-cell">
                <span>{{ formatNumber(scope.row.activityScore) }}</span>
                <em><i :style="{ width: `${boundedPercent(scope.row.activityScore)}%` }" /></em>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openCustomer(scope.row)">查看客户</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无客户跟进数据" />
          </template>
        </el-table>
      </div>

    </section>

    <section
      v-else-if="showRoleSnapshot && roleSnapshot"
      class="role-snapshot"
      :class="`role-snapshot--${dashboardSection}`"
      v-loading="loading"
    >
      <div class="role-snapshot__main">
        <span>{{ roleSnapshot.eyebrow }}</span>
        <strong>{{ roleSnapshot.value }}</strong>
        <small>{{ roleSnapshot.summary }}</small>
        <div class="role-snapshot__actions">
          <button
            v-for="action in roleSnapshot.actions"
            :key="action.key"
            type="button"
            @click="handleRoleSnapshotAction(action)"
          >
            {{ action.label }}
          </button>
          <el-popover
            v-if="roleSnapshot.formulas.length"
            placement="bottom-end"
            trigger="click"
            width="360"
          >
            <template #reference>
              <button class="role-snapshot__formula" type="button">口径</button>
            </template>
            <div class="role-snapshot-formula">
              <strong>计算口径</strong>
              <span v-for="formula in roleSnapshot.formulas" :key="formula">{{ formula }}</span>
            </div>
          </el-popover>
        </div>
      </div>
      <div class="role-snapshot__cards">
        <button
          v-for="card in roleSnapshot.cards"
          :key="card.key"
          class="role-snapshot-card"
          :class="`role-snapshot-card--${card.tone}`"
          type="button"
          @click="handleRoleSnapshotCardClick(card)"
        >
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.summary }}</small>
          <em v-if="card.progress != null"><i :style="{ width: `${boundedPercent(card.progress)}%` }" /></em>
        </button>
      </div>
    </section>

    <section v-if="isProductInventorySection" class="product-inventory-mode-bar">
      <div>
        <strong>采购/库存运营</strong>
        <span>商品销售统一放在商品销售统计，本页只看采购履约、库存留存和补货建议</span>
      </div>
      <el-radio-group v-model="productInventoryView" size="small">
        <el-radio-button value="procurement">采购履约</el-radio-button>
        <el-radio-button value="inventory">库存留存</el-radio-button>
        <el-radio-button value="replenishment">补货建议</el-radio-button>
      </el-radio-group>
    </section>

    <section
      v-if="showDashboardGrid"
      class="dashboard-grid"
      :class="{ 'dashboard-grid--single': dashboardSection !== 'overview' }"
    >
      <div v-if="showSalesCollectionSection" class="panel panel--wide panel--trend">
        <div class="panel-head">
          <div>
            <h2>销售与回款趋势</h2>
            <p>{{ salesCollectionTrendDescription }}</p>
          </div>
          <el-icon><TrendCharts /></el-icon>
        </div>
        <EchartsChart
          v-if="hasSalesCollectionTrend"
          class="bi-chart bi-chart--trend"
          :option="salesCollectionChartOption"
          :height="isOverviewSection ? 220 : 260"
          :loading="loading"
          @chart-click="handleTrendChartClick"
        />
        <div v-else class="empty-inline">暂无销售与回款趋势数据</div>
      </div>

      <div v-if="showCityRankingSection" class="panel panel--city-ranking">
        <div class="panel-head">
          <div>
            <h2>城市经营排行</h2>
            <p>点击城市后联动当前看板筛选</p>
          </div>
          <el-icon><Histogram /></el-icon>
        </div>
        <div v-if="citySalesRanking.length" class="city-ranking-dashboard">
          <div class="city-business-table-panel">
            <div class="subsection-head">
              <strong>城市经营一张表</strong>
              <small>销售额、回款额、订单客户和目标完成放在同一张表里看</small>
            </div>
            <div class="city-operating-summary-strip">
              <button
                v-for="card in cityOperatingCards"
                :key="card.key"
                type="button"
                :class="`city-operating-summary-card city-operating-summary-card--${card.tone}`"
                @click="card.target && openDashboardSection(card.target)"
              >
                <span>{{ card.label }}</span>
                <strong>{{ card.value }}</strong>
                <small>{{ card.summary }}</small>
              </button>
            </div>
            <el-table
              class="city-business-table supply-scroll-table"
              :data="cityBusinessRows"
              size="small"
              max-height="520"
              @row-click="selectCityRankingItem"
            >
              <el-table-column label="排名" width="64" align="center">
                <template #default="scope">
                  <span class="ranking-row__index" :class="rankingIndexClass(scope.$index)">{{ scope.$index + 1 }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="dimensionName" label="城市" min-width="140" fixed sortable show-overflow-tooltip>
                <template #default="scope">
                  <strong class="city-business-name">{{ scope.row.dimensionName || scope.row.dimensionCode }}</strong>
                </template>
              </el-table-column>
              <el-table-column prop="salesAmount" label="交易额" width="128" align="right" sortable>
                <template #default="scope">{{ formatMoneyWan(scope.row.salesAmount) }}</template>
              </el-table-column>
              <el-table-column prop="paidAmount" label="回款额" width="128" align="right" sortable>
                <template #default="scope">{{ formatMoneyWan(scope.row.paidAmount) }}</template>
              </el-table-column>
              <el-table-column prop="unpaidAmount" label="待回款" width="128" align="right" sortable>
                <template #default="scope">{{ formatMoneyWan(scope.row.unpaidAmount) }}</template>
              </el-table-column>
              <el-table-column prop="rate" label="回款率" min-width="150" sortable>
                <template #default="scope">
                  <div class="target-rate-cell" :class="targetRateClass(scope.row.rate)">
                    <strong>{{ formatPercent(scope.row.rate) }}</strong>
                    <em><i :style="{ width: `${boundedPercent(scope.row.rate)}%` }" /></em>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="orderCount" label="订单数" width="104" align="right" sortable>
                <template #default="scope">{{ formatNumber(scope.row.orderCount) }}</template>
              </el-table-column>
              <el-table-column prop="customerCount" label="客户数" width="104" align="right" sortable>
                <template #default="scope">{{ formatNumber(scope.row.customerCount) }}</template>
              </el-table-column>
              <el-table-column label="复购/活跃" width="118" align="right">
                <template #default="scope">{{ formatNumber(scope.row.repeatCustomerCount) }} / {{ formatNumber(scope.row.activeCustomerCount) }}</template>
              </el-table-column>
              <el-table-column label="高价值/预警" width="126" align="right">
                <template #default="scope">{{ formatNumber(scope.row.highValueCustomerCount) }} / {{ formatNumber(scope.row.churnRiskCustomerCount) }}</template>
              </el-table-column>
              <el-table-column
                v-for="metric in targetMetricDefinitions"
                :key="`city-target-${metric.code}`"
                :label="metric.name"
                width="118"
                align="right"
              >
                <template #default="scope">
                  <div
                    class="city-target-mini"
                    :class="targetRateClass(scope.row.targetMetrics[metric.code]?.achievementRate)"
                    :title="targetMetricGapText(scope.row.targetMetrics[metric.code], metric.unit)"
                  >
                    <strong>{{ targetMetricRateText(scope.row.targetMetrics[metric.code]) }}</strong>
                    <em><i :style="{ width: `${targetMetricPercent(scope.row.targetMetrics[metric.code])}%` }" /></em>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="targetAverageRate" label="目标完成" min-width="160" sortable>
                <template #default="scope">
                  <div class="target-rate-cell" :class="targetRateClass(scope.row.targetAverageRate)">
                    <strong>{{ cityTargetAverageText(scope.row) }}</strong>
                    <small>{{ cityTargetSummaryText(scope.row) }}</small>
                    <em><i :style="{ width: `${boundedPercent(scope.row.targetAverageRate)}%` }" /></em>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="风险" width="96" align="center">
                <template #default="scope">
                  <el-tag :type="paymentRiskItemTagType(scope.row.rate)" effect="light" size="small">
                    {{ paymentRiskItemLevelLabel(scope.row.rate) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="112" fixed="right">
                <template #default="scope">
                  <el-button link type="primary" @click.stop="selectCityRankingItem(scope.row)">筛选城市</el-button>
                </template>
              </el-table-column>
              <template #empty>
                <el-empty description="暂无城市经营数据" />
              </template>
            </el-table>
          </div>
        </div>
        <div v-if="!citySalesRanking.length" class="empty-inline">暂无城市交易汇总数据</div>
      </div>

      <div v-if="showTargetCompletionSection" class="panel panel--wide target-completion-panel">
        <div class="panel-head">
          <div>
            <h2>城市指标完成度</h2>
            <p>按月目标配置累计，展示建联、合作、交易额和回款额完成情况</p>
          </div>
          <el-icon><Histogram /></el-icon>
        </div>
        <EchartsChart
          v-if="cityTargetOverviewRows.length"
          class="bi-chart bi-chart--target-heatmap"
          :option="cityTargetHeatmapOption"
          :height="cityTargetHeatmapHeight"
          :loading="loading"
          @chart-click="handleCityTargetHeatmapClick"
        />
        <div v-if="cityTargetOverviewRows.length" class="target-completion-list">
          <button
            v-for="row in cityTargetOverviewRows"
            :key="row.dimensionCode"
            class="target-completion-row"
            type="button"
            @click="selectTargetCity(row.dimensionCode)"
          >
            <div class="target-completion-row__city">
              <strong>{{ row.dimensionName }}</strong>
              <span>平均完成率 {{ formatPercent(row.averageRate) }}</span>
            </div>
            <div
              v-for="metric in targetMetricDefinitions"
              :key="metric.code"
              class="target-metric"
            >
              <span>{{ metric.name }}</span>
              <strong>{{ targetMetricActualText(row.metrics[metric.code], metric.unit) }}</strong>
              <small>目标 {{ targetMetricTargetText(row.metrics[metric.code], metric.unit) }} · 完成率 {{ targetMetricRateText(row.metrics[metric.code]) }}</small>
              <em><i :style="{ width: `${targetMetricPercent(row.metrics[metric.code])}%` }" /></em>
            </div>
          </button>
        </div>
        <div v-else class="empty-inline">尚未配置城市月度目标，配置后可展示目标与实际完成率</div>
      </div>

      <div v-if="showSourceSystemSection" class="panel panel--source">
        <div class="panel-head">
          <div>
            <h2>业务来源占比</h2>
            <p>按订单来源统计销售额占比</p>
          </div>
          <el-icon><DataAnalysis /></el-icon>
        </div>
        <EchartsChart
          v-if="sourceSystemBreakdown.length"
          class="bi-chart bi-chart--pie"
          :option="sourceSystemPieOption"
          :height="220"
          :loading="loading"
          @chart-click="handleSourceSystemChartClick"
        />
        <div v-else class="source-empty-note">当前筛选范围暂无来源占比数据</div>
      </div>

      <div v-if="showActivitySection" class="panel panel--wide activity-panel">
        <div class="panel-head panel-head--split">
          <div>
            <h2>活动看板</h2>
            <p>当前为样例数据，后续接入活动事实表后再参与真实经营汇总</p>
          </div>
          <el-tag type="warning" effect="light">样例数据</el-tag>
        </div>
        <div class="activity-kpi-strip">
          <div v-for="item in activitySampleKpis" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
        <div class="activity-layout">
          <div class="activity-card-list">
            <div v-for="item in activitySampleCampaigns" :key="item.name" class="activity-card">
              <div>
                <strong>{{ item.name }}</strong>
                <span>{{ item.dateRange }}</span>
              </div>
              <small>{{ item.regions }} · {{ item.type }}</small>
              <div class="activity-card__numbers">
                <span>预算 {{ item.budget }}</span>
                <span>已用 {{ item.used }}</span>
                <span>ROI {{ item.roi }}</span>
              </div>
              <el-progress :percentage="item.usageRate" :show-text="false" />
            </div>
          </div>
          <EchartsChart
            class="bi-chart bi-chart--activity"
            :option="activityTrendChartOption"
            :height="260"
          />
          <EchartsChart
            class="bi-chart bi-chart--activity-cost"
            :option="activityFunnelChartOption"
            :height="260"
          />
        </div>
        <el-table class="supply-scroll-table activity-ranking-table" :data="activitySampleRanking" size="small" max-height="260">
          <el-table-column prop="rank" label="排名" width="70" align="center" />
          <el-table-column prop="name" label="活动名称" min-width="220" show-overflow-tooltip />
          <el-table-column prop="roi" label="ROI" width="100" align="right" />
          <el-table-column prop="salesAmount" label="交易额" width="130" align="right" />
          <el-table-column prop="costAmount" label="投入" width="120" align="right" />
        </el-table>
      </div>

      <div v-if="showProductSalesSection" class="panel panel--wide product-sales-panel">
        <div class="panel-head panel-head--split">
          <div>
            <h2>{{ productPanelTitle }}</h2>
            <p>{{ productPanelDescription }}</p>
          </div>
          <el-radio-group v-model="productBreakdown" size="small">
            <el-radio-button value="PRODUCT">按商品</el-radio-button>
            <el-radio-button value="SKU">按SKU</el-radio-button>
            <el-radio-button value="CATEGORY">按分类</el-radio-button>
            <el-radio-button value="BRAND">按品牌</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="isGrossProfitSection" class="gross-profit-summary-strip">
          <div>
            <span>销售净收入</span>
            <strong>{{ formatMoneyWan(salesNetAmountMetric?.value) }}</strong>
          </div>
          <div>
            <span>退款分摊</span>
            <strong>{{ formatMoneyWan(refundAmountMetric?.value) }}</strong>
          </div>
          <div>
            <span>估算销售成本</span>
            <strong>{{ formatMoneyWan(estimatedCostAmountMetric?.value) }}</strong>
          </div>
          <div>
            <span>估算毛利</span>
            <strong>{{ formatGrossProfitMoneyWan(grossProfitMetric?.value) }}</strong>
          </div>
          <div>
            <span>估算毛利率</span>
            <strong>{{ formatGrossProfitRate(grossProfitRateMetric?.value) }}</strong>
          </div>
          <div>
            <span>成本覆盖率</span>
            <strong>{{ formatPercent(costCoverageRateMetric?.value) }}</strong>
          </div>
        </div>
        <div v-else-if="isProductSalesVisualSection" class="product-sales-summary-strip product-sales-summary-strip--compact">
          <div>
            <span>订货金额</span>
            <strong>{{ formatMoneyWan(productSummaryAmount) }}</strong>
            <small>{{ productTopItem ? `${productTopLabel} ${productTopItem.dimensionName || productTopItem.dimensionCode}` : '暂无销售数据' }}</small>
          </div>
          <div>
            <span>订货数量</span>
            <strong>{{ formatNumber(productSummaryQuantity) }}</strong>
            <small>{{ formatNumber(productSummaryOrderCount) }} 单</small>
          </div>
          <div>
            <span>下单客户数</span>
            <strong>{{ formatNumber(productSummaryCustomerCount) }}</strong>
            <small>当前筛选范围</small>
          </div>
          <div>
            <span>{{ productSummaryPrimaryLabel }}</span>
            <strong>{{ formatNumber(productSummaryPrimaryValue) }}</strong>
            <small>
              {{
                productBreakdown === 'PRODUCT'
                  ? `可售 ${formatNumber(productSaleableCount)} · 未动销 ${formatNumber(productUnsoldCount)}`
                  : `${productDimensionLabel}维度`
              }}
            </small>
          </div>
        </div>
        <div v-if="isProductSalesVisualSection" class="product-dimension-overview">
          <section class="product-dimension-panel">
            <div class="product-dimension-panel__head">
              <strong>分类销售 Top</strong>
              <button type="button" @click="selectProductBreakdown('CATEGORY')">看分类图表</button>
            </div>
            <button
              v-for="item in productCategoryPreviewRows"
              :key="item.dimensionCode || item.dimensionName"
              class="product-dimension-row"
              type="button"
              @click="selectProductBreakdown('CATEGORY')"
            >
              <span>{{ item.dimensionName || item.dimensionCode || '未分组' }}</span>
              <strong>{{ formatMoneyWan(item.salesAmount) }}</strong>
              <small>{{ formatNumber(item.salesQuantity) }} 件 · {{ formatNumber(item.customerCount) }} 客</small>
              <em><i :style="{ width: `${productDimensionPreviewPercent(item, productCategoryPreviewRows)}%` }" /></em>
            </button>
            <div v-if="!productCategoryPreviewRows.length" class="empty-inline empty-inline--compact">暂无分类销售数据</div>
          </section>
          <section class="product-dimension-panel product-dimension-panel--brand">
            <div class="product-dimension-panel__head">
              <strong>品牌销售 Top</strong>
              <button type="button" @click="selectProductBreakdown('BRAND')">看品牌图表</button>
            </div>
            <button
              v-for="item in productBrandPreviewRows"
              :key="item.dimensionCode || item.dimensionName"
              class="product-dimension-row"
              type="button"
              @click="selectProductBreakdown('BRAND')"
            >
              <span>{{ item.dimensionName || item.dimensionCode || '未分组' }}</span>
              <strong>{{ formatMoneyWan(item.salesAmount) }}</strong>
              <small>{{ formatNumber(item.salesQuantity) }} 件 · {{ formatNumber(item.customerCount) }} 客</small>
              <em><i :style="{ width: `${productDimensionPreviewPercent(item, productBrandPreviewRows)}%` }" /></em>
            </button>
            <div v-if="!productBrandPreviewRows.length" class="empty-inline empty-inline--compact">暂无品牌销售数据</div>
          </section>
        </div>
        <div v-if="isProductSalesVisualSection" class="product-health-strip">
          <button type="button" @click="openDashboardSection('product-inventory')">
            <span>库存健康</span>
            <strong>{{ formatNumber(productInventoryWarningCount) }} 预警商品</strong>
            <small>销售表现和库存快照分开看，避免周期口径混在一起</small>
          </button>
          <button type="button" @click="openDashboardSection('product-inventory')">
            <span>平均覆盖天数</span>
            <strong>{{ productAverageCoverageDaysText }}</strong>
            <small>仅统计有销售且有库存覆盖数据的商品</small>
          </button>
        </div>
        <div
          v-if="isProductSalesVisualSection && productBreakdown === 'PRODUCT'"
          class="product-activation-panel"
        >
          <div class="product-activation-panel__summary">
            <span>动销结构</span>
            <strong>{{ productSummarySecondaryValue }}</strong>
            <small>已动销 {{ formatNumber(productSoldCount) }} / 可售 {{ formatNumber(productSaleableCount) }}</small>
          </div>
          <EchartsChart
            v-if="productActivationChartReady"
            class="bi-chart bi-chart--product-activation"
            :option="productActivationChartOption"
            :height="132"
            :loading="loading"
          />
          <div v-else class="empty-inline">暂无可售商品动销数据</div>
        </div>
        <div
          v-if="isGrossProfitSection"
          class="analysis-insight-strip"
        >
          <div>
            <span>{{ productTopLabel }}</span>
            <strong>{{ productTopItem?.dimensionName || '-' }}</strong>
            <small>{{ productTopItem ? formatMoneyWan(productTopMetricValue) : '暂无销售数据' }}</small>
          </div>
          <div>
            <span>{{ isGrossProfitSection ? 'TOP 毛利占比' : 'TOP 金额占比' }}</span>
            <strong>{{ isGrossProfitSection ? formatGrossProfitRate(productTopShareRate) : formatPercent(productTopShareRate) }}</strong>
            <small>{{ isGrossProfitSection && !grossProfitCostCovered ? '成本未覆盖，暂不排名' : '按当前维度口径计算' }}</small>
          </div>
          <div>
            <span>{{ isGrossProfitSection ? '成本覆盖率' : '客户覆盖' }}</span>
            <strong>{{ isGrossProfitSection ? formatPercent(costCoverageRateMetric?.value) : formatNumber(productSummaryCustomerCount) }}</strong>
            <small>{{ isGrossProfitSection ? '采购参考价覆盖订单行' : '当前范围下单客户' }}</small>
          </div>
        </div>
        <el-alert
          v-if="showGrossProfitCoverageWarning"
          class="gross-profit-coverage-warning"
          type="warning"
          title="采购参考价未覆盖，毛利分析暂不可判断"
          description="请先维护 ERP 商品规格采购参考价并刷新 BI；当前页面保留销售、退款、销售净收入等可核验字段。"
          show-icon
          :closable="false"
        />
        <div
          v-if="isProductSalesVisualSection && productBreakdown === 'PRODUCT'"
          class="product-sales-coverage-row"
        >
          <div class="product-sales-coverage-note">
            <span>默认展示本期有销售商品；可售商品来自 ERP 已上架、已提交商品池。</span>
            <el-button link type="primary" @click="openSaleableProducts">
              可售商品 {{ formatNumber(productSaleableCount) }}
            </el-button>
            <span class="product-sales-coverage-separator">·</span>
            <el-button link type="primary" @click="openSaleableProducts">
              未动销 {{ formatNumber(productUnsoldCount) }}
            </el-button>
          </div>
          <el-radio-group v-model="productSalesVisibility" size="small">
            <el-radio-button value="SOLD_ONLY">仅看有销售</el-radio-button>
            <el-radio-button value="WITH_UNSOLD">含未动销</el-radio-button>
          </el-radio-group>
        </div>
        <div
          class="product-sales-layout"
          :class="{
            'product-sales-layout--overview': isOverviewSection,
            'product-sales-layout--report': isProductSalesVisualSection || isGrossProfitSection,
          }"
        >
          <div
            v-if="showProductSalesChart || showProductVolumeChart || !displayedProductSales.length"
            class="product-sales-bars"
          >
            <div
              v-if="showProductSalesChart || showProductVolumeChart"
              class="product-chart-grid"
              :class="{ 'product-chart-grid--split': showProductVolumeChart }"
            >
              <div v-if="showProductSalesChart" class="product-chart-tile">
                <div class="subsection-head">
                  <strong>{{ productDimensionLabel }}{{ isGrossProfitSection ? '估算毛利排行' : '订货金额排行' }}</strong>
                  <small>按{{ isGrossProfitSection ? '估算毛利' : '订货金额' }}由高到低</small>
                </div>
                <EchartsChart
                  class="bi-chart bi-chart--product"
                  :option="productSalesChartOption"
                  :height="productChartHeight"
                  :loading="loading"
                  @chart-click="handleProductSalesChartClick"
                />
              </div>
              <div v-if="showProductVolumeChart" class="product-chart-tile">
                <div class="subsection-head">
                  <strong>{{ productDimensionLabel }}订货数量 / 客户覆盖</strong>
                  <small>用数量和下单客户看商品是否真正铺开</small>
                </div>
                <EchartsChart
                  class="bi-chart bi-chart--product-volume"
                  :option="productVolumeChartOption"
                  :height="productVolumeChartHeight"
                  :loading="loading"
                  @chart-click="handleProductSalesChartClick"
                />
              </div>
            </div>
            <div v-else class="empty-inline">暂无商品销售数据</div>
          </div>
          <el-table
            class="product-sales-table supply-scroll-table"
            :class="{ 'product-sales-table--overview': isOverviewSection }"
            :data="productSalesTableRows"
            size="small"
            :max-height="productTableMaxHeight"
            @row-click="openProductSales"
          >
            <el-table-column label="排名" width="68" align="center">
              <template #default="scope">{{ scope.$index + 1 }}</template>
            </el-table-column>
            <el-table-column prop="dimensionName" :label="productDimensionLabel" min-width="260" sortable show-overflow-tooltip>
              <template #default="scope">{{ scope.row.dimensionName || scope.row.dimensionCode }}</template>
            </el-table-column>
            <el-table-column
              v-if="['PRODUCT', 'SKU'].includes(productBreakdown) && !isOverviewSection"
              prop="categoryName"
              label="分类"
              min-width="150"
              show-overflow-tooltip
            />
            <el-table-column prop="salesQuantity" label="订货数量" width="120" align="right" sortable>
              <template #default="scope">{{ formatNumber(scope.row.salesQuantity) }}</template>
            </el-table-column>
            <el-table-column prop="salesAmount" label="订货金额" width="140" align="right" sortable>
              <template #default="scope">{{ formatMoney(scope.row.salesAmount) }}</template>
            </el-table-column>
            <el-table-column v-if="showGrossProfitColumns" label="优惠抵扣" width="120" align="right">
              <template #default="scope">{{ formatMoney(scope.row.discountAmount) }}</template>
            </el-table-column>
            <el-table-column v-if="showGrossProfitColumns" label="退款分摊" width="120" align="right">
              <template #default="scope">{{ formatMoney(scope.row.refundAmount) }}</template>
            </el-table-column>
            <el-table-column v-if="showGrossProfitColumns" label="销售净收入" width="140" align="right">
              <template #default="scope">{{ formatMoney(scope.row.salesNetAmount) }}</template>
            </el-table-column>
            <el-table-column v-if="showGrossProfitColumns" label="估算成本" width="140" align="right">
              <template #default="scope">{{ formatMoney(scope.row.estimatedCostAmount) }}</template>
            </el-table-column>
            <el-table-column v-if="showGrossProfitColumns" label="估算毛利" width="140" align="right">
              <template #default="scope">
                <span :class="{ 'is-negative': Number(scope.row.estimatedGrossProfit || 0) < 0 }">
                  {{ formatGrossProfitMoney(scope.row.estimatedGrossProfit, scope.row.costCoverageRate) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column v-if="showGrossProfitColumns" label="毛利率" width="110" align="right">
              <template #default="scope">{{ formatGrossProfitRate(scope.row.estimatedGrossProfitRate, scope.row.costCoverageRate) }}</template>
            </el-table-column>
            <el-table-column v-if="showGrossProfitColumns" label="成本覆盖" width="110" align="right">
              <template #default="scope">{{ formatPercent(scope.row.costCoverageRate) }}</template>
            </el-table-column>
            <el-table-column prop="orderCount" label="下单数" width="100" align="right" sortable>
              <template #default="scope">{{ formatNumber(scope.row.orderCount) }}</template>
            </el-table-column>
            <el-table-column prop="customerCount" label="下单客户数" width="110" align="right" sortable>
              <template #default="scope">{{ formatNumber(scope.row.customerCount) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="180" align="center">
              <template #default="scope">
                <div class="product-table-actions">
                  <el-button link type="primary" @click.stop="openProductSales(scope.row)">
                    {{ productActionLabel }}
                  </el-button>
                  <el-button link type="primary" @click.stop="openProductOrders(scope.row)">
                    {{ productOrderActionLabel }}
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无商品销售数据" />
            </template>
          </el-table>
        </div>
        <div v-if="isOverviewSection && displayedProductSales.length > productSalesTableRows.length" class="product-sales-footer">
          <el-button link type="primary" @click="openDashboardSection('product-inventory')">查看完整商品分析</el-button>
        </div>
      </div>

      <div v-if="showInventoryOperationSection" class="panel panel--wide inventory-operation-panel">
        <div class="panel-head">
          <div>
            <h2>{{ inventoryOperationPanelTitle }}</h2>
            <p>{{ inventoryOperationPanelDescription }}</p>
          </div>
          <el-icon><Coin /></el-icon>
        </div>
        <div v-if="showInventoryOperationSummary" class="inventory-operation-summary">
          <template v-if="isOverviewSection">
            <div class="inventory-operation-summary-card inventory-operation-summary-card--readonly">
              <span>采购量</span>
              <strong>{{ inventoryProcurementSummary }}</strong>
            </div>
            <div class="inventory-operation-summary-card inventory-operation-summary-card--readonly">
              <span>已发货</span>
              <strong>{{ inventoryShippedSummary }}</strong>
            </div>
            <div class="inventory-operation-summary-card inventory-operation-summary-card--readonly">
              <span>当前留存</span>
              <strong>{{ inventoryRemainingSummary }}</strong>
            </div>
            <div class="inventory-operation-summary-card inventory-operation-summary-card--readonly">
              <span>建议补货</span>
              <strong>{{ inventorySuggestedSummary }}</strong>
            </div>
          </template>
          <template v-else>
            <button v-if="showInventoryProcurementColumns" class="inventory-operation-summary-card" type="button" @click="openInventoryDetail('procurement')">
              <span>采购量</span>
              <strong>{{ inventoryProcurementSummary }}</strong>
              <small>{{ inventoryProcurementSummaryDetail }}</small>
              <em>明细</em>
            </button>
            <button v-if="showInventoryProcurementColumns" class="inventory-operation-summary-card" type="button" @click="openInventoryDetail('shipped')">
              <span>已发货</span>
              <strong>{{ inventoryShippedSummary }}</strong>
              <small>{{ inventoryShippedSummaryDetail }}</small>
              <em>明细</em>
            </button>
            <button v-if="showInventoryStockColumns" class="inventory-operation-summary-card" type="button" @click="openInventoryDetail('remaining')">
              <span>当前留存</span>
              <strong>{{ inventoryRemainingSummary }}</strong>
              <small>{{ inventoryRemainingSummaryDetail }}</small>
              <em>明细</em>
            </button>
          </template>
        </div>
        <EchartsChart
          v-if="showInventoryFlowChart"
          class="bi-chart bi-chart--inventory-flow"
          :option="inventoryFlowChartOption"
          :height="inventoryFlowChartHeight"
          :loading="loading"
          @chart-click="handleInventoryFlowChartClick"
        />
        <div v-if="showInventoryOperationBoard" class="inventory-operation-board">
          <button
            v-for="row in inventoryOperationBoardRows"
            :key="`${row.categoryCode}-${row.unitCode}`"
            type="button"
            class="inventory-operation-row"
            @click="selectInventoryCategory(row)"
          >
            <div class="inventory-operation-row__head">
              <div>
                <strong>{{ row.categoryName || row.categoryCode }}</strong>
                <small>{{ unitLabel(row.unitCode) }}</small>
              </div>
              <el-tag size="small" :type="inventoryOperationRowTagType(row)" effect="light">
                {{ inventoryOperationRowStatus(row) }}
              </el-tag>
            </div>
            <div class="inventory-operation-row__metrics">
              <span v-for="metric in inventoryOperationRowMetrics(row)" :key="metric.label">
                <small>{{ metric.label }}</small>
                <strong>{{ metric.value }}</strong>
              </span>
            </div>
            <div class="inventory-operation-row__track">
              <span>{{ inventoryOperationProgressLabel(row) }}</span>
              <div>
                <i :style="{ width: `${inventoryOperationProgress(row)}%` }" />
              </div>
            </div>
          </button>
        </div>
        <el-table
          v-if="showInventoryOperationTable && !showInventoryOperationBoard"
          class="supply-scroll-table inventory-operation-table"
          :data="inventoryItemTableRows"
          size="small"
          :max-height="isOverviewSection ? 260 : 420"
          @row-click="selectInventoryCategory"
        >
          <el-table-column prop="categoryName" label="品项" min-width="220" show-overflow-tooltip />
          <el-table-column label="单位" width="100" align="center">
            <template #default="scope">{{ unitLabel(scope.row.unitCode) }}</template>
          </el-table-column>
          <el-table-column v-if="showInventoryProcurementColumns" label="采购量" width="140" align="right">
            <template #default="scope">{{ formatNumber(scope.row.procurementQuantity) }}</template>
          </el-table-column>
          <el-table-column v-if="showInventoryProcurementColumns" label="已发货" width="140" align="right">
            <template #default="scope">{{ formatNumber(scope.row.shippedQuantity) }}</template>
          </el-table-column>
          <el-table-column v-if="showInventoryStockColumns" label="当前留存" width="140" align="right">
            <template #default="scope">{{ formatNumber(scope.row.remainingQuantity) }}</template>
          </el-table-column>
          <el-table-column v-if="showInventoryStockColumns" label="历史/下架留存" width="150" align="right">
            <template #default="scope">{{ formatNumber(scope.row.inactiveRemainingQuantity) }}</template>
          </el-table-column>
          <el-table-column v-if="showInventoryProcurementColumns" label="发货率" width="180">
            <template #default="scope">
              <div class="rate-cell">
                <el-progress :percentage="boundedPercent(inventoryShipmentRate(scope.row))" :show-text="false" />
                <strong>{{ formatPercent(inventoryShipmentRate(scope.row)) }}</strong>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div v-else-if="showInventoryOperationEmpty" class="empty-inline">{{ inventoryOperationEmptyText }}</div>
        <div v-if="showInventoryReplenishmentSection" class="inventory-replenishment">
          <div class="subsection-head">
            <strong>补货观察</strong>
            <small>按商品 + 单位计算，目标覆盖 30 天；不使用采购价、不跨单位合计</small>
          </div>
          <EchartsChart
            v-if="inventoryCoverageChartRows.length"
            class="bi-chart bi-chart--inventory-coverage"
            :option="inventoryCoverageChartOption"
            :height="inventoryCoverageChartHeight"
            :loading="loading"
            @chart-click="handleInventoryCoverageChartClick"
          />
          <el-table
            class="supply-scroll-table inventory-replenishment-table"
            :data="inventoryReplenishmentTableRows"
            size="small"
            max-height="420"
            @row-click="openInventoryReplenishment"
          >
            <el-table-column label="状态" width="88">
              <template #default="scope">
                <el-tag :type="inventoryReplenishmentTagType(scope.row.riskLevel)" effect="light">
                  {{ inventoryReplenishmentLabel(scope.row.riskLevel) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="库存状态" width="120">
              <template #default="scope">
                <el-tag :type="inventoryStatusTagType(scope.row.inventoryStatus)" effect="plain">
                  {{ inventoryStatusLabel(scope.row.inventoryStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="productName" label="商品" min-width="260" show-overflow-tooltip />
            <el-table-column prop="categoryName" label="分类" min-width="140" show-overflow-tooltip />
            <el-table-column label="单位" width="90" align="center">
              <template #default="scope">{{ unitLabel(scope.row.unitCode) }}</template>
            </el-table-column>
            <el-table-column label="近周期订货" width="120" align="right">
              <template #default="scope">{{ formatNumber(scope.row.salesQuantity) }}</template>
            </el-table-column>
            <el-table-column label="日均消耗" width="120" align="right">
              <template #default="scope">{{ formatNumber(scope.row.dailySalesQuantity) }}</template>
            </el-table-column>
            <el-table-column label="可用库存" width="120" align="right">
              <template #default="scope">{{ formatNumber(scope.row.availableQuantity) }}</template>
            </el-table-column>
            <el-table-column label="在途" width="100" align="right">
              <template #default="scope">{{ formatNumber(scope.row.inTransitQuantity) }}</template>
            </el-table-column>
            <el-table-column label="覆盖天数" width="120" align="right">
              <template #default="scope">{{ formatCoverageDays(scope.row) }}</template>
            </el-table-column>
            <el-table-column label="建议补货" width="120" align="right">
              <template #default="scope">{{ formatNumber(scope.row.suggestedProcurementQuantity) }}</template>
            </el-table-column>
          </el-table>
        </div>
        <div v-else-if="isProductInventorySection && hasInventoryReplenishmentScopeConflict" class="empty-inline">
          补货观察暂只支持日期、城市和商品分类筛选，请清除销售、客户类型或订单来源后查看
        </div>
        <div v-else-if="isProductInventorySection && productInventoryView === 'replenishment'" class="empty-inline">
          暂无补货建议数据
        </div>
      </div>

      <div v-if="showCityCostSection" class="panel panel--wide city-cost-panel">
        <div class="panel-head">
          <div>
            <h2>城市成本</h2>
            <p>成本、预算、偏差和销售成本率</p>
          </div>
          <el-icon><Coin /></el-icon>
        </div>
        <template v-if="cityCostHasData">
          <div class="city-cost-summary">
            <div>
              <span>城市端成本</span>
              <strong>{{ formatMoneyWan(cityCostMetric?.value) }}</strong>
            </div>
            <div>
              <span>城市成本率</span>
              <strong>{{ cityCostHasData ? formatPercent(cityCostRateMetric?.value) : '-' }}</strong>
            </div>
            <div>
              <span>成本导入</span>
              <strong>已导入</strong>
            </div>
          </div>
          <div class="trend-block">
            <EchartsChart
              v-if="cityCostTrendRows.length"
              class="bi-chart bi-chart--cost"
              :option="cityCostChartOption"
              :height="220"
              :loading="loading"
              @chart-click="handleTrendChartClick"
            />
            <div v-else class="empty-inline">暂无城市成本趋势数据</div>
          </div>
          <el-table class="city-cost-table supply-scroll-table" :data="overview?.cityCostRanking || []" size="small" max-height="320">
            <el-table-column prop="regionName" label="城市" min-width="140" fixed="left">
              <template #default="scope">{{ regionName(scope.row.regionCode, scope.row.regionName) }}</template>
            </el-table-column>
            <el-table-column label="成本" width="130" align="right">
              <template #default="scope">{{ formatMoney(scope.row.costAmount) }}</template>
            </el-table-column>
            <el-table-column label="预算" width="130" align="right">
              <template #default="scope">{{ formatMoney(scope.row.budgetAmount) }}</template>
            </el-table-column>
            <el-table-column label="偏差" width="130" align="right">
              <template #default="scope">
                <span :class="{ 'is-over-budget': scope.row.varianceAmount > 0 }">
                  {{ formatMoney(scope.row.varianceAmount) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="销售额" width="130" align="right">
              <template #default="scope">{{ formatMoney(scope.row.salesAmount) }}</template>
            </el-table-column>
            <el-table-column label="成本率" width="180">
              <template #default="scope">
                <div class="rate-cell">
                  <el-progress :percentage="boundedPercent(scope.row.costRate)" :show-text="false" />
                  <strong>{{ formatPercent(scope.row.costRate) }}</strong>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="记录数" width="90" align="right">
              <template #default="scope">{{ formatNumber(scope.row.recordCount) }}</template>
            </el-table-column>
            <el-table-column label="最新成本时间" width="170">
              <template #default="scope">{{ formatTime(scope.row.latestCostTime) }}</template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无城市端成本数据" />
            </template>
          </el-table>
        </template>
        <div v-else class="city-cost-empty">
          <strong>城市成本未导入</strong>
          <p>当前筛选范围没有城市成本记录，成本率、预算偏差和城市成本排行暂不可用。</p>
          <el-button v-if="canRefreshData" type="primary" plain :loading="refreshing" @click="triggerRefresh">同步最新数据</el-button>
        </div>
      </div>

      <div v-if="showSalesRankingSection" class="panel panel--wide">
        <div class="panel-head">
          <div>
            <h2>销售人员排名</h2>
            <p>左侧按交易额，右侧按回款额；明细只在销售看板展示</p>
          </div>
          <el-icon><DataAnalysis /></el-icon>
        </div>
        <div v-if="salesRanking.length" class="ranking-visual-grid">
          <div class="ranking-visual">
            <div class="subsection-head">
              <strong>交易额 Top 10</strong>
              <small>横向条形图，点击销售联动筛选</small>
            </div>
            <EchartsChart
              class="bi-chart bi-chart--ranking"
              :option="salesAmountRankingChartOption"
              :height="salesRankingChartHeight"
              :loading="loading"
              @chart-click="handleSalesAmountRankingChartClick"
            />
          </div>
          <div class="ranking-visual">
            <div class="subsection-head">
              <strong>回款额 Top 10</strong>
              <small>同一口径下按订单累计已收排行</small>
            </div>
            <EchartsChart
              class="bi-chart bi-chart--ranking"
              :option="salesPaidRankingChartOption"
              :height="salesRankingChartHeight"
              :loading="loading"
              @chart-click="handleSalesPaidRankingChartClick"
            />
          </div>
        </div>
        <div v-if="salesRanking.length" class="dual-ranking-layout">
          <div class="ranking-block">
            <div class="subsection-head">
              <strong>销售额排名</strong>
              <small>按交易额倒序</small>
            </div>
            <el-table
              class="supply-scroll-table sales-ranking-table"
              :data="salesRankingPreview"
              size="small"
              max-height="520"
              @row-click="(row) => selectSalesRankingItem(row)"
            >
              <el-table-column label="排名" width="64" align="center">
                <template #default="scope">
                  <span class="ranking-row__index" :class="rankingIndexClass(scope.$index)">{{ scope.$index + 1 }}</span>
                </template>
              </el-table-column>
              <el-table-column label="姓名" min-width="132">
                <template #default="scope">
                  <div class="sales-person-cell">
                    <strong>{{ scope.row.dimensionName || scope.row.dimensionCode }}</strong>
                    <small>{{ formatNumber(scope.row.orderCount) }} 单 · {{ formatNumber(scope.row.customerCount) }} 客户</small>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="城市" width="96">
                <template #default="scope">{{ salesRankingRegionLabel(scope.row) }}</template>
              </el-table-column>
              <el-table-column label="交易额" width="112" align="right">
                <template #default="scope">{{ formatMoneyWan(scope.row.salesAmount) }}</template>
              </el-table-column>
              <el-table-column label="指标" width="112" align="right">
                <template #default="scope">{{ targetMetricTargetText(scope.row.targetMetric, 'CNY') }}</template>
              </el-table-column>
              <el-table-column label="完成率" min-width="150">
                <template #default="scope">
                  <div class="target-rate-cell" :class="targetRateClass(scope.row.targetMetric?.achievementRate)">
                    <strong>{{ targetMetricRateText(scope.row.targetMetric) }}</strong>
                    <em><i :style="{ width: `${targetMetricPercent(scope.row.targetMetric)}%` }" /></em>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div class="ranking-block">
            <div class="subsection-head">
              <strong>回款额排名</strong>
              <small>按回款额倒序</small>
            </div>
            <el-table
              class="supply-scroll-table sales-ranking-table"
              :data="salesPaidRankingPreview"
              size="small"
              max-height="520"
              @row-click="(row) => selectSalesRankingItem(row)"
            >
              <el-table-column label="排名" width="64" align="center">
                <template #default="scope">
                  <span class="ranking-row__index" :class="rankingIndexClass(scope.$index)">{{ scope.$index + 1 }}</span>
                </template>
              </el-table-column>
              <el-table-column label="姓名" min-width="132">
                <template #default="scope">
                  <div class="sales-person-cell">
                    <strong>{{ scope.row.dimensionName || scope.row.dimensionCode }}</strong>
                    <small>待回款 {{ formatMoneyWan(scope.row.unpaidAmount) }}</small>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="城市" width="96">
                <template #default="scope">{{ salesRankingRegionLabel(scope.row) }}</template>
              </el-table-column>
              <el-table-column label="回款额" width="112" align="right">
                <template #default="scope">{{ formatMoneyWan(scope.row.paidAmount) }}</template>
              </el-table-column>
              <el-table-column label="指标" width="112" align="right">
                <template #default="scope">{{ targetMetricTargetText(scope.row.targetMetric, 'CNY') }}</template>
              </el-table-column>
              <el-table-column label="完成率" min-width="150">
                <template #default="scope">
                  <div class="target-rate-cell" :class="targetRateClass(scope.row.targetMetric?.achievementRate)">
                    <strong>{{ targetMetricRateText(scope.row.targetMetric) }}</strong>
                    <em><i :style="{ width: `${targetMetricPercent(scope.row.targetMetric)}%` }" /></em>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
        <div v-else class="empty-inline">暂无销售人员排行数据</div>
      </div>

      <div
        v-if="showPaymentRiskSection"
        class="panel payment-risk-panel"
        :class="{ 'panel--wide': !isOverviewSection }"
      >
        <div class="panel-head">
          <div>
            <h2>回款风险</h2>
            <p>按待回款金额、涉及客户和逾期天数识别跟进优先级</p>
          </div>
          <el-icon><Warning /></el-icon>
        </div>
        <div v-if="isPaymentRiskDetailSection" class="payment-risk-summary-strip" :class="paymentRiskToneClass">
          <div>
            <span>总待回款金额</span>
            <strong>{{ formatMoneyWan(unpaidAmountMetric?.value) }}</strong>
          </div>
          <div>
            <span>风险金额</span>
            <strong>{{ formatMoneyWan(paymentRiskAmountMetric?.value) }}</strong>
          </div>
          <div>
            <span>风险客户数</span>
            <strong>{{ formatNumber(paymentRiskCustomerMetric?.value) }}</strong>
          </div>
          <div>
            <span>高风险客户数</span>
            <strong>{{ formatNumber(paymentHighRiskCustomerMetric?.value) }}</strong>
          </div>
          <div>
            <span>平均逾期</span>
            <strong>{{ formatDays(paymentAvgOverdueMetric?.value) }}</strong>
          </div>
          <div>
            <span>风险金额占比</span>
            <strong>{{ formatPercent(paymentRiskAmountRateMetric?.value) }}</strong>
          </div>
          <div>
            <span>风险城市占比</span>
            <strong>{{ formatPercent(paymentRiskCityShareRate) }}</strong>
          </div>
          <div>
            <span>风险城市数</span>
            <strong>{{ formatNumber(paymentRiskCityCount) }}</strong>
          </div>
        </div>
        <div v-if="isPaymentRiskDetailSection" class="payment-risk-control-grid">
          <div class="payment-risk-level-panel">
            <div class="subsection-head">
              <strong>风险等级结构</strong>
              <small>健康 ≥60%，预警 20%-60%，高危 ≤20%；按城市回款率汇总待回款金额</small>
            </div>
            <EchartsChart
              v-if="hasPaymentRiskLevelData"
              class="bi-chart bi-chart--payment-risk-level"
              :option="paymentRiskLevelChartOption"
              :height="220"
              :loading="loading"
            />
            <div v-else class="empty-inline empty-inline--compact">暂无风险等级数据</div>
          </div>
          <div class="payment-risk-city-groups">
            <div class="subsection-head">
              <strong>城市风险分组</strong>
              <small>直接看健康、预警、高危城市有哪些</small>
            </div>
            <div class="payment-risk-city-group-grid">
              <section
                v-for="group in paymentRiskCityGroups"
                :key="group.code"
                class="payment-risk-city-group"
                :class="`payment-risk-city-group--${group.code}`"
              >
                <div class="payment-risk-city-group__head">
                  <span>{{ group.label }}</span>
                  <strong>{{ formatNumber(group.cityCount) }} 城市</strong>
                  <small>{{ formatMoneyWan(group.unpaidAmount) }} · {{ formatPercent(group.percent) }}</small>
                </div>
                <div v-if="group.rows.length" class="payment-risk-city-list">
                  <button
                    v-for="row in group.rows"
                    :key="row.dimensionCode || row.dimensionName"
                    class="payment-risk-city-row"
                    type="button"
                    @click="selectCityRankingItem(row)"
                  >
                    <span>{{ row.dimensionName || row.dimensionCode || '未分组城市' }}</span>
                    <strong>{{ formatPercent(row.rate) }}</strong>
                    <small>待回款 {{ formatMoneyWan(row.unpaidAmount) }}</small>
                    <em><i :style="{ width: `${boundedPercent(row.rate)}%` }" /></em>
                  </button>
                </div>
                <div v-else class="empty-inline empty-inline--compact">暂无{{ group.label }}城市</div>
              </section>
            </div>
          </div>
        </div>
        <div v-if="!isOverviewSection && paymentAgingBuckets.length" class="payment-aging-visual">
          <div class="subsection-head">
            <strong>待回款账龄分布</strong>
            <small>按订单应回款到期日分桶，点击查看待回款订单</small>
          </div>
          <EchartsChart
            class="bi-chart bi-chart--payment-aging"
            :option="paymentAgingBucketChartOption"
            :height="260"
            :loading="loading"
            @chart-click="handlePaymentAgingChartClick"
          />
        </div>
        <div v-if="!isOverviewSection && hasPaymentRiskRankingData" class="risk-visual-grid">
          <div class="risk-visual">
            <div class="subsection-head">
              <strong>城市待回款排行</strong>
              <small>条越长，跟进金额越大；颜色按回款率分级</small>
            </div>
            <EchartsChart
              class="bi-chart bi-chart--risk-ranking"
              :option="paymentRiskCityChartOption"
              :height="paymentRiskChartHeight"
              :loading="loading"
              @chart-click="handlePaymentRiskCityChartClick"
            />
          </div>
          <div class="risk-visual">
            <div class="subsection-head">
              <strong>销售待回款排行</strong>
              <small>点击销售后查看对应订单跟进范围</small>
            </div>
            <EchartsChart
              class="bi-chart bi-chart--risk-ranking"
              :option="paymentRiskSalesChartOption"
              :height="paymentRiskChartHeight"
              :loading="loading"
              @chart-click="handlePaymentRiskSalesChartClick"
            />
          </div>
        </div>
      </div>

      <div v-if="showInventoryRiskSection" class="panel panel--wide">
        <div class="panel-head">
          <div>
            <h2>库存风险</h2>
            <p>可用库存不足或锁定量异常</p>
          </div>
          <el-icon><Warning /></el-icon>
        </div>
        <div v-if="dashboardSection === 'inventory-risk' && riskRows.length" class="risk-summary-strip">
          <div>
            <span>高风险项</span>
            <strong>{{ formatNumber(highRiskCount) }}</strong>
          </div>
          <div>
            <span>负库存总量</span>
            <strong>{{ formatNumber(negativeInventoryTotal) }}</strong>
          </div>
          <div>
            <span>涉及仓库</span>
            <strong>{{ formatNumber(riskWarehouseCount) }}</strong>
          </div>
        </div>
        <EchartsChart
          v-if="showInventoryRiskChart"
          class="bi-chart bi-chart--inventory-risk"
          :option="inventoryRiskChartOption"
          :height="150"
          :loading="loading"
        />
        <el-table class="supply-scroll-table" :data="riskRows" size="small" max-height="300" @row-click="openRisk">
          <el-table-column prop="riskLevel" label="等级" width="90">
            <template #default="scope">
              <el-tag :type="riskTagType(scope.row.riskLevel)" effect="light">{{ riskLabel(scope.row.riskLevel) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="dimensionName" label="风险对象" min-width="260" show-overflow-tooltip />
          <el-table-column prop="description" label="说明" min-width="180" />
          <el-table-column label="可用" width="100" align="right">
            <template #default="scope">{{ formatNumber(scope.row.primaryValue) }}</template>
          </el-table-column>
          <el-table-column label="锁定" width="100" align="right">
            <template #default="scope">{{ formatNumber(scope.row.secondaryValue) }}</template>
          </el-table-column>
          <el-table-column label="更新时间" width="170">
            <template #default="scope">{{ formatTime(scope.row.observedAt) }}</template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无库存风险" />
          </template>
        </el-table>
      </div>
    </section>

    <el-drawer
      v-model="inventoryDetailVisible"
      class="inventory-detail-drawer"
      size="min(92vw, 760px)"
      destroy-on-close
    >
      <template #header>
        <div class="inventory-detail-head">
          <span>{{ inventoryDetailTitle }}</span>
          <strong>{{ inventoryDetailQuantityText }}</strong>
          <small>{{ inventoryDetailScopeText }}</small>
        </div>
      </template>
      <el-table
        v-if="activeInventoryDetailKind !== 'replenishment'"
        class="supply-scroll-table inventory-detail-table"
        :data="inventoryDetailItemRows"
        size="small"
        max-height="620"
      >
        <el-table-column prop="categoryName" label="品项" min-width="220" show-overflow-tooltip />
        <el-table-column label="涉及单位" width="110" align="center">
          <template #default="scope">{{ inventoryUnitScope(scope.row) }}</template>
        </el-table-column>
        <el-table-column :label="inventoryDetailPrimaryLabel" width="130" align="right">
          <template #default="scope">{{ formatNumber(inventoryDetailPrimaryQuantity(scope.row)) }}</template>
        </el-table-column>
        <el-table-column v-if="activeInventoryDetailKind === 'procurement'" label="已发货" width="120" align="right">
          <template #default="scope">{{ formatNumber(scope.row.shippedQuantity) }}</template>
        </el-table-column>
        <el-table-column v-if="activeInventoryDetailKind === 'shipped'" label="采购量" width="120" align="right">
          <template #default="scope">{{ formatNumber(scope.row.procurementQuantity) }}</template>
        </el-table-column>
        <el-table-column v-if="activeInventoryDetailKind === 'remaining'" label="采购量" width="120" align="right">
          <template #default="scope">{{ formatNumber(scope.row.procurementQuantity) }}</template>
        </el-table-column>
        <el-table-column v-if="activeInventoryDetailKind === 'remaining'" label="已发货" width="120" align="right">
          <template #default="scope">{{ formatNumber(scope.row.shippedQuantity) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="96" align="center">
          <template #default="scope">
            <el-button link type="primary" @click.stop="selectInventoryCategory(scope.row)">筛选</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="inventoryDetailEmptyText" />
        </template>
      </el-table>
      <el-table
        v-else
        class="supply-scroll-table inventory-detail-table"
        :data="inventoryDetailReplenishmentRows"
        size="small"
        max-height="620"
      >
        <el-table-column prop="productName" label="商品" min-width="220" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="分类" min-width="140" show-overflow-tooltip />
        <el-table-column label="涉及单位" width="110" align="center">
          <template #default="scope">{{ inventoryUnitScope(scope.row) }}</template>
        </el-table-column>
        <el-table-column label="建议补货" width="120" align="right">
          <template #default="scope">{{ formatNumber(scope.row.suggestedProcurementQuantity) }}</template>
        </el-table-column>
        <el-table-column label="可用库存" width="120" align="right">
          <template #default="scope">{{ formatNumber(scope.row.availableQuantity) }}</template>
        </el-table-column>
        <el-table-column label="在途" width="100" align="right">
          <template #default="scope">{{ formatNumber(scope.row.inTransitQuantity) }}</template>
        </el-table-column>
        <el-table-column label="覆盖天数" width="120" align="right">
          <template #default="scope">{{ formatCoverageDays(scope.row) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="88">
          <template #default="scope">
            <el-tag :type="inventoryReplenishmentTagType(scope.row.riskLevel)" effect="light">
              {{ inventoryReplenishmentLabel(scope.row.riskLevel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="scope">
            <el-button link type="primary" @click.stop="openInventoryReplenishment(scope.row)">商品</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="inventoryDetailEmptyText" />
        </template>
      </el-table>
    </el-drawer>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { EChartsCoreOption } from 'echarts/core'
import { ElMessage, type TagProps } from 'element-plus'
import { Coin, DataAnalysis, Histogram, Refresh, RefreshLeft, Search, TrendCharts, User, Warning } from '@element-plus/icons-vue'
import { getCrmCustomerAreas, getCrmCustomerTypes, type CrmDictionaryView } from '@/api/core/crm'
import type { ErpProductCategoryView } from '@/api/core/erp-internal'
import {
  createSupplyDashboardRefreshRun,
  getSupplyDashboardFilterOptions,
  getSupplyDashboardOverview,
  getSupplyDashboardReconciliation,
  type SupplyDashboardFilterOptions,
  type SupplyDashboardCustomerActivityItem,
  type SupplyDashboardCustomerSegmentItem,
  type SupplyDashboardMetricCard,
  type SupplyDashboardOverview,
  type SupplyDashboardInventoryItemSummary,
  type SupplyDashboardInventoryReplenishmentItem,
  type SupplyDashboardPaymentAgingBucket,
  type SupplyDashboardProductSalesItem,
  type SupplyDashboardRankingItem,
  type SupplyDashboardRiskItem,
  type SupplyDashboardSalesMonthlyPerformance,
  type SupplyDashboardRefreshSourceCode,
  type SupplyDashboardReconciliation,
  type SupplyDashboardTargetCompletionItem,
  type SupplyDashboardTrendPoint,
} from '@/api/core/bi'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import ProductCategorySelect from '@/components/supply/ProductCategorySelect.vue'
import EchartsChart from './components/EchartsChart.vue'

interface DashboardFilters {
  dateRange: string[]
  regionCode: string
  ownerStaffCode: string
  customerTypeCode: string
  productCategoryId: string
  sourceSystemCode: string
}

interface ChartClickParams {
  name?: string | number
  dataIndex?: number
  data?: unknown
}

interface SourceSystemPieData {
  dimensionCode?: string
  rankType?: string
  sourceSystemCode?: string
  orderCount?: number
  customerCount?: number
  rate?: number
  percent?: number
  isOther?: boolean
}

interface BusinessShareDisplayRow extends SupplyDashboardRankingItem {
  value: number
  percent: number
  color: string
  sourceSystemCode?: string
  isOther?: boolean
}

interface ProductSalesChartData {
  isOther?: boolean
  sourceIndex?: number
  salesAmount?: number
  salesQuantity?: number
  salesNetAmount?: number
  estimatedCostAmount?: number
  estimatedGrossProfit?: number
  estimatedGrossProfitRate?: number
  costCoverageRate?: number
  orderCount?: number
  customerCount?: number
  coverageLabel?: string
}

interface PaymentAgingBucketChartData extends SupplyDashboardPaymentAgingBucket {
  value?: number
}

interface InventoryRiskChartData {
  riskLevel?: string
}

interface InventoryOperationMetric {
  label: string
  value: string
}

interface InventoryCoverageChartData {
  sourceIndex?: number
  productCode?: string
}

interface InventoryDetailItemRow extends SupplyDashboardInventoryItemSummary {
  unitCount: number
}

interface InventoryDetailReplenishmentRow extends SupplyDashboardInventoryReplenishmentItem {
  unitCount: number
}

interface TargetMetricDefinition {
  code: string
  name: string
  unit: 'COUNT' | 'CNY'
}

interface TargetMetricSnapshot {
  targetValue: number
  actualValue: number
  achievementRate: number
}

interface CityTargetOverviewRow {
  dimensionCode: string
  dimensionName: string
  metrics: Record<string, TargetMetricSnapshot>
  averageRate: number
}

interface SalesRankingDisplayRow extends SupplyDashboardRankingItem {
  targetMetric?: TargetMetricSnapshot
}

interface ActivityKpi {
  label: string
  value: string
}

interface ActivityCampaign {
  name: string
  dateRange: string
  regions: string
  type: string
  budget: string
  used: string
  roi: string
  usageRate: number
}

interface ActivityRankingRow {
  rank: number
  name: string
  roi: string
  salesAmount: string
  costAmount: string
}

interface PieTooltipParam {
  name?: string
  value?: number
  percent?: number
  data?: SourceSystemPieData & ProductSalesChartData & Partial<SupplyDashboardRankingItem>
}

interface ProductSalesTooltipParam {
  name?: string
  value?: number | string
  data?: ProductSalesChartData
}

interface RankingChartData extends SupplyDashboardRankingItem {
  value?: number
}

interface SalesMonthlyPerformanceChartData extends SupplyDashboardSalesMonthlyPerformance {
  value?: number
}

interface SalesBoardTableRow extends SupplyDashboardRankingItem {
  contactedTargetMetric?: TargetMetricSnapshot
  cooperatedTargetMetric?: TargetMetricSnapshot
  salesTargetMetric?: TargetMetricSnapshot
  paidTargetMetric?: TargetMetricSnapshot
  riskLevelCode: PaymentRiskLevelCode
}

interface CityBusinessTableRow extends SupplyDashboardRankingItem {
  targetMetrics: Record<string, TargetMetricSnapshot>
  targetAverageRate: number | null
  targetConfiguredCount: number
  riskLevelCode: PaymentRiskLevelCode
  activeCustomerCount: number
  repeatCustomerCount: number
  highValueCustomerCount: number
  churnRiskCustomerCount: number
}

interface CityCustomerStats {
  activeCustomerCount: number
  repeatCustomerCount: number
  highValueCustomerCount: number
  churnRiskCustomerCount: number
}

interface CityOperatingCard {
  key: string
  label: string
  value: string
  summary: string
  tone: DashboardSnapshotTone
  target?: DashboardSection
}

interface SalesGoalProgressRow extends TargetMetricSnapshot {
  metricCode: 'SALES_AMOUNT' | 'PAID_AMOUNT'
  label: string
  unit: TargetMetricDefinition['unit']
  hasTarget: boolean
}

interface SalesMonthlyOwner {
  code: string
  name: string
}

interface TargetHeatmapChartData {
  value: [number, number, number]
  dimensionCode: string
  dimensionName: string
  metricCode: string
  metricName: string
  targetValue: number
  actualValue: number
  achievementRate: number
}

interface InventoryFlowChartData extends SupplyDashboardInventoryItemSummary {
  value: number
  flowType: 'procurement' | 'shipped' | 'remaining' | 'inactive'
}

interface CustomerSegmentChartData extends SupplyDashboardCustomerSegmentItem {
  value?: number
}

interface CustomerActivityChartData extends SupplyDashboardCustomerActivityItem {
  value?: number | [number, number, number]
}

type CustomerRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'
type PaymentRiskLevelCode = 'none' | 'healthy' | 'warning' | 'danger'

interface CustomerHeroMetric {
  key: string
  label: string
  value: string
  summary: string
  metricCode?: string
  target?: 'risk'
}

interface CustomerRiskBucket {
  code: CustomerRiskLevel
  label: string
  count: number
  amount: number
  tone: 'danger' | 'warning' | 'success'
}

interface CustomerValueMatrixRow {
  key: string
  label: string
  summary: string
  count: number
  salesAmount: number
  unpaidAmount: number
  percent: number
  tone: DashboardSnapshotTone
}

type OverviewKpiTone = 'primary' | 'success' | 'warning' | 'danger'
type OverviewSparklineKind = 'sales' | 'paid' | 'unpaid' | 'paidRate'
type DashboardSnapshotTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

interface OverviewKpiCard {
  key: OverviewSparklineKind
  label: string
  value: string
  summary: string
  actionLabel: string
  tone: OverviewKpiTone
  section: DashboardSection
  chartOption: EChartsCoreOption
}

interface RoleSnapshotAction {
  key: string
  label: string
  section?: DashboardSection
  scrollTarget?: string
  metricCode?: string
  inventoryView?: ProductInventoryView
  inventoryDetail?: InventoryDetailKind
}

interface RoleSnapshotCard extends RoleSnapshotAction {
  value: string
  summary: string
  tone: DashboardSnapshotTone
  progress?: number
}

interface RoleSnapshot {
  eyebrow: string
  value: string
  summary: string
  cards: RoleSnapshotCard[]
  actions: RoleSnapshotAction[]
  formulas: string[]
}

interface BiRefreshMode {
  key: string
  label: string
  description: string
  summary: string
  steps: string[]
  sourceCodes: SupplyDashboardRefreshSourceCode[]
}

interface OverviewCustomerFunnelRow {
  key: string
  label: string
  value: string
  percent: number
}

interface CurrentMonthTimeline {
  label: string
  elapsedDays: number
  remainingDays: number
  rate: number
}

interface PaymentRiskLevelSummaryRow {
  code: Exclude<PaymentRiskLevelCode, 'none'>
  label: string
  cityCount: number
  unpaidAmount: number
  percent: number
  color: string
}

interface PaymentRiskCityGroup extends PaymentRiskLevelSummaryRow {
  rows: SupplyDashboardRankingItem[]
}

const filters = reactive<DashboardFilters>({
  dateRange: [],
  regionCode: '',
  ownerStaffCode: '',
  customerTypeCode: '',
  productCategoryId: '',
  sourceSystemCode: '',
})

const loading = ref(false)
const refreshing = ref(false)
const refreshPanelVisible = ref(false)
const selectedRefreshModeKey = ref('all')
const errorMessage = ref('')
const overview = ref<SupplyDashboardOverview | null>(null)
const reconciliation = ref<SupplyDashboardReconciliation | null>(null)
const reconciliationLoading = ref(false)
type ProductBreakdown = 'PRODUCT' | 'SKU' | 'CATEGORY' | 'BRAND'
type ProductSalesVisibility = 'SOLD_ONLY' | 'WITH_UNSOLD'
type ProductInventoryView = 'procurement' | 'inventory' | 'replenishment'
type InventoryDetailKind = 'procurement' | 'shipped' | 'remaining' | 'replenishment'
type QuickPeriod = 'latest' | 'today' | 'month' | 'year' | 'custom'
type RankingAmountField = 'salesAmount' | 'paidAmount' | 'unpaidAmount'
type SalesMonthlyMetricField = 'salesAmount' | 'paidAmount' | 'orderCount'
type OverviewShareMode = 'CITY' | 'CATEGORY' | 'BRAND' | 'SOURCE'
const productBreakdown = ref<ProductBreakdown>('PRODUCT')
const productSalesVisibility = ref<ProductSalesVisibility>('SOLD_ONLY')
const productInventoryView = ref<ProductInventoryView>('procurement')
const activeInventoryDetailKind = ref<InventoryDetailKind>('procurement')
const inventoryDetailVisible = ref(false)
const quickPeriod = ref<QuickPeriod>('latest')
const overviewShareMode = ref<OverviewShareMode>('CITY')
const selectedCustomerSegment = ref('')
const selectedCustomerRiskLevel = ref<CustomerRiskLevel | ''>('')
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const navigationStore = useNavigationStore()
const crmAreas = ref<CrmDictionaryView[]>([])
const crmCustomerTypes = ref<CrmDictionaryView[]>([])
const filterOptions = ref<SupplyDashboardFilterOptions>({
  regions: [],
  salesOwners: [],
  customerTypes: [],
  productCategories: [],
  sourceSystems: [
    { optionType: 'SOURCE_SYSTEM', optionValue: 'DINGHUOBAO', optionLabel: '订货宝', usageCount: 0 },
    { optionType: 'SOURCE_SYSTEM', optionValue: 'FEISHU', optionLabel: '飞书', usageCount: 0 },
    { optionType: 'SOURCE_SYSTEM', optionValue: 'MANUAL', optionLabel: '手工订单', usageCount: 0 },
  ],
})

const targetMetricDefinitions: TargetMetricDefinition[] = [
  { code: 'CONTACTED_CUSTOMER', name: '建联', unit: 'COUNT' },
  { code: 'COOPERATED_CUSTOMER', name: '合作', unit: 'COUNT' },
  { code: 'SALES_AMOUNT', name: '交易额', unit: 'CNY' },
  { code: 'PAID_AMOUNT', name: '回款额', unit: 'CNY' },
]

const productUnitLabels: Record<string, string> = {
  BUCKET: '桶',
  BUCKETS: '桶',
  BKT: '桶',
  BOX: '箱',
  BOXES: '箱',
  CASE: '箱',
  PORTION: '份',
  SET: '套',
  PIECE: '件',
  PIECES: '件',
  PCS: '件',
  PC: '件',
  EA: '件',
  EACH: '件',
  UNIT: '件',
  BED: '床',
  PAIR: '副',
  BOTTLE: '瓶',
  BOTTLES: '瓶',
  BOTT: '瓶',
  BAG: '袋',
  PACK: '包',
  STRIP: '条',
  GRAIN: '颗',
}

const chartTheme = {
  primary: '#2563eb',
  success: '#16a34a',
  warning: '#f97316',
  danger: '#dc2626',
  profit: '#0f766e',
  cost: '#7c3aed',
  muted: '#94a3b8',
  label: '#0f172a',
  text: '#64748b',
  axisLine: '#cbd5e1',
  splitLine: '#e2e8f0',
  tooltipBg: 'rgba(255, 255, 255, 0.98)',
  tooltipBorder: '#dbeafe',
}

const chartPalette = [
  chartTheme.primary,
  chartTheme.success,
  chartTheme.warning,
  chartTheme.cost,
  chartTheme.profit,
  '#eab308',
  chartTheme.danger,
  chartTheme.muted,
]

function dashboardTooltipStyle() {
  return {
    backgroundColor: chartTheme.tooltipBg,
    borderColor: chartTheme.tooltipBorder,
    textStyle: { color: chartTheme.label },
    extraCssText: 'box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12); border-radius: 6px;',
  }
}

const inventoryDetailTitles: Record<InventoryDetailKind, string> = {
  procurement: '采购明细',
  shipped: '已发货明细',
  remaining: '当前留存明细',
  replenishment: '建议补货明细',
}

const inventoryDetailQuantityLabels: Record<InventoryDetailKind, string> = {
  procurement: '采购量',
  shipped: '已发货',
  remaining: '当前留存',
  replenishment: '建议补货',
}

const activitySampleKpis: ActivityKpi[] = [
  { label: '进行中活动数', value: '3' },
  { label: '累计活动投入', value: '¥5.8万' },
  { label: '带动交易额', value: '¥18.6万' },
  { label: '活动 ROI', value: '3.2' },
]

const activitySampleCampaigns: ActivityCampaign[] = [
  {
    name: '杨掌柜方便面开学季促销',
    dateRange: '2026.09.01 - 2026.09.15',
    regions: '杭州、成都、武汉',
    type: '满减/赠品',
    budget: '¥2.0万',
    used: '¥1.25万',
    roi: '5.2',
    usageRate: 62.5,
  },
  {
    name: '台球周边联名活动',
    dateRange: '2026.09.05 - 2026.09.20',
    regions: '深圳、杭州',
    type: '联名/折扣',
    budget: '¥1.2万',
    used: '¥0.76万',
    roi: '6.8',
    usageRate: 63.3,
  },
  {
    name: '粉面菜蛋试吃转化',
    dateRange: '2026.09.10 - 2026.09.25',
    regions: '北京、西安',
    type: '样品/转化',
    budget: '¥2.6万',
    used: '¥1.89万',
    roi: '3.5',
    usageRate: 72.7,
  },
]

const activitySampleRanking: ActivityRankingRow[] = [
  { rank: 1, name: '台球周边联名活动', roi: '6.8', salesAmount: '¥5.2万', costAmount: '¥0.76万' },
  { rank: 2, name: '方便面开学季促销', roi: '5.2', salesAmount: '¥6.5万', costAmount: '¥1.25万' },
  { rank: 3, name: '杨掌柜满减活动', roi: '3.5', salesAmount: '¥3.8万', costAmount: '¥1.08万' },
]

const productCategoryOptions = computed<ErpProductCategoryView[]>(() => {
  return filterOptions.value.productCategories.map((item, index) => ({
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
  }))
})

const regionFilterOptions = computed(() => {
  const optionMap = new Map<string, SupplyDashboardFilterOptions['regions'][number]>()
  filterOptions.value.regions.forEach((item) => {
    optionMap.set(item.optionValue, item)
  })
  crmAreas.value.forEach((item, index) => {
    if (!item.code || optionMap.has(item.code)) return
    optionMap.set(item.code, {
      optionType: 'REGION',
      optionValue: item.code,
      optionLabel: item.name || item.code,
      usageCount: 0,
      ordinal: index,
    })
  })
  return [...optionMap.values()].sort((left, right) =>
    Number(right.usageCount || 0) - Number(left.usageCount || 0)
    || Number(left.ordinal || 0) - Number(right.ordinal || 0),
  )
})

type DashboardSection = 'overview' | 'sales' | 'city-operating' | 'customer' | 'activity' | 'product-inventory' | 'sales-collection' | 'product-sales' | 'gross-profit' | 'payment-risk' | 'city-cost' | 'inventory-risk'

const dashboardSections: Record<DashboardSection, { title: string; description: string; metricCodes: string[] }> = {
  overview: {
    title: '供应链经营总览',
    description: '领导视角：只看交易、回款、客户、城市表现和风险摘要。',
    metricCodes: ['sales_amount', 'paid_amount', 'unpaid_amount', 'order_count', 'contacted_customer_count', 'cooperated_customer_count', 'repeat_customer_count'],
  },
  sales: {
    title: '销售看板',
    description: '销售管理视角：看交易、回款、客户复购、人员排名和需要跟进的风险客户。',
    metricCodes: [
      'sales_amount',
      'paid_amount',
      'unpaid_amount',
      'receipt_amount',
      'order_count',
      'cooperated_customer_count',
      'repeat_customer_count',
      'payment_risk_amount',
      'payment_risk_customer_count',
      'payment_high_risk_customer_count',
      'payment_avg_overdue_days',
      'payment_risk_amount_rate',
    ],
  },
  'city-operating': {
    title: '城市经营看板',
    description: '城市总视角：看每个城市的交易、回款、客户和目标完成情况。',
    metricCodes: ['sales_amount', 'paid_amount', 'unpaid_amount', 'order_count', 'contacted_customer_count', 'cooperated_customer_count', 'repeat_customer_count', 'target_achievement_rate', 'payment_risk_amount'],
  },
  customer: {
    title: '客户看板',
    description: '客户运营视角：看客户ABC分层、活跃度、流失预警和业务归属。',
    metricCodes: ['active_customer_count', 'contacted_customer_count', 'cooperated_customer_count', 'repeat_customer_count', 'customer_activity_score', 'customer_churn_risk_count', 'unpaid_amount'],
  },
  activity: {
    title: '活动看板',
    description: '运营视角：先展示活动投入产出样例，后续接真实活动数据。',
    metricCodes: [],
  },
  'product-inventory': {
    title: '商品/库存看板',
    description: '运营视角：采购履约、库存留存和补货建议分开处理，商品销售进入商品销售统计。',
    metricCodes: ['sales_amount', 'order_count', 'ordering_customer_count'],
  },
  'sales-collection': {
    title: '销售与回款看板',
    description: '销售管理视角：对比交易额、订单累计已收和实际回款记录。',
    metricCodes: ['sales_amount', 'paid_amount', 'unpaid_amount', 'receipt_amount', 'order_count'],
  },
  'product-sales': {
    title: '商品销售统计',
    description: '运营视角：按商品、分类、品牌查看订货数量、订货金额和客户覆盖。',
    metricCodes: ['sales_amount', 'order_count', 'ordering_customer_count'],
  },
  'gross-profit': {
    title: '销售毛利分析',
    description: '受控分析视角：只展示估算毛利和成本覆盖率，不当作真实利润。',
    metricCodes: ['sales_net_amount', 'refund_amount', 'estimated_cost_amount', 'estimated_gross_profit', 'estimated_gross_profit_rate', 'cost_coverage_rate'],
  },
  'payment-risk': {
    title: '回款风险看板',
    description: '销售跟进视角：先看风险金额，再按城市和销售拆出跟进对象。',
    metricCodes: ['unpaid_amount', 'payment_risk_amount', 'payment_risk_customer_count', 'payment_high_risk_customer_count', 'payment_avg_overdue_days', 'payment_risk_amount_rate'],
  },
  'city-cost': {
    title: '城市成本看板',
    description: '城市运营视角：只展示已导入城市运营成本、预算偏差和成本率。',
    metricCodes: ['city_cost_amount', 'city_cost_rate', 'sales_amount'],
  },
  'inventory-risk': {
    title: '库存风险看板',
    description: '仓储运营视角：聚焦可用不足、锁定异常和历史库存风险。',
    metricCodes: ['inventory_risk_count'],
  },
}

const dashboardRouteNames: Record<DashboardSection, string> = {
  overview: 'SupplyBi',
  sales: 'SupplyBiSales',
  'city-operating': 'SupplyBiCityOperating',
  customer: 'SupplyBiCustomer',
  activity: 'SupplyBiActivity',
  'product-inventory': 'SupplyBiProductInventory',
  'sales-collection': 'SupplyBiSalesCollection',
  'product-sales': 'SupplyBiProductSales',
  'gross-profit': 'SupplyBiGrossProfit',
  'payment-risk': 'SupplyBiPaymentRisk',
  'city-cost': 'SupplyBiCityCost',
  'inventory-risk': 'SupplyBiInventoryRisk',
}

const legacyDashboardRouteNames: Partial<Record<DashboardSection, string>> = {
  sales: 'SupplyBiSalesCollection',
}

const dashboardSection = computed<DashboardSection>(() => {
  const value = String(route.meta.dashboardSection || 'overview')
  return value in dashboardSections ? value as DashboardSection : 'overview'
})
const dashboardTitle = computed(() => dashboardSections[dashboardSection.value].title)
const dashboardDescription = computed(() => dashboardSections[dashboardSection.value].description)
const isOverviewSection = computed(() => dashboardSection.value === 'overview')
const isCityOperatingSection = computed(() => dashboardSection.value === 'city-operating')
const isCustomerSection = computed(() => dashboardSection.value === 'customer')
const isSalesBoardSection = computed(() => dashboardSection.value === 'sales')
const isSalesCollectionDetailSection = computed(() => dashboardSection.value === 'sales-collection')
const isPaymentRiskDetailSection = computed(() => dashboardSection.value === 'payment-risk')
const showQuickPeriodBar = computed(() => dashboardSection.value !== 'activity')
const isProductAnalysisSection = computed(() =>
  dashboardSection.value === 'product-sales',
)
const isProductInventorySection = computed(() => dashboardSection.value === 'product-inventory')
const isProductSalesVisualSection = computed(() =>
  isProductAnalysisSection.value
  || (isCityOperatingSection.value && Boolean(filters.regionCode)),
)
const isActivitySection = computed(() => dashboardSection.value === 'activity')
const isGrossProfitSection = computed(() => dashboardSection.value === 'gross-profit')
const rankingPreviewLimit = computed(() => isOverviewSection.value ? 6 : Number.MAX_SAFE_INTEGER)
const showRoleSnapshot = computed(() =>
  !isOverviewSection.value
  && !isSalesBoardSection.value
  && !isCustomerSection.value
  && !isActivitySection.value
  && !isProductAnalysisSection.value
  && !isProductInventorySection.value
  && !isPaymentRiskDetailSection.value,
)
const showSalesCollectionSection = computed(() =>
  isSalesCollectionDetailSection.value
  || (isCityOperatingSection.value && Boolean(filters.regionCode)),
)
const showCityRankingSection = computed(() =>
  isCityOperatingSection.value,
)
const showTargetCompletionSection = computed(() => isCityOperatingSection.value)
const showActivitySection = computed(() => isActivitySection.value)
const showSalesRankingSection = computed(() =>
  isCityOperatingSection.value && Boolean(filters.regionCode),
)
const showProductSalesSection = computed(() =>
  isProductAnalysisSection.value
  || (isCityOperatingSection.value && Boolean(filters.regionCode))
  || isGrossProfitSection.value,
)
const showInventoryOperationSection = computed(() =>
  isProductInventorySection.value,
)
const showPaymentRiskSection = computed(() =>
  isPaymentRiskDetailSection.value,
)
const showCityCostSection = computed(() => dashboardSection.value === 'city-cost')
const showInventoryRiskSection = computed(() => dashboardSection.value === 'inventory-risk')
const showDashboardGrid = computed(() =>
  showSalesCollectionSection.value
  || showCityRankingSection.value
  || showTargetCompletionSection.value
  || showSourceSystemSection.value
  || showActivitySection.value
  || showProductSalesSection.value
  || showInventoryOperationSection.value
  || showCityCostSection.value
  || showSalesRankingSection.value
  || showPaymentRiskSection.value
  || showInventoryRiskSection.value,
)

const grossProfitMetric = computed(() => metricByCode('estimated_gross_profit'))
const grossProfitRateMetric = computed(() => metricByCode('estimated_gross_profit_rate'))
const costCoverageRateMetric = computed(() => metricByCode('cost_coverage_rate'))
const grossProfitCostCoverageRate = computed(() => Number(costCoverageRateMetric.value?.value || 0))
const grossProfitCostCovered = computed(() => grossProfitCostCoverageRate.value > 0)
const salesNetAmountMetric = computed(() => metricByCode('sales_net_amount'))
const refundAmountMetric = computed(() => metricByCode('refund_amount'))
const estimatedCostAmountMetric = computed(() => metricByCode('estimated_cost_amount'))
const orderCountMetric = computed(() => metricByCode('order_count'))
const orderingCustomerCountMetric = computed(() => metricByCode('ordering_customer_count'))
const contactedCustomerMetric = computed(() => metricByCode('contacted_customer_count'))
const cooperatedCustomerMetric = computed(() => metricByCode('cooperated_customer_count'))
const repeatCustomerMetric = computed(() => metricByCode('repeat_customer_count'))
const salesAmountMetric = computed(() => metricByCode('sales_amount'))
const paidAmountMetric = computed(() => metricByCode('paid_amount'))
const unpaidAmountMetric = computed(() => metricByCode('unpaid_amount'))
const paymentRiskAmountMetric = computed(() => metricByCode('payment_risk_amount'))
const paymentRiskCustomerMetric = computed(() => metricByCode('payment_risk_customer_count'))
const paymentHighRiskCustomerMetric = computed(() => metricByCode('payment_high_risk_customer_count'))
const paymentAvgOverdueMetric = computed(() => metricByCode('payment_avg_overdue_days'))
const paymentRiskAmountRateMetric = computed(() => metricByCode('payment_risk_amount_rate'))
const targetAchievementRateMetric = computed(() => metricByCode('target_achievement_rate'))
const customerActivityMetric = computed(() => metricByCode('customer_activity_score'))
const customerChurnRiskMetric = computed(() => metricByCode('customer_churn_risk_count'))
const cityCostMetric = computed(() => overview.value?.metrics.find((item) => item.metricCode === 'city_cost_amount') || null)
const cityCostRateMetric = computed(() => overview.value?.metrics.find((item) => item.metricCode === 'city_cost_rate') || null)
const inventoryRiskMetric = computed(() => metricByCode('inventory_risk_count'))
const rawProductSales = computed<SupplyDashboardProductSalesItem[]>(() => {
  if (!overview.value) return []
  if (productBreakdown.value === 'SKU') return overview.value.skuSalesRanking || []
  if (productBreakdown.value === 'CATEGORY') return overview.value.categorySalesRanking || []
  if (productBreakdown.value === 'BRAND') return overview.value.brandSalesRanking || []
  return overview.value.productSalesRanking || []
})
const productCategoryPreviewRows = computed(() =>
  [...(overview.value?.categorySalesRanking || [])]
    .filter(hasProductSales)
    .sort((left, right) => Number(right.salesAmount || 0) - Number(left.salesAmount || 0))
    .slice(0, 3),
)
const productBrandPreviewRows = computed(() =>
  [...(overview.value?.brandSalesRanking || [])]
    .filter(hasProductSales)
    .sort((left, right) => Number(right.salesAmount || 0) - Number(left.salesAmount || 0))
    .slice(0, 3),
)
const soldProductSales = computed(() => rawProductSales.value.filter(hasProductSales))
const displayedProductSales = computed(() => {
  if (productBreakdown.value !== 'PRODUCT') return rawProductSales.value
  return productSalesVisibility.value === 'WITH_UNSOLD' ? rawProductSales.value : soldProductSales.value
})
const analysisProductSales = computed(() => {
  if (!isGrossProfitSection.value || !grossProfitCostCovered.value) return displayedProductSales.value
  return [...displayedProductSales.value].sort((left, right) =>
    Number(right.estimatedGrossProfit || 0) - Number(left.estimatedGrossProfit || 0),
  )
})
const productPanelTitle = computed(() => {
  if (isGrossProfitSection.value) return '销售毛利分析'
  if (isCityOperatingSection.value && filters.regionCode) return '城市商品结构'
  return '商品销售统计'
})
const productPanelDescription = computed(() => isGrossProfitSection.value
  ? '来自 BI 订单行事实表，成本使用 ERP 采购参考价估算，退款按订单行金额比例分摊'
  : isCityOperatingSection.value && filters.regionCode
    ? `${regionName(filters.regionCode)}的商品、SKU、分类、品牌贡献，跟随上方日期和销售筛选`
  : '默认展示本期有销售商品；按商品、SKU、分类、品牌切换查看订货数量、订货金额和客户覆盖')
const productDimensionLabel = computed(() => {
  if (productBreakdown.value === 'SKU') return 'SKU'
  if (productBreakdown.value === 'CATEGORY') return '分类'
  if (productBreakdown.value === 'BRAND') return '品牌'
  return '商品'
})
const productActionLabel = computed(() => {
  if (productBreakdown.value === 'SKU') return '查看SKU商品'
  if (productBreakdown.value === 'CATEGORY') return '筛选分类'
  if (productBreakdown.value === 'BRAND') return '查看品牌商品'
  return '查看商品'
})
const productOrderActionLabel = computed(() => {
  if (productBreakdown.value === 'CATEGORY') return '筛到商品明细'
  if (productBreakdown.value === 'BRAND') return '查看品牌商品'
  return '订单明细'
})
const showGrossProfitColumns = computed(() => isGrossProfitSection.value)
const showProductSalesChart = computed(() =>
  (isProductSalesVisualSection.value || (isGrossProfitSection.value && grossProfitCostCovered.value))
  && displayedProductSales.value.length > 0,
)
const showProductVolumeChart = computed(() =>
  isProductSalesVisualSection.value && displayedProductSales.value.length > 0,
)
const showGrossProfitCoverageWarning = computed(() =>
  isGrossProfitSection.value && displayedProductSales.value.length > 0 && !grossProfitCostCovered.value,
)
const productSalesTableRows = computed(() =>
  isOverviewSection.value ? analysisProductSales.value.slice(0, 8) : analysisProductSales.value,
)
const productChartHeight = computed(() => isGrossProfitSection.value ? 380 : productBreakdown.value === 'PRODUCT' ? 360 : 320)
const productVolumeChartHeight = computed(() => productChartHeight.value)
const productTableMaxHeight = computed(() => isOverviewSection.value ? 390 : isGrossProfitSection.value ? 520 : 460)
const refreshModes: BiRefreshMode[] = [
  {
    key: 'all',
    label: '全链路',
    description: '按依赖顺序刷新客户、订单、商品、库存和对账快照，适合重新导入后的完整验收。',
    summary: 'CRM + Order + ERP + BI',
    steps: ['客户', '订单/明细', '回款', '商品/库存', '对账'],
    sourceCodes: [
      'CRM_CUSTOMER',
      'ORDER_SALES_ORDER',
      'ORDER_SALES_ORDER_LINE',
      'ORDER_PAYMENT_RECORD',
      'ERP_PRODUCT',
      'ERP_STOCK_BALANCE',
      'ERP_INVENTORY_OPERATION',
      'BI_RECONCILIATION_CURRENT',
    ],
  },
  {
    key: 'sales-collection',
    label: '销售/回款',
    description: '只刷新 Order 销售订单、订单行和回款记录，适合导入订单后快速更新销售与回款看板。',
    summary: '订单 + 订单行 + 回款',
    steps: ['销售订单', '订单行', '回款记录', '对账'],
    sourceCodes: ['ORDER_SALES_ORDER', 'ORDER_SALES_ORDER_LINE', 'ORDER_PAYMENT_RECORD', 'BI_RECONCILIATION_CURRENT'],
  },
  {
    key: 'customer',
    label: '客户主数据',
    description: '只刷新 CRM 客户维度，并回填订单和回款事实上的客户归属。',
    summary: '客户/门店维度',
    steps: ['CRM客户', '区域/类型', '归属回填'],
    sourceCodes: ['CRM_CUSTOMER'],
  },
  {
    key: 'product-inventory',
    label: '商品/库存',
    description: '只刷新 ERP 商品、库存余额和采购/发货流转，适合商品库存看板单独修复。',
    summary: '商品 + 库存 + 流转',
    steps: ['ERP商品', '库存余额', '库存流转', '对账'],
    sourceCodes: ['ERP_PRODUCT', 'ERP_STOCK_BALANCE', 'ERP_INVENTORY_OPERATION', 'BI_RECONCILIATION_CURRENT'],
  },
  {
    key: 'payment-risk',
    label: '回款风险',
    description: '刷新风险判断依赖的客户账期、销售订单和回款事实。',
    summary: '客户账期 + 订单 + 回款',
    steps: ['客户账期', '销售订单', '回款记录', '对账'],
    sourceCodes: ['CRM_CUSTOMER', 'ORDER_SALES_ORDER', 'ORDER_PAYMENT_RECORD', 'BI_RECONCILIATION_CURRENT'],
  },
]
const canRefreshData = computed(() => authStore.hasPermission('analytics:refresh:write'))
const selectedRefreshMode = computed(() =>
  refreshModes.find((mode) => mode.key === selectedRefreshModeKey.value) || refreshModes[0],
)
const reconciliationIssueRows = computed(() =>
  (reconciliation.value?.items || []).filter((item) => item.status === 'DIFF'),
)
const reconciliationStatusLabel = computed(() => {
  if (reconciliationLoading.value) return '核对中'
  if (!reconciliation.value) return '未核对'
  if (reconciliation.value.status === 'PASS') return '一致'
  if (reconciliation.value.status === 'DIFF') return '有差异'
  if (reconciliation.value.status === 'EMPTY') return '无数据'
  return reconciliation.value.status
})
const reconciliationStatusTagType = computed<TagProps['type']>(() => {
  if (reconciliation.value?.status === 'PASS') return 'success'
  if (reconciliation.value?.status === 'DIFF') return 'danger'
  return 'info'
})
const reconciliationEmptyText = computed(() => {
  if (!reconciliation.value) return '同步后会自动核对业务表与 BI 表'
  if (reconciliation.value.status === 'PASS') return '业务表与 BI 表一致'
  return '当前筛选范围暂无可核对数据'
})
const cityCostRows = computed(() => overview.value?.cityCostRanking || [])
const cityCostBudgetTotal = computed(() => cityCostRows.value.reduce((total, item) => total + Number(item.budgetAmount || 0), 0))
const cityCostVarianceTotal = computed(() => cityCostRows.value.reduce((total, item) => total + Number(item.varianceAmount || 0), 0))
const cityCostHasData = computed(() => Number(cityCostMetric.value?.value || 0) > 0 || Boolean(cityCostRows.value.length))
const latestBusinessDataTime = computed(() => {
  const values = (overview.value?.freshness || [])
    .map((item) => item.latestUpdatedTime)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
  if (!values.length) return overview.value?.generatedAt || null
  return new Date(Math.max(...values)).toISOString()
})
const citySalesRanking = computed<SupplyDashboardRankingItem[]>(() =>
  (overview.value?.citySalesRanking || []).map((item) => ({
    ...item,
    dimensionName: regionName(item.dimensionCode, item.dimensionName),
  })),
)
const salesRanking = computed<SupplyDashboardRankingItem[]>(() => overview.value?.salesRanking || [])
const salesPaidRanking = computed(() => sortRankingBy(salesRanking.value, 'paidAmount'))
const salesMonthlyPerformance = computed<SupplyDashboardSalesMonthlyPerformance[]>(() =>
  overview.value?.salesMonthlyPerformance || [],
)
const hasSalesMonthlyPerformance = computed(() => salesMonthlyPerformance.value.length > 0)
const hasMultiMonthSelectedRange = computed(() => {
  const [from, to] = filters.dateRange
  if (!from || !to) return salesMonthlyPerformance.value.length > 1
  return from.slice(0, 7) !== to.slice(0, 7)
})
const shouldUseSalesMonthlyComparison = computed(() =>
  hasSalesMonthlyPerformance.value
  && (quickPeriod.value === 'year' || hasMultiMonthSelectedRange.value),
)
const hasSalesPerformanceComparison = computed(() =>
  shouldUseSalesMonthlyComparison.value || salesRanking.value.length > 0,
)
const salesComparisonPeriodLabel = computed(() => {
  if (quickPeriod.value === 'today') return '今日'
  if (quickPeriod.value === 'month') return '本月'
  if (quickPeriod.value === 'year') return '本年'
  if (quickPeriod.value === 'latest') return shouldUseSalesMonthlyComparison.value ? '最新周期' : '本期'
  return hasMultiMonthSelectedRange.value ? '所选周期' : '本期'
})
const salesAmountComparisonTitle = computed(() => `${salesComparisonPeriodLabel.value}销售额对比`)
const salesAmountComparisonDescription = computed(() =>
  shouldUseSalesMonthlyComparison.value
    ? '跨月按月份和销售人员聚合，筛选城市后只看该城市'
    : `${rangeLabel.value} · 按销售人员排行展示`,
)
const salesPaidComparisonTitle = computed(() => `${salesComparisonPeriodLabel.value}回款额对比`)
const salesPaidComparisonDescription = computed(() =>
  shouldUseSalesMonthlyComparison.value
    ? '跨月按订单累计已收统计，方便和销售额一起看缺口'
    : `${rangeLabel.value} · 按订单累计已收排行展示`,
)
const salesPodiumRows = computed(() => salesRanking.value.slice(0, 3))
const salesBoardTableRows = computed<SalesBoardTableRow[]>(() =>
  salesRanking.value.map((item) => ({
    ...item,
    contactedTargetMetric: salesTargetCompletionMap.value.get(`${item.dimensionCode}:CONTACTED_CUSTOMER`),
    cooperatedTargetMetric: salesTargetCompletionMap.value.get(`${item.dimensionCode}:COOPERATED_CUSTOMER`),
    salesTargetMetric: salesTargetCompletionMap.value.get(`${item.dimensionCode}:SALES_AMOUNT`),
    paidTargetMetric: salesTargetCompletionMap.value.get(`${item.dimensionCode}:PAID_AMOUNT`),
    riskLevelCode: paymentRiskLevelCodeByRate(item.rate, Number(item.salesAmount || 0) > 0),
  })),
)
const salesMonthlyOwners = computed<SalesMonthlyOwner[]>(() => {
  const ranked = salesRanking.value
    .filter((item) => item.dimensionCode)
    .slice(0, 8)
    .map((item) => ({
      code: item.dimensionCode,
      name: item.dimensionName || item.dimensionCode,
    }))
  if (ranked.length) return ranked
  const totals = new Map<string, { name: string, value: number }>()
  salesMonthlyPerformance.value.forEach((item) => {
    const code = item.ownerStaffCode || 'UNKNOWN'
    const current = totals.get(code) || {
      name: item.ownerStaffName || item.ownerStaffCode || '未分配销售',
      value: 0,
    }
    current.value += Number(item.salesAmount || 0)
    totals.set(code, current)
  })
  return [...totals.entries()]
    .sort((left, right) => right[1].value - left[1].value)
    .slice(0, 8)
    .map(([code, item]) => ({ code, name: item.name }))
})
const salesTargetCompletionMap = computed(() =>
  buildTargetCompletionMap(overview.value?.salesTargetCompletions || []),
)
const cityTargetCompletionMap = computed(() =>
  buildTargetCompletionMap(overview.value?.cityTargetCompletions || []),
)
const salesRankingPreview = computed<SalesRankingDisplayRow[]>(() =>
  attachSalesTargetMetric(salesRanking.value.slice(0, rankingPreviewLimit.value), 'SALES_AMOUNT'),
)
const salesPaidRankingPreview = computed<SalesRankingDisplayRow[]>(() =>
  attachSalesTargetMetric(salesPaidRanking.value.slice(0, rankingPreviewLimit.value), 'PAID_AMOUNT'),
)
const salesRankingChartRows = computed(() => salesRanking.value.slice(0, 10))
const salesPaidRankingChartRows = computed(() => salesPaidRanking.value.slice(0, 10))
const salesRankingChartHeight = computed(() =>
  Math.max(240, Math.min(420, 112 + Math.max(salesRankingChartRows.value.length, salesPaidRankingChartRows.value.length) * 30)),
)
const salesAmountRankingChartOption = computed<EChartsCoreOption>(() =>
  buildRankingAmountChartOption(salesRankingChartRows.value, 'salesAmount', '交易额', chartTheme.primary),
)
const salesPaidRankingChartOption = computed<EChartsCoreOption>(() =>
  buildRankingAmountChartOption(salesPaidRankingChartRows.value, 'paidAmount', '回款额', chartTheme.success),
)
const salesPaymentProgressChartOption = computed<EChartsCoreOption>(() =>
  buildPaymentProgressRingOption(
    Number(paidAmountMetric.value?.value || 0),
    Number(unpaidAmountMetric.value?.value || 0),
  ),
)
const salesAmountComparisonChartOption = computed<EChartsCoreOption>(() =>
  shouldUseSalesMonthlyComparison.value
    ? buildSalesMonthlyComparisonChartOption(
      salesMonthlyPerformance.value,
      salesMonthlyOwners.value,
      'salesAmount',
      '销售额',
    )
    : buildRankingAmountChartOption(salesRankingChartRows.value, 'salesAmount', '交易额', chartTheme.primary),
)
const salesPaidComparisonChartOption = computed<EChartsCoreOption>(() =>
  shouldUseSalesMonthlyComparison.value
    ? buildSalesMonthlyComparisonChartOption(
      salesMonthlyPerformance.value,
      salesMonthlyOwners.value,
      'paidAmount',
      '回款额',
    )
    : buildRankingAmountChartOption(salesPaidRankingChartRows.value, 'paidAmount', '回款额', chartTheme.success),
)
const salesGoalProgressRows = computed<SalesGoalProgressRow[]>(() => [
  buildSalesGoalProgressRow('SALES_AMOUNT', '本月交易额目标', 'CNY'),
  buildSalesGoalProgressRow('PAID_AMOUNT', '本月回款额目标', 'CNY'),
])
const hasSalesGoalProgress = computed(() => salesGoalProgressRows.value.some((row) => row.hasTarget))
const currentMonthTimeline = computed<CurrentMonthTimeline>(() => buildCurrentMonthTimeline())
const citySalesCityCount = computed(() => citySalesRanking.value.length)
const citySalesTotal = computed(() => citySalesRanking.value.reduce((total, item) => total + Number(item.salesAmount || 0), 0))
const cityPaidTotal = computed(() => citySalesRanking.value.reduce((total, item) => total + Number(item.paidAmount || 0), 0))
const cityOverallPaidRate = computed(() => citySalesTotal.value ? cityPaidTotal.value / citySalesTotal.value * 100 : 0)
const cityCustomerStatsByRegion = computed(() =>
  buildCityCustomerStatsByRegion(
    overview.value?.customerActivityRanking || [],
    overview.value?.customerChurnRiskRanking || [],
  ),
)
const cityTargetOverviewRows = computed<CityTargetOverviewRow[]>(() =>
  groupTargetCompletionRows(overview.value?.cityTargetCompletions || []),
)
const cityBusinessRows = computed<CityBusinessTableRow[]>(() =>
  attachCityCustomerStats(
    buildCityBusinessRows(citySalesRanking.value, cityTargetOverviewRows.value, cityTargetCompletionMap.value),
    cityCustomerStatsByRegion.value,
  ),
)
const overviewCityBusinessRows = computed(() => cityBusinessRows.value.slice(0, 8))
const cityActiveCustomerTotal = computed(() =>
  cityBusinessRows.value.reduce((total, item) => total + Number(item.activeCustomerCount || 0), 0),
)
const cityRepeatCustomerTotal = computed(() =>
  cityBusinessRows.value.reduce((total, item) => total + Number(item.repeatCustomerCount || 0), 0),
)
const cityHighValueCustomerTotal = computed(() =>
  cityBusinessRows.value.reduce((total, item) => total + Number(item.highValueCustomerCount || 0), 0),
)
const cityChurnRiskCustomerTotal = computed(() =>
  cityBusinessRows.value.reduce((total, item) => total + Number(item.churnRiskCustomerCount || 0), 0),
)
const cityOperatingCards = computed<CityOperatingCard[]>(() => [
  {
    key: 'city-sales',
    label: '城市交易额',
    value: formatMoneyWan(citySalesTotal.value),
    summary: `${formatNumber(citySalesCityCount.value)} 个城市有销售`,
    tone: 'primary',
  },
  {
    key: 'city-paid',
    label: '城市回款',
    value: formatMoneyWan(cityPaidTotal.value),
    summary: `整体回款率 ${formatPercent(cityOverallPaidRate.value)}`,
    tone: 'success',
    target: 'payment-risk',
  },
  {
    key: 'city-target',
    label: '目标城市',
    value: formatNumber(cityTargetOverviewRows.value.length),
    summary: targetAchievementRateMetric.value ? `平均完成 ${formatPercent(targetAchievementRateMetric.value.value)}` : '目标待配置',
    tone: targetAchievementRateMetric.value ? 'warning' : 'neutral',
  },
  {
    key: 'city-customer',
    label: '客户跟进池',
    value: `${formatNumber(cityActiveCustomerTotal.value)} / ${formatNumber(cityChurnRiskCustomerTotal.value)}`,
    summary: `活跃 / 预警，高价值 ${formatNumber(cityHighValueCustomerTotal.value)}，复购 ${formatNumber(cityRepeatCustomerTotal.value)}`,
    tone: cityChurnRiskCustomerTotal.value ? 'warning' : 'success',
    target: 'customer',
  },
])
const cityTargetHeatmapHeight = computed(() =>
  Math.max(260, Math.min(520, 150 + cityTargetOverviewRows.value.length * 24)),
)
const paymentRiskCityRanking = computed<SupplyDashboardRankingItem[]>(() =>
  (overview.value?.paymentRiskCityRanking || []).map((item) => ({
    ...item,
    dimensionName: regionName(item.dimensionCode, item.dimensionName),
  })),
)
const paymentRiskSalesRanking = computed<SupplyDashboardRankingItem[]>(() => overview.value?.paymentRiskSalesRanking || [])
const paymentAgingBuckets = computed<SupplyDashboardPaymentAgingBucket[]>(() => overview.value?.paymentAgingBuckets || [])
const paymentRiskPreviewLimit = computed(() => {
  if (isOverviewSection.value) return 5
  if (isSalesBoardSection.value) return 6
  return 12
})
const paymentRiskCityPreview = computed(() => paymentRiskCityRanking.value.slice(0, paymentRiskPreviewLimit.value))
const paymentRiskSalesPreview = computed(() => paymentRiskSalesRanking.value.slice(0, paymentRiskPreviewLimit.value))
const hasPaymentRiskRankingData = computed(() =>
  Boolean(paymentRiskCityRanking.value.length || paymentRiskSalesRanking.value.length),
)
const paymentRiskChartHeight = computed(() =>
  Math.max(240, Math.min(420, 112 + Math.max(paymentRiskCityPreview.value.length, paymentRiskSalesPreview.value.length) * 30)),
)
const paymentRiskCityChartOption = computed<EChartsCoreOption>(() =>
  buildPaymentRiskChartOption(paymentRiskCityPreview.value, '城市待回款'),
)
const paymentRiskSalesChartOption = computed<EChartsCoreOption>(() =>
  buildPaymentRiskChartOption(paymentRiskSalesPreview.value, '销售待回款'),
)
const customerSegments = computed<SupplyDashboardCustomerSegmentItem[]>(() => overview.value?.customerSegments || [])
const customerSegmentDisplayRows = computed<SupplyDashboardCustomerSegmentItem[]>(() => {
  if (customerSegments.value.length) return customerSegments.value
  return ['A', 'B', 'C'].map((code) => ({
    segmentCode: code,
    segmentName: `${code}类客户`,
    customerCount: 0,
    salesAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    averageActivityScore: 0,
    churnRiskCustomerCount: 0,
  }))
})
const customerActivityRanking = computed<SupplyDashboardCustomerActivityItem[]>(() => overview.value?.customerActivityRanking || [])
const customerChurnRiskRanking = computed<SupplyDashboardCustomerActivityItem[]>(() => overview.value?.customerChurnRiskRanking || [])
const selectedCustomerSegmentItem = computed(() =>
  customerSegmentDisplayRows.value.find((item) => item.segmentCode === selectedCustomerSegment.value) || null,
)
const customerAllSegmentCount = computed(() =>
  customerSegments.value.reduce((total, item) => total + Number(item.customerCount || 0), 0),
)
const customerTotalCount = computed(() => {
  if (selectedCustomerSegmentItem.value) return Number(selectedCustomerSegmentItem.value.customerCount || 0)
  return customerAllSegmentCount.value || Number(contactedCustomerMetric.value?.value || 0)
})
const customerActivityRows = computed(() => filterCustomerRows(customerActivityRanking.value))
const customerChurnRiskRows = computed(() => filterCustomerRows(customerChurnRiskRanking.value))
const customerActivityScatterRows = computed(() => customerActivityRows.value.slice(0, 80))
const showCustomerActivityScatterChart = computed(() =>
  customerActivityScatterRows.value.some((item) =>
    Number(item.activityScore || 0) > 0
    || Number(item.salesAmount || 0) > 0
    || Number(item.unpaidAmount || 0) > 0,
  ),
)
const customerValueMatrixRows = computed<CustomerValueMatrixRow[]>(() =>
  buildCustomerValueMatrixRows(mergeCustomerRows([
    ...customerActivityRows.value,
    ...customerChurnRiskRows.value,
  ])),
)
const customerValueThresholdText = computed(() => {
  const threshold = customerHighValueThreshold(mergeCustomerRows([
    ...customerActivityRows.value,
    ...customerChurnRiskRows.value,
  ]))
  return threshold > 0 ? formatMoneyWan(threshold) : '待形成'
})
const customerValueMatrixSummary = computed(() =>
  `高价值线 ${customerValueThresholdText.value}，活跃线 60 分；点击看下方客户清单`,
)
const customerPriorityRows = computed(() =>
  [...customerChurnRiskRows.value].sort((left, right) => customerPriorityScore(right) - customerPriorityScore(left)).slice(0, 8),
)
const customerFollowRows = computed(() => {
  const merged = new Map<string, SupplyDashboardCustomerActivityItem>()
  const collect = (rows: SupplyDashboardCustomerActivityItem[]) => {
    rows.forEach((item) => {
      const key = item.customerCode || item.customerName
      if (!key) return
      merged.set(key, { ...(merged.get(key) || item), ...item })
    })
  }
  collect(customerActivityRows.value)
  collect(customerChurnRiskRows.value)
  return [...merged.values()]
    .sort((left, right) => customerPriorityScore(right) - customerPriorityScore(left))
    .slice(0, 120)
})
const selectedCustomerSegmentName = computed(() =>
  customerSegmentDisplayRows.value.find((item) => item.segmentCode === selectedCustomerSegment.value)?.segmentName
    || selectedCustomerSegment.value,
)
const customerRiskCount = computed(() => {
  if (selectedCustomerSegmentItem.value) return Number(selectedCustomerSegmentItem.value.churnRiskCustomerCount || 0)
  const metricValue = Number(customerChurnRiskMetric.value?.value || 0)
  if (metricValue > 0) return metricValue
  return customerSegments.value.reduce((total, item) => total + Number(item.churnRiskCustomerCount || 0), 0)
})
const customerRiskRate = computed(() =>
  customerTotalCount.value ? customerRiskCount.value / customerTotalCount.value * 100 : 0,
)
const customerRiskTone = computed(() => {
  if (customerRiskRate.value >= 30) return 'danger'
  if (customerRiskRate.value >= 10) return 'warning'
  return 'success'
})
const customerHeroMetrics = computed<CustomerHeroMetric[]>(() => [
  {
    key: 'contacted',
    label: '建联客户',
    value: formatNumber(contactedCustomerMetric.value?.value),
    summary: 'CRM 有联系人或电话',
    metricCode: 'contacted_customer_count',
  },
  {
    key: 'cooperated',
    label: '下单客户',
    value: formatNumber(cooperatedCustomerMetric.value?.value),
    summary: '当前筛选范围内有成交',
    metricCode: 'cooperated_customer_count',
  },
  {
    key: 'repeat',
    label: '复购客户',
    value: formatNumber(repeatCustomerMetric.value?.value),
    summary: '当前筛选范围内复购',
    metricCode: 'repeat_customer_count',
  },
  {
    key: 'risk',
    label: '流失预警',
    value: formatNumber(customerRiskCount.value),
    summary: '优先进入跟进清单',
    target: 'risk',
  },
])
const customerRiskBuckets = computed<CustomerRiskBucket[]>(() => {
  const rows = mergeCustomerRows(filterCustomerRowsBySegmentOnly([
    ...customerActivityRanking.value,
    ...customerChurnRiskRanking.value,
  ]))
  const bucket = {
    HIGH: { count: 0, amount: 0 },
    MEDIUM: { count: 0, amount: 0 },
    LOW: { count: 0, amount: 0 },
  }
  rows.forEach((item) => {
    const level = normalizeCustomerRiskLevel(item.churnRiskLevel)
    bucket[level].count += 1
    bucket[level].amount += Number(item.unpaidAmount || 0)
  })
  return [
    { code: 'HIGH', label: '高危', count: bucket.HIGH.count, amount: bucket.HIGH.amount, tone: 'danger' },
    { code: 'MEDIUM', label: '预警', count: bucket.MEDIUM.count, amount: bucket.MEDIUM.amount, tone: 'warning' },
    { code: 'LOW', label: '稳定', count: bucket.LOW.count, amount: bucket.LOW.amount, tone: 'success' },
  ]
})
const customerSegmentChartOption = computed<EChartsCoreOption>(() => buildCustomerSegmentChartOption(customerSegments.value))
const customerValueActivityChartOption = computed<EChartsCoreOption>(() =>
  buildCustomerValueActivityChartOption(customerActivityScatterRows.value),
)
const sourceSystemBreakdown = computed<SupplyDashboardRankingItem[]>(() =>
  (overview.value?.sourceSystemBreakdown || []).map((item) => ({
    ...item,
    dimensionName: sourceSystemName(item.dimensionCode, item.dimensionName),
  })),
)
const overviewShareDescription = computed(() => {
  if (overviewShareMode.value === 'CITY') return '按城市看销售贡献'
  if (overviewShareMode.value === 'CATEGORY') return '按商品分类看销售贡献'
  if (overviewShareMode.value === 'BRAND') return '按品牌看销售贡献'
  return '按订单来源看销售贡献'
})
const overviewBusinessShareRows = computed<SupplyDashboardRankingItem[]>(() => {
  if (overviewShareMode.value === 'CITY') return citySalesRanking.value
  if (overviewShareMode.value === 'CATEGORY') return productSalesRowsAsRanking(overview.value?.categorySalesRanking || [], 'CATEGORY')
  if (overviewShareMode.value === 'BRAND') return productSalesRowsAsRanking(overview.value?.brandSalesRanking || [], 'BRAND')
  return sourceSystemBreakdown.value
})
const overviewBusinessShareDisplayRows = computed<BusinessShareDisplayRow[]>(() =>
  buildBusinessShareDisplayRows(overviewBusinessShareRows.value),
)
const overviewBusinessShareChartOption = computed<EChartsCoreOption>(() =>
  buildBusinessShareDonutOption(overviewBusinessShareDisplayRows.value, overviewShareDescription.value.replace('看销售贡献', '')),
)
const showSourceSystemSection = computed(() =>
  isSalesCollectionDetailSection.value && sourceSystemBreakdown.value.length > 0,
)
const cityCostTrendRows = computed(() => overview.value?.cityCostTrend || [])
const riskRows = computed<SupplyDashboardRiskItem[]>(() =>
  [...(overview.value?.risks || [])].sort((left, right) => {
    const riskDiff = riskLevelRank(left.riskLevel) - riskLevelRank(right.riskLevel)
    if (riskDiff !== 0) return riskDiff
    return Number(left.primaryValue || 0) - Number(right.primaryValue || 0)
  }),
)
const highRiskCount = computed(() => riskRows.value.filter((item) => item.riskLevel === 'HIGH').length)
const negativeInventoryTotal = computed(() =>
  riskRows.value.reduce((total, item) => {
    const value = Number(item.primaryValue || 0)
    return value < 0 ? total + Math.abs(value) : total
  }, 0),
)
const riskWarehouseCount = computed(() => new Set(riskRows.value.map((item) => riskWarehouseName(item)).filter(Boolean)).size)
const showInventoryRiskChart = computed(() => dashboardSection.value === 'inventory-risk' && riskRows.value.length > 0)
const inventoryItemRows = computed<SupplyDashboardInventoryItemSummary[]>(() =>
  (overview.value?.inventoryItemSummary || []).filter((item) =>
    Number(item.procurementQuantity || 0) !== 0
    || Number(item.shippedQuantity || 0) !== 0
    || Number(item.remainingQuantity || 0) !== 0
    || Number(item.inactiveRemainingQuantity || 0) !== 0,
  ),
)
const inventoryProcurementRows = computed(() =>
  inventoryItemRows.value.filter((item) => Number(item.procurementQuantity || 0) > 0),
)
const inventoryProcurementDetailRows = computed(() =>
  aggregateInventoryItemRows(inventoryProcurementRows.value),
)
const inventoryShippedRows = computed(() =>
  inventoryItemRows.value.filter((item) => Number(item.shippedQuantity || 0) > 0),
)
const inventoryShippedDetailRows = computed(() =>
  aggregateInventoryItemRows(inventoryShippedRows.value),
)
const inventoryRemainingRows = computed(() =>
  inventoryItemRows.value.filter((item) => Number(item.remainingQuantity || 0) > 0),
)
const inventoryRemainingDetailRows = computed(() =>
  aggregateInventoryItemRows(inventoryRemainingRows.value),
)
const hasInventoryOperationScopeConflict = computed(() =>
  Boolean(filters.regionCode || filters.ownerStaffCode || filters.customerTypeCode || filters.sourceSystemCode),
)
const showInventoryOperationData = computed(() => inventoryItemRows.value.length > 0 && !hasInventoryOperationScopeConflict.value)
const inventoryOperationEmptyText = computed(() =>
  hasInventoryOperationScopeConflict.value
    ? '采购、发货、留存暂只支持日期和商品分类筛选，请清除城市、销售、客户类型或订单来源后查看'
    : '暂无采购、发货或库存留存数据',
)
const inventoryOperationPanelTitle = computed(() => {
  if (isOverviewSection.value) return '库存/采购简表'
  if (productInventoryView.value === 'procurement') return '采购履约'
  if (productInventoryView.value === 'inventory') return '库存留存'
  return '补货建议'
})
const inventoryOperationPanelDescription = computed(() => {
  if (isOverviewSection.value) return '采购、发货、留存和补货只展示总量，具体处理进入商品/库存看板'
  if (productInventoryView.value === 'procurement') return '按品项查看采购是否履约，同名品项不按单位拆行'
  if (productInventoryView.value === 'inventory') return '按品项查看当前留存，同名品项不按单位拆行'
  return '按商品估算库存覆盖天数和建议补货量，同名商品不按单位拆行'
})
const showInventoryProcurementColumns = computed(() =>
  isOverviewSection.value || productInventoryView.value === 'procurement',
)
const showInventoryStockColumns = computed(() =>
  isOverviewSection.value || productInventoryView.value === 'inventory',
)
const showInventoryOperationSummary = computed(() =>
  showInventoryOperationData.value && (isOverviewSection.value || productInventoryView.value !== 'replenishment'),
)
const showInventoryOperationTable = computed(() =>
  showInventoryOperationData.value && isProductInventorySection.value && productInventoryView.value !== 'replenishment',
)
const showInventoryOperationBoard = computed(() =>
  isProductInventorySection.value
  && ['procurement', 'inventory'].includes(productInventoryView.value)
  && showInventoryOperationData.value,
)
const showInventoryFlowChart = computed(() =>
  showInventoryOperationBoard.value && inventoryOperationBoardRows.value.length > 1,
)
const inventoryFlowChartHeight = computed(() =>
  Math.max(260, Math.min(460, 132 + inventoryOperationBoardRows.value.length * 28)),
)
const showInventoryOperationEmpty = computed(() =>
  !showInventoryOperationSummary.value
  && !showInventoryOperationTable.value
  && (isOverviewSection.value || productInventoryView.value !== 'replenishment'),
)
const inventoryItemTableRows = computed(() => isOverviewSection.value ? inventoryItemRows.value.slice(0, 8) : inventoryItemRows.value)
const inventoryOperationBoardRows = computed(() => {
  const rows = [...inventoryItemRows.value]
  if (isOverviewSection.value) {
    return rows
      .sort((left, right) =>
        inventoryPendingShipment(right) - inventoryPendingShipment(left)
        || Number(right.inactiveRemainingQuantity || 0) - Number(left.inactiveRemainingQuantity || 0)
        || Number(right.remainingQuantity || 0) - Number(left.remainingQuantity || 0),
      )
      .slice(0, 6)
  }
  if (productInventoryView.value === 'procurement') {
    return [...inventoryProcurementRows.value]
      .sort((left, right) =>
        inventoryPendingShipment(right) - inventoryPendingShipment(left)
        || inventoryShipmentRate(left) - inventoryShipmentRate(right)
        || Number(right.procurementQuantity || 0) - Number(left.procurementQuantity || 0),
      )
      .slice(0, 16)
  }
  return rows
    .filter((item) => Number(item.remainingQuantity || 0) !== 0 || Number(item.inactiveRemainingQuantity || 0) !== 0)
    .sort((left, right) =>
      Number(right.inactiveRemainingQuantity || 0) - Number(left.inactiveRemainingQuantity || 0)
      || Number(right.remainingQuantity || 0) - Number(left.remainingQuantity || 0),
    )
    .slice(0, 16)
})
const inventoryProcurementSummary = computed(() =>
  formatInventoryQuantityTotal(inventoryProcurementRows.value, (item) => Number(item.procurementQuantity || 0)),
)
const inventoryProcurementSummaryDetail = computed(() =>
  formatInventorySummaryDetail(inventoryProcurementDetailRows.value),
)
const inventoryShippedSummary = computed(() =>
  formatInventoryQuantityTotal(inventoryShippedRows.value, (item) => Number(item.shippedQuantity || 0)),
)
const inventoryShippedSummaryDetail = computed(() =>
  formatInventorySummaryDetail(inventoryShippedDetailRows.value),
)
const inventoryRemainingSummary = computed(() =>
  formatInventoryQuantityTotal(inventoryRemainingRows.value, (item) => Number(item.remainingQuantity || 0)),
)
const inventoryRemainingSummaryDetail = computed(() =>
  formatInventorySummaryDetail(inventoryRemainingDetailRows.value),
)
const inventoryReplenishmentRows = computed<SupplyDashboardInventoryReplenishmentItem[]>(() =>
  (overview.value?.inventoryReplenishment || []).filter((item) =>
    Number(item.salesQuantity || 0) !== 0
    || Number(item.availableQuantity || 0) !== 0
    || Number(item.inTransitQuantity || 0) !== 0
    || Number(item.suggestedProcurementQuantity || 0) !== 0,
  ),
)
const productInventoryWarningRows = computed(() =>
  inventoryReplenishmentRows.value.filter((item) =>
    item.riskLevel === 'HIGH'
    || item.riskLevel === 'MEDIUM'
    || Number(item.suggestedProcurementQuantity || 0) > 0
    || (Number(item.salesQuantity || 0) > 0 && Number(item.coverageDays || 0) <= 7),
  ),
)
const productInventoryWarningCount = computed(() => productInventoryWarningRows.value.length)
const productAverageCoverageDays = computed(() => {
  const rows = inventoryReplenishmentRows.value.filter((item) =>
    Number(item.salesQuantity || 0) > 0 && Number.isFinite(Number(item.coverageDays)),
  )
  if (!rows.length) return null
  return rows.reduce((total, item) => total + Number(item.coverageDays || 0), 0) / rows.length
})
const productAverageCoverageDaysText = computed(() =>
  productAverageCoverageDays.value == null ? '-' : formatDays(productAverageCoverageDays.value),
)
const inventoryReplenishmentTableRows = computed(() => inventoryReplenishmentRows.value.slice(0, 30))
const inventorySuggestedRows = computed(() =>
  inventoryReplenishmentRows.value.filter((item) => Number(item.suggestedProcurementQuantity || 0) > 0),
)
const inventorySuggestedDetailRows = computed(() =>
  aggregateInventoryReplenishmentRows(inventorySuggestedRows.value),
)
const inventorySuggestedSummary = computed(() =>
  formatInventoryQuantityTotal(inventorySuggestedRows.value, (item) => Number(item.suggestedProcurementQuantity || 0)),
)
const inventorySuggestedSummaryDetail = computed(() =>
  formatInventorySummaryDetail(inventorySuggestedDetailRows.value, '商品'),
)
const inventoryDetailTitle = computed(() => inventoryDetailTitles[activeInventoryDetailKind.value])
const inventoryDetailPrimaryLabel = computed(() => inventoryDetailQuantityLabels[activeInventoryDetailKind.value])
const inventoryDetailItemRows = computed(() => {
  if (activeInventoryDetailKind.value === 'procurement') {
    return sortInventoryRows(inventoryProcurementDetailRows.value, (item) => Number(item.procurementQuantity || 0))
  }
  if (activeInventoryDetailKind.value === 'shipped') {
    return sortInventoryRows(inventoryShippedDetailRows.value, (item) => Number(item.shippedQuantity || 0))
  }
  if (activeInventoryDetailKind.value === 'remaining') {
    return sortInventoryRows(inventoryRemainingDetailRows.value, (item) => Number(item.remainingQuantity || 0))
  }
  return []
})
const inventoryDetailReplenishmentRows = computed(() =>
  activeInventoryDetailKind.value === 'replenishment'
    ? [...inventorySuggestedDetailRows.value].sort((left, right) =>
      Number(right.suggestedProcurementQuantity || 0) - Number(left.suggestedProcurementQuantity || 0)
      || Number(left.coverageDays || 0) - Number(right.coverageDays || 0),
    )
    : [],
)
const inventoryDetailQuantity = computed(() => {
  if (activeInventoryDetailKind.value === 'replenishment') {
    return inventoryDetailReplenishmentRows.value.reduce((total, item) =>
      total + normalizedNumber(item.suggestedProcurementQuantity), 0)
  }
  return inventoryDetailItemRows.value.reduce((total, item) =>
    total + inventoryDetailPrimaryQuantity(item), 0)
})
const inventoryDetailRowCount = computed(() =>
  activeInventoryDetailKind.value === 'replenishment'
    ? inventoryDetailReplenishmentRows.value.length
    : inventoryDetailItemRows.value.length,
)
const inventoryDetailQuantityText = computed(() =>
  `${inventoryDetailPrimaryLabel.value} ${formatNumber(inventoryDetailQuantity.value)}`,
)
const inventoryDetailScopeText = computed(() => `${formatNumber(inventoryDetailRowCount.value)} 条明细，同名品项已合并`)
const inventoryDetailEmptyText = computed(() => `暂无${inventoryDetailTitles[activeInventoryDetailKind.value]}`)
const hasInventoryReplenishmentScopeConflict = computed(() =>
  Boolean(filters.ownerStaffCode || filters.customerTypeCode || filters.sourceSystemCode),
)
const showInventoryReplenishmentSection = computed(() =>
  isProductInventorySection.value
  && productInventoryView.value === 'replenishment'
  && !hasInventoryReplenishmentScopeConflict.value
  && inventoryReplenishmentRows.value.length > 0,
)
const inventoryCoverageChartRows = computed(() =>
  inventoryReplenishmentRows.value
    .filter((item) => Number(item.salesQuantity || 0) > 0)
    .slice(0, 10),
)
const inventoryCoverageChartHeight = computed(() =>
  Math.max(220, Math.min(420, 110 + inventoryCoverageChartRows.value.length * 28)),
)
const hasSalesCollectionTrend = computed(() =>
  Boolean((overview.value?.salesTrend || []).length || (overview.value?.collectionTrend || []).length),
)
const hasOverviewTrend = computed(() => hasSalesCollectionTrend.value)
const overviewBusinessTrendChartOption = computed<EChartsCoreOption>(() =>
  buildSalesCollectionChartOption(
    normalizeSalesTrend(overview.value?.salesTrend || []),
    normalizeCollectionTrend(overview.value?.collectionTrend || []),
    false,
  ),
)
const salesCollectionChartOption = computed<EChartsCoreOption>(() =>
  buildSalesCollectionChartOption(
    normalizeSalesTrend(overview.value?.salesTrend || []),
    normalizeCollectionTrend(overview.value?.collectionTrend || []),
    !isOverviewSection.value,
  ),
)
const sourceSystemPieOption = computed<EChartsCoreOption>(() => buildSourceSystemPieOption(sourceSystemBreakdown.value, '销售来源', '来源'))
const cityTargetHeatmapOption = computed<EChartsCoreOption>(() => buildCityTargetHeatmapOption(cityTargetOverviewRows.value))
const paymentAgingBucketChartOption = computed<EChartsCoreOption>(() => buildPaymentAgingBucketChartOption(paymentAgingBuckets.value))
const productSalesChartOption = computed<EChartsCoreOption>(() =>
  buildProductSalesChartOption(analysisProductSales.value, productBreakdown.value, isGrossProfitSection.value),
)
const productVolumeChartOption = computed<EChartsCoreOption>(() =>
  buildProductVolumeChartOption(analysisProductSales.value, productBreakdown.value),
)
const paymentRiskBaseCityRows = computed<SupplyDashboardRankingItem[]>(() =>
  cityBusinessRows.value.length ? cityBusinessRows.value : paymentRiskCityRanking.value,
)
const paymentRiskLevelSummaryRows = computed<PaymentRiskLevelSummaryRow[]>(() =>
  buildPaymentRiskLevelSummaryRows(paymentRiskBaseCityRows.value),
)
const paymentRiskCityGroups = computed<PaymentRiskCityGroup[]>(() =>
  buildPaymentRiskCityGroups(paymentRiskBaseCityRows.value),
)
const paymentRiskCityCount = computed(() =>
  paymentRiskLevelSummaryRows.value
    .filter((item) => item.code !== 'healthy')
    .reduce((total, item) => total + item.cityCount, 0),
)
const paymentRiskCityShareRate = computed(() =>
  citySalesCityCount.value ? paymentRiskCityCount.value / citySalesCityCount.value * 100 : 0,
)
const hasPaymentRiskLevelData = computed(() =>
  paymentRiskLevelSummaryRows.value.some((item) => item.unpaidAmount > 0),
)
const paymentRiskLevelChartOption = computed<EChartsCoreOption>(() =>
  buildPaymentRiskLevelChartOption(paymentRiskLevelSummaryRows.value),
)
const inventoryRiskChartOption = computed<EChartsCoreOption>(() => buildInventoryRiskChartOption(riskRows.value))
const inventoryFlowChartOption = computed<EChartsCoreOption>(() =>
  buildInventoryFlowChartOption(inventoryOperationBoardRows.value, productInventoryView.value),
)
const inventoryCoverageChartOption = computed<EChartsCoreOption>(() =>
  buildInventoryCoverageChartOption(inventoryCoverageChartRows.value),
)
const cityCostChartOption = computed<EChartsCoreOption>(() => buildCityCostChartOption(cityCostTrendRows.value))
const activityTrendChartOption = computed<EChartsCoreOption>(() => buildActivityTrendChartOption())
const activityFunnelChartOption = computed<EChartsCoreOption>(() => buildActivityFunnelChartOption())
const productSaleableCount = computed(() => overview.value?.productSalesRanking?.length || 0)
const productSoldCount = computed(() => (overview.value?.productSalesRanking || []).filter(hasProductSales).length)
const productUnsoldCount = computed(() => Math.max(productSaleableCount.value - productSoldCount.value, 0))
const productActivationRate = computed(() => productSaleableCount.value ? productSoldCount.value / productSaleableCount.value * 100 : 0)
const productActivationChartReady = computed(() => productSaleableCount.value > 0)
const productActivationChartOption = computed<EChartsCoreOption>(() =>
  buildProductActivationChartOption(productSoldCount.value, productUnsoldCount.value),
)
const productSummaryPrimaryLabel = computed(() => {
  if (productBreakdown.value === 'SKU') return '有销售SKU数'
  if (productBreakdown.value === 'CATEGORY') return '有销售分类数'
  if (productBreakdown.value === 'BRAND') return '有销售品牌数'
  return '有销售商品数'
})
const productSummaryPrimaryValue = computed(() =>
  productBreakdown.value === 'PRODUCT' ? productSoldCount.value : rawProductSales.value.length,
)
const productSummarySecondaryValue = computed(() => formatPercent(productActivationRate.value))
const productSummaryQuantity = computed(() => displayedProductSales.value.reduce((total, item) => total + Number(item.salesQuantity || 0), 0))
const productSummaryAmount = computed(() => displayedProductSales.value.reduce((total, item) => total + Number(item.salesAmount || 0), 0))
const productSummaryOrderCount = computed(() => {
  const value = orderCountMetric.value?.value
  if (value !== null && value !== undefined) return Number(value || 0)
  return displayedProductSales.value.reduce((total, item) => total + Number(item.orderCount || 0), 0)
})
const productSummaryCustomerCount = computed(() => {
  const value = orderingCustomerCountMetric.value?.value
  if (value !== null && value !== undefined) return Number(value || 0)
  return displayedProductSales.value.reduce((total, item) => total + Number(item.customerCount || 0), 0)
})
const productTopLabel = computed(() => {
  if (productBreakdown.value === 'SKU') return 'TOP SKU'
  if (productBreakdown.value === 'CATEGORY') return 'TOP 分类'
  if (productBreakdown.value === 'BRAND') return 'TOP 品牌'
  return 'TOP 商品'
})
const productTopItem = computed(() => analysisProductSales.value[0] || null)
const productTopMetricValue = computed(() => {
  const item = productTopItem.value
  if (!item) return 0
  return isGrossProfitSection.value ? Number(item.estimatedGrossProfit || 0) : Number(item.salesAmount || 0)
})
const productTopShareRate = computed(() => {
  const total = isGrossProfitSection.value
    ? analysisProductSales.value.reduce((sum, item) => sum + Number(item.estimatedGrossProfit || 0), 0)
    : productSummaryAmount.value
  return total ? productTopMetricValue.value / total * 100 : 0
})
const overviewPaidRate = computed(() => {
  const sales = Number(salesAmountMetric.value?.value || 0)
  const paid = Number(paidAmountMetric.value?.value || 0)
  return sales > 0 ? paid / sales * 100 : 0
})
const paymentRiskLevelCode = computed(() => {
  const sales = Number(salesAmountMetric.value?.value || 0)
  return paymentRiskLevelCodeByRate(overviewPaidRate.value, sales > 0)
})
const paymentRiskLevelLabel = computed(() => {
  if (paymentRiskLevelCode.value === 'none') return '暂无交易'
  if (paymentRiskLevelCode.value === 'healthy') return '健康'
  if (paymentRiskLevelCode.value === 'warning') return '预警'
  return '高危'
})
const paymentRiskToneClass = computed(() => `payment-risk-summary-strip--${paymentRiskLevelCode.value}`)
const overviewKpiCards = computed<OverviewKpiCard[]>(() => {
  const salesValues = overviewSparklineValues('sales')
  const paidValues = overviewSparklineValues('paid')
  const unpaidValues = overviewSparklineValues('unpaid')
  const paidRateValues = overviewSparklineValues('paidRate')
  const riskTone = paymentRiskLevelCode.value === 'danger' ? 'danger' : 'warning'
  const paidRateTone = paymentRiskLevelCode.value === 'healthy'
    ? 'success'
    : paymentRiskLevelCode.value === 'danger'
      ? 'danger'
      : 'warning'

  return [
    {
      key: 'sales',
      label: '总交易额',
      value: formatMoneyWan(salesAmountMetric.value?.value),
      summary: overviewSparklineSummary(salesValues, 'CNY'),
      actionLabel: '进入销售与回款',
      tone: 'primary',
      section: 'sales-collection',
      chartOption: buildOverviewSparklineOption(salesValues, chartTheme.primary, 'bar'),
    },
    {
      key: 'paid',
      label: '总回款额',
      value: formatMoneyWan(paidAmountMetric.value?.value),
      summary: overviewSparklineSummary(paidValues, 'CNY'),
      actionLabel: '看回款趋势',
      tone: 'success',
      section: 'sales-collection',
      chartOption: buildOverviewSparklineOption(paidValues, chartTheme.success, 'line'),
    },
    {
      key: 'unpaid',
      label: '待回款',
      value: formatMoneyWan(unpaidAmountMetric.value?.value),
      summary: overviewSparklineSummary(unpaidValues, 'CNY'),
      actionLabel: '进入风险入口',
      tone: riskTone,
      section: 'payment-risk',
      chartOption: buildOverviewSparklineOption(unpaidValues, paymentRiskColorByRate(overviewPaidRate.value), 'bar'),
    },
    {
      key: 'paidRate',
      label: '回款率',
      value: formatPercent(overviewPaidRate.value),
      summary: overviewSparklineSummary(paidRateValues, 'PERCENT'),
      actionLabel: '看风险分级',
      tone: paidRateTone,
      section: 'payment-risk',
      chartOption: buildOverviewSparklineOption(paidRateValues, paymentRiskColorByRate(overviewPaidRate.value), 'line'),
    },
  ]
})
const overviewModuleEntrances = computed(() =>
  overviewDrillEntrances.value.filter((entry) => entry.section !== 'payment-risk'),
)
const overviewCustomerFunnelRows = computed<OverviewCustomerFunnelRow[]>(() => {
  const contacted = Number(contactedCustomerMetric.value?.value || 0)
  const cooperated = Number(cooperatedCustomerMetric.value?.value || 0)
  const repeat = Number(repeatCustomerMetric.value?.value || 0)
  const base = Math.max(contacted, cooperated, repeat, 1)
  return [
    {
      key: 'contacted',
      label: '建联客户',
      value: formatNumber(contacted),
      percent: boundedPercent(contacted / base * 100),
    },
    {
      key: 'cooperated',
      label: '合作客户',
      value: formatNumber(cooperated),
      percent: boundedPercent(cooperated / base * 100),
    },
    {
      key: 'repeat',
      label: '复购客户',
      value: formatNumber(repeat),
      percent: boundedPercent(repeat / base * 100),
    },
  ]
})
const rangeLabel = computed(() => {
  if (!overview.value) return '按当前筛选范围'
  return `${formatDate(overview.value.from)} 至 ${formatDate(overview.value.to)}`
})
const salesCollectionTrendDescription = computed(() => {
  if (isOverviewSection.value && quickPeriod.value === 'year') return '本年按月展示交易额与订单累计已收'
  if (isOverviewSection.value && quickPeriod.value === 'latest') return `${rangeLabel.value}，按日展示交易额与订单累计已收`
  if (isOverviewSection.value) return '本月按日展示交易额与订单累计已收'
  return `${rangeLabel.value}，销售看板可同时查看期间实际回款记录`
})
const overviewDrillEntrances = computed(() => [
  {
    section: 'city-operating' as DashboardSection,
    title: '城市指标完成',
    summary: cityTargetOverviewRows.value.length
      ? `${formatNumber(cityTargetOverviewRows.value.length)} 个城市有目标，点击看四项完成度`
      : '目标配置后展示建联、合作、交易和回款完成度',
    value: targetAchievementRateMetric.value ? formatPercent(targetAchievementRateMetric.value.value) : '待配置',
    tone: 'target',
    icon: Histogram,
  },
  {
    section: 'sales' as DashboardSection,
    title: '销售跟进',
    summary: `${formatNumber(salesRanking.value.length)} 名销售，排名和个人目标放在销售看板`,
    value: `${formatNumber(paymentRiskCustomerMetric.value?.value)} 风险客户`,
    tone: 'sales',
    icon: DataAnalysis,
  },
  {
    section: 'product-inventory' as DashboardSection,
    title: '商品/采购/库存',
    summary: '采购、已发货、留存和建议补货明细进入商品/库存看板',
    value: `${formatNumber(inventoryProcurementRows.value.length)} 品项`,
    tone: 'inventory',
    icon: Coin,
  },
  {
    section: 'customer' as DashboardSection,
    title: '客户分层/预警',
    summary: 'ABC分层、活跃度和流失预警进入客户看板',
    value: `${formatNumber(customerChurnRiskMetric.value?.value)} 预警客户`,
    tone: 'customer',
    icon: User,
  },
  {
    section: 'payment-risk' as DashboardSection,
    title: '回款风险',
    summary: `风险金额 ${formatMoneyWan(paymentRiskAmountMetric.value?.value)}，销售和城市排行放在风险看板`,
    value: paymentRiskLevelLabel.value,
    tone: paymentRiskLevelCode.value,
    icon: Warning,
  },
])
const roleSnapshot = computed<RoleSnapshot | null>(() => {
  if (!showRoleSnapshot.value) return null

  if (isCityOperatingSection.value) {
    return {
      eyebrow: '城市经营驾驶舱',
      value: formatMoneyWan(citySalesTotal.value),
      summary: `${formatNumber(citySalesCityCount.value)} 个城市有销售，整体回款率 ${formatPercent(cityOverallPaidRate.value)}；城市目标和风险收敛到一张表。`,
      cards: [
        {
          key: 'city-count',
          label: '有销售城市',
          value: formatNumber(citySalesCityCount.value),
          summary: '点击下方城市表筛选城市',
          tone: 'primary',
          scrollTarget: '.city-business-table-panel',
        },
        {
          key: 'city-paid',
          label: '城市回款额',
          value: formatMoneyWan(cityPaidTotal.value),
          summary: '按城市交易汇总累计已收',
          tone: 'success',
          progress: cityOverallPaidRate.value,
          metricCode: 'paid_amount',
        },
        {
          key: 'city-target',
          label: '平均目标完成',
          value: targetAchievementRateMetric.value ? formatPercent(targetAchievementRateMetric.value.value) : '待配置',
          summary: `${formatNumber(cityTargetOverviewRows.value.length)} 个城市有目标记录`,
          tone: targetAchievementRateMetric.value ? 'warning' : 'neutral',
          progress: targetAchievementRateMetric.value?.value,
          scrollTarget: '.city-business-table-panel',
        },
        {
          key: 'city-risk',
          label: '风险城市',
          value: formatNumber(paymentRiskCityCount.value),
          summary: '按回款率分级识别',
          tone: paymentRiskCityCount.value ? 'warning' : 'success',
          section: 'payment-risk',
        },
      ],
      actions: [
        { key: 'city-table', label: '看城市经营表', scrollTarget: '.city-business-table-panel' },
        { key: 'city-risk', label: '看回款风险', section: 'payment-risk' },
      ],
      formulas: [
        '交易额=当前筛选范围内非取消订单应收金额',
        '回款率=订单累计已收金额 / 交易额',
        '目标完成=实际值 / 目标值；多指标在城市表内分别展示',
      ],
    }
  }

  if (isSalesCollectionDetailSection.value) {
    return {
      eyebrow: '销售与回款驾驶舱',
      value: formatMoneyWan(salesAmountMetric.value?.value),
      summary: `${rangeLabel.value}，总回款 ${formatMoneyWan(paidAmountMetric.value?.value)}，待回款 ${formatMoneyWan(unpaidAmountMetric.value?.value)}。`,
      cards: [
        {
          key: 'collection-paid',
          label: '回款额',
          value: formatMoneyWan(paidAmountMetric.value?.value),
          summary: '订单累计已收金额',
          tone: 'success',
          progress: overviewPaidRate.value,
          metricCode: 'paid_amount',
        },
        {
          key: 'collection-unpaid',
          label: '待回款',
          value: formatMoneyWan(unpaidAmountMetric.value?.value),
          summary: '进入风险页看客户和订单',
          tone: paymentRiskLevelCode.value === 'danger' ? 'danger' : 'warning',
          section: 'payment-risk',
        },
        {
          key: 'collection-receipt',
          label: '实际回款记录',
          value: formatMoneyWan(metricByCode('receipt_amount')?.value),
          summary: '用于和订单累计已收对照',
          tone: 'primary',
          metricCode: 'receipt_amount',
        },
        {
          key: 'collection-order',
          label: '订单数',
          value: formatNumber(orderCountMetric.value?.value),
          summary: '点击查看订单明细',
          tone: 'neutral',
          metricCode: 'order_count',
        },
      ],
      actions: [
        { key: 'collection-sales', label: '看销售排名', section: 'sales' },
        { key: 'collection-risk', label: '看风险订单', section: 'payment-risk' },
      ],
      formulas: [
        '交易额=非取消订单应收金额',
        '订单累计已收=订单上的已收金额',
        '待回款=交易额 - 订单累计已收',
        '实际回款记录=销售回款流水金额',
      ],
    }
  }

  if (isProductInventorySection.value) {
    return {
      eyebrow: '采购/库存运营驾驶舱',
      value: inventoryRemainingSummary.value,
      summary: '采购、已发货、留存按品项查看，不跨单位合并；补货建议单独进入观察页。',
      cards: [
        {
          key: 'inventory-procurement',
          label: '采购量',
          value: inventoryProcurementSummary.value,
          summary: inventoryProcurementSummaryDetail.value,
          tone: 'primary',
          inventoryView: 'procurement',
          inventoryDetail: 'procurement',
        },
        {
          key: 'inventory-shipped',
          label: '已发货',
          value: inventoryShippedSummary.value,
          summary: inventoryShippedSummaryDetail.value,
          tone: 'success',
          inventoryView: 'procurement',
          inventoryDetail: 'shipped',
        },
        {
          key: 'inventory-remaining',
          label: '当前留存',
          value: inventoryRemainingSummary.value,
          summary: inventoryRemainingSummaryDetail.value,
          tone: 'warning',
          inventoryView: 'inventory',
          inventoryDetail: 'remaining',
        },
        {
          key: 'inventory-replenishment',
          label: '建议补货',
          value: inventorySuggestedSummary.value,
          summary: inventorySuggestedSummaryDetail.value,
          tone: productInventoryWarningCount.value ? 'danger' : 'success',
          inventoryView: 'replenishment',
        },
      ],
      actions: [
        { key: 'inventory-product-sales', label: '看商品销售', section: 'product-sales' },
        { key: 'inventory-risk', label: '看库存风险', section: 'inventory-risk' },
      ],
      formulas: [
        '采购/已发货/留存按品项和单位分别统计',
        '发货率=已发货量 / 采购量',
        '覆盖天数=可用库存 / 日均订货量',
        '建议补货按目标覆盖周期估算，不展示金额',
      ],
    }
  }

  if (isProductSalesVisualSection.value) {
    return {
      eyebrow: '商品销售驾驶舱',
      value: formatMoneyWan(productSummaryAmount.value),
      summary: `${productDimensionLabel.value}维度，订货数量 ${formatNumber(productSummaryQuantity.value)}，下单客户 ${formatNumber(productSummaryCustomerCount.value)}。`,
      cards: [
        {
          key: 'product-top',
          label: productTopLabel.value,
          value: productTopItem.value?.dimensionName || '-',
          summary: productTopItem.value ? formatMoneyWan(productTopMetricValue.value) : '暂无销售数据',
          tone: 'primary',
          scrollTarget: '.product-sales-panel',
        },
        {
          key: 'product-quantity',
          label: '订货数量',
          value: formatNumber(productSummaryQuantity.value),
          summary: `${formatNumber(productSummaryOrderCount.value)} 单`,
          tone: 'success',
          scrollTarget: '.product-sales-panel',
        },
        {
          key: 'product-active',
          label: '动销率',
          value: productSummarySecondaryValue.value,
          summary: `已动销 ${formatNumber(productSoldCount.value)} / 可售 ${formatNumber(productSaleableCount.value)}`,
          tone: productActivationRate.value >= 60 ? 'success' : 'warning',
          progress: productActivationRate.value,
        },
        {
          key: 'product-inventory',
          label: '库存预警',
          value: `${formatNumber(productInventoryWarningCount.value)} 商品`,
          summary: '库存健康放到单独区域看',
          tone: productInventoryWarningCount.value ? 'warning' : 'success',
          section: 'product-inventory',
        },
      ],
      actions: [
        { key: 'product-inventory', label: '看采购库存', section: 'product-inventory' },
        { key: 'product-profit', label: '看估算毛利', section: 'gross-profit' },
      ],
      formulas: [
        '订货金额=订单行商品金额汇总',
        '订货数量=订单行商品数量汇总',
        '动销率=有销售商品数 / 可售商品数',
        '商品、SKU、分类、品牌共用同一订单行口径',
      ],
    }
  }

  if (isGrossProfitSection.value) {
    return {
      eyebrow: '销售毛利观察',
      value: formatGrossProfitMoneyWan(grossProfitMetric.value?.value, costCoverageRateMetric.value?.value),
      summary: grossProfitCostCovered.value
        ? `成本覆盖率 ${formatPercent(costCoverageRateMetric.value?.value)}，当前仅作估算分析。`
        : '采购参考价未覆盖时不展示真实利润判断。',
      cards: [
        {
          key: 'profit-net',
          label: '销售净收入',
          value: formatMoneyWan(salesNetAmountMetric.value?.value),
          summary: '销售额扣减退款分摊',
          tone: 'primary',
          metricCode: 'sales_net_amount',
        },
        {
          key: 'profit-cost',
          label: '估算成本',
          value: formatMoneyWan(estimatedCostAmountMetric.value?.value),
          summary: '订单行数量 x ERP 采购参考价',
          tone: 'neutral',
          metricCode: 'estimated_cost_amount',
        },
        {
          key: 'profit-rate',
          label: '估算毛利率',
          value: formatGrossProfitRate(grossProfitRateMetric.value?.value, costCoverageRateMetric.value?.value),
          summary: '仅在成本覆盖后可参考',
          tone: grossProfitCostCovered.value ? 'success' : 'warning',
          progress: grossProfitRateMetric.value?.value,
        },
        {
          key: 'profit-coverage',
          label: '成本覆盖',
          value: formatPercent(costCoverageRateMetric.value?.value),
          summary: '有采购参考价的订单行占比',
          tone: grossProfitCostCovered.value ? 'success' : 'warning',
          progress: costCoverageRateMetric.value?.value,
        },
      ],
      actions: [
        { key: 'profit-product', label: '看商品销售', section: 'product-sales' },
      ],
      formulas: [
        '销售净收入=订货金额 - 退款分摊',
        '估算成本=订单行数量 x ERP 采购参考价',
        '估算毛利=销售净收入 - 估算成本',
        '估算毛利率=估算毛利 / 销售净收入',
      ],
    }
  }

  if (isPaymentRiskDetailSection.value) {
    return {
      eyebrow: '回款风险驾驶舱',
      value: formatMoneyWan(paymentRiskAmountMetric.value?.value),
      summary: `风险等级 ${paymentRiskLevelLabel.value}，高危客户 ${formatNumber(paymentHighRiskCustomerMetric.value?.value)}，平均逾期 ${formatDays(paymentAvgOverdueMetric.value?.value)}。`,
      cards: [
        {
          key: 'risk-unpaid',
          label: '待回款',
          value: formatMoneyWan(unpaidAmountMetric.value?.value),
          summary: '全部未收回款项',
          tone: 'warning',
          metricCode: 'unpaid_amount',
        },
        {
          key: 'risk-customers',
          label: '风险客户',
          value: formatNumber(paymentRiskCustomerMetric.value?.value),
          summary: '存在待回款订单',
          tone: 'danger',
          scrollTarget: '.risk-visual-grid',
        },
        {
          key: 'risk-rate',
          label: '风险金额占比',
          value: formatPercent(paymentRiskAmountRateMetric.value?.value),
          summary: '风险金额 / 交易额',
          tone: paymentRiskLevelCode.value === 'danger' ? 'danger' : 'warning',
          progress: paymentRiskAmountRateMetric.value?.value,
        },
        {
          key: 'risk-city',
          label: '风险城市',
          value: formatNumber(paymentRiskCityCount.value),
          summary: '按城市回款率分级',
          tone: paymentRiskCityCount.value ? 'warning' : 'success',
          scrollTarget: '.risk-visual-grid',
        },
      ],
      actions: [
        { key: 'risk-sales', label: '看销售跟进', section: 'sales' },
        { key: 'risk-city', label: '看城市经营', section: 'city-operating' },
      ],
      formulas: [
        '待回款=交易额 - 订单累计已收',
        '风险金额=超过约定账期仍未回款金额',
        '健康≥60%，预警20%-60%，高危≤20%',
        '风险金额占比=风险金额 / 交易额',
      ],
    }
  }

  if (dashboardSection.value === 'city-cost') {
    return {
      eyebrow: '城市成本驾驶舱',
      value: cityCostHasData.value ? formatMoneyWan(cityCostMetric.value?.value) : '未导入',
      summary: cityCostHasData.value
        ? `${formatNumber(cityCostRows.value.length)} 个城市有成本记录，预算偏差 ${formatMoneyWan(cityCostVarianceTotal.value)}。`
        : '没有城市成本记录时不展示成本率判断。',
      cards: [
        {
          key: 'cost-rate',
          label: '城市成本率',
          value: cityCostHasData.value ? formatPercent(cityCostRateMetric.value?.value) : '-',
          summary: '城市运营成本 / 销售额',
          tone: cityCostHasData.value ? 'warning' : 'neutral',
          progress: cityCostRateMetric.value?.value,
        },
        {
          key: 'cost-budget',
          label: '预算金额',
          value: formatMoneyWan(cityCostBudgetTotal.value),
          summary: '当前筛选范围预算汇总',
          tone: 'neutral',
        },
        {
          key: 'cost-variance',
          label: '预算偏差',
          value: formatMoneyWan(cityCostVarianceTotal.value),
          summary: '正数代表超预算',
          tone: cityCostVarianceTotal.value > 0 ? 'danger' : 'success',
        },
        {
          key: 'cost-sales',
          label: '交易额',
          value: formatMoneyWan(salesAmountMetric.value?.value),
          summary: '用于计算成本率',
          tone: 'primary',
          metricCode: 'sales_amount',
        },
      ],
      actions: [
        { key: 'cost-city', label: '看城市经营', section: 'city-operating' },
      ],
      formulas: [
        '城市成本率=城市运营成本 / 交易额',
        '预算偏差=成本 - 预算',
        '无成本导入时不计算成本率',
      ],
    }
  }

  if (dashboardSection.value === 'inventory-risk') {
    return {
      eyebrow: '库存风险驾驶舱',
      value: formatNumber(inventoryRiskMetric.value?.value || riskRows.value.length),
      summary: `高风险 ${formatNumber(highRiskCount.value)} 项，涉及仓库 ${formatNumber(riskWarehouseCount.value)}。`,
      cards: [
        {
          key: 'inventory-risk-high',
          label: '高风险项',
          value: formatNumber(highRiskCount.value),
          summary: '优先排查可用不足和锁定异常',
          tone: highRiskCount.value ? 'danger' : 'success',
          scrollTarget: '.panel--wide',
        },
        {
          key: 'inventory-risk-negative',
          label: '负库存总量',
          value: formatNumber(negativeInventoryTotal.value),
          summary: '库存口径异常需要修复',
          tone: negativeInventoryTotal.value ? 'danger' : 'success',
        },
        {
          key: 'inventory-risk-warehouse',
          label: '涉及仓库',
          value: formatNumber(riskWarehouseCount.value),
          summary: '按风险对象说明定位',
          tone: 'warning',
        },
        {
          key: 'inventory-risk-procurement',
          label: '采购库存',
          value: inventoryRemainingSummary.value,
          summary: '回到采购/库存看留存',
          tone: 'primary',
          section: 'product-inventory',
        },
      ],
      actions: [
        { key: 'inventory-risk-back', label: '看采购库存', section: 'product-inventory' },
      ],
      formulas: [
        '库存风险来自可用库存不足、锁定量异常和历史库存',
        '负库存总量=风险项中可用库存为负的数量汇总',
        '风险对象按仓库、品项或商品维度展示',
      ],
    }
  }

  return null
})

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''
  try {
    const query = buildQuery()
    let data = await getSupplyDashboardOverview(query)
    if (quickPeriod.value === 'latest' && !query.from && !query.to && !hasOrderBusinessData(data)) {
      const fallbackData = await loadLatestBusinessMonth()
      if (fallbackData) data = fallbackData
    }
    overview.value = data
    if (quickPeriod.value === 'latest' && !query.from && !query.to) {
      syncDateRangeFromOverview(data)
    }
  } catch (error) {
    const message = apiErrorMessage(error, '供应链 BI 看板加载失败')
    errorMessage.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

async function loadFilterOptions() {
  try {
    filterOptions.value = await getSupplyDashboardFilterOptions()
  } catch {
    filterOptions.value = {
      regions: [],
      salesOwners: [],
      customerTypes: [],
      productCategories: [],
      sourceSystems: [
        { optionType: 'SOURCE_SYSTEM', optionValue: 'DINGHUOBAO', optionLabel: '订货宝', usageCount: 0 },
        { optionType: 'SOURCE_SYSTEM', optionValue: 'FEISHU', optionLabel: '飞书', usageCount: 0 },
        { optionType: 'SOURCE_SYSTEM', optionValue: 'MANUAL', optionLabel: '手工订单', usageCount: 0 },
      ],
    }
  }
}

async function loadReconciliation() {
  reconciliationLoading.value = true
  try {
    reconciliation.value = await getSupplyDashboardReconciliation(buildQuery())
    return reconciliation.value
  } catch (error) {
    ElMessage.warning(apiErrorMessage(error, 'BI 对账结果加载失败'))
    return null
  } finally {
    reconciliationLoading.value = false
  }
}

async function reloadDashboardAfterRefresh() {
  await loadDashboard()
  const [reconciliationResult] = await Promise.all([loadReconciliation(), loadFilterOptions()])
  return reconciliationResult
}

async function loadCrmMasterOptions() {
  try {
    const [areaResult, typeResult] = await Promise.all([
      getCrmCustomerAreas({ begin: 0, step: 200 }),
      getCrmCustomerTypes({ begin: 0, step: 200 }),
    ])
    crmAreas.value = areaResult.items
    crmCustomerTypes.value = typeResult.items
  } catch {
    crmAreas.value = []
    crmCustomerTypes.value = []
  }
}

function resetFilters() {
  quickPeriod.value = 'latest'
  filters.dateRange = []
  filters.regionCode = ''
  filters.ownerStaffCode = ''
  filters.customerTypeCode = ''
  filters.productCategoryId = ''
  filters.sourceSystemCode = ''
  selectedCustomerSegment.value = ''
  selectedCustomerRiskLevel.value = ''
  loadDashboard()
}

function applyQuickPeriod(value: string | number | boolean) {
  const period = String(value) as QuickPeriod
  quickPeriod.value = period
  if (period === 'latest') filters.dateRange = []
  if (period === 'today') filters.dateRange = todayRange()
  if (period === 'month') filters.dateRange = currentMonthRange()
  if (period === 'year') filters.dateRange = currentYearRange()
  void loadDashboard()
}

function markCustomPeriod() {
  quickPeriod.value = 'custom'
}

function selectRefreshMode(key: string) {
  if (refreshing.value) return
  selectedRefreshModeKey.value = key
}

async function triggerRefresh() {
  refreshing.value = true
  try {
    const mode = selectedRefreshMode.value
    const run = await createSupplyDashboardRefreshRun({ sourceCodes: mode.sourceCodes, fullRefresh: true })
    if (run.statusCode === 'SUCCESS') {
      const reconciliationResult = await reloadDashboardAfterRefresh()
      if (!hasReconciliationIssue(reconciliationResult)) refreshPanelVisible.value = false
      notifyRefreshResult(mode, run, reconciliationResult, false)
    } else if (run.statusCode === 'SKIPPED') {
      ElMessage.warning(run.failureReason || '已有刷新任务运行中')
    } else if (Number(run.upsertedCount || 0) > 0) {
      const reconciliationResult = await reloadDashboardAfterRefresh()
      notifyRefreshResult(mode, run, reconciliationResult, true)
    } else {
      ElMessage.error(run.failureReason || '供应链 BI 同步失败')
    }
  } catch (error) {
    const message = apiErrorMessage(error, '供应链 BI 同步失败')
    ElMessage.error(message)
  } finally {
    refreshing.value = false
  }
}

function notifyRefreshResult(
  mode: BiRefreshMode,
  run: { pulledCount?: number | null; upsertedCount?: number | null; failureReason?: string | null },
  result: SupplyDashboardReconciliation | null,
  partial: boolean,
) {
  const base = `同步${mode.label}${partial ? '部分写入' : '完成'}：读取 ${formatNumber(run.pulledCount)} 条，写入 ${formatNumber(run.upsertedCount)} 条`
  const issue = firstReconciliationIssue(result)
  if (issue) {
    ElMessage.warning(`${base}。对账有差异：${reconciliationIssueText(issue)}`)
    return
  }
  if (partial) {
    ElMessage.warning(`${base}。${run.failureReason || '部分来源刷新失败'}`)
    return
  }
  ElMessage.success(base)
}

function hasReconciliationIssue(result: SupplyDashboardReconciliation | null) {
  return Boolean(firstReconciliationIssue(result))
}

function firstReconciliationIssue(result: SupplyDashboardReconciliation | null) {
  return (result?.items || []).find((item) => item.status === 'DIFF') || null
}

function reconciliationIssueText(item: SupplyDashboardReconciliation['items'][number]) {
  return `${item.subjectName} 源/业务 ${formatSignedCount(item.sourceBusinessRowDiff)} 条，业务/BI ${formatSignedCount(item.businessBiRowDiff)} 条`
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' && code.trim()) return `${fallback}：${code}`
  }
  return fallback
}

function buildQuery() {
  return buildQueryForDateRange(Array.isArray(filters.dateRange) ? filters.dateRange : [])
}

function buildQueryForDateRange(dateRange: string[]) {
  const query: Record<string, string | number> = {}
  const [from, to] = dateRange
  if (from) query.from = `${from}T00:00:00Z`
  if (to) query.to = `${to}T23:59:59Z`
  if (filters.regionCode.trim()) query.regionCode = filters.regionCode.trim()
  if (filters.ownerStaffCode.trim()) query.ownerStaffCode = filters.ownerStaffCode.trim()
  if (filters.customerTypeCode.trim()) query.customerTypeCode = filters.customerTypeCode.trim()
  if (filters.sourceSystemCode) query.sourceSystemCode = filters.sourceSystemCode
  const categoryId = Number(filters.productCategoryId)
  if (Number.isFinite(categoryId) && categoryId > 0) query.productCategoryId = categoryId
  return query
}

function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return [dateValue(start), dateValue(now)]
}

function todayRange() {
  const now = new Date()
  return [dateValue(now), dateValue(now)]
}

function currentYearRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return [dateValue(start), dateValue(now)]
}

function relativeMonthRange(monthOffset: number) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0)
  return [dateValue(start), dateValue(end)]
}

function dateValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function apiDateValue(value?: string | null) {
  if (!value) return ''
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] || dateValue(new Date(value))
}

function syncDateRangeFromOverview(data: SupplyDashboardOverview) {
  const from = apiDateValue(data.from)
  const to = apiDateValue(data.to)
  if (from && to) filters.dateRange = [from, to]
}

async function loadLatestBusinessMonth() {
  for (let offset = 1; offset <= 12; offset += 1) {
    const dateRange = relativeMonthRange(offset)
    const data = await getSupplyDashboardOverview(buildQueryForDateRange(dateRange))
    if (hasOrderBusinessData(data)) {
      filters.dateRange = dateRange
      return data
    }
  }
  return null
}

function hasOrderBusinessData(data: SupplyDashboardOverview) {
  const salesAmount = data.metrics.find((metric) => metric.metricCode === 'sales_amount')?.value || 0
  const orderCount = data.metrics.find((metric) => metric.metricCode === 'order_count')?.value || 0
  return Number(salesAmount) > 0
    || Number(orderCount) > 0
    || data.salesTrend.length > 0
    || data.citySalesRanking.length > 0
    || (data.cityCollectionRateRanking || []).length > 0
    || data.productSalesRanking.some(hasProductSales)
    || (data.skuSalesRanking || []).some(hasProductSales)
    || (data.customerSegments || []).length > 0
}

function formatMetric(metric: SupplyDashboardMetricCard) {
  if (metric.metricCode === 'city_cost_rate' && !cityCostHasData.value) return '-'
  if (metric.metricCode === 'estimated_gross_profit_rate' && !grossProfitCostCovered.value) return '待成本'
  if (metric.unit === 'CNY') return formatMoneyWan(metric.value)
  if (metric.unit === 'PERCENT') return formatPercent(metric.value)
  if (metric.unit === 'DAYS') return formatDays(metric.value)
  return formatNumber(metric.value)
}

function metricByCode(code: string) {
  return overview.value?.metrics.find((item) => item.metricCode === code) || null
}

function regionOptionLabel(option: { optionValue: string; optionLabel?: string | null }) {
  return regionName(option.optionValue, option.optionLabel || option.optionValue)
}

function customerTypeOptionLabel(option: { optionValue: string; optionLabel?: string | null }) {
  return customerTypeName(option.optionValue, option.optionLabel || option.optionValue)
}

function staffOptionLabel(option: { optionValue: string; optionLabel?: string | null }) {
  return option.optionLabel || option.optionValue
}

function sourceSystemName(code?: string | null, fallback?: string | null) {
  const value = code || ''
  const matched = filterOptions.value.sourceSystems.find((item) => item.optionValue === value)
  return businessLabel(fallback || matched?.optionLabel || value, '来源')
}

function productSalesRowsAsRanking(items: SupplyDashboardProductSalesItem[], rankType: string): SupplyDashboardRankingItem[] {
  return items.map((item) => ({
    rankType,
    dimensionCode: item.dimensionCode,
    dimensionName: item.dimensionName,
    regionCode: null,
    regionName: null,
    salesAmount: Number(item.salesAmount || 0),
    paidAmount: 0,
    unpaidAmount: 0,
    orderCount: Number(item.orderCount || 0),
    customerCount: Number(item.customerCount || 0),
    rate: 0,
  }))
}

function regionName(code?: string | null, fallback?: string | null) {
  const value = code || ''
  const matched = crmAreas.value.find((item) => item.code === value)
  return businessLabel(matched?.name || fallback || value, '城市')
}

function salesRankingRegionLabel(item: Pick<SupplyDashboardRankingItem, 'regionCode' | 'regionName'>) {
  if (item.regionCode === 'MULTI' || item.regionName === '多城市') return '多城市'
  if (item.regionCode) return regionName(item.regionCode, item.regionName)
  return businessLabel(item.regionName, '未归属')
}

function customerTypeName(code?: string | null, fallback?: string | null) {
  const value = code || ''
  const matched = crmCustomerTypes.value.find((item) => item.code === value)
  return businessLabel(matched?.name || fallback || value, '客户类型')
}

function businessLabel(value: string | null | undefined, fallback: string) {
  const text = String(value || '').trim()
  if (!text) return fallback
  if (/^CUS(?:AREA|TYPE)[A-Z0-9]+$/i.test(text)) return `${fallback} ${text.slice(-4)}`
  return text
}

function hasProductSales(item: SupplyDashboardProductSalesItem) {
  return Number(item.salesQuantity || 0) > 0
    || Number(item.salesAmount || 0) > 0
    || Number(item.orderCount || 0) > 0
}

function productDimensionPreviewPercent(
  item: SupplyDashboardProductSalesItem,
  rows: SupplyDashboardProductSalesItem[],
) {
  const maxAmount = Math.max(...rows.map((row) => Number(row.salesAmount || 0)), 0)
  if (maxAmount <= 0) return 0
  return boundedPercent(Number(item.salesAmount || 0) / maxAmount * 100)
}

function groupTargetCompletionRows(items: SupplyDashboardTargetCompletionItem[]) {
  const rowMap = new Map<string, CityTargetOverviewRow>()
  items.forEach((item) => {
    if (!item.dimensionCode || item.dimensionCode === 'UNKNOWN') return
    const current = rowMap.get(item.dimensionCode) || {
      dimensionCode: item.dimensionCode,
      dimensionName: regionName(item.dimensionCode, item.dimensionName),
      metrics: {},
      averageRate: 0,
    }
    current.metrics[item.metricCode] = {
      targetValue: Number(item.targetValue || 0),
      actualValue: Number(item.actualValue || 0),
      achievementRate: Number(item.achievementRate || 0),
    }
    rowMap.set(item.dimensionCode, current)
  })
  return [...rowMap.values()]
    .map((row) => {
      const rates = targetMetricDefinitions
        .map((definition) => row.metrics[definition.code]?.achievementRate)
        .filter((value): value is number => Number.isFinite(value))
      return {
        ...row,
        averageRate: rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : 0,
      }
    })
    .sort((left, right) => right.averageRate - left.averageRate)
    .slice(0, isOverviewSection.value ? 8 : 30)
}

function buildTargetCompletionMap(items: SupplyDashboardTargetCompletionItem[]) {
  const rowMap = new Map<string, TargetMetricSnapshot>()
  items.forEach((item) => {
    if (!item.dimensionCode || !item.metricCode) return
    rowMap.set(`${item.dimensionCode}:${item.metricCode}`, {
      targetValue: Number(item.targetValue || 0),
      actualValue: Number(item.actualValue || 0),
      achievementRate: Number(item.achievementRate || 0),
    })
  })
  return rowMap
}

function emptyCityCustomerStats(): CityCustomerStats {
  return {
    activeCustomerCount: 0,
    repeatCustomerCount: 0,
    highValueCustomerCount: 0,
    churnRiskCustomerCount: 0,
  }
}

function buildCityCustomerStatsByRegion(
  activityRows: SupplyDashboardCustomerActivityItem[],
  churnRiskRows: SupplyDashboardCustomerActivityItem[],
) {
  const rows = mergeCustomerRows([...activityRows, ...churnRiskRows])
  const highValueThreshold = customerHighValueThreshold(rows)
  const cityStats = new Map<string, CityCustomerStats>()

  rows.forEach((row) => {
    const regionCode = row.regionCode || 'UNKNOWN'
    if (regionCode === 'UNKNOWN') return
    const current = cityStats.get(regionCode) || emptyCityCustomerStats()
    if (Number(row.activityScore || 0) >= 60) current.activeCustomerCount += 1
    if (Number(row.orderCount || 0) > 1) current.repeatCustomerCount += 1
    if (highValueThreshold > 0 && Number(row.salesAmount || 0) >= highValueThreshold) current.highValueCustomerCount += 1
    if (normalizeCustomerRiskLevel(row.churnRiskLevel) !== 'LOW') current.churnRiskCustomerCount += 1
    cityStats.set(regionCode, current)
  })

  return cityStats
}

function attachCityCustomerStats(
  rows: CityBusinessTableRow[],
  statsByRegion: Map<string, CityCustomerStats>,
) {
  return rows.map((row) => ({
    ...row,
    ...emptyCityCustomerStats(),
    ...(statsByRegion.get(row.dimensionCode) || statsByRegion.get(row.regionCode || '') || {}),
  }))
}

function buildCityBusinessRows(
  cityRows: SupplyDashboardRankingItem[],
  targetRows: CityTargetOverviewRow[],
  targetMap: Map<string, TargetMetricSnapshot>,
): CityBusinessTableRow[] {
  const rows = new Map<string, CityBusinessTableRow>()
  cityRows.forEach((item) => {
    if (!item.dimensionCode || item.dimensionCode === 'UNKNOWN') return
    rows.set(item.dimensionCode, {
      ...item,
      targetMetrics: {},
      targetAverageRate: null,
      targetConfiguredCount: 0,
      riskLevelCode: paymentRiskLevelCodeByRate(item.rate, Number(item.salesAmount || 0) > 0),
      ...emptyCityCustomerStats(),
    })
  })
  targetRows.forEach((targetRow) => {
    if (!targetRow.dimensionCode || targetRow.dimensionCode === 'UNKNOWN') return
    const current = rows.get(targetRow.dimensionCode) || {
      rankType: 'CITY',
      dimensionCode: targetRow.dimensionCode,
      dimensionName: targetRow.dimensionName,
      regionCode: targetRow.dimensionCode,
      regionName: targetRow.dimensionName,
      salesAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      orderCount: 0,
      customerCount: 0,
      rate: 0,
      targetMetrics: {},
      targetAverageRate: null,
      targetConfiguredCount: 0,
      riskLevelCode: 'none' as PaymentRiskLevelCode,
      ...emptyCityCustomerStats(),
    }
    const targetMetrics: Record<string, TargetMetricSnapshot> = {}
    targetMetricDefinitions.forEach((definition) => {
      const metric = targetMap.get(`${targetRow.dimensionCode}:${definition.code}`)
      if (metric) targetMetrics[definition.code] = metric
    })
    const configuredRates = Object.values(targetMetrics)
      .filter((metric) => Number(metric.targetValue || 0) > 0)
      .map((metric) => Number(metric.achievementRate || 0))
    rows.set(targetRow.dimensionCode, {
      ...current,
      dimensionName: regionName(targetRow.dimensionCode, current.dimensionName || targetRow.dimensionName),
      targetMetrics,
      targetConfiguredCount: configuredRates.length,
      targetAverageRate: configuredRates.length
        ? configuredRates.reduce((sum, value) => sum + value, 0) / configuredRates.length
        : null,
      riskLevelCode: paymentRiskLevelCodeByRate(current.rate, Number(current.salesAmount || 0) > 0),
    })
  })
  return [...rows.values()].sort((left, right) =>
    Number(right.salesAmount || 0) - Number(left.salesAmount || 0)
    || Number(right.paidAmount || 0) - Number(left.paidAmount || 0)
    || String(left.dimensionName || left.dimensionCode).localeCompare(String(right.dimensionName || right.dimensionCode)),
  )
}

function cityTargetAverageText(row: CityBusinessTableRow) {
  if (row.targetAverageRate == null) return '未配置'
  return formatPercent(row.targetAverageRate)
}

function cityTargetSummaryText(row: CityBusinessTableRow) {
  if (!row.targetConfiguredCount) return '目标待配置'
  return `${formatNumber(row.targetConfiguredCount)} / ${formatNumber(targetMetricDefinitions.length)} 项`
}

function buildSalesGoalProgressRow(
  metricCode: SalesGoalProgressRow['metricCode'],
  label: string,
  unit: TargetMetricDefinition['unit'],
): SalesGoalProgressRow {
  const targetRows = [...salesTargetCompletionMap.value.entries()]
    .filter(([key, value]) => key.endsWith(`:${metricCode}`) && Number(value.targetValue || 0) > 0)
    .map(([, value]) => value)
  if (!targetRows.length) {
    const metricValue = metricCode === 'SALES_AMOUNT' ? salesAmountMetric.value?.value : paidAmountMetric.value?.value
    return {
      metricCode,
      label,
      unit,
      targetValue: 0,
      actualValue: Number(metricValue || 0),
      achievementRate: 0,
      hasTarget: false,
    }
  }
  const targetValue = targetRows.reduce((sum, row) => sum + Number(row.targetValue || 0), 0)
  const actualValue = targetRows.reduce((sum, row) => sum + Number(row.actualValue || 0), 0)
  return {
    metricCode,
    label,
    unit,
    targetValue,
    actualValue,
    achievementRate: targetValue > 0 ? actualValue / targetValue * 100 : 0,
    hasTarget: true,
  }
}

function buildCurrentMonthTimeline(): CurrentMonthTimeline {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const monthDays = new Date(year, month + 1, 0).getDate()
  const elapsedDays = Math.min(Math.max(today, 1), monthDays)
  const remainingDays = Math.max(monthDays - elapsedDays, 0)
  return {
    label: `${year}年${String(month + 1).padStart(2, '0')}月时间进度`,
    elapsedDays,
    remainingDays,
    rate: elapsedDays / monthDays * 100,
  }
}

function attachSalesTargetMetric(items: SupplyDashboardRankingItem[], metricCode: string): SalesRankingDisplayRow[] {
  return items.map((item) => ({
    ...item,
    targetMetric: salesTargetCompletionMap.value.get(`${item.dimensionCode}:${metricCode}`),
  }))
}

function targetMetricActualText(metric: TargetMetricSnapshot | undefined, unit: TargetMetricDefinition['unit']) {
  if (!metric) return '-'
  return unit === 'CNY' ? formatMoneyWan(metric.actualValue) : formatNumber(metric.actualValue)
}

function targetMetricTargetText(metric: TargetMetricSnapshot | undefined, unit: TargetMetricDefinition['unit']) {
  if (!metric) return '-'
  return unit === 'CNY' ? formatMoneyWan(metric.targetValue) : formatNumber(metric.targetValue)
}

function targetMetricGapText(metric: TargetMetricSnapshot | undefined, unit: TargetMetricDefinition['unit']) {
  if (!metric || !Number(metric.targetValue || 0)) return '未配置'
  const gap = Number(metric.targetValue || 0) - Number(metric.actualValue || 0)
  if (Math.abs(gap) < 0.0001) return '刚好完成'
  const text = unit === 'CNY' ? formatMoneyWan(Math.abs(gap)) : formatNumber(Math.abs(gap))
  return gap > 0 ? `还差 ${text}` : `超出 ${text}`
}

function targetMetricRateText(metric: TargetMetricSnapshot | undefined) {
  if (!metric) return '-'
  return formatPercent(metric.achievementRate)
}

function targetMetricPercent(metric: TargetMetricSnapshot | undefined) {
  return boundedPercent(metric?.achievementRate || 0)
}

function targetRateClass(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return 'target-rate-cell--empty'
  const rate = Number(value)
  if (rate >= 100) return 'target-rate-cell--success'
  if (rate >= 60) return 'target-rate-cell--warning'
  return 'target-rate-cell--danger'
}

function inventoryShipmentRate(row: SupplyDashboardInventoryItemSummary) {
  const procurement = Number(row.procurementQuantity || 0)
  if (procurement <= 0) return 0
  return Number(row.shippedQuantity || 0) / procurement * 100
}

function inventoryPendingShipment(row: SupplyDashboardInventoryItemSummary) {
  return Math.max(Number(row.procurementQuantity || 0) - Number(row.shippedQuantity || 0), 0)
}

function inventoryHistoricalStockRate(row: SupplyDashboardInventoryItemSummary) {
  const remaining = Math.max(Number(row.remainingQuantity || 0), 0)
  const inactive = Math.max(Number(row.inactiveRemainingQuantity || 0), 0)
  const total = remaining + inactive
  if (total <= 0) return 0
  return inactive / total * 100
}

function inventoryOperationRowMetrics(row: SupplyDashboardInventoryItemSummary): InventoryOperationMetric[] {
  const unit = unitLabel(row.unitCode)
  if (isOverviewSection.value) {
    return [
      { label: '采购量', value: `${formatNumber(row.procurementQuantity)} ${unit}` },
      { label: '已发货', value: `${formatNumber(row.shippedQuantity)} ${unit}` },
      { label: '当前留存', value: `${formatNumber(row.remainingQuantity)} ${unit}` },
    ]
  }
  if (productInventoryView.value === 'procurement') {
    return [
      { label: '采购量', value: `${formatNumber(row.procurementQuantity)} ${unit}` },
      { label: '已发货', value: `${formatNumber(row.shippedQuantity)} ${unit}` },
      { label: '待发货', value: `${formatNumber(inventoryPendingShipment(row))} ${unit}` },
    ]
  }
  return [
    { label: '当前留存', value: `${formatNumber(row.remainingQuantity)} ${unit}` },
    { label: '历史/下架留存', value: `${formatNumber(row.inactiveRemainingQuantity)} ${unit}` },
    { label: '历史占比', value: formatPercent(inventoryHistoricalStockRate(row)) },
  ]
}

function inventoryOperationProgress(row: SupplyDashboardInventoryItemSummary) {
  if (isOverviewSection.value) {
    return Number(row.procurementQuantity || 0) > 0
      ? boundedPercent(inventoryShipmentRate(row))
      : 100 - boundedPercent(inventoryHistoricalStockRate(row))
  }
  if (productInventoryView.value === 'procurement') return boundedPercent(inventoryShipmentRate(row))
  return 100 - boundedPercent(inventoryHistoricalStockRate(row))
}

function inventoryOperationProgressLabel(row: SupplyDashboardInventoryItemSummary) {
  if (isOverviewSection.value) {
    return Number(row.procurementQuantity || 0) > 0
      ? `发货率 ${formatPercent(inventoryShipmentRate(row))}`
      : `可售留存占比 ${formatPercent(inventoryOperationProgress(row))}`
  }
  if (productInventoryView.value === 'procurement') return `发货率 ${formatPercent(inventoryShipmentRate(row))}`
  return `可售留存占比 ${formatPercent(inventoryOperationProgress(row))}`
}

function inventoryOperationRowStatus(row: SupplyDashboardInventoryItemSummary) {
  if (isOverviewSection.value) {
    if (inventoryPendingShipment(row) > 0) return '待发货'
    if (Number(row.inactiveRemainingQuantity || 0) > 0) return '含历史库存'
    if (Number(row.remainingQuantity || 0) > 0) return '有留存'
    if (Number(row.shippedQuantity || 0) > 0) return '已发货'
    return '无动作'
  }
  if (productInventoryView.value === 'procurement') {
    const procurement = Number(row.procurementQuantity || 0)
    if (procurement <= 0 && Number(row.shippedQuantity || 0) > 0) return '仅发货'
    if (inventoryPendingShipment(row) <= 0 && procurement > 0) return '已完成'
    if (inventoryShipmentRate(row) >= 60) return '履约中'
    return '待跟进'
  }
  if (Number(row.inactiveRemainingQuantity || 0) > 0) return '含历史库存'
  if (Number(row.remainingQuantity || 0) > 0) return '正常留存'
  return '无留存'
}

function inventoryOperationRowTagType(row: SupplyDashboardInventoryItemSummary): TagProps['type'] {
  if (isOverviewSection.value) {
    if (inventoryPendingShipment(row) > 0) return 'warning'
    if (Number(row.inactiveRemainingQuantity || 0) > 0) return 'warning'
    if (Number(row.remainingQuantity || 0) > 0 || Number(row.shippedQuantity || 0) > 0) return 'success'
    return 'info'
  }
  if (productInventoryView.value === 'procurement') {
    const procurement = Number(row.procurementQuantity || 0)
    if (procurement <= 0 && Number(row.shippedQuantity || 0) > 0) return 'info'
    if (inventoryPendingShipment(row) <= 0 && procurement > 0) return 'success'
    if (inventoryShipmentRate(row) >= 60) return 'warning'
    return 'danger'
  }
  if (Number(row.inactiveRemainingQuantity || 0) > 0) return 'warning'
  if (Number(row.remainingQuantity || 0) > 0) return 'success'
  return 'info'
}

function aggregateInventoryItemRows(rows: SupplyDashboardInventoryItemSummary[]): InventoryDetailItemRow[] {
  const groupMap = new Map<string, { row: InventoryDetailItemRow; unitCodes: Set<string> }>()
  rows.forEach((item) => {
    const key = inventoryDisplayKey(item.categoryName, item.categoryCode)
    const existing = groupMap.get(key)
    if (!existing) {
      groupMap.set(key, {
        row: {
          ...item,
          unitCount: 1,
        },
        unitCodes: new Set([normalizedUnitCode(item.unitCode)]),
      })
      return
    }
    existing.row.procurementQuantity += normalizedNumber(item.procurementQuantity)
    existing.row.shippedQuantity += normalizedNumber(item.shippedQuantity)
    existing.row.remainingQuantity += normalizedNumber(item.remainingQuantity)
    existing.row.inactiveRemainingQuantity += normalizedNumber(item.inactiveRemainingQuantity)
    existing.unitCodes.add(normalizedUnitCode(item.unitCode))
    existing.row.unitCount = existing.unitCodes.size
  })
  return [...groupMap.values()].map(({ row, unitCodes }) => ({
    ...row,
    unitCode: unitCodes.size === 1 ? [...unitCodes][0] : 'MIXED',
    unitCount: unitCodes.size,
  }))
}

function aggregateInventoryReplenishmentRows(rows: SupplyDashboardInventoryReplenishmentItem[]): InventoryDetailReplenishmentRow[] {
  const groupMap = new Map<string, { row: InventoryDetailReplenishmentRow; unitCodes: Set<string> }>()
  rows.forEach((item) => {
    const key = inventoryDisplayKey(item.productName, item.productCode)
    const existing = groupMap.get(key)
    if (!existing) {
      groupMap.set(key, {
        row: {
          ...item,
          unitCount: 1,
        },
        unitCodes: new Set([normalizedUnitCode(item.unitCode)]),
      })
      return
    }
    existing.row.salesQuantity += normalizedNumber(item.salesQuantity)
    existing.row.dailySalesQuantity += normalizedNumber(item.dailySalesQuantity)
    existing.row.availableQuantity += normalizedNumber(item.availableQuantity)
    existing.row.inTransitQuantity += normalizedNumber(item.inTransitQuantity)
    existing.row.suggestedProcurementQuantity += normalizedNumber(item.suggestedProcurementQuantity)
    existing.row.coverageDays = mergedCoverageDays(existing.row)
    existing.row.riskLevel = higherInventoryRisk(existing.row.riskLevel, item.riskLevel)
    if (item.inventoryStatus === 'HISTORICAL_STOCK') existing.row.inventoryStatus = item.inventoryStatus
    existing.unitCodes.add(normalizedUnitCode(item.unitCode))
    existing.row.unitCount = existing.unitCodes.size
  })
  return [...groupMap.values()].map(({ row, unitCodes }) => ({
    ...row,
    unitCode: unitCodes.size === 1 ? [...unitCodes][0] : 'MIXED',
    unitCount: unitCodes.size,
  }))
}

function inventoryDetailPrimaryQuantity(row: SupplyDashboardInventoryItemSummary) {
  if (activeInventoryDetailKind.value === 'shipped') return normalizedNumber(row.shippedQuantity)
  if (activeInventoryDetailKind.value === 'remaining') return normalizedNumber(row.remainingQuantity)
  return normalizedNumber(row.procurementQuantity)
}

function sortInventoryRows<T>(
  items: T[],
  valueOf: (item: T) => number,
) {
  return [...items].sort((left, right) =>
    Math.abs(valueOf(right)) - Math.abs(valueOf(left)),
  )
}

function formatInventoryQuantityTotal<T>(
  items: T[],
  valueOf: (item: T) => number,
) {
  const total = items.reduce((sum, item) => sum + normalizedNumber(valueOf(item)), 0)
  return formatNumber(total)
}

function formatInventorySummaryDetail(items: unknown[], noun = '品项') {
  if (!items.length) return '暂无明细'
  return `${formatNumber(items.length)} 个${noun}`
}

function inventoryDisplayKey(name?: string | null, code?: string | null) {
  return String(name || code || 'UNKNOWN').trim().toUpperCase()
}

function inventoryUnitScope(row: { unitCount?: number | null; unitCode?: string | null }) {
  const count = Number(row.unitCount || 0)
  if (count > 1) return `${formatNumber(count)}种`
  if (count === 1) return '1种'
  return unitLabel(row.unitCode)
}

function normalizedUnitCode(value?: string | null) {
  const normalized = value?.trim()
  return normalized || 'UNKNOWN'
}

function normalizedNumber(value?: number | string | null) {
  const numeric = Number(value || 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function mergedCoverageDays(row: SupplyDashboardInventoryReplenishmentItem) {
  const dailySales = normalizedNumber(row.dailySalesQuantity)
  if (dailySales <= 0) return 0
  return normalizedNumber(row.availableQuantity) / dailySales
}

function higherInventoryRisk(left?: string | null, right?: string | null) {
  return inventoryReplenishmentRiskRank(left) <= inventoryReplenishmentRiskRank(right) ? left || 'NORMAL' : right || 'NORMAL'
}

function inventoryReplenishmentRiskRank(value?: string | null) {
  if (value === 'HIGH') return 0
  if (value === 'MEDIUM') return 1
  if (value === 'SLOW') return 3
  return 2
}

function unitLabel(value?: string | null) {
  const normalized = value?.trim()
  if (!normalized || normalized === 'UNKNOWN') return '未维护单位'
  return productUnitLabels[normalized.toUpperCase()] || normalized
}

function formatCoverageDays(row: SupplyDashboardInventoryReplenishmentItem) {
  if (Number(row.salesQuantity || 0) <= 0) return '无销售'
  return `${formatNumber(row.coverageDays)}天`
}

function inventoryReplenishmentLabel(value?: string | null) {
  if (value === 'HIGH') return '紧缺'
  if (value === 'MEDIUM') return '偏低'
  if (value === 'SLOW') return '滞销'
  return '正常'
}

function inventoryReplenishmentTagType(value?: string | null): TagProps['type'] {
  if (value === 'HIGH') return 'danger'
  if (value === 'MEDIUM') return 'warning'
  if (value === 'SLOW') return 'info'
  return 'success'
}

function inventoryStatusLabel(value?: string | null) {
  if (value === 'HISTORICAL_STOCK') return '含历史库存'
  return '正常库存'
}

function inventoryStatusTagType(value?: string | null): TagProps['type'] {
  if (value === 'HISTORICAL_STOCK') return 'warning'
  return 'success'
}

function hasCostCoverage(value: number | string | null | undefined) {
  return Number(value || 0) > 0
}

function formatGrossProfitMoney(value: number | string | null | undefined, coverage?: number | string | null) {
  if (!hasCostCoverage(coverage ?? grossProfitCostCoverageRate.value)) return '待成本'
  return formatMoney(value)
}

function formatGrossProfitMoneyWan(value: number | string | null | undefined, coverage?: number | string | null) {
  if (!hasCostCoverage(coverage ?? grossProfitCostCoverageRate.value)) return '待成本'
  return formatMoneyWan(value)
}

function formatGrossProfitRate(value: number | string | null | undefined, coverage?: number | string | null) {
  if (!hasCostCoverage(coverage ?? grossProfitCostCoverageRate.value)) return '待成本'
  return formatPercent(value)
}

function baseDrillQuery() {
  const [from, to] = filters.dateRange
  return {
    orderDateFrom: from || undefined,
    orderDateTo: to || undefined,
    regionCode: filters.regionCode || undefined,
    ownerEmployeeCode: filters.ownerStaffCode || undefined,
  }
}

function openMetric(code: string) {
  if (isOverviewSection.value) return
  if (code === 'target_achievement_rate') {
    scrollToPanel('.target-completion-panel')
    return
  }
  if (code === 'refund_amount') {
    void router.push({
      name: 'SupplyOrderSalesRefunds',
      query: {
        refundTimeFrom: filters.dateRange[0] || undefined,
        refundTimeTo: filters.dateRange[1] || undefined,
        refundStaffCode: filters.ownerStaffCode || undefined,
      },
    })
    return
  }
  if (code.includes('gross_profit') || code === 'cost_coverage_rate' || code === 'sales_net_amount' || code === 'estimated_cost_amount') {
    void router.push({ name: 'SupplyBiGrossProfit' })
    return
  }
  if (code.startsWith('payment_risk') || code === 'payment_avg_overdue_days') {
    void router.push({ name: accessibleDashboardRouteName('payment-risk') })
    return
  }
  if (code === 'receipt_amount') {
    void router.push({
      name: 'SupplyOrderSalesPayments',
      query: {
        paymentTimeFrom: filters.dateRange[0] || undefined,
        paymentTimeTo: filters.dateRange[1] || undefined,
        collectorStaffCode: filters.ownerStaffCode || undefined,
      },
    })
    return
  }
  if (code === 'paid_amount') {
    void router.push({
      name: 'SupplyOrderSalesOrders',
      query: {
        ...baseDrillQuery(),
      },
    })
    return
  }
  if (code === 'inventory_risk_count') {
    if (dashboardSection.value === 'inventory-risk') {
      void router.push({ path: '/supply-chain/erp/inventory/inventory' })
    } else {
      void router.push({ name: 'SupplyBiInventoryRisk' })
    }
    return
  }
  if (code.includes('customer')) {
    void router.push({ name: 'SupplyBiCustomer' })
    return
  }
  if (code.includes('cost')) {
    if (dashboardSection.value === 'city-cost') {
      scrollToPanel('.city-cost-panel')
    } else {
      void router.push({ name: 'SupplyBiCityCost' })
    }
    return
  }
  void router.push({
    name: 'SupplyOrderSalesOrders',
    query: {
      ...baseDrillQuery(),
      paymentStatusCode: code === 'unpaid_amount' ? 'UNPAID' : undefined,
    },
  })
}

function openDashboardSection(section: DashboardSection) {
  void router.push({ name: accessibleDashboardRouteName(section) })
}

function openInventoryDetail(kind: InventoryDetailKind) {
  activeInventoryDetailKind.value = kind
  inventoryDetailVisible.value = true
}

function handleRoleSnapshotAction(action: RoleSnapshotAction) {
  if (action.inventoryView) productInventoryView.value = action.inventoryView
  if (action.inventoryDetail) {
    openInventoryDetail(action.inventoryDetail)
    return
  }
  if (action.scrollTarget) {
    scrollToPanel(action.scrollTarget)
    return
  }
  if (action.metricCode) {
    openMetric(action.metricCode)
    return
  }
  if (action.section) openDashboardSection(action.section)
}

function handleRoleSnapshotCardClick(card: RoleSnapshotCard) {
  handleRoleSnapshotAction(card)
}

function accessibleDashboardRouteName(section: DashboardSection) {
  const routeName = dashboardRouteNames[section]
  const resolved = router.resolve({ name: routeName })
  if (resolved.matched.length || navigationStore.hasPath('SUPPLY_CHAIN', resolved.path)) return routeName
  return legacyDashboardRouteNames[section] || routeName
}

function handleTrendChartClick(params: unknown) {
  const period = chartPeriodRange(chartParams(params).name)
  if (!period) return
  filters.dateRange = period
  void loadDashboard()
}

function selectCityRankingItem(item: SupplyDashboardRankingItem) {
  if (!item || !item.dimensionCode || item.dimensionCode === 'UNKNOWN') return
  filters.regionCode = item.dimensionCode
  if (isOverviewSection.value) {
    void router.push({ name: accessibleDashboardRouteName('city-operating') }).then(() => loadDashboard())
    return
  }
  void loadDashboard()
}

function selectSalesRankingItem(item: SupplyDashboardRankingItem) {
  if (!item || !item.dimensionCode || item.dimensionCode === 'UNKNOWN') return
  filters.ownerStaffCode = item.dimensionCode
  void loadDashboard()
}

function selectTargetCity(regionCode: string) {
  if (!regionCode || regionCode === 'UNKNOWN') return
  filters.regionCode = regionCode
  void loadDashboard()
}

function selectCustomerSegment(segmentCode: string) {
  if (!segmentCode) return
  selectedCustomerSegment.value = selectedCustomerSegment.value === segmentCode ? '' : segmentCode
  scrollToPanel('.customer-command-grid')
}

function selectCustomerRiskLevel(level: CustomerRiskLevel) {
  selectedCustomerRiskLevel.value = selectedCustomerRiskLevel.value === level ? '' : level
  scrollToPanel('.customer-follow-table-panel')
}

function clearCustomerFilters() {
  selectedCustomerSegment.value = ''
  selectedCustomerRiskLevel.value = ''
}

function handleCustomerHeroMetricClick(metric: CustomerHeroMetric) {
  if (metric.target === 'risk') {
    scrollToPanel('.customer-follow-table-panel')
    return
  }
  if (metric.metricCode) openMetric(metric.metricCode)
}

function filterCustomerRows<T extends { segmentCode?: string | null; churnRiskLevel?: string | null }>(rows: T[]) {
  return filterCustomerRowsBySegmentOnly(rows).filter((item) =>
    !selectedCustomerRiskLevel.value || normalizeCustomerRiskLevel(item.churnRiskLevel) === selectedCustomerRiskLevel.value,
  )
}

function filterCustomerRowsBySegmentOnly<T extends { segmentCode?: string | null }>(rows: T[]) {
  if (!selectedCustomerSegment.value) return rows
  return rows.filter((item) => item.segmentCode === selectedCustomerSegment.value)
}

function mergeCustomerRows(rows: SupplyDashboardCustomerActivityItem[]) {
  const merged = new Map<string, SupplyDashboardCustomerActivityItem>()
  rows.forEach((item) => {
    const key = item.customerCode || item.customerName
    if (!key) return
    merged.set(key, { ...(merged.get(key) || item), ...item })
  })
  return [...merged.values()]
}

function selectInventoryCategory(row: SupplyDashboardInventoryItemSummary) {
  const matched = filterOptions.value.productCategories.find((item) =>
    item.optionValue === row.categoryCode || item.optionLabel === row.categoryName,
  )
  if (matched) {
    filters.productCategoryId = matched.optionValue
    if (isProductSalesVisualSection.value) {
      void loadDashboard()
    } else {
      void router.push({ name: 'SupplyBiProductInventory' })
    }
    return
  }
  void router.push({
    path: '/supply-chain/erp/master-data/products',
    query: {
      categoryCode: row.categoryCode || undefined,
      categoryName: row.categoryName || undefined,
    },
  })
}

function handleSourceSystemChartClick(params: unknown) {
  const data = chartParams(params).data as SourceSystemPieData | undefined
  if (!data?.sourceSystemCode || data.sourceSystemCode === 'UNKNOWN') return
  filters.sourceSystemCode = data.sourceSystemCode
  void loadDashboard()
}

function handleOverviewBusinessShareChartClick(params: unknown) {
  const data = chartParams(params).data as SourceSystemPieData | undefined
  if (!data?.dimensionCode || data.dimensionCode === 'UNKNOWN' || data.isOther) return
  if (overviewShareMode.value === 'SOURCE') {
    handleSourceSystemChartClick(params)
    return
  }
  if (overviewShareMode.value === 'CITY') {
    const matched = citySalesRanking.value.find((item) => item.dimensionCode === data.dimensionCode)
    if (matched) selectCityRankingItem(matched)
    return
  }
  if (overviewShareMode.value === 'CATEGORY') {
    productBreakdown.value = 'PRODUCT'
    filters.productCategoryId = data.dimensionCode
    void router.push({ name: accessibleDashboardRouteName('product-sales') }).then(() => loadDashboard())
    return
  }
  productBreakdown.value = 'BRAND'
  void router.push({ name: accessibleDashboardRouteName('product-sales') }).then(() => loadDashboard())
}

function handleOverviewBusinessShareEntryClick(row: BusinessShareDisplayRow) {
  if (row.isOther) return
  handleOverviewBusinessShareChartClick({ data: row })
}

function handleInventoryCoverageChartClick(params: unknown) {
  const data = chartParams(params).data as InventoryCoverageChartData | undefined
  const index = typeof data?.sourceIndex === 'number' ? data.sourceIndex : chartDataIndex(params)
  const item = inventoryCoverageChartRows.value[index]
  if (item) openInventoryReplenishment(item)
}

function handleProductSalesChartClick(params: unknown) {
  const data = chartParams(params).data as ProductSalesChartData | undefined
  if (data?.isOther) return
  const index = typeof data?.sourceIndex === 'number' ? data.sourceIndex : chartDataIndex(params)
  const item = analysisProductSales.value[index]
  if (!item) return
  openProductSales(item)
}

function handleSalesAmountRankingChartClick(params: unknown) {
  openRankingChartItem(params, salesRanking.value, selectSalesRankingItem)
}

function handleSalesPaidRankingChartClick(params: unknown) {
  openRankingChartItem(params, salesPaidRanking.value, selectSalesRankingItem)
}

function handleSalesMonthlyChartClick(params: unknown) {
  const data = chartParams(params).data as (SalesMonthlyPerformanceChartData & RankingChartData) | undefined
  const ownerCode = data?.ownerStaffCode || data?.dimensionCode
  if (!ownerCode) return
  const matched = salesRanking.value.find((item) => item.dimensionCode === ownerCode)
  if (matched) {
    selectSalesRankingItem(matched)
    return
  }
  filters.ownerStaffCode = ownerCode
  loadDashboard()
}

function handlePaymentRiskCityChartClick(params: unknown) {
  openRankingChartItem(params, paymentRiskCityRanking.value, selectCityRankingItem)
}

function handlePaymentRiskSalesChartClick(params: unknown) {
  openRankingChartItem(params, paymentRiskSalesRanking.value, selectSalesRankingItem)
}

function handlePaymentAgingChartClick(params: unknown) {
  const data = chartParams(params).data as PaymentAgingBucketChartData | undefined
  void router.push({
    name: 'SupplyOrderSalesOrders',
    query: {
      ...baseDrillQuery(),
      paymentStatusCode: 'UNPAID',
      drillLabel: data?.bucketName
        ? `${data.bucketName}待回款（订单列表按待回款展示）`
        : '待回款订单',
    },
  })
}

function handleCityTargetHeatmapClick(params: unknown) {
  const data = chartParams(params).data as TargetHeatmapChartData | undefined
  if (data?.dimensionCode) selectTargetCity(data.dimensionCode)
}

function handleCustomerSegmentChartClick(params: unknown) {
  const data = chartParams(params).data as CustomerSegmentChartData | undefined
  if (data?.segmentCode) selectCustomerSegment(data.segmentCode)
}

function handleCustomerActivityChartClick(params: unknown) {
  const data = chartParams(params).data as CustomerActivityChartData | undefined
  if (data?.customerCode) openCustomer(data)
}

function selectProductBreakdown(value: ProductBreakdown) {
  productBreakdown.value = value
  scrollToPanel('.product-sales-bars')
}

function handleInventoryFlowChartClick(params: unknown) {
  const data = chartParams(params).data as InventoryFlowChartData | undefined
  if (data) selectInventoryCategory(data)
}

function openRankingChartItem(
  params: unknown,
  rows: SupplyDashboardRankingItem[],
  action: (item: SupplyDashboardRankingItem) => void,
) {
  const data = chartParams(params).data as RankingChartData | undefined
  const item = rows.find((row) => row.dimensionCode === data?.dimensionCode)
  if (item) action(item)
}

function chartParams(params: unknown): ChartClickParams {
  if (!params || typeof params !== 'object') return {}
  return params as ChartClickParams
}

function chartDataIndex(params: unknown) {
  const index = chartParams(params).dataIndex
  return typeof index === 'number' && index >= 0 ? index : -1
}

function chartPeriodRange(value?: string | number) {
  const text = String(value || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return [text, text]
  if (/^\d{4}-\d{2}$/.test(text)) return monthRange(text)
  return null
}

function monthRange(value: string) {
  const [yearText, monthText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return [dateValue(start), dateValue(end)]
}

function openProductSales(item: SupplyDashboardProductSalesItem) {
  if (productBreakdown.value === 'CATEGORY') {
    filters.productCategoryId = item.dimensionCode || ''
    void loadDashboard()
    return
  }
  if (productBreakdown.value === 'BRAND') {
    void router.push({
      path: '/supply-chain/erp/master-data/products',
      query: {
        brandName: item.dimensionName || undefined,
      },
    })
    return
  }
  void router.push({
    path: '/supply-chain/erp/master-data/products',
    query: {
      productName: productSearchName(item) || undefined,
    },
  })
}

function productSearchName(item: SupplyDashboardProductSalesItem) {
  if (productBreakdown.value !== 'SKU') return item.dimensionName || undefined
  return String(item.dimensionName || '').split('/')[0]?.trim() || item.dimensionName || undefined
}

function openCustomer(row: SupplyDashboardCustomerActivityItem) {
  void router.push({
    path: '/supply-chain/crm/customers/profiles',
    query: {
      customerCode: row.customerCode || undefined,
      customerName: row.customerName || undefined,
      regionCode: row.regionCode || undefined,
      ownerStaffCode: row.ownerStaffCode || undefined,
      customerTypeCode: row.customerTypeCode || undefined,
    },
  })
}

function openSaleableProducts() {
  void router.push({
    path: '/supply-chain/erp/master-data/products',
    query: {
      shelfStatusCode: 'ON_SHELF',
      submitStatusCode: 'SUBMITTED',
    },
  })
}

function openProductOrders(item: SupplyDashboardProductSalesItem) {
  if (productBreakdown.value === 'CATEGORY') {
    openProductSales(item)
    return
  }
  if (productBreakdown.value === 'BRAND') {
    openProductSales(item)
    return
  }
  const query: Record<string, string | undefined> = {
    ...baseDrillQuery(),
    drillLabel: `${productDimensionLabel.value}：${item.dimensionName || item.dimensionCode}`,
  }
  const dimensionId = numericDimensionCode(item.dimensionCode)
  if (productBreakdown.value === 'SKU') {
    if (dimensionId) {
      query.productVariantId = dimensionId
    } else if (item.dimensionCode) {
      query.skuCodeSnapshot = item.dimensionCode
    }
    if (!dimensionId) {
      const parts = skuDrillParts(item.dimensionName)
      query.productNameSnapshot = parts.productName || undefined
      query.specificationSnapshot = parts.specification || undefined
    }
  } else if (dimensionId) {
    query.productId = dimensionId
  } else {
    query.productCodeSnapshot = item.dimensionCode || undefined
    query.productNameSnapshot = productSearchName(item)
  }
  void router.push({
    name: 'SupplyOrderSalesOrders',
    query,
  })
}

function numericDimensionCode(value: string | null | undefined) {
  const normalized = String(value || '').trim()
  return /^\d+$/.test(normalized) ? normalized : undefined
}

function skuDrillParts(value: string | null | undefined) {
  const [productName, ...rest] = String(value || '').split('/')
  return {
    productName: productName?.trim() || '',
    specification: rest.join('/').trim(),
  }
}

function openRisk(row: SupplyDashboardRiskItem) {
  const { productName, warehouseName } = parseRiskDimensionName(row.dimensionName)
  void router.push({
    path: '/supply-chain/erp/inventory/inventory',
    query: {
      productCode: row.dimensionCode || undefined,
      productName: productName || undefined,
      warehouseName: warehouseName || undefined,
    },
  })
}

function openInventoryReplenishment(row: SupplyDashboardInventoryReplenishmentItem) {
  void router.push({
    path: '/supply-chain/erp/master-data/products',
    query: {
      productCode: row.productCode || undefined,
      productName: row.productName || undefined,
    },
  })
}

function scrollToPanel(selector: string) {
  requestAnimationFrame(() => {
    document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatMoneyWan(value?: number | null) {
  return `¥${formatNumber(Number(value || 0) / 10000)}万`
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(Number(value || 0))
}

function formatSignedCount(value?: number | null) {
  const numeric = Number(value || 0)
  return `${numeric > 0 ? '+' : ''}${formatNumber(numeric)}`
}

function formatSignedMoney(value?: number | null) {
  const numeric = Number(value || 0)
  return `${numeric > 0 ? '+' : ''}${formatMoney(numeric)}`
}

function formatPercent(value?: number | null) {
  return `${formatNumber(value)}%`
}

function formatDays(value?: number | null) {
  return `${formatNumber(value)}天`
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = apiDateValue(value)
  return date ? date.replaceAll('-', '/') : '-'
}

function boundedPercent(value?: number | null) {
  return Math.max(0, Math.min(100, Number(value || 0)))
}

function riskLevelRank(value?: string | null) {
  if (value === 'HIGH') return 0
  if (value === 'MEDIUM') return 1
  return 2
}

function riskWarehouseName(row: SupplyDashboardRiskItem) {
  return parseRiskDimensionName(row.dimensionName).warehouseName
}

function parseRiskDimensionName(value?: string | null) {
  const text = String(value || '').trim()
  const matched = text.match(/^(.*?)\s*(?:\/|-)\s*(.*)$/)
  if (!matched) return { productName: text, warehouseName: '' }
  const left = matched[1].trim()
  const right = matched[2].trim()
  if (/仓|仓库|库$/.test(left)) return { productName: right, warehouseName: left }
  return { productName: left, warehouseName: right }
}

function sortRankingBy(items: SupplyDashboardRankingItem[], field: RankingAmountField) {
  return [...items].sort((left, right) => Number(right[field] || 0) - Number(left[field] || 0))
}

function salesMonthlyOwnersFromItems(items: SupplyDashboardSalesMonthlyPerformance[]) {
  const totals = new Map<string, { name: string, value: number }>()
  items.forEach((item) => {
    const code = item.ownerStaffCode || 'UNKNOWN'
    const current = totals.get(code) || {
      name: item.ownerStaffName || item.ownerStaffCode || '未分配销售',
      value: 0,
    }
    current.value += Number(item.salesAmount || 0)
    totals.set(code, current)
  })
  return [...totals.entries()]
    .sort((left, right) => right[1].value - left[1].value)
    .slice(0, 8)
    .map(([code, item]) => ({ code, name: item.name }))
}

function salesMonthLabel(value?: string | null) {
  if (!value) return '-'
  const matched = value.match(/^(\d{4})-(\d{2})$/)
  if (!matched) return value
  return `${matched[1]}年${matched[2]}月`
}

function paymentRiskLevelCodeByRate(value?: number | null, hasData = true): PaymentRiskLevelCode {
  if (!hasData || value == null || !Number.isFinite(Number(value))) return 'none'
  const rate = Number(value)
  if (rate >= 60) return 'healthy'
  if (rate > 20) return 'warning'
  return 'danger'
}

function paymentRiskItemLevelLabel(value?: number | null) {
  const level = paymentRiskLevelCodeByRate(value)
  if (level === 'healthy') return '健康'
  if (level === 'warning') return '预警'
  if (level === 'danger') return '高危'
  return '暂无'
}

function paymentRiskItemTagType(value?: number | null): TagProps['type'] {
  const level = paymentRiskLevelCodeByRate(value)
  if (level === 'healthy') return 'success'
  if (level === 'warning') return 'warning'
  if (level === 'danger') return 'danger'
  return 'info'
}

function customerSegmentTagType(value?: string | null): TagProps['type'] {
  if (value === 'A') return 'success'
  if (value === 'B') return 'warning'
  return 'info'
}

function customerChurnRiskLabel(value?: string | null) {
  if (value === 'HIGH') return '高危'
  if (value === 'MEDIUM') return '预警'
  if (value === 'LOW') return '稳定'
  return '未知'
}

function customerChurnTagType(value?: string | null): TagProps['type'] {
  if (value === 'HIGH') return 'danger'
  if (value === 'MEDIUM') return 'warning'
  if (value === 'LOW') return 'success'
  return 'info'
}

function normalizeCustomerRiskLevel(value?: string | null): CustomerRiskLevel {
  if (value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') return value
  return 'LOW'
}

function customerChurnTone(value?: string | null) {
  const level = normalizeCustomerRiskLevel(value)
  if (level === 'HIGH') return 'danger'
  if (level === 'MEDIUM') return 'warning'
  return 'success'
}

function customerPriorityScore(row: SupplyDashboardCustomerActivityItem) {
  const riskWeight = normalizeCustomerRiskLevel(row.churnRiskLevel) === 'HIGH'
    ? 3
    : normalizeCustomerRiskLevel(row.churnRiskLevel) === 'MEDIUM'
      ? 2
      : 1
  return riskWeight * 1_000_000_000
    + Math.min(Number(row.inactiveDays || 0), 9999) * 10_000
    + Number(row.unpaidAmount || 0)
}

function customerSegmentPercent(item: SupplyDashboardCustomerSegmentItem) {
  if (!customerAllSegmentCount.value) return 0
  return boundedPercent(Number(item.customerCount || 0) / customerAllSegmentCount.value * 100)
}

function customerHighValueThreshold(rows: SupplyDashboardCustomerActivityItem[]) {
  const salesValues = rows
    .map((row) => Number(row.salesAmount || 0))
    .filter((value) => value > 0)
    .sort((left, right) => right - left)
  if (!salesValues.length) return 0
  return salesValues[Math.min(Math.floor(salesValues.length * 0.25), salesValues.length - 1)]
}

function buildCustomerValueMatrixRows(rows: SupplyDashboardCustomerActivityItem[]): CustomerValueMatrixRow[] {
  const threshold = customerHighValueThreshold(rows)
  const totalCount = Math.max(rows.length, 1)
  const cells = [
    {
      key: 'high-active',
      label: '高价值活跃',
      summary: '重点维护复购和回款',
      tone: 'success' as DashboardSnapshotTone,
      predicate: (row: SupplyDashboardCustomerActivityItem) =>
        threshold > 0 && Number(row.salesAmount || 0) >= threshold && Number(row.activityScore || 0) >= 60,
    },
    {
      key: 'high-silent',
      label: '高价值待唤醒',
      summary: '高贡献但近期活跃不足',
      tone: 'warning' as DashboardSnapshotTone,
      predicate: (row: SupplyDashboardCustomerActivityItem) =>
        threshold > 0 && Number(row.salesAmount || 0) >= threshold && Number(row.activityScore || 0) < 60,
    },
    {
      key: 'potential-active',
      label: '潜力活跃',
      summary: '活跃但交易额未进入高价值线',
      tone: 'primary' as DashboardSnapshotTone,
      predicate: (row: SupplyDashboardCustomerActivityItem) =>
        (threshold <= 0 || Number(row.salesAmount || 0) < threshold) && Number(row.activityScore || 0) >= 60,
    },
    {
      key: 'low-active',
      label: '低活跃跟进',
      summary: '长期未动或无成交优先排查',
      tone: 'danger' as DashboardSnapshotTone,
      predicate: (row: SupplyDashboardCustomerActivityItem) =>
        (threshold <= 0 || Number(row.salesAmount || 0) < threshold) && Number(row.activityScore || 0) < 60,
    },
  ]

  return cells.map((cell) => {
    const matchedRows = rows.filter(cell.predicate)
    const salesAmount = matchedRows.reduce((total, row) => total + Number(row.salesAmount || 0), 0)
    const unpaidAmount = matchedRows.reduce((total, row) => total + Number(row.unpaidAmount || 0), 0)
    return {
      key: cell.key,
      label: cell.label,
      summary: `${cell.summary} · 待回款 ${formatMoneyWan(unpaidAmount)}`,
      count: matchedRows.length,
      salesAmount,
      unpaidAmount,
      percent: matchedRows.length / totalCount * 100,
      tone: cell.tone,
    }
  })
}

function customerInactiveLabel(row: SupplyDashboardCustomerActivityItem) {
  if (!row.lastOrderTime || Number(row.inactiveDays || 0) >= 9999) return '无下单记录'
  const days = Number(row.inactiveDays || 0)
  if (days <= 0) return '今日下单'
  return `${formatNumber(days)}天未下单`
}

function customerBubbleColor(row: SupplyDashboardCustomerActivityItem) {
  const riskLevel = normalizeCustomerRiskLevel(row.churnRiskLevel)
  if (riskLevel === 'HIGH') return chartTheme.danger
  if (riskLevel === 'MEDIUM') return chartTheme.warning
  if (row.segmentCode === 'A') return chartTheme.success
  if (row.segmentCode === 'B') return '#0f766e'
  return chartTheme.primary
}

function rankingIndexClass(index: number) {
  if (index === 0) return 'ranking-row__index--first'
  if (index === 1) return 'ranking-row__index--second'
  if (index === 2) return 'ranking-row__index--third'
  return ''
}

function paymentRiskColorByRate(value?: number | null) {
  const level = paymentRiskLevelCodeByRate(value)
  if (level === 'healthy') return chartTheme.success
  if (level === 'warning') return chartTheme.warning
  if (level === 'danger') return chartTheme.danger
  return chartTheme.muted
}

function paymentRiskLevelDefinition(code: Exclude<PaymentRiskLevelCode, 'none'>) {
  const definitions: Record<Exclude<PaymentRiskLevelCode, 'none'>, { label: string; color: string }> = {
    healthy: { label: '健康', color: chartTheme.success },
    warning: { label: '预警', color: chartTheme.warning },
    danger: { label: '高危', color: chartTheme.danger },
  }
  return definitions[code]
}

function buildPaymentRiskLevelSummaryRows(items: SupplyDashboardRankingItem[]): PaymentRiskLevelSummaryRow[] {
  const levels: Exclude<PaymentRiskLevelCode, 'none'>[] = ['healthy', 'warning', 'danger']
  const totalUnpaidAmount = items.reduce((total, item) => total + Number(item.unpaidAmount || 0), 0)
  return levels.map((code) => {
    const rows = items.filter((item) =>
      paymentRiskLevelCodeByRate(item.rate, Number(item.salesAmount || 0) > 0) === code,
    )
    const unpaidAmount = rows.reduce((total, item) => total + Number(item.unpaidAmount || 0), 0)
    const definition = paymentRiskLevelDefinition(code)
    return {
      code,
      label: definition.label,
      cityCount: rows.length,
      unpaidAmount,
      percent: totalUnpaidAmount > 0 ? boundedPercent(unpaidAmount / totalUnpaidAmount * 100) : 0,
      color: definition.color,
    }
  })
}

function buildPaymentRiskCityGroups(items: SupplyDashboardRankingItem[]): PaymentRiskCityGroup[] {
  const totalUnpaidAmount = items.reduce((total, item) => total + Number(item.unpaidAmount || 0), 0)
  return (['healthy', 'warning', 'danger'] as Array<Exclude<PaymentRiskLevelCode, 'none'>>).map((code) => {
    const definition = paymentRiskLevelDefinition(code)
    const rows = items
      .filter((item) => paymentRiskLevelCodeByRate(item.rate, Number(item.salesAmount || 0) > 0) === code)
      .sort((left, right) =>
        Number(right.unpaidAmount || 0) - Number(left.unpaidAmount || 0)
        || Number(right.salesAmount || 0) - Number(left.salesAmount || 0)
        || Number(right.rate || 0) - Number(left.rate || 0),
      )
    const unpaidAmount = rows.reduce((total, item) => total + Number(item.unpaidAmount || 0), 0)
    return {
      code,
      label: definition.label,
      cityCount: rows.length,
      unpaidAmount,
      percent: totalUnpaidAmount > 0 ? boundedPercent(unpaidAmount / totalUnpaidAmount * 100) : 0,
      color: definition.color,
      rows,
    }
  })
}

function overviewSparklineValues(kind: OverviewSparklineKind) {
  const rows = normalizeSalesTrend(overview.value?.salesTrend || []).slice(-10)
  if (!rows.length) {
    if (kind === 'sales') return [Number(salesAmountMetric.value?.value || 0)]
    if (kind === 'paid') return [Number(paidAmountMetric.value?.value || 0)]
    if (kind === 'unpaid') return [Number(unpaidAmountMetric.value?.value || 0)]
    return [overviewPaidRate.value]
  }
  return rows.map((row) => {
    const sales = Number(row.value || 0)
    const paid = Number(row.secondaryValue || 0)
    if (kind === 'sales') return sales
    if (kind === 'paid') return paid
    if (kind === 'unpaid') return Math.max(sales - paid, 0)
    return sales > 0 ? paid / sales * 100 : 0
  })
}

function overviewSparklineSummary(values: number[], unit: 'CNY' | 'PERCENT') {
  if (values.length <= 1) return '暂无可比趋势'
  const first = Number(values[0] || 0)
  const last = Number(values[values.length - 1] || 0)
  const delta = last - first
  if (Math.abs(delta) < 0.0001) return `${formatNumber(values.length)}期趋势 · 基本持平`
  const deltaText = unit === 'CNY' ? formatMoneyWan(Math.abs(delta)) : formatPercent(Math.abs(delta))
  return `${formatNumber(values.length)}期趋势 · 较首期${delta > 0 ? '增加' : '减少'} ${deltaText}`
}

function buildOverviewSparklineOption(
  values: number[],
  color: string,
  chartType: 'bar' | 'line',
): EChartsCoreOption {
  return {
    color: [color],
    animation: true,
    tooltip: { show: false },
    grid: { top: 6, right: 0, bottom: 0, left: 0 },
    xAxis: {
      type: 'category',
      show: false,
      data: values.map((_, index) => String(index + 1)),
    },
    yAxis: {
      type: 'value',
      show: false,
      min: 0,
    },
    series: [
      {
        type: chartType,
        data: values,
        smooth: true,
        symbol: 'none',
        barWidth: '52%',
        lineStyle: { width: 2 },
        areaStyle: chartType === 'line' ? { opacity: 0.12 } : undefined,
        itemStyle: { borderRadius: [3, 3, 0, 0] },
      },
    ],
  }
}

function buildRankingAmountChartOption(
  items: SupplyDashboardRankingItem[],
  field: RankingAmountField,
  valueName: string,
  color: string,
): EChartsCoreOption {
  const rows = items.slice(0, 10).reverse()
  return {
    color: [color],
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: ProductSalesTooltipParam | ProductSalesTooltipParam[]) => {
        const first = Array.isArray(params) ? params[0] : params
        const data = first?.data as RankingChartData | undefined
        if (!data) return first?.name || valueName
        return [
          data.dimensionName || first?.name || '销售',
          `城市：${salesRankingRegionLabel(data)}`,
          `交易额：${formatMoneyWan(data.salesAmount)}`,
          `回款额：${formatMoneyWan(data.paidAmount)}`,
          `待回款：${formatMoneyWan(data.unpaidAmount)}`,
          `订单数：${formatNumber(data.orderCount)}`,
          `客户数：${formatNumber(data.customerCount)}`,
          `回款率：${formatPercent(data.rate)}`,
        ].join('<br/>')
      },
    },
    grid: { top: 16, right: 72, bottom: 20, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: moneyAxisLabel, color: chartTheme.text },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map((item) => item.dimensionName || item.dimensionCode),
      axisLabel: { color: chartTheme.text, width: 110, overflow: 'truncate' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    series: [
      {
        name: valueName,
        type: 'bar',
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'right',
          color: chartTheme.label,
          fontWeight: 700,
          formatter: (params: { value?: number | string }) => formatMoneyWan(Number(params.value || 0)),
        },
        data: rows.map((item) => ({
          ...item,
          value: Number(item[field] || 0),
        })),
        itemStyle: { borderRadius: [0, 5, 5, 0] },
      },
    ],
  }
}

function buildPaymentProgressRingOption(paidAmount: number, unpaidAmount: number): EChartsCoreOption {
  const paid = Math.max(0, Number(paidAmount || 0))
  const unpaid = Math.max(0, Number(unpaidAmount || 0))
  const total = paid + unpaid
  const rate = total > 0 ? paid / total * 100 : 0
  return {
    color: [chartTheme.success, '#e2e8f0'],
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'item',
      formatter: (params: { name?: string, value?: number | string, percent?: number }) => [
        params.name || '回款',
        `金额：${formatMoneyWan(Number(params.value || 0))}`,
        `占比：${formatNumber(params.percent)}%`,
      ].join('<br/>'),
    },
    graphic: {
      type: 'text',
      left: 'center',
      top: 'center',
      style: {
        text: formatPercent(rate),
        fill: chartTheme.label,
        fontSize: 28,
        fontWeight: 800,
        textAlign: 'center',
      },
    },
    series: [
      {
        name: '回款进度',
        type: 'pie',
        radius: ['62%', '82%'],
        center: ['50%', '50%'],
        silent: true,
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        data: [
          { name: '已回款', value: paid },
          { name: '待回款', value: unpaid },
        ],
      },
    ],
  }
}

function buildSalesMonthlyComparisonChartOption(
  items: SupplyDashboardSalesMonthlyPerformance[],
  owners: SalesMonthlyOwner[],
  field: SalesMonthlyMetricField,
  valueName: string,
): EChartsCoreOption {
  const periods = [...new Set(items.map((item) => item.period).filter(Boolean))].sort()
  const ownerRows = owners.length ? owners : salesMonthlyOwnersFromItems(items)
  const valueFormatter = field === 'orderCount'
    ? (value: number | string) => formatNumber(Number(value || 0))
    : (value: number | string) => formatMoneyWan(Number(value || 0))
  const dataByKey = new Map<string, SupplyDashboardSalesMonthlyPerformance>()
  items.forEach((item) => {
    dataByKey.set(`${item.period}:${item.ownerStaffCode || 'UNKNOWN'}`, item)
  })

  return {
    color: chartPalette,
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: ProductSalesTooltipParam | ProductSalesTooltipParam[]) => {
        const rows = (Array.isArray(params) ? params : [params])
          .map((param) => param.data as SalesMonthlyPerformanceChartData | undefined)
          .filter((item): item is SalesMonthlyPerformanceChartData => Boolean(item))
          .filter((item) => Number(item.value || 0) > 0)
        if (!rows.length) return valueName
        return [
          salesMonthLabel(rows[0].period),
          ...rows.map((row) =>
            `${row.ownerStaffName || row.ownerStaffCode || '未分配销售'}：${valueFormatter(row.value || 0)}`,
          ),
        ].join('<br/>')
      },
    },
    legend: {
      type: 'scroll',
      top: 0,
      left: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    grid: { top: 48, right: 18, bottom: periods.length > 6 ? 52 : 30, left: 54, containLabel: true },
    xAxis: {
      type: 'category',
      data: periods.map(salesMonthLabel),
      axisLabel: { color: chartTheme.text },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: field === 'orderCount' ? (value: number | string) => formatNumber(Number(value || 0)) : moneyAxisLabel,
        color: chartTheme.text,
      },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    dataZoom: chartDataZoom(periods.length),
    series: ownerRows.map((owner) => ({
      name: owner.name,
      type: 'bar',
      barMaxWidth: 16,
      emphasis: { focus: 'series' },
      data: periods.map((period) => {
        const matched = dataByKey.get(`${period}:${owner.code}`)
        return {
          ...(matched || {
            period,
            ownerStaffCode: owner.code,
            ownerStaffName: owner.name,
            regionCode: null,
            regionName: null,
            salesAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            orderCount: 0,
            customerCount: 0,
            rate: 0,
          }),
          value: Number(matched?.[field] || 0),
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        }
      }),
    })),
  }
}

function buildPaymentRiskChartOption(
  items: SupplyDashboardRankingItem[],
  valueName: string,
): EChartsCoreOption {
  const rows = items.slice(0, 10).reverse()
  return {
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: ProductSalesTooltipParam | ProductSalesTooltipParam[]) => {
        const first = Array.isArray(params) ? params[0] : params
        const data = first?.data as RankingChartData | undefined
        if (!data) return first?.name || valueName
        return [
          data.dimensionName || first?.name || '风险对象',
          `待回款：${formatMoneyWan(data.unpaidAmount)}`,
          `风险等级：${paymentRiskItemLevelLabel(data.rate)}`,
          `交易额：${formatMoneyWan(data.salesAmount)}`,
          `已回款：${formatMoneyWan(data.paidAmount)}`,
          `回款率：${formatPercent(data.rate)}`,
          `客户数：${formatNumber(data.customerCount)}`,
          `订单数：${formatNumber(data.orderCount)}`,
        ].join('<br/>')
      },
    },
    grid: { top: 16, right: 72, bottom: 20, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: moneyAxisLabel, color: chartTheme.text },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map((item) => item.dimensionName || item.dimensionCode),
      axisLabel: { color: chartTheme.text, width: 118, overflow: 'truncate' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    series: [
      {
        name: valueName,
        type: 'bar',
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'right',
          color: chartTheme.label,
          fontWeight: 700,
          formatter: (params: { value?: number | string }) => formatMoneyWan(Number(params.value || 0)),
        },
        data: rows.map((item) => ({
          ...item,
          value: Number(item.unpaidAmount || 0),
          itemStyle: { color: paymentRiskColorByRate(item.rate), borderRadius: [0, 5, 5, 0] },
        })),
      },
    ],
  }
}

function buildPaymentRiskLevelChartOption(items: PaymentRiskLevelSummaryRow[]): EChartsCoreOption {
  const totalAmount = items.reduce((sum, item) => sum + Number(item.unpaidAmount || 0), 0)
  return {
    color: items.map((item) => item.color),
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'item',
      formatter: (params: { name?: string; value?: number | string; percent?: number; data?: PaymentRiskLevelSummaryRow }) => {
        const data = params.data
        if (!data) return params.name || '风险结构'
        return [
          data.label,
          `城市数：${formatNumber(data.cityCount)}`,
          `待回款：${formatMoneyWan(data.unpaidAmount)}`,
          `金额占比：${formatPercent(Number(params.percent || 0))}`,
        ].join('<br/>')
      },
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'center',
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    graphic: {
      type: 'text',
      left: '34%',
      top: 'center',
      style: {
        text: totalAmount > 0 ? formatMoneyWan(totalAmount) : '暂无',
        fill: chartTheme.label,
        fontSize: 18,
        fontWeight: 800,
        textAlign: 'center',
      },
    },
    series: [
      {
        name: '风险金额结构',
        type: 'pie',
        radius: ['54%', '76%'],
        center: ['36%', '50%'],
        avoidLabelOverlap: true,
        label: {
          formatter: '{b}\n{d}%',
          color: chartTheme.label,
          fontWeight: 700,
        },
        labelLine: { length: 10, length2: 8 },
        data: items.map((item) => ({
          ...item,
          name: item.label,
          value: Number(item.unpaidAmount || 0),
        })),
      },
    ],
  }
}

function buildPaymentAgingBucketChartOption(items: SupplyDashboardPaymentAgingBucket[]): EChartsCoreOption {
  const definitions = [
    { code: 'CURRENT', name: '未逾期', color: chartTheme.success },
    { code: 'DAYS_1_30', name: '逾期1-30天', color: chartTheme.warning },
    { code: 'DAYS_31_60', name: '逾期31-60天', color: '#ea580c' },
    { code: 'DAYS_61_PLUS', name: '逾期60天以上', color: chartTheme.danger },
  ]
  const rows = definitions.map((definition) => {
    const matched = items.find((item) => item.bucketCode === definition.code)
    return {
      bucketCode: definition.code,
      bucketName: matched?.bucketName || definition.name,
      orderCount: Number(matched?.orderCount || 0),
      customerCount: Number(matched?.customerCount || 0),
      unpaidAmount: Number(matched?.unpaidAmount || 0),
      color: definition.color,
    }
  })

  return {
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: ProductSalesTooltipParam | ProductSalesTooltipParam[]) => {
        const first = Array.isArray(params) ? params[0] : params
        const data = first?.data as PaymentAgingBucketChartData | undefined
        if (!data) return first?.name || '待回款账龄'
        return [
          data.bucketName || first?.name || '待回款账龄',
          `待回款：${formatMoneyWan(data.unpaidAmount)}`,
          `订单数：${formatNumber(data.orderCount)}`,
          `客户数：${formatNumber(data.customerCount)}`,
        ].join('<br/>')
      },
    },
    grid: { top: 18, right: 24, bottom: 26, left: 10, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map((item) => item.bucketName),
      axisLabel: { color: chartTheme.text },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: moneyAxisLabel, color: chartTheme.text },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    series: [
      {
        name: '待回款',
        type: 'bar',
        barMaxWidth: 36,
        label: {
          show: true,
          position: 'top',
          color: chartTheme.label,
          fontWeight: 700,
          formatter: (params: { value?: number | string }) => formatMoneyWan(Number(params.value || 0)),
        },
        data: rows.map((item) => ({
          ...item,
          value: item.unpaidAmount,
          itemStyle: { color: item.color, borderRadius: [5, 5, 0, 0] },
        })),
      },
    ],
  }
}

function buildCustomerSegmentChartOption(items: SupplyDashboardCustomerSegmentItem[]): EChartsCoreOption {
  return {
    color: [chartTheme.success, chartTheme.warning, chartTheme.primary],
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'item',
      formatter: (params: { name?: string, value?: number | string, percent?: number, data?: CustomerSegmentChartData }) => {
        const data = params.data
        if (!data) return params.name || '客户分层'
        return [
          data.segmentName || params.name || '客户分层',
          `客户数：${formatNumber(data.customerCount)}`,
          `销售额：${formatMoneyWan(data.salesAmount)}`,
          `待回款：${formatMoneyWan(data.unpaidAmount)}`,
          `平均活跃度：${formatNumber(data.averageActivityScore)}`,
          `流失预警：${formatNumber(data.churnRiskCustomerCount)}`,
        ].join('<br/>')
      },
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    series: [
      {
        name: '客户分层',
        type: 'pie',
        radius: ['46%', '70%'],
        center: ['50%', '44%'],
        label: {
          formatter: '{b}\n{d}%',
          color: chartTheme.label,
          fontWeight: 700,
        },
        data: items.map((item) => ({
          ...item,
          name: item.segmentName || item.segmentCode,
          value: Number(item.customerCount || 0),
        })),
      },
    ],
  }
}

function buildCustomerValueActivityChartOption(items: SupplyDashboardCustomerActivityItem[]): EChartsCoreOption {
  const labelCustomers = new Set(
    [...items]
      .sort((left, right) =>
        Number(right.salesAmount || 0) - Number(left.salesAmount || 0)
        || Number(right.unpaidAmount || 0) - Number(left.unpaidAmount || 0),
      )
      .slice(0, 6)
      .map((item) => item.customerCode || item.customerName),
  )
  const rows = items.map((item) => ({
    ...item,
    value: [
      Number(item.activityScore || 0),
      Number(item.salesAmount || 0),
      Number(item.unpaidAmount || 0),
    ] as [number, number, number],
    itemStyle: {
      color: customerBubbleColor(item),
      borderColor: '#fff',
      borderWidth: 2,
      shadowBlur: 10,
      shadowColor: 'rgba(15, 23, 42, 0.14)',
    },
  }))
  const averageSalesAmount = rows.length
    ? rows.reduce((total, item) => total + Number(item.salesAmount || 0), 0) / rows.length
    : 0
  return {
    color: [chartTheme.primary],
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'item',
      formatter: (params: { data?: CustomerActivityChartData }) => {
        const data = params.data
        if (!data) return '客户'
        return [
          data.customerName || data.customerCode || '客户',
          `分层：${data.segmentName || data.segmentCode}`,
          `风险：${customerChurnRiskLabel(data.churnRiskLevel)}`,
          `城市：${regionName(data.regionCode, data.regionName)}`,
          `销售：${data.ownerStaffName || data.ownerStaffCode || '-'}`,
          `活跃度：${formatNumber(data.activityScore)}`,
          `交易额：${formatMoneyWan(data.salesAmount)}`,
          `回款额：${formatMoneyWan(data.paidAmount)}`,
          `待回款：${formatMoneyWan(data.unpaidAmount)}`,
          `最近下单：${customerInactiveLabel(data)}`,
        ].join('<br/>')
      },
    },
    grid: { top: 40, right: 28, bottom: 46, left: 64, containLabel: true },
    xAxis: {
      type: 'value',
      name: '活跃度',
      min: 0,
      max: 100,
      nameGap: 22,
      nameTextStyle: { color: chartTheme.text, fontWeight: 700 },
      axisLabel: { color: chartTheme.text },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: '交易额',
      nameGap: 24,
      nameTextStyle: { color: chartTheme.text, fontWeight: 700 },
      axisLabel: { formatter: (value: number | string) => formatMoneyWan(Number(value || 0)), color: chartTheme.text },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    series: [
      {
        name: '客户',
        type: 'scatter',
        data: rows,
        clip: false,
        z: 3,
        label: {
          show: true,
          formatter: (params: { data?: CustomerActivityChartData }) => {
            const data = params.data
            const key = data?.customerCode || data?.customerName
            return key && labelCustomers.has(key) ? data?.customerName || data?.customerCode || '' : ''
          },
          position: 'top',
          color: chartTheme.label,
          fontSize: 11,
          fontWeight: 700,
        },
        symbolSize: (value: unknown) => {
          const tuple = Array.isArray(value) ? value : []
          const unpaidAmount = Number(tuple[2] || 0)
          const salesAmount = Number(tuple[1] || 0)
          return Math.max(14, Math.min(44, 14 + Math.sqrt(Math.max(unpaidAmount, salesAmount * 0.18)) / 70))
        },
        emphasis: {
          focus: 'series',
          label: {
            show: true,
            formatter: (params: { data?: CustomerActivityChartData }) => params.data?.customerName || '',
            position: 'top',
            color: chartTheme.label,
            fontWeight: 700,
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { color: chartTheme.muted, fontSize: 11 },
          lineStyle: { color: chartTheme.splitLine, type: 'dashed' },
          data: [
            { xAxis: 60, name: '活跃线' },
            ...(averageSalesAmount > 0 ? [{ yAxis: averageSalesAmount, name: '均值' }] : []),
          ],
        },
      },
    ],
  }
}

function buildCityTargetHeatmapOption(rows: CityTargetOverviewRow[]): EChartsCoreOption {
  const metrics = targetMetricDefinitions
  const data: TargetHeatmapChartData[] = rows.flatMap((row, cityIndex) =>
    metrics.map((metric, metricIndex) => {
      const snapshot = row.metrics[metric.code]
      const achievementRate = Number(snapshot?.achievementRate || 0)
      return {
        value: [metricIndex, cityIndex, achievementRate],
        dimensionCode: row.dimensionCode,
        dimensionName: row.dimensionName,
        metricCode: metric.code,
        metricName: metric.name,
        targetValue: Number(snapshot?.targetValue || 0),
        actualValue: Number(snapshot?.actualValue || 0),
        achievementRate,
      }
    }),
  )
  return {
    tooltip: {
      ...dashboardTooltipStyle(),
      formatter: (params: { data?: TargetHeatmapChartData }) => {
        const dataItem = params.data
        if (!dataItem) return '目标完成度'
        const definition = targetMetricDefinitions.find((item) => item.code === dataItem.metricCode)
        const unit = definition?.unit || 'COUNT'
        return [
          `${dataItem.dimensionName} · ${dataItem.metricName}`,
          `目标：${unit === 'CNY' ? formatMoneyWan(dataItem.targetValue) : formatNumber(dataItem.targetValue)}`,
          `实际：${unit === 'CNY' ? formatMoneyWan(dataItem.actualValue) : formatNumber(dataItem.actualValue)}`,
          `完成率：${formatPercent(dataItem.achievementRate)}`,
        ].join('<br/>')
      },
    },
    grid: { top: 18, right: 24, bottom: 36, left: 74, containLabel: true },
    xAxis: {
      type: 'category',
      data: metrics.map((item) => item.name),
      axisLabel: { color: chartTheme.text },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    yAxis: {
      type: 'category',
      data: rows.map((item) => item.dimensionName),
      axisLabel: { color: chartTheme.text, width: 92, overflow: 'truncate' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    visualMap: {
      show: false,
      min: 0,
      max: 100,
      dimension: 2,
      inRange: { color: ['#fee2e2', '#fed7aa', '#dcfce7'] },
    },
    series: [
      {
        name: '目标完成率',
        type: 'heatmap',
        data,
        label: {
          show: true,
          color: chartTheme.label,
          fontWeight: 700,
          formatter: (params: { data?: TargetHeatmapChartData }) => formatPercent(params.data?.achievementRate || 0),
        },
        itemStyle: {
          borderWidth: 2,
          borderColor: '#fff',
          borderRadius: 4,
        },
        emphasis: {
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(15, 23, 42, 0.18)' },
        },
      },
    ],
  }
}

function buildInventoryFlowChartOption(
  items: SupplyDashboardInventoryItemSummary[],
  view: ProductInventoryView,
): EChartsCoreOption {
  const rows = items.slice(0, 12).reverse()
  const procurementMode = view === 'procurement'
  const series = procurementMode
    ? [
        {
          name: '已发货',
          flowType: 'shipped' as const,
          color: chartTheme.success,
          valueOf: (item: SupplyDashboardInventoryItemSummary) => Number(item.shippedQuantity || 0),
        },
        {
          name: '待发货',
          flowType: 'procurement' as const,
          color: chartTheme.warning,
          valueOf: (item: SupplyDashboardInventoryItemSummary) => inventoryPendingShipment(item),
        },
      ]
    : [
        {
          name: '当前留存',
          flowType: 'remaining' as const,
          color: chartTheme.success,
          valueOf: (item: SupplyDashboardInventoryItemSummary) => Number(item.remainingQuantity || 0),
        },
        {
          name: '历史留存',
          flowType: 'inactive' as const,
          color: chartTheme.warning,
          valueOf: (item: SupplyDashboardInventoryItemSummary) => Number(item.inactiveRemainingQuantity || 0),
        },
      ]
  return {
    color: series.map((item) => item.color),
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ data?: InventoryFlowChartData }>) => {
        const data = params[0]?.data
        if (!data) return '库存/采购'
        return [
          data.categoryName || data.categoryCode,
          `采购量：${formatNumber(data.procurementQuantity)}`,
          `已发货：${formatNumber(data.shippedQuantity)}`,
          `待发货：${formatNumber(inventoryPendingShipment(data))}`,
          `当前留存：${formatNumber(data.remainingQuantity)}`,
          `历史留存：${formatNumber(data.inactiveRemainingQuantity)}`,
          `涉及单位：${inventoryUnitScope(data)}`,
        ].join('<br/>')
      },
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    grid: { top: 42, right: 42, bottom: 18, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: chartTheme.text },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map((item) => item.categoryName || item.categoryCode),
      axisLabel: { color: chartTheme.text, width: 124, overflow: 'truncate' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    series: series.map((item) => ({
      name: item.name,
      type: 'bar',
      stack: procurementMode ? 'procurement' : 'inventory',
      barMaxWidth: 18,
      label: {
        show: true,
        color: chartTheme.label,
        fontWeight: 700,
        formatter: (params: { value?: number | string }) => {
          const value = Number(params.value || 0)
          return value > 0 ? formatNumber(value) : ''
        },
      },
      data: rows.map((row) => ({
        ...row,
        value: item.valueOf(row),
        flowType: item.flowType,
        itemStyle: { borderRadius: [0, 5, 5, 0] },
      })),
    })),
  }
}

function buildSalesCollectionChartOption(
  salesTrend: SupplyDashboardTrendPoint[],
  collectionTrend: SupplyDashboardTrendPoint[],
  showActualReceipt: boolean,
): EChartsCoreOption {
  const periods = trendPeriods(salesTrend, collectionTrend)
  const sales = trendMap(salesTrend)
  const collections = trendMap(collectionTrend)
  const series = [
    {
      name: '交易额',
      type: 'bar',
      barMaxWidth: 22,
      data: periods.map((period) => Number(sales.get(period)?.value || 0)),
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    },
    {
      name: '回款额',
      type: 'line',
      smooth: true,
      symbolSize: 7,
      lineStyle: { width: 3 },
      data: periods.map((period) => Number(sales.get(period)?.secondaryValue || 0)),
    },
  ]
  if (showActualReceipt) {
    series.push({
      name: '期间实际回款',
      type: 'line',
      smooth: true,
      symbolSize: 6,
      lineStyle: { width: 2, type: 'dashed' },
      data: periods.map((period) => Number(collections.get(period)?.value || 0)),
    })
  }
  return {
    color: [chartTheme.primary, chartTheme.success, chartTheme.warning],
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      valueFormatter: (value: number | string) => formatMoneyWan(Number(value || 0)),
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    grid: { top: 42, right: 18, bottom: 24, left: 54, containLabel: true },
    xAxis: {
      type: 'category',
      data: periods,
      axisLabel: { formatter: periodAxisLabel, color: chartTheme.text },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: moneyAxisLabel, color: chartTheme.text },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    dataZoom: chartDataZoom(periods.length),
    series,
  }
}

function buildSourceSystemPieOption(
  items: SupplyDashboardRankingItem[],
  seriesName = '销售占比',
  fallbackName = '维度',
): EChartsCoreOption {
  return {
    color: chartPalette,
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'item',
      formatter: (params: PieTooltipParam) => {
        const data = params.data || {}
        return [
          params.name || fallbackName,
          `销售额：${formatMoneyWan(params.value)}`,
          `占比：${formatNumber(params.percent)}%`,
          Number(data.orderCount || 0) > 0 ? `下单数：${formatNumber(data.orderCount)}` : '',
          Number(data.customerCount || 0) > 0 ? `客户数：${formatNumber(data.customerCount)}` : '',
          Number(data.rate || 0) > 0 ? `回款率：${formatPercent(data.rate)}` : '',
        ].filter(Boolean).join('<br/>')
      },
    },
    legend: {
      orient: 'vertical',
      top: 'center',
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    series: [
      {
        name: seriesName,
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b}\n{d}%', color: chartTheme.label },
        data: items.map((item) => ({
          name: item.dimensionName || item.dimensionCode,
          value: Number(item.salesAmount || 0),
          dimensionCode: item.dimensionCode,
          rankType: item.rankType,
          sourceSystemCode: item.dimensionCode,
          orderCount: item.orderCount,
          customerCount: item.customerCount,
          rate: item.rate,
        })),
      },
    ],
  }
}

function buildBusinessShareDisplayRows(items: SupplyDashboardRankingItem[]): BusinessShareDisplayRow[] {
  const sorted = [...items].sort((left, right) => Number(right.salesAmount || 0) - Number(left.salesAmount || 0))
  const totalAmount = sorted.reduce((sum, item) => sum + Number(item.salesAmount || 0), 0)
  const visibleRows = sorted.slice(0, 5)
  const otherRows = sorted.slice(5)
  const rows = visibleRows.map((item, index) => {
    const salesAmount = Number(item.salesAmount || 0)
    return {
      ...item,
      value: salesAmount,
      salesAmount,
      percent: totalAmount > 0 ? salesAmount / totalAmount * 100 : 0,
      color: chartPalette[index % chartPalette.length],
      sourceSystemCode: item.dimensionCode,
    }
  })
  const otherAmount = otherRows.reduce((sum, item) => sum + Number(item.salesAmount || 0), 0)
  if (otherAmount > 0) {
    rows.push({
      rankType: 'OTHER',
      dimensionCode: 'OTHER',
      dimensionName: '其他',
      regionCode: null,
      regionName: null,
      salesAmount: otherAmount,
      paidAmount: 0,
      unpaidAmount: 0,
      orderCount: otherRows.reduce((sum, item) => sum + Number(item.orderCount || 0), 0),
      customerCount: 0,
      rate: 0,
      value: otherAmount,
      percent: totalAmount > 0 ? otherAmount / totalAmount * 100 : 0,
      color: '#94a3b8',
      sourceSystemCode: 'OTHER',
      isOther: true,
    })
  }
  return rows
}

function buildBusinessShareDonutOption(
  items: BusinessShareDisplayRow[],
  fallbackName = '维度',
): EChartsCoreOption {
  const totalAmount = items.reduce((sum, item) => sum + Number(item.salesAmount || 0), 0)
  return {
    color: items.map((item) => item.color),
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'item',
      formatter: (params: { name?: string; data?: BusinessShareDisplayRow }) => {
        const data = params.data
        if (!data) return params.name || fallbackName
        return [
          data.dimensionName || params.name || fallbackName,
          `销售额：${formatMoneyWan(data.salesAmount)}`,
          `贡献占比：${formatPercent(data.percent)}`,
          Number(data.orderCount || 0) > 0 ? `下单数：${formatNumber(data.orderCount)}` : '',
          Number(data.customerCount || 0) > 0 ? `客户数：${formatNumber(data.customerCount)}` : '',
          Number(data.rate || 0) > 0 ? `回款率：${formatPercent(data.rate)}` : '',
        ].filter(Boolean).join('<br/>')
      },
    },
    legend: { show: false },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '41%',
        style: {
          text: '总额',
          fill: chartTheme.text,
          fontSize: 12,
          fontWeight: 600,
          textAlign: 'center',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '52%',
        style: {
          text: formatMoneyWan(totalAmount),
          fill: chartTheme.label,
          fontSize: 16,
          fontWeight: 800,
          textAlign: 'center',
        },
      },
    ],
    series: [
      {
        name: fallbackName,
        type: 'pie',
        radius: ['58%', '78%'],
        center: ['50%', '50%'],
        minAngle: 4,
        avoidLabelOverlap: true,
        label: {
          show: false,
        },
        labelLine: { show: false },
        itemStyle: {
          borderColor: '#fff',
          borderRadius: 6,
          borderWidth: 3,
        },
        data: items.map((item) => ({
          ...item,
          name: item.dimensionName || item.dimensionCode || fallbackName,
          value: item.value,
        })),
      },
    ],
  }
}

function buildProductActivationChartOption(soldCount: number, unsoldCount: number): EChartsCoreOption {
  const total = Math.max(soldCount + unsoldCount, 1)
  const rows = [
    { name: '已动销', value: soldCount, color: chartTheme.success },
    { name: '未动销', value: unsoldCount, color: chartTheme.warning },
  ]

  return {
    color: rows.map((item) => item.color),
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: () => [
        '可售商品动销结构',
        `已动销：${formatNumber(soldCount)} 个`,
        `未动销：${formatNumber(unsoldCount)} 个`,
        `动销率：${formatPercent(soldCount / total * 100)}`,
      ].join('<br/>'),
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    grid: { top: 42, right: 18, bottom: 10, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      max: total,
      show: false,
    },
    yAxis: {
      type: 'category',
      data: ['可售商品'],
      axisLabel: { color: chartTheme.text },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: rows.map((row) => ({
      name: row.name,
      type: 'bar',
      stack: 'activation',
      barWidth: 22,
      label: {
        show: row.value > 0,
        color: '#fff',
        fontWeight: 700,
        formatter: () => formatNumber(row.value),
      },
      data: [
        {
          value: row.value,
          itemStyle: { color: row.color, borderRadius: row.name === '已动销' ? [5, 0, 0, 5] : [0, 5, 5, 0] },
        },
      ],
    })),
  }
}

function buildProductSalesChartOption(
  items: SupplyDashboardProductSalesItem[],
  breakdown: ProductBreakdown,
  grossProfitMode: boolean,
): EChartsCoreOption {
  const rows = items
    .slice(0, 12)
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .reverse()
  const dimensionLabel = breakdown === 'SKU' ? 'SKU' : breakdown === 'CATEGORY' ? '分类' : breakdown === 'BRAND' ? '品牌' : '商品'
  const valueName = grossProfitMode ? '估算毛利' : '订货金额'
  return {
    color: [grossProfitMode ? chartTheme.profit : chartTheme.primary],
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: ProductSalesTooltipParam | ProductSalesTooltipParam[]) => {
        const first = Array.isArray(params) ? params[0] : params
        const data = first?.data || {}
        const lines = [
          first?.name || dimensionLabel,
          `订货金额：${formatMoneyWan(data.salesAmount)}`,
          `订货数量：${formatNumber(data.salesQuantity)}`,
        ]
        if (grossProfitMode) {
          lines.push(
            `销售净收入：${formatMoneyWan(data.salesNetAmount)}`,
            `估算成本：${formatMoneyWan(data.estimatedCostAmount)}`,
            `估算毛利：${formatGrossProfitMoneyWan(data.estimatedGrossProfit, data.costCoverageRate)}`,
            `估算毛利率：${formatGrossProfitRate(data.estimatedGrossProfitRate, data.costCoverageRate)}`,
            `成本覆盖：${formatPercent(data.costCoverageRate)}`,
          )
        }
        lines.push(`下单数：${formatNumber(data.orderCount)}`, `客户数：${formatNumber(data.customerCount)}`)
        return lines.join('<br/>')
      },
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    grid: { top: 42, right: 96, bottom: 24, left: 12, containLabel: true },
    xAxis: {
      type: 'value',
      name: valueName,
      nameTextStyle: { color: chartTheme.text },
      axisLabel: { formatter: moneyAxisLabel, color: chartTheme.text },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map(({ item }) => item.dimensionName || item.dimensionCode),
      axisLabel: { color: chartTheme.text, width: 170, overflow: 'truncate' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    series: [
      {
        name: valueName,
        type: 'bar',
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'right',
          color: chartTheme.label,
          fontWeight: 700,
          formatter: (params: { value?: number | string, data?: { costCoverageRate?: number } }) => {
            if (grossProfitMode && !hasCostCoverage(params.data?.costCoverageRate)) return '待成本'
            return formatMoneyWan(Number(params.value || 0))
          },
        },
        data: rows.map(({ item, sourceIndex }) => ({
          value: grossProfitMode
            ? hasCostCoverage(item.costCoverageRate) ? Number(item.estimatedGrossProfit || 0) : 0
            : Number(item.salesAmount || 0),
          sourceIndex,
          salesAmount: Number(item.salesAmount || 0),
          salesQuantity: Number(item.salesQuantity || 0),
          salesNetAmount: Number(item.salesNetAmount || 0),
          estimatedCostAmount: Number(item.estimatedCostAmount || 0),
          estimatedGrossProfit: Number(item.estimatedGrossProfit || 0),
          estimatedGrossProfitRate: Number(item.estimatedGrossProfitRate || 0),
          costCoverageRate: Number(item.costCoverageRate || 0),
          orderCount: item.orderCount,
          customerCount: item.customerCount,
        })),
        itemStyle: { borderRadius: [0, 5, 5, 0] },
      },
    ],
  }
}

function buildProductVolumeChartOption(
  items: SupplyDashboardProductSalesItem[],
  breakdown: ProductBreakdown,
): EChartsCoreOption {
  const rows = items
    .slice(0, 12)
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .reverse()
  const dimensionLabel = breakdown === 'SKU' ? 'SKU' : breakdown === 'CATEGORY' ? '分类' : breakdown === 'BRAND' ? '品牌' : '商品'
  return {
    color: [chartTheme.success],
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: ProductSalesTooltipParam | ProductSalesTooltipParam[]) => {
        const first = Array.isArray(params) ? params[0] : params
        const data = first?.data || {}
        return [
          first?.name || dimensionLabel,
          `订货数量：${formatNumber(data.salesQuantity)}`,
          `下单客户数：${formatNumber(data.customerCount)}`,
          `订货金额：${formatMoneyWan(data.salesAmount)}`,
          `下单数：${formatNumber(data.orderCount)}`,
        ].join('<br/>')
      },
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    grid: { top: 42, right: 118, bottom: 24, left: 12, containLabel: true },
    xAxis: {
      type: 'value',
      name: '订货数量',
      nameTextStyle: { color: chartTheme.text },
      axisLabel: { formatter: (value: number | string) => formatNumber(Number(value || 0)), color: chartTheme.text },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map(({ item }) => item.dimensionName || item.dimensionCode),
      axisLabel: { color: chartTheme.text, width: 170, overflow: 'truncate' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    series: [
      {
        name: '订货数量',
        type: 'bar',
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'right',
          color: chartTheme.label,
          fontWeight: 700,
          formatter: (params: { value?: number | string, data?: ProductSalesChartData }) =>
            `${formatNumber(Number(params.value || 0))} / ${formatNumber(params.data?.customerCount)}客`,
        },
        data: rows.map(({ item, sourceIndex }) => ({
          sourceIndex,
          value: Number(item.salesQuantity || 0),
          salesQuantity: Number(item.salesQuantity || 0),
          salesAmount: Number(item.salesAmount || 0),
          orderCount: Number(item.orderCount || 0),
          customerCount: Number(item.customerCount || 0),
        })),
        itemStyle: { borderRadius: [0, 5, 5, 0] },
      },
    ],
  }
}

function buildInventoryRiskChartOption(items: SupplyDashboardRiskItem[]): EChartsCoreOption {
  const levels = [
    { code: 'HIGH', name: '高风险', color: chartTheme.danger },
    { code: 'MEDIUM', name: '中风险', color: chartTheme.warning },
    { code: 'LOW', name: '低风险', color: chartTheme.muted },
  ]
  const counts = new Map(levels.map((level) => [level.code, 0]))
  items.forEach((item) => {
    const key = item.riskLevel === 'HIGH' || item.riskLevel === 'MEDIUM' ? item.riskLevel : 'LOW'
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return {
    color: levels.map((level) => level.color),
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: () => [
        '库存风险分布',
        ...levels.map((level) => `${level.name}：${formatNumber(counts.get(level.code) || 0)} 项`),
      ].join('<br/>'),
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    grid: { top: 40, right: 18, bottom: 12, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: chartTheme.text },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: ['库存风险项'],
      axisLabel: { color: chartTheme.text },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    series: levels.map((level) => ({
      name: level.name,
      type: 'bar',
      stack: 'risk',
      barMaxWidth: 28,
      label: {
        show: true,
        color: '#fff',
        fontWeight: 700,
        formatter: (params: { value?: number | string }) => {
          const value = Number(params.value || 0)
          return value > 0 ? formatNumber(value) : ''
        },
      },
      data: [
        {
          value: counts.get(level.code) || 0,
          riskLevel: level.code,
        } as InventoryRiskChartData & { value: number },
      ],
    })),
  }
}

function buildInventoryCoverageChartOption(items: SupplyDashboardInventoryReplenishmentItem[]): EChartsCoreOption {
  const rows = items.slice().reverse()
  return {
    color: [chartTheme.warning],
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ name?: string; value?: number | string; data?: InventoryCoverageChartData & SupplyDashboardInventoryReplenishmentItem }>) => {
        const data = params[0]?.data
        if (!data) return params[0]?.name || '补货观察'
        return [
          data.productName || params[0]?.name || '商品',
          `分类：${data.categoryName || '-'}`,
          `近周期订货：${formatNumber(data.salesQuantity)} ${unitLabel(data.unitCode)}`,
          `日均消耗：${formatNumber(data.dailySalesQuantity)} ${unitLabel(data.unitCode)}`,
          `可用库存：${formatNumber(data.availableQuantity)} ${unitLabel(data.unitCode)}`,
          `在途：${formatNumber(data.inTransitQuantity)} ${unitLabel(data.unitCode)}`,
          `覆盖天数：${formatCoverageDays(data)}`,
          `建议补货：${formatNumber(data.suggestedProcurementQuantity)} ${unitLabel(data.unitCode)}`,
        ].join('<br/>')
      },
    },
    grid: { top: 18, right: 82, bottom: 18, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      name: '覆盖天数',
      nameTextStyle: { color: chartTheme.text },
      axisLabel: { formatter: (value: number | string) => `${formatNumber(Number(value || 0))}天`, color: chartTheme.text },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map((item) => item.productName || item.productCode),
      axisLabel: { color: chartTheme.text, width: 180, overflow: 'truncate' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    series: [
      {
        name: '库存覆盖',
        type: 'bar',
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'right',
          color: chartTheme.label,
          fontWeight: 700,
          formatter: (params: { data?: SupplyDashboardInventoryReplenishmentItem }) =>
            params.data ? formatCoverageDays(params.data) : '',
        },
        data: rows.map((item, reversedIndex) => ({
          ...item,
          value: Number(item.coverageDays || 0),
          sourceIndex: rows.length - 1 - reversedIndex,
          productCode: item.productCode,
          itemStyle: {
            color: item.riskLevel === 'HIGH' ? chartTheme.danger : item.riskLevel === 'MEDIUM' ? chartTheme.warning : chartTheme.success,
          },
        })),
      },
    ],
  }
}

function buildCityCostChartOption(items: SupplyDashboardTrendPoint[]): EChartsCoreOption {
  const rows = items.slice(-14)
  const periods = rows.map((item) => item.period)
  return {
    color: [chartTheme.cost, chartTheme.success],
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      valueFormatter: (value: number | string) => formatMoneyWan(Number(value || 0)),
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    grid: { top: 42, right: 18, bottom: 24, left: 54, containLabel: true },
    xAxis: {
      type: 'category',
      data: periods,
      axisLabel: { formatter: (value: string) => value.slice(5), color: chartTheme.text },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: moneyAxisLabel, color: chartTheme.text },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    dataZoom: chartDataZoom(periods.length),
    series: [
      {
        name: '成本',
        type: 'bar',
        barMaxWidth: 22,
        data: rows.map((item) => Number(item.value || 0)),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '预算',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3 },
        data: rows.map((item) => Number(item.secondaryValue || 0)),
      },
    ],
  }
}

function buildActivityTrendChartOption(): EChartsCoreOption {
  const rows = [
    { day: '09/01', cost: 2000, sales: 5000 },
    { day: '09/02', cost: 2000, sales: 6500 },
    { day: '09/03', cost: 1500, sales: 8000 },
    { day: '09/04', cost: 1500, sales: 7200 },
    { day: '09/05', cost: 2000, sales: 9000 },
  ]
  return {
    color: [chartTheme.warning, chartTheme.primary],
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'axis',
      valueFormatter: (value: number | string) => formatMoney(Number(value || 0)),
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: chartTheme.text },
    },
    grid: { top: 42, right: 18, bottom: 24, left: 54, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map((item) => item.day),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartTheme.axisLine } },
      axisLabel: { color: chartTheme.text },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: moneyAxisLabel, color: chartTheme.text },
      splitLine: { lineStyle: { color: chartTheme.splitLine, type: 'dashed' } },
    },
    series: [
      {
        name: '投入额',
        type: 'bar',
        barMaxWidth: 20,
        data: rows.map((item) => item.cost),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '交易额',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3 },
        data: rows.map((item) => item.sales),
      },
    ],
  }
}

function buildActivityFunnelChartOption(): EChartsCoreOption {
  const rows = [
    { name: '覆盖客户', value: 320 },
    { name: '有效触达', value: 238 },
    { name: '产生订单', value: 96 },
    { name: '完成回款', value: 61 },
  ]
  return {
    color: [chartTheme.primary, chartTheme.success, chartTheme.warning, chartTheme.profit],
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'item',
      formatter: (params: PieTooltipParam) => [
        params.name || '活动漏斗',
        `数量：${formatNumber(params.value)}`,
        '样例数据，不进入真实经营汇总',
      ].join('<br/>'),
    },
    series: [
      {
        name: '活动转化漏斗',
        type: 'funnel',
        top: 10,
        left: '8%',
        width: '84%',
        minSize: '34%',
        maxSize: '100%',
        sort: 'descending',
        gap: 4,
        label: {
          show: true,
          position: 'inside',
          color: '#fff',
          fontWeight: 800,
          formatter: '{b} {c}',
        },
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        data: rows,
      },
    ],
  }
}

function normalizeSalesTrend(items: SupplyDashboardTrendPoint[]) {
  return quickPeriod.value === 'year' ? aggregateTrendByMonth(items) : items
}

function normalizeCollectionTrend(items: SupplyDashboardTrendPoint[]) {
  return quickPeriod.value === 'year' ? aggregateTrendByMonth(items) : items
}

function aggregateTrendByMonth(items: SupplyDashboardTrendPoint[]) {
  const monthMap = new Map<string, SupplyDashboardTrendPoint>()
  items.forEach((item) => {
    const month = item.period.slice(0, 7)
    const current = monthMap.get(month)
    if (!current) {
      monthMap.set(month, { ...item, period: month })
      return
    }
    monthMap.set(month, {
      ...current,
      value: Number(current.value || 0) + Number(item.value || 0),
      secondaryValue: Number(current.secondaryValue || 0) + Number(item.secondaryValue || 0),
    })
  })
  return [...monthMap.values()].sort((left, right) => left.period.localeCompare(right.period))
}

function trendPeriods(...groups: SupplyDashboardTrendPoint[][]) {
  return [...new Set(groups.flatMap((items) => items.map((item) => item.period)))]
    .sort()
}

function trendMap(items: SupplyDashboardTrendPoint[]) {
  return new Map(items.map((item) => [item.period, item]))
}

function chartDataZoom(length: number) {
  if (length <= 10) return []
  return [
    { type: 'inside', xAxisIndex: 0 },
  ]
}

function moneyAxisLabel(value: number | string) {
  return formatMoneyWan(Number(value || 0))
}

function periodAxisLabel(value: string) {
  return /^\d{4}-\d{2}$/.test(value) ? `${value.slice(5)}月` : value.slice(5)
}

function riskLabel(value: string) {
  if (value === 'HIGH') return '高'
  if (value === 'MEDIUM') return '中'
  return '低'
}

function riskTagType(value: string): TagProps['type'] {
  if (value === 'HIGH') return 'danger'
  if (value === 'MEDIUM') return 'warning'
  return 'info'
}

onMounted(() => {
  loadFilterOptions()
  loadCrmMasterOptions()
  loadDashboard()
  loadReconciliation()
})
</script>

<style scoped lang="scss">
.supply-bi-page {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 16px;
}

.filter-panel,
.panel {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.filter-panel {
  display: grid;
  gap: 8px;
  padding: 10px 12px 0;
}

.bi-filter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 30px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
}

.bi-filter-title {
  display: grid;
  min-width: 0;
  gap: 2px;

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 16px;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    line-height: 18px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.bi-filter-tools {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.bi-filter-meta {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}

.bi-refresh-button {
  min-width: 118px;
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}

.bi-sync-panel {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.bi-sync-panel__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;

  > div {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  span {
    color: #2563eb;
    font-size: 12px;
    font-weight: 800;
  }

  strong {
    color: #0f172a;
    font-size: 15px;
    line-height: 22px;
  }

  p {
    margin: 0;
    color: #64748b;
    font-size: 12px;
    line-height: 18px;
  }
}

.bi-sync-scope-options {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.bi-sync-scope-option {
  display: grid;
  min-width: 0;
  min-height: 72px;
  gap: 5px;
  align-content: start;
  padding: 10px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  text-align: left;
  cursor: pointer;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  strong {
    font-size: 13px;
    line-height: 18px;
    white-space: nowrap;
  }

  span {
    color: #64748b;
    font-size: 12px;
    line-height: 16px;
  }
}

.bi-sync-scope-option--active {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.14);

  strong {
    color: #2563eb;
  }
}

.bi-sync-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  span {
    padding: 4px 8px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: 12px;
    font-weight: 700;
    line-height: 16px;
  }
}

.bi-sync-reconciliation {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.bi-sync-reconciliation__head,
.bi-sync-reconciliation__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.bi-sync-reconciliation__head strong,
.bi-sync-reconciliation__item strong {
  min-width: 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bi-sync-reconciliation__list {
  display: grid;
  gap: 6px;
}

.bi-sync-reconciliation__item {
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;

  span {
    min-width: 0;
    color: #64748b;
    font-size: 12px;
    line-height: 17px;
    text-align: right;
  }
}

.bi-sync-reconciliation__empty {
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
}

.quick-period-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;

  :deep(.el-radio-button__inner) {
    padding: 5px 10px;
  }

  :deep(.el-radio-button:first-child .el-radio-button__inner) {
    border-radius: 6px 0 0 6px;
  }

  :deep(.el-radio-button:last-child .el-radio-button__inner) {
    border-radius: 0 6px 6px 0;
  }

  > span {
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }
}

.product-inventory-mode-bar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #fff;

  > div {
    display: grid;
    flex: 1 1 auto;
    min-width: 0;
    gap: 3px;
  }

  :deep(.el-radio-group) {
    display: inline-flex;
    flex: 0 0 auto;
    flex-wrap: nowrap;
    white-space: nowrap;
  }

  :deep(.el-radio-button__inner) {
    padding: 7px 12px;
  }

  strong {
    color: #0f172a;
    font-size: 14px;
  }

  span {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.filter-panel :deep(.el-form) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(228px, 1fr));
  align-items: end;
  gap: 8px 10px;
}

.filter-panel :deep(.el-form-item) {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: center;
  margin-right: 0;
  margin-bottom: 0;
}

.filter-panel :deep(.el-form-item__label) {
  justify-content: flex-start;
  height: auto;
  padding: 0 6px 0 0;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
}

.filter-panel :deep(.el-form-item__content) {
  min-width: 0;
}

.filter-panel :deep(.el-input),
.filter-panel :deep(.el-select),
.filter-panel :deep(.el-date-editor) {
  width: 100% !important;
}

.filter-panel :deep(.bi-filter-item--date) {
  grid-column: span 2;
}

.filter-panel :deep(.filter-actions) {
  grid-template-columns: minmax(0, 1fr);
  margin-left: 0;
}

.filter-panel :deep(.filter-actions .el-form-item__content) {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
}

.dashboard-alert {
  flex: 0 0 auto;
}

.overview-command-center {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background:
    linear-gradient(180deg, #fff 0%, #f8fbff 100%),
    linear-gradient(90deg, rgba(37, 99, 235, 0.08), transparent 42%);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
}

.overview-command-headline {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 2px 2px;

  > div {
    display: grid;
    min-width: 0;
    gap: 4px;
  }

  span {
    color: #2563eb;
    font-size: 13px;
    font-weight: 800;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 26px;
    line-height: 1.12;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: #64748b;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.overview-command-headline__meta {
  align-content: center;
  min-width: 160px;
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #fff;
  text-align: right;

  span {
    color: #64748b;
    font-size: 12px;
  }

  strong {
    color: #0f172a;
    font-size: 16px;
  }

  small {
    color: #64748b;
    font-size: 12px;
  }
}

.overview-cockpit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.36fr);
  gap: 12px;
  align-items: stretch;
}

.overview-kpi-cluster {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.overview-kpi-card {
  --overview-kpi-accent: #2563eb;
  position: relative;
  display: grid;
  grid-template-rows: auto auto auto 52px auto;
  min-width: 0;
  min-height: 164px;
  align-content: start;
  gap: 7px;
  padding: 14px;
  overflow: hidden;
  border: 1px solid #dbeafe;
  border-top: 4px solid var(--overview-kpi-accent);
  border-radius: 8px;
  background: #fff;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 28px;
    line-height: 1.05;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  em {
    display: inline-flex;
    align-self: end;
    color: var(--overview-kpi-accent);
    font-size: 12px;
    font-style: normal;
    font-weight: 800;
  }
}

.overview-kpi-card__label {
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.overview-kpi-card--primary {
  --overview-kpi-accent: #2563eb;
}

.overview-kpi-card--success {
  --overview-kpi-accent: #16a34a;
}

.overview-kpi-card--warning {
  --overview-kpi-accent: #f97316;
}

.overview-kpi-card--danger {
  --overview-kpi-accent: #dc2626;
}

.overview-kpi-sparkline {
  min-height: 52px;
  background: transparent;
  pointer-events: none;
}

.overview-risk-entry {
  position: relative;
  display: grid;
  min-height: 100%;
  align-content: space-between;
  gap: 9px;
  padding: 16px;
  overflow: hidden;
  border: 1px solid #fed7aa;
  border-top: 4px solid #f97316;
  border-radius: 8px;
  background: linear-gradient(180deg, #fff7ed 0%, #fff 100%);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #fb923c;
    box-shadow: 0 12px 24px rgba(194, 65, 12, 0.12);
    transform: translateY(-1px);
  }

  > strong {
    color: #9a3412;
    font-size: 26px;
    line-height: 1.08;
  }

  > small {
    color: #64748b;
    font-size: 12px;
    line-height: 1.35;
  }

  > em {
    display: block;
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: #e7edf5;

    i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #f97316, #facc15);
    }
  }
}

.overview-risk-entry--healthy {
  border-color: #bbf7d0;
  border-top-color: #16a34a;
  background: linear-gradient(180deg, #f0fdf4 0%, #fff 100%);

  > strong {
    color: #166534;
  }

  > em i {
    background: linear-gradient(90deg, #16a34a, #22c55e);
  }
}

.overview-risk-entry--danger {
  border-color: #fecaca;
  border-top-color: #dc2626;
  background: linear-gradient(180deg, #fef2f2 0%, #fff 100%);

  > strong {
    color: #991b1b;
  }

  > em i {
    background: linear-gradient(90deg, #dc2626, #f97316);
  }
}

.overview-risk-entry--none {
  border-color: #e2e8f0;
  border-top-color: #94a3b8;
  background: #fff;

  > strong {
    color: #64748b;
  }

  > em i {
    background: #cbd5e1;
  }
}

.overview-risk-entry__eyebrow {
  color: #c2410c;
  font-size: 12px;
  font-weight: 800;
}

.overview-risk-entry__amount {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;

  span {
    color: #64748b;
    font-size: 12px;
  }

  b {
    color: #0f172a;
    font-size: 22px;
  }
}

.overview-risk-entry__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;

  span {
    display: grid;
    min-width: 0;
    gap: 2px;
    padding: 7px 8px;
    border: 1px solid rgba(251, 146, 60, 0.25);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.76);
  }

  small {
    overflow: hidden;
    color: #64748b;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  b {
    overflow: hidden;
    color: #0f172a;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.overview-focus-row {
  display: grid;
  grid-template-columns: minmax(280px, 0.36fr) minmax(440px, 0.64fr);
  gap: 12px;
}

.overview-customer-funnel,
.overview-business-share {
  display: grid;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  gap: 12px;
  padding: 14px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #fff;
}

.overview-business-share__chart {
  width: 100%;
  min-width: 0;
  min-height: 220px;
  overflow: hidden;
}

.overview-business-share__body {
  display: grid;
  grid-template-columns: minmax(180px, 0.9fr) minmax(0, 1.1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.overview-business-share__list {
  display: grid;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  max-height: 232px;
  overflow: auto;
  padding-right: 2px;
}

.overview-business-share-item {
  display: grid;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;
  gap: 6px;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    border-color: #93c5fd;
    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12);
  }

  &:disabled {
    cursor: default;
  }

  &.is-muted {
    opacity: 0.82;
  }

  em {
    display: block;
    height: 5px;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
  }

  em i {
    display: block;
    height: 100%;
    border-radius: inherit;
  }
}

.overview-business-share-item__main,
.overview-business-share-item__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.overview-business-share-item__main {
  justify-content: flex-start;

  i {
    width: 9px;
    height: 9px;
    flex: 0 0 auto;
    border-radius: 999px;
  }

  b {
    display: block;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: #0f172a;
    font-size: 13px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.overview-business-share-item__meta {
  strong {
    color: #0f172a;
    font-size: 15px;
    font-weight: 800;
  }

  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.overview-focus-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;

  strong {
    color: #0f172a;
    font-size: 15px;
  }

  span {
    color: #64748b;
    font-size: 12px;
  }
}

.overview-share-mode {
  margin-left: auto;
}

.overview-funnel-bars {
  display: grid;
  gap: 10px;
}

.overview-funnel-row {
  display: grid;
  grid-template-columns: 74px 70px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;

  span {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  em {
    display: block;
    height: 10px;
    overflow: hidden;
    border-radius: 999px;
    background: #e7edf5;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #2563eb, #16a34a);
  }
}

.overview-drill-grid {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.overview-drill-card {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  grid-template-areas:
    "icon body"
    "icon value";
  align-items: center;
  gap: 4px 10px;
  min-width: 0;
  min-height: 92px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #2563eb;
  border-radius: 8px;
  background: #fff;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }
}

.overview-drill-card--target {
  border-left-color: #0f766e;
}

.overview-drill-card--sales {
  border-left-color: #2563eb;
}

.overview-drill-card--inventory {
  border-left-color: #16a34a;
}

.overview-drill-card--customer {
  border-left-color: #0f766e;
}

.overview-drill-card--warning {
  border-left-color: #f97316;
}

.overview-drill-card--danger {
  border-left-color: #dc2626;
}

.overview-drill-card--none {
  border-left-color: #94a3b8;
}

.overview-drill-card__icon {
  display: grid;
  grid-area: icon;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
}

.overview-drill-card__body {
  display: grid;
  grid-area: body;
  min-width: 0;
  gap: 3px;

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    display: -webkit-box;
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
}

.overview-drill-card > em {
  overflow: hidden;
  grid-area: value;
  color: #0f172a;
  font-size: 16px;
  font-style: normal;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-operating-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(520px, 1.1fr);
  gap: 12px;
  align-items: stretch;
}

.overview-operating-panel,
.city-business-table-panel {
  display: grid;
  min-width: 0;
  gap: 10px;
  padding: 14px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #fff;
}

.overview-operating-panel--trend {
  border-top: 4px solid #2563eb;
}

.overview-operating-panel--city-table,
.city-business-table-panel {
  border-top: 4px solid #0f766e;
}

.city-operating-summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.city-operating-summary-card {
  display: grid;
  min-width: 0;
  gap: 4px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-top: 4px solid #94a3b8;
  border-radius: 8px;
  background: #f8fafc;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }

  span,
  small,
  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span,
  small {
    color: #64748b;
    font-size: 12px;
  }

  strong {
    color: #0f172a;
    font-size: 22px;
    line-height: 1.1;
  }
}

.city-operating-summary-card--primary {
  border-top-color: #2563eb;
}

.city-operating-summary-card--success {
  border-top-color: #16a34a;
}

.city-operating-summary-card--warning {
  border-top-color: #f97316;
}

.city-operating-summary-card--danger {
  border-top-color: #dc2626;
}

.city-operating-summary-card--neutral {
  border-top-color: #94a3b8;
}

.overview-operating-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;

  > div {
    display: grid;
    min-width: 0;
    gap: 4px;
  }

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: #0f172a;
    font-size: 15px;
  }

  span {
    color: #64748b;
    font-size: 12px;
  }
}

.overview-business-trend,
.city-business-table {
  min-width: 0;
}

.city-business-table {
  width: 100%;
}

.city-business-name {
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
}

.dashboard-formula-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;

  span {
    color: #2563eb;
    font-size: 12px;
    font-weight: 800;
  }

  small {
    padding: 3px 8px;
    border-radius: 999px;
    background: #fff;
    color: #64748b;
    font-size: 12px;
    line-height: 1.4;
  }
}

.dashboard-formula-strip--compact {
  margin-bottom: 10px;
  padding: 7px 9px;
}

.sales-command-center {
  display: grid;
  gap: 12px;
}

.sales-command-hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  align-items: stretch;
  gap: 12px;
}

.sales-command-main,
.sales-progress-card,
.sales-risk-entry,
.sales-board-panel,
.sales-board-table-panel {
  min-width: 0;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.sales-command-main {
  display: grid;
  align-content: space-between;
  gap: 14px;
  min-height: 210px;
  padding: 18px;
  border-top: 4px solid #2563eb;
  background:
    linear-gradient(180deg, #fff 0%, #f8fbff 100%),
    linear-gradient(90deg, rgba(37, 99, 235, 0.08), transparent 42%);

  > span {
    color: #2563eb;
    font-size: 13px;
    font-weight: 800;
  }

  > strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 44px;
    line-height: 1.04;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > small {
    color: #64748b;
    font-size: 13px;
    line-height: 1.5;
  }
}

.sales-command-main__chips {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 8px;

  button {
    display: grid;
    min-width: 0;
    gap: 4px;
    padding: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: inherit;
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

    &:hover {
      border-color: #93c5fd;
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
      transform: translateY(-1px);
    }
  }

  span {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: #0f172a;
    font-size: 18px;
    line-height: 1.2;
    white-space: normal;
  }
}

.sales-progress-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px;
  align-items: center;
  gap: 8px;
  padding: 14px;
  border-top: 4px solid #16a34a;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #86efac;
    box-shadow: 0 12px 24px rgba(22, 101, 52, 0.1);
    transform: translateY(-1px);
  }

  > div {
    display: grid;
    min-width: 0;
    gap: 8px;
  }

  span {
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
  }

  strong {
    color: #166534;
    font-size: 36px;
    line-height: 1.05;
  }

  small {
    color: #64748b;
    font-size: 12px;
    line-height: 1.45;
  }
}

.sales-progress-ring {
  height: 170px;
  background: transparent;
}

.sales-risk-entry {
  display: grid;
  align-content: space-between;
  gap: 10px;
  padding: 14px;
  border-top: 4px solid #f97316;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #fdba74;
    box-shadow: 0 12px 24px rgba(194, 65, 12, 0.1);
    transform: translateY(-1px);
  }

  > span {
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
  }

  > strong {
    color: #9a3412;
    font-size: 32px;
    line-height: 1.08;
  }

  > small {
    color: #64748b;
    font-size: 12px;
  }

  > em {
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: #e7edf5;

    i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #f97316, #facc15);
    }
  }

  > div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;

    b {
      color: #0f172a;
      font-size: 24px;
    }

    span {
      color: #64748b;
      font-size: 12px;
    }
  }
}

.sales-risk-entry--healthy {
  border-top-color: #16a34a;

  > strong {
    color: #166534;
  }

  > em i {
    background: linear-gradient(90deg, #16a34a, #22c55e);
  }
}

.sales-risk-entry--danger {
  border-top-color: #dc2626;

  > strong {
    color: #991b1b;
  }

  > em i {
    background: linear-gradient(90deg, #dc2626, #f97316);
  }
}

.sales-risk-entry--none {
  border-top-color: #94a3b8;

  > strong {
    color: #64748b;
  }

  > em i {
    background: #cbd5e1;
  }
}

.sales-board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  align-items: start;
  gap: 12px;
}

.sales-board-panel {
  display: grid;
  align-content: start;
  gap: 10px;
  overflow: hidden;
  padding: 14px;
}

.sales-board-panel--ranking {
  align-self: start;
}

.sales-board-panel .subsection-head {
  align-items: flex-start;
  flex-direction: column;
  gap: 4px;
}

.sales-board-panel .subsection-head small {
  white-space: normal;
}

.sales-board-panel--goal {
  grid-column: 1 / -1;
  border-top: 4px solid #0f766e;
}

.sales-timeline-card,
.sales-goal-row {
  display: grid;
  min-width: 0;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fbff;
}

.sales-timeline-card {
  border-left: 4px solid #2563eb;

  > div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
  }

  span,
  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: #0f172a;
    font-size: 24px;
    line-height: 1.05;
    white-space: nowrap;
  }
}

.sales-goal-list {
  display: grid;
  gap: 8px;
}

.sales-goal-row {
  border-left: 4px solid #16a34a;

  span,
  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 20px;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.sales-timeline-card > em,
.sales-goal-row > em {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7edf5;

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #2563eb, #16a34a);
  }
}

.sales-podium {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;

  button {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: center;
    min-width: 0;
    gap: 2px 10px;
    justify-items: start;
    min-height: 66px;
    padding: 10px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
    color: inherit;
    cursor: pointer;
    font: inherit;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

    &:hover {
      border-color: #93c5fd;
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
      transform: translateY(-1px);
    }
  }

  span {
    display: grid;
    grid-column: 1;
    grid-row: 1 / 3;
    width: 32px;
    height: 32px;
    place-items: center;
    border-radius: 999px;
    background: #dbeafe;
    color: #2563eb;
    font-weight: 800;
  }

  strong,
  small,
  em {
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    grid-column: 2;
    color: #0f172a;
    font-size: 15px;
  }

  small {
    grid-column: 2;
    color: #64748b;
    font-size: 12px;
  }

  em {
    grid-column: 3;
    grid-row: 1 / 3;
    justify-self: end;
    color: #0f172a;
    font-size: 17px;
    font-style: normal;
    font-weight: 800;
  }
}

.sales-ranking-footnote {
  width: 100%;
  padding: 10px 12px;
  border: 1px dashed #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    border-color: #60a5fa;
    background: #dbeafe;
  }
}

.sales-board-table-panel {
  padding: 14px;
}

.bi-chart--sales-monthly {
  height: 315px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr);
  align-items: start;
  gap: 12px;
}

.dashboard-grid--single {
  grid-template-columns: 1fr;
}

.panel {
  min-width: 0;
  padding: 14px;
}

.panel--wide {
  grid-column: 1 / -1;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;

  h2 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
  }

  p {
    margin: 4px 0 0;
    color: #64748b;
    font-size: 13px;
  }

  .el-icon {
    color: #2563eb;
    font-size: 22px;
  }

  .el-tag {
    flex: 0 0 auto;
  }
}

.panel-head--split {
  align-items: center;
}

.bi-chart {
  width: 100%;
  height: 240px;
  min-height: 0;
  overflow: hidden;
}

.bi-chart--trend {
  height: 260px;
}

.bi-chart--product {
  height: 360px;
}

.bi-chart--product-volume {
  height: 360px;
}

.bi-chart--pie {
  height: 220px;
}

.bi-chart--city {
  height: 240px;
}

.bi-chart--cost {
  height: 220px;
}

.bi-chart--risk {
  height: 260px;
  margin-bottom: 12px;
}

.bi-chart--inventory-risk {
  height: 150px;
  margin-bottom: 12px;
}

.bi-chart--inventory-coverage {
  height: 260px;
  margin-bottom: 12px;
}

.bi-chart--target-heatmap,
.bi-chart--inventory-flow,
.bi-chart--ranking,
.bi-chart--risk-ranking {
  height: 300px;
}

.bi-chart--target-heatmap,
.bi-chart--inventory-flow {
  margin-bottom: 12px;
}

.product-sales-bars {
  min-width: 0;
}

.trend-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

:deep(.trend-card) {
  display: grid;
  min-height: 340px;
  align-content: start;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fbfdff;
}

:deep(.trend-card__header) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  > div {
    display: grid;
    min-width: 0;
    gap: 4px;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 18px;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    flex: 0 0 auto;
    color: #64748b;
    font-size: 12px;
  }
}

:deep(.trend-card__title) {
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

:deep(.trend-card__sparkline) {
  height: 66px;
  overflow: hidden;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(37, 99, 235, 0.08), rgba(255, 255, 255, 0)),
    repeating-linear-gradient(to top, rgba(148, 163, 184, 0.2) 0, rgba(148, 163, 184, 0.2) 1px, transparent 1px, transparent 21px);

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
}

:deep(.trend-card__area) {
  fill: rgba(37, 99, 235, 0.12);
}

:deep(.trend-card__line) {
  fill: none;
  stroke: #2563eb;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.6;
  vector-effect: non-scaling-stroke;
}

:deep(.trend-card:nth-child(2) .trend-card__area) {
  fill: rgba(22, 163, 74, 0.12);
}

:deep(.trend-card:nth-child(2) .trend-card__line) {
  stroke: #16a34a;
}

:deep(.trend-bars) {
  display: grid;
  gap: 8px;
}

:deep(.trend-row) {
  display: grid;
  grid-template-columns: 48px minmax(86px, 1fr) minmax(92px, auto) minmax(78px, auto);
  align-items: center;
  gap: 10px;
  color: #64748b;
  font-size: 12px;
}

:deep(.trend-row__bar) {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7edf5;

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #2563eb, #16a34a);
  }
}

:deep(.trend-row strong),
:deep(.ranking-row strong) {
  color: #0f172a;
}

.city-cost-panel {
  border-top: 4px solid #7c3aed;
}

.product-sales-panel {
  border-top: 4px solid #2563eb;
}

.target-completion-panel {
  border-top: 4px solid #0f766e;
}

.inventory-operation-panel {
  border-top: 4px solid #16a34a;
}

.activity-panel {
  border-top: 4px solid #f97316;
}

.payment-risk-panel {
  border-top: 4px solid #f97316;
}

.gross-profit-summary-strip,
.product-sales-summary-strip,
.payment-risk-summary-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 12px;

  div {
    display: grid;
    min-width: 0;
    gap: 5px;
    padding: 10px 12px;
    border-radius: 8px;
    background: #f8fafc;
  }

  span {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 18px;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.gross-profit-summary-strip {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.gross-profit-summary-strip div {
  background: #f0fdfa;
}

.gross-profit-summary-strip span {
  color: #0f766e;
}

.payment-risk-summary-strip div {
  background: #fff7ed;
}

.payment-risk-summary-strip span {
  color: #9a3412;
}

.payment-risk-summary-strip {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.payment-risk-summary-strip--healthy div {
  background: #f0fdf4;
}

.payment-risk-summary-strip--healthy span {
  color: #15803d;
}

.payment-risk-summary-strip--warning div {
  background: #fff7ed;
}

.payment-risk-summary-strip--warning span {
  color: #9a3412;
}

.payment-risk-summary-strip--danger div {
  background: #fef2f2;
}

.payment-risk-summary-strip--danger span {
  color: #b91c1c;
}

.payment-risk-summary-strip--none div {
  background: #f8fafc;
}

.payment-risk-summary-strip--none span {
  color: #64748b;
}

.payment-risk-control-grid {
  display: grid;
  grid-template-columns: minmax(360px, 0.74fr) minmax(0, 1.26fr);
  gap: 12px;
  margin-bottom: 12px;
}

.payment-risk-level-panel {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.payment-risk-city-groups {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.payment-risk-city-group-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.payment-risk-city-group {
  --risk-group-color: #16a34a;
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-top: 4px solid var(--risk-group-color);
  border-radius: 8px;
  background: #f8fafc;
}

.payment-risk-city-group--warning {
  --risk-group-color: #f97316;
  background: #fff7ed;
}

.payment-risk-city-group--danger {
  --risk-group-color: #dc2626;
  background: #fef2f2;
}

.payment-risk-city-group__head {
  display: grid;
  min-width: 0;
  gap: 4px;

  span,
  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: var(--risk-group-color);
    font-size: 13px;
    font-weight: 800;
  }

  strong {
    color: #0f172a;
    font-size: 20px;
    line-height: 1.1;
  }

  small {
    color: #64748b;
    font-size: 12px;
  }
}

.payment-risk-city-list {
  display: grid;
  gap: 7px;
  max-height: 300px;
  overflow: auto;
  padding-right: 2px;
}

.payment-risk-city-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  gap: 4px 8px;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }

  span,
  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: #0f172a;
    font-size: 13px;
    font-weight: 800;
  }

  strong {
    color: var(--risk-group-color);
    font-size: 13px;
    text-align: right;
  }

  small {
    grid-column: 1 / -1;
    color: #64748b;
    font-size: 12px;
  }

  em {
    grid-column: 1 / -1;
    display: block;
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--risk-group-color);
  }
}

.payment-risk-level-list {
  display: grid;
  gap: 8px;
}

.payment-risk-level-row {
  --risk-level-color: #16a34a;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) minmax(120px, auto);
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-left: 4px solid var(--risk-level-color);
  border-radius: 8px;
  background: #f8fafc;

  span,
  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: var(--risk-level-color);
    font-weight: 800;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  em {
    grid-column: 1 / -1;
    overflow: hidden;
    height: 7px;
    border-radius: 999px;
    background: #e7edf5;

    i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--risk-level-color);
    }
  }
}

.payment-risk-level-row--warning {
  --risk-level-color: #f97316;
  background: #fff7ed;
}

.payment-risk-level-row--danger {
  --risk-level-color: #dc2626;
  background: #fef2f2;
}

.bi-chart--payment-risk-level {
  height: 220px;
}

.inventory-operation-summary,
.activity-kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 12px;

  div,
  button {
    display: grid;
    min-width: 0;
    gap: 5px;
    padding: 12px;
    border: 0;
    border-radius: 8px;
    background: #f8fafc;
    color: inherit;
    font: inherit;
    text-align: left;
  }

  span {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  em {
    color: #2563eb;
    font-size: 12px;
    font-style: normal;
    font-weight: 700;
  }
}

.inventory-operation-summary .inventory-operation-summary-card {
  background: #f0fdf4;
}

.inventory-operation-summary button.inventory-operation-summary-card {
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.inventory-operation-summary button.inventory-operation-summary-card:hover {
  background: #e8f8ef;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.inventory-operation-summary span {
  color: #15803d;
}

.inventory-detail-head {
  display: grid;
  min-width: 0;
  gap: 4px;

  span {
    color: #0f172a;
    font-size: 16px;
    font-weight: 700;
  }

  strong {
    color: #15803d;
    font-size: 22px;
    line-height: 1.1;
  }

  small {
    color: #64748b;
    font-size: 12px;
  }
}

.inventory-detail-drawer :deep(.el-drawer__body) {
  padding-top: 0;
}

.inventory-detail-table {
  width: 100%;
}

.inventory-operation-board {
  display: grid;
  gap: 10px;
}

.inventory-operation-row {
  display: grid;
  width: 100%;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.inventory-operation-row:hover {
  border-color: #93c5fd;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.inventory-operation-row__head,
.inventory-operation-row__metrics,
.inventory-operation-row__track {
  display: flex;
  align-items: center;
  min-width: 0;
}

.inventory-operation-row__head {
  justify-content: space-between;
  gap: 12px;

  div {
    display: flex;
    align-items: baseline;
    min-width: 0;
    gap: 8px;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 15px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    flex: 0 0 auto;
    color: #64748b;
    font-size: 12px;
  }
}

.inventory-operation-row__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;

  span {
    display: grid;
    min-width: 0;
    gap: 3px;
    padding: 8px 10px;
    border-radius: 6px;
    background: #f8fafc;
  }

  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 16px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.inventory-operation-row__track {
  gap: 10px;

  span {
    flex: 0 0 120px;
    color: #64748b;
    font-size: 12px;
  }

  div {
    overflow: hidden;
    flex: 1;
    height: 8px;
    border-radius: 999px;
    background: #e2e8f0;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #2563eb, #16a34a);
  }
}

.customer-command-center {
  display: grid;
  gap: 12px;
}

.customer-command-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 0.36fr);
  gap: 12px;
  align-items: stretch;
}

.customer-command-main,
.customer-risk-summary-card,
.customer-command-panel,
.customer-follow-table-panel {
  min-width: 0;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.customer-command-main {
  display: grid;
  align-content: space-between;
  gap: 14px;
  min-height: 220px;
  padding: 18px;
  border-top: 4px solid #0f766e;
  background:
    linear-gradient(180deg, #fff 0%, #f8fbff 100%),
    linear-gradient(90deg, rgba(15, 118, 110, 0.08), transparent 46%);

  > span {
    color: #0f766e;
    font-size: 13px;
    font-weight: 800;
  }

  > strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 46px;
    line-height: 1.05;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > small {
    color: #64748b;
    font-size: 13px;
    line-height: 1.5;
  }
}

.customer-command-main__chips {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;

  button {
    display: grid;
    min-width: 0;
    gap: 3px;
    padding: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: inherit;
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  }

  button:hover {
    border-color: #93c5fd;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }

  span,
  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 18px;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.customer-risk-summary-card {
  display: grid;
  align-content: center;
  gap: 8px;
  padding: 18px;
  border: 1px solid #fed7aa;
  border-top: 4px solid #f97316;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  span {
    color: #9a3412;
    font-size: 13px;
    font-weight: 800;
  }

  strong {
    color: #0f172a;
    font-size: 42px;
    line-height: 1;
  }

  small {
    color: #64748b;
    font-size: 12px;
  }

  em {
    display: block;
    overflow: hidden;
    height: 8px;
    border-radius: 999px;
    background: #e2e8f0;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #16a34a, #f97316, #dc2626);
  }

  b {
    color: #c2410c;
    font-size: 20px;
  }

  &:hover {
    border-color: #fb923c;
    box-shadow: 0 10px 24px rgba(249, 115, 22, 0.16);
    transform: translateY(-1px);
  }
}

.customer-risk-summary-card--success {
  border-color: #bbf7d0;
  border-top-color: #16a34a;

  span,
  b {
    color: #15803d;
  }
}

.customer-risk-summary-card--danger {
  border-color: #fecaca;
  border-top-color: #dc2626;

  span,
  b {
    color: #b91c1c;
  }
}

.customer-command-panel__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: #0f172a;
    font-size: 15px;
    font-weight: 800;
  }

  span {
    color: #64748b;
    font-size: 12px;
  }
}

.customer-command-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.42fr) minmax(0, 0.58fr);
  align-items: stretch;
  gap: 12px;
}

.customer-command-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px;
}

.customer-command-panel--segment {
  border-top: 4px solid #0f766e;
}

.customer-command-panel--activity {
  border-top: 4px solid #2563eb;
}

.customer-command-panel--risk {
  grid-column: 1 / -1;
  border-top: 4px solid #f97316;
}

.customer-value-matrix {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.customer-value-cell {
  display: grid;
  min-width: 0;
  gap: 6px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #94a3b8;
  border-radius: 8px;
  background: #f8fafc;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }

  span,
  small,
  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span,
  small {
    color: #64748b;
    font-size: 12px;
  }

  strong {
    color: #0f172a;
    font-size: 24px;
    line-height: 1.1;
  }

  em {
    display: block;
    height: 7px;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #94a3b8;
  }
}

.customer-value-cell--primary {
  border-left-color: #2563eb;

  i {
    background: #2563eb;
  }
}

.customer-value-cell--success {
  border-left-color: #16a34a;

  i {
    background: #16a34a;
  }
}

.customer-value-cell--warning {
  border-left-color: #f97316;

  i {
    background: #f97316;
  }
}

.customer-value-cell--danger {
  border-left-color: #dc2626;

  i {
    background: #dc2626;
  }
}

.customer-value-cell--neutral {
  border-left-color: #94a3b8;

  i {
    background: #94a3b8;
  }
}

.customer-risk-buckets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.customer-risk-bucket {
  display: grid;
  min-width: 0;
  gap: 4px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;

  span,
  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: #0f172a;
    font-size: 18px;
  }
}

.customer-risk-bucket--danger {
  background: #fef2f2;
}

.customer-risk-bucket--warning {
  background: #fff7ed;
}

.customer-risk-bucket--success {
  background: #f0fdf4;
}

.customer-priority-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 8px;
}

.customer-priority-row {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr) 76px 82px;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  strong,
  small,
  em,
  b {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: #0f172a;
    font-size: 13px;
    font-weight: 800;
  }

  small {
    color: #64748b;
    font-size: 12px;
  }

  em {
    color: #64748b;
    font-size: 12px;
    font-style: normal;
    text-align: right;
  }

  b {
    color: #0f172a;
    font-size: 13px;
    text-align: right;
  }

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }
}

.customer-priority-row__risk {
  display: inline-flex;
  justify-content: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.customer-priority-row__risk--danger {
  background: #fee2e2;
  color: #b91c1c;
}

.customer-priority-row__risk--warning {
  background: #ffedd5;
  color: #c2410c;
}

.customer-priority-row__risk--success {
  background: #dcfce7;
  color: #15803d;
}

.customer-filter-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: -2px 0 10px;
  padding: 8px 10px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;

  span {
    overflow: hidden;
    color: #1d4ed8;
    font-size: 13px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.customer-follow-table-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-top: 4px solid #2563eb;
}

.customer-follow-table {
  width: 100%;

  :deep(.el-table__row) {
    cursor: pointer;
  }
}

.customer-table-customer {
  display: grid;
  min-width: 0;
  gap: 2px;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: #0f172a;
    font-weight: 700;
  }

  span {
    color: #64748b;
    font-size: 12px;
  }
}

.customer-score-cell {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 8px;

  span {
    color: #0f172a;
    font-weight: 700;
  }

  em {
    overflow: hidden;
    height: 7px;
    border-radius: 999px;
    background: #e2e8f0;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #2563eb, #16a34a);
  }
}

.activity-kpi-strip div {
  background: #fff7ed;
}

.activity-kpi-strip span {
  color: #9a3412;
}

.target-completion-list {
  display: grid;
  gap: 10px;
}

.target-completion-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.7fr) repeat(4, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fbfdff;
  cursor: pointer;
  font: inherit;
  text-align: left;

  &:hover .target-completion-row__city strong {
    color: #2563eb;
  }
}

.target-completion-row__city,
.target-metric {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.target-completion-row__city {
  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: #64748b;
    font-size: 12px;
  }
}

.target-metric {
  span {
    color: #64748b;
    font-size: 12px;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: #64748b;
    font-size: 11px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  em {
    display: block;
    height: 5px;
    overflow: hidden;
    border-radius: 999px;
    background: #e7edf5;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #2563eb, #16a34a);
  }
}

.activity-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1.2fr) minmax(260px, 0.8fr);
  gap: 12px;
  align-items: stretch;
  margin-bottom: 12px;
}

.activity-card-list {
  display: grid;
  align-content: start;
  gap: 10px;
}

.activity-card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fbfdff;

  > div:first-child {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  strong {
    color: #0f172a;
    font-size: 14px;
  }

  span,
  small {
    color: #64748b;
    font-size: 12px;
  }
}

.activity-card__numbers {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.activity-ranking-table,
.inventory-operation-table {
  width: 100%;
}

.inventory-replenishment {
  display: grid;
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #e2e8f0;
}

.inventory-replenishment-table {
  width: 100%;
}

.analysis-insight-strip {
  display: grid;
  grid-template-columns: 1.3fr 0.8fr 0.8fr;
  gap: 10px;
  margin-bottom: 12px;

  div {
    display: grid;
    min-width: 0;
    gap: 5px;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
  }

  span,
  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 18px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.gross-profit-coverage-warning {
  margin-bottom: 12px;
  border-radius: 8px;
}

.product-sales-summary-strip {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-bottom: 12px;

  div {
    background: #eff6ff;
  }

  span {
    color: #1d4ed8;
  }
}

.product-sales-summary-strip--compact {
  grid-template-columns: repeat(6, minmax(0, 1fr));

  div {
    min-height: 92px;
    border: 1px solid #dbeafe;
    background: linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%);
  }
}

.product-dimension-overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.product-dimension-panel {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 8px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-top: 4px solid #2563eb;
  border-radius: 8px;
  background: #fff;
}

.product-dimension-panel--brand {
  border-top-color: #7c3aed;
}

.product-dimension-panel__head {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 15px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button {
    flex: 0 0 auto;
    padding: 0;
    border: 0;
    background: transparent;
    color: #2563eb;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-weight: 800;
  }
}

.product-dimension-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  gap: 4px 10px;
  padding: 9px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fbff;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.1);
    transform: translateY(-1px);
  }

  span,
  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: #0f172a;
    font-size: 13px;
    font-weight: 800;
  }

  strong {
    color: #2563eb;
    font-size: 14px;
    text-align: right;
  }

  small {
    grid-column: 1 / -1;
    color: #64748b;
    font-size: 12px;
  }

  em {
    grid-column: 1 / -1;
    display: block;
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #2563eb, #16a34a);
  }
}

.product-activation-panel {
  display: grid;
  grid-template-columns: minmax(180px, 230px) minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #fff;
}

.product-activation-panel__summary {
  display: grid;
  align-content: center;
  gap: 6px;
  padding: 12px;
  border-radius: 8px;
  background: #f0fdf4;

  span {
    color: #15803d;
    font-size: 12px;
    font-weight: 700;
  }

  strong {
    color: #0f172a;
    font-size: 28px;
    line-height: 1.1;
  }

  small {
    color: #64748b;
    font-size: 12px;
  }
}

.product-sales-coverage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -2px 0 12px;
  color: #64748b;
}

.product-sales-coverage-note {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 13px;
  line-height: 1.6;
}

.product-sales-coverage-note > span:first-child {
  margin-right: 4px;
}

.product-sales-coverage-separator {
  color: #94a3b8;
}

.product-sales-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.product-sales-layout--overview {
  gap: 8px;
}

.product-sales-bars {
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
}

.product-chart-grid {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}

.product-chart-grid--split {
  grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.92fr);
}

.product-chart-tile {
  min-width: 0;
  padding: 12px 12px 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.product-sales-panel .supply-scroll-table {
  width: 100%;
}

.product-sales-table {
  :deep(.el-table__cell) {
    padding: 7px 0;
  }

  :deep(.cell) {
    min-height: 22px;
    line-height: 22px;
  }

  :deep(th.el-table__cell) {
    padding: 8px 0;
    background: #f8fafc;
  }

  :deep(.el-table__row) {
    height: 52px;
  }
}

.product-sales-table--overview {
  :deep(.el-table__cell) {
    padding: 6px 0;
  }

  :deep(.cell) {
    min-height: 20px;
    line-height: 20px;
  }

  :deep(.el-table__row) {
    height: 44px;
  }
}

.product-table-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  white-space: nowrap;

  :deep(.el-button) {
    height: 24px;
    margin-left: 0;
    padding: 0;
    font-weight: 600;
  }
}

.product-sales-layout--report {
  grid-template-columns: 1fr;
}

.product-sales-footer,
.ranking-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.city-cost-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;

  div {
    display: grid;
    gap: 6px;
    padding: 12px;
    border-radius: 8px;
    background: #f8fafc;
  }

  span {
    color: #64748b;
    font-size: 12px;
  }

  strong {
    color: #0f172a;
    font-size: 20px;
  }
}

.trend-block {
  margin-bottom: 12px;
}

.city-cost-table {
  width: 100%;
}

.city-cost-empty,
.source-empty-note {
  display: grid;
  min-height: 120px;
  place-items: center;
  gap: 8px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
  text-align: center;
}

.city-cost-empty {
  min-height: 180px;
  padding: 24px;

  strong {
    color: #0f172a;
    font-size: 16px;
  }

  p {
    max-width: 520px;
    margin: 0;
    color: #64748b;
    line-height: 1.6;
  }
}

.is-over-budget {
  color: #dc2626;
  font-weight: 700;
}

.is-negative {
  color: #dc2626;
  font-weight: 700;
}

.rate-cell {
  display: grid;
  grid-template-columns: minmax(80px, 1fr) 52px;
  align-items: center;
  gap: 8px;

  strong {
    text-align: right;
  }
}

.city-ranking-dashboard {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.city-ranking-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;

  div {
    display: grid;
    gap: 4px;
    min-width: 0;
    padding: 10px 12px;
    border-radius: 8px;
    background: #f8fafc;
  }

  span {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 18px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.city-opportunity-visual {
  min-width: 0;
  margin-top: 12px;
  padding: 12px 12px 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.ranking-list {
  display: grid;
  gap: 0;
}

.ranking-row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) minmax(112px, auto);
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 6px 0;
  border: 0;
  border-bottom: 1px solid #f1f5f9;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;

  &:hover .ranking-row__main strong {
    color: #2563eb;
  }
}

.ranking-row__index {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: #eef4ff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
}

.ranking-row__index--first {
  background: #dbeafe;
  color: #1d4ed8;
}

.ranking-row__index--second {
  background: #dcfce7;
  color: #15803d;
}

.ranking-row__index--third {
  background: #ffedd5;
  color: #c2410c;
}

.ranking-row__main,
.ranking-row__amount {
  display: grid;
  gap: 3px;
}

.ranking-row__main {
  min-width: 0;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ranking-row__meter {
  display: block;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7edf5;

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #2563eb, #16a34a);
  }
}

.ranking-row__meter--risk i {
  background: linear-gradient(90deg, #f97316, #dc2626);
}

.ranking-row__meter--paid i {
  background: linear-gradient(90deg, #16a34a, #0f766e);
}

.ranking-row__main small,
.ranking-row__amount small {
  color: #64748b;
  font-size: 12px;
}

.ranking-row__amount {
  text-align: right;

  strong {
    font-size: 15px;
    white-space: nowrap;
  }

  small {
    white-space: nowrap;
  }

  :deep(.el-tag) {
    justify-self: end;
  }
}

.sales-ranking-table {
  width: 100%;

  :deep(.el-table__row) {
    cursor: pointer;
  }

  :deep(.el-table__cell) {
    padding: 8px 0;
  }
}

.sales-person-cell {
  display: grid;
  min-width: 0;
  gap: 2px;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: #0f172a;
    font-size: 13px;
  }

  small {
    color: #64748b;
    font-size: 12px;
  }
}

.target-rate-cell {
  display: grid;
  min-width: 0;
  gap: 5px;

  strong {
    color: #0f172a;
    font-size: 13px;
    white-space: nowrap;
  }

  em {
    display: block;
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: #e7edf5;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #2563eb;
  }
}

.target-rate-cell--success i {
  background: #16a34a;
}

.target-rate-cell--warning i {
  background: #f97316;
}

.target-rate-cell--danger i {
  background: #dc2626;
}

.target-rate-cell--empty i {
  background: #cbd5e1;
}

.ranking-visual-grid,
.risk-visual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.ranking-visual,
.risk-visual {
  min-width: 0;
  padding: 10px 12px 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.payment-aging-visual {
  min-width: 0;
  margin-bottom: 12px;
  padding: 12px 12px 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.dual-ranking-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  .ranking-footer {
    grid-column: 1 / -1;
  }
}

.ranking-block {
  min-width: 0;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fbfdff;
}

.subsection-head {
  display: flex;
  min-width: 0;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;

  > * {
    min-width: 0;
  }

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    max-width: 100%;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.overview-risk-action {
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
}

.risk-summary-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;

  div {
    display: grid;
    gap: 6px;
    padding: 12px;
    border-radius: 8px;
    background: #fff7ed;
  }

  span {
    color: #9a3412;
    font-size: 12px;
  }

  strong {
    color: #0f172a;
    font-size: 20px;
  }
}

:deep(.empty-inline) {
  display: grid;
  min-height: 120px;
  place-items: center;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #94a3b8;
}

:deep(.empty-inline--compact) {
  min-height: 72px;
}

.supply-bi-page {
  --bi-panel: var(--supply-surface, #fff);
  --bi-panel-strong: #fff;
  --bi-panel-soft: var(--supply-surface-subtle, #f8fafc);
  --bi-border: var(--supply-border, #e2e8f0);
  --bi-border-soft: #dbeafe;
  --bi-text: var(--supply-text, #172033);
  --bi-label: #0f172a;
  --bi-muted: var(--supply-text-muted, #64748b);
  --bi-primary: var(--supply-primary, #2563eb);
  --bi-success: #16a34a;
  --bi-warning: #f97316;
  --bi-danger: #dc2626;
  --bi-profit: #0f766e;
  --bi-cost: #7c3aed;
  --tile-accent: var(--bi-primary);
  min-height: calc(100vh - 112px);
  padding: 0 0 16px;
  background: linear-gradient(180deg, #f8fbff 0%, var(--supply-page-background, #f6f8fb) 320px);
  color: var(--bi-text);
}

.filter-panel,
.panel,
.role-snapshot,
.overview-command-center,
.product-inventory-mode-bar {
  border-color: var(--bi-border);
  background: var(--bi-panel);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
}

.filter-panel {
  border-top: 3px solid #bfdbfe;
  padding: 12px 14px 4px;
  background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
}

.bi-filter-head {
  border-bottom-color: var(--bi-border);
}

.bi-filter-title strong,
.product-inventory-mode-bar strong,
.panel-head h2,
.overview-command-headline strong,
.subsection-head strong {
  color: var(--bi-label);
}

.bi-filter-title span,
.bi-filter-meta,
.quick-period-bar > span,
.product-inventory-mode-bar span,
.panel-head p,
.overview-command-headline small,
.subsection-head small,
.product-sales-coverage-row,
.ranking-row__main small,
.ranking-row__amount small,
.target-completion-row__city span,
.target-metric span,
.activity-card span,
.activity-card small,
.inventory-operation-row__head small,
.inventory-operation-row__track span {
  color: var(--bi-muted);
}

.overview-command-headline span,
.panel-head .el-icon,
.inventory-operation-summary em {
  color: var(--bi-primary);
}

.supply-bi-page :deep(.el-input__wrapper),
.supply-bi-page :deep(.el-select__wrapper),
.supply-bi-page :deep(.el-date-editor.el-input__wrapper) {
  background: #fff;
  box-shadow: 0 0 0 1px var(--supply-border-strong, #cbd5e1) inset;
}

.supply-bi-page :deep(.el-input__wrapper.is-focus),
.supply-bi-page :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--bi-primary) inset, 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.supply-bi-page :deep(.el-input__inner),
.supply-bi-page :deep(.el-select__placeholder),
.supply-bi-page :deep(.el-range-input) {
  color: var(--bi-text);
}

.supply-bi-page :deep(.el-input__inner::placeholder),
.supply-bi-page :deep(.el-range-input::placeholder),
.supply-bi-page :deep(.el-select__placeholder.is-transparent) {
  color: #94a3b8;
}

.supply-bi-page :deep(.el-form-item__label),
.supply-bi-page :deep(.el-range-separator),
.supply-bi-page :deep(.el-select__caret),
.supply-bi-page :deep(.el-date-editor .el-range__icon) {
  color: var(--bi-muted);
}

.quick-period-bar :deep(.el-radio-button__inner),
.overview-share-mode :deep(.el-radio-button__inner),
.product-inventory-mode-bar :deep(.el-radio-button__inner) {
  border-color: #cbd5e1;
  background: #fff;
  color: var(--bi-muted);
}

.quick-period-bar :deep(.el-radio-button.is-active .el-radio-button__inner),
.overview-share-mode :deep(.el-radio-button.is-active .el-radio-button__inner),
.product-inventory-mode-bar :deep(.el-radio-button.is-active .el-radio-button__inner) {
  border-color: var(--bi-primary);
  background: var(--supply-primary-soft, #eff6ff);
  box-shadow: -1px 0 0 0 var(--bi-primary);
  color: var(--bi-primary);
}

.bi-refresh-button {
  border-color: #bfdbfe;
  background: var(--supply-primary-soft, #eff6ff);
  color: var(--bi-primary);
}

.overview-command-center {
  position: relative;
  gap: 12px;
  overflow: hidden;
  border-top: 3px solid #93c5fd;
  background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
}

.overview-command-center::before {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(37, 99, 235, 0.04);
  pointer-events: none;
  content: '';
}

.overview-kpi-cluster {
  gap: 12px;
}

.role-snapshot {
  display: grid;
  grid-template-columns: minmax(280px, 0.42fr) minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
  padding: 14px;
  border: 1px solid var(--bi-border);
  border-top: 4px solid var(--bi-primary);
  border-radius: 8px;
  background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
}

.role-snapshot__main {
  display: grid;
  min-width: 0;
  align-content: space-between;
  gap: 10px;
  padding: 16px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.08), transparent 58%),
    #fff;

  > span {
    color: var(--bi-primary);
    font-size: 13px;
    font-weight: 800;
  }

  > strong {
    overflow: hidden;
    color: var(--bi-label);
    font-size: 42px;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > small {
    color: var(--bi-muted);
    font-size: 13px;
    line-height: 1.55;
  }
}

.role-snapshot__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    background: #eff6ff;
    color: var(--bi-primary);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-weight: 800;
  }

  button:hover {
    border-color: var(--bi-primary);
    background: #dbeafe;
  }
}

.role-snapshot__formula {
  background: #fff !important;
}

.role-snapshot-formula {
  display: grid;
  gap: 8px;

  strong {
    color: #0f172a;
    font-size: 14px;
  }

  span {
    color: #475569;
    font-size: 13px;
    line-height: 1.45;
  }
}

.role-snapshot__cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.role-snapshot-card {
  --snapshot-accent: var(--bi-primary);
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 8px;
  min-height: 132px;
  padding: 14px;
  border: 1px solid #dbeafe;
  border-top: 4px solid var(--snapshot-accent);
  border-radius: 8px;
  background: #fff;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }

  span,
  small {
    overflow: hidden;
    color: var(--bi-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 13px;
    font-weight: 700;
  }

  strong {
    overflow: hidden;
    color: var(--bi-label);
    font-size: 24px;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    font-size: 12px;
  }

  em {
    display: block;
    height: 7px;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--snapshot-accent);
  }
}

.role-snapshot-card--success {
  --snapshot-accent: var(--bi-success);
}

.role-snapshot-card--warning {
  --snapshot-accent: var(--bi-warning);
}

.role-snapshot-card--danger {
  --snapshot-accent: var(--bi-danger);
}

.role-snapshot-card--neutral {
  --snapshot-accent: #94a3b8;
}

.role-snapshot--payment-risk {
  border-top-color: var(--bi-warning);
}

.role-snapshot--city-cost {
  border-top-color: var(--bi-cost);
}

.role-snapshot--inventory-risk,
.role-snapshot--product-inventory {
  border-top-color: var(--bi-success);
}

.city-target-mini {
  display: grid;
  min-width: 0;
  gap: 5px;

  strong {
    overflow: hidden;
    color: var(--bi-label);
    font-size: 13px;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  em {
    display: block;
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: #e2e8f0;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--bi-success);
  }
}

.city-target-mini.target-rate-cell--warning i {
  background: var(--bi-warning);
}

.city-target-mini.target-rate-cell--danger i {
  background: var(--bi-danger);
}

.city-target-mini.target-rate-cell--empty i {
  background: #cbd5e1;
}

.product-health-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 10px 0 12px;

  button {
    display: grid;
    min-width: 0;
    gap: 6px;
    padding: 12px 14px;
    border: 1px solid #bbf7d0;
    border-left: 4px solid var(--bi-success);
    border-radius: 8px;
    background: #f0fdf4;
    color: inherit;
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

    &:hover {
      border-color: #86efac;
      box-shadow: 0 10px 22px rgba(22, 163, 74, 0.12);
      transform: translateY(-1px);
    }
  }

  span,
  small {
    overflow: hidden;
    color: var(--bi-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 13px;
    font-weight: 800;
  }

  strong {
    overflow: hidden;
    color: #166534;
    font-size: 22px;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    font-size: 12px;
  }
}

.overview-kpi-card::after {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 42%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--overview-kpi-accent));
  opacity: 0.18;
  content: '';
}

.overview-kpi-card small,
.overview-kpi-card__label,
.inventory-operation-summary span,
.inventory-operation-summary small,
.gross-profit-summary-strip span,
.product-sales-summary-strip span,
.product-sales-summary-strip small,
.payment-risk-summary-strip span,
.city-cost-summary span,
.analysis-insight-strip span,
.analysis-insight-strip small,
.risk-summary-strip span {
  color: var(--bi-muted);
}

.overview-kpi-card strong,
.inventory-operation-summary strong,
.gross-profit-summary-strip strong,
.product-sales-summary-strip strong,
.payment-risk-summary-strip strong,
.city-cost-summary strong,
.analysis-insight-strip strong,
.risk-summary-strip strong,
.target-completion-row__city strong,
.target-metric strong,
.activity-card strong,
.inventory-operation-row__head strong,
.inventory-operation-row__metrics strong,
.ranking-row__main strong,
.ranking-row__amount strong {
  color: var(--bi-label);
}

.panel {
  border-top: 4px solid #bfdbfe;
}

.city-cost-panel {
  border-top-color: var(--bi-cost);
}

.product-sales-panel,
.panel--trend {
  border-top-color: var(--bi-primary);
}

.panel--city-ranking {
  border-top-color: var(--bi-primary);
}

.target-completion-panel {
  border-top-color: var(--bi-profit);
}

.inventory-operation-panel {
  border-top-color: var(--bi-success);
}

.activity-panel,
.payment-risk-panel {
  border-top-color: var(--bi-warning);
}

.bi-chart {
  border-radius: 8px;
  background: #fbfdff;
}

.gross-profit-summary-strip div,
.product-sales-summary-strip div,
.payment-risk-summary-strip div,
.inventory-operation-summary div,
.inventory-operation-summary button,
.activity-kpi-strip div,
.city-cost-summary div,
.analysis-insight-strip div,
.risk-summary-strip div,
.city-ranking-stats div,
.target-completion-row,
.activity-card,
.inventory-operation-row,
.ranking-visual,
.risk-visual,
.product-activation-panel,
.product-chart-tile,
.city-opportunity-visual,
.payment-aging-visual,
.ranking-block,
.customer-command-main,
.customer-risk-summary-card,
.customer-command-panel,
.customer-follow-table-panel,
.customer-risk-bucket,
:deep(.trend-card) {
  border: 1px solid var(--bi-border);
  background: #fff;
  box-shadow: none;
}

.gross-profit-summary-strip div {
  background: #f0fdfa;
}

.product-sales-summary-strip div {
  background: var(--supply-primary-soft, #eff6ff);
}

.payment-risk-summary-strip--healthy div {
  background: #f0fdf4;
}

.payment-risk-summary-strip--warning div,
.payment-risk-summary-strip--danger div {
  background: #fff7ed;
}

.payment-risk-summary-strip--danger div {
  border-color: #fecaca;
}

.inventory-operation-summary .inventory-operation-summary-card,
.activity-kpi-strip div {
  background: #f0fdf4;
}

.inventory-operation-summary button.inventory-operation-summary-card:hover,
.inventory-operation-row:hover {
  border-color: #93c5fd;
  background: #f8fbff;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
}

.inventory-operation-row__metrics span {
  background: var(--bi-panel-soft);
}

.inventory-operation-row__track div,
.ranking-row__meter,
.target-metric em,
:deep(.trend-row__bar) {
  background: #e7edf5;
}

.ranking-row__meter i,
.target-metric i,
.inventory-operation-row__track i,
:deep(.trend-row__bar i) {
  box-shadow: none;
}

.ranking-row {
  border-bottom-color: #f1f5f9;
}

.ranking-row:hover .ranking-row__main strong,
.target-completion-row:hover .target-completion-row__city strong {
  color: var(--bi-primary);
}

.ranking-row__index {
  background: rgba(37, 99, 235, 0.12);
  color: var(--bi-primary);
}

.ranking-row__index--first {
  background: rgba(37, 99, 235, 0.18);
}

.ranking-row__index--second {
  background: rgba(34, 197, 94, 0.2);
  color: var(--bi-success);
}

.ranking-row__index--third {
  background: rgba(245, 158, 11, 0.2);
  color: var(--bi-warning);
}

.is-over-budget,
.is-negative {
  color: var(--bi-danger);
}

.product-sales-bars {
  border-bottom-color: var(--bi-border-soft);
}

.overview-operating-panel,
.city-business-table-panel,
.payment-risk-level-panel,
.sales-timeline-card,
.sales-goal-row {
  border-color: var(--bi-border);
  background: #fff;
}

.source-empty-note,
.city-cost-empty,
:deep(.empty-inline) {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: var(--bi-muted);
}

.city-cost-empty strong {
  color: var(--bi-label);
}

.city-cost-empty p {
  color: var(--bi-muted);
}

.supply-bi-page :deep(.el-table) {
  --el-table-bg-color: #fff;
  --el-table-tr-bg-color: #fff;
  --el-table-header-bg-color: #f8fafc;
  --el-table-row-hover-bg-color: #eff6ff;
  --el-table-text-color: var(--bi-text);
  --el-table-header-text-color: var(--bi-label);
  --el-table-border-color: var(--bi-border);
  border-radius: 8px;
  background: #fff;
  color: var(--bi-text);
}

.supply-bi-page :deep(.el-table th.el-table__cell) {
  background: #f8fafc;
  color: var(--bi-label);
}

.supply-bi-page :deep(.el-table tr),
.supply-bi-page :deep(.el-table td.el-table__cell) {
  background: #fff;
}

.supply-bi-page :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: #eff6ff;
}

.supply-bi-page :deep(.el-table__inner-wrapper::before) {
  background-color: var(--bi-border);
}

.supply-bi-page :deep(.el-empty__description p) {
  color: var(--bi-muted);
}

.supply-bi-page :deep(.el-progress-bar__outer) {
  background-color: #e7edf5;
}

.supply-bi-page :deep(.el-loading-mask) {
  background-color: rgba(255, 255, 255, 0.72);
}

@media (max-width: 1180px) {
  .dashboard-grid,
  .sales-command-hero,
  .sales-board-grid,
  .product-sales-layout,
  .product-activation-panel,
  .product-chart-grid--split,
  .ranking-visual-grid,
  .risk-visual-grid,
  .dual-ranking-layout,
  .target-completion-row,
  .activity-layout,
  .overview-cockpit-layout,
  .overview-focus-row,
  .overview-operating-grid,
  .overview-drill-grid,
  .payment-risk-control-grid,
  .payment-risk-city-group-grid,
  .customer-command-hero,
  .customer-command-grid,
  .product-dimension-overview,
  .role-snapshot,
  .product-health-strip,
  .analysis-insight-strip,
  .city-operating-summary-strip {
    grid-template-columns: 1fr;
  }

  .overview-kpi-cluster {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bi-sync-scope-options {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .role-snapshot__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .product-sales-summary-strip--compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sales-board-panel--ranking {
    grid-row: auto;
  }

  .overview-business-share__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .overview-business-share__chart {
    min-height: 180px;
  }
}

@media (max-width: 720px) {
  .bi-filter-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .bi-filter-title span {
    white-space: normal;
  }

  .bi-filter-tools,
  .bi-filter-meta {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .bi-sync-panel__head,
  .bi-sync-scope-options {
    grid-template-columns: 1fr;
  }

  .overview-command-headline {
    align-items: flex-start;
    flex-direction: column;
  }

  .overview-command-headline strong,
  .overview-kpi-card strong {
    white-space: normal;
  }

  .overview-command-headline small {
    white-space: normal;
  }

  .sales-command-main > strong,
  .sales-progress-card strong,
  .sales-risk-entry > strong {
    white-space: normal;
  }

  .sales-command-main__chips,
  .sales-podium,
  .sales-progress-card {
    grid-template-columns: 1fr;
  }

  .overview-command-headline__meta {
    width: 100%;
    text-align: left;
  }

  .quick-period-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .product-inventory-mode-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .product-inventory-mode-bar span {
    white-space: normal;
  }

  .inventory-operation-row__metrics {
    grid-template-columns: minmax(0, 1fr);
  }

  .inventory-operation-row__head,
  .inventory-operation-row__track {
    align-items: flex-start;
    flex-direction: column;
  }

  .inventory-operation-row__track span {
    flex-basis: auto;
  }

  .overview-risk-entry__metrics,
  .overview-kpi-cluster {
    grid-template-columns: minmax(0, 1fr);
  }

  .overview-business-share-item__main,
  .overview-business-share-item__meta {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-panel :deep(.bi-filter-item--date) {
    grid-column: span 1;
  }

  .filter-panel :deep(.el-form-item) {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }

  .ranking-row {
    grid-template-columns: 32px minmax(0, 1fr);
  }

  .product-sales-coverage-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .ranking-row__amount {
    grid-column: 2;
    text-align: left;
  }

  .sales-command-hero,
  .sales-board-grid,
  .city-ranking-stats,
  .city-operating-summary-strip,
  .city-cost-summary,
  .customer-command-main__chips,
  .customer-value-matrix,
  .customer-risk-buckets,
  .payment-risk-city-group-grid,
  .product-dimension-overview,
  .risk-summary-strip,
  .gross-profit-summary-strip,
  .product-sales-summary-strip,
  .product-health-strip,
  .role-snapshot__cards,
  .payment-risk-summary-strip {
    grid-template-columns: 1fr;
  }

  .customer-priority-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .role-snapshot__main > strong {
    font-size: 32px;
    white-space: normal;
  }

  .role-snapshot-card strong,
  .product-health-strip strong {
    white-space: normal;
  }

  .customer-priority-row em,
  .customer-priority-row b {
    text-align: left;
  }
}
</style>
