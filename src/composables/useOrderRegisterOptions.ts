import { computed, ref } from 'vue'
import { getAllCrmCustomerAreas, type CrmDictionaryView } from '@/api/core/crm'
import { getHrEmployees, hrOrganizationApi, type HrDepartment, type HrEmployeeRecord } from '@/api/core/hr'
import { getOrderRegisterCreators } from '@/api/core/order-register'
import { buildAreaTree, type AreaNode } from '@/utils/crm-area-tree'
import { departmentTree, type DepartmentNode } from '@/utils/hr-department-tree'

/**
 * 订单/明细/收款/统计共享的主数据选项：
 * 地区树、部门树、远程业务员、创建人下拉。
 * 加载失败只降级为对应选项不可用，不阻塞列表查询。
 */
export function useOrderRegisterOptions() {
  const areaOptions = ref<CrmDictionaryView[]>([])
  const departmentOptions = ref<HrDepartment[]>([])
  const employeeOptions = ref<HrEmployeeRecord[]>([])
  const employeeLoading = ref(false)
  const creatorOptions = ref<string[]>([])
  const optionError = ref('')

  const areaTree = computed(() => buildAreaTree(areaOptions.value))
  const departmentOptionsTree = computed(() => departmentTree(departmentOptions.value))

  const areaTreeProps = { value: 'code', label: 'name', children: 'children' }
  const departmentTreeProps = { value: 'id', label: 'departmentName', children: 'children' }

  function errorMessage(reason: unknown, fallback: string) {
    if (reason && typeof reason === 'object' && 'message' in reason) {
      return String((reason as { message?: unknown }).message || fallback)
    }
    return fallback
  }

  async function searchEmployees(keyword: string) {
    employeeLoading.value = true
    try {
      const result = await getHrEmployees({
        begin: 0,
        step: 50,
        keyword: keyword?.trim() || undefined,
        employmentStatus: 'ACTIVE',
      })
      employeeOptions.value = result.items
    } catch (reason) {
      optionError.value = errorMessage(reason, '业务员选项加载失败')
    } finally {
      employeeLoading.value = false
    }
  }

  async function loadOptions() {
    const results = await Promise.allSettled([
      getAllCrmCustomerAreas(),
      hrOrganizationApi.departments(),
      getOrderRegisterCreators(),
      searchEmployees(''),
    ])
    const [areas, departments, creators] = results
    if (areas.status === 'fulfilled') {
      areaOptions.value = areas.value.filter((item) => item.status === 'ACTIVE')
    } else {
      optionError.value = errorMessage(areas.reason, '归属地区选项加载失败')
    }
    if (departments.status === 'fulfilled') {
      departmentOptions.value = departments.value.filter((item) => item.statusCode === 'ACTIVE')
    } else {
      optionError.value = errorMessage(departments.reason, '部门选项加载失败')
    }
    if (creators.status === 'fulfilled') {
      creatorOptions.value = creators.value
    } else {
      optionError.value = errorMessage(creators.reason, '创建人选项加载失败')
    }
  }

  function areaLabel(code: string | null | undefined, displayName?: string | null): string {
    if (displayName?.trim()) return displayName.trim()
    const raw = code?.trim()
    if (!raw) return '-'
    return areaOptions.value.find((item) => item.code === raw)?.name || raw
  }

  function departmentLabel(id: number | null | undefined, displayName?: string | null): string {
    if (displayName?.trim()) return displayName.trim()
    if (id === null || id === undefined) return '-'
    return (
      departmentOptions.value.find((item) => item.id === id)?.departmentName || String(id)
    )
  }

  function employeeLabel(code: string | null | undefined, displayName?: string | null): string {
    if (displayName?.trim()) return displayName.trim()
    const raw = code?.trim()
    if (!raw) return '-'
    return employeeOptions.value.find((item) => item.employeeCode === raw)?.employeeName || raw
  }

  function ensureEmployeeOption(code: string, name: string) {
    if (!code || employeeOptions.value.some((item) => item.employeeCode === code)) return
    employeeOptions.value = [
      {
        id: code,
        employeeCode: code,
        employeeName: name || code,
        mobile: null,
        email: null,
        employmentStatus: 'ACTIVE',
        jobCategory: null,
        positionCode: null,
        positionName: null,
        departmentName: null,
        leaderEmployeeCode: null,
        leaderName: null,
        regionName: null,
        cityName: null,
        sourceSystem: null,
        sourceDocumentNo: null,
        sourceCreatedAt: null,
        sourceUpdatedAt: null,
        entryDate: null,
        leaveDate: null,
        remark: null,
        revision: 0,
        createdBy: null,
        createdTime: null,
        updatedBy: null,
        updatedTime: null,
      },
      ...employeeOptions.value,
    ]
  }

  return {
    areaOptions,
    departmentOptions,
    employeeOptions,
    employeeLoading,
    creatorOptions,
    optionError,
    areaTree,
    departmentOptionsTree,
    areaTreeProps,
    departmentTreeProps,
    loadOptions,
    searchEmployees,
    areaLabel,
    departmentLabel,
    employeeLabel,
    ensureEmployeeOption,
  }
}

export type { AreaNode, DepartmentNode }
