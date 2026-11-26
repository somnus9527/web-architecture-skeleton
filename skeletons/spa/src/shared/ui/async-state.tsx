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
    return (
      <div className="aui-async-state" data-testid={testId ? `${testId}-loading` : undefined}>
        {loadingNode}
      </div>
    );
  }

  if (error) {
    return (
      <div className="aui-async-state" data-testid={testId ? `${testId}-error` : undefined}>
        {errorNode}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="aui-async-state" data-testid={testId ? `${testId}-empty` : undefined}>
        {emptyNode}
      </div>
    );
  }

  return <div data-testid={testId}>{children}</div>;
}
