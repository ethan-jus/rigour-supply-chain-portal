<template>
  <section class="supply-page payroll-rules-page">
    <div class="page-heading">
      <div>
        <h3 v-if="componentKind">{{ title }}</h3>
        <SupplyPageTitle v-else>{{ title }}</SupplyPageTitle>
      </div>
      <el-button v-if="!historyOnly && can(writePermission)" type="primary" @click="open()"
        >新增{{ ruleName }}</el-button
      >
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="catalogError" :title="catalogError" type="warning" :closable="false" />
    <SupplyListFilters
      compact
      :loading="loading || catalogLoading"
      @search="applyFilters"
      @reset="resetFilters"
    >
      <el-form-item label="规则名称"
        ><el-input
          v-model="filterDraft.ruleName"
          clearable
          placeholder="请输入规则名称"
          aria-label="规则名称筛选"
      /></el-form-item>
      <el-form-item label="规则编码"
        ><el-input
          v-model="filterDraft.ruleCode"
          clearable
          placeholder="请输入规则编码"
          aria-label="规则编码筛选"
      /></el-form-item>
      <el-form-item v-if="kind === 'COMMISSION'" label="商品名称"
        ><el-input
          v-model="filterDraft.productName"
          clearable
          placeholder="请输入商品名称"
          aria-label="商品名称筛选"
      /></el-form-item>
      <el-form-item v-if="kind === 'COMMISSION'" label="规格"
        ><el-input
          v-model="filterDraft.specification"
          clearable
          placeholder="请输入规格"
          aria-label="商品规格筛选"
      /></el-form-item>
      <el-form-item v-if="kind === 'ALLOWANCE'" label="补贴项目"
        ><el-input
          v-model="filterDraft.allowanceName"
          clearable
          placeholder="请输入补贴项目"
          aria-label="补贴项目筛选"
      /></el-form-item>
      <el-form-item label="规则状态"
        ><el-select v-model="statusFilter" clearable placeholder="全部状态" aria-label="规则状态"
          ><el-option
            v-for="state in ['使用中', '待生效', '已停用', '已废弃', '已到期', '历史版本']"
            :key="state"
            :value="state"
            :label="state" /></el-select
      ></el-form-item>
      <el-form-item v-if="kind === 'ALLOWANCE'" label="人员身份"
        ><el-select v-model="roleFilter" clearable placeholder="全部身份" aria-label="人员身份筛选"
          ><el-option v-for="role in roles" :key="role.value" v-bind="role" /></el-select
      ></el-form-item>
      <el-form-item v-if="kind !== 'SALARY'" label="适用部门"
        ><el-tree-select
          v-model="departmentFilter"
          clearable
          filterable
          check-strictly
          :data="departmentOptions"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          placeholder="全部部门"
          aria-label="适用部门筛选"
      /></el-form-item>
      <el-form-item label="生效月份"
        ><el-date-picker
          v-model="monthFilter"
          type="month"
          value-format="YYYY-MM"
          placeholder="选择生效月份"
          aria-label="规则生效月份"
      /></el-form-item>
      <el-form-item v-if="kind === 'COMMISSION'" label="商品分类"
        ><el-tree-select
          v-model="categoryFilter"
          :data="categoryOptions"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          multiple
          show-checkbox
          clearable
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="全部商品分类"
          check-strictly
          aria-label="商品分类筛选"
      /></el-form-item>
    </SupplyListFilters>
    <div class="rule-table-panel">
      <div class="rule-list-heading">
        <SupplyFilterTabs
          v-if="kind === 'PERFORMANCE'"
          v-model="roleFilter"
          class="performance-role-tabs"
          label="绩效规则身份"
          :items="performanceRoles"
        />
        <h3 v-else>{{ title }}列表</h3>
        <span
          >共 {{ ruleGroups.length }} 条规则<template
            v-if="kind === 'COMMISSION' || kind === 'ALLOWANCE'"
            >，{{ standardCount }} 条标准</template
          ></span
        ><el-button :loading="loading" @click="load">刷新</el-button>
      </div>
      <el-table
        v-loading="loading || catalogLoading"
        :data="pageRows"
        :span-method="ruleNameSpan"
        class="business-table supply-scroll-table rule-list-table"
        max-height="560"
        border
      >
        <el-table-column
          label="规则名称"
          column-key="rule"
          class-name="rule-group-cell"
          align="left"
          min-width="185"
          fixed="left"
          ><template #default="{ row }"
            ><strong>{{ row.definition.name }}</strong>
          </template></el-table-column
        >
        <el-table-column
          label="规则编码"
          column-key="ruleCode"
          class-name="rule-group-cell"
          prop="ruleCode"
          min-width="155"
          show-overflow-tooltip
          :formatter="displayCell"
        />
        <el-table-column
          v-if="
            kind !== 'COMMISSION' &&
            kind !== 'ATTENDANCE' &&
            (kind !== 'PERFORMANCE' || !roleFilter)
          "
          label="人员身份"
          column-key="role"
          class-name="rule-group-cell"
          align="center"
          :width="kind === 'SALARY' ? 90 : 120"
          ><template #default="{ row }">{{
            roleName(row.definition.role)
          }}</template></el-table-column
        >
        <el-table-column
          v-if="kind !== 'SALARY'"
          label="适用部门"
          column-key="department"
          class-name="rule-group-cell"
          align="left"
          min-width="145"
          ><template #default="{ row }"
            ><SupplyDepartmentScope :departments="departments" :ids="row.definition.departmentIds"
          /></template>
        </el-table-column>
        <template v-if="kind === 'COMMISSION'">
          <el-table-column label="提成标准数" width="100" align="right"
            ><template #default="{ row }">{{
              commissionSummary(row as PayrollComponentVersionView).standards
            }}</template></el-table-column
          >
          <el-table-column label="商品规格数" width="100" align="right"
            ><template #default="{ row }">{{
              commissionSummary(row as PayrollComponentVersionView).variants
            }}</template></el-table-column
          >
        </template>
        <template v-else-if="kind === 'ALLOWANCE'">
          <el-table-column label="补贴项目数" width="120" align="right"
            ><template #default="{ row }">{{
              row.definition.allowance?.items.length ?? '-'
            }}</template></el-table-column
          >
          <el-table-column label="每月补贴合计（元）" min-width="170" align="right"
            ><template #default="{ row }">{{
              money(allowanceTotal(row as PayrollComponentVersionView))
            }}</template></el-table-column
          >
          <el-table-column label="折算方式" min-width="145"
            ><template #default="{ row }">{{
              prorationOptions.find((item) => item.value === row.definition.allowance?.proration)
                ?.label || '-'
            }}</template></el-table-column
          >
        </template>
        <template v-else-if="kind === 'ATTENDANCE'">
          <el-table-column label="工作日历" min-width="145">
            <template #default="{ row }">{{
              row.definition.calendar
                ? row.definition.calendar.source === 'STATUTORY'
                  ? '跟随法定节假日'
                  : '自定义工作日历'
                : '-'
            }}</template>
          </el-table-column>
        </template>
        <template v-else-if="kind === 'PERFORMANCE'">
          <el-table-column label="考核方式" min-width="210" show-overflow-tooltip
            ><template #default="{ row }">{{
              standardSummary(row as PayrollComponentVersionView)
            }}</template></el-table-column
          >
        </template>
        <template v-else>
          <el-table-column label="薪资方式" min-width="160"
            ><template #default="{ row }">{{
              row.definition.salary?.baseSalary.mode === 'TIERS'
                ? '按金银铜牌档位'
                : row.definition.salary?.baseSalary.mode === 'FIXED'
                  ? '固定底薪'
                  : '-'
            }}</template></el-table-column
          >
          <el-table-column label="薪资档位数" width="120" align="right"
            ><template #default="{ row }">{{
              row.definition.salary?.baseSalary.mode === 'TIERS'
                ? row.definition.salary.baseSalary.tiers.length
                : '-'
            }}</template></el-table-column
          >
          <el-table-column label="底薪（元 / 月）" min-width="145" align="right"
            ><template #default="{ row }">{{
              row.definition.salary?.baseSalary.mode === 'FIXED'
                ? money(row.definition.salary.baseSalary.fixedAmount)
                : '-'
            }}</template></el-table-column
          >
          <el-table-column label="绩效基数（元 / 月）" min-width="165" align="right"
            ><template #default="{ row }">{{
              row.definition.salary?.baseSalary.mode === 'FIXED'
                ? money(row.definition.salary.performanceBase)
                : '-'
            }}</template></el-table-column
          >
        </template>
        <el-table-column
          label="规则状态"
          fixed="right"
          column-key="state"
          class-name="rule-group-cell"
          align="center"
          width="110"
          ><template #default="{ row }"
            ><el-tag
              :type="
                stateOf(row as PayrollComponentVersionView) === '使用中'
                  ? 'success'
                  : stateOf(row as PayrollComponentVersionView) === '已停用'
                    ? 'warning'
                    : 'info'
              "
              >{{ stateOf(row as PayrollComponentVersionView) }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column
          label="规则有效期"
          column-key="period"
          class-name="rule-group-cell"
          align="left"
          min-width="165"
          show-overflow-tooltip
          ><template #default="{ row }">{{
            componentVersionPeriod(row as PayrollComponentVersionView, rows, today())
          }}</template></el-table-column
        >
        <el-table-column
          label="创建人"
          column-key="creator"
          class-name="rule-group-cell"
          min-width="100"
          ><template #default="{ row }">{{
            row.createdByName || auditActorLabel(row.createdBy)
          }}</template></el-table-column
        >
        <el-table-column
          label="创建时间"
          column-key="created"
          class-name="rule-group-cell"
          align="center"
          width="165"
        >
          <template #default="{ row }">{{ versionTime(row.createdTime) }}</template>
        </el-table-column>

        <el-table-column
          label="操作"
          column-key="actions"
          class-name="rule-group-cell rule-action-cell"
          align="center"
          width="280"
          fixed="right"
          ><template #default="{ row }">
            <div class="rule-row-actions">
              <el-button link type="primary" @click="open(row as PayrollComponentVersionView)"
                >查看</el-button
              >
              <el-button
                v-if="
                  !historyOnly &&
                  can(writePermission) &&
                  isLatest(row as PayrollComponentVersionView) &&
                  ['待生效', '已停用'].includes(stateOf(row as PayrollComponentVersionView))
                "
                link
                type="primary"
                :disabled="!!ruleBusy"
                @click="
                  open(
                    row as PayrollComponentVersionView,
                    false,
                    stateOf(row as PayrollComponentVersionView) === '待生效',
                    stateOf(row as PayrollComponentVersionView) === '已停用',
                  )
                "
                >修改</el-button
              >
              <el-button
                v-if="
                  !historyOnly &&
                  can(writePermission) &&
                  isLatest(row as PayrollComponentVersionView) &&
                  stateOf(row as PayrollComponentVersionView) === '待生效'
                "
                link
                type="danger"
                :disabled="!!ruleBusy"
                @click="actRule(row as PayrollComponentVersionView, 'DELETE')"
                >删除</el-button
              >
              <el-button
                v-if="
                  !historyOnly &&
                  can(writePermission) &&
                  stateOf(row as PayrollComponentVersionView) === '使用中'
                "
                link
                type="warning"
                :disabled="!!ruleBusy"
                @click="actRule(row as PayrollComponentVersionView, 'DISABLE')"
                >停用</el-button
              >
              <el-button
                v-if="
                  !historyOnly &&
                  can(writePermission) &&
                  stateOf(row as PayrollComponentVersionView) === '已停用'
                "
                link
                type="primary"
                :disabled="!!ruleBusy"
                @click="actRule(row as PayrollComponentVersionView, 'ENABLE')"
                >重新启用</el-button
              >
              <el-button
                v-if="
                  kind === 'SALARY' &&
                  !historyOnly &&
                  can(writePermission) &&
                  isLatest(row as PayrollComponentVersionView) &&
                  stateOf(row as PayrollComponentVersionView) === '使用中'
                "
                link
                type="primary"
                @click="open(row as PayrollComponentVersionView, true)"
                >调整薪资</el-button
              >
              <el-button link @click="showHistory(row as PayrollComponentVersionView)"
                >操作记录</el-button
              >
            </div>
          </template></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="ruleGroups.length"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
      />
    </div>
    <el-dialog
      append-to-body
      :model-value="history.length > 0"
      title="规则操作记录"
      class="business-detail-panel"
      width="850px"
      @close="history = []"
    >
      <el-alert v-if="historyError" :title="historyError" type="error" :closable="false" />
      <el-table
        v-if="operationRows.length || historyLoading"
        :data="operationRows"
        v-loading="historyLoading"
      >
        <el-table-column label="操作" width="100"
          ><template #default="{ row }">{{ operationLabel(row.action) }}</template></el-table-column
        >
        <el-table-column prop="reason" label="操作原因" :formatter="displayCell" />
        <el-table-column label="操作人" width="150"
          ><template #default="{ row }">{{ auditActorLabel(row.actor) }}</template></el-table-column
        >
        <el-table-column label="操作时间" width="180"
          ><template #default="{ row }">{{ versionTime(row.time) }}</template></el-table-column
        >
      </el-table>
      <el-table :data="history"
        ><el-table-column
          prop="definition.effectiveFrom"
          label="生效日期"
          width="130"
          :formatter="displayCell"
        /><el-table-column prop="reason" label="变更说明" :formatter="displayCell" />
        <el-table-column label="操作人" min-width="120"
          ><template #default="{ row }">{{
            row.createdByName || auditActorLabel(row.createdBy)
          }}</template></el-table-column
        >
        <el-table-column label="操作时间" min-width="180"
          ><template #default="{ row }">{{
            versionTime(row.createdTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="80"
          ><template #default="{ row }"
            ><el-button link @click="open(row as PayrollComponentVersionView)"
              >查看</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </el-dialog>
    <el-dialog
      append-to-body
      v-model="visible"
      :title="`${readonly ? '查看' : '维护'}${ruleName}`"
      class="payroll-rule-editor business-detail-panel"
      width="min(1200px, 95vw)"
      top="4vh"
      destroy-on-close
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      :before-close="closeEditor"
    >
      <el-alert v-if="editorError" :title="editorError" type="error" :closable="false" />
      <el-alert
        v-if="editStopped"
        title="修改将保存为新版本，并保持停用；核对后请在列表中重新启用。历史计算依据保留。"
        type="info"
        :closable="false"
      />
      <el-alert
        v-if="kind === 'SALARY'"
        title="维护本员工各档位的底薪和绩效基数。金银铜牌区间由绩效规则统一维护；调薪按生效月份保留历史。"
        type="info"
        :closable="false"
      />
      <PayrollRuleDetail
        v-if="readonly && viewingRule"
        :row="viewingRule"
        :departments="departments"
        :state="stateOf(viewingRule)"
        :period="componentVersionPeriod(viewingRule, rows, today())"
      >
        <PayrollRuleParameters
          v-if="kind === 'SALARY' || kind === 'PERFORMANCE' || kind === 'COMMISSION'"
          :definition="viewingRule.definition"
          :categories="categories"
        />
        <PayrollSchemeCalendarEditor
          v-else-if="kind === 'ATTENDANCE'"
          :disabled="true"
          v-model="form"
        />
      </PayrollRuleDetail>
      <div v-else>
        <el-form label-position="top" :disabled="readonly || saving">
          <div class="scheme-grid">
            <el-form-item
              label="规则名称"
              required
              :class="{ 'rule-name-wide': kind === 'ALLOWANCE' || kind === 'PERFORMANCE' }"
              ><el-input v-model="form.name" maxlength="120"
            /></el-form-item>
            <el-form-item
              v-if="kind !== 'ATTENDANCE' && kind !== 'COMMISSION'"
              label="人员身份"
              required
              ><el-select
                v-model="form.role"
                :disabled="readonly || (!!previousId && !replacePending && kind !== 'SALARY')"
                @change="changeRole"
                ><el-option v-for="r in roles" :key="r.value" v-bind="r" /></el-select
            ></el-form-item>
            <el-form-item v-if="kind !== 'SALARY'" label="适用部门" required
              ><el-tree-select
                ref="departmentScopeSelect"
                v-model="form.departmentIds"
                :disabled="departmentScopeLocked"
                :data="departmentOptions"
                :props="{ label: 'name', children: 'children' }"
                node-key="id"
                multiple
                :check-strictly="departmentScopeLocked"
                show-checkbox
                filterable
                collapse-tags
                collapse-tags-tooltip
                :max-collapse-tags="3"
                :render-after-expand="false"
                @check="(_, state) => updateDepartmentSelection(state.checkedKeys)"
                @remove-tag="removeDepartmentTag"
              />
              <p v-if="!departmentScopeLocked" class="field-hint">
                勾选父部门会选中所有下级部门；保存包含全部勾选部门，可取消不适用的分支。
              </p>
            </el-form-item>
            <el-form-item label="生效月份" required
              ><el-date-picker
                v-model="form.effectiveFrom"
                type="month"
                value-format="YYYY-MM-01"
                :clearable="false"
            /></el-form-item>
            <el-form-item label="有效期"
              ><el-checkbox v-model="longTerm">长期有效</el-checkbox
              ><el-date-picker
                v-if="!longTerm"
                v-model="form.effectiveTo"
                placeholder="结束日期（月末）"
                value-format="YYYY-MM-DD"
                :clearable="false"
            /></el-form-item>
          </div>
          <PayrollSalaryEditor :disabled="readonly" v-if="kind === 'SALARY'" v-model="form" />
          <PayrollAllowanceEditor v-else-if="kind === 'ALLOWANCE'" v-model="form" />
          <template v-else-if="kind === 'PERFORMANCE'"
            ><PayrollSchemePerformanceEditor
              :disabled="readonly"
              v-model="form" /><PayrollGradeEditor
              v-if="form.performanceMode === 'SALES'"
              v-model="grades"
          /></template>
          <PayrollSchemeCommissionEditor
            ref="commissionEditor"
            :disabled="readonly"
            v-else-if="kind === 'COMMISSION'"
            v-model="form"
            :categories="categories"
          />
          <PayrollSchemeCalendarEditor :disabled="readonly" v-else v-model="form" />
          <template v-if="kind === 'SALARY' && previousId">
            <h4>调薪前后对比</h4>
            <el-table :data="salaryComparison" border>
              <el-table-column prop="name" label="薪资档位" :formatter="displayCell" />
              <el-table-column
                v-for="field in [
                  { key: 'oldBase', label: '原底薪（元）' },
                  { key: 'oldPerformance', label: '原绩效基数（元）' },
                  { key: 'newBase', label: '新底薪（元）' },
                  { key: 'newPerformance', label: '新绩效基数（元）' },
                ]"
                :key="field.key"
                :label="field.label"
                min-width="160"
                align="right"
                ><template #default="{ row }">{{
                  money(row[field.key])
                }}</template></el-table-column
              >
            </el-table>
            <p class="field-hint">新标准从所选月份参与核算；已确认、已发放工资保留原计算结果。</p>
          </template>
          <el-form-item label="变更说明" required
            ><el-input v-model="reason" type="textarea" maxlength="1000"
          /></el-form-item>
        </el-form>
      </div>
      <template #footer
        ><el-button :disabled="saving" @click="closeEditor()">关闭</el-button
        ><el-button v-if="!readonly" type="primary" :loading="saving" @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>
