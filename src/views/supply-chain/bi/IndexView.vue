<template>
  <div class="supply-bi-page supply-page">
    <section class="filter-panel">
      <div class="bi-filter-head">
        <strong>{{ dashboardTitle }}</strong>
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
          />
        </el-form-item>
        <el-form-item label="城市">
          <el-select v-model="filters.regionCode" filterable clearable placeholder="全部城市" style="width: 160px">
            <el-option
              v-for="option in filterOptions.regions"
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
      <div class="overview-command-head">
        <div>
          <span>经营扫描</span>
          <strong>{{ rangeLabel }}</strong>
          <small>以内部订单、回款、ERP 商品和库存快照为准，订货宝/飞书只作为展示参考</small>
        </div>
        <el-radio-group v-model="quickPeriod" size="small" @change="applyQuickPeriod">
          <el-radio-button value="today">今日</el-radio-button>
          <el-radio-button value="month">本月</el-radio-button>
          <el-radio-button value="year">本年</el-radio-button>
        </el-radio-group>
      </div>
      <div class="overview-lead-grid">
        <button
          v-for="metric in overviewLeadMetrics"
          :key="metric.metricCode"
          class="overview-lead-card"
          :class="metricClass(metric.metricCode)"
          type="button"
          @click="openMetric(metric.metricCode)"
        >
          <span>{{ displayMetricName(metric) }}</span>
          <strong>{{ formatMetric(metric) }}</strong>
          <small>{{ metricDescription(metric) }}</small>
        </button>
      </div>
      <div class="overview-support-grid">
        <button
          v-for="metric in overviewSupportMetrics"
          :key="metric.metricCode"
          class="overview-support-card"
          :class="metricClass(metric.metricCode)"
          type="button"
          @click="openMetric(metric.metricCode)"
        >
          <span>{{ displayMetricName(metric) }}</span>
          <strong>{{ formatMetric(metric) }}</strong>
          <small>{{ metricActionLabel(metric.metricCode) }}</small>
        </button>
      </div>
    </section>

    <section
      v-else
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

    <section class="dashboard-grid" :class="{ 'dashboard-grid--single': dashboardSection !== 'overview' }">
      <div v-if="showSalesCollectionSection" class="panel panel--wide">
        <div class="panel-head">
          <div>
            <h2>销售与回款趋势</h2>
            <p>{{ rangeLabel }}</p>
          </div>
          <el-icon><TrendCharts /></el-icon>
        </div>
        <EchartsChart
          v-if="hasSalesCollectionTrend"
          class="bi-chart bi-chart--trend"
          :option="salesCollectionChartOption"
          :height="260"
          :loading="loading"
          @chart-click="handleTrendChartClick"
        />
        <div v-else class="empty-inline">暂无销售与回款趋势数据</div>
      </div>

      <div v-if="showCityRankingSection" class="panel">
        <div class="panel-head">
          <div>
            <h2>城市交易/已收汇总</h2>
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
              <span>城市已收</span>
              <strong>{{ formatMoneyWan(cityPaidTotal) }}</strong>
            </div>
            <div>
              <span>整体回款率</span>
              <strong>{{ formatPercent(cityOverallPaidRate) }}</strong>
            </div>
          </div>
          <EchartsChart
            class="bi-chart bi-chart--city"
            :option="cityCompareChartOption"
            :height="240"
            :loading="loading"
            @chart-click="handleCityCompareChartClick"
          />
        </div>
        <div v-if="citySalesRanking.length" class="dual-ranking-layout">
          <div class="ranking-block">
            <div class="subsection-head">
              <strong>交易额排名</strong>
              <small>订单数、客户数辅助参考</small>
            </div>
            <div class="ranking-list">
              <button
                v-for="(item, index) in cityRankingPreview"
                :key="`city-sales-${item.dimensionCode}`"
                class="ranking-row"
                type="button"
                @click="selectCityRankingItem(item)"
              >
                <span class="ranking-row__index" :class="rankingIndexClass(index)">{{ index + 1 }}</span>
                <div class="ranking-row__main">
                  <strong>{{ item.dimensionName || item.dimensionCode }}</strong>
                  <small>{{ formatNumber(item.orderCount) }} 单 · {{ formatNumber(item.customerCount) }} 客户</small>
                  <span class="ranking-row__meter">
                    <i :style="{ width: `${rankingBarWidthBy(item, citySalesRanking, 'salesAmount')}%` }" />
                  </span>
                </div>
                <div class="ranking-row__amount">
                  <strong>{{ formatMoneyWan(item.salesAmount) }}</strong>
                  <small>回款率 {{ formatPercent(item.rate) }}</small>
                </div>
              </button>
            </div>
          </div>
          <div class="ranking-block">
            <div class="subsection-head">
              <strong>已收金额排名</strong>
              <small>按销售订单已收金额</small>
            </div>
            <div class="ranking-list">
              <button
                v-for="(item, index) in cityPaidRankingPreview"
                :key="`city-paid-${item.dimensionCode}`"
                class="ranking-row"
                type="button"
                @click="selectCityRankingItem(item)"
              >
                <span class="ranking-row__index" :class="rankingIndexClass(index)">{{ index + 1 }}</span>
                <div class="ranking-row__main">
                  <strong>{{ item.dimensionName || item.dimensionCode }}</strong>
                  <small>{{ formatNumber(item.orderCount) }} 单 · 待回款 {{ formatMoneyWan(item.unpaidAmount) }}</small>
                  <span class="ranking-row__meter ranking-row__meter--paid">
                    <i :style="{ width: `${rankingBarWidthBy(item, cityPaidRanking, 'paidAmount')}%` }" />
                  </span>
                </div>
                <div class="ranking-row__amount">
                  <strong>{{ formatMoneyWan(item.paidAmount) }}</strong>
                  <small>交易额 {{ formatMoneyWan(item.salesAmount) }}</small>
                </div>
              </button>
            </div>
          </div>
          <div v-if="isOverviewSection && citySalesRanking.length > cityRankingPreview.length" class="ranking-footer">
            <el-button link type="primary" @click="openDashboardSection('sales-collection')">查看完整城市排行</el-button>
          </div>
        </div>
        <div v-else class="empty-inline">暂无城市交易汇总数据</div>
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
        <div v-else-if="dashboardSection === 'product-sales'" class="product-sales-summary-strip">
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
            <span>覆盖订单</span>
            <strong>{{ formatNumber(productSummaryOrderCount) }}</strong>
          </div>
          <div>
            <span>覆盖客户</span>
            <strong>{{ formatNumber(productSummaryCustomerCount) }}</strong>
          </div>
        </div>
        <div
          v-if="dashboardSection === 'product-sales' || isGrossProfitSection"
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
          v-if="dashboardSection === 'product-sales' && productBreakdown === 'PRODUCT'"
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
            'product-sales-layout--report': dashboardSection === 'product-sales' || isGrossProfitSection,
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
            <el-table-column label="涉及订单" width="100" align="right">
              <template #default="scope">{{ formatNumber(scope.row.orderCount) }}</template>
            </el-table-column>
            <el-table-column label="涉及客户" width="100" align="right">
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
          <el-button link type="primary" @click="openDashboardSection('product-sales')">查看完整商品分析</el-button>
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
            <p>左侧按交易额，右侧按订单已收金额；明细只在本子看板展示</p>
          </div>
          <el-icon><DataAnalysis /></el-icon>
        </div>
        <div v-if="salesRanking.length" class="dual-ranking-layout">
          <div class="ranking-block">
            <div class="subsection-head">
              <strong>销售额排名</strong>
              <small>按交易额倒序</small>
            </div>
            <div class="ranking-list">
              <button
                v-for="(item, index) in salesRankingPreview"
                :key="`sales-owner-amount-${item.dimensionCode}`"
                class="ranking-row"
                type="button"
                @click="selectSalesRankingItem(item)"
              >
                <span class="ranking-row__index" :class="rankingIndexClass(index)">{{ index + 1 }}</span>
                <div class="ranking-row__main">
                  <strong>{{ item.dimensionName || item.dimensionCode }}</strong>
                  <small>{{ formatNumber(item.orderCount) }} 单 · {{ formatNumber(item.customerCount) }} 客户</small>
                  <span class="ranking-row__meter">
                    <i :style="{ width: `${rankingBarWidthBy(item, salesRanking, 'salesAmount')}%` }" />
                  </span>
                </div>
                <div class="ranking-row__amount">
                  <strong>{{ formatMoneyWan(item.salesAmount) }}</strong>
                  <small>回款率 {{ formatPercent(item.rate) }}</small>
                </div>
              </button>
            </div>
          </div>
          <div class="ranking-block">
            <div class="subsection-head">
              <strong>已收金额排名</strong>
              <small>按订单已收金额倒序</small>
            </div>
            <div class="ranking-list">
              <button
                v-for="(item, index) in salesPaidRankingPreview"
                :key="`sales-owner-paid-${item.dimensionCode}`"
                class="ranking-row"
                type="button"
                @click="selectSalesRankingItem(item)"
              >
                <span class="ranking-row__index" :class="rankingIndexClass(index)">{{ index + 1 }}</span>
                <div class="ranking-row__main">
                  <strong>{{ item.dimensionName || item.dimensionCode }}</strong>
                  <small>{{ formatNumber(item.orderCount) }} 单 · 待回款 {{ formatMoneyWan(item.unpaidAmount) }}</small>
                  <span class="ranking-row__meter ranking-row__meter--paid">
                    <i :style="{ width: `${rankingBarWidthBy(item, salesPaidRanking, 'paidAmount')}%` }" />
                  </span>
                </div>
                <div class="ranking-row__amount">
                  <strong>{{ formatMoneyWan(item.paidAmount) }}</strong>
                  <small>交易额 {{ formatMoneyWan(item.salesAmount) }}</small>
                </div>
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-inline">暂无销售人员排行数据</div>
      </div>

      <div v-if="showPaymentRiskSection" class="panel panel--wide payment-risk-panel">
        <div class="panel-head">
          <div>
            <h2>回款风险</h2>
            <p>按待回款金额、涉及客户和逾期天数识别跟进优先级</p>
          </div>
          <el-icon><Warning /></el-icon>
        </div>
        <div class="payment-risk-summary-strip">
          <div>
            <span>待回款总额</span>
            <strong>{{ formatMoneyWan(paymentRiskAmountMetric?.value) }}</strong>
          </div>
          <div>
            <span>风险门店</span>
            <strong>{{ formatNumber(paymentRiskCustomerMetric?.value) }}</strong>
          </div>
          <div>
            <span>高风险门店</span>
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
        <EchartsChart
          v-if="showPaymentRiskChart"
          class="bi-chart bi-chart--risk"
          :option="paymentRiskChartOption"
          :height="paymentRiskChartHeight"
          :loading="loading"
          @chart-click="handlePaymentRiskChartClick"
        />
        <div class="payment-risk-layout" :class="{ 'payment-risk-layout--overview': isOverviewSection }">
          <div class="risk-ranking-block">
            <div class="subsection-head">
              <strong>城市风险排行</strong>
              <el-button v-if="isOverviewSection" link type="primary" @click="openDashboardSection('payment-risk')">
                查看完整
              </el-button>
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
                  <small>占比 {{ formatPercent(item.rate) }}</small>
                </div>
              </button>
            </div>
            <div v-else class="empty-inline">暂无城市回款风险</div>
          </div>
          <div v-if="!isOverviewSection" class="risk-ranking-block">
            <div class="subsection-head">
              <strong>销售风险排行</strong>
              <el-button v-if="isOverviewSection" link type="primary" @click="openDashboardSection('payment-risk')">
                查看完整
              </el-button>
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
                  <small>{{ formatNumber(item.customerCount) }} 客户 · {{ formatNumber(item.orderCount) }} 单</small>
                  <span class="ranking-row__meter ranking-row__meter--risk">
                    <i :style="{ width: `${paymentRiskBarWidth(item, paymentRiskSalesRanking)}%` }" />
                  </span>
                </div>
                <div class="ranking-row__amount">
                  <strong>{{ formatMoneyWan(item.unpaidAmount) }}</strong>
                  <small>占比 {{ formatPercent(item.rate) }}</small>
                </div>
              </button>
            </div>
            <div v-else class="empty-inline">暂无销售回款风险</div>
          </div>
        </div>
        <div v-if="isOverviewSection" class="overview-risk-list">
          <div class="subsection-head">
            <strong>库存异常明细</strong>
            <el-button link type="primary" @click="openDashboardSection('inventory-risk')">查看库存风险</el-button>
          </div>
          <el-table class="supply-scroll-table" :data="overviewRiskRows" size="small" max-height="220" @row-click="openRisk">
            <el-table-column prop="riskLevel" label="等级" width="80">
              <template #default="scope">
                <el-tag :type="riskTagType(scope.row.riskLevel)" effect="light">{{ riskLabel(scope.row.riskLevel) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="dimensionName" label="风险对象" min-width="220" show-overflow-tooltip />
            <el-table-column prop="description" label="说明" min-width="160" show-overflow-tooltip />
            <el-table-column label="可用" width="100" align="right">
              <template #default="scope">{{ formatNumber(scope.row.primaryValue) }}</template>
            </el-table-column>
            <el-table-column label="锁定" width="100" align="right">
              <template #default="scope">{{ formatNumber(scope.row.secondaryValue) }}</template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无库存异常" />
            </template>
          </el-table>
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
  type SupplyDashboardProductSalesItem,
  type SupplyDashboardRankingItem,
  type SupplyDashboardRiskItem,
  type SupplyDashboardTrendPoint,
} from '@/api/core/bi'
import { useAuthStore } from '@/stores/auth'
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

interface CityCompareChartData {
  regionCode?: string
}

interface PaymentRiskChartData {
  regionCode?: string
  ownerStaffCode?: string
  dimensionCode?: string
}

interface InventoryRiskChartData {
  riskLevel?: string
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
  dateRange: currentMonthRange(),
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
type QuickPeriod = 'today' | 'month' | 'year'
type RankingAmountField = 'salesAmount' | 'paidAmount' | 'unpaidAmount'
type PaymentRiskChartDimension = 'CITY' | 'SALES'
const productBreakdown = ref<ProductBreakdown>('PRODUCT')
const productSalesVisibility = ref<ProductSalesVisibility>('SOLD_ONLY')
const quickPeriod = ref<QuickPeriod>('month')
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
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

type DashboardSection = 'overview' | 'sales-collection' | 'product-sales' | 'gross-profit' | 'payment-risk' | 'city-cost' | 'inventory-risk'

const dashboardSections: Record<DashboardSection, { title: string; description: string; metricCodes: string[] }> = {
  overview: {
    title: '供应链经营总览',
    description: '面向管理层快速扫描交易、回款、退款、城市汇总和风险异常。',
    metricCodes: ['sales_amount', 'receipt_amount', 'refund_amount', 'unpaid_amount', 'order_count', 'estimated_gross_profit_rate', 'inventory_risk_count'],
  },
  'sales-collection': {
    title: '销售与回款看板',
    description: '查看销售额、订单已收、待回款和回款记录，支持按城市、销售、客户类型和来源筛选。',
    metricCodes: ['sales_amount', 'paid_amount', 'unpaid_amount', 'receipt_amount', 'order_count'],
  },
  'product-sales': {
    title: '商品销售统计',
    description: '使用自研订单行事实表，支持按商品、分类或品牌查看订货数量、金额和客户覆盖。',
    metricCodes: ['sales_amount', 'order_count', 'ordering_customer_count'],
  },
  'gross-profit': {
    title: '销售毛利分析',
    description: '按商品、分类或品牌查看销售净收入、估算销售成本、估算毛利和成本覆盖率。',
    metricCodes: ['sales_net_amount', 'refund_amount', 'estimated_cost_amount', 'estimated_gross_profit', 'estimated_gross_profit_rate', 'cost_coverage_rate'],
  },
  'payment-risk': {
    title: '回款风险看板',
    description: '按待回款金额、风险客户和逾期天数识别城市与销售跟进优先级。',
    metricCodes: ['unpaid_amount', 'payment_risk_amount', 'payment_risk_customer_count', 'payment_high_risk_customer_count', 'payment_avg_overdue_days', 'payment_risk_amount_rate'],
  },
  'city-cost': {
    title: '城市成本看板',
    description: '聚焦城市端成本、预算偏差和销售成本率，优先展示超预算和成本率偏高的城市。',
    metricCodes: ['city_cost_amount', 'city_cost_rate', 'sales_amount'],
  },
  'inventory-risk': {
    title: '库存风险看板',
    description: '聚焦可用库存不足和锁定量异常的重点库存项，辅助运营优先处理。',
    metricCodes: ['inventory_risk_count'],
  },
}

const dashboardRouteNames: Record<DashboardSection, string> = {
  overview: 'SupplyBi',
  'sales-collection': 'SupplyBiSalesCollection',
  'product-sales': 'SupplyBiProductSales',
  'gross-profit': 'SupplyBiGrossProfit',
  'payment-risk': 'SupplyBiPaymentRisk',
  'city-cost': 'SupplyBiCityCost',
  'inventory-risk': 'SupplyBiInventoryRisk',
}

const metricOrder = [
  'sales_amount',
  'receipt_amount',
  'refund_amount',
  'paid_amount',
  'unpaid_amount',
  'order_count',
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
const orderedMetrics = computed(() => {
  const metrics = overview.value?.metrics || []
  return [...metrics].sort((left, right) => metricRank(left.metricCode) - metricRank(right.metricCode))
})
const visibleMetrics = computed(() => {
  const codes = new Set(dashboardSections[dashboardSection.value].metricCodes)
  return orderedMetrics.value.filter((metric) => codes.has(metric.metricCode))
})
const overviewLeadMetrics = computed(() => visibleMetrics.value.filter((metric) =>
  ['sales_amount', 'receipt_amount', 'refund_amount'].includes(metric.metricCode),
))
const overviewSupportMetrics = computed(() => visibleMetrics.value.filter((metric) =>
  ['unpaid_amount', 'order_count', 'estimated_gross_profit_rate', 'inventory_risk_count'].includes(metric.metricCode),
))
const isOverviewSection = computed(() => dashboardSection.value === 'overview')
const isGrossProfitSection = computed(() => dashboardSection.value === 'gross-profit')
const rankingPreviewLimit = computed(() => isOverviewSection.value ? 6 : Number.MAX_SAFE_INTEGER)
const showSalesCollectionSection = computed(() => dashboardSection.value === 'overview' || dashboardSection.value === 'sales-collection')
const showCityRankingSection = computed(() => dashboardSection.value === 'overview' || dashboardSection.value === 'sales-collection')
const showSalesRankingSection = computed(() => dashboardSection.value === 'sales-collection')
const showProductSalesSection = computed(() =>
  dashboardSection.value === 'product-sales' || isGrossProfitSection.value,
)
const showPaymentRiskSection = computed(() => dashboardSection.value === 'overview' || dashboardSection.value === 'payment-risk')
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
const paymentRiskAmountMetric = computed(() => metricByCode('payment_risk_amount'))
const paymentRiskCustomerMetric = computed(() => metricByCode('payment_risk_customer_count'))
const paymentHighRiskCustomerMetric = computed(() => metricByCode('payment_high_risk_customer_count'))
const paymentAvgOverdueMetric = computed(() => metricByCode('payment_avg_overdue_days'))
const paymentRiskAmountRateMetric = computed(() => metricByCode('payment_risk_amount_rate'))
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
  : '默认展示本期有销售商品；可售商品来自 ERP 已上架、已提交商品池')
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
  (dashboardSection.value === 'product-sales' || (isGrossProfitSection.value && grossProfitCostCovered.value))
  && displayedProductSales.value.length > 0,
)
const showProductSharePieChart = computed(() =>
  dashboardSection.value === 'product-sales'
  && productBreakdown.value !== 'PRODUCT'
  && analysisProductSales.value.length > 1,
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
const cityPaidRanking = computed(() => sortRankingBy(citySalesRanking.value, 'paidAmount'))
const salesPaidRanking = computed(() => sortRankingBy(salesRanking.value, 'paidAmount'))
const cityRankingPreview = computed(() => citySalesRanking.value.slice(0, rankingPreviewLimit.value))
const cityPaidRankingPreview = computed(() => cityPaidRanking.value.slice(0, rankingPreviewLimit.value))
const salesRankingPreview = computed(() => salesRanking.value.slice(0, rankingPreviewLimit.value))
const salesPaidRankingPreview = computed(() => salesPaidRanking.value.slice(0, rankingPreviewLimit.value))
const citySalesCityCount = computed(() => citySalesRanking.value.length)
const citySalesTotal = computed(() => citySalesRanking.value.reduce((total, item) => total + Number(item.salesAmount || 0), 0))
const cityPaidTotal = computed(() => citySalesRanking.value.reduce((total, item) => total + Number(item.paidAmount || 0), 0))
const cityOverallPaidRate = computed(() => citySalesTotal.value ? cityPaidTotal.value / citySalesTotal.value * 100 : 0)
const paymentRiskCityRanking = computed<SupplyDashboardRankingItem[]>(() =>
  (overview.value?.paymentRiskCityRanking || []).map((item) => ({
    ...item,
    dimensionName: regionName(item.dimensionCode, item.dimensionName),
  })),
)
const paymentRiskSalesRanking = computed<SupplyDashboardRankingItem[]>(() => overview.value?.paymentRiskSalesRanking || [])
const paymentRiskPreviewLimit = computed(() => isOverviewSection.value ? 5 : 10)
const paymentRiskCityPreview = computed(() => paymentRiskCityRanking.value.slice(0, paymentRiskPreviewLimit.value))
const paymentRiskSalesPreview = computed(() => paymentRiskSalesRanking.value.slice(0, paymentRiskPreviewLimit.value))
const paymentRiskChartDimension = computed<PaymentRiskChartDimension>(() =>
  paymentRiskCityRanking.value.length ? 'CITY' : 'SALES',
)
const paymentRiskChartRows = computed(() =>
  (paymentRiskChartDimension.value === 'CITY' ? paymentRiskCityRanking.value : paymentRiskSalesRanking.value).slice(0, 10),
)
const showPaymentRiskChart = computed(() => dashboardSection.value === 'payment-risk' && paymentRiskChartRows.value.length > 0)
const paymentRiskChartHeight = computed(() =>
  Math.max(220, Math.min(360, 80 + paymentRiskChartRows.value.length * 28)),
)
const sourceSystemBreakdown = computed<SupplyDashboardRankingItem[]>(() =>
  (overview.value?.sourceSystemBreakdown || []).map((item) => ({
    ...item,
    dimensionName: sourceSystemName(item.dimensionCode, item.dimensionName),
  })),
)
const showSourceSystemSection = computed(() =>
  showSalesCollectionSection.value && (!isOverviewSection.value || sourceSystemBreakdown.value.length > 0),
)
const cityCostTrendRows = computed(() => overview.value?.cityCostTrend || [])
const riskRows = computed<SupplyDashboardRiskItem[]>(() =>
  [...(overview.value?.risks || [])].sort((left, right) => {
    const riskDiff = riskLevelRank(left.riskLevel) - riskLevelRank(right.riskLevel)
    if (riskDiff !== 0) return riskDiff
    return Number(left.primaryValue || 0) - Number(right.primaryValue || 0)
  }),
)
const overviewRiskRows = computed(() => riskRows.value.slice(0, 6))
const highRiskCount = computed(() => riskRows.value.filter((item) => item.riskLevel === 'HIGH').length)
const negativeInventoryTotal = computed(() =>
  riskRows.value.reduce((total, item) => {
    const value = Number(item.primaryValue || 0)
    return value < 0 ? total + Math.abs(value) : total
  }, 0),
)
const riskWarehouseCount = computed(() => new Set(riskRows.value.map((item) => riskWarehouseName(item)).filter(Boolean)).size)
const showInventoryRiskChart = computed(() => dashboardSection.value === 'inventory-risk' && riskRows.value.length > 0)
const hasSalesCollectionTrend = computed(() =>
  Boolean((overview.value?.salesTrend || []).length || (overview.value?.collectionTrend || []).length),
)
const salesCollectionChartOption = computed<EChartsCoreOption>(() =>
  buildSalesCollectionChartOption(overview.value?.salesTrend || [], overview.value?.collectionTrend || []),
)
const cityCompareChartOption = computed<EChartsCoreOption>(() => buildCityCompareChartOption(citySalesRanking.value.slice(0, 8)))
const sourceSystemPieOption = computed<EChartsCoreOption>(() => buildSourceSystemPieOption(sourceSystemBreakdown.value))
const productSalesChartOption = computed<EChartsCoreOption>(() =>
  buildProductSalesChartOption(analysisProductSales.value, productBreakdown.value, isGrossProfitSection.value),
)
const productSharePieOption = computed<EChartsCoreOption>(() =>
  buildProductSharePieOption(analysisProductSales.value, productBreakdown.value),
)
const paymentRiskChartOption = computed<EChartsCoreOption>(() =>
  buildPaymentRiskChartOption(paymentRiskChartRows.value, paymentRiskChartDimension.value),
)
const inventoryRiskChartOption = computed<EChartsCoreOption>(() => buildInventoryRiskChartOption(riskRows.value))
const cityCostChartOption = computed<EChartsCoreOption>(() => buildCityCostChartOption(cityCostTrendRows.value))
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
const rangeLabel = computed(() => {
  if (!overview.value) return '按当前筛选范围'
  return `${formatDate(overview.value.from)} 至 ${formatDate(overview.value.to)}`
})

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''
  try {
    const query = buildQuery()
    overview.value = await getSupplyDashboardOverview(query)
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
      getCrmCustomerAreas({ begin: 0, step: 500 }),
      getCrmCustomerTypes({ begin: 0, step: 500 }),
    ])
    crmAreas.value = areaResult.items
    crmCustomerTypes.value = typeResult.items
  } catch {
    crmAreas.value = []
    crmCustomerTypes.value = []
  }
}

