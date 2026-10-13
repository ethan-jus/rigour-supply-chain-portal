<template>
  <div class="supply-page supply-page--business-main payroll-page">
    <div class="page-heading">
      <div>
        <SupplyPageTitle>月度薪酬</SupplyPageTitle>
        <p>
          选择月份核算 → 处理待核对事项 → 确认薪酬 → 登记发放。提成和绩效明细统一在员工薪酬中查看。
        </p>
      </div>
      <el-button v-if="can('hr:payroll:calculate')" type="primary" @click="calculateVisible = true"
        >月度核算</el-button
      >
    </div>
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <el-card class="filter-card" shadow="never"
      ><el-form inline @submit.prevent="search"
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
      :month="month"
      :department-id="departmentId"
      @loaded="preparation = $event"
      @changed="load"
    />
    <PayrollSettlementDialog ref="settlementDialog" @changed="workflowChanged" />
    <div class="workflow-filter">
      <el-radio-group v-model="statusCode" aria-label="月度薪酬处理阶段" @change="search">
        <el-radio-button v-for="stage in workflowStages" :key="stage.code" :value="stage.code">
          {{ stage.label }}（{{ stageCount(stage.code) }}）
        </el-radio-button>
      </el-radio-group>
      <p class="field-hint" aria-live="polite">{{ workflowHint }}</p>
    </div>
    <div class="result-heading">
      <span
        >共 {{ page.total }} 人 · 当前页应发 ¥{{ costMoney(pageGross) }} · 核定实发 ¥{{
          costMoney(pageNet)
        }}</span
      >
      <div>
        <el-button :loading="exporting" @click="exportAll">导出本月筛选结果</el-button
        ><el-button :loading="loading" @click="workflowChanged">刷新</el-button>
      </div>
    </div>
    <el-card class="list-card" shadow="never"
      ><el-table
        v-loading="loading"
        :data="page.items"
        row-key="id"
        border
        class="business-table supply-scroll-table"
      >
        <el-table-column label="员工" width="160" fixed="left"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="showDetail(row as PayrollRecord)">{{
              row.employeeName
            }}</el-button>
            <div class="field-hint">{{ row.employeeCode }}</div></template
          ></el-table-column
        >
        <el-table-column label="状态" width="105" fixed="left"
          ><template #default="{ row }"
            ><el-tag
              :type="
                row.statusCode === 'REVIEW'
                  ? 'warning'
                  : row.statusCode === 'PAID'
                    ? 'success'
                    : 'primary'
              "
              >{{
                payrollStatusLabel(
                  row as PayrollRecord,
                  costLabel('PAYROLL_STATUS', row.statusCode),
                )
              }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column label="核对事项" min-width="250">
          <template #default="{ row }">
            <div v-if="row.statusCode === 'REVIEW'" class="review-cell">
              <template v-if="row.calculation.issues.length">
                <div
                  v-for="group in payrollReviewGroups(row.calculation.issues).slice(0, 2)"
                  :key="group.key"
                  class="review-summary"
                >
                  {{ group.label }}
                </div>
                <el-button link type="primary" @click="showDetail(row as PayrollRecord, 'review')"
                  >处理 {{ payrollReviewGroups(row.calculation.issues).length }} 类问题</el-button
                >
              </template>
              <el-button
                v-else
                link
                type="primary"
                @click="showDetail(row as PayrollRecord, 'review')"
                >查看核算依据并重算</el-button
              >
            </div>
            <span v-else class="field-hint">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="month" label="月份" width="100" /><el-table-column
          prop="departmentName"
          label="部门"
          width="150"
          show-overflow-tooltip
        /><el-table-column prop="cityName" label="城市" width="110" />
        <el-table-column
          v-for="field in moneyFields"
          :key="field.key"
          :label="field.label"
          width="120"
          align="right"
          ><template #default="{ row }">{{
            costMoney(row.calculation[field.key])
          }}</template></el-table-column
        >
        <el-table-column label="已登记发放" width="120" align="right"
          ><template #default="{ row }">{{
            costMoney(payrollPaid(row as PayrollRecord))
          }}</template></el-table-column
        >
        <el-table-column label="待发金额" width="120" align="right"
          ><template #default="{ row }">{{
            row.calculation.netPay == null
              ? '待核定'
              : costMoney(payrollRemaining(row as PayrollRecord))
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="225" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="showDetail(row as PayrollRecord)">{{
              row.statusCode === 'REVIEW' ? '核对处理' : '明细'
            }}</el-button
            ><el-button
              v-if="unlocked(row as PayrollRecord) && can('hr:payroll:calculate')"
              link
              type="primary"
              @click="editInput(row as PayrollRecord)"
              >当月核定</el-button
            ><el-button
              v-if="row.statusCode === 'READY' && can('hr:payroll:confirm')"
              link
              type="primary"
              :disabled="saving"
              @click="settlementDialog?.open(row as PayrollRecord, 'confirm')"
              >确认</el-button
            ><el-button
              v-if="row.statusCode === 'CONFIRMED' && can('hr:payroll:paid')"
              link
              type="primary"
              :disabled="saving"
              @click="settlementDialog?.open(row as PayrollRecord, 'paid')"
              >登记发放</el-button
            ><el-button
              v-if="unlocked(row as PayrollRecord) && can('hr:payroll:calculate')"
              link
              :disabled="saving"
              @click="recalculate(row as PayrollRecord)"
              >重算</el-button
            >
            <el-button
              v-if="
                row.statusCode === 'CONFIRMED' && !row.payments?.length && can('hr:payroll:confirm')
              "
              link
              type="primary"
              @click="settlementDialog?.open(row as PayrollRecord, 'reopen')"
              >撤回确认</el-button
            >
            <el-button
              v-if="
                (row.statusCode === 'PAID' || row.payments?.length) && can('hr:payroll:confirm')
              "
              link
              type="primary"
              @click="settlementDialog?.open(row as PayrollRecord, 'correct')"
              >补差 / 冲回</el-button
            >
          </template></el-table-column
        > </el-table
      ><el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="page.total"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="search"
    /></el-card>
    <el-dialog
      v-model="inputVisible"
      :title="'当月核定 · ' + (inputRow?.employeeName || '') + ' · ' + (inputRow?.month || '')"
      width="min(680px, 95vw)"
      :close-on-click-modal="false"
      ><el-alert v-if="inputError" :title="inputError" type="error" :closable="false" /><el-alert
        title="只填写需要核定的内容，留空沿用原来源。填写一次说明，保存后自动重算。核定仅影响本人工资及对应订单的提成计算，原始资料保留。"
        type="info"
        :closable="false"
      /><el-form v-loading="inputLoading" label-width="120px"
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
          <p class="field-hint">填写过程绩效＋回款绩效的合计；填 0 表示本月不发绩效。</p>
          <p v-if="inputRow?.calculation.performanceDetail" class="field-hint">
            当前依据：过程
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
      title="薪酬核算明细"
      size="min(1120px, 95vw)"
      destroy-on-close
      ><template v-if="detail"
        ><el-descriptions :column="3" border
          ><el-descriptions-item label="员工"
            >{{ detail.employeeName }} · {{ detail.employeeCode }}</el-descriptions-item
          ><el-descriptions-item label="月份">{{ detail.month }}</el-descriptions-item
          ><el-descriptions-item label="状态">{{
            payrollStatusLabel(detail, costLabel('PAYROLL_STATUS', detail.statusCode))
          }}</el-descriptions-item
          ><el-descriptions-item v-for="field in moneyFields" :key="field.key" :label="field.label"
            >¥{{ costMoney(detail.calculation[field.key]) }}</el-descriptions-item
          ></el-descriptions
        >
        <el-alert
          v-if="
            detail.calculation.input.departmentOverrideId != null ||
            detail.calculation.input.performanceOverride != null
          "
          type="info"
          :closable="false"
          title="本月已采用人工核定"
        >
          <span v-if="detail.calculation.input.departmentOverrideId != null">
            部门：{{ departmentName(detail.calculation.input.departmentOverrideId) }}；
          </span>
          <span v-if="detail.calculation.input.performanceOverride != null">
            绩效：{{ costMoney(detail.calculation.input.performanceOverride) }} 元；
          </span>
          核定说明：{{ detail.calculation.input.reason }}
        </el-alert>
        <el-alert
          v-if="detail.statusCode === 'REVIEW'"
          type="warning"
          :closable="false"
          show-icon
          :title="`有 ${payrollReviewGroups(detail.calculation.issues).length} 类问题待处理，核定后自动重算`"
        >
          <el-button link type="primary" @click="detailTab = 'review'"
            >查看原因与处理指引</el-button
          >
        </el-alert>
        <el-descriptions
          v-if="detail.calculation.salarySource"
          title="档案底薪来源"
          :column="3"
          border
        >
          <el-descriptions-item label="是否转正">{{
            detail.calculation.salarySource.regularized == null
              ? '待完善'
              : detail.calculation.salarySource.regularized
                ? '已转正'
                : '未转正'
          }}</el-descriptions-item>
          <el-descriptions-item label="转正日期">{{
            detail.calculation.salarySource.regularizationDate || '—'
          }}</el-descriptions-item>
          <el-descriptions-item label="薪资生效日期">{{
            detail.calculation.salarySource.effectiveFrom || '待完善'
          }}</el-descriptions-item>
          <el-descriptions-item label="试用期底薪">{{
            detail.calculation.salarySource.probationSalary || '待完善'
          }}</el-descriptions-item>
          <el-descriptions-item label="转正底薪">{{
            detail.calculation.salarySource.regularSalary || '待完善'
          }}</el-descriptions-item>
          <el-descriptions-item label="本月来源">{{
            detail.calculation.input.baseOverride == null
              ? '员工档案（按核算月份判断转正）'
              : '月度人工调整'
          }}</el-descriptions-item>
        </el-descriptions>
        <el-tabs v-model="detailTab"
          ><el-tab-pane
            v-if="detail.statusCode === 'REVIEW' || detail.calculation.issues.length"
            label="待核对事项"
            name="review"
          >
            <p class="field-hint">
              相同问题合并处理，无需逐笔核对订单。点击“当月核定”，一次填写部门、绩效和说明。
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
                    >当月核定</el-button
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
          <el-tab-pane label="商品提成明细" name="commission"
            ><el-table :data="detail.calculation.details" border max-height="560"
              ><el-table-column prop="orderNo" label="订单" width="180" /><el-table-column
                prop="productName"
                label="商品"
                min-width="160"
                show-overflow-tooltip /><el-table-column label="受益角色" width="100"
                ><template #default="{ row }">{{
                  costLabel('COMMISSION_RECIPIENT_ROLE', row.recipientRoleCode)
                }}</template></el-table-column
              ><el-table-column label="数量" width="100"
                ><template #default="{ row }"
                  >{{ row.quantity }} {{ costLabel('PRODUCT_UNIT', row.unitCode) }}</template
                ></el-table-column
              ><el-table-column
                prop="ruleName"
                label="适用规则"
                width="170"
                show-overflow-tooltip /><el-table-column
                label="应计（元）"
                width="110"
                align="right"
                ><template #default="{ row }">{{
                  costMoney(row.accrued)
                }}</template></el-table-column
              ><el-table-column label="本期发放（元）" width="125" align="right"
                ><template #default="{ row }">{{
                  costMoney(row.released)
                }}</template></el-table-column
              ><el-table-column prop="message" label="核算说明" min-width="210" /></el-table
          ></el-tab-pane>
          <el-tab-pane
            v-if="detail.calculation.performanceDetail"
            label="过程与回款绩效"
            name="performance"
          >
            <el-descriptions border :column="2"
              ><el-descriptions-item label="过程预算">{{
                costMoney(detail.calculation.performanceDetail.processBudget)
              }}</el-descriptions-item
              ><el-descriptions-item label="过程扣减">{{
                costMoney(detail.calculation.performanceDetail.processDeduction)
              }}</el-descriptions-item
              ><el-descriptions-item label="过程绩效">{{
                costMoney(detail.calculation.performanceDetail.processPay)
              }}</el-descriptions-item
              ><el-descriptions-item label="回款绩效预算">{{
                costMoney(detail.calculation.performanceDetail.collectionBudget)
              }}</el-descriptions-item
              ><el-descriptions-item label="回款目标">{{
                costMoney(detail.calculation.performanceDetail.collectionTarget)
              }}</el-descriptions-item
              ><el-descriptions-item label="实际回款">{{
                costMoney(detail.calculation.performanceDetail.collections)
              }}</el-descriptions-item
              ><el-descriptions-item label="回款绩效">{{
                costMoney(detail.calculation.performanceDetail.collectionPay)
              }}</el-descriptions-item></el-descriptions
            >
            <h3>每日过程指标</h3>
            <el-table :data="detail.calculation.performanceDetail.days" border max-height="420"
              ><el-table-column prop="date" label="日期" width="115" /><el-table-column
                prop="checkins"
                label="打卡客户数"
              /><el-table-column prop="effectiveVisits" label="有效拜访客户数" /><el-table-column
                prop="missingCheckins"
                label="缺少打卡"
              /><el-table-column prop="missingVisits" label="缺少拜访" /><el-table-column
                label="扣款（元）"
                ><template #default="{ row }">{{
                  costMoney(row.deduction)
                }}</template></el-table-column
              ><el-table-column label="证据"
                ><template #default="{ row }">{{
                  row.evidenceComplete ? '完整' : '待核对'
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
          </el-tab-pane>
          <el-tab-pane label="规则快照与调整" name="rules"
            ><el-table :data="detail.calculation.rules" border
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
            <h3>当月核定</h3>
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
            ></el-tab-pane
          >
          <el-tab-pane label="发放与补差" name="payments">
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
          </el-tab-pane>
          <el-tab-pane label="操作记录" name="history"
            ><el-alert
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
          :busy="saving || historyLoading"
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
import { ElMessage, ElMessageBox } from 'element-plus'
import PayrollPreparationPanel from './components/PayrollPreparationPanel.vue'
import PayrollSettlementDialog from './components/PayrollSettlementDialog.vue'
import PayrollWorkflowActions from './components/PayrollWorkflowActions.vue'
import {
  previousPayrollMonth,
  payrollPaid,
  payrollRemaining,
  payrollReviewGroups,
  payrollStatusLabel,
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
  type PayrollPreparationEmployee,
  getPayroll,
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
import { costLabel, costMoney, loadCostDictionaries } from '../cost/cost-dictionaries'
import { exportCostRows } from '../cost/cost-export'
import { auditLabel } from '../cost/cost-audit'
const { can } = useSupplyPermissions()
function thisMonth() {
  const date = new Date()
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
}
const month = ref(previousPayrollMonth()),
  keyword = ref(''),
  statusCode = ref(''),
  departmentId = ref<number | undefined>(),
  currentPage = ref(1),
  pageSize = ref(20)
const workflowStages = [
  { code: '', label: '全部', hint: '先进行月度核算，再按处理阶段查看本月薪酬。' },
  {
    code: 'REVIEW',
    label: '待核对',
    hint: '点击“核对处理”，在当月核定部门或绩效，保存后自动重算；检查通过即可确认薪酬。',
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
const preparation = ref<PayrollPreparationEmployee[]>([])
function stageCount(code: string) {
  return preparation.value.filter(
    (e) =>
      (!departmentId.value || e.departmentId === departmentId.value) &&
      (!keyword.value || (e.employeeName + e.employeeCode).includes(keyword.value)) &&
      e.payrollStatus &&
      (!code || e.payrollStatus === code),
  ).length
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
  { key: 'commission', label: '本期提成' },
  { key: 'heldCommission', label: '待回款提成' },
  { key: 'allowance', label: '补贴' },
  { key: 'correctionAmount', label: '跨月补差' },
  { key: 'deduction', label: '扣款' },
  { key: 'grossPay', label: '应发工资' },
  { key: 'netPay', label: '核定实发' },
]
const pageGross = computed(() =>
    page.value.items.some((r) => r.calculation.grossPay == null)
      ? null
      : page.value.items.reduce((sum, r) => sum + Number(r.calculation.grossPay), 0),
  ),
  pageNet = computed(() =>
    page.value.items.some((r) => r.calculation.netPay == null)
      ? null
      : page.value.items.reduce((sum, r) => sum + Number(r.calculation.netPay), 0),
  )
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
  detailTab = ref('commission'),
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
    const result = await getPayroll({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      month: month.value,
      keyword: keyword.value || undefined,
      departmentId: departmentId.value || undefined,
      statusCode: statusCode.value || undefined,
    })
    if (version === loadVersion) page.value = result
  } catch (e) {
    if (version === loadVersion) {
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
async function saveInput() {
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
  detailTab.value = tab || (row.statusCode === 'REVIEW' ? 'review' : 'commission')
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
    })
    if (!rows.length) {
      ElMessage.info('当前筛选下暂无工资数据')
      return
    }
    exportCostRows(
      '薪酬_' + targetMonth,
      [
        '月份',
        '员工编号',
        '姓名',
        '部门',
        '城市',
        ...moneyFields.map((f) => f.label),
        '状态',
        '待核对事项',
        '已登记发放',
        '待发金额',
        '发放日期与凭证',
      ],
      rows.map((r) => [
        r.month,
        r.employeeCode,
        r.employeeName,
        r.departmentName,
        r.cityName,
        ...moneyFields.map((f) => r.calculation[f.key]),
        payrollStatusLabel(r, costLabel('PAYROLL_STATUS', r.statusCode)),
        r.calculation.issues.join('；'),
        payrollPaid(r),
        r.calculation.netPay == null ? null : payrollRemaining(r),
        (r.payments ?? []).map((p) => `${p.paidDate} / ${p.amount} / ${p.referenceNo}`).join('；'),
      ]),
    )
  } catch (e) {
    ElMessage.error(errorMessage(e, '整月导出失败'))
  } finally {
    exporting.value = false
  }
}
onMounted(async () => {
  void load()
  const results = await Promise.allSettled([loadCostDictionaries(), getPayrollDepartments(false)])
  const deps = results[1]
  if (deps.status === 'fulfilled') departments.value = deps.value
  results.forEach((r) => {
    if (r.status === 'rejected') ElMessage.error(errorMessage(r.reason, '薪酬选项加载失败'))
  })
})
</script>
<style scoped lang="scss">
.review-summary {
  color: var(--el-color-warning-dark-2);
  overflow-wrap: anywhere;
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
