import axios from 'axios';
import type {
  Alert,
  DashboardData,
  Device,
  InventoryItem,
  ReportData,
  RfidMatch,
  Setting,
  Shelf,
  SurplusItem,
  TelemetryPoint,
} from './types';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';
const http = axios.create({ baseURL: API_BASE, timeout: 10000 });

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: { message?: string } | string }>(error)) {
    const payload = error.response?.data?.error;
    if (typeof payload === 'string') return payload;
    if (payload?.message) return payload.message;
    if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Try again.';
    if (!error.response) return 'The server could not be reached. Check the connection and try again.';
  }
  return fallback;
}

export const api = {
  getDashboard: async (params: { range?: string; shelfId?: string } = {}) =>
    (await http.get<DashboardData>('/dashboard', { params })).data,
  getTelemetry: async (params: { range?: string; shelfId?: string } = {}) =>
    (await http.get<TelemetryPoint[]>('/telemetry', { params })).data,
  postTelemetry: async (data: Omit<TelemetryPoint, 'id' | 'timestamp'> & { timestamp?: string }) =>
    (await http.post<TelemetryPoint>('/telemetry', data)).data,
  getShelves: async () => (await http.get<Shelf[]>('/shelves')).data,
  getShelf: async (shelfId: string) => (await http.get<Shelf & { telemetry: TelemetryPoint[]; inventory: InventoryItem[] }>(`/shelves/${encodeURIComponent(shelfId)}`)).data,
  createShelf: async (data: { shelfId: string; name: string; maxCapacity: number; deviceId: string }) =>
    (await http.post<Shelf>('/shelves', data)).data,
  updateShelf: async (shelfId: string, data: Partial<{ name: string; maxCapacity: number; deviceId: string }>) =>
    (await http.patch<Shelf>(`/shelves/${encodeURIComponent(shelfId)}`, data)).data,
  deleteShelf: async (shelfId: string) => http.delete(`/shelves/${encodeURIComponent(shelfId)}`),
  getInventory: async (params: { search?: string; shelfId?: string; category?: string } = {}) =>
    (await http.get<InventoryItem[]>('/inventory', { params })).data,
  createInventory: async (data: { food: string; category: string; batch: string; quantity: number; weight: number; expiryDate: string; shelfId: string; rfidTagId?: string | null }) =>
    (await http.post<InventoryItem>('/inventory', data)).data,
  updateInventory: async (id: string, data: Partial<Pick<InventoryItem, 'food' | 'category' | 'quantity' | 'weight' | 'expiryDate' | 'shelfId' | 'rfidTagId' | 'status'>>) =>
    (await http.patch<InventoryItem>(`/inventory/${encodeURIComponent(id)}`, data)).data,
  deleteInventory: async (id: string) => http.delete(`/inventory/${encodeURIComponent(id)}`),
  getAlerts: async (params: { severity?: string; resolved?: boolean; unread?: boolean } = {}) =>
    (await http.get<Alert[]>('/alerts', { params })).data,
  markAlertRead: async (id: string, read: boolean) =>
    (await http.patch<Alert>(`/alerts/${encodeURIComponent(id)}/read`, { read })).data,
  markAllAlertsRead: async () => (await http.post<{ updated: number }>('/alerts/read-all')).data,
  resolveAlert: async (id: string) =>
    (await http.patch<Alert>(`/alerts/${encodeURIComponent(id)}/resolve`)).data,
  getDevices: async () => (await http.get<Device[]>('/devices')).data,
  createDevice: async (data: { deviceId: string; name: string; ipAddress?: string; firmware?: string }) =>
    (await http.post<Device>('/devices', data)).data,
  updateDevice: async (deviceId: string, data: Partial<Pick<Device, 'name' | 'ipAddress' | 'firmware'>>) =>
    (await http.patch<Device>(`/devices/${encodeURIComponent(deviceId)}`, data)).data,
  deleteDevice: async (deviceId: string) => http.delete(`/devices/${encodeURIComponent(deviceId)}`),
  getSettings: async () => (await http.get<Setting[]>('/settings')).data,
  updateSetting: async (key: string, value: string) =>
    (await http.put<Setting>(`/settings/${encodeURIComponent(key)}`, { value })).data,
  getSurplus: async () => (await http.get<SurplusItem[]>('/surplus')).data,
  createSurplus: async (inventoryId: string) =>
    (await http.post<SurplusItem>(`/surplus/${encodeURIComponent(inventoryId)}`)).data,
  updateSurplusAction: async (id: string, action: 'DONATION' | 'USED' | 'DISMISSED') =>
    (await http.patch<SurplusItem>(`/surplus/${encodeURIComponent(id)}/action`, { action })).data,
  scanRfid: async (rfidTagId: string) => (await http.post<RfidMatch>('/rfid/scan', { rfidTagId })).data,
  getReports: async (params: { from: string; to: string }) =>
    (await http.get<ReportData>('/reports', { params })).data,
  exportReports: async (params: { from: string; to: string }) =>
    (await http.get<Blob>('/reports/export.csv', { params, responseType: 'blob' })).data,
};
