import type { VisitPolicy } from '@/api/core/sales-visit-policy'

export function copyVisitPolicy(policy: VisitPolicy): VisitPolicy {
  return {
    ...policy,
    aiAutoConfirmThreshold: policy.aiAutoConfirmThreshold ?? null,
    captureRules: {
      ...policy.captureRules,
      requireLocationOnOpen: false,
      maximumLocationAccuracyMeters: policy.captureRules.maximumLocationAccuracyMeters ?? null,
      automaticCheckout: policy.captureRules.automaticCheckout ?? false,
      automaticCheckoutRadiusMeters: policy.captureRules.automaticCheckoutRadiusMeters ?? policy.radiusMeters,
    },
  }
}

export function policyFields(name: string, policy: VisitPolicy) {
  const capture = policy.captureRules
  const enabled = (value: boolean) => value ? '开启' : '关闭'
  return [
    { key: 'name', label: '规则名称', value: name.trim() },
    { key: 'radiusMeters', label: '到店范围', value: `${policy.radiusMeters} 米` },
    { key: 'accuracy', label: '定位误差上限', value: capture.maximumLocationAccuracyMeters == null ? '不限制' : `${capture.maximumLocationAccuracyMeters} 米` },
    { key: 'minimumDwellMinutes', label: '最低停留时间', value: policy.minimumDwellMinutes === 0 ? '不设门槛' : `${policy.minimumDwellMinutes} 分钟` },
    { key: 'checkout', label: '离店自动结束', value: enabled(capture.automaticCheckout) },
    { key: 'departureRadius', label: '自动离店距离', value: capture.automaticCheckout ? `${capture.automaticCheckoutRadiusMeters ?? policy.radiusMeters} 米` : '未启用' },
    { key: 'requiredPhotoCount', label: '最低照片数量', value: `${policy.requiredPhotoCount} 张` },
    { key: 'photoImport', label: '照片来源', value: capture.allowPhotoImport ? '拍照或相册上传' : '仅现场拍照' },
    { key: 'recordingEnabled', label: '要求拜访录音', value: enabled(policy.recordingEnabled) },
    { key: 'automaticRecording', label: '自动开始与停止', value: enabled(capture.automaticRecording) },
    { key: 'recordingImport', label: '录音来源', value: capture.allowRecordingImport ? '允许导入录音' : '仅 APP 现场录音' },
    { key: 'minimumRecordingSeconds', label: '有效拜访最低录音时长', value: policy.minimumRecordingSeconds === 0 ? '不设门槛' : `${Math.floor(policy.minimumRecordingSeconds / 60)} 分钟${policy.minimumRecordingSeconds % 60 ? ` ${policy.minimumRecordingSeconds % 60} 秒` : ''}` },
    { key: 'maximumClipGapSeconds', label: '片段间隔上限', value: `${policy.maximumClipGapSeconds} 秒` },
    { key: 'aiAsrEnabled', label: '录音转写', value: enabled(policy.aiAsrEnabled) },
  ]
}

export function policyChanges(beforeName: string, before: VisitPolicy, name: string, policy: VisitPolicy) {
  const previous = new Map(policyFields(beforeName, before).map(field => [field.key, field.value]))
  return policyFields(name, policy)
    .filter(field => field.value !== previous.get(field.key))
    .map(field => ({ ...field, previous: previous.get(field.key)! }))
}

export function policyScope(type: string | null) {
  return ({ ALL: '当前企业全部销售', EMPLOYEE: '指定员工', CITY: '指定城市', TEAM: '指定团队' } as Record<string, string>)[type ?? 'ALL'] ?? type
}
