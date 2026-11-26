import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listSourceFiles } from '@/test/architecture/support/scan';

const ROOT = process.cwd();
const isSsr = existsSync(join(ROOT, 'next.config.ts'));

describe('logging boundary', () => {
  it('keeps business code off raw console', () => {
    const loggerFiles = new Set([
      'shared/services/logger.ts',
      'shared/logger/client-logger.ts',
      'bff/shared/logger/server-logger.ts',
    ]);
    const violations = listSourceFiles(join(ROOT, 'src'))
      .filter((file) => !loggerFiles.has(file.srcPath))
      .filter((file) => /\bconsole\.(?:log|debug|info|warn|error)\s*\(/u.test(file.content))
      .map((file) => file.srcPath);

    expect(violations).toEqual([]);
  });

  it('enables production console removal', () => {
    if (isSsr) {
      const nextConfig = readFileSync(join(ROOT, 'next.config.ts'), 'utf8');
      expect(nextConfig).toContain('removeConsole');
      return;
    }

    const viteConfig = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(viteConfig).toContain('drop_console: true');
  });

  it('merges PM2 stdout/stderr into one JSONL file', () => {
    if (!isSsr) return;

    const config = readFileSync(join(ROOT, 'ecosystem.config.cjs'), 'utf8');
    expect(config).toContain('merge_logs: true');
    expect(config).toContain("log_type: 'json'");
    const outFile = config.match(/out_file:\s*`([^`]+)`/u)?.[1];
    const errorFile = config.match(/error_file:\s*`([^`]+)`/u)?.[1];
    expect(outFile).toBe(errorFile);
  });
});
