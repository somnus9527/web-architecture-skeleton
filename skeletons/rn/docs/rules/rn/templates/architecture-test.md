# 架构测试模版

> 上级规则：`docs/rules/rn/testing.md`、`docs/rules/rn/architecture.md`。
>
> 建议落地位置：`src/test/architecture/*`。

## 适用场景

新增项目级架构边界守护测试（分层、命名、虚拟化、a11y、Paper boundary 等）。

## 通用扫描工具

```ts
// src/test/architecture/_shared.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_FILE_EXTENSIONS = ['.ts', '.tsx'];
export const PROJECT_ROOT = process.cwd();

export interface IScannedSourceFile {
  absolutePath: string;
  relativePath: string;
  content: string;
}

export function collectSourceFiles(directory: string): IScannedSourceFile[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = join(directory, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) return collectSourceFiles(absolutePath);
    if (!SOURCE_FILE_EXTENSIONS.some((ext) => entry.endsWith(ext))) return [];
    return [
      {
        absolutePath,
        relativePath: relative(PROJECT_ROOT, absolutePath),
        content: readFileSync(absolutePath, 'utf8'),
      },
    ];
  });
}

export function findFilesMatchingPattern(files: IScannedSourceFile[], pattern: RegExp): string[] {
  return files
    .filter((file) => pattern.test(file.content))
    .map((file) => file.relativePath)
    .sort();
}

export function collectImportSources(
  files: IScannedSourceFile[],
): Array<{ file: string; source: string; statement: string }> {
  const importPattern = /import\s+(?:type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["'];?/g;
  return files.flatMap((file) =>
    Array.from(file.content.matchAll(importPattern)).map((match) => ({
      file: file.relativePath,
      source: match[1],
      statement: match[0],
    })),
  );
}
```

## 模版 1：分层 Import 边界

```ts
// src/test/architecture/layer-boundary.test.ts
import { join } from 'node:path';
import { collectImportSources, collectSourceFiles, findFilesMatchingPattern, PROJECT_ROOT } from './_shared';

const APP_ROOT = join(PROJECT_ROOT, 'app');
const COMPONENT_ROOT = join(PROJECT_ROOT, 'src/components');
const API_ROOT = join(PROJECT_ROOT, 'src/api');
const DOMAIN_ROOT = join(PROJECT_ROOT, 'src/domain');

describe('architecture layer boundary', () => {
  const appFiles = collectSourceFiles(APP_ROOT);
  const componentFiles = collectSourceFiles(COMPONENT_ROOT);
  const apiFiles = collectSourceFiles(API_ROOT);
  const domainFiles = collectSourceFiles(DOMAIN_ROOT);

  it('keeps app routes free of direct API URLs and fetch calls', () => {
    const forbiddenImports = collectImportSources(appFiles)
      .filter((i) => i.source.startsWith('@api/') || i.source.startsWith('@/api/'))
      .map((i) => i.file)
      .sort();
    const directFetchFiles = findFilesMatchingPattern(appFiles, /\bfetch\s*\(/);
    const apiUrlFiles = findFilesMatchingPattern(appFiles, /EXPO_PUBLIC_API_BASE_URL|API_BASE|https?:\/\//);

    expect(forbiddenImports).toEqual([]);
    expect(directFetchFiles).toEqual([]);
    expect(apiUrlFiles).toEqual([]);
  });

  it('keeps components from calling fetch directly', () => {
    expect(findFilesMatchingPattern(componentFiles, /\bfetch\s*\(/)).toEqual([]);
  });

  it('keeps api wrappers free of UI / storage / store dependencies', () => {
    const forbidden = collectImportSources(apiFiles)
      .filter(
        (i) =>
          i.source === 'react-native' ||
          i.source === 'react-native-paper' ||
          i.source.startsWith('@components/') ||
          i.source.startsWith('@storage/'),
      )
      .map((i) => i.file)
      .sort();
    expect(forbidden).toEqual([]);
  });

  it('keeps domain files free of RN view dependencies', () => {
    const rnViewPattern =
      /\b(Text|View|ScrollView|Pressable|Image|FlatList|SectionList|Modal|StyleSheet|TouchableOpacity|SafeAreaView|TextInput|ActivityIndicator)\b/;
    const forbidden = collectImportSources(domainFiles)
      .filter((i) => {
        if (
          i.source === 'react-native-paper' ||
          i.source === 'lucide-react-native' ||
          i.source.startsWith('@components/')
        ) {
          return true;
        }
        return i.source === 'react-native' && rnViewPattern.test(i.statement);
      })
      .map((i) => i.file)
      .sort();
    expect(forbidden).toEqual([]);
  });
});
```

## 模版 2：Paper Boundary

```ts
// src/test/architecture/paper-boundary.test.ts
import { join } from 'node:path';
import { collectImportSources, collectSourceFiles, PROJECT_ROOT } from './_shared';

const COMPONENT_ROOT = join(PROJECT_ROOT, 'src/components');

const PAPER_ALLOWED_FILES = new Set([
  'src/components/ui/paper-controls.tsx',
  'src/components/providers/paper-theme-provider.tsx',
]);

describe('paper boundary', () => {
  it('restricts react-native-paper imports to allowed files', () => {
    const files = collectSourceFiles(COMPONENT_ROOT);
    const violations = collectImportSources(files)
      .filter((i) => i.source === 'react-native-paper')
      .filter((i) => !PAPER_ALLOWED_FILES.has(i.file))
      .map((i) => i.file)
      .sort();
    expect(violations).toEqual([]);
  });
});
```

