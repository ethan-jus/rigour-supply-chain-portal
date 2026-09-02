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
            <el-button
              v-if="canRefreshData"
              class="bi-refresh-button"
              size="small"
              type="primary"
              plain
              :icon="Refresh"
              :loading="refreshing"
              @click="triggerRefresh"
            >
              刷新
            </el-button>
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
      <div class="overview-command-shell">
        <div class="overview-cockpit-main">
          <div class="overview-cockpit-copy">
            <span class="overview-cockpit-label">经营总览驾驶舱</span>
            <strong>{{ rangeLabel }}</strong>
            <small>总览只看全局结果，城市、销售、商品、风险从下方入口穿透。</small>
          </div>
          <div class="overview-cockpit-rate" :class="`overview-cockpit-rate--${paymentRiskLevelCode}`">
            <span>回款健康度</span>
            <strong>{{ formatPercent(overviewPaidRate) }}</strong>
            <small>{{ paymentRiskLevelLabel }} · 待回款 {{ formatMoneyWan(unpaidAmountMetric?.value) }}</small>
            <em><i :style="{ width: `${boundedPercent(overviewPaidRate)}%` }" /></em>
          </div>
        </div>
        <div class="overview-drill-grid">
          <button
            v-for="entry in overviewDrillEntrances"
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
      <div class="overview-lead-grid">
        <div
          v-for="metric in overviewLeadMetrics"
          :key="metric.metricCode"
          class="overview-lead-card"
          :class="metricClass(metric.metricCode)"
        >
          <span>{{ displayMetricName(metric) }}</span>
          <strong>{{ formatMetric(metric) }}</strong>
          <small>{{ metricDescription(metric) }}</small>
        </div>
      </div>
      <div class="overview-support-grid">
        <div
          v-for="metric in overviewSupportMetrics"
          :key="metric.metricCode"
          class="overview-support-card"
          :class="metricClass(metric.metricCode)"
        >
          <span>{{ displayMetricName(metric) }}</span>
          <strong>{{ formatMetric(metric) }}</strong>
          <small>{{ metricDescription(metric) }}</small>
        </div>
      </div>
    </section>

    <section
      v-else-if="visibleMetrics.length"
      class="metric-grid metric-grid--compact"
      v-loading="loading"
    >
      <button
        v-for="metric in visibleMetrics"
        :key="metric.metricCode"
        class="metric-tile"
        :class="metricClass(metric.metricCode)"
        type="button"
        @click="openMetric(metric.metricCode)"
      >
        <span>{{ displayMetricName(metric) }}</span>
        <strong>{{ formatMetric(metric) }}</strong>
        <small>{{ metricDescription(metric) }}</small>
        <em>{{ metricActionLabel(metric.metricCode) }}</em>
      </button>
    </section>

    <section v-if="isProductInventorySection" class="product-inventory-mode-bar">
      <div>
        <strong>商品/采购/库存运营</strong>
        <span>按业务动作切换，不把商品销售、采购履约、库存留存和补货建议堆在同一屏</span>
      </div>
      <el-radio-group v-model="productInventoryView" size="small">
        <el-radio-button value="product">商品销售</el-radio-button>
        <el-radio-button value="procurement">采购履约</el-radio-button>
        <el-radio-button value="inventory">库存留存</el-radio-button>
        <el-radio-button value="replenishment">补货建议</el-radio-button>
      </el-radio-group>
    </section>

    <section
      class="dashboard-grid"
      :class="{
        'dashboard-grid--overview': isOverviewSection,
        'dashboard-grid--single': dashboardSection !== 'overview',
      }"
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
          <div class="city-ranking-stats">
            <div>
              <span>有销售城市</span>
              <strong>{{ formatNumber(citySalesCityCount) }}</strong>
            </div>
            <div>
              <span>城市交易额</span>
              <strong>{{ formatMoneyWan(citySalesTotal) }}</strong>
            </div>
            <div>
              <span>城市回款额</span>
              <strong>{{ formatMoneyWan(cityPaidTotal) }}</strong>
            </div>
            <div>
              <span>整体回款率</span>
              <strong>{{ formatPercent(cityOverallPaidRate) }}</strong>
            </div>
          </div>
          <div class="overview-city-board" :class="{ 'overview-city-board--full': !isOverviewSection }">
            <button
              v-for="(item, index) in cityBoardRows"
              :key="`overview-city-${item.dimensionCode}`"
              class="overview-city-row"
              type="button"
              @click="selectCityRankingItem(item)"
            >
              <span class="ranking-row__index" :class="rankingIndexClass(index)">{{ index + 1 }}</span>
              <div class="overview-city-row__main">
                <div class="overview-city-row__title">
                  <strong>{{ item.dimensionName || item.dimensionCode }}</strong>
                  <small>{{ formatNumber(item.orderCount) }} 单 · {{ formatNumber(item.customerCount) }} 客户</small>
                </div>
                <div class="overview-city-row__bars">
                  <span>
                    <em>交易额</em>
                    <i>
                      <b :style="{ width: `${rankingBarWidthBy(item, citySalesRanking, 'salesAmount')}%` }" />
                    </i>
                    <strong>{{ formatMoneyWan(item.salesAmount) }}</strong>
                  </span>
                  <span>
                    <em>回款额</em>
                    <i class="overview-city-row__paid">
                      <b :style="{ width: `${rankingBarWidthBy(item, citySalesRanking, 'paidAmount')}%` }" />
                    </i>
                    <strong>{{ formatMoneyWan(item.paidAmount) }}</strong>
                  </span>
                </div>
              </div>
              <div class="overview-city-row__rate" :class="paymentRateClass(item.rate)">
                <span>回款率</span>
                <strong>{{ formatPercent(item.rate) }}</strong>
              </div>
            </button>
          </div>
        </div>
        <div v-if="isOverviewSection && citySalesRanking.length > cityBoardRows.length" class="ranking-footer">
          <el-button link type="primary" @click="openDashboardSection('city-operating')">查看完整城市排行</el-button>
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
            <h2>销售来源占比</h2>
            <p>按销售额占比</p>
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
            :option="activityCostPieOption"
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
        <div v-else-if="isProductSalesVisualSection" class="product-sales-summary-strip">
          <div>
            <span>{{ productSummaryPrimaryLabel }}</span>
            <strong>{{ formatNumber(productSummaryPrimaryValue) }}</strong>
          </div>
          <div v-if="showProductSummarySecondary">
            <span>{{ productSummarySecondaryLabel }}</span>
            <strong>{{ productSummarySecondaryValue }}</strong>
          </div>
          <div>
            <span>订货数量</span>
            <strong>{{ formatNumber(productSummaryQuantity) }}</strong>
          </div>
          <div>
            <span>订货金额</span>
            <strong>{{ formatMoneyWan(productSummaryAmount) }}</strong>
          </div>
          <div>
            <span>{{ productSummaryOrderLabel }}</span>
            <strong>{{ formatNumber(productSummaryOrderCount) }}</strong>
          </div>
          <div>
            <span>客户数</span>
            <strong>{{ formatNumber(productSummaryCustomerCount) }}</strong>
          </div>
        </div>
        <div
          v-if="isProductSalesVisualSection || isGrossProfitSection"
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
            v-if="showProductSalesChart || showProductSharePieChart || !displayedProductSales.length"
            class="product-sales-bars"
          >
            <div
              v-if="showProductSalesChart || showProductSharePieChart"
              class="product-chart-grid"
              :class="{ 'product-chart-grid--with-pie': showProductSharePieChart }"
            >
              <EchartsChart
                v-if="showProductSalesChart"
                class="bi-chart bi-chart--product"
                :option="productSalesChartOption"
                :height="productChartHeight"
                :loading="loading"
                @chart-click="handleProductSalesChartClick"
              />
              <EchartsChart
                v-if="showProductSharePieChart"
                class="bi-chart bi-chart--product-share"
                :option="productSharePieOption"
                :height="productSharePieHeight"
                :loading="loading"
                @chart-click="handleProductSalesChartClick"
              />
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
            <el-table-column :label="productDimensionLabel" min-width="260" show-overflow-tooltip>
              <template #default="scope">{{ scope.row.dimensionName || scope.row.dimensionCode }}</template>
            </el-table-column>
            <el-table-column
              v-if="productBreakdown === 'PRODUCT' && !isOverviewSection"
              prop="categoryName"
              label="分类"
              min-width="150"
              show-overflow-tooltip
            />
            <el-table-column label="订货数量" width="120" align="right">
              <template #default="scope">{{ formatNumber(scope.row.salesQuantity) }}</template>
            </el-table-column>
            <el-table-column label="订货金额" width="140" align="right">
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
            <el-table-column label="下单数" width="100" align="right">
              <template #default="scope">{{ formatNumber(scope.row.orderCount) }}</template>
            </el-table-column>
            <el-table-column label="下单客户数" width="110" align="right">
              <template #default="scope">{{ formatNumber(scope.row.customerCount) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="180" align="center">
              <template #default="scope">
                <div class="product-table-actions">
                  <el-button link type="primary" @click.stop="openProductSales(scope.row)">
                    {{ productActionLabel }}
                  </el-button>
                  <el-button link type="primary" @click.stop="openProductOrders(scope.row)">订单明细</el-button>
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
          <el-button v-if="canRefreshData" type="primary" plain :loading="refreshing" @click="triggerRefresh">刷新成本数据</el-button>
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
          <el-tag v-if="isOverviewSection" :type="paymentRiskTagType" effect="light">{{ paymentRiskLevelLabel }}</el-tag>
          <el-icon v-else><Warning /></el-icon>
        </div>
        <div class="payment-risk-summary-strip" :class="paymentRiskToneClass">
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
        </div>
        <div v-if="!isOverviewSection" class="payment-risk-layout">
          <div class="risk-ranking-block">
            <div class="subsection-head">
              <strong>城市风险排行</strong>
            </div>
            <div v-if="paymentRiskCityPreview.length" class="ranking-list ranking-list--risk">
              <button
                v-for="(item, index) in paymentRiskCityPreview"
                :key="`${item.rankType}-${item.dimensionCode}`"
                class="ranking-row"
                type="button"
                @click="selectCityRankingItem(item)"
              >
                <span class="ranking-row__index" :class="rankingIndexClass(index)">{{ index + 1 }}</span>
                <div class="ranking-row__main">
                  <strong>{{ item.dimensionName || item.dimensionCode }}</strong>
                  <small>{{ formatNumber(item.customerCount) }} 客户 · {{ formatNumber(item.orderCount) }} 单</small>
                  <span class="ranking-row__meter ranking-row__meter--risk">
                    <i :style="{ width: `${paymentRiskBarWidth(item, paymentRiskCityRanking)}%` }" />
                  </span>
                </div>
                <div class="ranking-row__amount">
                  <strong>{{ formatMoneyWan(item.unpaidAmount) }}</strong>
                  <el-tag :type="paymentRiskItemTagType(item.rate)" effect="light" size="small">{{ paymentRiskItemLevelLabel(item.rate) }}</el-tag>
                  <small>回款率 {{ formatPercent(item.rate) }}</small>
                </div>
              </button>
            </div>
            <div v-else class="empty-inline">暂无城市回款风险</div>
          </div>
          <div v-if="!isOverviewSection" class="risk-ranking-block">
            <div class="subsection-head">
              <strong>销售风险排行</strong>
            </div>
            <div v-if="paymentRiskSalesPreview.length" class="ranking-list ranking-list--risk">
              <button
                v-for="(item, index) in paymentRiskSalesPreview"
                :key="`${item.rankType}-${item.dimensionCode}`"
                class="ranking-row"
                type="button"
                @click="selectSalesRankingItem(item)"
              >
                <span class="ranking-row__index" :class="rankingIndexClass(index)">{{ index + 1 }}</span>
                <div class="ranking-row__main">
                  <strong>{{ item.dimensionName || item.dimensionCode }}</strong>
                  <small>{{ salesRankingRegionLabel(item) }} · {{ formatNumber(item.customerCount) }} 客户 · {{ formatNumber(item.orderCount) }} 单</small>
                  <span class="ranking-row__meter ranking-row__meter--risk">
                    <i :style="{ width: `${paymentRiskBarWidth(item, paymentRiskSalesRanking)}%` }" />
                  </span>
                </div>
                <div class="ranking-row__amount">
                  <strong>{{ formatMoneyWan(item.unpaidAmount) }}</strong>
                  <el-tag :type="paymentRiskItemTagType(item.rate)" effect="light" size="small">{{ paymentRiskItemLevelLabel(item.rate) }}</el-tag>
                  <small>回款率 {{ formatPercent(item.rate) }}</small>
                </div>
              </button>
            </div>
            <div v-else class="empty-inline">暂无销售回款风险</div>
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
import { Coin, DataAnalysis, Histogram, Refresh, RefreshLeft, Search, TrendCharts, Warning } from '@element-plus/icons-vue'
import { getCrmCustomerAreas, getCrmCustomerTypes, type CrmDictionaryView } from '@/api/core/crm'
import type { ErpProductCategoryView } from '@/api/core/erp-internal'
import {
  createSupplyDashboardRefreshRun,
  getSupplyDashboardFilterOptions,
  getSupplyDashboardOverview,
  type SupplyDashboardFilterOptions,
  type SupplyDashboardMetricCard,
  type SupplyDashboardOverview,
  type SupplyDashboardInventoryItemSummary,
  type SupplyDashboardInventoryReplenishmentItem,
  type SupplyDashboardProductSalesItem,
  type SupplyDashboardRankingItem,
  type SupplyDashboardRiskItem,
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
  sourceSystemCode?: string
  orderCount?: number
  customerCount?: number
  rate?: number
}

