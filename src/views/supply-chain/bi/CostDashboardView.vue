<template>
  <div ref="boardElement" class="cost-dashboard">
    <header class="cost-header">
      <h1>成本数据看板</h1>
      <div class="controls header-actions">
        <span v-if="report" class="updated-at">更新于 {{ updatedAt }}</span>
        <button @click="definitions = true">统计说明</button>
        <button :disabled="loading" @click="refreshBoard">刷新</button>
        <button @click="toggleFullscreen">{{ fullscreen ? '退出全屏' : '全屏' }}</button>
      </div>
    </header>
    <div class="cost-filter-bar controls">
      <label
        >期间
        <select
          v-model.number="filters.year"
          aria-label="年份"
          :disabled="!cutoff"
          @change="globalChange"
        >
          <option v-for="year in years" :key="year" :value="year">{{ year }}年</option>
        </select>
        <select
          v-model.number="filters.month"
          aria-label="月份"
          :disabled="!cutoff"
          @change="globalChange"
        >
          <option :value="0">全年</option>
          <option
            v-for="month in 12"
            :key="month"
            :value="month"
            :disabled="filters.year === maxYear && month > maxMonth"
          >
            {{ month }}月
          </option>
        </select>
      </label>
      <div class="segmented period-presets" aria-label="快捷期间">
        <button
          :disabled="!cutoff"
          :aria-pressed="activePeriod === 'current'"
          :class="{ active: activePeriod === 'current' }"
          @click="applyPeriod('current')"
        >
          本月
        </button>
        <button
          :disabled="!cutoff"
          :aria-pressed="activePeriod === 'previous'"
          :class="{ active: activePeriod === 'previous' }"
          @click="applyPeriod('previous')"
        >
          上月
        </button>
        <button
          :disabled="!cutoff"
          :aria-pressed="activePeriod === 'year'"
          :class="{ active: activePeriod === 'year' }"
          @click="applyPeriod('year')"
        >
          本年
        </button>
      </div>
      <label
        >费用归属
        <select v-model="filters.city" aria-label="费用归属" @change="globalChange">
          <option :value="undefined">全部授权归属</option>
          <option v-for="city in cities" :key="city.key" :value="city.key">{{ city.label }}</option>
        </select>
      </label>
      <label class="compare"
        >对比
        <select
          v-model="filters.compare"
          aria-label="对比方式"
          :disabled="filters.month === 0"
          @change="globalChange"
        >
          <option value="previous">上期</option>
          <option value="yoy">去年同期</option>
        </select>
      </label>
    </div>
    <nav class="cost-tabs" aria-label="分析章节">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="{ active: section === tab.key }"
        :aria-pressed="section === tab.key"
        @click="goSection(tab.key)"
      >
        {{ tab.label }}
      </button>
    </nav>
    <div v-if="report" class="scope-line">
      <span
        >本期 {{ report.meta.period.from }} — {{ report.meta.period.to }}　/　可比期
        {{ report.meta.period.previousFrom }} — {{ report.meta.period.previousTo }}</span
      ><span>人民币 · 元</span>
    </div>
    <div v-if="error" class="cost-message error" role="alert">
      {{ error }}<button @click="refreshBoard">重新读取</button>
    </div>
    <div v-if="loading" class="cost-message loading" role="status">正在读取费用数据…</div>
    <main v-else-if="report">
      <div v-if="report.meta.excludedScopes.length" class="cost-message notice" role="status">
        当前未授权的原业务来源：{{
          report.meta.excludedScopes.join('、')
        }}。报销按报销权限归集，两期均使用相同授权范围。
      </div>
      <div v-if="report.meta.dataState === 'STALE'" class="cost-message notice" role="alert">
        数据更新延迟，当前展示上次更新的费用数据。更新时间：{{ updatedAt }}。
      </div>
      <div
        v-if="section !== 'overview' && report.current.reviewCount"
        class="cost-message notice"
        role="status"
      >
        待核对来源 {{ report.current.reviewCount }} 笔，暂未计入。请在对应原单核对。
      </div>
      <template v-if="section === 'overview'">
        <CostOverview
          :report="report"
          :available="available"
          :comparison-label="comparisonLabel"
          :month="filters.month"
          @scope="chooseScope"
          @category="openCostArea"
          @records="openRecords"
          @analysis="openAnalysis"
          @month="selectMonth"
          @cities="openCities"
        />
        <CostDepartmentAnalysis
          :query="{ ...request, snapshotId: report.meta.snapshotId }"
          @detail="openRecords"
        />
      </template>
      <template v-else-if="section === 'analysis'">
        <div class="analysis-controls">
          <div class="segmented">
            <button
              v-for="scope in scopes"
              :key="scope.key"
              :class="{ active: filters.scope === scope.key }"
              @click="chooseScope(scope.key)"
            >
              {{ scope.label }}
            </button>
          </div>
          <span class="analysis-total"
            >本期已确认 <strong>{{ money(report.current.amount) }}</strong> 元</span
          >
        </div>
        <nav class="view-tabs" aria-label="分析视角">
          <button
            v-for="view in perspectives"
            :key="view.key"
            :class="{ active: perspective === view.key }"
            :aria-pressed="perspective === view.key"
            @click="choosePerspective(view.key)"
          >
            {{ view.label }}
          </button>
        </nav>
        <template v-if="perspective === 'cities'">
          <div class="chart-grid">
            <section class="cost-panel">
              <div class="panel-heading">
                <h2>归属费用金额对比</h2>
                <span class="muted">本期 / 可比期</span>
              </div>
              <CostComparisonBars
                :groups="report.cityGroups"
                :comparable="report.meta.comparisonAvailable"
                @select="(city) => openAnalysis({ city })"
              />
              <p class="chart-note">全部归属见下方矩阵；各归属金额以同一费用范围比较。</p>
            </section>
            <section class="cost-panel">
              <div class="panel-heading">
                <h2>归属费用结构</h2>
                <span class="muted">已确认金额占比</span>
              </div>
              <CostRing
                :groups="report.cityGroups"
                :total="report.current.amount"
                @select="(city) => openAnalysis({ city })"
              />
              <p class="chart-note">待归属费用保留在总额及占比中。</p>
            </section>
          </div>
          <section class="cost-panel">
            <div class="panel-heading">
              <div>
                <h2>费用归属分布</h2>
                <p class="muted">完整归属与类别矩阵 · 点击金额查看对应单据</p>
              </div>
              <div class="segmented">
                <button
                  v-for="mode in matrixModes"
                  :key="mode.key"
                  :class="{ active: matrixMode === mode.key }"
                  :aria-pressed="matrixMode === mode.key"
                  :disabled="mode.key === 'delta' && !report.meta.comparisonAvailable"
                  @click="matrixMode = mode.key"
                >
                  {{ mode.label }}
                </button>
              </div>
            </div>
            <div class="table-scroll">
              <table class="supply-report-table cost-table matrix">
                <thead>
                  <tr>
                    <th>费用归属</th>
                    <th v-for="group in report.categories" :key="group.key">{{ group.label }}</th>
                    <th>
                      {{
                        matrixMode === 'delta'
                          ? '变动合计'
                          : matrixMode === 'share'
                            ? '占比合计'
                            : '本期合计'
                      }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="city in report.cityGroups" :key="city.key">
                    <th>
                      <button class="text-button" @click="openAnalysis({ city: city.key })">
                        {{ city.label }}
                      </button>
                    </th>
                    <td v-for="group in report.categories" :key="group.key">
                      <button
                        :style="cellStyle(city.key, group.key)"
                        :aria-label="`${city.label}，${group.label}，${cellText(city.key, group.key)}，查看费用变动`"
                        @click="
                          openAnalysis({ city: city.key, category: group.key as CostCategory })
                        "
                      >
                        {{ cellText(city.key, group.key) }}
                      </button>
                    </td>
                    <td class="numeric">{{ matrixTotal(city, matrixMode) }}</td>
                  </tr>
                  <tr v-if="!report.cityGroups.length">
                    <td :colspan="report.categories.length + 2" class="empty">
                      当前范围没有已确认记录
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
        <template v-else-if="perspective === 'structure'">
          <div class="chart-grid structure-chart-grid">
            <section class="cost-panel">
              <div class="panel-heading">
                <h2>
                  {{
                    filters.scope === 'opex'
                      ? '经营费用结构'
                      : filters.scope === 'purchase'
                        ? '采购成本构成'
                        : '归属费用结构'
                  }}
                </h2>
              </div>
              <CostRing
                :groups="structureGroups"
                :total="report.current.amount"
                :category="filters.scope === 'opex'"
                @select="structureDrill"
              />
            </section>
            <section class="cost-panel">
              <div class="panel-heading">
                <div>
                  <h2>费用金额对比</h2>
                </div>
              </div>
              <CostComparisonBars
                :groups="structureGroups"
                :comparable="report.meta.comparisonAvailable"
                @select="structureDrill"
              />
            </section>
          </div>
          <section class="cost-panel">
            <h2>费用构成明细</h2>
            <div class="table-scroll">
              <table class="supply-report-table cost-table">
                <thead>
                  <tr>
                    <th>费用项</th>
                    <th class="numeric">本期金额</th>
                    <th class="numeric">可比期金额</th>
                    <th class="numeric">变动金额</th>
                    <th class="numeric">本期占比</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="group in structureGroups" :key="group.key">
                    <td>{{ group.label }}</td>
                    <td class="numeric">{{ money(group.current) }}</td>
                    <td class="numeric">{{ money(group.previous) }}</td>
                    <td class="numeric" :class="deltaClass(group.delta)">
                      {{ signed(group.delta) }}
                    </td>
                    <td class="numeric">{{ percent(group.share) }}</td>
                    <td>
                      <button class="text-button" @click="structureDrill(group.key)">
                        查看明细
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
        <template v-else>
          <div class="controls topic-controls">
            <label
              >费用专题
              <select v-model="filters.category" aria-label="费用专题" @change="topicChange">
                <option v-for="key in topicCategories" :key="key" :value="key">
                  {{ categories[key] }}
                </option>
              </select></label
            ><label
              >分析维度
              <select v-model="filters.dimension" aria-label="分析维度" @change="load()">
                <option v-for="key in topicDimensions" :key="key" :value="key">
                  {{ topicDimensionName(key) }}
                </option>
              </select></label
            ><span class="muted">维度已记录金额覆盖 {{ percent(report.dimensionCoverage) }}</span>
          </div>
          <div class="metric-strip">
            <div>
              <span>本期已确认费用</span><strong>{{ money(report.current.amount) }} 元</strong>
            </div>
            <div>
              <span>期间变动金额</span
              ><strong :class="deltaClass(report.delta)">{{ signed(report.delta) }} 元</strong>
            </div>
            <div>
              <span>未付款单据金额</span><strong>{{ money(report.current.unpaid) }} 元</strong>
            </div>
          </div>
          <div class="chart-grid">
            <section class="cost-panel">
              <div class="panel-heading">
                <h2>支出对象金额排名</h2>
                <span class="muted">TOP 8</span>
              </div>
              <EchartsChart
                :option="bars(report.objects, false)"
                :height="310"
                @chart-click="objectChartClick"
              />
            </section>
            <section class="cost-panel">
              <div class="panel-heading">
                <h2>费用发生趋势</h2>
                <span class="muted">{{ filters.month === 0 ? '当年逐月' : '最近六个月' }}</span>
              </div>
              <EchartsChart :option="monthChart" :height="310" @chart-click="monthChartClick" />
              <p class="chart-note">点击本期月份查询；当前未完月按数据截止日统计。</p>
            </section>
          </div>
          <section class="cost-panel">
            <div class="panel-heading">
              <h2>全部支出对象</h2>
              <span class="muted">占比基数为专题全量金额</span>
            </div>
            <div class="table-scroll">
              <table class="supply-report-table cost-table">
                <thead>
                  <tr>
                    <th>{{ dimensionNames[filters.dimension || ''] || '对象' }}</th>
                    <th class="numeric">本期金额</th>
                    <th class="numeric">可比期金额</th>
                    <th class="numeric">变动金额</th>
                    <th class="numeric">占比</th>
                    <th class="numeric">笔数</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="group in report.objects" :key="group.key">
                    <td>{{ group.label }}</td>
                    <td class="numeric">{{ money(group.current) }}</td>
                    <td class="numeric">{{ money(group.previous) }}</td>
                    <td class="numeric">{{ signed(group.delta) }}</td>
                    <td class="numeric">{{ percent(group.share) }}</td>
                    <td class="numeric">{{ group.count }}</td>
                    <td>
                      <button
                        class="text-button"
                        @click="openAnalysis({ dimensionKey: group.key })"
                      >
                        查看明细
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!report.objects.length">
                    <td colspan="7" class="empty">当前专题没有已确认记录</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </template>
      <template v-else>
        <div class="analysis-controls">
          <h2>支出明细</h2>
          <button
            v-if="report.meta.exportAllowed"
            :disabled="exportBusy || exportSubmitting"
            @click="openCustomExport"
          >
            自定义导出
          </button>
        </div>
        <div v-if="Object.keys(drill).length" class="drill-filter">
          <span>继承筛选：{{ drillDescription }}</span
          ><button class="text-button" @click="clearLedgerDrill">清除下钻条件</button>
        </div>
        <form class="ledger-filters controls" @submit.prevent="searchRecords">
          <label
            >统计范围
            <select
              v-model="filters.scope"
              aria-label="明细统计范围"
              @change="chooseScope(filters.scope || 'opex')"
            >
              <option v-for="scope in scopes" :key="scope.key" :value="scope.key">
                {{ scope.label }}
              </option>
            </select></label
          ><label
            >付款状态
            <select v-model="filters.payment" aria-label="付款状态" @change="searchRecords">
              <option value="ALL">全部</option>
              <option value="PAID">已付款</option>
              <option value="UNPAID">未付款</option>
              <option value="UNKNOWN">未记录</option>
            </select></label
          ><input
            v-model="recordSearch"
            maxlength="120"
            aria-label="搜索单据"
            placeholder="单据号、事项、员工、原始单号"
          /><button type="submit">查询</button>
        </form>
        <div class="section-heading">
          <div class="segmented">
            <button
              :class="{ active: filters.periodSide === 'current' }"
              :aria-pressed="filters.periodSide === 'current'"
              @click="changeSide('current')"
            >
              本期费用明细</button
            ><button
              :class="{ active: filters.periodSide === 'previous' }"
              :aria-pressed="filters.periodSide === 'previous'"
              @click="changeSide('previous')"
            >
              可比期费用明细
            </button>
          </div>
          <span class="muted">支出明细为费用登记记录，不代表银行付款明细</span>
        </div>
        <template v-if="records"
          ><div class="metric-strip">
            <div>
              <span>匹配记录</span><strong>{{ records.summary.count }} 笔</strong>
            </div>
            <div>
              <span>已确认金额</span><strong>{{ money(records.summary.confirmed) }} 元</strong>
            </div>
          </div>
          <CostRecordsTable :rows="records.items" @detail="openDetail" />
          <div class="pagination">
            <label
              >每页
              <select v-model.number="filters.size" aria-label="每页笔数" @change="searchRecords">
                <option :value="20">20</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
              </select>
              笔</label
            ><span
              >第 {{ filters.page }} /
              {{ Math.max(1, Math.ceil(records.summary.count / (filters.size || 20))) }} 页</span
            ><button :disabled="filters.page === 1" @click="page(-1)">上一页</button
            ><button
              :disabled="(filters.page || 1) * (filters.size || 20) >= records.summary.count"
              @click="page(1)"
            >
              下一页
            </button>
          </div></template
        >
      </template>
      <div
        v-if="exportTask || exportError"
        class="cost-message"
        :class="{ error: exportError }"
        role="status"
      >
        <span>{{ exportError || exportLabel }}{{ exportContext ? ` · ${exportContext}` : '' }}</span
        ><button
          v-if="exportTask?.status === 'READY'"
          :disabled="exportDownloading"
          @click="downloadExport"
        >
          {{ exportDownloading ? '正在生成 Excel…' : '下载 Excel' }}</button
        ><button v-if="exportBusy" @click="cancelExport">取消导出</button>
      </div>
    </main>

    <div v-if="modalQuery" class="cost-modal-backdrop" @click.self="closeModal">
      <section
        class="cost-modal"
        v-cost-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="cost-analysis-title"
        @keydown.esc="closeModal"
      >
        <header>
          <div>
            <p class="eyebrow">{{ modalTitle }}</p>
            <h2 id="cost-analysis-title">费用变动分析</h2>
          </div>
          <button aria-label="关闭费用变动分析" @click="closeModal">关闭</button>
        </header>
        <div v-if="modalLoading" class="empty">正在读取…</div>
        <div v-else-if="modalError" class="cost-message error" role="alert">{{ modalError }}</div>
        <template v-else-if="modalReport"
          ><div class="metric-strip">
            <div>
              <span>本期金额 · {{ modalReport.current.count }} 笔</span
              ><strong>{{ money(modalReport.current.amount) }}</strong>
            </div>
            <div>
              <span>可比期金额 · {{ modalReport.previous.count }} 笔</span
              ><strong>{{
                modalReport.meta.comparisonAvailable ? money(modalReport.previous.amount) : '—'
              }}</strong>
            </div>
            <div>
              <span>变动金额</span
              ><strong :class="deltaClass(modalReport.delta)">{{
                signed(modalReport.delta)
              }}</strong>
            </div>
          </div>
          <h3>期间对比</h3>
          <p class="analysis-note">
            本期 {{ modalReport.meta.period.from }} — {{ modalReport.meta.period.to }}；可比期
            {{ modalReport.meta.period.previousFrom }} — {{ modalReport.meta.period.previousTo }}。
          </p>
          <CostRing
            v-if="!modalQuery.category || !modalQuery.city"
            :groups="modalQuery.category ? modalReport.cityGroups : modalReport.categories"
            :total="modalReport.current.amount"
            :category="!modalQuery.category"
            @select="nestedDrill"
          />
          <h3>本期主要支出</h3>
          <p class="analysis-note">按金额降序展示前 8 笔，全部匹配记录请进入费用明细。</p>
          <CostRecordsTable :rows="modalReport.majorRecords" @detail="openDetail" />
          <div class="question-box">
            <h3>业务核对事项</h3>
            <p>
              {{
                modalQuery.city === 'UNKNOWN'
                  ? '请在原业务模块核对费用归属及部门归属。待归属记录已计入当前可见费用。'
                  : '结合费用发生日期、费用事项及原单记录核对期间变动；增加不自动认定异常，减少不自动认定节约。'
              }}
            </p>
          </div>
          <div class="controls">
            <button class="primary" @click="modalRecords('current')">本期费用明细</button
            ><button @click="modalRecords('previous')">可比期费用明细</button>
          </div></template
        >
      </section>
    </div>
    <div v-if="detailOpen" class="cost-modal-backdrop" @click.self="detailOpen = false">
      <section
        class="cost-modal"
        v-cost-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="cost-detail-title"
        @keydown.esc="detailOpen = false"
      >
        <header>
          <h2 id="cost-detail-title">费用单据详情</h2>
          <button @click="detailOpen = false">关闭</button>
        </header>
        <div v-if="detailLoading" class="empty">正在读取详情…</div>
        <div v-else-if="detailError" class="cost-message error" role="alert">{{ detailError }}</div>
        <template v-else-if="detail"
          ><dl class="cost-detail-grid">
            <div>
              <dt>单据号</dt>
              <dd>{{ detail.record.documentNo }}</dd>
            </div>
            <div>
              <dt>费用事项</dt>
              <dd>{{ detail.record.title }}</dd>
            </div>
            <div>
              <dt>费用类别</dt>
              <dd>{{ categories[detail.record.category] }}</dd>
            </div>
            <div>
              <dt>费用归属</dt>
              <dd>{{ detail.record.cityName }}</dd>
            </div>
            <div>
              <dt>费用日期</dt>
              <dd>
                {{ detail.record.date
                }}<span v-if="detail.record.periodBasis === 'MONTH'"
                  >（费用所属月 {{ detail.record.costMonth }}）</span
                >
              </dd>
            </div>
            <div>
              <dt>金额</dt>
              <dd>
                {{ detail.record.amount === null ? '未填' : `${money(detail.record.amount)} 元` }}
              </dd>
            </div>
            <div>
              <dt>确认状态 / 付款状态</dt>
              <dd>
                {{ statusName(detail.record.status) }} / {{ statusName(detail.record.payment) }}
              </dd>
            </div>
            <div
              v-for="(value, name) in visibleDetailDimensions(detail.record, detail.dimensions)"
              :key="name"
            >
              <dt>{{ name }}</dt>
              <dd>{{ detailDimensionValue(detail.record, String(name), value) }}</dd>
            </div>
          </dl>
          <p v-if="detail.remark" class="analysis-note">备注：{{ detail.remark }}</p>
          <p v-if="detail.originalNumbers.length" class="analysis-note">
            外部原始单号：{{ detail.originalNumbers.join('、') }}
          </p>
          <router-link v-if="detail.sourceRoute" class="source-link" :to="detail.sourceRoute"
            >查看原业务单据 →</router-link
          ></template
        >
      </section>
    </div>
    <div v-if="definitions" class="cost-modal-backdrop" @click.self="definitions = false">
      <section
        class="cost-modal"
        v-cost-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="cost-definitions-title"
        @keydown.esc="definitions = false"
      >
        <header>
          <h2 id="cost-definitions-title">指标口径说明</h2>
          <button @click="definitions = false">关闭</button>
        </header>
        <dl class="definitions">
          <dt>业务确认</dt>
          <dd>
            仅已确认记录进入看板，待确认和已作废记录不纳入展示或导出。确认不代表审批通过或财务审核完成。本模块不提供审批流、财务审核或付款操作。
          </dd>
          <dt>经营费用</dt>
          <dd>
            系统已确认且金额非空的经营费用，包含人力薪酬、公司承担运费、场地、营销和报销。人力取已确认及已发放工资的应发金额，按工资所属月归集；激励与提成是同一项，不重复计入。差旅、住宿、打车保留在报销统计，其他报销按登记用途归类。关联已登记费用的报销不重复汇总；原费用变化或资产支出列入待核对。采购、损耗和押金不计入经营费用；采购金额不等于已售商品成本。
          </dd>
          <dt>期间对比</dt>
          <dd>
            按费用实际发生日期、北京时间统计；薪酬、租赁及月度服务按费用所属月统计，不摊入每日曲线。当前月比较截至日对应范围；历史月比较完整自然月；全年固定同比。上期短月及闰日按有效日期裁剪。授权费用范围已有可比期记录时，新增费用分类的上期金额按零比较，零基数不计算增长率。
          </dd>
          <dt>占比与变动贡献</dt>
          <dd>
            结构占比以当前范围全量确认金额为分母；变动贡献按全部增加额或全部减少额分别计算。无历史覆盖不推算增幅，零基数显示“—”。
          </dd>
          <dt>付款状态</dt>
          <dd>
            人力薪酬按月度薪酬登记发放状态展示：已发放为已付款，其余为未付款；部分登记但尚未发完仍为未付款。其他费用沿用原台账的付款状态。状态不代表银行实际支付额、逾期或现金流；工资待发净额请查看原工资单。
          </dd>
          <dt>数据更新</dt>
          <dd>
            费用单据更新后可点击刷新读取最新结果；数据更新延迟时显示上次更新结果及时间。费用更正在原业务单据中完成。
          </dd>
          <dt>采购成本与损耗</dt>
          <dd>
            采购成本包含已确认采购单货款及已确认实际运费；采购单约定运费不重复计入。货款按整单折后应付计入，未分摊到商品。损耗单独统计，采购成本不等同于当期销售成本。
          </dd>
        </dl>
      </section>
    </div>
  </div>
  <CostExportDialog
    v-model="exportDialogOpen"
    v-model:fields="exportFields"
    :columns="costDashboardExportColumns"
    :scope="`全部匹配单据（${records?.summary.count ?? 0} 条）`"
    :empty="!records?.summary.count"
    :busy="exportSubmitting"
    :error="exportError"
    @confirm="confirmCustomExport"
  />
</template>

<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { type CostCategory, type CostScope } from '@/api/core/bi-cost-dashboard'
import { ElMessage } from 'element-plus'
import EchartsChart from './components/EchartsChart.vue'
import CostRing from './cost/CostRing.vue'
import CostComparisonBars from './cost/CostComparisonBars.vue'
import CostRecordsTable from './cost/CostRecordsTable.vue'
import CostOverview from './cost/CostOverview.vue'
import CostDepartmentAnalysis from './cost/CostDepartmentAnalysis.vue'
import { costDialog as vCostDialog } from './cost/cost-dialog'
import { useCostDashboard } from './cost/use-cost-dashboard'
import { useCostDashboardExport } from './cost/use-cost-dashboard-export'
import CostExportDialog from '../cost/CostExportDialog.vue'
import { costDashboardExportColumns } from './cost/cost-report-export'
import {
  bars,
  monthlyTrend,
  categories,
  dimensionNames,
  detailDimensionValue,
  visibleDetailDimensions,
  dimensions,
  eventKey,
  money,
  percent,
  signed,
  statusName,
  matrixTotal,
} from './cost/cost-presentation'
const {
  report,
  records,
  error,
  loading,
  section,
  perspective,
  filters,
  recordSearch,
  drill,
  request,
  cutoff,
  cities,
  available,
  modalReport,
  modalQuery,
  modalError,
  modalLoading,
  detail,
  detailOpen,
  detailLoading,
  detailError,
  load,
  globalChange,
  applyPeriod,
  activePeriod,
  goSection,
  chooseScope,
  choosePerspective,
  topicChange,
  openAnalysis,
  closeModal,
  openRecords,
  modalRecords,
  openDetail,
  clearLedgerDrill,
  searchRecords,
} = useCostDashboard()
function openCostArea(category: CostCategory) {
  if (category === 'purchase' || category === 'loss') {
    chooseScope(category)
  } else {
    filters.scope = 'opex'
    section.value = 'analysis'
    perspective.value = 'objects'
    filters.category = category
    topicChange()
  }
}
const boardElement = ref<HTMLElement>(),
  fullscreen = ref(false)
function syncFullscreen() {
  fullscreen.value = document.fullscreenElement === boardElement.value
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await boardElement.value?.requestFullscreen()
  } catch {
    ElMessage.warning('当前浏览器未允许全屏显示')
  }
}
onMounted(() => document.addEventListener('fullscreenchange', syncFullscreen))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', syncFullscreen))
const definitions = ref(false),
  matrixMode = ref<'amount' | 'share' | 'delta'>('amount')
