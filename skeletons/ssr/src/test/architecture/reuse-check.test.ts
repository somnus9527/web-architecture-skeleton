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

  it('should print the registry (--list)', () => {
    const root = createProject({});
    const stdout = execFileSync(process.execPath, [SCRIPT, '--root', root, '--list'], { encoding: 'utf8' });

    expect(stdout).toContain('use-request');
    expect(stdout).toContain('@/shared/hooks');
  });
});