interface ProductSalesChartData {
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
  data?: SourceSystemPieData & ProductSalesChartData
}

interface ProductSalesTooltipParam {
  name?: string
  data?: ProductSalesChartData
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
const errorMessage = ref('')
const overview = ref<SupplyDashboardOverview | null>(null)
type ProductBreakdown = 'PRODUCT' | 'CATEGORY' | 'BRAND'
type ProductSalesVisibility = 'SOLD_ONLY' | 'WITH_UNSOLD'
type ProductInventoryView = 'product' | 'procurement' | 'inventory' | 'replenishment'
type InventoryDetailKind = 'procurement' | 'shipped' | 'remaining' | 'replenishment'
type QuickPeriod = 'latest' | 'today' | 'month' | 'year' | 'custom'
type RankingAmountField = 'salesAmount' | 'paidAmount' | 'unpaidAmount'
const productBreakdown = ref<ProductBreakdown>('PRODUCT')
const productSalesVisibility = ref<ProductSalesVisibility>('SOLD_ONLY')
const productInventoryView = ref<ProductInventoryView>('product')
const activeInventoryDetailKind = ref<InventoryDetailKind>('procurement')
const inventoryDetailVisible = ref(false)
const quickPeriod = ref<QuickPeriod>('latest')
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

type DashboardSection = 'overview' | 'sales' | 'city-operating' | 'activity' | 'product-inventory' | 'sales-collection' | 'product-sales' | 'gross-profit' | 'payment-risk' | 'city-cost' | 'inventory-risk'

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
  activity: {
    title: '活动看板',
    description: '运营视角：先展示活动投入产出样例，后续接真实活动数据。',
    metricCodes: [],
  },
  'product-inventory': {
    title: '商品/库存看板',
    description: '运营视角：按销售、采购履约、库存留存、补货建议分开处理。',
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
  'product-inventory': 'SupplyBiProductSales',
}

const metricOrder = [
  'sales_amount',
  'paid_amount',
  'unpaid_amount',
  'order_count',
  'contacted_customer_count',
  'cooperated_customer_count',
  'repeat_customer_count',
  'receipt_amount',
  'refund_amount',
  'ordering_customer_count',
  'active_customer_count',
  'sales_net_amount',
  'estimated_cost_amount',
  'estimated_gross_profit',
  'estimated_gross_profit_rate',
  'cost_coverage_rate',
  'payment_risk_amount',
  'payment_risk_customer_count',
  'payment_high_risk_customer_count',
  'payment_avg_overdue_days',
  'payment_risk_amount_rate',
  'target_achievement_rate',
  'city_cost_amount',
  'city_cost_rate',
  'inventory_risk_count',
]

const dashboardSection = computed<DashboardSection>(() => {
  const value = String(route.meta.dashboardSection || 'overview')
  return value in dashboardSections ? value as DashboardSection : 'overview'
})
const dashboardTitle = computed(() => dashboardSections[dashboardSection.value].title)
const dashboardDescription = computed(() => dashboardSections[dashboardSection.value].description)
const orderedMetrics = computed(() => {
  const metrics = overview.value?.metrics || []
  return [...metrics].sort((left, right) => metricRank(left.metricCode) - metricRank(right.metricCode))
})
const visibleMetrics = computed(() => {
  const codes = new Set(dashboardSections[dashboardSection.value].metricCodes)
  return orderedMetrics.value.filter((metric) => codes.has(metric.metricCode))
})
const overviewLeadMetrics = computed(() => visibleMetrics.value.filter((metric) =>
  ['sales_amount', 'paid_amount', 'unpaid_amount'].includes(metric.metricCode),
))
const overviewSupportMetrics = computed(() => visibleMetrics.value.filter((metric) =>
  ['order_count', 'contacted_customer_count', 'cooperated_customer_count', 'repeat_customer_count'].includes(metric.metricCode),
))
const isOverviewSection = computed(() => dashboardSection.value === 'overview')
const isCityOperatingSection = computed(() => dashboardSection.value === 'city-operating')
const isSalesBoardSection = computed(() => dashboardSection.value === 'sales')
const isSalesCollectionDetailSection = computed(() => dashboardSection.value === 'sales-collection')
const isPaymentRiskDetailSection = computed(() => dashboardSection.value === 'payment-risk')
const showQuickPeriodBar = computed(() => dashboardSection.value !== 'activity')
const isProductAnalysisSection = computed(() =>
  dashboardSection.value === 'product-sales',
)
const isProductInventorySection = computed(() => dashboardSection.value === 'product-inventory')
const isProductSalesVisualSection = computed(() => isProductAnalysisSection.value || isProductInventorySection.value)
const isActivitySection = computed(() => dashboardSection.value === 'activity')
const isGrossProfitSection = computed(() => dashboardSection.value === 'gross-profit')
const rankingPreviewLimit = computed(() => isOverviewSection.value ? 6 : Number.MAX_SAFE_INTEGER)
const showSalesCollectionSection = computed(() =>
  (isOverviewSection.value && quickPeriod.value !== 'today')
  || isSalesBoardSection.value
  || isSalesCollectionDetailSection.value
  || isCityOperatingSection.value,
)
const showCityRankingSection = computed(() =>
  isCityOperatingSection.value || isSalesCollectionDetailSection.value,
)
const showTargetCompletionSection = computed(() =>
  isCityOperatingSection.value,
)
const showActivitySection = computed(() => isActivitySection.value)
const showSalesRankingSection = computed(() =>
  isSalesBoardSection.value || isCityOperatingSection.value || isSalesCollectionDetailSection.value,
)
const showProductSalesSection = computed(() =>
  isProductAnalysisSection.value
  || (isProductInventorySection.value && productInventoryView.value === 'product')
  || isGrossProfitSection.value,
)
const showInventoryOperationSection = computed(() =>
  isOverviewSection.value
  || (isProductInventorySection.value && productInventoryView.value !== 'product'),
)
const showPaymentRiskSection = computed(() =>
  isOverviewSection.value
  || isSalesBoardSection.value
  || isPaymentRiskDetailSection.value
  || isCityOperatingSection.value,
)
const showCityCostSection = computed(() => dashboardSection.value === 'city-cost')
const showInventoryRiskSection = computed(() => dashboardSection.value === 'inventory-risk')

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
const salesAmountMetric = computed(() => metricByCode('sales_amount'))
const paidAmountMetric = computed(() => metricByCode('paid_amount'))
const unpaidAmountMetric = computed(() => metricByCode('unpaid_amount'))
const paymentRiskAmountMetric = computed(() => metricByCode('payment_risk_amount'))
const paymentRiskCustomerMetric = computed(() => metricByCode('payment_risk_customer_count'))
const paymentHighRiskCustomerMetric = computed(() => metricByCode('payment_high_risk_customer_count'))
const paymentAvgOverdueMetric = computed(() => metricByCode('payment_avg_overdue_days'))
const paymentRiskAmountRateMetric = computed(() => metricByCode('payment_risk_amount_rate'))
const targetAchievementRateMetric = computed(() => metricByCode('target_achievement_rate'))
const cityCostMetric = computed(() => overview.value?.metrics.find((item) => item.metricCode === 'city_cost_amount') || null)
const cityCostRateMetric = computed(() => overview.value?.metrics.find((item) => item.metricCode === 'city_cost_rate') || null)
const rawProductSales = computed<SupplyDashboardProductSalesItem[]>(() => {
  if (!overview.value) return []
  if (productBreakdown.value === 'CATEGORY') return overview.value.categorySalesRanking || []
  if (productBreakdown.value === 'BRAND') return overview.value.brandSalesRanking || []
  return overview.value.productSalesRanking || []
})
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
const productPanelTitle = computed(() => isGrossProfitSection.value ? '销售毛利分析' : '商品销售统计')
const productPanelDescription = computed(() => isGrossProfitSection.value
  ? '来自 BI 订单行事实表，成本使用 ERP 采购参考价估算，退款按订单行金额比例分摊'
  : '默认展示本期有销售商品；按分类、品牌切换可查看订货数量、订货金额和客户覆盖')
const productDimensionLabel = computed(() => {
  if (productBreakdown.value === 'CATEGORY') return '分类'
  if (productBreakdown.value === 'BRAND') return '品牌'
  return '商品'
})
const productActionLabel = computed(() => {
  if (productBreakdown.value === 'CATEGORY') return '筛选分类'
  if (productBreakdown.value === 'BRAND') return '查看品牌商品'
  return '查看商品'
})
const showGrossProfitColumns = computed(() => isGrossProfitSection.value)
const showProductSalesChart = computed(() =>
  (isProductSalesVisualSection.value || (isGrossProfitSection.value && grossProfitCostCovered.value))
  && displayedProductSales.value.length > 0,
)
const showProductSharePieChart = computed(() =>
  false,
)
const showGrossProfitCoverageWarning = computed(() =>
  isGrossProfitSection.value && displayedProductSales.value.length > 0 && !grossProfitCostCovered.value,
)
const productSalesTableRows = computed(() =>
  isOverviewSection.value ? analysisProductSales.value.slice(0, 8) : analysisProductSales.value,
)
const productChartHeight = computed(() => isGrossProfitSection.value ? 380 : productBreakdown.value === 'PRODUCT' ? 360 : 320)
const productSharePieHeight = computed(() => 320)
const productTableMaxHeight = computed(() => isOverviewSection.value ? 390 : isGrossProfitSection.value ? 520 : 460)
const canRefreshData = computed(() => authStore.hasPermission('analytics:refresh:write'))
const cityCostHasData = computed(() => Number(cityCostMetric.value?.value || 0) > 0 || Boolean(overview.value?.cityCostRanking?.length))
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
const cityBoardRows = computed(() =>
  isOverviewSection.value ? citySalesRanking.value.slice(0, 6) : citySalesRanking.value,
)
const salesTargetCompletionMap = computed(() =>
  buildTargetCompletionMap(overview.value?.salesTargetCompletions || []),
)
const salesRankingPreview = computed<SalesRankingDisplayRow[]>(() =>
  attachSalesTargetMetric(salesRanking.value.slice(0, rankingPreviewLimit.value), 'SALES_AMOUNT'),
)
const salesPaidRankingPreview = computed<SalesRankingDisplayRow[]>(() =>
  attachSalesTargetMetric(salesPaidRanking.value.slice(0, rankingPreviewLimit.value), 'PAID_AMOUNT'),
)
const citySalesCityCount = computed(() => citySalesRanking.value.length)
const citySalesTotal = computed(() => citySalesRanking.value.reduce((total, item) => total + Number(item.salesAmount || 0), 0))
const cityPaidTotal = computed(() => citySalesRanking.value.reduce((total, item) => total + Number(item.paidAmount || 0), 0))
const cityOverallPaidRate = computed(() => citySalesTotal.value ? cityPaidTotal.value / citySalesTotal.value * 100 : 0)
const cityTargetOverviewRows = computed<CityTargetOverviewRow[]>(() =>
  groupTargetCompletionRows(overview.value?.cityTargetCompletions || []),
)
const paymentRiskCityRanking = computed<SupplyDashboardRankingItem[]>(() =>
  (overview.value?.paymentRiskCityRanking || []).map((item) => ({
    ...item,
    dimensionName: regionName(item.dimensionCode, item.dimensionName),
  })),
)
const paymentRiskSalesRanking = computed<SupplyDashboardRankingItem[]>(() => overview.value?.paymentRiskSalesRanking || [])
const paymentRiskPreviewLimit = computed(() => {
  if (isOverviewSection.value) return 5
  if (isSalesBoardSection.value) return 6
  return 12
})
const paymentRiskCityPreview = computed(() => paymentRiskCityRanking.value.slice(0, paymentRiskPreviewLimit.value))
const paymentRiskSalesPreview = computed(() => paymentRiskSalesRanking.value.slice(0, paymentRiskPreviewLimit.value))
const sourceSystemBreakdown = computed<SupplyDashboardRankingItem[]>(() =>
  (overview.value?.sourceSystemBreakdown || []).map((item) => ({
    ...item,
    dimensionName: sourceSystemName(item.dimensionCode, item.dimensionName),
  })),
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
const salesCollectionChartOption = computed<EChartsCoreOption>(() =>
  buildSalesCollectionChartOption(
    normalizeSalesTrend(overview.value?.salesTrend || []),
    normalizeCollectionTrend(overview.value?.collectionTrend || []),
    !isOverviewSection.value,
  ),
)
const sourceSystemPieOption = computed<EChartsCoreOption>(() => buildSourceSystemPieOption(sourceSystemBreakdown.value))
const productSalesChartOption = computed<EChartsCoreOption>(() =>
  buildProductSalesChartOption(analysisProductSales.value, productBreakdown.value, isGrossProfitSection.value),
)
const productSharePieOption = computed<EChartsCoreOption>(() =>
  buildProductSharePieOption(analysisProductSales.value, productBreakdown.value),
)
const inventoryRiskChartOption = computed<EChartsCoreOption>(() => buildInventoryRiskChartOption(riskRows.value))
const inventoryCoverageChartOption = computed<EChartsCoreOption>(() =>
  buildInventoryCoverageChartOption(inventoryCoverageChartRows.value),
)
const cityCostChartOption = computed<EChartsCoreOption>(() => buildCityCostChartOption(cityCostTrendRows.value))
const activityTrendChartOption = computed<EChartsCoreOption>(() => buildActivityTrendChartOption())
const activityCostPieOption = computed<EChartsCoreOption>(() => buildActivityCostPieOption())
const productSaleableCount = computed(() => overview.value?.productSalesRanking?.length || 0)
const productSoldCount = computed(() => (overview.value?.productSalesRanking || []).filter(hasProductSales).length)
const productUnsoldCount = computed(() => Math.max(productSaleableCount.value - productSoldCount.value, 0))
const productActivationRate = computed(() => productSaleableCount.value ? productSoldCount.value / productSaleableCount.value * 100 : 0)
const productSummaryPrimaryLabel = computed(() => {
  if (productBreakdown.value === 'CATEGORY') return '有销售分类数'
  if (productBreakdown.value === 'BRAND') return '有销售品牌数'
  return '有销售商品数'
})
const productSummaryPrimaryValue = computed(() =>
  productBreakdown.value === 'PRODUCT' ? productSoldCount.value : rawProductSales.value.length,
)
const showProductSummarySecondary = computed(() => productBreakdown.value === 'PRODUCT')
const productSummarySecondaryLabel = computed(() => '动销率')
const productSummarySecondaryValue = computed(() => formatPercent(productActivationRate.value))
const productSummaryQuantity = computed(() => displayedProductSales.value.reduce((total, item) => total + Number(item.salesQuantity || 0), 0))
const productSummaryAmount = computed(() => displayedProductSales.value.reduce((total, item) => total + Number(item.salesAmount || 0), 0))
const productSummaryOrderLabel = computed(() => '下单数')
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
const paymentRiskTagType = computed<TagProps['type']>(() => {
  if (paymentRiskLevelCode.value === 'healthy') return 'success'
  if (paymentRiskLevelCode.value === 'warning') return 'warning'
  if (paymentRiskLevelCode.value === 'danger') return 'danger'
  return 'info'
})
const paymentRiskToneClass = computed(() => `payment-risk-summary-strip--${paymentRiskLevelCode.value}`)
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
    section: 'payment-risk' as DashboardSection,
    title: '回款风险',
    summary: `风险金额 ${formatMoneyWan(paymentRiskAmountMetric.value?.value)}，销售和城市排行放在风险看板`,
    value: paymentRiskLevelLabel.value,
    tone: paymentRiskLevelCode.value,
    icon: Warning,
  },
])

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
        { optionType: 'SOURCE_SYSTEM', optionValue: 'MANUAL', optionLabel: '手工订单', usageCount: 0 },
      ],
    }
  }
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

