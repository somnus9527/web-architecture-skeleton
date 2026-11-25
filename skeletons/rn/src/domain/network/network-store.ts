import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

/**
 * 归一化后的网络类型。
 */
export type NetworkType = 'wifi' | 'cellular' | 'none' | 'unknown' | 'other';

/**
 * 全局网络状态。
 */
export interface INetworkState {
  /** 是否已连接网络。 */
  isConnected: boolean;
  /** 是否能访问互联网；null 表示尚未检测。 */
  isInternetReachable: boolean | null;
  /** 网络类型。 */
  type: NetworkType;
  /** 订阅 NetInfo，返回取消订阅函数。 */
  subscribe: () => () => void;
}

/**
 * 把 NetInfo 的 type 归一化为业务使用的枚举。
 *
 * @param type - NetInfo 原始类型。
 * @returns 归一化网络类型。
 */
function normalizeNetworkType(type: string): NetworkType {
  if (type === 'wifi' || type === 'cellular' || type === 'none' || type === 'unknown') {
    return type;
  }

  return 'other';
}

/**
 * 网络状态 store：业务代码只从这里读取连接状态，不直接 import NetInfo。
 */
export const useNetworkStore = create<INetworkState>((set) => ({
  isConnected: true,
  isInternetReachable: null,
  type: 'unknown',
  subscribe: () =>
    NetInfo.addEventListener((state: NetInfoState) => {
      set({
        isConnected: Boolean(state.isConnected),
        isInternetReachable: state.isInternetReachable,
        type: normalizeNetworkType(state.type),
      });
    }),
}));
