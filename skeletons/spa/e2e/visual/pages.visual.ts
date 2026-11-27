import { expect, test, type Page } from '@playwright/test';

const THEMES = ['light', 'dark'] as const;

/** 关闭动画与光标闪烁，避免同一页面两次截图出现像素差。 */
const FREEZE_STYLE = '*{transition:none!important;animation:none!important;caret-color:transparent!important}';

const DASHBOARD_FIXTURE = {
  data: {
    metrics: [
      { label: '今日成交额', value: '$18,420', delta: '+12.4%', tone: 'success' },
      { label: '待处理订单', value: '18', delta: '-3', tone: 'warning' },
      { label: '履约超时', value: '2', delta: '+1', tone: 'danger' },
    ],
    workflow: [
      { name: '待确认', count: 18, action: '确认收款' },
      { name: '履约中', count: 7, action: '安排发货' },
      { name: '已完成', count: 132, action: '查看明细' },
    ],
    orders: [
      {
        id: 'TASK-10240',
        customerName: 'Northwind Store',
        productName: 'Standard delivery request',
        status: 'pending',
        owner: 'Ava',
        nextStep: '确认收款记录',
        updatedAt: '10:42',
      },
      {
        id: 'TASK-10241',
        customerName: 'Contoso Ltd.',
        productName: 'Bulk inventory sync',
        status: 'fulfilling',
        owner: 'Ken',
        nextStep: '安排出库',
        updatedAt: '10:38',
      },
    ],
  },
  code: '200',
  codeMsg: null,
};

const SESSION_FIXTURE = {
  data: { isAuthenticated: true, user: { id: 'u-1', displayName: '演示用户' } },
  code: '200',
  codeMsg: null,
};

/**
 * 冻结页面动画、等待字体加载完成。
 *
 * @param page - Playwright 页面。
 */
async function prepareScreenshot(page: Page): Promise<void> {
  await page.addStyleTag({ content: FREEZE_STYLE });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

for (const theme of THEMES) {
  test.describe(`主题 ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((mode) => window.localStorage.setItem('app-theme-mode', mode), theme);
    });

    test('登录页', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await prepareScreenshot(page);
      await expect(page).toHaveScreenshot(`login-${theme}.png`, { fullPage: true });
    });

    test('工作台', async ({ page }) => {
      await page.route('**/mock-api/auth/session*', (route) => route.fulfill({ json: SESSION_FIXTURE }));
      await page.route('**/mock-api/workspace/dashboard*', (route) => route.fulfill({ json: DASHBOARD_FIXTURE }));

      await page.goto('/workspace');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // 等到真实工作台内容出现，避免会话守卫把页面重定向到登录页后截出一张“假的”基线。
      await expect(page.getByText('今日成交额')).toBeVisible();
      await prepareScreenshot(page);
      await expect(page).toHaveScreenshot(`dashboard-${theme}.png`, { fullPage: true });
    });
  });
}
