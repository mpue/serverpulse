import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import type { ProcessInfo } from '../types/api';

export function useProcesses() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsub = subscribe('processes', (data) => {
      setProcesses(data as ProcessInfo[]);
    });
    return unsub;
  }, [subscribe]);

  return processes;
}