function resetFilters() {
  quickPeriod.value = 'month'
  filters.dateRange = currentMonthRange()
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
  if (period === 'today') filters.dateRange = todayRange()
  if (period === 'month') filters.dateRange = currentMonthRange()
  if (period === 'year') filters.dateRange = currentYearRange()
  void loadDashboard()
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
  const query: Record<string, string | number> = {}
  const [from, to] = filters.dateRange
  if (from) query.from = new Date(`${from}T00:00:00+08:00`).toISOString()
  if (to) query.to = new Date(`${to}T23:59:59+08:00`).toISOString()
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
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return [dateValue(start), dateValue(now)]
}

function todayRange() {
  const now = new Date()
  return [dateValue(now), dateValue(now)]
}

function currentYearRange() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  return [dateValue(start), dateValue(now)]
}

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10)
}

function formatMetric(metric: SupplyDashboardMetricCard) {
  if (metric.metricCode === 'target_achievement_rate') return '待接入'
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
  if (!isOverviewSection.value) return metric.metricName
  const names: Record<string, string> = {
    sales_amount: '总交易额',
    receipt_amount: '总回款额',
    refund_amount: '退款额',
    unpaid_amount: '待回款',
    order_count: '订单数',
    estimated_gross_profit_rate: '估算毛利率',
    inventory_risk_count: '库存风险',
  }
  return names[metric.metricCode] || metric.metricName
}

