import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { designTokens } from '@/shared/theme/design-tokens';

/**
 * 从 tokens.css 中提取指定主题块的 CSS 变量值。
 *
 * @param css - 样式文本。
 * @param selector - `:root` 或 `[data-theme='dark']`。
 * @returns 变量名到值的映射。
 */
function readVariables(css: string, selector: string): Record<string, string> {
  const block = css.split(selector)[1]?.split('}')[0] ?? '';
  return Object.fromEntries(
    Array.from(block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gu), (match) => [`--${match[1]}`, match[2].trim()]),
  );
}

describe('design tokens', () => {
  const css = readFileSync(join(process.cwd(), 'src', 'shared', 'theme', 'tokens.css'), 'utf8');
  const light = readVariables(css, ':root');
  const dark = readVariables(css, "[data-theme='dark']");

  it('keeps light color variables in sync with the TS source', () => {
    expect(light['--color-primary']).toBe(designTokens.light.primary);
    expect(light['--color-primary-hover']).toBe(designTokens.light.primaryHover);
    expect(light['--color-bg']).toBe(designTokens.light.background);
    expect(light['--color-surface']).toBe(designTokens.light.surface);
    expect(light['--color-text']).toBe(designTokens.light.text);
    expect(light['--color-text-muted']).toBe(designTokens.light.textMuted);
    expect(light['--color-border']).toBe(designTokens.light.border);
    expect(light['--color-danger']).toBe(designTokens.light.danger);
    expect(light['--color-success']).toBe(designTokens.light.success);
    expect(light['--color-warning']).toBe(designTokens.light.warning);
  });

  it('keeps dark color variables in sync with the TS source', () => {
    expect(dark['--color-primary']).toBe(designTokens.dark.primary);
    expect(dark['--color-bg']).toBe(designTokens.dark.background);
    expect(dark['--color-surface']).toBe(designTokens.dark.surface);
    expect(dark['--color-text']).toBe(designTokens.dark.text);
    expect(dark['--color-border']).toBe(designTokens.dark.border);
  });
});
