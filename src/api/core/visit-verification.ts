import { apiClient } from './client'
export interface VisitAppeal { id:string; status:string; reason:string; originalState:string; originalReason:string|null; submittedAt:string; decision:string|null; reviewNote:string|null; reviewedAt:string|null }
export interface VisitVerification { visitId:string; state:string; reason:string|null; revision:number; canAppeal:boolean; appeals:VisitAppeal[] }
export interface VisitAppealRow { storeId:string; storeName:string; visitId:string; captureRef:string|null; employeeCode:string; visitedAt:string; appeal:VisitAppeal }
export interface VisitAppealQueue { items:VisitAppealRow[]; total:number; page:number; pageSize:number }
const options={cacheBypass:true,errorFeedback:'inline' as const}
export function readAppeals(status:string,page:number,pageSize:number,signal?:AbortSignal) { return apiClient.get<VisitAppealQueue>('/crm/visit-appeals',{...options,signal,params:{status,page,pageSize}}) }
export function readVerification(store:string,visit:string) { return apiClient.get<VisitVerification>(`/crm/stores/${store}/visits/${visit}/verification`,options) }
export function decideAppeal(store:string,visit:string,revision:number,decision:string,reason:string) { return apiClient.post(`/crm/stores/${store}/visits/${visit}/review`,{revision,decision,reason},options) }
export function verificationReason(value:string|null) {
 const labels:Record<string,string>={AUTO_EVIDENCE_COMPLETE:'客观条件已满足',RECORDING_PENDING:'录音上传核验中',WORK_DAY_CUTOFF: '作业日已截止，拜访未结束', VISIT_TIME_INVALID:'到离店时间异常',RESULT_MISSING:'待提交结果',CONTACT_NOT_CONFIRMED:'未确认客户沟通',DWELL_TOO_SHORT:'停留时长不足',STOREFRONT_PHOTO_MISSING:'缺少有效门头照',RECORDING_UNVERIFIED:'录音尚未通过技术校验',RECORDING_TOO_SHORT:'录音时长不足',TRANSCRIPTION_PENDING:'录音转写中',TRANSCRIPTION_ERROR:'录音转写处理异常',TRANSCRIPTION_MISSING:'缺少可转写录音',CONTENT_UNAVAILABLE:'未取得可靠的内容核验结果',AI_REVIEW_REQUIRED:'内容核验存在疑点',AI_LOW_CONFIDENCE:'内容核验置信度不足',SUBMISSION_AFTER_DEADLINE:'归属到期后提交'}
 return (value||'').split(',').map(x=>labels[x]||x).join('；')
}
