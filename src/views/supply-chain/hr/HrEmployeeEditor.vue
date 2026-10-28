<template>
  <el-dialog
    v-model="visible"
    :title="record ? '编辑员工' : '新增员工'"
    width="min(960px,calc(100vw - 32px))"
    align-center
    :close-on-click-modal="false"
    class="employee-editor"
  >
    <el-tabs v-model="editorTab">
      <el-tab-pane label="员工资料" name="basic">
        <el-form
          ref="employeeForm"
          v-loading="loading"
          label-position="top"
          :model="validationModel"
          :rules="requiredRules"
          :validate-on-rule-change="false"
          @submit.prevent="save"
        >
          <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
          <el-alert
            v-if="Object.keys(fieldErrors).length"
            type="error"
            :closable="false"
            title="请核对以下资料后再提交"
          >
            <ul aria-label="员工资料校验问题">
              <li v-for="(message, key) in fieldErrors" :key="key">{{ message }}</li>
            </ul>
          </el-alert>
          <h3>基本信息</h3>
          <div class="form-grid">
            <el-form-item
              label="部门"
              prop="departmentId"
              :error="fieldErrors['departmentId']"
              required
              ><el-tree-select
                v-model="form.departmentId"
                :data="departmentTree"
                node-key="id"
                :props="{ label: 'departmentName', children: 'children', disabled: 'disabled' }"
                check-strictly
                filterable
                placeholder="请选择部门"
            /></el-form-item>
            <el-form-item
              label="岗位"
              prop="positionCode"
              :error="fieldErrors['positionCode']"
              required
              ><el-select v-model="form.positionCode" filterable placeholder="请选择岗位">
                <el-option
                  v-for="p in positions"
                  :key="p.positionCode"
                  :value="p.positionCode"
                  :label="p.positionName" /></el-select
            ></el-form-item>
            <el-form-item
              label="姓名"
              prop="employeeName"
              :error="fieldErrors['employeeName']"
              required
              ><el-input v-model="form.employeeName" maxlength="128" placeholder="请输入姓名"
            /></el-form-item>
            <el-form-item label="手机号" required prop="mobile" :error="fieldErrors['mobile']"
              ><el-input v-model="form.mobile" maxlength="32"
            /></el-form-item>
            <el-form-item
              label="身份证号"
              required
              prop="profile.idNumber"
              :error="fieldErrors['profile.idNumber'] || identity.error"
              ><el-input v-model="profile.idNumber" maxlength="18" placeholder="18位居民身份证号"
            /></el-form-item>
            <el-form-item label="出生日期"
              ><el-input
                :model-value="identity.birthDate"
                readonly
                placeholder="根据身份证自动显示"
            /></el-form-item>
            <el-form-item label="年龄"
              ><el-input :model-value="identity.age" readonly placeholder="自动计算"
            /></el-form-item>
            <el-form-item label="性别" required
              ><el-input :model-value="identity.gender" readonly placeholder="根据身份证自动显示"
            /></el-form-item>
            <el-form-item
              label="学历"
              prop="profile.education"
              :error="fieldErrors['profile.education']"
              ><el-select v-model="profile.education" clearable
                ><el-option
                  v-for="v in educationOptions"
                  :key="v"
                  :label="v"
                  :value="v" /></el-select
            ></el-form-item>
          </div>
          <h3>教育信息</h3>
          <div class="form-grid">
            <el-form-item
              label="毕业院校"
              prop="profile.graduationSchool"
              :error="fieldErrors['profile.graduationSchool']"
              class="span-two"
              ><el-input v-model="profile.graduationSchool" maxlength="128"
            /></el-form-item>
            <el-form-item label="专业" prop="profile.major" :error="fieldErrors['profile.major']"
              ><el-input v-model="profile.major" maxlength="128"
            /></el-form-item>
          </div>
          <h3>任职信息</h3>
          <div class="form-grid">
            <el-form-item label="职级" prop="jobGrade" :error="fieldErrors['jobGrade']"
              ><el-input v-model="form.jobGrade" maxlength="32" placeholder="业务员默认 S1"
            /></el-form-item>
            <el-form-item
              label="入职日期"
              required
              prop="entryDate"
              :error="fieldErrors['entryDate']"
              ><el-date-picker v-model="entryDate" type="date" value-format="YYYY-MM-DD"
            /></el-form-item>
            <el-form-item
              label="在职状态"
              required
              prop="employmentStatus"
              :error="fieldErrors['employmentStatus']"
              ><el-select
                v-model="form.employmentStatus"
                :disabled="!!record && !can('hr:employee:status')"
              >
                <el-option label="在职" value="ACTIVE" /><el-option
                  label="离职"
                  value="LEFT"
                /> </el-select
            ></el-form-item>
            <el-form-item
              v-if="form.employmentStatus === 'LEFT'"
              label="离职日期"
              prop="leaveDate"
              :error="fieldErrors['leaveDate']"
              required
              ><el-date-picker v-model="leaveDate" type="date" value-format="YYYY-MM-DD"
            /></el-form-item>
            <el-form-item label="工龄"><el-input :model-value="tenure" readonly /></el-form-item>
            <el-form-item
              label="合同截止日期"
              prop="profile.contractEndDate"
              :error="fieldErrors['profile.contractEndDate']"
              ><el-date-picker
                v-model="profile.contractEndDate"
                type="date"
                value-format="YYYY-MM-DD"
            /></el-form-item>
            <el-form-item
              label="参保状态"
              prop="profile.socialInsurance"
              :error="fieldErrors['profile.socialInsurance']"
              ><el-select v-model="profile.socialInsurance" clearable
                ><el-option
                  v-for="v in insuranceOptions"
                  :key="v"
                  :label="v"
                  :value="v" /></el-select
            ></el-form-item>
          </div>
          <h3>薪酬身份与转正信息</h3>
          <div class="form-grid">
            <el-form-item
              label="薪酬类别"
              prop="payrollCategory"
              :error="fieldErrors['payrollCategory']"
              required
            >
              <el-select
                v-model="form.payrollCategory"
                clearable
                placeholder="请选择薪酬类别"
                aria-label="薪酬类别"
              >
                <el-option
                  v-for="option in payrollCategories"
                  :key="option.value"
                  :value="option.value"
                  :label="option.label"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              label="是否转正"
              prop="regularized"
              :error="fieldErrors['regularized']"
              required
            >
              <el-select
                v-model="form.regularized"
                placeholder="请选择是否转正"
                aria-label="是否转正"
              >
                <el-option :value="false" label="否 · 未转正" /><el-option
                  :value="true"
                  label="是 · 已转正"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              v-if="form.regularized"
              label="转正日期"
              prop="regularizationDate"
              :error="fieldErrors['regularizationDate']"
              required
            >
              <el-date-picker
                v-model="form.regularizationDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="实际转正日期"
              />
            </el-form-item>
            <el-form-item
              label="试用期"
              prop="profile.probationPeriod"
              :error="fieldErrors['profile.probationPeriod']"
              ><div class="probation-months">
                <el-input-number
                  v-model="probationMonths"
                  :min="0"
                  :max="Number.MAX_SAFE_INTEGER"
                  :precision="0"
                  :step="1"
                  placeholder="填写月数"
                  aria-label="试用期月数"
                />
                <span>个月</span>
              </div>
              <p v-if="profile.probationPeriod && probationMonths == null" class="section-note">
                历史记录：{{ profile.probationPeriod }}。请核对后填写数字月数。
              </p>
            </el-form-item>
          </div>
          <h3>联系与账户信息</h3>
          <div class="form-grid">
            <el-form-item
              label="户口性质"
              prop="profile.householdType"
              :error="fieldErrors['profile.householdType']"
              ><el-select v-model="profile.householdType" clearable
                ><el-option
                  v-for="v in householdOptions"
                  :key="v"
                  :label="v"
                  :value="v" /></el-select
            ></el-form-item>
            <el-form-item
              label="户籍地址"
              prop="profile.registeredAddress"
              :error="fieldErrors['profile.registeredAddress']"
              class="span-two"
              ><el-input v-model="profile.registeredAddress" maxlength="300"
            /></el-form-item>
            <el-form-item
              label="现居住地"
              prop="profile.residentialAddress"
              :error="fieldErrors['profile.residentialAddress']"
              class="full-row"
              ><el-input v-model="profile.residentialAddress" maxlength="300"
            /></el-form-item>
            <el-form-item
              label="银行卡号"
              prop="profile.bankAccount"
              :error="fieldErrors['profile.bankAccount']"
              ><el-input v-model="profile.bankAccount" maxlength="32"
            /></el-form-item>
            <el-form-item
              label="开户行"
              prop="profile.bankName"
              :error="fieldErrors['profile.bankName']"
              class="span-two"
              ><el-input v-model="profile.bankName" maxlength="128"
            /></el-form-item>
            <el-form-item label="邮箱" prop="email" :error="fieldErrors.email"
              ><el-input v-model="form.email" maxlength="128" placeholder="选填"
            /></el-form-item>
            <el-form-item
              label="紧急联系人"
              prop="profile.emergencyContact"
              :error="fieldErrors['profile.emergencyContact']"
              ><el-input v-model="profile.emergencyContact" maxlength="128"
            /></el-form-item>
            <el-form-item
              label="紧急联系方式"
              prop="profile.emergencyPhone"
              :error="fieldErrors['profile.emergencyPhone']"
              ><el-input v-model="profile.emergencyPhone" maxlength="32"
            /></el-form-item>
            <el-form-item label="备注" prop="remark" :error="fieldErrors['remark']" class="full-row"
              ><el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500"
            /></el-form-item>
          </div>
        </el-form>
      </el-tab-pane>
      <el-tab-pane
        v-if="can('hr:payroll-rule:read') && isManagerPosition"
        label="管辖城市"
        name="city-scope"
        lazy
      >
        <EmployeeCityScopeFields
          v-if="visible"
          ref="scopeFields"
          :employee-code="record?.employeeCode"
          :can-write="can('hr:payroll-rule:write')"
        />
      </el-tab-pane>
      <el-tab-pane v-if="can('hr:payroll-rule:read')" label="薪资标准" name="salary" lazy>
        <PayrollComponentView
          v-if="record?.employeeCode"
          :key="record.employeeCode"
          component-kind="SALARY"
          :employee-code="record.employeeCode"
        />
        <el-empty v-else description="先保存员工资料，再维护薪资标准" />
      </el-tab-pane>
    </el-tabs>
    <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" />
    <template #footer
      ><el-button @click="visible = false">{{ editorTab === 'salary' ? '关闭' : '取消' }}</el-button
      ><el-button
        v-if="editorTab !== 'salary'"
        type="primary"
        :disabled="loading || !!loadError"
        :loading="saving"
        @click="save"
        >确定</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import PayrollComponentView from './PayrollComponentView.vue'
