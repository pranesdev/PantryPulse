import { createContext, useContext } from 'react';

export const RealtimeContext = createContext(false);

export function useRealtimeStatus() {
  return useContext(RealtimeContext);
}