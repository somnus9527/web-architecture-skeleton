import { useCallback, useState } from 'react';

/**
 * 开关类交互（Dialog、Drawer、菜单、折叠区）的状态与操作。
 */
export interface IUseDisclosureResult {
  /**
   * 当前是否展开。
   */
  isOpen: boolean;
  /**
   * 打开。
   */
  open: () => void;
  /**
   * 关闭。
   */
  close: () => void;
  /**
   * 切换。
   */
  toggle: () => void;
  /**
   * 直接设置状态。
   */
  setOpen: (next: boolean) => void;
}

/**
 * 管理一个布尔开关及其稳定引用操作，避免每个组件重复写三件套。
 *
 * @param initialOpen - 初始状态。
 * @returns 开关状态与操作。
 */
export function useDisclosure(initialOpen = false): IUseDisclosureResult {
  const [isOpen, setOpen] = useState(initialOpen);
  const open = useCallback((): void => setOpen(true), []);
  const close = useCallback((): void => setOpen(false), []);
  const toggle = useCallback((): void => setOpen((current) => !current), []);

  return { isOpen, open, close, toggle, setOpen };
}