import EmployeeCityScopeFields from './components/EmployeeCityScopeFields.vue'
import type { HrEmployeeCityScopeCommand } from '@/api/core/hr/models/HrEmployeeCityScopeCommand'
import { isCityManagerPosition, payrollCategories } from '@/utils/hr-payroll-profile'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  getHrEmployee,
  getHrPositions,
  hrOrganizationApi,
  type HrDepartmentOption,
  type HrEmployeeCommand,
  type HrEmployeeProfile,
  type HrEmployeeRecord,
  type HrPositionRecord,
} from '@/api/core/hr'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  dateOnly,
  identityDetails,
  validateEmployeeProfile,
  probationMonthsValue,
  employeeEmploymentStatusValue,
  serviceLength,
  educationOptions,
  householdOptions,
  insuranceOptions,
} from '@/utils/hr-employee-profile'
const editorTab = ref('basic')
const visible = defineModel<boolean>({ default: false })
const props = defineProps<{
  record: HrEmployeeRecord | null
  departmentId?: number | null
  initialTab?: 'basic' | 'city-scope'
}>()
const emit = defineEmits<{ saved: [] }>()
const { can } = useSupplyPermissions()
const loading = ref(false),
  saving = ref(false),
  loadError = ref(''),
  saveError = ref('')