async function triggerRefresh() {
  refreshing.value = true
  try {
    const run = await createSupplyDashboardRefreshRun()
    if (run.statusCode === 'SUCCESS') {
      ElMessage.success(`刷新完成：读取 ${formatNumber(run.pulledCount)} 条，写入 ${formatNumber(run.upsertedCount)} 条`)
      await Promise.all([loadDashboard(), loadFilterOptions()])
    } else if (run.statusCode === 'SKIPPED') {
      ElMessage.warning(run.failureReason || '已有刷新任务运行中')
    } else {
      ElMessage.error(run.failureReason || '供应链 BI 刷新失败')
    }
  } catch (error) {
    const message = apiErrorMessage(error, '供应链 BI 刷新失败')
    ElMessage.error(message)
  } finally {
    refreshing.value = false
  }
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
    || data.productSalesRanking.some(hasProductSales)
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

function displayMetricName(metric: SupplyDashboardMetricCard) {
  if (!isOverviewSection.value) {
    if (metric.metricCode === 'paid_amount') return '回款额'
    return metric.metricName
  }
  const names: Record<string, string> = {
    sales_amount: '总交易额',
    paid_amount: '总回款额',
    unpaid_amount: '待回款',
    order_count: '订单数',
    contacted_customer_count: '建联客户数',
    cooperated_customer_count: '合作客户数',
    repeat_customer_count: '复购客户数',
  }
  return names[metric.metricCode] || metric.metricName
}

function metricDescription(metric: SupplyDashboardMetricCard) {
  const descriptions: Record<string, string> = {
    sales_amount: '当前筛选范围内订单应收金额',
    paid_amount: '当前筛选范围内订单累计已收金额',
    unpaid_amount: '需要继续跟进的未收金额',
    receipt_amount: '实际回款记录金额',
    refund_amount: '订单级退款按订单行金额分摊',
    order_count: '当前筛选范围内订单数量',
    contacted_customer_count: 'CRM 有联系人或电话的客户',
    cooperated_customer_count: '当前筛选范围内产生交易的客户',
    repeat_customer_count: '当前筛选范围内复购客户',
    ordering_customer_count: '当前筛选范围内有下单客户',
    active_customer_count: 'CRM 当前有效客户',
    sales_net_amount: '销售额扣减订单级退款分摊',
    estimated_cost_amount: '订单行数量乘 ERP 采购参考价',
    estimated_gross_profit: '基于采购参考价估算',
    estimated_gross_profit_rate: '估算毛利占销售净收入比例',
    cost_coverage_rate: '有采购参考价的订单行金额占比',
    payment_risk_amount: '超过账期仍未回款金额',
    payment_risk_customer_count: '存在待回款订单的客户',
    payment_high_risk_customer_count: '超过账期且回款率不高于20%的客户',
    payment_avg_overdue_days: '待回款订单平均逾期天数',
    payment_risk_amount_rate: '风险金额占销售额比例',
    target_achievement_rate: '按目标配置计算完成率',
    city_cost_amount: '已导入的城市运营成本',
    city_cost_rate: '城市运营成本占销售额比例',
    inventory_risk_count: '优先展示需要关注的库存项',
  }
  if (metric.metricCode === 'city_cost_rate' && !cityCostHasData.value) return '城市成本数据未导入'
  if (metric.metricCode === 'estimated_gross_profit_rate' && !grossProfitCostCovered.value) return '采购参考价未覆盖，暂不判断毛利'
  return descriptions[metric.metricCode] || metric.description || '当前筛选范围指标'
}

function metricActionLabel(code: string) {
  if (code === 'target_achievement_rate') return '查看目标完成'
  if (code === 'refund_amount') return '查看退款'
  if (code.includes('gross_profit') || code === 'cost_coverage_rate' || code === 'sales_net_amount' || code === 'estimated_cost_amount') return '查看毛利'
  if (code.startsWith('payment_risk') || code === 'payment_avg_overdue_days') return '查看风险'
  if (code === 'receipt_amount') return '查看回款'
  if (code === 'paid_amount') return '查看订单回款'
  if (code === 'unpaid_amount') return '查看待回款订单'
  if (code === 'inventory_risk_count') return dashboardSection.value === 'inventory-risk' ? '查看库存明细' : '查看库存风险'
  if (code.includes('customer')) return '查看客户'
  if (code.includes('cost')) return '查看城市成本'
  return '查看订单'
}

function metricRank(code: string) {
  const index = metricOrder.indexOf(code)
  return index >= 0 ? index : metricOrder.length
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
    ownerStaffCode: filters.ownerStaffCode || undefined,
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
    void router.push({ name: 'SupplyBiSales' })
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
    void router.push({
      path: '/supply-chain/crm/customers/profiles',
      query: {
        regionCode: filters.regionCode || undefined,
        ownerStaffCode: filters.ownerStaffCode || undefined,
        customerTypeCode: filters.customerTypeCode || undefined,
      },
    })
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

function accessibleDashboardRouteName(section: DashboardSection) {
  const routeName = dashboardRouteNames[section]
  const resolved = router.resolve({ name: routeName })
  if (!resolved.matched.length || navigationStore.hasPath('SUPPLY_CHAIN', resolved.path)) return routeName
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

function handleInventoryCoverageChartClick(params: unknown) {
  const data = chartParams(params).data as InventoryCoverageChartData | undefined
  const index = typeof data?.sourceIndex === 'number' ? data.sourceIndex : chartDataIndex(params)
  const item = inventoryCoverageChartRows.value[index]
  if (item) openInventoryReplenishment(item)
}

function handleProductSalesChartClick(params: unknown) {
  const data = chartParams(params).data as ProductSalesChartData | undefined
  const index = typeof data?.sourceIndex === 'number' ? data.sourceIndex : chartDataIndex(params)
  const item = analysisProductSales.value[index]
  if (!item) return
  openProductSales(item)
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
      productName: item.dimensionName || undefined,
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

function openProductOrders() {
  void router.push({
    name: 'SupplyOrderSalesOrders',
    query: {
      ...baseDrillQuery(),
    },
  })
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

function rankingBarWidthBy(item: SupplyDashboardRankingItem, items: SupplyDashboardRankingItem[], field: RankingAmountField) {
  const max = Math.max(...items.map((row) => Number(row[field] || 0)), 1)
  return Math.max(5, Math.min(100, (Number(item[field] || 0) / max) * 100))
}

function paymentRiskBarWidth(item: SupplyDashboardRankingItem, items: SupplyDashboardRankingItem[]) {
  const max = Math.max(...items.map((row) => Number(row.unpaidAmount || 0)), 1)
  return Math.max(5, Math.min(100, (Number(item.unpaidAmount || 0) / max) * 100))
}

function paymentRateClass(value?: number | null) {
  const rate = Number(value || 0)
  if (rate <= 20) return 'overview-city-row__rate--danger'
  if (rate < 60) return 'overview-city-row__rate--warning'
  return ''
}

function paymentRiskLevelCodeByRate(value?: number | null, hasData = true) {
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

function rankingIndexClass(index: number) {
  if (index === 0) return 'ranking-row__index--first'
  if (index === 1) return 'ranking-row__index--second'
  if (index === 2) return 'ranking-row__index--third'
  return ''
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

function buildSourceSystemPieOption(items: SupplyDashboardRankingItem[]): EChartsCoreOption {
  return {
    color: chartPalette,
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'item',
      formatter: (params: PieTooltipParam) => {
        const data = params.data || {}
        return [
          params.name || '来源',
          `销售额：${formatMoneyWan(params.value)}`,
          `占比：${formatNumber(params.percent)}%`,
          `下单数：${formatNumber(data.orderCount)}`,
          `客户数：${formatNumber(data.customerCount)}`,
          `回款率：${formatPercent(data.rate)}`,
        ].join('<br/>')
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
        name: '销售来源',
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b}\n{d}%', color: chartTheme.label },
        data: items.map((item) => ({
          name: item.dimensionName || item.dimensionCode,
          value: Number(item.salesAmount || 0),
          sourceSystemCode: item.dimensionCode,
          orderCount: item.orderCount,
          customerCount: item.customerCount,
          rate: item.rate,
        })),
      },
    ],
  }
}

function buildProductSharePieOption(
  items: SupplyDashboardProductSalesItem[],
  breakdown: ProductBreakdown,
): EChartsCoreOption {
  const rows = items.slice(0, 8)
  const dimensionLabel = breakdown === 'BRAND' ? '品牌' : '分类'
  return {
    color: chartPalette,
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'item',
      formatter: (params: PieTooltipParam) => {
        const data = params.data || {}
        return [
          params.name || dimensionLabel,
          `订货金额：${formatMoneyWan(data.salesAmount)}`,
          `占比：${formatNumber(params.percent)}%`,
          `订货数量：${formatNumber(data.salesQuantity)}`,
          `下单数：${formatNumber(data.orderCount)}`,
          `客户数：${formatNumber(data.customerCount)}`,
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
        name: `${dimensionLabel}占比`,
        type: 'pie',
        radius: ['44%', '70%'],
        center: ['36%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        data: rows.map((item, sourceIndex) => ({
          name: item.dimensionName || item.dimensionCode,
          value: Number(item.salesAmount || 0),
          sourceIndex,
          salesAmount: Number(item.salesAmount || 0),
          salesQuantity: Number(item.salesQuantity || 0),
          orderCount: item.orderCount,
          customerCount: item.customerCount,
        })),
      },
    ],
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
  const dimensionLabel = breakdown === 'CATEGORY' ? '分类' : breakdown === 'BRAND' ? '品牌' : '商品'
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

function buildActivityCostPieOption(): EChartsCoreOption {
  const rows = [
    { name: '活动物料', value: 8000 },
    { name: '样品/赠品', value: 5000 },
    { name: '人员费用', value: 4000 },
    { name: '品控/物流损耗', value: 2000 },
    { name: '其他', value: 1000 },
  ]
  return {
    color: chartPalette,
    tooltip: {
      ...dashboardTooltipStyle(),
      trigger: 'item',
      formatter: (params: PieTooltipParam) => [
        params.name || '成本项',
        `金额：${formatMoney(params.value)}`,
        `占比：${formatNumber(params.percent)}%`,
      ].join('<br/>'),
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
        name: '成本构成',
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '43%'],
        label: { formatter: '{b}\n{d}%', color: chartTheme.label },
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

function metricClass(code: string) {
  if (code === 'target_achievement_rate') return 'metric-tile--muted'
  if (code === 'refund_amount') return 'metric-tile--refund'
  if (code.includes('gross_profit')) return 'metric-tile--profit'
  if (code.includes('unpaid') || code.includes('risk')) return 'metric-tile--warning'
  if (code.includes('cost')) return 'metric-tile--cost'
  if (code.includes('paid') || code.includes('receipt')) return 'metric-tile--success'
  return 'metric-tile--primary'
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
.panel,
.metric-tile {
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
  min-width: 64px;
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
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
  gap: 10px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
}

.overview-command-shell {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(239, 246, 255, 0.95), rgba(255, 255, 255, 0.92)),
    repeating-linear-gradient(90deg, rgba(37, 99, 235, 0.06) 0, rgba(37, 99, 235, 0.06) 1px, transparent 1px, transparent 64px);
}

.overview-cockpit-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.34fr);
  gap: 12px;
  align-items: stretch;
}

.overview-cockpit-copy,
.overview-cockpit-rate {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 6px;
  border-radius: 8px;
}

.overview-cockpit-copy {
  min-height: 118px;
  padding: 18px 20px;
  border: 1px solid rgba(191, 219, 254, 0.9);
  background: #fff;

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 32px;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: #64748b;
    font-size: 13px;
  }
}

.overview-cockpit-label {
  color: #2563eb;
  font-size: 13px;
  font-weight: 800;
}

.overview-cockpit-rate {
  min-height: 118px;
  padding: 16px;
  border: 1px solid #dbeafe;
  background: #f8fbff;

  span,
  small {
    color: #64748b;
    font-size: 12px;
  }

  strong {
    color: #0f766e;
    font-size: 30px;
    line-height: 1.1;
  }

  em {
    display: block;
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: #e7edf5;
  }

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #16a34a, #2563eb);
  }
}

.overview-cockpit-rate--warning strong {
  color: #c2410c;
}

.overview-cockpit-rate--warning i {
  background: linear-gradient(90deg, #f97316, #facc15);
}

.overview-cockpit-rate--danger strong {
  color: #dc2626;
}

.overview-cockpit-rate--danger i {
  background: linear-gradient(90deg, #dc2626, #f97316);
}

.overview-cockpit-rate--none strong {
  color: #64748b;
}

.overview-cockpit-rate--none i {
  background: #cbd5e1;
}

.overview-drill-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

.overview-command-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  > div {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  strong {
    color: #0f172a;
    font-size: 18px;
  }

  small {
    overflow: hidden;
    color: #64748b;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    overflow: hidden;
    color: #2563eb;
    font-size: 12px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.overview-lead-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.overview-support-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.overview-lead-card,
.overview-support-card {
  display: grid;
  min-width: 0;
  border: 0;
  border-radius: 8px;
  cursor: default;
  font: inherit;
  text-align: left;
}

.overview-lead-card {
  min-height: 102px;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid #dbeafe;
  border-top: 4px solid #2563eb;
  background: #fff;

  span,
  small {
    color: #64748b;
  }

  strong {
    color: #0f172a;
    font-size: 30px;
    line-height: 1.05;
  }
}

.overview-lead-card.metric-tile--success {
  border-color: #bbf7d0;
  border-top-color: #16a34a;
  background: #f0fdf4;

  strong {
    color: #064e3b;
  }
}

.overview-lead-card.metric-tile--refund,
.overview-lead-card.metric-tile--warning {
  border-color: #fed7aa;
  border-top-color: #f97316;
  background: #fff7ed;

  strong {
    color: #7c2d12;
  }
}

.overview-support-card {
  min-height: 82px;
  gap: 6px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-top: 4px solid #2563eb;
  background: #fff;

  span,
  small {
    color: #64748b;
  }

  strong {
    color: #0f172a;
    font-size: 22px;
    line-height: 1.1;
  }
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(150px, 1fr));
  gap: 10px;
}

.metric-grid--leadership .metric-tile {
  min-height: 122px;

  strong {
    font-size: 27px;
  }
}

.metric-grid--compact {
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
}

.metric-tile {
  display: grid;
  min-height: 108px;
  gap: 6px;
  overflow: hidden;
  padding: 12px 14px;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  border-left: 1px solid #e2e8f0;
  border-top: 4px solid #2563eb;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: transform 0.16s ease, box-shadow 0.16s ease;

  span,
  small {
    color: #64748b;
  }

  strong {
    color: #0f172a;
    font-size: 23px;
    line-height: 1.1;
  }

  em {
    color: #2563eb;
    font-size: 12px;
    font-style: normal;
    font-weight: 700;
  }

  &:hover {
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }
}

.metric-tile--success {
  border-top-color: #16a34a;
}

.metric-tile--warning {
  border-top-color: #f97316;
}

.metric-tile--refund {
  border-top-color: #ef4444;
}

.metric-tile--cost {
  border-top-color: #7c3aed;
}

.metric-tile--profit {
  border-top-color: #0f766e;
}

.metric-tile--muted {
  border-top-color: #94a3b8;

  em {
    color: #64748b;
  }
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr);
  align-items: start;
  gap: 12px;
}

.dashboard-grid--overview {
  grid-template-columns: minmax(0, 1.08fr) minmax(380px, 0.92fr);
}

.supply-bi-page--overview .panel--trend {
  order: 1;
}

.supply-bi-page--overview .panel--city-ranking {
  order: 2;
}

.supply-bi-page--overview .payment-risk-panel {
  order: 3;
}

.supply-bi-page--overview .target-completion-panel {
  order: 4;
}

.supply-bi-page--overview .inventory-operation-panel {
  order: 5;
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

.bi-chart--product-share {
  height: 320px;
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
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

.product-chart-grid--with-pie {
  grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
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

.overview-city-board {
  display: grid;
  gap: 8px;
}

.overview-city-board--full {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.supply-bi-page--city-operating .overview-city-board--full,
.supply-bi-page--sales-collection .overview-city-board--full {
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
}

.overview-city-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) minmax(86px, auto);
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }
}

.overview-city-row__main,
.overview-city-row__title,
.overview-city-row__rate {
  display: grid;
  min-width: 0;
}

.overview-city-row__main {
  gap: 7px;
}

.overview-city-row__title {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 10px;

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: #64748b;
    font-size: 12px;
    white-space: nowrap;
  }
}

.overview-city-row__bars {
  display: grid;
  gap: 6px;

  span {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 82px;
    align-items: center;
    gap: 8px;
  }

  em {
    color: #64748b;
    font-size: 12px;
    font-style: normal;
  }

  i {
    display: block;
    height: 7px;
    overflow: hidden;
    border-radius: 999px;
    background: #e7edf5;
  }

  b {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #2563eb, #1d4ed8);
  }

  strong {
    color: #0f172a;
    font-size: 13px;
    text-align: right;
    white-space: nowrap;
  }
}

.overview-city-row__paid b {
  background: linear-gradient(90deg, #16a34a, #0f766e);
}

.overview-city-row__rate {
  justify-items: end;
  gap: 3px;

  span {
    color: #64748b;
    font-size: 12px;
  }

  strong {
    color: #0f766e;
    font-size: 16px;
  }
}

.overview-city-row__rate--warning strong {
  color: #c2410c;
}

.overview-city-row__rate--danger strong {
  color: #dc2626;
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

.payment-risk-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.payment-risk-layout--overview {
  grid-template-columns: minmax(0, 1fr);
}

.risk-ranking-block {
  min-width: 0;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fbfdff;
}

.subsection-head {
  display: flex;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;

  strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 14px;
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
.metric-tile,
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
.overview-command-head strong,
.subsection-head strong {
  color: var(--bi-label);
}

.bi-filter-title span,
.bi-filter-meta,
.quick-period-bar > span,
.product-inventory-mode-bar span,
.panel-head p,
.overview-command-head small,
.subsection-head small,
.product-sales-coverage-row,
.ranking-row__main small,
.ranking-row__amount small,
.target-completion-row__city span,
.target-metric span,
.activity-card span,
.activity-card small,
.inventory-operation-row__head small,
.inventory-operation-row__track span,
.overview-city-row__title small,
.overview-city-row__rate span,
.overview-city-row__bars em {
  color: var(--bi-muted);
}

.overview-command-head span,
.panel-head .el-icon,
.metric-tile em,
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
.product-inventory-mode-bar :deep(.el-radio-button__inner) {
  border-color: #cbd5e1;
  background: #fff;
  color: var(--bi-muted);
}

.quick-period-bar :deep(.el-radio-button.is-active .el-radio-button__inner),
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

.overview-lead-grid {
  gap: 12px;
}

.overview-support-grid {
  gap: 10px;
}

.overview-lead-card,
.overview-support-card,
.metric-tile {
  position: relative;
  border-color: var(--bi-border);
  border-top-color: var(--tile-accent);
  background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
  color: var(--bi-text);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.04);
}

.overview-lead-card[class*="metric-tile--"],
.overview-support-card[class*="metric-tile--"] {
  border-color: var(--bi-border);
  border-top-color: var(--tile-accent);
  background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
}

.overview-lead-card::after,
.overview-support-card::after,
.metric-tile::after {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 34%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--tile-accent));
  opacity: 0.2;
  content: '';
}

.metric-tile--primary {
  --tile-accent: var(--bi-primary);
}

.metric-tile--success {
  --tile-accent: var(--bi-success);
}

.metric-tile--warning {
  --tile-accent: var(--bi-warning);
}

.metric-tile--refund {
  --tile-accent: var(--bi-danger);
}

.metric-tile--cost {
  --tile-accent: var(--bi-cost);
}

.metric-tile--profit {
  --tile-accent: var(--bi-profit);
}

.metric-tile--muted {
  --tile-accent: var(--bi-muted);
}

.overview-lead-card[class*="metric-tile--"] span,
.overview-lead-card[class*="metric-tile--"] small,
.overview-support-card[class*="metric-tile--"] span,
.overview-support-card[class*="metric-tile--"] small,
.metric-tile span,
.metric-tile small,
.inventory-operation-summary span,
.inventory-operation-summary small,
.gross-profit-summary-strip span,
.product-sales-summary-strip span,
.payment-risk-summary-strip span,
.city-cost-summary span,
.analysis-insight-strip span,
.analysis-insight-strip small,
.risk-summary-strip span {
  color: var(--bi-muted);
}

.overview-lead-card[class*="metric-tile--"] strong,
.overview-support-card[class*="metric-tile--"] strong,
.metric-tile strong,
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
.ranking-row__amount strong,
.overview-city-row__title strong,
.overview-city-row__bars strong {
  color: var(--bi-label);
}

.overview-lead-card[class*="metric-tile--"] strong {
  text-shadow: none;
}

.dashboard-grid--overview {
  grid-template-columns: minmax(0, 1.16fr) minmax(360px, 0.84fr);
}

.supply-bi-page--overview .target-completion-panel,
.supply-bi-page--overview .inventory-operation-panel {
  grid-column: auto;
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
.ranking-block,
.risk-ranking-block,
.overview-city-row,
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
.inventory-operation-row:hover,
.overview-city-row:hover {
  border-color: #93c5fd;
  background: #f8fbff;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
}

.inventory-operation-row__metrics span {
  background: var(--bi-panel-soft);
}

.inventory-operation-row__track div,
.overview-city-row__bars i,
.ranking-row__meter,
.target-metric em,
:deep(.trend-row__bar) {
  background: #e7edf5;
}

.overview-city-row__bars b,
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

.overview-city-row__rate strong {
  color: var(--bi-success);
}

.overview-city-row__rate--warning strong {
  color: var(--bi-warning);
}

.overview-city-row__rate--danger strong,
.is-over-budget,
.is-negative {
  color: var(--bi-danger);
}

.product-sales-bars {
  border-bottom-color: var(--bi-border-soft);
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
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid,
  .product-sales-layout,
  .product-chart-grid--with-pie,
  .dual-ranking-layout,
  .payment-risk-layout,
  .target-completion-row,
  .activity-layout,
  .overview-cockpit-main,
  .overview-drill-grid,
  .overview-lead-grid,
  .overview-support-grid,
  .analysis-insight-strip,
  .overview-city-board--full {
    grid-template-columns: 1fr;
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

  .overview-command-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .overview-cockpit-copy strong {
    white-space: normal;
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

  .overview-command-head small {
    white-space: normal;
  }

  .filter-panel :deep(.bi-filter-item--date) {
    grid-column: span 1;
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

  .metric-grid,
  .city-ranking-stats,
  .city-cost-summary,
  .risk-summary-strip,
  .gross-profit-summary-strip,
  .product-sales-summary-strip,
  .payment-risk-summary-strip {
    grid-template-columns: 1fr;
  }
}
</style>
