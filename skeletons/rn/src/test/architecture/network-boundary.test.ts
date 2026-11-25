import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const NETWORK_STORE = 'src/domain/network/network-store.ts';
const IMAGE_WRAPPER = 'src/components/ui/image.tsx';

/**
 * 递归收集 TypeScript / TSX 文件。
 *
 * @param relativePath - 相对仓库根的目录。
 * @returns 相对路径列表。
 */
function listSources(relativePath: string): string[] {
  return readdirSync(join(process.cwd(), relativePath), { withFileTypes: true }).flatMap((entry) => {
    const child = join(relativePath, entry.name);

    if (entry.isDirectory()) {
      return listSources(child);
    }

    return /\.tsx?$/u.test(entry.name) ? [child] : [];
  });
}

/**
 * 读取文件的 import 来源。
 *
 * @param file - 相对路径。
 * @returns 模块标识列表。
 */
function listImports(file: string): string[] {
  const source = readFileSync(join(process.cwd(), file), 'utf8');

  return [...source.matchAll(/(?:from|require\()\s*'([^']+)'/gu)].map((match) => match[1]);
}

describe('network and image boundaries', () => {
  it('should only import NetInfo in the network store', () => {
    const offenders = listSources('src')
      .filter((file) => file !== NETWORK_STORE)
      .filter((file) => listImports(file).some((specifier) => specifier.startsWith('@react-native-community/netinfo')));

    expect(offenders).toEqual([]);
  });

  it('should only import expo-image in the AppImage wrapper', () => {
    const offenders = listSources('src')
      .filter((file) => file !== IMAGE_WRAPPER)
      .filter((file) => listImports(file).some((specifier) => specifier === 'expo-image'));

    expect(offenders).toEqual([]);
  });

  it('should mount both bridges from the root providers', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/providers/app-providers.tsx'), 'utf8');

    expect(source).toContain('<NetworkBridge />');
    expect(source).toContain('<QueryOnlineBridge />');
  });
});