const tabs = [
  { key: 'overview', label: '成本总览' },
  { key: 'analysis', label: '成本分析' },
  { key: 'records', label: '单据明细' },
] as const
const perspectives = [
  { key: 'cities', label: '归属对比' },
  { key: 'structure', label: '费用构成' },
  { key: 'objects', label: '专题分析' },
] as const
const matrixModes = [
  { key: 'amount', label: '金额' },
  { key: 'share', label: '归属内占比' },
  { key: 'delta', label: '变动额' },
] as const
const scopes = computed(() =>
  (
    [
      { key: 'opex', label: '经营费用' },
      { key: 'purchase', label: '采购成本' },
      { key: 'loss', label: '商品损耗' },
    ] as { key: CostScope; label: string }[]
  ).filter((s) => s.key === 'opex' || available.value.includes(s.key)),
)
const maxYear = computed(() => Number(cutoff.value.slice(0, 4))),
  maxMonth = computed(() => Number(cutoff.value.slice(5, 7)))
const years = computed(() =>
  cutoff.value ? Array.from({ length: maxYear.value - 1999 }, (_, i) => maxYear.value - i) : [],
)
const comparisonLabel = computed(() =>
  filters.month === 0 || filters.compare === 'yoy' ? '较去年同期' : '较上期',
)
const updatedAt = computed(() => displayDateTime(report.value?.meta.generatedAt))
const structureGroups = computed(() =>
  filters.scope === 'opex'
    ? report.value?.categories || []
    : filters.scope === 'purchase'
      ? report.value?.objects || []
      : report.value?.cityGroups || [],
)
const topicCategories = computed(() =>
  available.value.filter((c) => filters.scope === (c === 'purchase' || c === 'loss' ? c : 'opex')),
)
const topicDimensions = computed(() =>
  report.value && report.value.category === filters.category && report.value.dimensions.length
    ? report.value.dimensions.map((item) => item.key)
    : filters.category
      ? dimensions[filters.category]
      : [],
)
const topicDimensionName = (key: string) =>
  report.value?.dimensions.find((item) => item.key === key)?.label || dimensionNames[key] || key