<script setup lang="ts">
import { performanceModeOptions, payrollOptionLabel } from '@/utils/payroll-rule-options'
import { displayCell } from '@/utils/business-display'
import { randomId } from '@/utils/random-id'
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type TreeInstance } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import SupplyListFilters from '@/components/supply/SupplyListFilters.vue'
import SupplyFilterTabs from '@/components/supply/SupplyFilterTabs.vue'
import SupplyDepartmentScope from '@/components/supply/SupplyDepartmentScope.vue'
import PayrollRuleDetail from './components/PayrollRuleDetail.vue'
import PayrollRuleParameters from './components/PayrollRuleParameters.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { errorMessage } from '@/api/core/error'
import { displayRecordActor as auditActorLabel } from '@/utils/business-display'
import { displayRecordDateTime as versionTime } from '@/utils/business-display'
import {
  getPayrollDepartments,
  getPayrollProductCategories,
  getPayrollProducts,
  type PayrollProduct,
  type PayrollDepartment,
  type PayrollCategory,
} from '@/api/core/payroll'
import { getAttendanceDepartments } from '@/api/core/hr-attendance'
import {
  getPayrollComponents,
  savePayrollComponent,
  actPayrollComponent,
  getPayrollComponentOperations,
  type PayrollComponentAction,
  type PayrollRuleOperation,
} from '@/api/core/payroll-scheme/components'
import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'
import type { PayrollComponentDefinition } from '@/api/core/payroll-scheme/models/PayrollComponentDefinition'
import type { PayrollComponentListRow } from '@/api/core/payroll-scheme/models/PayrollComponentListRow'
import { newPayrollScheme, payrollRoles as roles, prorationOptions } from '@/utils/payroll-scheme'
import { commissionRows } from '@/utils/payroll-commission-rows'
import { loadPayrollProductUnits } from '@/utils/payroll-dictionaries'
import {
  componentVersionState,
  componentVersionPeriod,
  visibleComponentVersions,
  componentListGroupKey,
  groupComponentListRows,
} from '@/utils/payroll-component-versions'
import { departmentTree } from '@/utils/hr-department-tree'
import PayrollSalaryEditor from './components/PayrollSalaryEditor.vue'
import PayrollAllowanceEditor from './components/PayrollAllowanceEditor.vue'
import PayrollGradeEditor from './components/PayrollGradeEditor.vue'
import type { PayrollGradeBand } from '@/api/core/payroll-scheme/models/PayrollGradeBand'
import PayrollSchemePerformanceEditor from './components/PayrollSchemePerformanceEditor.vue'
import PayrollSchemeCalendarEditor from './components/PayrollSchemeCalendarEditor.vue'
import PayrollSchemeCommissionEditor from './components/PayrollSchemeCommissionEditor.vue'
const props = defineProps<{
  componentKind?: PayrollComponentDefinition['kind']
  employeeCode?: string
  historyOnly?: boolean
}>()
const route = useRoute(),
  { can } = useSupplyPermissions()
