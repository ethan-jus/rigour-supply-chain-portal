<template>
  <section class="supply-page payroll-rules-page">
    <div class="page-heading">
      <div class="list-heading-title">
        <h3 v-if="componentKind">{{ title }}</h3>
        <SupplyPageTitle v-else>{{ title }}</SupplyPageTitle>
        <SupplyPageHelp>{{ description }}。调整时设置生效月份，历史工资的计算依据保留。</SupplyPageHelp>
      </div>
      <el-button v-if="!historyOnly && can(writePermission)" type="primary" @click="open()"
        >新增{{ ruleName }}</el-button
      >
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-radio-group
      v-if="kind === 'PERFORMANCE'"
      v-model="roleFilter"
      class="performance-role-tabs"
      aria-label="绩效规则身份"
    >
      <el-radio-button value="SALES">销售人员</el-radio-button>
      <el-radio-button value="CITY_MANAGER">城市总</el-radio-button>
      <el-radio-button value="TRAINEE_MANAGER">见习城市总</el-radio-button>
      <el-radio-button value="HEADQUARTERS">总部人员</el-radio-button>
      <el-radio-button value="">全部身份</el-radio-button>
    </el-radio-group>
    <div class="rule-filters">
      <el-input
        v-model="keyword"
        :placeholder="kind === 'COMMISSION' ? '搜索编码 / 名称 / 商品标准' : '搜索编码 / 名称'"
        clearable
        aria-label="规则编码或名称"
      />
      <el-select v-model="statusFilter" clearable placeholder="全部状态" aria-label="规则状态">
        <el-option
          v-for="state in ['使用中', '待生效', '已停用', '已废弃', '已到期', '历史版本']"
          :key="state"
          :value="state"
          :label="state"
        />
      </el-select>
      <el-select
        v-if="kind !== 'SALARY' && kind !== 'COMMISSION' && kind !== 'PERFORMANCE'"
        v-model="roleFilter"
        clearable
        placeholder="全部身份"
        aria-label="人员身份筛选"
      >
        <el-option v-for="role in roles" :key="role.value" v-bind="role" />
      </el-select>
      <el-tree-select
        v-if="kind !== 'SALARY'"
        v-model="departmentFilter"
        clearable
        filterable
        check-strictly
        :data="departmentOptions"
        :props="{ label: 'name', children: 'children' }"
        node-key="id"
        placeholder="全部部门"
        aria-label="适用部门筛选"
      />
      <el-date-picker
        v-model="monthFilter"
        type="month"
        value-format="YYYY-MM"
        placeholder="生效月份"
        aria-label="规则生效月份"
      />
      <el-select
        v-if="kind === 'COMMISSION'"
        v-model="categoryFilter"
        clearable
        filterable
        placeholder="全部商品分类"
        aria-label="商品分类筛选"
      >
        <el-option
          v-for="category in categories"
          :key="category.id"
          :value="category.id"
          :label="category.name"
        />
      </el-select>
      <el-button @click="resetFilters">重置</el-button>
    </div>
    <div class="rule-table-panel">
      <div class="rule-list-heading">
        <h3>{{ title }}列表</h3>
        <span
          >共 {{ ruleGroups.length }} 条规则<template
            v-if="kind === 'COMMISSION' || kind === 'ALLOWANCE'"
            >，{{ displayRows.length }} 条标准</template
          ></span
        ><el-button :loading="loading" @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="pageRows" :span-method="ruleNameSpan" border>
        <el-table-column
          label="规则编码 / 名称"
          column-key="rule"
          class-name="rule-group-cell"
          align="center"
          :min-width="kind === 'SALARY' ? 200 : 215"
          fixed="left"
          ><template #default="{ row }"
            ><strong>{{ row.definition.name }}</strong>
            <div class="field-hint">{{ row.ruleCode }}</div></template
          ></el-table-column
        >
        <el-table-column
          v-if="kind !== 'COMMISSION'"
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
          align="center"
          min-width="180"
          ><template #default="{ row }">{{
            row.definition.departmentIds
              .map((id: number) => departments.find((d) => d.id === id)?.name || id)
              .join('、')
          }}</template></el-table-column
        >
        <template v-if="kind === 'COMMISSION'">
          <el-table-column label="商品分类 / 型号" min-width="230">
            <template #default="{ row }">
              <strong>{{ row.commissionRow?.name || '全部商品不计提' }}</strong>
              <div class="field-hint" v-if="row.commissionRow">
                {{ commissionScope(row.commissionRow) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="销售提成标准" min-width="145" align="right">
            <template #default="{ row }">{{ rateLabel(row.commissionRow?.sales) }}</template>
          </el-table-column>
          <el-table-column label="城市总提成标准" min-width="155" align="right">
            <template #default="{ row }">{{ rateLabel(row.commissionRow?.manager) }}</template>
          </el-table-column>
          <el-table-column label="标准合计" min-width="145" align="right">
            <template #default="{ row }">{{ totalLabel(row.commissionRow) }}</template>
          </el-table-column>
        </template>
        <template v-else-if="kind === 'ALLOWANCE'">
          <el-table-column label="补贴项目" min-width="160">
            <template #default="{ row }">{{ row.allowanceItem?.name || '不发放补贴' }}</template>
          </el-table-column>
          <el-table-column label="标准金额（元 / 月）" min-width="175" align="right">
            <template #default="{ row }">{{ money(row.allowanceItem?.amount ?? 0) }}</template>
          </el-table-column>
          <el-table-column label="折算方式" min-width="140">
            <template #default="{ row }">{{
              prorationOptions.find((item) => item.value === row.definition.allowance?.proration)
                ?.label || '—'
            }}</template>
          </el-table-column>
        </template>
        <template v-else-if="kind === 'ATTENDANCE'">
          <el-table-column label="工作日安排" min-width="145">
            <template #default>
              按日历配置
              <div class="field-hint">工作日与休息日以规则日历为准</div>
            </template>
          </el-table-column>
          <el-table-column label="归日窗口（北京时间）" min-width="185"
            ><template #default="{ row }"
              >{{ row.definition.calendar?.window.start?.slice(0, 5) }} 至
              {{ row.definition.calendar?.window.nextDay ? '次日' : '当日' }}
              {{ row.definition.calendar?.window.end?.slice(0, 5) }}</template
            ></el-table-column
          >
        </template>
        <template v-else-if="kind === 'PERFORMANCE'">
          <el-table-column label="考核方式" min-width="230"
            ><template #default="{ row }"
              ><template v-if="row.definition.performance?.mode === 'SALES'"
                >打卡与有效拜访 {{ row.definition.performance.sales.processPercent }}%<br />回款达标
                {{ 100 - row.definition.performance.sales.processPercent }}%</template
              ><template v-else>{{
                standardSummary(row as PayrollComponentVersionView)
              }}</template></template
            ></el-table-column
          >
          <el-table-column label="指标 / 扣减标准" min-width="255"
            ><template #default="{ row }"
              ><template v-if="row.definition.performance?.mode === 'SALES'"
                >每日 {{ row.definition.performance.sales.dailyCheckins }} 次打卡，每少一次
                {{ row.definition.performance.sales.checkinPenalty }} 元<br />每日
                {{ row.definition.performance.sales.dailyVisits }} 次有效拜访，每少一次
                {{ row.definition.performance.sales.visitPenalty }} 元</template
              ><template v-else>{{
                managerSummary(row as PayrollComponentVersionView)
              }}</template></template
            ></el-table-column
          >
        </template>
        <el-table-column v-else label="底薪 / 绩效基数（元 / 月）" min-width="270">
          <template #default="{ row }">
            <div
              v-for="tier in salaryAmounts(row as PayrollComponentVersionView)"
              :key="tier.name"
              class="salary-tier-line"
            >
              <span>{{ tier.name }}</span
              ><strong>{{ money(tier.amount) }} / {{ money(tier.performanceBase) }}</strong>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
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
          label="生效期间"
          column-key="period"
          class-name="rule-group-cell"
          align="center"
          :min-width="kind === 'SALARY' ? 160 : 200"
          ><template #default="{ row }">{{
            componentVersionPeriod(row as PayrollComponentVersionView, rows, today())
          }}</template></el-table-column
        >
        <el-table-column
          v-if="kind !== 'SALARY' || historyOnly"
          label="创建时间"
          column-key="created"
          class-name="rule-group-cell"
          align="center"
          width="180"
        >
          <template #default="{ row }">{{ versionTime(row.createdTime) }}</template>
        </el-table-column>

        <el-table-column
          label="操作"
          column-key="actions"
          class-name="rule-group-cell"
          align="center"
          width="260"
          fixed="right"
          ><template #default="{ row }">
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
        <el-table-column prop="reason" label="操作原因" />
        <el-table-column label="操作人" width="150"
          ><template #default="{ row }">{{ auditActorLabel(row.actor) }}</template></el-table-column
        >
        <el-table-column label="操作时间" width="180"
          ><template #default="{ row }">{{ versionTime(row.time) }}</template></el-table-column
        >
      </el-table>
      <el-table :data="history"
        ><el-table-column prop="version" label="版本" width="80" /><el-table-column
          prop="definition.effectiveFrom"
          label="生效日期"
          width="130"
        /><el-table-column prop="reason" label="变更说明" />
        <el-table-column label="操作人" min-width="120"
          ><template #default="{ row }">{{
            auditActorLabel(row.createdBy)
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
      class="payroll-rule-editor"
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
      <div>
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
              <el-table-column prop="name" label="薪资档位" />
              <el-table-column label="原底薪 / 绩效基数（元）" min-width="220" align="right">
                <template #default="{ row }"
                  >{{ money(row.oldBase) }} / {{ money(row.oldPerformance) }}</template
                >
              </el-table-column>
              <el-table-column label="新底薪 / 绩效基数（元）" min-width="220" align="right">
                <template #default="{ row }"
                  >{{ money(row.newBase) }} / {{ money(row.newPerformance) }}</template
                >
              </el-table-column>
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
import SupplyPageHelp from '@/components/supply/SupplyPageHelp.vue'
import { randomId } from '@/utils/random-id'
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type TreeInstance } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { errorMessage } from '@/api/core/error'
import { auditActorLabel } from '@/utils/audit-actor'
import { displayDateTime as versionTime } from '@/utils/business-date'
import {
  getPayrollDepartments,
  getPayrollProductCategories,
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
import type { PayrollCommissionRow } from '@/api/core/payroll-scheme/models/PayrollCommissionRow'
import type { PayrollSchemeCommissionRule } from '@/api/core/payroll-scheme/models/PayrollSchemeCommissionRule'
import { newPayrollScheme, payrollRoles as roles, prorationOptions } from '@/utils/payroll-scheme'
import { commissionRows, commissionRowTotal } from '@/utils/payroll-commission-rows'
import { loadPayrollProductUnits, payrollUnitName } from '@/utils/payroll-dictionaries'
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
      ALLOWANCE: '补贴及其他薪资设置',
      PERFORMANCE: '绩效规则设置',
      COMMISSION: '提成设置',
      ATTENDANCE: '考勤规则设置',
    })[kind.value],
)
const description = computed(
  () =>
    ({
      SALARY: '维护本员工底薪与绩效基数',
      ALLOWANCE: '维护交通、话费、电脑等补贴项目、金额及发放口径',
      PERFORMANCE: '维护销售、城市总及总部人员的绩效计算规则；个人月度完成率在月度薪酬中核定',
      COMMISSION: '引用 ERP 商品分类与规格，维护销售和城市总提成标准',
      ATTENDANCE:
        '维护部门工作日历和跨日归属口径；个人免考核日期在员工薪资标准中维护，原始打卡由销售打卡服务提供',
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
const keyword = ref(''),
  statusFilter = ref('')
const roleFilter = ref(kind.value === 'PERFORMANCE' ? 'SALES' : '')
const monthFilter = ref('')
const categoryFilter = ref<number>()
function resetFilters() {
  keyword.value = ''
  statusFilter.value = ''
  roleFilter.value = kind.value === 'PERFORMANCE' ? 'SALES' : ''
  departmentFilter.value = undefined
  monthFilter.value = ''
  categoryFilter.value = undefined
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
const displayRows = computed<PayrollComponentListRow[]>(() =>
  latest.value
    .flatMap((row): PayrollComponentListRow[] => {
      if (row.definition.commission?.rules.length)
        return commissionRows(row.definition.commission.rules).map((commissionRow) => ({
          ...row,
          commissionRow,
        }))
      if (row.definition.allowance?.items.length)
        return row.definition.allowance.items.map((allowanceItem) => ({ ...row, allowanceItem }))
      return [row]
    })
    .filter(
      (row) =>
        (!categoryFilter.value ||
          row.commissionRow?.sales?.categoryIds.includes(categoryFilter.value) ||
          row.commissionRow?.manager?.categoryIds.includes(categoryFilter.value)) &&
        (!keyword.value.trim() ||
          `${row.ruleCode} ${row.definition.name} ${row.commissionRow?.name || ''} ${row.allowanceItem?.name || ''}`.includes(
            keyword.value.trim(),
          )),
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
    !['rule', 'role', 'department', 'state', 'period', 'created', 'actions'].includes(
      column.columnKey || '',
    )
  )
    return [1, 1]
  // A code identifies the group; dates, statuses and actions still belong to their exact record.
  const sameGroup = (other?: PayrollComponentListRow) =>
    !!other &&
    componentListGroupKey(other) === componentListGroupKey(row) &&
    (column.columnKey === 'rule' || other.id === row.id)
  if (sameGroup(pageRows.value[rowIndex - 1])) return [0, 0]
  let rowspan = 1
  while (sameGroup(pageRows.value[rowIndex + rowspan])) rowspan++
  return [rowspan, 1]
}
watch(
  [
    keyword,
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
function rateLabel(rule?: PayrollSchemeCommissionRule) {
  if (!rule || rule.excluded) return '不计提'
  if (rule.value == null) return '未设置'
  return rule.method === 'PERCENT'
    ? `${rule.value}%`
    : `${money(rule.value)} 元 / ${payrollUnitName(rule.unitCode)}`
}
function totalLabel(row?: PayrollCommissionRow) {
  if (!row) return '不计提'
  const total = commissionRowTotal(row)
  if (!total) return '分别计提'
  if (total.method === 'NONE') return '不计提'
  return total.method === 'PERCENT'
    ? `${total.value}%`
    : `${money(total.value)} 元 / ${payrollUnitName(total.unitCode)}`
}
function commissionScope(row: PayrollCommissionRow) {
  const rule = row.sales
  const categoryNames = (ids: number[]) =>
    ids.map((id) => categories.value.find((c) => c.id === id)?.name || `分类 ${id}`).join('、')
  return [
    rule.categoryIds.length ? `分类：${categoryNames(rule.categoryIds)}` : '',
    rule.variantIds.length ? `${rule.variantIds.length} 个 ERP 型号` : '',
    rule.excludedCategoryIds.length ? `排除：${categoryNames(rule.excludedCategoryIds)}` : '',
    rule.excludedVariantIds.length ? `排除 ${rule.excludedVariantIds.length} 个型号` : '',
  ]
    .filter(Boolean)
    .join('；')
}
const money = (value: number | null | undefined) =>
  value == null
    ? '未设置'
    : value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function salaryAmounts(row: PayrollComponentVersionView) {
  const salary = row.definition.salary
  if (!salary) return []
  return salary.baseSalary.mode === 'TIERS'
    ? salary.baseSalary.tiers
    : [
        {
          name: '固定标准',
          amount: salary.baseSalary.fixedAmount,
          performanceBase: salary.performanceBase,
        },
      ]
}
function managerSummary(row: PayrollComponentVersionView) {
  const performance = row.definition.performance
  if (performance?.mode === 'NONE') return '不参与绩效核算'
  if (performance?.mode === 'FIXED')
    return row.definition.role === 'HEADQUARTERS'
      ? '个人绩效基数 × 本月完成率；HR按员工、月份分别核定'
      : '按个人绩效基数及折算规则计算'
  return (
    performance?.manager?.metrics.map((metric) => `${metric.name} ${metric.weight}%`).join('；') ||
    '—'
  )
}
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
    return d.performance.mode === 'SALES'
      ? '打卡与有效拜访 + 回款考核'
      : d.performance.mode === 'MANAGER'
        ? d.performance.manager?.calculationMode === 'ACTUAL_COMPLETION'
          ? '单项指标计分 × 权重后汇总'
          : '历史规则：综合完成率匹配阶梯系数'
        : d.performance.mode === 'NONE'
          ? '不计绩效'
          : d.role === 'HEADQUARTERS'
            ? '按个人月度完成率'
            : '固定绩效'
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
const roleName = (role: string) => roles.find((r) => r.value === role)?.label || '全部身份'
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
  font-size: var(--app-font-size-base);
}
:deep(.el-table),
:deep(.el-alert) {
  margin: 12px 0;
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
  font-size: var(--app-font-size-base);
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
  font-size: var(--app-font-size-base);
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
