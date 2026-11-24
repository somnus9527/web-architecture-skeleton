// @vitest-environment node
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * BFF 结构边界:`src/bff` 下只允许 8 个 canonical 层目录，
 * 禁止用业务子目录（如 `bff/user/`）+ 文件名后缀模拟分层。
 */
const BFF_CANONICAL_LAYERS = new Set([
  'actions',
  'adapter',
  'dto',
  'gateway',
  'routes',
  'services',
  'shared',
  'transform',
]);

const bffDir = fileURLToPath(new URL('../../bff', import.meta.url));

describe('bff canonical layers', () => {
  it('只包含 8 个 canonical 层目录', () => {
    const entries = readdirSync(bffDir, { withFileTypes: true });
    const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    for (const dir of dirs) {
      expect(BFF_CANONICAL_LAYERS.has(dir), `非法 BFF 层目录: ${dir}`).toBe(true);
    }
  });

  it('不存在顶层游离文件之外的额外分层', () => {
    const entries = readdirSync(bffDir, { withFileTypes: true });
    const dirCount = entries.filter((entry) => entry.isDirectory()).length;
    expect(dirCount).toBeLessThanOrEqual(BFF_CANONICAL_LAYERS.size);
  });
});
