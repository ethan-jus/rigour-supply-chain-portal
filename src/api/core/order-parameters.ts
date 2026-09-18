import { apiClient } from './client'
export interface OrderParameter { code:string; name:string; group:string; value:string; defaultValue:string; description:string; effect:string; minimum:number; maximum:number; revision:number }
export const getOrderParameters = () => apiClient.get<OrderParameter[]>('/orders/settings/parameters')
export const saveOrderParameter = (code:string, value:string, revision:number, reason:string) => apiClient.put<OrderParameter>(`/orders/settings/parameters/${encodeURIComponent(code)}`, {value,revision,reason})