function deltaClass(value: string | null) {
  return Number(value) > 0 ? 'increase' : Number(value) < 0 ? 'decrease' : ''
}
function categoryDrill(key: string) {
  void openAnalysis({ category: key as CostCategory })
}
function structureDrill(key: string) {
  if (filters.scope === 'opex') categoryDrill(key)
  else if (filters.scope === 'purchase')
    void openAnalysis({ category: 'purchase', dimension: 'component', dimensionKey: key })
  else void openAnalysis({ city: key })
}
function objectChartClick(event: unknown) {
  const dimensionKey = eventKey(event)
  if (dimensionKey) void openAnalysis({ dimensionKey })
}
const monthChart = computed(() => monthlyTrend(report.value?.months || []))
function monthChartClick(event: unknown) {
  const key = eventKey(event)
  if (!key) return
  selectMonth(key)
}
function selectMonth(key: string) {
  const [year, month] = key.split('-').map(Number)
  filters.year = year
  filters.month = month
  globalChange()
}
function openCities() {
  perspective.value = 'cities'
  goSection('analysis')
}
function cell(city: string, category: string) {
  return report.value?.matrix.find((c) => c.city === city && c.category === category)
}
function cellText(city: string, category: string) {
  const c = cell(city, category)
  if (matrixMode.value === 'share') return c ? percent(c.share) : '0.0%'
  if (matrixMode.value === 'delta')
    return c ? signed(c.delta) : report.value?.meta.comparisonAvailable ? '0.00' : '—'
  return money(c?.current || '0.00')
}
function cellStyle(city: string, category: string) {
  const c = cell(city, category)
  const value =
    Number(
      matrixMode.value === 'delta'
        ? c?.delta
        : matrixMode.value === 'share'
          ? c?.share
          : c?.current,
    ) || 0
  const max = Math.max(
    1,
    ...(report.value?.matrix || []).map((v) =>
      Math.abs(
        Number(
          matrixMode.value === 'delta'
            ? v.delta
            : matrixMode.value === 'share'
              ? v.share
              : v.current,
        ),
      ),
    ),
  )
  return {
    background: `rgba(${value < 0 ? '112,201,188' : matrixMode.value === 'delta' ? '229,180,115' : '108,164,242'},${0.05 + (Math.abs(value) / max) * 0.3})`,
  }
}
const modalTitle = computed(
  () =>
    [
      modalQuery.value?.city && cities.value.find((c) => c.key === modalQuery.value?.city)?.label,
      modalQuery.value?.category && categories[modalQuery.value.category],
    ]
      .filter(Boolean)
      .join(' · ') || '当前费用范围',
)
function nestedDrill(key: string) {
  if (!modalQuery.value) return
  void openAnalysis({
    ...modalQuery.value,
    ...(modalQuery.value.category ? { city: key } : { category: key as CostCategory }),
  })
}
const drillDescription = computed(() =>
  [
    drill.value.department && '所选部门',
    drill.value.city && cities.value.find((c) => c.key === drill.value.city)?.label,
    drill.value.category && categories[drill.value.category],
    drill.value.dimensionKey && `${dimensionNames[drill.value.dimension || ''] || '对象'}筛选`,
    filters.missingAmount && '缺金额记录',
  ]
    .filter(Boolean)
    .join(' · '),
)
function changeSide(side: 'current' | 'previous') {
  filters.periodSide = side
  filters.page = 1
  void load()
}
function page(step: number) {
  filters.page = (filters.page || 1) + step
  void load()
}
function refreshBoard() {
  closeModal()
  detailOpen.value = false
  void load(true)
}
const {
  exportTask,
  exportError,
  exportSubmitting,
  exportDownloading,
  exportContext,
  exportBusy,
  exportLabel,
  startExport,
  cancelExport,
  downloadExport,
} = useCostDashboardExport(request, cities)
const exportDialogOpen = ref(false),
  exportFields = ref<string[]>([])
function openCustomExport() {
  exportFields.value = costDashboardExportColumns.map((column) => column.key)
  exportError.value = ''
  exportDialogOpen.value = true
}
async function confirmCustomExport() {
  await startExport(exportFields.value)
  if (!exportError.value) exportDialogOpen.value = false
}
watch(request, () => {
  exportDialogOpen.value = false
})
</script>
<style lang="scss" src="./cost/cost-dashboard.scss"></style>
