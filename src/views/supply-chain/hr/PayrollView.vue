<template>
  <div class="supply-page payroll-page payroll-v03-page">
    <div class="page-heading">
      <div>
        <SupplyPageTitle>月度薪酬</SupplyPageTitle>
        <p>选择月份和人员，按当月生效的档案与规则计算工资。</p>
      </div>
      <el-button
        v-if="can('hr:payroll:calculate')"
        type="primary"
        :disabled="batchBusy"
        @click="calculateVisible = true"
        >生成月度薪酬</el-button
      >
    </div>
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <el-card class="filter-card" shadow="never"
      ><el-form label-position="top" :disabled="batchBusy" @submit.prevent="search"
        ><el-form-item label="薪酬月份"
          ><el-date-picker
            v-model="month"
            type="month"
            value-format="YYYY-MM"
            placeholder="薪酬月份"
            :clearable="false" /></el-form-item
        ><el-form-item label="员工"
          ><el-input
            v-model="keyword"
            clearable
            placeholder="员工姓名 / 编号"
            @keyup.enter="search" /></el-form-item
        ><el-form-item label="部门"
          ><el-tree-select
            v-model="departmentId"
            :data="departmentOptionsTree"
            node-key="id"
            :props="departmentTreeProps"
            check-strictly
            clearable
            filterable
            default-expand-all
            :render-after-expand="false"
            placeholder="全部部门"
            aria-label="部门筛选" /></el-form-item
        ><el-form-item label="薪资类别"
          ><el-select v-model="payrollCategory" clearable placeholder="全部类别">
            <el-option
              v-for="role in payrollRoles"
              :key="role.value"
              v-bind="role"
            /> </el-select></el-form-item
        ><el-form-item class="filter-actions"
          ><el-button type="primary" :loading="loading" @click="search">查询</el-button
          ><el-button @click="reset">重置</el-button></el-form-item
        ></el-form
      ></el-card
    >
    <el-alert
      v-if="month >= thisMonth()"
      title="当前或未来月份仅供预核算，月份结束后才能确认发放。"
      type="info"
      :closable="false"
    />
    <PayrollPreparationPanel
      ref="preparationPanel"
      v-model="calculateVisible"
      v-model:month="month"
      :department-id="departmentId"
      @changed="load"
    />
    <PayrollSettlementDialog ref="settlementDialog" @changed="workflowChanged" />
    <PayrollBatchDialog ref="batchDialog" @changed="workflowChanged" @busy="batchBusy = $event" />
    <section class="payroll-results-overview" aria-label="月度薪酬状态与汇总">
      <div class="workflow-filter">
        <el-radio-group
          v-model="statusCode"
          :disabled="batchBusy"
          aria-label="月度薪酬处理阶段"
          @change="search"
        >
          <el-radio-button v-for="stage in workflowStages" :key="stage.code" :value="stage.code">
            {{ stage.label }}（{{ stageCount(stage.code) }}）
          </el-radio-button>
        </el-radio-group>
        <el-tooltip :content="workflowHint" placement="top" :trigger="['hover', 'focus']">
          <button type="button" class="summary-help workflow-help" aria-label="查看薪酬状态说明">
            <el-icon><InfoFilled /></el-icon>
            <span>状态说明</span>
          </button>
        </el-tooltip>
      </div>
      <div class="payroll-summary" aria-live="polite" :aria-busy="loading">
        <div class="summary-card">
          <div class="summary-label">核算人数</div>
          <div class="summary-value">
            <strong>{{ summary?.total ?? '—' }}</strong
            ><span>人</span>
          </div>
          <div class="summary-completion">
            完整核算 {{ summary?.completeCount ?? '—' }} 人 /
            <span :class="{ 'summary-pending': (summary?.pendingCount ?? 0) > 0 }">
              待核定 {{ summary?.pendingCount ?? '—' }} 人
            </span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-card-heading">
            <span class="summary-label">应发合计（元）</span>
            <el-tooltip
              content="合计仅含当前筛选下的完整结果，不受列表分页影响。待核定工资暂不计入金额合计。"
              placement="top"
              :trigger="['hover', 'focus']"
            >
              <button
                type="button"
                class="summary-help"
                aria-label="查看汇总口径：合计仅含当前筛选下的完整结果"
              >
                <el-icon><InfoFilled /></el-icon>
              </button>
            </el-tooltip>
          </div>
          <div class="summary-value">
            <strong>{{ summary?.completeCount ? payrollMoney(summary.grossPay) : '—' }}</strong>
          </div>
          <div class="summary-completion">
            当前筛选 · {{ summary?.completeCount ?? '—' }} 人计入合计
          </div>
        </div>
        <div class="summary-card summary-payable">
          <div class="summary-label">应付合计（元）</div>
          <div class="summary-value">
            <strong>{{ summary?.completeCount ? payrollMoney(summary.netPay) : '—' }}</strong>
          </div>
          <div class="summary-completion">应发减其他扣款 · 实际发放见工资表</div>
        </div>
      </div>
    </section>
    <el-card class="list-card" shadow="never">
      <div class="payroll-list-heading">
        <h3>员工月度工资表</h3>
        <span>单位：元</span>
      </div>
      <div class="result-heading">
        <div class="list-tools">
          <span>已选本页 {{ selection.length }} 人</span>
          <el-button
            v-if="can('hr:payroll:confirm')"
            :disabled="!selection.length || loading || saving || batchBusy"
            @click="batchDialog?.open(selection, 'confirm')"
            >批量确认</el-button
          >
          <el-button
            v-if="can('hr:payroll:calculate')"
            :disabled="!selection.length || loading || saving || batchBusy"
            @click="batchDialog?.open(selection, 'recalculate')"
            >批量重算</el-button
          >
        </div>
        <div class="list-tools">
          <el-button :loading="exporting" @click="exportAll">导出筛选结果</el-button>
          <el-button :loading="loading" :disabled="batchBusy" @click="workflowChanged"
            >刷新</el-button
          >
        </div>
      </div>
      <div class="table-viewport">
        <el-table
          ref="payrollTable"
          v-loading="loading"
          :data="page.items"
          row-key="id"
          border
          class="business-table supply-scroll-table"
          @selection-change="selection = $event"
        >
          <el-table-column
            v-if="can('hr:payroll:confirm') || can('hr:payroll:calculate')"
            type="selection"
            width="44"
            fixed="left"
            :selectable="() => !batchBusy && !saving"
          />
          <el-table-column label="员工 / 部门" width="165" fixed="left">
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                :title="row.employeeCode"
                @click="showDetail(row as PayrollRecord)"
                >{{ row.employeeName }}</el-button
              >
              <div class="employee-meta">{{ row.employeeCode }}</div>
              <div class="employee-meta">
                {{ row.departmentName }} · {{ payrollRole(row as PayrollRecord) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column
            v-for="field in moneyFields"
            :key="field.key"
            :label="field.label + '（元）'"
            min-width="100"
            align="right"
          >
            <template #default="{ row }"
              ><span :class="{ 'payroll-total': field.key === 'netPay' }">{{
                payrollMoney(row.calculation[field.key])
              }}</span></template
            >
          </el-table-column>
          <el-table-column label="实际发放（元）" min-width="105" align="right"
            ><template #default="{ row }">{{
              payrollMoney(payrollPaid(row as PayrollRecord))
            }}</template></el-table-column
          >
          <el-table-column label="状态" width="95">
            <template #default="{ row }">
              <el-button
                v-if="row.statusCode === 'REVIEW'"
                link
                type="warning"
                @click="showDetail(row as PayrollRecord, 'review')"
              >
                待处理<span v-if="row.calculation.issues.length">
                  · {{ payrollReviewGroups(row.calculation.issues).length }}类</span
                >
              </el-button>
              <el-tag v-else :type="row.statusCode === 'PAID' ? 'success' : 'primary'">{{
                payrollStatusLabel(
                  row as PayrollRecord,
                  costLabel('PAYROLL_STATUS', row.statusCode),
                )
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="170" fixed="right">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button link type="primary" @click="showDetail(row as PayrollRecord)"
                  >明细</el-button
                >
                <el-button
                  v-if="row.statusCode === 'REVIEW'"
                  link
                  type="primary"
                  @click="showDetail(row as PayrollRecord, 'review')"
                  >处理</el-button
                >
                <el-button
                  v-if="row.statusCode === 'READY' && can('hr:payroll:confirm')"
                  link
                  type="primary"
                  :disabled="saving || batchBusy || row.month >= thisMonth()"
                  @click="settlementDialog?.open(row as PayrollRecord, 'confirm')"
                  >确认</el-button
                >
                <el-button
                  v-if="row.statusCode === 'CONFIRMED' && can('hr:payroll:paid')"
                  link
                  type="primary"
                  :disabled="saving || batchBusy"
                  @click="settlementDialog?.open(row as PayrollRecord, 'paid')"
                  >登记发放</el-button
                >
                <el-dropdown
                  v-if="can('hr:payroll:calculate') || can('hr:payroll:confirm')"
                  trigger="click"
                  :disabled="saving || batchBusy"
                >
                  <el-button link :disabled="saving || batchBusy" aria-label="更多工资操作"
                    >更多</el-button
                  >
                  <template #dropdown
                    ><el-dropdown-menu>
                      <el-dropdown-item
                        v-if="unlocked(row as PayrollRecord) && can('hr:payroll:calculate')"
                        @click="recalculate(row as PayrollRecord)"
                        >重新核算</el-dropdown-item
                      >
                      <el-dropdown-item
                        v-if="unlocked(row as PayrollRecord) && can('hr:payroll:calculate')"
                        @click="editInput(row as PayrollRecord)"
                        >人工调整</el-dropdown-item
                      >
                      <el-dropdown-item
                        v-if="
                          row.statusCode === 'CONFIRMED' &&
                          !row.payments?.length &&
                          can('hr:payroll:confirm')
                        "
                        @click="settlementDialog?.open(row as PayrollRecord, 'reopen')"
                        >撤回确认</el-dropdown-item
                      >
                      <el-dropdown-item
                        v-if="
                          (row.statusCode === 'PAID' || row.payments?.length) &&
                          can('hr:payroll:confirm')
                        "
                        @click="settlementDialog?.open(row as PayrollRecord, 'correct')"
                        >补差 / 冲回</el-dropdown-item
                      >
                    </el-dropdown-menu></template
                  >
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :disabled="batchBusy"
        :total="page.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="search"
      />
    </el-card>
    <el-dialog
      v-model="inputVisible"
      :title="'人工调整 · ' + (inputRow?.employeeName || '') + ' · ' + (inputRow?.month || '')"
      width="min(680px, 95vw)"
      :close-on-click-modal="false"
      ><el-alert v-if="inputError" :title="inputError" type="error" :closable="false" /><el-alert
        title="只填写需要核定的内容，留空沿用原来源。填写一次说明，保存后自动重算。核定仅影响本人工资及对应订单的提成计算，原始资料保留。"
        type="info"
        :closable="false"
      />
      <el-button
        link
        type="primary"
        :disabled="inputLoading || saving"
        @click="restoreRuleCalculation"
        >清除核定覆盖，恢复规则计算</el-button
      >
      <el-form v-loading="inputLoading" label-width="120px"
        ><el-form-item label="核定部门">
          <el-tree-select
            v-model="input.departmentOverrideId"
            :data="departmentOptionsTree"
            node-key="id"
            :props="departmentTreeProps"
            check-strictly
            clearable
            filterable
            default-expand-all
            :render-after-expand="false"
            placeholder="留空沿用任职记录"
            aria-label="核定部门"
          />
          <p class="field-hint">
            档案部门：{{ inputRow?.departmentName || '未填写' }}。选定后用于
            {{ inputRow?.month }} 的绩效、补贴及当月订单提成。
          </p>
        </el-form-item>
        <el-form-item label="核定绩效（元）">
          <el-input-number
            v-model="input.performanceOverride"
            :min="0"
            :precision="2"
            placeholder="留空按规则计算"
            aria-label="核定绩效"
            style="width: 220px; max-width: 100%"
          />
          <p class="field-hint">
            {{
              inputRow?.calculation.performanceDetail
                ? '填写打卡与有效拜访绩效＋回款达标绩效的合计'
                : '填写本月最终绩效金额（含综合系数及折算）'
            }}；填 0 表示本月不发绩效。
          </p>
          <p v-if="inputRow?.calculation.performanceDetail" class="field-hint">
            当前依据：打卡与有效拜访
            {{ costMoney(inputRow.calculation.performanceDetail.processPay) }} 元；回款
            {{ costMoney(inputRow.calculation.performanceDetail.collectionPay) }} 元。
          </p>
        </el-form-item>
        <el-collapse v-model="determinationExtra">
          <el-collapse-item title="其他金额（按需调整）" name="amount">
            <el-form-item label="当月底薪（元）"
              ><el-input-number
                v-model="input.baseOverride"
                :min="0"
                :precision="2" /></el-form-item
            ><el-form-item label="当月补贴（元）"
              ><el-input-number v-model="input.allowanceOverride" :min="0" :precision="2" />
              <p class="field-hint">
                月内生效、停发或金额变化由 HR 核定，填写原因后覆盖当月补贴合计。
              </p></el-form-item
            ><el-form-item label="扣款（元）" required
              ><el-input-number v-model="input.deduction" :min="0" :precision="2"
            /></el-form-item>
          </el-collapse-item>
        </el-collapse>
        <el-form-item label="核定说明" required
          ><el-input
            v-model="input.reason"
            aria-label="核定说明"
            type="textarea"
            maxlength="500"
            show-word-limit /></el-form-item></el-form
      ><template #footer
        ><el-button @click="inputVisible = false">取消</el-button
        ><el-button type="primary" :disabled="inputLoading" :loading="saving" @click="saveInput"
          >保存并重新核算</el-button
        ></template
      ></el-dialog
    >
    <el-drawer
      v-model="detailVisible"
      title="员工月度薪酬明细"
      size="min(1440px, 96vw)"
      class="payroll-payslip"
      destroy-on-close
      ><template v-if="detail"
        ><div class="payslip-heading">
          <strong>{{ detail.employeeName }}</strong
          ><span>{{ detail.employeeCode }}</span>
          <span>{{ detail.departmentName }} · {{ payrollRole(detail) }}</span
          ><span>{{ detail.month }}</span>
          <el-tag>{{
            payrollStatusLabel(detail, costLabel('PAYROLL_STATUS', detail.statusCode))
          }}</el-tag>
          <div class="payslip-payable">
            <span>应付工资（元）</span
            ><strong>{{ payrollMoney(detail.calculation.netPay) }}</strong>
          </div>
          <el-tag
            v-if="
              detail.calculation.input.baseOverride != null ||
              detail.calculation.input.performanceOverride != null ||
              detail.calculation.input.allowanceOverride != null ||
              detail.calculation.input.departmentOverrideId != null
            "
            type="info"
            >本月已采用人工核定</el-tag
          >
          <el-button :loading="exporting" @click="exportDetail">导出明细 Excel</el-button>
        </div>
        <el-tabs v-model="detailTab">
          <el-tab-pane label="工资组成" name="overview"
            ><PayrollSalaryOverview :row="detail"
          /></el-tab-pane>
          <el-tab-pane
            v-if="detail.statusCode === 'REVIEW' || detail.calculation.issues.length"
            label="待处理事项"
            name="review"
          >
            <p class="field-hint">
              先在员工档案、规则设置或来源系统处理缺项，再重新计算。确需人工调整时，填写调整金额及原因。
            </p>
            <div v-if="detail.calculation.issues.length" class="review-groups">
              <section
                v-for="group in payrollReviewGroups(detail.calculation.issues)"
                :key="group.key"
                class="review-task"
              >
                <div class="review-task-heading">
                  <strong>{{ group.label }}</strong>
                  <el-button
                    v-if="group.determination && can('hr:payroll:calculate') && unlocked(detail)"
                    type="primary"
                    link
                    :disabled="saving"
                    @click="editInput(detail, group.determination)"
                    >人工调整</el-button
                  >
                </div>
                <p>{{ group.hint }}</p>
                <el-collapse
                  ><el-collapse-item
                    :title="`查看原始明细（${group.items.length} 条）`"
                    :name="group.key"
                  >
                    <ul>
                      <li v-for="issue in group.items" :key="issue">{{ issue }}</li>
                    </ul>
                  </el-collapse-item></el-collapse
                >
              </section>
            </div>
            <el-empty v-else description="当前快照没有具体原因，请重新核算获取最新结果" />
          </el-tab-pane>
          <el-tab-pane
            v-if="detail.calculation.performanceDetail || detail.calculation.scheme"
            label="绩效明细"
            name="performance"
          >
            <PayrollSchemeResult
              v-if="detail.calculation.scheme"
              :row="detail"
              @changed="workflowChanged"
            />
            <template v-if="detail.calculation.performanceDetail">
              <h3>每日打卡与有效拜访明细</h3>
              <el-table :data="detail.calculation.performanceDetail.days" border max-height="420"
                ><el-table-column prop="date" label="日期" width="115" /><el-table-column
                  prop="checkins"
                  label="有效打卡数"
                /><el-table-column prop="effectiveVisits" label="有效拜访客户数" /><el-table-column
                  prop="missingCheckins"
                  label="缺少打卡"
                /><el-table-column prop="missingVisits" label="缺少拜访" /><el-table-column
                  label="原始扣减（元）"
                  ><template #default="{ row }">{{
                    costMoney(row.deduction)
                  }}</template></el-table-column
                ><el-table-column label="核算状态"
                  ><template #default="{ row }">{{
                    row.evidenceComplete ? '已按规则计算' : '来源未关联'
                  }}</template></el-table-column
                ></el-table
              >
              <h3>当月回款依据</h3>
              <el-table :data="detail.calculation.performanceDetail.sources" border max-height="360"
                ><el-table-column prop="orderNo" label="订单号" min-width="180" /><el-table-column
                  prop="date"
                  label="回款日期"
                /><el-table-column label="金额（元）" align="right"
                  ><template #default="{ row }">{{
                    costMoney(row.amount)
                  }}</template></el-table-column
                ></el-table
              >
            </template>
          </el-tab-pane>
          <el-tab-pane label="提成明细" name="commission">
            <PayrollCommissionDetail
              :lines="detail.calculation.details"
              :total="detail.calculation.commission"
            />
          </el-tab-pane>
          <el-tab-pane label="规则依据" name="rules">
            <PayrollRuleEvidenceTable :row="detail" />
            <el-table v-if="detail.calculation.rules.length" :data="detail.calculation.rules" border
              ><el-table-column prop="data.name" label="规则" min-width="180" /><el-table-column
                label="类别"
                width="130"
                ><template #default="{ row }">{{
                  costLabel('PAYROLL_RULE_KIND', row.data.kindCode)
                }}</template></el-table-column
              ><el-table-column prop="revision" label="版本" width="70" /><el-table-column
                prop="data.effectiveFrom"
                label="生效日期"
                width="115"
              /><el-table-column
                prop="data.effectiveTo"
                label="截止日期"
                width="115"
              /><el-table-column label="金额 / 标准" min-width="130"
                ><template #default="{ row }">{{
                  row.data.kindCode === 'COMMISSION'
                    ? String(row.data.rate) +
                      (row.data.methodCode === 'PERCENT'
                        ? '%'
                        : ' 元/' + costLabel('PRODUCT_UNIT', row.data.unitCode))
                    : row.data.kindCode === 'CITY_MANAGER'
                      ? row.data.cityName
                      : costMoney(row.data.amount)
                }}</template></el-table-column
              ></el-table
            >
          </el-tab-pane>
          <el-tab-pane label="调整与历史" name="payments">
            <h3>人工调整</h3>
            <el-descriptions border :column="2"
              ><el-descriptions-item label="核定部门">{{
                detail.calculation.input.departmentOverrideId == null
                  ? '沿用任职记录'
                  : departmentName(detail.calculation.input.departmentOverrideId)
              }}</el-descriptions-item
              ><el-descriptions-item label="底薪调整">{{
                detail.calculation.input.baseOverride == null
                  ? '员工档案'
                  : costMoney(detail.calculation.input.baseOverride)
              }}</el-descriptions-item
              ><el-descriptions-item label="绩效调整">{{
                detail.calculation.input.performanceOverride == null
                  ? '使用规则'
                  : costMoney(detail.calculation.input.performanceOverride)
              }}</el-descriptions-item
              ><el-descriptions-item label="补贴核定">{{
                detail.calculation.input.allowanceOverride == null
                  ? '使用规则'
                  : costMoney(detail.calculation.input.allowanceOverride)
              }}</el-descriptions-item
              ><el-descriptions-item label="核定说明">{{
                detail.calculation.input.reason || '无调整'
              }}</el-descriptions-item></el-descriptions
            >
            <p v-if="detail.statusCode === 'PAID' && !detail.payments?.length" class="field-hint">
              历史已发放单尚无结构化凭证，原说明见操作记录。
            </p>
            <h3>发放登记</h3>
            <el-table :data="detail.payments ?? []" border
              ><el-table-column prop="paidDate" label="实际日期" width="120" /><el-table-column
                label="金额"
                width="120"
                ><template #default="{ row }">{{
                  costMoney(row.amount)
                }}</template></el-table-column
              ><el-table-column
                prop="referenceNo"
                label="凭证号 / 流水号"
                min-width="160" /><el-table-column prop="reason" label="说明" min-width="180"
            /></el-table>
            <h3>本月计入的补差</h3>
            <el-table :data="detail.calculation.corrections ?? []" border
              ><el-table-column prop="sourceMonth" label="原工资月份" /><el-table-column
                label="差额"
                ><template #default="{ row }">{{
                  costMoney(row.amount)
                }}</template></el-table-column
              ><el-table-column prop="reason" label="原因" min-width="220"
            /></el-table>
            <h3>从本单发起的补差</h3>
            <el-table :data="detail.correctionsIssued ?? []" border
              ><el-table-column prop="targetMonth" label="计入月份" /><el-table-column label="差额"
                ><template #default="{ row }">{{
                  costMoney(row.amount)
                }}</template></el-table-column
              ><el-table-column prop="reason" label="原因" min-width="160" /><el-table-column
                label="状态"
                ><template #default="{ row }">{{
                  row.statusCode === 'VOID' ? '已作废' : '有效'
                }}</template></el-table-column
              ><el-table-column label="操作"
                ><template #default="{ row }"
                  ><el-button
                    v-if="row.statusCode === 'ACTIVE' && can('hr:payroll:confirm')"
                    link
                    type="danger"
                    @click="voidCorrection(row as PayrollCorrection)"
                    >作废</el-button
                  ></template
                ></el-table-column
              ></el-table
            >
            <h3>操作记录</h3>
            <el-alert
              v-if="historyError"
              :title="historyError"
              type="error"
              :closable="false"
            /><el-timeline v-loading="historyLoading"
              ><el-timeline-item
                v-for="(entry, index) in history"
                :key="index"
                :timestamp="entry.occurredTime"
                ><strong>{{ auditLabel(entry.action) }}</strong>
                <p>{{ entry.reason || '—' }}</p>
                <p class="field-hint">操作人：{{ entry.actorId }}</p></el-timeline-item
              ></el-timeline
            ></el-tab-pane
          ></el-tabs
        >
      </template>
      <template #footer>
        <PayrollWorkflowActions
          v-if="detail"
          :row="detail"
          :current-month="thisMonth()"
          :can-calculate="can('hr:payroll:calculate')"
          :can-confirm="can('hr:payroll:confirm')"
          :can-pay="can('hr:payroll:paid')"
          :busy="saving || historyLoading || batchBusy"
          @close="detailVisible = false"
          @adjust="editInput(detail)"
          @recalculate="recalculate(detail)"
          @confirm="settlementDialog?.open(detail, 'confirm')"
          @paid="settlementDialog?.open(detail, 'paid')"
          @payments="detailTab = 'payments'"
        /> </template
    ></el-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type TableInstance } from 'element-plus'
