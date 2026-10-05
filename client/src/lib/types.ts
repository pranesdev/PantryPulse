export type TelemetryPoint = {
  id: string;
  deviceId: string;
  shelfId: string;
  shelfName?: string;
  weight: number;
  temperature: number;
  humidity: number;
  voc: number;
  gasStatus: string;
  timestamp: string;
};

export type Sensor = {
  id: string;
  type: string;
  health: string;
};

export type Shelf = {
  id: string;
  shelfId: string;
  name: string;
  maxCapacity: number;
  currentWeight: number | null;
  temperature: number | null;
  humidity: number | null;
  voc?: number | null;
  gasStatus?: string | null;
  lastTelemetryAt: string | null;
  utilization: number | null;
  status: string;
  device: { deviceId: string; name: string; status: string; firmware: string | null; lastSeen: string | null };
  sensors: Sensor[];
  inventoryCount: number;
};

export type Device = {
  id: string;
  deviceId: string;
  name: string;
  ipAddress: string | null;
  firmware: string | null;
  lastSeen: string | null;
  status: string;
  shelves: Array<{ shelfId: string; name: string; sensors: Sensor[] }>;
};

export type InventoryItem = {
  id: string;
  food: string;
  category: string;
  batch: string;
  quantity: number;
  weight: number;
  expiryDate: string;
  shelfId: string;
  shelfName: string;
  status: string;
  rfidTagId: string | null;
  addedAt: string;
  surplusId: string | null;
};

export type Alert = {
  id: string;
  type: string;
  severity: string;
  shelfId: string | null;
  deviceId: string | null;
  description: string;
  timestamp: string;
  read: boolean;
  resolved: boolean;
  shelf: { id: string; shelfId: string; name: string } | null;
  device: { id: string; deviceId: string; name: string } | null;
};

export type Setting = { key: string; value: string; source?: 'database' | 'default' };

export type SurplusItem = {
  id: string;
  action: 'DONATION' | 'USED' | 'DISMISSED' | null;
  detectedAt: string;
  inventoryId: string;
  food: string;
  category: string;
  batch: string;
  quantity: number;
  weight: number;
  expiryDate: string;
  shelfId: string;
  shelfName: string;
};

export type DashboardData = {
  generatedAt: string;
  range: string;
  demoMode: boolean;
  metrics: {
    totalWeight: number;
    totalCapacity: number;
    utilization: number | null;
    temperature: number | null;
    humidity: number | null;
    voc: number | null;
    inventoryCount: number;
    expiringSoon: number;
    expiredItems: number;
    surplusItems: number;
    activeAlerts: number;
    onlineDevices: number;
    deviceCount: number;
  };
  shelves: Shelf[];
  devices: Device[];
  inventory: InventoryItem[];
  alerts: Alert[];
  surplus: number;
  settings: Setting[];
  telemetry: TelemetryPoint[];
};

export type ReportData = {
  period: { from: string; to: string };
  summary: {
    telemetryPoints: number;
    inventoryItems: number;
    expiringItems: number;
    expiredItems: number;
    surplusDetected: number;
    surplusDonated: number;
    alerts: number;
    alertsBySeverity: Record<string, number>;
  };
  telemetry: TelemetryPoint[];
  daily: Array<{ date: string; count: number; averageTemperature: number; averageHumidity: number; averageVoc: number; averageWeight: number }>;
  shelfUtilization: Array<{ shelfId: string; name: string; capacity: number; weight: number | null; utilization: number | null }>;
  inventoryMix: Record<string, number>;
  alerts: Alert[];
  surplus: Array<{ action: string | null; detectedAt: string }>;
};

export type RfidMatch = {
  rfidTagId: string;
  batch: string;
  food: string;
  category: string;
  quantity: number;
  weight: number;
  expiryDate: string;
  inventory: Array<{ id: string; quantity: number; weight: number; shelfId: string; shelfName: string; surplus: boolean }>;
};

export type ApiError = { message: string; details?: unknown };