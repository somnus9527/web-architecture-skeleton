import { onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useNetworkStore } from '@domain/network/network-store';

/**
 * 把 React Query 的 onlineManager 桥接到 NetInfo 状态，驱动离线暂停与恢复重连。
 *
 * @returns 空节点。
 */
export function QueryOnlineBridge() {
  useEffect(() => {
    onlineManager.setOnline(useNetworkStore.getState().isConnected);

    return useNetworkStore.subscribe((state) => {
      onlineManager.setOnline(state.isConnected);
    });
  }, []);

  return null;
}