function metricDescription(metric: SupplyDashboardMetricCard) {
  const descriptions: Record<string, string> = {
    sales_amount: '当前筛选范围内订单应收金额',
    paid_amount: '订单已确认收款金额',
    unpaid_amount: '需要继续跟进的未收金额',
    receipt_amount: '实际回款记录金额',
    refund_amount: '订单级退款按订单行金额分摊',
    order_count: '当前筛选范围内订单数量',
    ordering_customer_count: '当前筛选范围内有下单客户',
    active_customer_count: 'CRM 当前有效客户',
    sales_net_amount: '销售额扣减订单级退款分摊',
    estimated_cost_amount: '订单行数量乘 ERP 采购参考价',
    estimated_gross_profit: '基于采购参考价估算',
    estimated_gross_profit_rate: '估算毛利占销售净收入比例',
    cost_coverage_rate: '有采购参考价的订单行金额占比',
    payment_risk_amount: '仍需跟进的待回款金额',
    payment_risk_customer_count: '存在待回款订单的客户/门店',
    payment_high_risk_customer_count: '逾期60天及以上的风险门店',
    payment_avg_overdue_days: '待回款订单平均逾期天数',
    payment_risk_amount_rate: '待回款金额占销售额比例',
    target_achievement_rate: '目标源尚未接入 BI',
    city_cost_amount: '已导入的城市运营成本',
    city_cost_rate: '城市运营成本占销售额比例',
    inventory_risk_count: '优先展示需要关注的库存项',
  }
  if (metric.metricCode === 'city_cost_rate' && !cityCostHasData.value) return '城市成本数据未导入'
  if (metric.metricCode === 'estimated_gross_profit_rate' && !grossProfitCostCovered.value) return '采购参考价未覆盖，暂不判断毛利'
  return descriptions[metric.metricCode] || metric.description || '点击查看明细'
}

