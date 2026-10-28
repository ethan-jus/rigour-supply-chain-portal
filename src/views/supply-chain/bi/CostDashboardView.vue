<template>
  <div ref="boardElement" class="cost-dashboard">
    <header class="cost-header">
      <div>
        <p class="eyebrow">数据看板 / 经营费用</p>
        <h1>成本数据看板</h1>
      </div>
      <div class="controls">
        <label
          >期间
          <select
            v-model.number="filters.year"
            aria-label="年份"
            :disabled="!cutoff"
            @change="globalChange"
          >
            <option v-for="year in years" :key="year" :value="year">{{ year }}年</option>
          </select></label
        ><select
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
          </option></select
        ><label
          >费用归属
          <select v-model="filters.city" aria-label="费用归属" @change="globalChange">
            <option :value="undefined">全部授权归属</option>
            <option v-for="city in cities" :key="city.key" :value="city.key">
              {{ city.label }}
            </option>
          </select></label
        ><button @click="definitions = true">统计说明</button
        ><button :disabled="loading" @click="refreshBoard">刷新</button
        ><button @click="toggleFullscreen">{{ fullscreen ? '退出全屏' : '全屏' }}</button>
      </div>
    </header>
    <nav class="cost-tabs" aria-label="分析章节">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="{ active: section === tab.key }"
        :aria-pressed="section === tab.key"
        @click="goSection(tab.key)"
      >
        {{ tab.label }}</button
      ><label class="compare"
        >对比
        <select
          v-model="filters.compare"
          aria-label="对比方式"
          :disabled="filters.month === 0"
          @change="globalChange"
        >
          <option value="previous">上期</option>
          <option value="yoy">去年同期</option>
        </select></label
      >
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
      <div v-if="report.current.reviewCount" class="cost-message notice" role="status">
        待核对报销 {{ report.current.reviewCount }} 笔、{{
          money(report.current.reviewAmount || '0')
        }}
        元暂未计入。请在报销原单核对关联费用。
      </div>
      <template v-if="section === 'overview'">
        <div class="section-heading">
          <h2>经营费用总览</h2>
          <span>含已确认薪酬、运费、场地、营销和报销；采购与损耗单列</span>
        </div>
        <section class="brief-hero">
          <div>
            <p class="eyebrow">本期已确认经营费用</p>
            <strong class="hero-number">{{ money(report.current.amount) }}<small>元</small></strong>
            <p class="muted">按发生日期 / 费用所属月 · {{ report.current.count }} 笔计入记录</p>
          </div>
          <div class="hero-compare">
            <p class="eyebrow">{{ comparisonLabel }}</p>
            <strong :class="deltaClass(report.delta)"
              >{{ signed(report.delta)
              }}<small>{{
                report.growth == null
                  ? report.meta.comparisonAvailable
                    ? '零基数'
                    : '无可比数据'
                  : `${Number(report.growth) > 0 ? '+' : ''}${report.growth}%`
              }}</small></strong
            >
            <p class="muted">
              可比期 {{ report.meta.comparisonAvailable ? money(report.previous.amount) : '—' }} 元
            </p>
          </div>
          <div class="brief-reading">
            <p class="eyebrow">本期费用概况</p>
            <p>{{ overviewSummary }}</p>
            <p v-if="comparisonNotice" class="comparison-notice">{{ comparisonNotice }}</p>
            <button class="primary" @click="goSection('analysis')">进入费用分析</button>
          </div>
        </section>
        <section class="cost-panel overview-status" aria-label="费用状态及归属">
          <div class="panel-heading"><h2>费用状态及归属</h2></div>
          <p v-if="Number(report.current.linkedAmount || 0) > 0" class="chart-note">
            关联原费用的报销 {{ money(report.current.linkedAmount) }} 元，已由原单计入。
          </p>
          <div class="support-grid">
            <div>
              <h3>未付款单据金额</h3>
              <strong>{{ money(report.current.unpaid) }} 元</strong
              ><button
                class="text-button"
                @click="openRecords({ payment: 'UNPAID', status: 'CONFIRMED' })"
              >
                查看未付款明细
              </button>
            </div>
            <div>
              <h3>待归属费用</h3>
              <strong>{{ money(report.current.unassigned) }} 元</strong
              ><button
                v-if="cities.some((c) => c.key === 'UNKNOWN')"
                class="text-button"
                @click="openRecords({ city: 'UNKNOWN' })"
              >
                查看待归属明细
              </button>
            </div>
          </div>
        </section>
        <section class="cost-areas" aria-label="六类成本">
          <article v-for="area in costAreas" :key="area.title" class="cost-area">
            <h3>{{ area.title }}</h3>
            <p class="muted">{{ area.description }}</p>
            <template v-for="category in area.categories" :key="category">
              <button v-if="available.includes(category)" @click="openCostArea(category)">
                <span>{{ categories[category] }}</span>
                <strong v-if="category !== 'labor' || payrollRecorded"
                  >{{ money(categoryAmount(category)) }} <small>元</small></strong
                >
                <span v-else class="muted">暂无已确认薪酬</span>
              </button>
              <p v-else class="muted">{{ categories[category] }}：无查看权限</p>
            </template>
          </article>
        </section>
        <div v-if="!report.current.count" class="empty">
          当前范围没有已确认费用记录；采购与损耗分别查看。
        </div>
        <section v-if="available.includes('labor')" class="cost-panel payroll-costs">
          <div class="panel-heading">
            <div>
              <h2>人力薪酬构成</h2>
              <p class="muted">按工资所属月归集已确认、已发放工资的应发金额；激励包含在提成中</p>
            </div>
            <button @click="openCostArea('labor')">查看工资来源</button>
          </div>
          <p v-if="!payrollRecorded" class="empty">
            本期暂无已确认薪酬，确认工资后按工资所属月计入。
          </p>
          <div v-else class="salary-components">
            <div v-for="component in report.payrollComponents" :key="component.key">
              <span>{{ component.label }}</span>
              <strong>{{ money(component.amount) }} <small>元</small></strong>
              <span v-if="component.missingCount" class="muted"
                >{{ component.missingCount }} 笔缺少分项，金额待核对</span
              >
              <span v-else class="muted">{{ component.records }} 笔工资单</span>
            </div>
          </div>
          <p class="chart-note">
            商品提成明细由原工资单追溯。未付款薪酬按应发金额列示，实际待发净额请在月度薪酬查看。
          </p>
        </section>
        <section class="changes-section">
          <div class="section-heading">
            <div>
              <h2>重点费用变动</h2>
              <p class="muted">费用归属与类别交叉分析 · 按变动金额排序 · TOP 3</p>
            </div>
            <div class="segmented">
              <button :class="{ active: direction === 'increase' }" @click="direction = 'increase'">
                费用增加</button
              ><button
                :class="{ active: direction === 'decrease' }"
                @click="direction = 'decrease'"
              >
                费用减少
              </button>
            </div>
          </div>
          <div v-if="report.meta.comparisonAvailable" class="change-reconcile">
            <span
              >增加合计 <b class="increase">+{{ money(report.increased) }}</b></span
            ><span
              >减少合计 <b class="decrease">−{{ money(report.decreased) }}</b></span
            ><span
              >净变动额 <b>{{ signed(report.delta) }}</b></span
            >
          </div>
          <div class="review-grid">
            <button
              v-for="(item, index) in topChanges"
              :key="`${item.city}:${item.category}`"
              class="review-item"
              @click="openAnalysis({ city: item.city, category: item.category })"
            >
              <span class="review-index">0{{ index + 1 }}</span
              ><span>{{ item.cityName }} · {{ categories[item.category] }}</span
              ><strong :class="deltaClass(item.delta)"
                >{{ signed(item.delta) }}<small>元</small></strong
              ><span class="muted"
                >{{ direction === 'increase' ? '增加' : '减少' }}贡献占比
                {{ item.contribution }}%</span
              ><span class="text-button">查看费用变动明细 →</span>
            </button>
          </div>
          <p v-if="!topChanges.length" class="empty">
            {{
              report.meta.comparisonAvailable
                ? '当前范围没有该方向的费用变动'
                : '无可比数据，暂不计算费用变动'
            }}
          </p>
        </section>
        <div class="chart-grid">
          <section class="cost-panel">
            <div class="panel-heading">
              <div>
                <h2>经营费用累计趋势</h2>
                <p class="muted">按发生日费用比较；薪酬、租赁按所属月单列</p>
              </div>
              <button class="text-button" @click="openRecords()">查看支出</button>
            </div>
            <EchartsChart :option="line(report)" :height="260" />
            <p class="chart-note">
              按发生日累计（不含按月费用）；本期按月费用 {{ money(report.monthlyAmount || '0') }} 元
            </p>
          </section>
          <section class="cost-panel">
            <div class="panel-heading">
              <div>
                <h2>经营费用结构</h2>
                <p class="muted">费用类别金额及占比</p>
              </div>
            </div>
            <CostRing
              :groups="report.categories"
              :total="report.current.amount"
              category
              @select="categoryDrill"
            />
            <p class="chart-note">占比基数：当前筛选范围内已确认金额；点击图形或图例下钻。</p>
          </section>
        </div>
        <div class="secondary-band">
          <b>采购与损耗</b
          ><button v-if="available.includes('purchase')" @click="chooseScope('purchase')">
            商品采购 <strong>{{ money(report.purchase) }}</strong> 元</button
          ><button v-if="available.includes('loss')" @click="chooseScope('loss')">
            商品损耗 <strong>{{ money(report.loss) }}</strong> 元</button
          ><span class="muted">采购与损耗分别统计，不计入经营费用</span>
        </div>
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
              <table class="cost-table matrix">
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
          <div class="chart-grid">
            <section class="cost-panel">
              <div class="panel-heading">
                <h2>归属费用对比</h2>
                <span class="muted">本期金额 TOP 8</span>
              </div>
              <EchartsChart
                :option="bars(report.cityGroups, report.meta.comparisonAvailable)"
                :height="310"
                @chart-click="cityChartClick"
              />
              <p class="chart-note">全部归属见上方矩阵；各归属金额以同一费用范围比较。</p>
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
        </template>
        <template v-else-if="perspective === 'structure'">
          <div class="chart-grid structure-chart-grid">
            <section class="cost-panel">
              <div class="panel-heading">
                <h2>{{ filters.scope === 'opex' ? '经营费用结构' : '归属费用结构' }}</h2>
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
              <table class="cost-table">
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
                  {{ dimensionNames[key] }}
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
              <table class="cost-table">
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
            @click="startExport"
          >
            导出全部匹配单据
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
            v-model="filters.search"
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
    <footer v-if="report">数据更新时间 {{ updatedAt }} · 统计范围以当前授权为准</footer>
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
          <dt>采购与损耗</dt>
          <dd>采用成本台账登记金额分别统计，不重算采购订单、库存估值或利润。</dd>
        </dl>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { type CostCategory, type CostScope } from '@/api/core/bi-cost-dashboard'
