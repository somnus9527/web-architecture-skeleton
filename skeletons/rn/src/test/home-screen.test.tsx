import { render, screen } from '@testing-library/react-native';

import { fetchHomeSummary } from '@api/endpoints/home';
import { HomeScreen } from '@components/home/home-screen';
import { TestProviders } from '@test/utils/test-providers';

import '@domain/i18n';

jest.mock('@api/endpoints/home');

const mockedFetchHomeSummary = fetchHomeSummary as jest.MockedFunction<typeof fetchHomeSummary>;

/**
 * 用统一 TestProviders 渲染首页。
 *
 * @param element - 待渲染节点。
 * @returns 渲染结果。
 */
async function renderHomeScreen() {
  return await render(
    <TestProviders>
      <HomeScreen />
    </TestProviders>,
  );
}

describe('home screen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the summary items returned by the endpoint', async () => {
    mockedFetchHomeSummary.mockResolvedValue({
      items: [{ id: '1', status: 'pending', title: '待处理订单' }],
      title: '工作台',
    });

    await renderHomeScreen();

    expect(await screen.findByText('待处理订单')).toBeOnTheScreen();
    expect(screen.getByText('工作台')).toBeOnTheScreen();
  });

  it('should render the empty state when the summary has no items', async () => {
    mockedFetchHomeSummary.mockResolvedValue({ items: [], title: '工作台' });

    await renderHomeScreen();

    expect(await screen.findByText('暂无数据')).toBeOnTheScreen();
  });

  it('should render the error state and a retry action when the request fails', async () => {
    mockedFetchHomeSummary.mockRejectedValue(new Error('boom'));

    await renderHomeScreen();

    expect(await screen.findByText('加载失败，请稍后重试')).toBeOnTheScreen();
    expect(screen.getByTestId('home-summary-retry')).toBeOnTheScreen();
  });
});