function metricActionLabel(code: string) {
  if (code === 'target_achievement_rate') return '待接入目标'
  if (code === 'refund_amount') return '查看退款'
  if (code.includes('gross_profit') || code === 'cost_coverage_rate' || code === 'sales_net_amount' || code === 'estimated_cost_amount') return '查看毛利'
  if (code.startsWith('payment_risk') || code === 'payment_avg_overdue_days') return '查看风险'
  if (code === 'receipt_amount' || code === 'paid_amount') return '查看回款'
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
  if (code === 'target_achievement_rate') {
    ElMessage.info('目标分配尚未接入 BI 读模型')
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
    void router.push({ name: 'SupplyBiPaymentRisk' })
    return
  }
  if (code === 'receipt_amount' || code === 'paid_amount') {
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
  void router.push({ name: dashboardRouteNames[section] })
}

function handleTrendChartClick(params: unknown) {
  const period = chartDate(chartParams(params).name)
  if (!period) return
  filters.dateRange = [period, period]
  void loadDashboard()
}

function selectCityRankingItem(item: SupplyDashboardRankingItem) {
  if (!item || !item.dimensionCode || item.dimensionCode === 'UNKNOWN') return
  filters.regionCode = item.dimensionCode
  void loadDashboard()
}

function selectSalesRankingItem(item: SupplyDashboardRankingItem) {
  if (!item || !item.dimensionCode || item.dimensionCode === 'UNKNOWN') return
  filters.ownerStaffCode = item.dimensionCode
  void loadDashboard()
}

function handleSourceSystemChartClick(params: unknown) {
  const data = chartParams(params).data as SourceSystemPieData | undefined
  if (!data?.sourceSystemCode || data.sourceSystemCode === 'UNKNOWN') return
  filters.sourceSystemCode = data.sourceSystemCode
  void loadDashboard()
}

function handleCityCompareChartClick(params: unknown) {
  const data = chartParams(params).data as CityCompareChartData | undefined
  if (!data?.regionCode || data.regionCode === 'UNKNOWN') return
  filters.regionCode = data.regionCode
  void loadDashboard()
}

function handlePaymentRiskChartClick(params: unknown) {
  const data = chartParams(params).data as PaymentRiskChartData | undefined
  const regionCode = data?.regionCode
  const ownerStaffCode = data?.ownerStaffCode
  if (regionCode && regionCode !== 'UNKNOWN') {
    filters.regionCode = regionCode
  } else if (ownerStaffCode && ownerStaffCode !== 'UNKNOWN') {
    filters.ownerStaffCode = ownerStaffCode
  } else {
    return
  }
  void loadDashboard()
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

function chartDate(value?: string | number) {
  const text = String(value || '')
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
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
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
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

function rankingIndexClass(index: number) {
  if (index === 0) return 'ranking-row__index--first'
  if (index === 1) return 'ranking-row__index--second'
  if (index === 2) return 'ranking-row__index--third'
  return ''
}

function buildSalesCollectionChartOption(
  salesTrend: SupplyDashboardTrendPoint[],
  collectionTrend: SupplyDashboardTrendPoint[],
): EChartsCoreOption {
  const periods = trendPeriods(salesTrend, collectionTrend)
  const sales = trendMap(salesTrend)
  const collections = trendMap(collectionTrend)
  return {
    color: ['#2563eb', '#16a34a', '#f97316'],
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number | string) => formatMoneyWan(Number(value || 0)),
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: '#64748b' },
    },
    grid: { top: 42, right: 18, bottom: 24, left: 54, containLabel: true },
    xAxis: {
      type: 'category',
      data: periods,
      axisLabel: { formatter: (value: string) => value.slice(5), color: '#64748b' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: moneyAxisLabel, color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
    },
    dataZoom: chartDataZoom(periods.length),
    series: [
      {
        name: '销售额',
        type: 'bar',
        barMaxWidth: 20,
        data: periods.map((period) => Number(sales.get(period)?.value || 0)),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '订单已收',
        type: 'bar',
        barMaxWidth: 20,
        data: periods.map((period) => Number(sales.get(period)?.secondaryValue || 0)),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '实际回款',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3 },
        data: periods.map((period) => Number(collections.get(period)?.value || 0)),
      },
    ],
  }
}