import PayrollBatchDialog from './components/PayrollBatchDialog.vue'
import type { PayrollSummary } from '@/api/core/payroll/models/PayrollSummary'
import PayrollSchemeResult from './components/PayrollSchemeResult.vue'
import PayrollPreparationPanel from './components/PayrollPreparationPanel.vue'
import PayrollSettlementDialog from './components/PayrollSettlementDialog.vue'
import PayrollWorkflowActions from './components/PayrollWorkflowActions.vue'
import PayrollCommissionDetail from './components/PayrollCommissionDetail.vue'
import PayrollSalaryOverview from './components/PayrollSalaryOverview.vue'
import PayrollRuleEvidenceTable from './components/PayrollRuleEvidenceTable.vue'
import {
  previousPayrollMonth,
  payrollPaid,
  payrollReviewGroups,
  payrollStatusLabel,
  payrollMoney,
  payrollRole,
} from '@/utils/payroll-workflow'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { errorMessage } from '@/api/core/error'
import { departmentTree } from '@/utils/hr-department-tree'
import type { CostAudit } from '@/api/core/cost'
import {
  calculatePayroll,
  exportPayroll,
  getPayrollDetail,
  cancelPayrollCorrection,
  type PayrollCorrection,
  getPayroll,
  getPayrollSummary,
  getPayrollDepartments,
  getPayrollHistory,
  getPayrollInput,
  savePayrollInput,
  type PayrollCalculation,
  type PayrollInput,
  type PayrollDepartment,
  type PayrollPage,
  type PayrollRecord,
} from '@/api/core/payroll'
import { costLabel, costMoney } from '../cost/cost-dictionaries'
import { exportPayrollRecords, exportPayrollDetails } from '@/utils/payroll-detail-export'
import { loadBusinessDictionaries } from '@/utils/business-dictionary'
import { auditLabel } from '../cost/cost-audit'
import { payrollRoles } from '@/utils/payroll-scheme'
const { can } = useSupplyPermissions()
function thisMonth() {
  const date = new Date()
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
}
const month = ref(previousPayrollMonth()),
  keyword = ref(''),
  statusCode = ref(''),
  payrollCategory = ref(''),
  departmentId = ref<number | undefined>(),
  currentPage = ref(1),
  pageSize = ref(20)
