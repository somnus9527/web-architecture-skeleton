import { useEffect } from 'react';

import { useNetworkStore } from '@domain/network/network-store';

/**
 * 在应用根挂载一次 NetInfo 订阅，把网络状态写入 network store。
 *
 * @returns 空节点。
 */
export function NetworkBridge() {
  useEffect(() => useNetworkStore.getState().subscribe(), []);

  return null;
}
