import { apiClient } from './client'
export interface ResponsibilityEmployee { code:string;name:string;departmentName:string|null }
export interface ResponsibilityHistory {id:string;oldEmployee:string|null;oldName:string|null;newEmployee:string|null;newName:string|null;oldRegion:string|null;newRegion:string|null;reason:string;actor:string;occurredAt:string}
export interface ResponsibilityConflict {id:string;source:string;proposedEmployee:string|null;proposedRegion:string|null;sourceRevision:string|null;observedAt:string}
export interface ResponsibilityOverview {customerId:string;customerName:string;employeeCode:string|null;employeeName:string|null;regionCode:string|null;revision:number;history:ResponsibilityHistory[];historyTotal:number;conflicts:ResponsibilityConflict[];pendingCount:number}
const base='/crm/internal-customers'
export const responsibilityEmployees=(keyword='')=>apiClient.get<ResponsibilityEmployee[]>(`${base}/responsibility-employees`,{params:{keyword}})
export const customerResponsibility=(id:string)=>apiClient.get<ResponsibilityOverview>(`${base}/${encodeURIComponent(id)}/responsibility`)
export const transferCustomer=(id:string,command:{employeeCode:string|null;regionCode:string;revision:number;reason:string})=>apiClient.put<ResponsibilityOverview>(`${base}/${encodeURIComponent(id)}/responsibility`,command)
export const resolveResponsibility=(id:string,conflictId:string,decision:'KEEP_LOCAL'|'USE_SOURCE',customerRevision:number,reason:string)=>apiClient.post<ResponsibilityOverview>(`${base}/${encodeURIComponent(id)}/responsibility/conflicts/${encodeURIComponent(conflictId)}/resolve`,{decision,customerRevision,reason})