function buildCityCompareChartOption(items: SupplyDashboardRankingItem[]): EChartsCoreOption {
  const rows = items.slice().reverse()
  return {
    color: ['#2563eb', '#16a34a'],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ name?: string; data?: SupplyDashboardRankingItem & { value?: number }; seriesName?: string; value?: number }>) => {
        const first = params[0]?.data
        return [
          params[0]?.name || '城市',
          `交易额：${formatMoneyWan(first?.salesAmount)}`,
          `已收额：${formatMoneyWan(first?.paidAmount)}`,
          `待回款：${formatMoneyWan(first?.unpaidAmount)}`,
          `订单数：${formatNumber(first?.orderCount)}`,
          `客户数：${formatNumber(first?.customerCount)}`,
          `回款率：${formatPercent(first?.rate)}`,
        ].join('<br/>')
      },
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: '#64748b' },
    },
    grid: { top: 36, right: 28, bottom: 18, left: 10, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: moneyAxisLabel, color: '#64748b' },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map((item) => item.dimensionName || item.dimensionCode),
      axisLabel: { color: '#64748b', width: 90, overflow: 'truncate' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    series: [
      {
        name: '交易额',
        type: 'bar',
        barMaxWidth: 14,
        data: rows.map((item) => ({
          ...item,
          value: Number(item.salesAmount || 0),
          regionCode: item.dimensionCode,
        })),
        itemStyle: { borderRadius: [0, 5, 5, 0] },
      },
      {
        name: '已收额',
        type: 'bar',
        barMaxWidth: 14,
        data: rows.map((item) => ({
          ...item,
          value: Number(item.paidAmount || 0),
          regionCode: item.dimensionCode,
        })),
        itemStyle: { borderRadius: [0, 5, 5, 0] },
      },
    ],
  }
}

