import { focusManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

/**
 * 把 RN AppState 桥接到 React Query 的 focusManager。
 *
 * 应用从后台回到前台时触发 stale query refetch；组件自身不渲染任何节点。
 *
 * @returns null。
 */
export function QueryFocusBridge() {
  useEffect(() => {
    function handleAppStateChange(state: AppStateStatus): void {
      focusManager.setFocused(state === 'active');
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  return null;
}