const kind = computed<PayrollComponentDefinition['kind']>(
  () =>
    props.componentKind ||
    (route.path.endsWith('commission-rules')
      ? 'COMMISSION'
      : route.path.endsWith('performance-rules')
        ? 'PERFORMANCE'
        : 'ALLOWANCE'),
)
const title = computed(
  () =>
    ({
      SALARY: '薪资标准',
      ALLOWANCE: '员工补贴规则',
      PERFORMANCE: '绩效考核规则',
      COMMISSION: '商品提成规则',
      ATTENDANCE: '考勤规则设置',
    })[kind.value],
)
const ruleName = computed(
  () =>
    ({
      SALARY: '薪资标准',
      ALLOWANCE: '补贴规则',
      PERFORMANCE: '绩效规则',
      COMMISSION: '提成规则',
      ATTENDANCE: '考勤规则',
    })[kind.value],
)
const writePermission = computed(() =>
  kind.value === 'SALARY'
    ? 'hr:payroll-rule:write'
    : kind.value === 'ATTENDANCE'
      ? 'hr:attendance-rule:write'
      : 'hr:payroll-rule:write',
)
const rows = ref<PayrollComponentVersionView[]>([]),
  history = ref<PayrollComponentVersionView[]>([])
const operationRows = ref<PayrollRuleOperation[]>([])
const historyLoading = ref(false),
  historyError = ref(''),
  ruleBusy = ref('')
