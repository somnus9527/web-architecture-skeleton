import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * 严重级别的 axe 违规，必须为零。
 */
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

/**
 * 用 axe 扫描当前页面，只拦 serious / critical。
 *
 * moderate 与 minor 会写进报告但不阻塞：颜色提示、landmark 细节这类问题在样式迭代期噪声较大，
 * 先保证「读不出来 / 点不到」的严重问题不进入主干。
 *
 * @param page - Playwright 页面。
 * @param label - 失败时的定位信息。
 */
export async function expectNoSeriousViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

  const blocking = results.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''));
  const advisory = results.violations.filter((violation) => !BLOCKING_IMPACTS.has(violation.impact ?? ''));

  for (const violation of advisory) {
    test.info().annotations.push({
      type: 'a11y-advisory',
      description: `${label}: ${violation.id} (${violation.impact}) — ${violation.nodes.length} 处`,
    });
  }

  const details = blocking.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.nodes[0]?.target.join(' ') ?? ''}`,
  );

  expect(details, `${label} 存在 serious/critical 级无障碍违规`).toEqual([]);
}