import { ElMessage } from 'element-plus'
import EchartsChart from './components/EchartsChart.vue'
import CostRing from './cost/CostRing.vue'
import CostComparisonBars from './cost/CostComparisonBars.vue'
import CostRecordsTable from './cost/CostRecordsTable.vue'
import { costDialog as vCostDialog } from './cost/cost-dialog'
import { useCostDashboard } from './cost/use-cost-dashboard'
import { useCostDashboardExport } from './cost/use-cost-dashboard-export'
import {
  bars,
  categories,
  dimensionNames,
  detailDimensionValue,
  visibleDetailDimensions,
  dimensions,
  eventKey,
  line,
  money,
  percent,
  signed,
  statusName,
  matrixTotal,
  overviewReading,
  payrollHasRecords,
  comparisonCoverageNotice,
} from './cost/cost-presentation'
const {
  report,
  records,
  error,
  loading,
  section,
  perspective,
  filters,
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
} = useCostDashboard()
const costAreas: { title: string; description: string; categories: CostCategory[] }[] = [
  { title: '人 · 人力', description: '底薪、绩效、提成（含激励）', categories: ['labor'] },
  {
    title: '货 · 商品',
    description: '采购与损耗分列，不计入经营费用',
    categories: ['purchase', 'loss'],
  },
  {
    title: '运 · 运费',
    description: '厂家至中心仓、中心仓至城市、城市至客户',
    categories: ['freight'],
  },
  {
    title: '场 · 场地',
    description: '仓储、办公租赁及办公费用',
    categories: ['warehouse', 'office', 'premises_unknown'],
  },
  { title: '营 · 营销', description: '推广、广告、代言等事项', categories: ['marketing'] },
  { title: '报 · 报销', description: '差旅、住宿、打车及其他未归集报销', categories: ['expense'] },
]
function categoryAmount(category: CostCategory) {
  if (category === 'purchase') return report.value?.purchase
  if (category === 'loss') return report.value?.loss
  return report.value?.categories.find((group) => group.key === category)?.current ?? '0.00'
}
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
  direction = ref('increase'),
  matrixMode = ref<'amount' | 'share' | 'delta'>('amount')
