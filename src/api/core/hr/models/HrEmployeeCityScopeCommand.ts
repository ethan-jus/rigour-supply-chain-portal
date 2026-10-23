/** 员工与管辖范围一次提交；只发送新增或修改的记录，不删除历史。 */
export interface HrEmployeeCityScopeCommand {
  id: string | null
  revision: number | null
  requestId: string
  cityCode: string
  cityName: string
  effectiveFrom: string
  effectiveTo: string | null
  enabled: boolean
  remark: string
}
