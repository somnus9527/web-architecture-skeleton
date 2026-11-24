// @vitest-environment node
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app', import.meta.url));
const BFF_ROUTE_DIR = `${APP_DIR}/ssr-app-api`;

/**
 * 递归收集 App Router 下的 Route Handler 文件，确保 HTTP 入口归属可被静态守护。
 *
 * @param directory - 当前扫描目录。
 * @returns Route Handler 绝对路径列表。
 */
function collectRouteHandlers(directory: string): string[] {
  const routeHandlers: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      routeHandlers.push(...collectRouteHandlers(entryPath));
    } else if (entry.name === 'route.ts') {
      routeHandlers.push(entryPath);
    }
  }

  return routeHandlers;
}

describe('Next BFF route prefix boundary', () => {
  it('所有 Route Handler 都归属 ssr-app-api 前缀', () => {
    const routeHandlers = collectRouteHandlers(APP_DIR);
    const violations = routeHandlers.filter((file) => !file.startsWith(`${BFF_ROUTE_DIR}/`));

    expect(violations, `Route Handler 前缀违规:\n${violations.join('\n')}`).toEqual([]);
  });
});