const operationLabel = (action: string) =>
  ({
    MODIFY: '修改',
    DELETE: '删除',
    DISABLE: '停用',
    ENABLE: '重新启用',
    RETIRE: '废弃（新规则替代）',
  })[action] || action
async function showHistory(row: PayrollComponentVersionView) {
  history.value = rows.value.filter((v) => v.ruleId === row.ruleId)
  operationRows.value = []
  historyError.value = ''
  historyLoading.value = true
  try {
    operationRows.value = await getPayrollComponentOperations(row.id)
  } catch (e) {
    historyError.value = errorMessage(e, '操作记录加载失败')
  } finally {
    historyLoading.value = false
  }
}
async function actRule(row: PayrollComponentVersionView, action: PayrollComponentAction) {
  if (ruleBusy.value) return
  const label = operationLabel(action)
  const message =
    action === 'DELETE'
      ? '删除后该待生效规则不再参与核算，操作记录保留。请填写删除原因。'
      : action === 'DISABLE'
        ? '立即停止本月及以后新核算使用本规则；已确认记录标记待复核，已发放工资通过补差处理。请填写停用原因。'
        : '立即恢复本月及以后使用本规则；系统检查范围冲突，并将已确认记录标记待复核。请填写启用原因。'
  let reason: string
  try {
    const result = await ElMessageBox.prompt(message, `${label}：${row.definition.name}`, {
      confirmButtonText: label,
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputValidator: (value) =>
        (!!value?.trim() && value.trim().length <= 1000) || '请填写1至1000字操作原因',
    })
    reason = result.value.trim()
  } catch {
    return
  }
  ruleBusy.value = row.id
  error.value = ''
  try {
    const result = await actPayrollComponent(row, action, reason, randomId())
    const impact = result.attendanceReviews + result.payrollReviews
    ElMessage.success(
      impact
        ? `规则已${label}，${result.attendanceReviews}条考勤、${result.payrollReviews}条薪酬标记待复核`
        : `规则已${label}`,
    )
    await load()
  } catch (e) {
    error.value = errorMessage(e, `${label}失败，请刷新后重试`)
  } finally {
    ruleBusy.value = ''
  }
}
const departments = ref<PayrollDepartment[]>([]),
  categories = ref<PayrollCategory[]>([])
