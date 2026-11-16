import { apiClient } from './client'
export interface CaseEvent { id:string; type:string; decision:string|null; note:string; employeeStatement:boolean; createdAt:string }
export interface FieldworkCase { id:string; salesProfileId:string; workDayId:string; visitId:string|null; kind:string; title:string; evidenceJson:string; status:string; version:number; detectedAt:string; updatedAt:string; events:CaseEvent[] }
export interface TranscriptSegment { startMs:number; endMs:number; text:string; speakerId:number|null }
export interface RecordingAnalysis { clipId:string; clipIndex:number; status:string; transcript:string|null; segments:TranscriptSegment[]; summaryStatus:string; summary:string|null; summaryModel:string|null; errorCode:string|null; updatedAt:string }
export interface VisitAnalysis { visitId:string; processingEnabled:boolean; clips:RecordingAnalysis[] }
export interface RecordingClip { clipId:string; clipIndex:number; clientDurationMs:number|null }
export interface VisitRecordings { clips:RecordingClip[] }
export interface PhotoEvidence { evidenceId:string; captureSource:string; capturedAt:string; distanceToTargetMeters:number|null; evidenceStatus:string }
const options=(signal?:AbortSignal)=>({signal,cacheBypass:true,errorFeedback:'inline' as const})
export function visitAnalysis(visit:string,signal?:AbortSignal) { return apiClient.get(`/sales/management/visits/${visit}/recording-analysis`,options(signal)) as Promise<VisitAnalysis> }
export function visitRecordings(visit:string,signal?:AbortSignal) { return apiClient.get(`/sales/management/visits/${visit}/recordings`,options(signal)) as Promise<VisitRecordings> }
export function visitPhotos(visit:string,signal?:AbortSignal) { return apiClient.get(`/sales/management/visits/${visit}/evidence`,options(signal)) as Promise<{photos:PhotoEvidence[]}> }
export function visitCases(visit:string,signal?:AbortSignal) { return apiClient.get(`/sales/management/visits/${visit}/cases`,options(signal)) as Promise<FieldworkCase[]> }
export function dayCases(profile:string,day:string,signal?:AbortSignal) { return apiClient.get(`/sales/management/profiles/${profile}/work-days/${day}/cases`,options(signal)) as Promise<FieldworkCase[]> }
export function saveCaseReview(item:FieldworkCase,decision:string,note:string,requestId:string) {
  return apiClient.post(`/sales/management/fieldwork/cases/${item.id}/reviews`,{requestId,expectedVersion:item.version,decision,note},{errorFeedback:'inline'}) as Promise<FieldworkCase>
}
export function evidenceBlob(visit:string,kind:'recordings/clips'|'evidence/photos',id:string,signal?:AbortSignal) {
  return apiClient.get(`/sales/management/visits/${visit}/${kind}/${id}`,{...options(signal),responseType:'blob'}) as Promise<Blob>
}
export function retryAnalysis(visit:string,clip:string) { return apiClient.post(`/sales/management/visits/${visit}/recording-analysis/${clip}/retry`,undefined,{errorFeedback:'inline'}) as Promise<VisitAnalysis> }
export function caseStatus(status:string) { return ({OPEN:'待核查',AWAITING_STATEMENT:'待说明',EXPLAINED:'已说明',RESOLVED:'已排除',CONFIRMED:'已确认异常'} as Record<string,string>)[status]||'待核查' }
export function audioClock(ms:number) { const seconds=Math.max(0,Math.floor(ms/1000)); return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}` }