const workflowStages = [
  { code: '', label: '全部', hint: '先进行月度核算，再按处理阶段查看本月薪酬。' },
  {
    code: 'REVIEW',
    label: '待处理',
    hint: '存在档案、规则或来源缺项，点击待处理数量查看原因；补齐后重算。',
  },
  {
    code: 'READY',
    label: '待确认',
    hint: '核对底薪、绩效、提成和补贴后确认，确认后锁定本月核算快照。',
  },
  { code: 'CONFIRMED', label: '待发放', hint: '已确认薪酬；实际发放完成后登记发放记录。' },
  { code: 'PAID', label: '已发放', hint: '查看已登记发放的薪酬明细和操作记录。' },
]
const workflowHint = computed(
  () => workflowStages.find((stage) => stage.code === statusCode.value)?.hint,
)
const loading = ref(false),
  loadError = ref(''),
  saving = ref(false)
const preparationPanel = ref<InstanceType<typeof PayrollPreparationPanel>>(),
  settlementDialog = ref<InstanceType<typeof PayrollSettlementDialog>>()
const summary = ref<PayrollSummary | null>(null)
const payrollTable = ref<TableInstance>()
const selection = ref<PayrollRecord[]>([])
const batchDialog = ref<InstanceType<typeof PayrollBatchDialog>>()
const batchBusy = ref(false)
function stageCount(code: string) {
  if (!summary.value) return '—'
  return code
    ? summary.value.statusCounts[code] || 0
    : Object.values(summary.value.statusCounts).reduce((sum, n) => sum + n, 0)
}
async function exportDetail() {
  if (!detail.value) return
  exporting.value = true
  try {
    await exportPayrollDetails(detail.value)
  } catch (e) {
    ElMessage.error(errorMessage(e, '导出明细失败'))
  } finally {
    exporting.value = false
  }
}
async function workflowChanged() {
  await Promise.all([load(), preparationPanel.value?.refresh()])
  if (detailVisible.value && detail.value) detail.value = await getPayrollDetail(detail.value.id)
}
const page = ref<PayrollPage<PayrollRecord>>({ total: 0, begin: 0, step: 20, items: [] })
const departments = ref<PayrollDepartment[]>([])
const departmentTreeProps = { label: 'name', children: 'children' }
const departmentOptionsTree = computed(() => departmentTree(departments.value))
function departmentName(id: number) {
  return departments.value.find((d) => d.id === id)?.name || `部门 ${id}`
}
const moneyFields: {
  key: keyof Pick<
    PayrollCalculation,
    | 'baseSalary'
    | 'performance'
    | 'commission'
    | 'heldCommission'
    | 'allowance'
    | 'deduction'
    | 'grossPay'
    | 'netPay'
    | 'correctionAmount'
  >
  label: string
}[] = [
  { key: 'baseSalary', label: '底薪' },
  { key: 'performance', label: '绩效' },
  { key: 'allowance', label: '补贴' },
  { key: 'commission', label: '提成' },
  { key: 'correctionAmount', label: '补发补扣' },
  { key: 'deduction', label: '其他扣款' },
  { key: 'grossPay', label: '应发工资' },
  { key: 'netPay', label: '应付工资' },
]
const calculateVisible = ref(false)
const determinationExtra = ref<string[]>([])
const inputVisible = ref(false),
  inputLoading = ref(false),
  inputError = ref(''),
  inputRow = ref<PayrollRecord | null>(null),
  input = ref<PayrollInput>({
    revision: 0,
    baseOverride: null,
    performanceOverride: null,
    deduction: 0,
    reason: '',
  })
