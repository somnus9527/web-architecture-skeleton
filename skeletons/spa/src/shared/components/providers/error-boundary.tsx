import { Component, type ErrorInfo, type ReactNode } from 'react';

import { t } from '@/locale';
import { logger } from '@/shared/services/logger';

/**
 * ErrorBoundary 组件参数。
 */
interface IErrorBoundaryProps {
  /**
   * 被保护的 React 子树。
   */
  children: ReactNode;
}

/**
 * ErrorBoundary 内部状态。
 */
interface IErrorBoundaryState {
  /**
   * 捕获到的渲染错误。
   */
  error: Error | null;
}

/**
 * 应用顶层错误边界，避免渲染异常导致整页空白。
 */
export class ErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
  /**
   * 初始化错误边界状态。
   *
   * @param props - ErrorBoundary 组件参数。
   */
  constructor(props: IErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  /**
   * 把渲染错误转换成 fallback 状态。
   *
   * @param error - React 捕获到的错误。
   * @returns 下一次渲染使用的错误状态。
   */
  static getDerivedStateFromError(error: Error): IErrorBoundaryState {
    return { error };
  }

  /**
   * 记录 React 渲染错误，后续可接入远程错误上报。
   *
   * @param error - React 捕获到的错误。
   * @param info - 组件栈上下文。
   */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('react_error_boundary_caught', { error, componentStack: info.componentStack });
  }

  /**
   * 清除错误状态，让用户可以重新进入当前页面。
   */
  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  /**
   * 渲染错误兜底或正常子树。
   *
   * @returns React 子树。
   */
  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="grid min-h-screen place-items-center bg-slate-100 px-6">
          {/* 顶层错误兜底，避免用户看到空白页或技术栈错误。 */}
          <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-red-700">{t('common.error.title')}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{t('common.error.description')}</p>
            {/* 重试入口用于重置错误边界状态。 */}
            <button
              className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              type="button"
              onClick={this.reset}
            >
              {t('common.retry')}
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
