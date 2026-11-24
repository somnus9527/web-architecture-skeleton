import { describe, expect, it } from 'vitest';

import { adaptShowcaseList } from '@/bff/adapter/showcase-adapter';

/**
 * adapter 纯函数单测示范:输入 DTO、断言 view model 映射（日期格式化 + 空态标记）。
 */
describe('adaptShowcaseList', () => {
  it('把 DTO 映射为 view model 并格式化日期', () => {
    const viewModel = adaptShowcaseList({
      items: [
        {
          id: 'sc-001',
          title: 'T',
          summary: 'S',
          category: 'rendering',
          updatedAt: '2026-01-15T08:00:00.000Z',
        },
      ],
      total: 1,
    });

    expect(viewModel.total).toBe(1);
    expect(viewModel.isEmpty).toBe(false);
    expect(viewModel.items[0]?.updatedLabel).toBe('2026-01-15');
  });

  it('空列表标记 isEmpty', () => {
    const viewModel = adaptShowcaseList({ items: [], total: 0 });
    expect(viewModel.isEmpty).toBe(true);
  });
});