const tabs = [
  { key: 'overview', label: '费用总览' },
  { key: 'analysis', label: '费用分析' },
  { key: 'records', label: '支出明细' },
] as const
const perspectives = [
  { key: 'cities', label: '归属对比' },
  { key: 'structure', label: '费用构成' },
  { key: 'objects', label: '支出对象' },
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
      { key: 'purchase', label: '商品采购' },
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
const topChanges = computed(
  () => report.value?.changes.filter((c) => c.direction === direction.value).slice(0, 3) || [],
)
const structureGroups = computed(() =>
  filters.scope === 'opex' ? report.value?.categories || [] : report.value?.cityGroups || [],
)
const topicCategories = computed(() =>
  available.value.filter((c) => filters.scope === (c === 'purchase' || c === 'loss' ? c : 'opex')),
)
const topicDimensions = computed(() => (filters.category ? dimensions[filters.category] : []))
const payrollRecorded = computed(() => !!report.value && payrollHasRecords(report.value))
const overviewSummary = computed(() =>
  report.value ? overviewReading(report.value, comparisonLabel.value) : '',
)
const comparisonNotice = computed(() =>
  report.value ? comparisonCoverageNotice(report.value) : '',
)

function deltaClass(value: string | null) {
  return Number(value) > 0 ? 'increase' : Number(value) < 0 ? 'decrease' : ''
}
function categoryDrill(key: string) {
  void openAnalysis({ category: key as CostCategory })
}
function structureDrill(key: string) {
  if (filters.scope === 'opex') categoryDrill(key)
  else void openAnalysis({ city: key })
}
function cityChartClick(event: unknown) {
  const city = eventKey(event)
  if (city) void openAnalysis({ city })
}
function objectChartClick(event: unknown) {
  const dimensionKey = eventKey(event)
  if (dimensionKey) void openAnalysis({ dimensionKey })
}
const monthChart = computed(() =>
  bars(
    (report.value?.months || []).map((m) => ({
      key: `${m.year}-${m.month}`,
      label: `${m.month}月${m.cutoff.slice(8) !== new Date(m.year, m.month, 0).getDate().toString() ? `\n截至${Number(m.cutoff.slice(8))}日` : ''}`,
      current: m.current,
      previous: m.previous,
      delta: null,
      growth: null,
      share: null,
      count: 0,
      missing: false,
    })),
    !!report.value?.months.some((m) => m.previous !== null),
    12,
  ),
)
function monthChartClick(event: unknown) {
  const key = eventKey(event)
  if (!key) return
  const [year, month] = key.split('-').map(Number)
  filters.year = year
  filters.month = month
  globalChange()
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
function searchRecords() {
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
</script>
<style lang="scss" src="./cost/cost-dashboard.scss"></style>
