export interface SalesPageDefinition {
  title: string
  group: string
  description: string
  owner: 'Sales Work' | 'CRM' | 'HR/Payroll' | 'Analytics BI'
  api: string
  facts: string[]
}

const page = (
  title: string,
  group: string,
  description: string,
  owner: SalesPageDefinition['owner'],
  api: string,
  facts: string[],
): SalesPageDefinition => ({ title, group, description, owner, api, facts })

export const SALES_PAGES: Record<string, SalesPageDefinition> = {
  dashboard: page('销售管控台', '管理首页', '聚合团队当日外勤、拜访进度、门店覆盖、证据异常和待复核任务。', 'Sales Work', '/api/v1/sales/management/dashboard', ['不提供PC打卡', '完整经营分析跳转BI', '只展示授权DataScope']),
  'attendance-today': page('今日状态', '外勤考勤', '查看应到、已签到、工作中、已签退和异常人员。', 'Sales Work', '/api/v1/sales/management/work-days?date=today', ['H5是销售打卡入口', '服务端时间为判定依据', '定位中断不单独判旷工']),
  'attendance-punches': page('打卡明细', '外勤考勤', '查询H5签到、签退、补卡等追加式原始事件。', 'Sales Work', '/api/v1/sales/management/punch-events', ['原始事件不可覆盖', '客户端事件必须幂等', '敏感位置按能力授权']),
  'attendance-days': page('工作日结', '外勤考勤', '查看Sales Work形成并发送给HR的销售工作日结候选。', 'Sales Work', '/api/v1/sales/management/work-day-summaries', ['不是HR正式考勤', '固定引用规则版本', '调整生成新版本']),
  'attendance-interruptions': page('定位中断摘要', '外勤考勤', '定位权限关闭、页面隐藏和采样失败的证据质量摘要。', 'Sales Work', '/api/v1/sales/management/work-interruptions', ['默认不展示完整轨迹', '前台尽力采样', '支持离线补传']),
  'attendance-adjustments': page('补卡与异常', '外勤考勤', '处理忘记签退、补卡、异常说明和申诉。', 'Sales Work', '/api/v1/sales/management/work-adjustments', ['原始打卡不修改', '审批结果追加记录', 'HR消费最终日结']),
  'visit-plans': page('拜访计划', '拜访管理', '安排销售、日期、客户门店和拜访目标。', 'Sales Work', '/api/v1/sales/management/visit-plans', ['目标来自CRM', '按员工团队城市授权', '计划与执行分离']),
  'visit-records': page('拜访记录', '拜访管理', '查询签到、签退、照片、录音和最终状态摘要。', 'Sales Work', '/api/v1/sales/management/visits', ['保存CRM ID', '保存发生时不可变快照', '原始录音不进入普通列表']),
  'visit-reviews': page('待复核', '拜访管理', '处理硬证据或AI分析异常的拜访。', 'Sales Work', '/api/v1/sales/management/review-queue', ['AI只给建议', '人工决定需填写理由', '全部操作审计']),
  'visit-appeals': page('申诉与调整', '拜访管理', '处理销售对拜访结果的申诉和追加调整。', 'Sales Work', '/api/v1/sales/management/visit-adjustments', ['不覆盖历史结论', '调整发布新事件', '保留复核链']),
  'stores-assigned': page('负责门店', '门店覆盖', '查看CRM分配给销售的有效客户和门店。', 'CRM', '/api/v1/sales/management/store-coverage?view=assigned', ['CRM唯一主写', 'Sales Work只读投影', '归属关系带有效期']),
  'stores-uncovered': page('未覆盖门店', '门店覆盖', '查看统计期间尚未被有效拜访的负责门店。', 'Analytics BI', '/api/v1/sales/management/store-coverage?view=uncovered', ['口径按规则版本', '按去重门店统计', '不修改CRM主档']),
  'stores-visited': page('已拜访门店', '门店覆盖', '查看期间存在已提交拜访的去重门店。', 'Sales Work', '/api/v1/sales/management/store-coverage?view=visited', ['已提交不等于有效', '使用发生时归属', '支持下钻拜访']),
  'stores-effective': page('有效拜访门店', '门店覆盖', '查看期间最终有效拜访的去重门店。', 'Analytics BI', '/api/v1/sales/management/store-coverage?view=effective', ['只消费VisitFinalized', '固定指标口径', '用于绩效快照']),
  'stores-candidates': page('新客户门店线索', '门店覆盖', '查看销售在H5提交、等待CRM查重审核的线索。', 'CRM', '/api/v1/crm/store-candidates', ['H5不直接建正式门店', 'CRM审核后生成或关联主档', '拜访回填正式目标']),
  'organization-profiles': page('销售画像', '销售组织', '维护HR员工对应的销售业务身份和生效状态。', 'Sales Work', '/api/v1/sales/management/profiles', ['员工主档归HR', '账号权限归IAM', '销售画像只保存业务属性']),
  'organization-teams': page('销售团队', '销售组织', '组织销售团队、主管和成员有效期。', 'Sales Work', '/api/v1/sales/management/teams', ['成员必须绑定员工', '调岗保留历史有效期', 'DataScope基于团队计算']),
  'organization-scopes': page('任职与城市范围', '销售组织', '查看HR任职、IAM授权组织和销售城市范围的组合结果。', 'HR/Payroll', '/api/v1/sales/management/organization-scopes', ['HR主任职', 'IAM主授权', 'Sales Work只消费投影']),
  'tasks-visits': page('拜访任务', '任务与目标', '给销售分配客户门店拜访任务。', 'Sales Work', '/api/v1/sales/management/visit-tasks', ['门店来自CRM', '任务不代替拜访事实', '支持团队城市范围']),
  'tasks-targets': page('目标分配', '任务与目标', '配置人员、团队和城市的销售工作目标。', 'Sales Work', '/api/v1/sales/management/targets', ['目标带期间和版本', '完成值由BI计算', '不在页面现算业绩']),
  'tasks-exemptions': page('目标减免', '任务与目标', '记录审批后的目标减免和调整。', 'Sales Work', '/api/v1/sales/management/target-exemptions', ['只追加调整', '保留审批依据', '进入BI锁定快照']),
  'exceptions-punch': page('打卡异常', '异常与复核', '聚合重复、缺卡、超窗和设备事件异常。', 'Sales Work', '/api/v1/sales/management/exceptions?type=punch', ['不直接扣工资', '可发起补卡', '最终考勤归HR']),
  'exceptions-location': page('定位异常', '异常与复核', '查看定位中断、低精度和不合理移动风险。', 'Sales Work', '/api/v1/sales/management/exceptions?type=location', ['完整轨迹单独授权', '风险不等于违规', '查看行为审计']),
  'exceptions-evidence': page('拜访证据异常', '异常与复核', '查看越界签到、停留不足和照片缺失。', 'Sales Work', '/api/v1/sales/management/exceptions?type=evidence', ['规则版本可追溯', '支持主管复核', '异常理由标准化']),
  'exceptions-recording': page('录音与AI异常', '异常与复核', '查看录音时长、重复、静音和AI低置信度风险。', 'Sales Work', '/api/v1/sales/management/exceptions?type=recording', ['录音播放独立授权', '服务端验证时长', 'AI不自动处罚']),
  'exceptions-reviews': page('主管复核', '异常与复核', '统一处理拜访和外勤人工复核任务。', 'Sales Work', '/api/v1/sales/management/review-queue', ['队列按DataScope过滤', '决定必须审计', '超时可升级']),
  'policies-field': page('外勤规则', '规则配置', '配置签到窗口、业务日、工作时长、定位和补卡。', 'Sales Work', '/api/v1/sales/policies/field', ['发布版本不可修改', '影响考勤需HR审核', 'H5展示生效摘要']),
  'policies-visit': page('拜访规则', '规则配置', '配置目标范围、签到距离、停留、照片和录音阈值。', 'Sales Work', '/api/v1/sales/policies/visit', ['参数使用明确字段', '历史拜访固化版本', '不允许AI自动判无效']),
  'policies-recording-ai': page('录音与AI规则', '规则配置', '配置录音分片、ASR、摘要、相关性和复核阈值。', 'Sales Work', '/api/v1/sales/policies/recording-ai', ['模型配置归AI域', '业务采用结果归Sales Work', '敏感数据最小授权']),
  'policies-scopes': page('适用范围', '规则配置', '绑定租户、城市、团队和员工例外规则。', 'Sales Work', '/api/v1/sales/policies/scopes', ['员工例外需原因和期限', '优先级确定且可解释', '禁止重叠生效']),
  'policies-releases': page('发布与历史版本', '规则配置', '审批、发布、退役和查询历史规则。', 'Sales Work', '/api/v1/sales/policies/releases', ['草稿与生效版本分离', '发布时间可预约', '所有发布可审计']),
}
