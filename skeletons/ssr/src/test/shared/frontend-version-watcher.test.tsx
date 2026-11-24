import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FrontendVersionWatcher } from '@/shared/runtime/frontend-version-watcher';
import { reloadBrowserPage } from '@/shared/utils/reload-browser-page';

vi.mock('@/shared/utils/reload-browser-page', () => ({
  reloadBrowserPage: vi.fn(),
}));

const mockedReloadBrowserPage = vi.mocked(reloadBrowserPage);

/**
 * 测试用 BroadcastChannel，记录广播消息并允许主动派发跨标签页消息。
 */
class MockBroadcastChannel extends EventTarget {
  /**
   * 当前测试进程中创建的频道实例。
   */
  static instances: MockBroadcastChannel[] = [];

  /**
   * 当前频道名称。
   */
  readonly name: string;

  /**
   * 当前频道发送过的消息。
   */
  readonly messages: unknown[] = [];

  /**
   * 创建测试频道并登记实例。
   *
   * @param name - 浏览器频道名称。
   */
  constructor(name: string) {
    super();
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  /**
   * 记录当前标签页发送的广播消息。
   *
   * @param message - 待广播的结构化消息。
   */
  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  /**
   * 关闭测试频道；测试实现无需释放浏览器资源。
   */
  close(): void {}

  /**
   * 模拟其他标签页发来的版本消息。
   *
   * @param message - 待派发的结构化消息。
   */
  emitMessage(message: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: message }));
  }
}

/**
 * 创建带 release id 的版本响应。
 *
 * @param releaseId - 端点返回的当前版本。
 * @returns Fetch API Response。
 */
function createVersionResponse(releaseId: string): Response {
  return Response.json({ releaseId });
}

/**
 * 创建可由测试主动完成的 Promise。
 *
 * @returns Promise 与对应 resolve 函数。
 */
function createDeferredResponse(): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} {
  let resolvePromise: ((response: Response) => void) | undefined;
  const promise = new Promise<Response>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (response) => resolvePromise?.(response),
  };
}

/**
 * 调整 jsdom 页面可见状态，驱动观察器的后台暂停分支。
 *
 * @param visibilityState - 目标页面可见状态。
 */
function setDocumentVisibility(visibilityState: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
}

describe('FrontendVersionWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
    MockBroadcastChannel.instances = [];
    mockedReloadBrowserPage.mockReset();
    window.sessionStorage.clear();
    setDocumentVisibility('visible');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('checks visible pages every 60 seconds and reloads after stable confirmation', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createVersionResponse('release-next'))
      .mockResolvedValueOnce(createVersionResponse('release-next'));
    vi.stubGlobal('fetch', fetchMock);

    render(<FrontendVersionWatcher currentReleaseId="release-current" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockedReloadBrowserPage).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem('ssr-app:last-refreshed-version')).toBe('release-next');
    expect(MockBroadcastChannel.instances[0]?.messages).toEqual([{ releaseId: 'release-next' }]);
    expect(mockedReloadBrowserPage).toHaveBeenCalledOnce();
  });

  it('pauses scheduled checks while the page is hidden and resumes when visible', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createVersionResponse('release-current'));
    vi.stubGlobal('fetch', fetchMock);

    render(<FrontendVersionWatcher currentReleaseId="release-current" />);

    setDocumentVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    setDocumentVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('cancels pending confirmation when the page becomes hidden', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createVersionResponse('release-next'));
    vi.stubGlobal('fetch', fetchMock);

    render(<FrontendVersionWatcher currentReleaseId="release-current" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    setDocumentVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mockedReloadBrowserPage).not.toHaveBeenCalled();
  });

  it('does not schedule confirmation when an in-flight check finishes after hiding', async () => {
    const deferredResponse = createDeferredResponse();
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(deferredResponse.promise);
    vi.stubGlobal('fetch', fetchMock);

    render(<FrontendVersionWatcher currentReleaseId="release-current" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    setDocumentVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async () => {
      deferredResponse.resolve(createVersionResponse('release-next'));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mockedReloadBrowserPage).not.toHaveBeenCalled();
  });

  it('reloads once when another tab broadcasts a confirmed version', () => {
    render(<FrontendVersionWatcher currentReleaseId="release-current" />);
    const versionChannel = MockBroadcastChannel.instances[0];

    act(() => {
      versionChannel?.emitMessage({ releaseId: 'release-next' });
      versionChannel?.emitMessage({ releaseId: 'release-next' });
    });

    expect(window.sessionStorage.getItem('ssr-app:last-refreshed-version')).toBe('release-next');
    expect(mockedReloadBrowserPage).toHaveBeenCalledOnce();
  });
});
