// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * mock 契约边界:`mock/openapi.yaml` 必须存在且含骨架端点与统一信封关键片段。
 * 端点/DTO/adapter/mock example 的可追溯性由此静态锚定（ssr-contracts-and-mock）。
 */
const openapiPath = fileURLToPath(new URL('../../../mock/openapi.yaml', import.meta.url));

describe('mock contract', () => {
  const content = readFileSync(openapiPath, 'utf8');

  it('含健康检查与 showcase 端点', () => {
    expect(content).toContain('/health:');
    expect(content).toContain('/showcase:');
    expect(content).toContain('operationId: getShowcaseList');
  });

  it('含统一响应/错误信封 schema', () => {
    expect(content).toContain('ShowcaseListResponse');
    expect(content).toContain("code: '200'");
    expect(content).toContain('codeMsg:');
  });
});