const departments = ref<HrDepartmentOption[]>([]),
  positions = ref<HrPositionRecord[]>([])
const savedEmployee = ref<HrEmployeeRecord | null>(null)
const scopeFields = ref<InstanceType<typeof EmployeeCityScopeFields>>()
const blankProfile = (): HrEmployeeProfile => ({
  graduationSchool: null,
  major: null,
  regularSalary: null,
  probationSalary: null,
  probationPeriod: null,
  idNumber: null,
  contractEndDate: null,
  education: null,
  registeredAddress: null,
  householdType: null,
  residentialAddress: null,
  bankAccount: null,
  bankName: null,
  socialInsurance: null,
  emergencyContact: null,
  emergencyPhone: null,
})
const empty = (): HrEmployeeCommand => ({
  employeeName: '',
  departmentId: null,
  positionCode: '',
  jobGrade: null,
  regularized: false,
  regularizationDate: null,
  payrollCategory: null,
  salaryEffectiveFrom: null,
  employmentStatus: 'ACTIVE',
  mobile: null,
  email: null,
  entryDate: null,
  leaveDate: null,
  remark: null,
  revision: 0,
})
const form = reactive(empty()),
  profile = reactive(blankProfile()),
  entryDate = ref(''),
  leaveDate = ref('')
const probationMonths = computed({
  get: () => probationMonthsValue(profile.probationPeriod),
  set: (value: number | undefined | null) => {
    profile.probationPeriod = value == null ? null : String(value)
  },
})
const validationModel = computed(() => ({
  ...form,
  profile,
  entryDate: entryDate.value,
  leaveDate: leaveDate.value,
}))
const requiredRules = computed<FormRules>(() => {
  const fields = {
    employeeName: '请填写姓名',
    departmentId: '请选择部门',
    positionCode: '请选择岗位',
    mobile: '请填写手机号',
    'profile.idNumber': '请填写身份证号',
    entryDate: '请填写入职日期',
    employmentStatus: '请选择在职状态',
    payrollCategory: '请选择薪酬类别',
  }
  return {
    ...Object.fromEntries(
      Object.entries(fields).map(([key, message]) => [
        key,
        [{ required: true, message, trigger: ['change', 'blur'] }],
      ]),
    ),
    regularized: [
      { required: true, type: 'boolean', message: '请选择是否转正', trigger: 'change' },
    ],
    regularizationDate: [
      { required: !!form.regularized, message: '请填写实际转正日期', trigger: 'change' },
    ],
    leaveDate: [
      {
        required: form.employmentStatus === 'LEFT',
        message: '离职员工必须填写离职日期',
        trigger: 'change',
      },
    ],
  }
})
const employeeForm = ref<FormInstance>()
const validationSubmitted = ref(false)
const fieldErrors = computed(() =>
  validationSubmitted.value
    ? validateEmployeeProfile(form, profile, entryDate.value, leaveDate.value)
    : {},
)
const identity = computed(() => identityDetails(profile.idNumber))
const isManagerPosition = computed(() =>
  isCityManagerPosition(
    positions.value.find((p) => p.positionCode === form.positionCode)?.positionName ??
      (savedEmployee.value?.positionCode === form.positionCode
        ? savedEmployee.value.positionName
        : null),
  ),
)
const tenure = computed(() =>
  serviceLength(entryDate.value, form.employmentStatus === 'LEFT' ? leaveDate.value : null),
)
type Node = HrDepartmentOption & { children: Node[]; disabled: boolean }
const departmentTree = computed(() => {
  const map = new Map(
    departments.value.map((d) => [
      d.id,
      { ...d, children: [] as Node[], disabled: d.statusCode !== 'ACTIVE' },
    ]),
  )
  const roots: Node[] = []
  for (const node of map.values()) {
    const parent = node.parentId ? map.get(node.parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
})
watch(
  () => form.positionCode,
  (code) => {
    if (
      !form.jobGrade &&
      positions.value.some((p) => p.positionCode === code && p.positionName === '业务员')
    )
      form.jobGrade = 'S1'
  },
)
watch(visible, async (open) => {
  editorTab.value = props.initialTab || 'basic'
  if (!open) return
  loading.value = true
  loadError.value = ''
  saveError.value = ''
  validationSubmitted.value = false
  savedEmployee.value = null
  Object.assign(form, empty(), { departmentId: props.departmentId ?? null })
  Object.assign(profile, blankProfile())
  entryDate.value = ''
  leaveDate.value = ''
  try {
    const [deps, detail] = await Promise.all([
      hrOrganizationApi.employeeDepartments(),
      props.record ? getHrEmployee(props.record.id) : Promise.resolve(null),
    ])
    departments.value = deps
    positions.value = []
    let begin = 0
    while (true) {
      const page = await getHrPositions({
        begin,
        step: 200,
        statusCode: 'ACTIVE',
      })
      positions.value.push(...page.items)
      begin += page.items.length
      if (begin >= page.total || !page.items.length) break
    }
    if (detail) {
      savedEmployee.value = detail
      Object.assign(form, {
        employeeName: detail.employeeName,
        departmentId: detail.departmentId,
        positionCode: detail.positionCode ?? '',
        jobGrade: detail.jobGrade ?? null,
        regularized: detail.regularized ?? null,
        regularizationDate: detail.regularizationDate ?? null,
        payrollCategory: detail.payrollCategory ?? null,
        salaryEffectiveFrom: detail.salaryEffectiveFrom ?? null,
        employmentStatus: employeeEmploymentStatusValue(detail.employmentStatus),
        mobile: detail.mobile,
        email: detail.email,
        remark: detail.remark,
        revision: detail.revision,
      })
      Object.assign(profile, detail.profile ?? blankProfile())
      entryDate.value = dateOnly(detail.entryDate)
      leaveDate.value = dateOnly(detail.leaveDate)
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '员工资料加载失败'
  } finally {
    loading.value = false
    if (editorTab.value === 'city-scope' && !isManagerPosition.value) editorTab.value = 'basic'
  }
})
async function save() {
  if (saving.value || loading.value || loadError.value) return
  saveError.value = ''
  validationSubmitted.value = true
  if (Object.keys(fieldErrors.value).length) {
    editorTab.value = 'basic'
    await nextTick()
    employeeForm.value?.scrollToField(Object.keys(fieldErrors.value)[0]!)
    return
  }
  let cityScopes: HrEmployeeCityScopeCommand[] | undefined
  try {
    if (isManagerPosition.value) cityScopes = scopeFields.value?.commands()
  } catch (e) {
    editorTab.value = 'city-scope'
    saveError.value = e instanceof Error ? e.message : '请核对管辖范围'
    return
  }
  try {
    if (props.record?.employmentStatus === 'ACTIVE' && form.employmentStatus !== 'ACTIVE')
      await ElMessageBox.confirm('员工离职后，关联业务账号将失去访问资格。', '确认员工状态变更', {
        type: 'warning',
      })
    saving.value = true
    const normalized = Object.fromEntries(
      Object.entries(profile).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]),
    ) as unknown as HrEmployeeProfile
    normalized.probationPeriod =
      probationMonths.value == null ? null : String(probationMonths.value)
    await hrOrganizationApi.saveEmployee(props.record ? String(props.record.id) : null, {
      ...form,
      employeeName: form.employeeName.trim(),
      mobile: form.mobile?.trim() || null,
      email: form.email?.trim() || null,
      jobGrade: form.jobGrade?.trim() || null,
      entryDate: entryDate.value ? `${entryDate.value}T00:00:00+08:00` : null,
      leaveDate:
        form.employmentStatus === 'LEFT' && leaveDate.value
          ? `${leaveDate.value}T00:00:00+08:00`
          : null,
      profile: normalized,
      regularizationDate: form.regularized ? form.regularizationDate : null,
      cityScopes,
    })
    visible.value = false
    emit('saved')
    ElMessage.success('员工档案已保存')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close')
      saveError.value = e instanceof Error ? e.message : '员工保存失败'
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
:global(.employee-editor.el-dialog) {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 48px);
  margin: 24px auto;
}
:global(.employee-editor .el-dialog__body) {
  min-height: 0;
  overflow-y: auto;
  padding-right: 8px;
}
:global(.employee-editor .el-dialog__header),
:global(.employee-editor .el-dialog__footer) {
  flex-shrink: 0;
}
:global(.employee-editor .el-dialog__footer) {
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.probation-months {
  display: flex;
  align-items: center;
  gap: 10px;
}
.probation-months .el-input-number {
  flex: 1;
  min-width: 0;
}

h3 {
  font-size: 15px;
  margin: 4px 0 18px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e2e8f0;
}
.section-note {
  color: #64748b;
  margin: -6px 0 18px;
  font-size: 13px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 22px;
}
.full-row {
  grid-column: 1/-1;
}
.span-two {
  grid-column: span 2;
}
:deep(.el-select),
:deep(.el-tree-select),
:deep(.el-date-editor) {
  width: 100%;
}
@media (max-width: 700px) {
  .section-note {
    color: #64748b;
    margin: -6px 0 18px;
    font-size: 13px;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .span-two {
    grid-column: auto;
  }
}
</style>