const detailVisible = ref(false),
  detailTab = ref('overview'),
  detail = ref<PayrollRecord | null>(null),
  history = ref<CostAudit[]>([]),
  historyLoading = ref(false),
  historyError = ref('')
let loadVersion = 0
async function load() {
  const version = ++loadVersion
  loading.value = true
  loadError.value = ''
  try {
    selection.value = []
    payrollTable.value?.clearSelection()
    summary.value = null
    const query = {
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      month: month.value,
      keyword: keyword.value || undefined,
      departmentId: departmentId.value || undefined,
      statusCode: statusCode.value || undefined,
      payrollCategory: payrollCategory.value || undefined,
    }
    const [result, totals] = await Promise.all([getPayroll(query), getPayrollSummary(query)])
    if (version === loadVersion) {
      page.value = result
      summary.value = totals
    }
  } catch (e) {
    if (version === loadVersion) {
      summary.value = null
      page.value.items = []
      page.value.total = 0
      loadError.value = errorMessage(e, '薪酬查询失败')
    }
  } finally {
    if (version === loadVersion) loading.value = false
  }
}
function search() {
  currentPage.value = 1
  void load()
}
function reset() {
  keyword.value = ''
  departmentId.value = undefined
  statusCode.value = ''
  payrollCategory.value = ''
  month.value = previousPayrollMonth()
  search()
}
function unlocked(row: PayrollRecord) {
  return row.statusCode === 'REVIEW' || row.statusCode === 'READY'
}
async function recalculate(row: PayrollRecord) {
  saving.value = true
  try {
    const results = await calculatePayroll(row.month, [row.employeeCode])
    await workflowChanged()
    await presentCalculation(results.find((r) => r.employeeCode === row.employeeCode))
  } catch (e) {
    ElMessage.error(errorMessage(e, '重新核算失败'))
  } finally {
    saving.value = false
  }
}
async function presentCalculation(result?: PayrollRecord, prefix = '已重新核算') {
  if (!result) {
    ElMessage.warning(`${prefix}，请刷新检查结果`)
    return
  }
  await showDetail(result)
  if (result.statusCode === 'REVIEW') {
    ElMessage.warning(
      `${prefix}，仍有 ${payrollReviewGroups(result.calculation.issues).length} 类问题待处理`,
    )
  } else if (result.statusCode === 'READY') {
    ElMessage.success(`${prefix}，检查通过，已进入待确认`)
  }
}
async function editInput(row: PayrollRecord, target?: 'department' | 'performance' | 'amount') {
  inputRow.value = row
  determinationExtra.value = target === 'amount' ? ['amount'] : []
  inputVisible.value = true
  inputLoading.value = true
  inputError.value = ''
  try {
    input.value = await getPayrollInput(row.month, row.employeeCode)
  } catch (e) {
    inputError.value = errorMessage(e, '月度调整读取失败')
    inputVisible.value = false
    ElMessage.error(inputError.value)
  } finally {
    inputLoading.value = false
  }
}
function restoreRuleCalculation() {
  input.value.baseOverride = null
  input.value.performanceOverride = null
  input.value.allowanceOverride = null
  input.value.departmentOverrideId = null
  input.value.reason = '恢复员工薪资档案与规则计算'
}
async function saveInput() {
  if (saving.value || inputLoading.value) return
  if (!inputRow.value || !input.value.reason.trim()) {
    inputError.value = '请填写核定说明'
    return
  }
  saving.value = true
  inputError.value = ''
  try {
    await savePayrollInput(inputRow.value.month, inputRow.value.employeeCode, input.value)
    inputVisible.value = false
    try {
      const results = await calculatePayroll(inputRow.value.month, [inputRow.value.employeeCode])
      await presentCalculation(
        results.find((r) => r.employeeCode === inputRow.value?.employeeCode),
        '核定已保存并重新核算',
      )
    } catch (e) {
      ElMessage.warning('核定已保存，但重新核算失败：' + errorMessage(e, '请稍后在列表重新核算'))
    }
    await workflowChanged()
  } catch (e) {
    inputError.value = errorMessage(e, '保存调整失败')
  } finally {
    saving.value = false
  }
}
async function voidCorrection(correction: PayrollCorrection) {
  if (!detail.value) return
  try {
    const { value } = await ElMessageBox.prompt(
      '目标月份确认后不能作废；请填写作废原因。',
      '作废补差',
      {
        inputValidator: (v) => !!v?.trim() || '请填写原因',
        confirmButtonText: '作废',
        cancelButtonText: '取消',
      },
    )
    await cancelPayrollCorrection(detail.value.id, correction, value.trim())
    await showDetail(await getPayrollDetail(detail.value.id))
    await workflowChanged()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(errorMessage(e, '作废失败'))
  }
}
async function showDetail(row: PayrollRecord, tab?: string) {
  detail.value = row
  detailTab.value = tab || 'overview'
  detailVisible.value = true
  history.value = []
  historyError.value = ''
  historyLoading.value = true
  try {
    const [fresh, logs] = await Promise.all([getPayrollDetail(row.id), getPayrollHistory(row.id)])
    detail.value = fresh
    history.value = logs
  } catch (e) {
    historyError.value = errorMessage(e, '操作记录加载失败')
  } finally {
    historyLoading.value = false
  }
}
const exporting = ref(false)
async function exportAll() {
  exporting.value = true
  try {
    const targetMonth = month.value
    const rows = await exportPayroll({
      begin: 0,
      step: 200,
      month: targetMonth,
      keyword: keyword.value || undefined,
      departmentId: departmentId.value,
      statusCode: statusCode.value || undefined,
      payrollCategory: payrollCategory.value || undefined,
    })
    if (!rows.length) {
      ElMessage.info('当前筛选下暂无工资数据')
      return
    }
    await exportPayrollRecords(rows, '薪酬明细_' + targetMonth)
  } catch (e) {
    ElMessage.error(errorMessage(e, '整月导出失败'))
  } finally {
    exporting.value = false
  }
}
onMounted(async () => {
  void load()
  const results = await Promise.allSettled([
    loadBusinessDictionaries(
      ['PAYROLL_STATUS', 'PAYROLL_RULE_KIND', 'COMMISSION_RECIPIENT_ROLE', 'PRODUCT_UNIT'].map(
        (code) => ({ moduleCode: '', code }),
      ),
    ),
    getPayrollDepartments(false),
  ])
  const deps = results[1]
  if (deps.status === 'fulfilled') departments.value = deps.value
  results.forEach((r) => {
    if (r.status === 'rejected') ElMessage.error(errorMessage(r.reason, '薪酬选项加载失败'))
  })
})
</script>
<style scoped lang="scss">
.payslip-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding: 8px 0;
  flex: 0 0 auto;
  font-size: 13px;
}
.payslip-heading {
  margin-bottom: 12px;
}
.payslip-heading strong {
  font-size: 18px;
}
.payslip-heading .el-button {
  margin-left: auto;
}
.payroll-summary strong,
.payroll-total {
  font-variant-numeric: tabular-nums;
}
.workflow-filter {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
}
.workflow-filter :deep(.el-radio-group) {
  min-width: 0;
  flex-wrap: nowrap;
  overflow-x: auto;
}
.payroll-results-overview {
  flex: 0 0 auto;
  min-width: 0;
}
.payroll-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  font-size: 13px;
}
.summary-card {
  min-width: 0;
  padding: 16px 20px;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--el-border-radius-base);
  background: var(--el-bg-color);
}
.summary-card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.summary-label {
  color: var(--el-text-color-regular);
  line-height: 24px;
}
.summary-completion {
  color: var(--el-text-color-regular);
  line-height: 20px;
}
.summary-pending {
  color: var(--el-color-warning-dark-2);
}
.summary-value {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;
  line-height: 34px;
  overflow-wrap: anywhere;
}
.summary-value strong {
  font-size: 26px;
  font-weight: 600;
}
.summary-payable .summary-value strong {
  color: var(--el-color-primary);
}
@media (max-width: 900px) {
  .payroll-summary {
    grid-template-columns: 1fr;
  }
}
.summary-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  gap: 4px;
  padding: 4px;
  border: 0;
  border-radius: var(--el-border-radius-small);
  background: transparent;
  color: var(--el-text-color-secondary);
  font: inherit;
  font-size: 13px;
  cursor: help;
}
.summary-help:hover,
.summary-help:focus-visible {
  color: var(--el-color-primary);
}
.summary-help:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.workflow-help {
  white-space: nowrap;
}
.payroll-page > .filter-card {
  flex: 0 0 auto;
}
.payroll-page > .filter-card :deep(.el-card__body) {
  overflow: visible;
  max-height: none;
}
.payroll-page > .filter-card :deep(.el-form) {
  overflow: visible;
}
.payroll-page > .result-heading {
  flex-wrap: wrap;
  flex: 0 0 auto;
}
.list-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.list-tools .el-button + .el-button {
  margin-left: 0;
}
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.row-actions .el-button + .el-button {
  margin-left: 0;
}
.employee-meta {
  color: var(--el-text-color-regular);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.payroll-total {
  font-variant-numeric: tabular-nums;
}
.payroll-page :deep(.el-pagination) {
  flex: 0 0 auto;
  padding: 12px;
  margin: 0;
}
@media (max-width: 1100px) {
  .payroll-summary {
    gap: 8px;
  }
}

.review-groups {
  margin-bottom: 16px;
}
.review-task {
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.review-task-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.review-task p {
  color: var(--el-text-color-regular);
  line-height: 1.6;
  margin: 8px 0;
}
.review-groups :deep(.el-collapse-item__title) {
  gap: 10px;
}
.review-groups li {
  overflow-wrap: anywhere;
}
.payroll-page {
  gap: 16px;
}
.page-heading,
.result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.page-heading p,
.field-hint {
  color: var(--el-text-color-regular);
  font-size: 13px;
}
.field-hint {
  flex-basis: 100%;
  margin: 6px 0 0;
}
.filter-card :deep(.el-select) {
  width: 160px;
}
.el-dialog .el-select {
  width: 100%;
}
.el-alert {
  margin-bottom: 14px;
}
.el-pagination {
  justify-content: flex-end;
  margin-top: 16px;
}
@media (max-width: 768px) {
  .page-heading,
  .result-heading {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

<style scoped>
.payroll-v03-page {
  gap: 18px;
  overflow: auto;
}
.payroll-v03-page .page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.payroll-v03-page .page-heading p {
  display: block;
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.payroll-v03-page .filter-card {
  flex-shrink: 0;
  border-radius: 8px;
}
.payroll-v03-page .filter-card :deep(.el-card__body) {
  padding: 20px;
}
.payroll-v03-page .filter-card :deep(.el-form) {
  display: grid;
  grid-template-columns: 180px minmax(200px, 1fr) 180px 160px auto;
  gap: 18px;
  align-items: end;
}
.payroll-v03-page .filter-card :deep(.el-form-item) {
  margin: 0;
  min-width: 0;
}
.payroll-v03-page .filter-card :deep(.el-date-editor) {
  width: 100%;
}
.payroll-v03-page .filter-card :deep(.el-select) {
  width: 100%;
}
.payroll-v03-page .list-card {
  flex: 1;
  min-height: 300px;
  border-radius: 8px;
}
.payroll-v03-page .list-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  gap: 16px;
}
.payroll-list-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.payroll-list-heading h3 {
  margin: 0;
  font-size: 16px;
}
.payroll-list-heading span,
.employee-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.7;
}
.payroll-v03-page .result-heading {
  padding: 0;
  margin: 0;
}
.payroll-v03-page .table-viewport {
  flex: 1;
  min-height: 190px;
}
.payslip-payable {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.payslip-payable strong {
  color: var(--el-color-primary);
  font-size: 24px;
}
@media (max-width: 1000px) {
  .payroll-v03-page .filter-card :deep(.el-form) {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
