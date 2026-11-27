import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts', 'check-reuse.mjs');
const REGISTRY = JSON.stringify([
  {
    id: 'use-request',
    kind: 'hook',
    export: 'useRequest',
    import: '@/shared/hooks',
    path: 'src/shared/hooks/use-request.ts',
    purpose: '异步读取三态',
    owner: 'frontend-platform',
    since: '2026-11-27',
  },
]);

const roots: string[] = [];

/**
 * 建一个临时项目根，写入给定文件。
 *
 * @param {Record<string, string>} files - 相对路径到内容。
 * @returns {string} 临时根目录。
 */
function createProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'reuse-check-'));
  roots.push(root);
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'capabilities.json'), REGISTRY);

  for (const [file, content] of Object.entries(files)) {
    const absolute = join(root, file);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }

  return root;
}

/**
 * 运行检查脚本。
 *
 * @param {string} root - 临时项目根。
 * @param {string[]} files - 相对路径。
 * @returns {{ status: number; stdout: string; stderr: string }} 结果。
 */
function run(root: string, files: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, '--root', root, '--files', ...files], {
      encoding: 'utf8',
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

/**
 * 生成 N 天后的日期。
 *
 * @param {number} days - 天数。
 * @returns {string} YYYY-MM-DD。
 */
function daysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * 写文件到临时项目。
 *
 * @param {string} root - 临时项目根。
 * @param {string} file - 相对路径。
 * @param {string} content - 内容。
 * @returns {void}
 */
function writeProjectFile(root: string, file: string, content: string): void {
  const absolute = join(root, file);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

/**
 * 生成一个足够长的函数体，用于相似度检测。
 *
 * @param {string} name - 函数名。
 * @returns {string} 源码。
 */
function longFunction(name: string): string {
  const lines = [`export function ${name}(input: number) {`];
  for (let index = 0; index < 30; index += 1) {
    lines.push(`  const value${index} = compute(input, { flag: true, mode: ${index}, label: 'x' });`);
  }
  lines.push('  return value0;', '}');
  return lines.join('\n');
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('check-reuse', () => {
  it('should reject hand-rolled request state (R1)', () => {
    const root = createProject({
      'src/features/demo/hooks/use-demo.ts': [
        "import { useEffect, useState } from 'react';",
        'export function useDemo() {',
        '  const [loading, setLoading] = useState(false);',
        '  useEffect(() => {',
        '    setLoading(true);',
        '    void fetchDemo();',
        '  }, []);',
        '  return loading;',
        '}',
        'async function fetchDemo() {',
        '  await Promise.resolve();',
        '}',
      ].join('\n'),
    });

    const result = run(root, ['src/features/demo/hooks/use-demo.ts']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('R1');
    expect(result.stderr).toContain('useRequest');
  });

  it('should reject hand-rolled debounce (R2)', () => {
    const root = createProject({
      'src/features/demo/debounce.ts': [
        'export function useSearch() {',
        '  let timer: ReturnType<typeof setTimeout>;',
        '  const run = (value: string) => {',
        '    clearTimeout(timer);',
        '    timer = setTimeout(() => setQuery(value), 300);',
        '  };',
        '  return run;',
        '}',
      ].join('\n'),
    });

    const result = run(root, ['src/features/demo/debounce.ts']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('R2');
    expect(result.stderr).toContain('useDebouncedValue');
  });

  it('should reject direct browser storage (R3)', () => {
    const root = createProject({
      'src/features/demo/storage.ts': "export const token = localStorage.getItem('token');\n",
    });

    const result = run(root, ['src/features/demo/storage.ts']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('R3');
  });

  it('should reject generic component names inside features (R4)', () => {
    const root = createProject({
      'src/features/demo/components/button.tsx': 'export const LocalButton = () => null;\n',
    });

    const result = run(root, ['src/features/demo/components/button.tsx']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('R4');
  });

  it('should reject deep imports into shared (R5)', () => {
    const root = createProject({
      'src/features/demo/panel.tsx':
        "import { Button } from '@/shared/ui/button';\nexport const Panel = () => <Button />;\n",
    });

    const result = run(root, ['src/features/demo/panel.tsx']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('R5');
  });

  it('should reject raw requests inside features (R6)', () => {
    const root = createProject({
      'src/features/demo/service.ts': 'export const load = () => fetch("/api/demo");\n',
    });

    const result = run(root, ['src/features/demo/service.ts']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('R6');
  });

  it('should pass when the shared capability is reused', () => {
    const root = createProject({
      'src/features/demo/hooks/use-demo.ts': [
        "import { useRequest } from '@/shared/hooks';",
        'export function useDemo() {',
        '  return useRequest(() => Promise.resolve(1), []);',
        '}',
      ].join('\n'),
    });

    const result = run(root, ['src/features/demo/hooks/use-demo.ts']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('通过');
  });

  it('should reject copied function bodies (L2)', () => {
    const root = createProject({
      'src/features/alpha/helper.ts': longFunction('buildAlpha'),
      'src/features/beta/helper.ts': longFunction('buildBeta'),
    });

    const result = run(root, ['src/features/alpha/helper.ts', 'src/features/beta/helper.ts']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('L2');
    expect(result.stderr).toContain('相似度');
  });

  it('should suppress baselined violations until the code changes', () => {
    const file = 'src/features/demo/hooks/use-demo.ts';
    const source = [
      "import { useEffect, useState } from 'react';",
      'export function useDemo() {',
      '  const [loading, setLoading] = useState(false);',
      '  useEffect(() => {',
      '    setLoading(true);',
      '    void fetchDemo();',
      '  }, []);',
      '  return loading;',
      '}',
      'async function fetchDemo() {',
      '  await Promise.resolve();',
      '}',
    ].join('\n');
    const root = createProject({ [file]: source });

    execFileSync(process.execPath, [SCRIPT, '--root', root, '--files', file, '--baseline'], {
      encoding: 'utf8',
    });
    expect(run(root, [file]).status).toBe(0);

    writeProjectFile(
      root,
      file,
      source.replace('fetchDemo()', 'loadDemo()').replace('function fetchDemo', 'function loadDemo'),
    );
    expect(run(root, [file]).status).toBe(1);
  });

  it('should fail when the baseline has expired', () => {
    const root = createProject({
      'src/features/demo/panel.tsx': 'export const Panel = () => null;\n',
    });
    writeProjectFile(
      root,
      '.agents/reuse-baseline.json',
      JSON.stringify({ generatedAt: '2026-01-01', expiresAt: '2026-01-02', items: [] }),
    );

    const result = run(root, ['src/features/demo/panel.tsx']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('baseline 已过期');
  });

  it('should honour a valid exception', () => {
    const root = createProject({
      'src/features/demo/storage.ts': "export const token = localStorage.getItem('token');\n",
      '.agents/architecture-exceptions.json': JSON.stringify([
        { path: 'src/features/demo/storage.ts', reason: '待迁移到 store', expiresAt: daysFromNow(30) },
      ]),
    });

    expect(run(root, ['src/features/demo/storage.ts']).status).toBe(0);
  });

  it('should reject expired and over-long exceptions', () => {
    const root = createProject({
      'src/features/demo/storage.ts': "export const token = localStorage.getItem('token');\n",
      '.agents/architecture-exceptions.json': JSON.stringify([
        { path: 'src/features/demo/storage.ts', reason: '过期', expiresAt: daysFromNow(-1) },
        { path: 'src/features/demo/other.ts', reason: '超长', expiresAt: daysFromNow(120) },
      ]),
    });

    const result = run(root, ['src/features/demo/storage.ts']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('已过期');
    expect(result.stderr).toContain('超过 90 天');
  });

  it('should print the registry (--list)', () => {
    const root = createProject({});
    const stdout = execFileSync(process.execPath, [SCRIPT, '--root', root, '--list'], { encoding: 'utf8' });

    expect(stdout).toContain('use-request');
    expect(stdout).toContain('@/shared/hooks');
  });
});
