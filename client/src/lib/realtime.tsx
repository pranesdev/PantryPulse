import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { API_BASE } from './api';
import { RealtimeContext } from './realtimeContext';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE.replace(/\/api\/?$/, '');

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL, { reconnection: true, reconnectionDelayMax: 5000 });
    const invalidate = (...keys: string[]) => {
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onTelemetry = () => invalidate('dashboard', 'telemetry', 'reports', 'shelves', 'devices');
    const onDevice = () => invalidate('dashboard', 'devices', 'shelves');
    const onAlert = () => invalidate('dashboard', 'alerts', 'reports');
    const onInventory = () => invalidate('dashboard', 'inventory', 'reports', 'surplus');
    const onSettings = () => invalidate('dashboard', 'settings');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('telemetry:update', onTelemetry);
    socket.on('device:update', onDevice);
    socket.on('alert:update', onAlert);
    socket.on('alerts:read-all', onAlert);
    socket.on('inventory:update', onInventory);
    socket.on('surplus:update', onInventory);
    socket.on('settings:update', onSettings);

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [queryClient]);

  return <RealtimeContext.Provider value={connected}>{children}</RealtimeContext.Provider>;
}