function buildSourceSystemPieOption(items: SupplyDashboardRankingItem[]): EChartsCoreOption {
  return {
    color: ['#2563eb', '#16a34a', '#f97316', '#7c3aed', '#0f766e'],
    tooltip: {
      trigger: 'item',
      formatter: (params: PieTooltipParam) => {
        const data = params.data || {}
        return [
          params.name || '来源',
          `销售额：${formatMoneyWan(params.value)}`,
          `占比：${formatNumber(params.percent)}%`,
          `涉及订单：${formatNumber(data.orderCount)}`,
          `涉及客户：${formatNumber(data.customerCount)}`,
          `回款率：${formatPercent(data.rate)}`,
        ].join('<br/>')
      },
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: '#64748b' },
    },
    series: [
      {
        name: '销售来源',
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b}\n{d}%', color: '#334155' },
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
    color: ['#2563eb', '#16a34a', '#f97316', '#7c3aed', '#0f766e', '#0ea5e9', '#e11d48', '#64748b'],
    tooltip: {
      trigger: 'item',
      formatter: (params: PieTooltipParam) => {
        const data = params.data || {}
        return [
          params.name || dimensionLabel,
          `订货金额：${formatMoneyWan(data.salesAmount)}`,
          `占比：${formatNumber(params.percent)}%`,
          `订货数量：${formatNumber(data.salesQuantity)}`,
          `涉及订单：${formatNumber(data.orderCount)}`,
          `涉及客户：${formatNumber(data.customerCount)}`,
        ].join('<br/>')
      },
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: '#64748b' },
    },
    series: [
      {
        name: `${dimensionLabel}占比`,
        type: 'pie',
        radius: ['44%', '70%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        label: {
          formatter: '{b}\n{d}%',
          color: '#334155',
        },
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
    color: [grossProfitMode ? '#0f766e' : '#2563eb'],
    tooltip: {
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
        lines.push(`涉及订单：${formatNumber(data.orderCount)}`, `涉及客户：${formatNumber(data.customerCount)}`)
        return lines.join('<br/>')
      },
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: '#64748b' },
    },
    grid: { top: 42, right: 96, bottom: 24, left: 12, containLabel: true },
    xAxis: {
      type: 'value',
      name: valueName,
      nameTextStyle: { color: '#64748b' },
      axisLabel: { formatter: moneyAxisLabel, color: '#64748b' },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map(({ item }) => item.dimensionName || item.dimensionCode),
      axisLabel: { color: '#64748b', width: 170, overflow: 'truncate' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    series: [
      {
        name: valueName,
        type: 'bar',
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'right',
          color: '#334155',
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

function buildPaymentRiskChartOption(
  items: SupplyDashboardRankingItem[],
  dimension: PaymentRiskChartDimension,
): EChartsCoreOption {
  const rows = items.slice().reverse()
  const dimensionLabel = dimension === 'CITY' ? '城市' : '销售'
  return {
    color: ['#f97316'],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ name?: string; data?: SupplyDashboardRankingItem & { value?: number } }>) => {
        const data = params[0]?.data || {}
        return [
          params[0]?.name || dimensionLabel,
          `待回款：${formatMoneyWan(data.unpaidAmount)}`,
          `交易额：${formatMoneyWan(data.salesAmount)}`,
          `已收额：${formatMoneyWan(data.paidAmount)}`,
          `客户数：${formatNumber(data.customerCount)}`,
          `订单数：${formatNumber(data.orderCount)}`,
          `风险占比：${formatPercent(data.rate)}`,
        ].join('<br/>')
      },
    },
    grid: { top: 18, right: 74, bottom: 18, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: moneyAxisLabel, color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: rows.map((item) => item.dimensionName || item.dimensionCode),
      axisLabel: { color: '#64748b', width: 110, overflow: 'truncate' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    series: [
      {
        name: '待回款',
        type: 'bar',
        barMaxWidth: 16,
        label: {
          show: true,
          position: 'right',
          color: '#334155',
          fontWeight: 700,
          formatter: (params: { value?: number | string }) => formatMoneyWan(Number(params.value || 0)),
        },
        data: rows.map((item) => ({
          ...item,
          value: Number(item.unpaidAmount || 0),
          regionCode: dimension === 'CITY' ? item.dimensionCode : undefined,
          ownerStaffCode: dimension === 'SALES' ? item.dimensionCode : undefined,
        })),
        itemStyle: { borderRadius: [0, 5, 5, 0] },
      },
    ],
  }
}

function buildInventoryRiskChartOption(items: SupplyDashboardRiskItem[]): EChartsCoreOption {
  const levels = [
    { code: 'HIGH', name: '高风险', color: '#ef4444' },
    { code: 'MEDIUM', name: '中风险', color: '#f97316' },
    { code: 'LOW', name: '低风险', color: '#64748b' },
  ]
  const counts = new Map(levels.map((level) => [level.code, 0]))
  items.forEach((item) => {
    const key = item.riskLevel === 'HIGH' || item.riskLevel === 'MEDIUM' ? item.riskLevel : 'LOW'
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return {
    color: levels.map((level) => level.color),
    tooltip: {
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
      textStyle: { color: '#64748b' },
    },
    grid: { top: 40, right: 18, bottom: 12, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: ['库存风险项'],
      axisLabel: { color: '#64748b' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
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

function buildCityCostChartOption(items: SupplyDashboardTrendPoint[]): EChartsCoreOption {
  const rows = items.slice(-14)
  const periods = rows.map((item) => item.period)
  return {
    color: ['#7c3aed', '#16a34a'],
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number | string) => formatMoneyWan(Number(value || 0)),
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: '#64748b' },
    },
    grid: { top: 42, right: 18, bottom: 24, left: 54, containLabel: true },
    xAxis: {
      type: 'category',
      data: periods,
      axisLabel: { formatter: (value: string) => value.slice(5), color: '#64748b' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: moneyAxisLabel, color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
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

function trendPeriods(...groups: SupplyDashboardTrendPoint[][]) {
  return [...new Set(groups.flatMap((items) => items.map((item) => item.period)))]
    .sort()
    .slice(-14)
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
  gap: 10px;
  padding: 12px 14px 2px;
}

.bi-filter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;

  > strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 16px;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
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

.filter-panel :deep(.el-form) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(236px, 1fr));
  align-items: end;
  gap: 10px 12px;
}

.filter-panel :deep(.el-form-item) {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  margin-right: 0;
  margin-bottom: 0;
}

.filter-panel :deep(.el-form-item__label) {
  justify-content: flex-start;
  height: auto;
  padding: 0 8px 0 0;
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
  gap: 12px;
  padding: 14px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
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
  gap: 12px;
}

.overview-support-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.overview-lead-card,
.overview-support-card {
  display: grid;
  min-width: 0;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.overview-lead-card {
  min-height: 138px;
  gap: 8px;
  padding: 18px;
  background: #0f172a;

  span,
  small {
    color: #cbd5e1;
  }

  strong {
    color: #fff;
    font-size: 34px;
    line-height: 1.05;
  }
}

.overview-lead-card.metric-tile--success {
  background: #064e3b;
}

.overview-lead-card.metric-tile--refund,
.overview-lead-card.metric-tile--warning {
  background: #7c2d12;
}

.overview-support-card {
  min-height: 96px;
  gap: 6px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-top: 4px solid #2563eb;
  background: #fff;

  span,
  small {
    color: #64748b;
  }

  strong {
    color: #0f172a;
    font-size: 24px;
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

.overview-risk-list {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
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

@media (max-width: 1180px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid,
  .product-sales-layout,
  .product-chart-grid--with-pie,
  .dual-ranking-layout,
  .payment-risk-layout,
  .overview-lead-grid,
  .overview-support-grid,
  .analysis-insight-strip {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .bi-filter-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .overview-command-head {
    align-items: flex-start;
    flex-direction: column;
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
