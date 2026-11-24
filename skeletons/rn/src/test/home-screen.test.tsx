import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import { HomeScreen } from '@/components/home/home-screen';
import '@/domain/i18n';
import { fetchHomeSummary } from '@/api/endpoints/home';

import type { ReactElement } from 'react';

jest.mock('@/api/endpoints/home');

const mockedFetchHomeSummary = fetchHomeSummary as jest.MockedFunction<typeof fetchHomeSummary>;

/**
 * 用真实 Provider 组合渲染首页，Query 关闭重试。
 *
 * @param element - 待渲染节点。
 * @returns 渲染结果。
 */
async function renderWithProviders(element: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });

  return await render(
    <QueryClientProvider client={client}>
      <PaperProvider>{element}</PaperProvider>
    </QueryClientProvider>,
  );
}

describe('home screen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render items returned by the summary endpoint', async () => {
    mockedFetchHomeSummary.mockResolvedValue({
      title: '工作台',
      items: [{ id: '1', title: '待处理订单', status: 'pending' }],
    });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('待处理订单')).toBeOnTheScreen();
    expect(screen.getByText('工作台')).toBeOnTheScreen();
  });

  it('should render the empty state when the summary has no items', async () => {
    mockedFetchHomeSummary.mockResolvedValue({ title: '工作台', items: [] });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('暂无数据')).toBeOnTheScreen();
  });

  it('should render the error state when the request fails', async () => {
    mockedFetchHomeSummary.mockRejectedValue(new Error('boom'));

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('加载失败，请稍后重试')).toBeOnTheScreen();
  });
});
