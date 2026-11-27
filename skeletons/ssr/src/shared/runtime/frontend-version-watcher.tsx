'use client';

import { useEffect } from 'react';

import { LOG_EVENTS } from '@/shared/observability/events';
import { clientLogger } from '@/shared/logger/client-logger';
import { reloadBrowserPage } from '@/shared/utils/reload-browser-page';

const VERSION_ENDPOINT = '/ssr-app-api/version';
const VERSION_CHECK_INTERVAL_MS = 60_000;
const VERSION_CONFIRM_DELAY_MS = 4_000;
/**
 * 从首屏 HTML 的 `meta[name=request-id]` 取本次请求的关联 ID。
 *
 * 浏览器后续请求带上它，运维就能用同一个 requestId 串起首屏 RSC 与客户端请求的日志。
 *
 * @returns 带 `X-Request-Id` 的请求头；meta 缺失时返回空对象。
 */
function requestIdHeader(): Record<string, string> {
  if (typeof document === 'undefined') {
    return {};
  }

  const requestId = document.querySelector('meta[name="request-id"]')?.getAttribute('content');
  return requestId ? { 'X-Request-Id': requestId } : {};
}

const VERSION_REQUEST_TIMEOUT_MS = 5_000;
const VERSION_CHANNEL_NAME = 'ssr-app-frontend-version';
const REFRESHED_VERSION_STORAGE_KEY = 'ssr-app:last-refreshed-version';

/**
 * 版本端点的最小公开响应。
 */
interface IFrontendVersionResponse {
  /**
   * 当前服务已生效的不可变 release id。
   */
  releaseId: string;
}

/**
 * 跨标签页同步的新版本消息。
 */
interface IFrontendVersionBroadcastMessage {
  /**
   * 已经完成二次确认、可触发整页刷新的目标 release id。
   */
  releaseId: string;
}

/**
 * 全局版本观察器入参。
 */
interface IFrontendVersionWatcherProps {
  /**
   * 当前页面构建时固化的 release id。
   */
  currentReleaseId: string;
}

/**
 * 判断未知响应是否为合法版本响应。
 *
 * @param value - 版本端点返回的未知 JSON。
 * @returns 是否包含非空 release id。
 */
function isFrontendVersionResponse(value: unknown): value is IFrontendVersionResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'releaseId' in value && typeof value.releaseId === 'string' && value.releaseId.trim().length > 0;
}

/**
 * 判断跨标签页消息是否包含合法目标版本。
 *
 * @param value - BroadcastChannel 收到的未知消息。
 * @returns 是否为合法版本广播。
 */
function isFrontendVersionBroadcastMessage(value: unknown): value is IFrontendVersionBroadcastMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'releaseId' in value && typeof value.releaseId === 'string' && value.releaseId.trim().length > 0;
}

/**
 * 每次调用都读取实时页面可见状态，避免跨异步边界复用旧判断。
 *
 * @returns 当前页面是否处于隐藏状态。
 */
function isPageHidden(): boolean {
  return document.visibilityState === 'hidden';
}

/**
 * 构造带唯一查询参数的版本端点。查询参数只作为缓存防御，CDN 仍必须对该路径关闭缓存。
 *
 * @returns 同源版本端点。
 */
function getVersionEndpoint(): string {
  const endpoint = new URL(VERSION_ENDPOINT, window.location.origin);
  endpoint.searchParams.set('_', String(Date.now()));

  return `${endpoint.pathname}${endpoint.search}`;
}

/**
 * 监听已生效的前端版本变化，并在二次确认后执行一次整页刷新。
 *
 * 可见标签页每 60 秒检查一次；隐藏时暂停。focus、visibility、online 与 pageshow
 * 会触发即时检查。任一标签页确认新版本后通过 BroadcastChannel 通知其他标签页。
 *
 * @param props - 当前页面固化的 release id。
 * @returns 该基础设施组件不渲染可见节点。
 */