## 模版 3：文件大小

```ts
// src/test/architecture/file-split-boundary.test.ts
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { collectSourceFiles, PROJECT_ROOT } from './_shared';

const COMPONENT_ROOT = join(PROJECT_ROOT, 'src/components');
const COMPONENT_REVIEW_TRIGGER_LINES = 500;
const FILE_SPLIT_TODO_PATH = 'docs/<file-split-todo>.md';

function countLines(absolutePath: string): number {
  return readFileSync(absolutePath, 'utf8').trimEnd().split('\n').length;
}

describe('component file split boundary', () => {
  it('tracks component files over the review trigger in convergence todo', () => {
    const todoContent = readFileSync(join(PROJECT_ROOT, CONVERGENCE_TODO_PATH), 'utf8');
    const untracked = collectSourceFiles(COMPONENT_ROOT)
      .filter((file) => file.absolutePath.endsWith('.tsx'))
      .map((file) => ({
        lines: countLines(file.absolutePath),
        relativePath: file.relativePath,
      }))
      .filter(({ lines }) => lines > COMPONENT_REVIEW_TRIGGER_LINES)
      .filter(({ relativePath }) => !todoContent.includes(relativePath));

    expect(untracked).toEqual([]);
  });
});
```

## 模版 4：禁止 `as Href`

```ts
// src/test/architecture/navigation-href-typing.test.ts
import { join } from 'node:path';
import { collectSourceFiles, findFilesMatchingPattern, PROJECT_ROOT } from './_shared';

const APP_ROOT = join(PROJECT_ROOT, 'app');
const SRC_ROOT = join(PROJECT_ROOT, 'src');

const ALLOWED_FILES = new Set(['src/components/navigation/safe-navigate.ts']);

describe('navigation href typing', () => {
  it('disallows `as Href` string assertion', () => {
    const files = [...collectSourceFiles(APP_ROOT), ...collectSourceFiles(SRC_ROOT)].filter(
      (file) => !ALLOWED_FILES.has(file.relativePath),
    );

    const violations = findFilesMatchingPattern(files, /\bas\s+Href\b/);
    expect(violations).toEqual([]);
  });
});
```

## 模版 5：禁止业务代码 console

```ts
// src/test/architecture/console-call-boundary.test.ts
import { join } from 'node:path';
import { collectSourceFiles, findFilesMatchingPattern, PROJECT_ROOT } from './_shared';

const SRC_ROOT = join(PROJECT_ROOT, 'src');
const ALLOWED_FILES = new Set(['src/api/logger.ts']);

describe('console call boundary', () => {
  it('forbids direct console calls outside logger and test files', () => {
    const files = collectSourceFiles(SRC_ROOT)
      .filter((file) => !file.relativePath.startsWith('src/test/'))
      .filter((file) => !ALLOWED_FILES.has(file.relativePath));

    const violations = findFilesMatchingPattern(files, /\bconsole\.(log|warn|error|info|debug)\s*\(/);
    expect(violations).toEqual([]);
  });
});
```

## 模版 6：长列表必须 FlatList

```ts
// src/test/architecture/long-list-source-map.test.ts
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { PROJECT_ROOT } from './_shared';

const LONG_LIST_SOURCE_FILES = [
  'src/components/<feature>/feature-list-screen.tsx',
  'src/components/<feature>/feature-search-screen.tsx',
  'src/components/<feature>/feature-history-screen.tsx',
  'src/components/search/global-search-modal.tsx',
  // ... 业务长列表清单
];

describe('long list source map', () => {
  it.each(LONG_LIST_SOURCE_FILES)('uses FlatList in %s', (relativePath) => {
    const content = readFileSync(join(PROJECT_ROOT, relativePath), 'utf8');
    expect(content).toMatch(/FlatList|SectionList/);
  });
});
```

## 模版 7：Root layout discipline

```ts
// src/test/architecture/root-layout-discipline.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_ROOT } from './_shared';

const ROOT_LAYOUT_PATH = 'app/_layout.tsx';

describe('root layout discipline', () => {
  const content = readFileSync(join(PROJECT_ROOT, ROOT_LAYOUT_PATH), 'utf8');

  it('does not import API layer', () => {
    expect(content).not.toMatch(/from\s+["']@api\//);
    expect(content).not.toMatch(/from\s+["']@\/api\//);
  });

  it('does not import storage layer', () => {
    expect(content).not.toMatch(/from\s+["']@storage\//);
    expect(content).not.toMatch(/from\s+["']@\/storage\//);
  });

  it('does not call fetch', () => {
    expect(content).not.toMatch(/\bfetch\s*\(/);
  });

  it('does not call useQuery', () => {
    expect(content).not.toMatch(/\buseQuery\s*\(/);
  });
});
```

## 注意点

- **错误信息可定位**：断言失败时输出违规文件路径列表，不输出全文件内容。
- **白名单清晰**：豁免文件用常量 Set 集中维护。
- **不修改测试以绕过失败**：测试是规则的可执行表达；改测试需要先改规则。
- **多个规则一个测试**：相关边界放在一个 describe 内，便于一次扫描。
- **静态扫描代替运行**：用 `readFileSync` 字符串扫描，速度快、不依赖 RN runtime。
- **正则避免误命中**：使用单词边界 `\b`、特定上下文，不要过于宽松。