const departmentOptions = computed(() => departmentTree(departments.value))
const emptyTextFilters = () => ({
  ruleName: '',
  ruleCode: '',
  productName: '',
  specification: '',
  allowanceName: '',
})
const filterDraft = ref(emptyTextFilters())
const textFilters = ref(emptyTextFilters())
const statusFilter = ref('')
function applyFilters() {
  textFilters.value = { ...filterDraft.value }
  page.value = 1
}
const roleFilter = ref(kind.value === 'PERFORMANCE' ? 'SALES' : '')
const monthFilter = ref('')
const categoryFilter = ref<number[]>([])
const categoryOptions = computed(() =>
  departmentTree(categories.value.map((category, index) => ({ ...category, sortOrder: index }))),
)
function categoryScope(ids: number[]) {
  const result = new Set(ids)
  let previous = -1
  while (previous !== result.size) {
    previous = result.size
    categories.value.forEach((category) => {
      if (category.parentId != null && result.has(category.parentId)) result.add(category.id)
    })
  }
  return result
}
const selectedCategories = computed(() => categoryScope(categoryFilter.value))
function resetFilters() {
  filterDraft.value = emptyTextFilters()
  textFilters.value = emptyTextFilters()
  statusFilter.value = ''
  roleFilter.value = kind.value === 'PERFORMANCE' ? 'SALES' : ''
  departmentFilter.value = undefined
  monthFilter.value = ''
  categoryFilter.value = []
}
const departmentFilter = ref<number | undefined>()
const today = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
const stateOf = (row: PayrollComponentVersionView) =>
  componentVersionState(row, rows.value, today())
const isLatest = (row: PayrollComponentVersionView) =>
  !rows.value.some((v) => v.ruleId === row.ruleId && v.version > row.version)
const latest = computed(() =>
  visibleComponentVersions(
    rows.value,
    today(),
    props.historyOnly || statusFilter.value === '历史版本',
  ).filter(
    (row) =>
      (!monthFilter.value ||
        (row.definition.effectiveFrom.slice(0, 7) <= monthFilter.value &&
          row.definition.effectiveTo.slice(0, 7) >= monthFilter.value)) &&
      (!roleFilter.value || row.definition.role === roleFilter.value) &&
      (!departmentFilter.value || row.definition.departmentIds.includes(departmentFilter.value)) &&
      (!statusFilter.value || stateOf(row as PayrollComponentVersionView) === statusFilter.value),
  ),
)
const commissionCatalog = ref<PayrollProduct[]>([])
const catalogLoading = ref(false)
const catalogError = ref('')
let catalogRequest = 0
watch(
  rows,
  async (currentRows) => {
    const request = ++catalogRequest
    const ids = [
      ...new Set(
        currentRows
          .flatMap(
            (row) => row.definition.commission?.rules.flatMap((rule) => rule.variantIds) ?? [],
          )
          .map(String),
      ),
    ]
    commissionCatalog.value = []
    catalogError.value = ''
    catalogLoading.value = kind.value === 'COMMISSION' && ids.length > 0
    if (!catalogLoading.value) return
    const products: PayrollProduct[] = []
    let failed = false
    for (let begin = 0; begin < ids.length; begin += 6) {
      const batch = ids.slice(begin, begin + 6)
      const results = await Promise.allSettled(batch.map((id) => getPayrollProducts('', null, id)))
      if (request !== catalogRequest) return
      results.forEach((result, index) => {
        if (result.status === 'fulfilled')
          products.push(
            ...result.value.filter((product) => String(product.productVariantId) === batch[index]),
          )
        else failed = true
      })
    }
    commissionCatalog.value = products
    catalogLoading.value = false
    if (failed)
      catalogError.value = '部分商品资料加载失败，商品名称与规格筛选可能不完整，请刷新重试。'
  },
  { immediate: true },
)
const includes = (value: string | null | undefined, query: string) =>
  !query.trim() || (value ?? '').includes(query.trim())
const commissionStandards = (row: PayrollComponentVersionView) =>
  commissionRows(row.definition.commission?.rules ?? [])