export function FrontendVersionWatcher({ currentReleaseId }: IFrontendVersionWatcherProps) {
  useEffect(() => {
    let isDisposed = false;
    let checkTimer: number | undefined;
    let confirmTimer: number | undefined;
    let requestController: AbortController | undefined;
    let activeRequest: Promise<string | undefined> | undefined;
    let pendingReleaseId: string | undefined;
    const versionChannel =
      typeof window.BroadcastChannel === 'function' ? new window.BroadcastChannel(VERSION_CHANNEL_NAME) : undefined;

    if (window.sessionStorage.getItem(REFRESHED_VERSION_STORAGE_KEY) === currentReleaseId) {
      window.sessionStorage.removeItem(REFRESHED_VERSION_STORAGE_KEY);
    }

    /**
     * 清除下一次低频检查，确保全局观察器始终只有一个活动定时器。
     */
    function clearCheckTimer(): void {
      if (checkTimer !== undefined) {
        window.clearTimeout(checkTimer);
        checkTimer = undefined;
      }
    }

    /**
     * 清除新版本二次确认任务。
     */
    function clearConfirmTimer(): void {
      if (confirmTimer !== undefined) {
        window.clearTimeout(confirmTimer);
        confirmTimer = undefined;
      }
    }

    /**
     * 请求当前服务版本。同一时刻复用一个请求，并在超时或卸载时主动取消。
     *
     * @returns 合法 release id；请求失败或响应非法时返回 undefined。
     */
    function requestCurrentReleaseId(): Promise<string | undefined> {
      if (activeRequest) {
        return activeRequest;
      }

      requestController = new AbortController();
      const timeoutId = window.setTimeout(() => requestController?.abort(), VERSION_REQUEST_TIMEOUT_MS);

      activeRequest = (async () => {
        try {
          const response = await fetch(getVersionEndpoint(), {
            cache: 'no-store',
            credentials: 'same-origin',
            headers: {
              Accept: 'application/json',
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
              ...requestIdHeader(),
            },
            signal: requestController?.signal,
          });

          if (!response.ok) {
            clientLogger.debug(LOG_EVENTS.FRONTEND_VERSION_CHECK_FAILED, {
              span: 'frontend_version_watcher',
              fields: { status: response.status },
            });
            return undefined;
          }

          const cacheControl = response.headers?.get('cache-control') ?? '';
          const age = Number(response.headers?.get('age') ?? '0');
          const cdnCacheStatus = response.headers?.get('x-cache') ?? response.headers?.get('cf-cache-status') ?? '';
          if (Number.isFinite(age) && age > 0) {
            clientLogger.warn(LOG_EVENTS.FRONTEND_VERSION_CACHE_AGE, {
              span: 'frontend_version_watcher',
              fields: { age, cacheControl, cdnCacheStatus },
            });
          }
          if (/hit/iu.test(cdnCacheStatus) || !/no-store|no-cache/iu.test(cacheControl)) {
            clientLogger.warn(LOG_EVENTS.FRONTEND_VERSION_CACHE_RISK, {
              span: 'frontend_version_watcher',
              fields: { age, cacheControl, cdnCacheStatus },
            });
          }

          const payload: unknown = await response.json();
          if (!isFrontendVersionResponse(payload)) {
            clientLogger.warn(LOG_EVENTS.FRONTEND_VERSION_RESPONSE_INVALID, {
              span: 'frontend_version_watcher',
            });
            return undefined;
          }

          return payload.releaseId.trim();
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            clientLogger.debug(LOG_EVENTS.FRONTEND_VERSION_CHECK_UNAVAILABLE, {
              span: 'frontend_version_watcher',
            });
          }
          return undefined;
        } finally {
          window.clearTimeout(timeoutId);
          requestController = undefined;
          activeRequest = undefined;
        }
      })();

      return activeRequest;
    }

    /**
     * 针对已确认的新版本执行单次整页刷新，并广播给其他标签页。
     *
     * @param targetReleaseId - 服务端已稳定返回的目标 release id。
     * @param shouldBroadcast - 是否需要通知其他标签页。
     */
    function refreshForRelease(targetReleaseId: string, shouldBroadcast: boolean): void {
      if (
        isDisposed ||
        targetReleaseId === currentReleaseId ||
        window.sessionStorage.getItem(REFRESHED_VERSION_STORAGE_KEY) === targetReleaseId
      ) {
        return;
      }

      window.sessionStorage.setItem(REFRESHED_VERSION_STORAGE_KEY, targetReleaseId);
      if (shouldBroadcast) {
        versionChannel?.postMessage({ releaseId: targetReleaseId } satisfies IFrontendVersionBroadcastMessage);
      }
      reloadBrowserPage();
    }

    /**
     * 延迟后再次请求目标版本，避免在线覆盖尚未完成时过早刷新。
     *
     * @param targetReleaseId - 首次检查发现的新 release id。
     */
    function scheduleReleaseConfirmation(targetReleaseId: string): void {
      if (pendingReleaseId === targetReleaseId) {
        return;
      }

      clearConfirmTimer();
      pendingReleaseId = targetReleaseId;
      confirmTimer = window.setTimeout(() => {
        if (isDisposed || isPageHidden()) {
          pendingReleaseId = undefined;
          confirmTimer = undefined;
          return;
        }

        void requestCurrentReleaseId().then((confirmedReleaseId) => {
          pendingReleaseId = undefined;
          confirmTimer = undefined;
          if (!isDisposed && !isPageHidden() && confirmedReleaseId === targetReleaseId) {
            refreshForRelease(targetReleaseId, true);
          }
        });
      }, VERSION_CONFIRM_DELAY_MS);
    }

    /**
     * 检查当前服务版本，仅在获得合法且不同的版本时进入二次确认。
     */
    async function checkForVersionUpdate(): Promise<void> {
      if (isDisposed || isPageHidden() || pendingReleaseId) {
        return;
      }

      const targetReleaseId = await requestCurrentReleaseId();
      if (!isDisposed && !isPageHidden() && targetReleaseId && targetReleaseId !== currentReleaseId) {
        scheduleReleaseConfirmation(targetReleaseId);
      }
    }

    /**
     * 在当前检查结束后递归安排下一次检查，避免 setInterval 造成慢请求重叠。
     */
    function scheduleNextCheck(): void {
      clearCheckTimer();
      if (isDisposed || isPageHidden()) {
        return;
      }

      checkTimer = window.setTimeout(() => {
        void checkForVersionUpdate().finally(scheduleNextCheck);
      }, VERSION_CHECK_INTERVAL_MS);
    }

    /**
     * 页面恢复活跃时立即检查一次，并重新建立低频检查节奏。
     */
    function handlePageActive(): void {
      if (isPageHidden()) {
        clearCheckTimer();
        clearConfirmTimer();
        pendingReleaseId = undefined;
        return;
      }

      clearCheckTimer();
      void checkForVersionUpdate().finally(scheduleNextCheck);
    }

    /**
     * 接收其他标签页已确认的新版本，直接复用防循环逻辑同步刷新。
     *
     * @param event - BroadcastChannel 消息事件。
     */
    function handleVersionBroadcast(event: MessageEvent<unknown>): void {
      if (isFrontendVersionBroadcastMessage(event.data)) {
        refreshForRelease(event.data.releaseId.trim(), false);
      }
    }

    versionChannel?.addEventListener('message', handleVersionBroadcast);
    document.addEventListener('visibilitychange', handlePageActive);
    window.addEventListener('focus', handlePageActive);
    window.addEventListener('online', handlePageActive);
    window.addEventListener('pageshow', handlePageActive);
    scheduleNextCheck();

    return () => {
      isDisposed = true;
      clearCheckTimer();
      clearConfirmTimer();
      requestController?.abort();
      versionChannel?.removeEventListener('message', handleVersionBroadcast);
      versionChannel?.close();
      document.removeEventListener('visibilitychange', handlePageActive);
      window.removeEventListener('focus', handlePageActive);
      window.removeEventListener('online', handlePageActive);
      window.removeEventListener('pageshow', handlePageActive);
    };
  }, [currentReleaseId]);

  return null;
}
