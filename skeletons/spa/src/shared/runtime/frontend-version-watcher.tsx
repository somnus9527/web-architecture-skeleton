import { useEffect } from 'react';

import { appEnv } from '@/shared/config/app-env';
import { logger } from '@/shared/services/logger';

const VERSION_CHECK_INTERVAL_MS = 60_000;
const VERSION_CONFIRM_DELAY_MS = 4_000;
const VERSION_REQUEST_TIMEOUT_MS = 5_000;
const VERSION_CHANNEL_NAME = 'spa-app-frontend-version';
const REFRESHED_VERSION_STORAGE_KEY = 'spa-app:last-refreshed-version';

interface IFrontendVersionResponse {
  releaseId: string;
}

interface IFrontendVersionWatcherProps {
  currentReleaseId: string;
}

function isFrontendVersionResponse(value: unknown): value is IFrontendVersionResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'releaseId' in value && typeof value.releaseId === 'string' && value.releaseId.trim().length > 0;
}

function getVersionEndpoint(): string {
  const basePath = appEnv.basePath === '/' ? '' : appEnv.basePath;
  const endpoint = new URL(`${basePath}/version.json`, window.location.origin);

  /**
   * CDN/代理可能忽略 no-store；每次请求带唯一查询参数作为额外防御。
   * 真正的保证仍然是 CDN 不缓存该路径，见 frontend-release-refresh.md。
   */
  endpoint.searchParams.set('_', String(Date.now()));

  return `${endpoint.pathname}${endpoint.search}`;
}

/**
 * 周期检查发布包中的版本文件，二次确认稳定后同步刷新所有可见标签页。
 *
 * @param props - 当前 JS 构建内固化的 release id。
 * @returns 不渲染可见节点。
 */
export function FrontendVersionWatcher({ currentReleaseId }: IFrontendVersionWatcherProps) {
  useEffect(() => {
    let isDisposed = false;
    let checkTimer: number | undefined;
    let confirmTimer: number | undefined;
    let activeController: AbortController | undefined;
    let pendingReleaseId: string | undefined;
    const versionChannel =
      typeof window.BroadcastChannel === 'function' ? new window.BroadcastChannel(VERSION_CHANNEL_NAME) : undefined;

    if (window.sessionStorage.getItem(REFRESHED_VERSION_STORAGE_KEY) === currentReleaseId) {
      window.sessionStorage.removeItem(REFRESHED_VERSION_STORAGE_KEY);
    }

    function clearTimers(): void {
      if (checkTimer !== undefined) {
        window.clearTimeout(checkTimer);
        checkTimer = undefined;
      }
      if (confirmTimer !== undefined) {
        window.clearTimeout(confirmTimer);
        confirmTimer = undefined;
      }
    }

    async function requestCurrentReleaseId(): Promise<string | undefined> {
      activeController?.abort();
      activeController = new AbortController();
      const requestController = activeController;
      const timeoutId = window.setTimeout(() => requestController.abort(), VERSION_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(getVersionEndpoint(), {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
          signal: requestController.signal,
        });

        if (!response.ok) {
          logger.warn('frontend_version_check_failed', { status: response.status });
          return undefined;
        }

        const cacheControl = response.headers?.get('cache-control') ?? '';
        const age = Number(response.headers?.get('age') ?? '0');
        const cdnCacheStatus = response.headers?.get('x-cache') ?? response.headers?.get('cf-cache-status') ?? '';
        if (Number.isFinite(age) && age > 0) {
          logger.warn('frontend_version_cache_age', { age, cacheControl, cdnCacheStatus });
        }
        if (/hit/iu.test(cdnCacheStatus) || !/no-store|no-cache/iu.test(cacheControl)) {
          logger.warn('frontend_version_cache_risk', { age, cacheControl, cdnCacheStatus });
        }

        const payload: unknown = await response.json();
        if (!isFrontendVersionResponse(payload)) {
          logger.warn('frontend_version_response_invalid');
          return undefined;
        }

        return payload.releaseId.trim();
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          logger.warn('frontend_version_check_unavailable', { error });
        }
        return undefined;
      } finally {
        window.clearTimeout(timeoutId);
        if (activeController === requestController) {
          activeController = undefined;
        }
      }
    }

    function refreshForRelease(releaseId: string, shouldBroadcast: boolean): void {
      if (
        isDisposed ||
        releaseId === currentReleaseId ||
        window.sessionStorage.getItem(REFRESHED_VERSION_STORAGE_KEY) === releaseId
      ) {
        return;
      }

      window.sessionStorage.setItem(REFRESHED_VERSION_STORAGE_KEY, releaseId);
      if (shouldBroadcast) {
        versionChannel?.postMessage({ releaseId });
      }
      window.location.reload();
    }

    function scheduleNextCheck(): void {
      if (isDisposed || document.visibilityState === 'hidden') {
        return;
      }

      checkTimer = window.setTimeout(() => {
        void checkForVersionUpdate();
      }, VERSION_CHECK_INTERVAL_MS);
    }

    async function confirmRelease(releaseId: string): Promise<void> {
      const confirmedReleaseId = await requestCurrentReleaseId();
      pendingReleaseId = undefined;

      if (!isDisposed && document.visibilityState !== 'hidden' && confirmedReleaseId === releaseId) {
        refreshForRelease(releaseId, true);
        return;
      }

      scheduleNextCheck();
    }

    async function checkForVersionUpdate(): Promise<void> {
      if (isDisposed || document.visibilityState === 'hidden' || pendingReleaseId) {
        return;
      }

      const releaseId = await requestCurrentReleaseId();
      if (releaseId && releaseId !== currentReleaseId) {
        pendingReleaseId = releaseId;
        confirmTimer = window.setTimeout(() => {
          void confirmRelease(releaseId);
        }, VERSION_CONFIRM_DELAY_MS);
        return;
      }

      scheduleNextCheck();
    }

    function handlePageActive(): void {
      clearTimers();
      pendingReleaseId = undefined;

      if (document.visibilityState === 'hidden') {
        activeController?.abort();
        return;
      }

      void checkForVersionUpdate();
    }

    function handleVersionBroadcast(event: MessageEvent<unknown>): void {
      if (isFrontendVersionResponse(event.data)) {
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
      clearTimers();
      activeController?.abort();
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