function commissionSummary(row: PayrollComponentVersionView) {
  const standards = commissionStandards(row)
  return {
    standards: standards.length,
    categories: new Set(standards.flatMap((standard) => standard.sales.categoryIds)).size,
    variants: new Set(standards.flatMap((standard) => standard.sales.variantIds).map(String)).size,
  }
}
function allowanceTotal(row: PayrollComponentVersionView) {
  const items = row.definition.allowance?.items
  return !items || items.some((item) => item.amount == null)
    ? null
    : items.reduce((sum, item) => sum + (item.amount ?? 0), 0)
}
const performanceRoles = computed(() =>
  [
    ...roles.filter((role) =>
      ['SALES', 'CITY_MANAGER', 'TRAINEE_MANAGER', 'HEADQUARTERS'].includes(role.value),
    ),
    { value: '', label: '全部身份' },
  ].map((role) => ({
    ...role,
    label: role.value === 'SALES' ? '销售人员' : role.label,
    count: visibleComponentVersions(
      rows.value,
      today(),
      props.historyOnly || statusFilter.value === '历史版本',
    ).filter((row) => !role.value || row.definition.role === role.value).length,
  })),
)
const displayRows = computed<PayrollComponentListRow[]>(() =>
  latest.value.filter((row) => {
    const query = textFilters.value
    if (!includes(row.definition.name, query.ruleName) || !includes(row.ruleCode, query.ruleCode))
      return false
    if (
      kind.value === 'ALLOWANCE' &&
      query.allowanceName.trim() &&
      !row.definition.allowance?.items.some((item) => includes(item.name, query.allowanceName))
    )
      return false
    if (kind.value !== 'COMMISSION') return true
    if (!categoryFilter.value.length && !query.productName.trim() && !query.specification.trim())
      return true
    return commissionStandards(row).some((standard) => {
      const scope = standard.sales
      const excluded = categoryScope(scope.excludedCategoryIds)
      if (!scope.variantIds.length) {
        const included = categoryScope(scope.categoryIds)
        const matchesCategory =
          !selectedCategories.value.size ||
          [...selectedCategories.value].some((id) => included.has(id) && !excluded.has(id))
        return (
          matchesCategory &&
          includes(standard.name, query.productName) &&
          !query.specification.trim()
        )
      }
      return scope.variantIds.some((id) => {
        const product = commissionCatalog.value.find(
          (item) => String(item.productVariantId) === String(id),
        )
        return (
          !!product &&
          (!selectedCategories.value.size ||
            (product.categoryId != null && selectedCategories.value.has(product.categoryId))) &&
          !(product.categoryId != null && excluded.has(product.categoryId)) &&
          !scope.excludedVariantIds.map(String).includes(String(id)) &&
          includes(product.productName, query.productName) &&
          includes(product.specification, query.specification)
        )
      })
    })
  }),
)
const standardCount = computed(() =>
  displayRows.value.reduce(
    (sum, row) =>
      sum +
      (kind.value === 'COMMISSION'
        ? commissionSummary(row as PayrollComponentVersionView).standards
        : (row.definition.allowance?.items.length ?? 0)),
    0,
  ),
)
const page = ref(1)
const pageSize = ref(20)
const ruleGroups = computed(() => groupComponentListRows(displayRows.value))
const pageRows = computed(() =>
  ruleGroups.value
    .slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
    .flatMap((group) => group.rows),
)
function ruleNameSpan({
  row,
  rowIndex,
  column,
}: {
  row: PayrollComponentListRow
  rowIndex: number
  column: { columnKey?: string }
}) {
  if (
    ![
      'rule',
      'ruleCode',
      'role',
      'department',
      'state',
      'period',
      'creator',
      'created',
      'actions',
    ].includes(column.columnKey || '')
  )
    return [1, 1]
  // A code identifies the group; dates, statuses and actions still belong to their exact record.
  const sameGroup = (other?: PayrollComponentListRow) =>
    !!other &&
    componentListGroupKey(other) === componentListGroupKey(row) &&
    (['rule', 'ruleCode'].includes(column.columnKey || '') || other.id === row.id)
  if (sameGroup(pageRows.value[rowIndex - 1])) return [0, 0]
  let rowspan = 1
  while (sameGroup(pageRows.value[rowIndex + rowspan])) rowspan++
  return [rowspan, 1]
}
watch(
  [
    textFilters,
    statusFilter,
    roleFilter,
    departmentFilter,
    monthFilter,
    categoryFilter,
    pageSize,
    rows,
  ],
  () => {
    page.value = 1
  },
)
const money = (value: number | null | undefined) =>
  value == null
    ? '-'
    : value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function standardSummary(row: PayrollComponentVersionView) {
  const d = row.definition
  if (d.salary)
    return d.salary.baseSalary.mode === 'TIERS'
      ? d.salary.baseSalary.tiers
          .map((t) => `${t.name}：底薪 ${money(t.amount)} / 绩效 ${money(t.performanceBase)}`)
          .join('；')
      : `底薪 ${money(d.salary.baseSalary.fixedAmount)} / 绩效 ${money(d.salary.performanceBase)}`
  if (d.allowance)
    return d.allowance.items.length
      ? d.allowance.items.map((i) => `${i.name} ${money(i.amount)}`).join('；')
      : '不发放补贴'
  if (d.performance)
    return payrollOptionLabel(
      d.performance.mode,
      performanceModeOptions(
        d.role,
        d.performance.manager?.calculationMode !== 'ACTUAL_COMPLETION',
      ),
    )
  if (d.commission) return `${d.commission.rules.length} 条商品标准 · 整单付清后计提`
  return '部门工作日历与跨日归属'
}
const grades = ref<PayrollGradeBand[]>([])
const commissionEditor = ref<{ validate: () => string | null } | null>(null)
const form = ref(newPayrollScheme()),
  previousId = ref<string | null>(null),
  requestId = ref(''),
  reason = ref('')
const replacePending = ref(false),
  editRevision = ref<number>()
