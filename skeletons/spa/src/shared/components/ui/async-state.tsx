import type { ReactNode } from 'react';

/**
 * 异步区域参数。三态的文案与视觉全部由调用方注入，组件只负责优先级与布局。
 */
export interface IAsyncStateProps {
  /**
   * 是否加载中。
   */
  loading: boolean;
  /**
   * 是否出错；错误文案放在 errorNode 里。
   */
  error?: boolean;
  /**
   * 是否为空；仅在非加载、非错误时生效。
   */
  isEmpty?: boolean;
  /**
   * 加载态节点。
   */
  loadingNode?: ReactNode;
  /**
   * 错误态节点。
   */
  errorNode?: ReactNode;
  /**
   * 空态节点。
   */
  emptyNode?: ReactNode;
  /**
   * 区域测试 id，保留给既有测试。
   */
  testId?: string;
  /**
   * 正常内容。
   */
  children: ReactNode;
}

/**
 * 异步区域的三态出口：加载中 > 错误 > 空 > 内容。
 *
 * 把"每页手写 loading/error/empty"收敛到一处。组件不含任何文案与业务判断，
 * 三态节点由调用方提供，便于同一套交互在任意业务域复用。
 *
 * @param props - 异步区域参数。
 * @returns 当前状态对应的节点。
 */
export function AsyncState({
  loading,
  error = false,
  isEmpty = false,
  loadingNode,
  errorNode,
  emptyNode,
  testId,
  children,
}: IAsyncStateProps) {
  if (loading) {
    return <div data-testid={testId ? `${testId}-loading` : undefined}>{loadingNode}</div>;
  }

  if (error) {
    return <div data-testid={testId ? `${testId}-error` : undefined}>{errorNode}</div>;
  }

  if (isEmpty) {
    return <div data-testid={testId ? `${testId}-empty` : undefined}>{emptyNode}</div>;
  }

  return <div data-testid={testId}>{children}</div>;
}