const editStopped = ref(false)
const viewingRule = ref<PayrollComponentVersionView | null>(null)
const departmentScopeSelect = ref<{ treeRef: TreeInstance }>()
const departmentScopeLocked = computed(
  () => readonly.value || (!!previousId.value && !replacePending.value && !editStopped.value),
)
function updateDepartmentSelection(checkedKeys: number[]) {
  if (departmentScopeLocked.value) return
  const known = new Set(departments.value.map((department) => department.id))
  // Keep historical IDs absent from the current catalog until explicitly removed.
  form.value.departmentIds = [
    ...new Set([...checkedKeys, ...form.value.departmentIds.filter((id) => !known.has(id))]),
  ]
}
function removeDepartmentTag(id: number) {
  if (departmentScopeLocked.value) return
  const excluded = new Set([id])
  const removeBranch = (nodes: typeof departmentOptions.value) => {
    for (const node of nodes) {
      if (excluded.has(node.id) || (node.parentId != null && excluded.has(node.parentId)))
        excluded.add(node.id)
      removeBranch(node.children)
    }
  }
  removeBranch(departmentOptions.value)
  let parent = departments.value.find((department) => department.id === id)?.parentId
  while (parent != null && !excluded.has(parent)) {
    excluded.add(parent)
    parent = departments.value.find((department) => department.id === parent)?.parentId
  }
  form.value.departmentIds = form.value.departmentIds.filter((value) => !excluded.has(value))
}
function salaryAmounts(row: PayrollComponentVersionView) {
  const salary = row.definition.salary
  return !salary
    ? []
    : salary.baseSalary.mode === 'TIERS'
      ? salary.baseSalary.tiers
      : [
          {
            name: '固定标准',
            amount: salary.baseSalary.fixedAmount,
            performanceBase: salary.performanceBase,
          },
        ]
}
const salaryComparison = computed(() => {
  const previous = rows.value.find((row) => row.id === previousId.value)
  const oldAmounts = previous ? salaryAmounts(previous) : []
  const newAmounts =
    form.value.baseSalary.mode === 'TIERS'
      ? form.value.baseSalary.tiers
      : [
          {
            name: '固定标准',
            amount: form.value.baseSalary.fixedAmount,
            performanceBase: form.value.performanceBase,
          },
        ]
  return newAmounts.map((tier) => {
    const old = oldAmounts.find((item) => item.name === tier.name)
    return {
      name: tier.name,
      oldBase: old?.amount,
      oldPerformance: old?.performanceBase,
      newBase: tier.amount,
      newPerformance: tier.performanceBase,
    }
  })
})
const longTerm = computed({
  get: () => form.value.effectiveTo === '9999-12-31',
  set: (value) => {
    form.value.effectiveTo = value ? '9999-12-31' : ''
  },
})
const readonly = ref(false),
  visible = ref(false),
  loading = ref(false),
  saving = ref(false),
  error = ref(''),
  editorError = ref('')
const roleName = (role: string) =>
  role === 'ALL' ? '全部身份' : roles.find((r) => r.value === role)?.label || '-'
const initialEditor = ref('')
const editorState = () =>
  JSON.stringify({ form: form.value, grades: grades.value, reason: reason.value })
const editorDirty = computed(
  () => visible.value && !readonly.value && editorState() !== initialEditor.value,
)
async function closeEditor(done?: () => void): Promise<boolean> {
  if (saving.value || ruleBusy.value) {
    ElMessage.info('正在处理规则，请稍候')
    return false
  }
  if (editorDirty.value) {
    try {
      await ElMessageBox.confirm('修改尚未保存，关闭后将丢弃本次修改。', '关闭规则配置', {
        confirmButtonText: '放弃修改',
        cancelButtonText: '继续编辑',
        type: 'warning',
      })
    } catch {
      return false
    }
  }
  if (done) done()
  else visible.value = false
  return true
}
onBeforeRouteLeave(() => closeEditor())
onBeforeRouteUpdate(() => closeEditor())
function beforeUnload(event: BeforeUnloadEvent) {
  if (editorDirty.value || saving.value || ruleBusy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => {
  loadRequest++
  window.removeEventListener('beforeunload', beforeUnload)
})
function changeRole() {
  if (form.value.role !== 'SALES') {
    form.value.allowances = []
    form.value.baseSalary.mode = 'FIXED'
    form.value.performanceMode = form.value.role === 'HEADQUARTERS' ? 'FIXED' : 'MANAGER'
  } else {
    form.value.performanceMode = 'SALES'
    form.value.baseSalary.mode = 'TIERS'
  }
}
function open(row?: PayrollComponentVersionView, next = false, replace = false, stopped = false) {
  viewingRule.value = row ?? null
  form.value = newPayrollScheme()
  if (kind.value === 'PERFORMANCE' && roleFilter.value) {
    form.value.role = roleFilter.value
    changeRole()
  }
  grades.value = form.value.baseSalary.tiers.map(({ amount: _amount, ...band }) => band)
  replacePending.value = replace
  editStopped.value = stopped
  editRevision.value = replace || stopped ? (row?.revision ?? 1) : undefined
  previousId.value = (next || replace || stopped) && row ? row.id : null
  readonly.value = (!!row && !next && !replace && !stopped) || !can(writePermission.value)
  requestId.value = randomId()
  reason.value = row && !next && !replace && !stopped ? row.reason : ''
  editorError.value = ''
  if (row) {
    const d = structuredClone(toRaw(row.definition))
    Object.assign(form.value, {
      name: d.name,
      role: d.role,
      departmentIds: d.departmentIds,
      effectiveFrom: next ? '' : d.effectiveFrom,
      effectiveTo: d.effectiveTo,
    })
    if (d.salary) Object.assign(form.value, d.salary)
    if (d.allowance) {
      form.value.allowances = d.allowance.items
      form.value.proration.allowance = d.allowance.proration
    }
    if (d.performance) {
      Object.assign(form.value, {
        performanceMode: d.performance.mode,
        sales: d.performance.sales ?? form.value.sales,
        manager: d.performance.manager ?? form.value.manager,
      })
      grades.value = d.performance.grades || []
    }
    if (d.commission) form.value.commission = d.commission
    if (d.calendar) form.value.calendar = d.calendar
  } else if (kind.value === 'COMMISSION' || kind.value === 'ATTENDANCE') form.value.role = 'ALL'
  if (kind.value === 'SALARY') {
    form.value.departmentIds = []
    if (!row) form.value.name = '员工薪资标准'
  }
  if (!readonly.value && kind.value === 'PERFORMANCE') {
    form.value.manager.calculationMode = 'ACTUAL_COMPLETION'
    form.value.manager.cap = null
    form.value.manager.steps = []
    form.value.sales.processProtectionDays ??= 10
  }
  initialEditor.value = editorState()
  visible.value = true
}
let loadRequest = 0
async function load() {
  const request = ++loadRequest
  rows.value = []
  history.value = []
  loading.value = true
  error.value = ''
  try {
    const [result] = await Promise.all([
      getPayrollComponents(kind.value, props.employeeCode),
      kind.value === 'COMMISSION' ? loadPayrollProductUnits() : Promise.resolve(),
    ])
    if (request === loadRequest) rows.value = result
  } catch (e) {
    if (request === loadRequest) error.value = errorMessage(e, '规则加载失败')
  } finally {
    if (request === loadRequest) loading.value = false
  }
}
async function save() {
  if (saving.value) return
  const changeReason = reason.value.trim()
  if (!changeReason || changeReason.length > 1000) {
    editorError.value = '请填写1至1000字变更说明'
    return
  }
  if (kind.value === 'COMMISSION') {
    const validationMessage = commissionEditor.value?.validate()
    if (validationMessage) {
      editorError.value = validationMessage
      return
    }
  }
  saving.value = true
  editorError.value = ''
  try {
    const f = form.value
    if (kind.value !== 'SALARY' && !departmentScopeLocked.value && departmentScopeSelect.value)
      updateDepartmentSelection(departmentScopeSelect.value.treeRef.getCheckedKeys() as number[])
    await savePayrollComponent({
      requestId: requestId.value,
      previousId: previousId.value,
      replacePending: replacePending.value,
      revision: editRevision.value,
      reason: changeReason,
      definition: {
        name: f.name,
        kind: kind.value,
        role: f.role,
        departmentIds: f.departmentIds,
        employeeCodes: kind.value === 'SALARY' && props.employeeCode ? [props.employeeCode] : [],
        effectiveFrom: f.effectiveFrom,
        effectiveTo: f.effectiveTo,
        salary:
          kind.value === 'SALARY'
            ? {
                personalPolicy: f.personalPolicy,
                baseSalary: f.baseSalary,
                performanceBase: f.performanceBase,
                proration: { ...f.proration, allowance: 'NONE' },
              }
            : null,
        performance:
          kind.value === 'PERFORMANCE'
            ? {
                mode: f.performanceMode,
                sales: f.sales,
                manager: f.manager,
                grades: f.performanceMode === 'SALES' ? grades.value : [],
              }
            : null,
        allowance:
          kind.value === 'ALLOWANCE'
            ? { items: f.allowances, proration: f.proration.allowance }
            : null,
        commission: kind.value === 'COMMISSION' ? f.commission : null,
        calendar: kind.value === 'ATTENDANCE' ? f.calendar : null,
      },
    })
    visible.value = false
    ElMessage.success('规则已保存')
    await load()
  } catch (e) {
    editorError.value = errorMessage(e, '保存失败')
  } finally {
    saving.value = false
  }
}
watch(
  () => [kind.value, props.employeeCode],
  () => {
    visible.value = false
    void load()
  },
)
onMounted(async () => {
  await load()
  try {
    if (kind.value === 'SALARY') return
    departments.value =
      kind.value === 'ATTENDANCE'
        ? (await getAttendanceDepartments()).map((d) => ({
            id: d.id,
            name: d.departmentName,
            parentId: d.parentId,
            sortOrder: d.sortOrder,
          }))
        : await getPayrollDepartments(true)
    if (kind.value === 'COMMISSION') categories.value = await getPayrollProductCategories()
  } catch (e) {
    error.value = errorMessage(e, '规则选项加载失败')
  }
})
</script>
<style scoped>
:global(.el-dialog.payroll-rule-editor) {
  display: flex;
  flex-direction: column;
  max-height: 92vh;
}
:global(.payroll-rule-editor > .el-dialog__body) {
  min-height: 0;
  overflow-y: auto;
}
:global(.payroll-rule-editor > .el-dialog__header),
:global(.payroll-rule-editor > .el-dialog__footer) {
  flex-shrink: 0;
}
.rule-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 12px 0;
}
.rule-filters > * {
  max-width: 260px;
}
.salary-amounts {
  padding: 12px 24px;
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 16px;
}
:deep(.scheme-grid) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 24px;
}
.rule-name-wide {
  grid-column: 1 / -1;
}
:deep(.field-hint) {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
:deep(.el-table),
:deep(.el-alert) {
  margin: 12px 0;
}
.rule-list-table :deep(.rule-action-cell .cell) {
  overflow: visible;
  white-space: normal;
  text-overflow: clip;
}
.rule-row-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.rule-row-actions .el-button + .el-button {
  margin-left: 0;
}
</style>

<style scoped>
.payroll-rules-page {
  gap: 18px;
  overflow: auto;
}
.payroll-rules-page .page-heading {
  flex-shrink: 0;
}
.payroll-rules-page .page-heading p {
  display: block;
  color: var(--el-text-color-secondary);
  margin: 8px 0 0;
  font-size: 13px;
}
.payroll-rules-page .rule-filters {
  padding: 20px;
  background: white;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex-shrink: 0;
}
.payroll-rules-page .rule-filters > :deep(.el-input),
.payroll-rules-page .rule-filters > :deep(.el-select) {
  width: 190px;
  flex: none;
}
.rule-table-panel {
  padding: 20px;
  background: white;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}
:deep(.el-table__body td.rule-group-cell) {
  vertical-align: middle;
}
.rule-list-heading {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.rule-list-heading h3 {
  margin: 0;
  font-size: 16px;
  flex: 1;
}
.rule-list-heading span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.performance-role-tabs {
  flex-shrink: 0;
}
.salary-tier-line {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  line-height: 2;
  font-variant-numeric: tabular-nums;
}
</style>
