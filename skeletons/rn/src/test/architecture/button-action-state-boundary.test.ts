import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 按钮 primitive；它自己定义 `loading` / `disabled`，不参与「使用方必须暴露状态」的扫描。
 */
const BUTTON_SOURCE = 'src/components/ui/button.tsx';

/** 参与扫描的业务目录。 */
const SCAN_ROOTS = ['app', 'src/components'];

/** 会触发异步工作、必须被 loading / disabled 兜住的 onPress 写法。 */
const ASYNC_MARKERS = ['mutate(', 'mutateAsync(', 'refetch(', 'handleSubmit', 'await '];

/** 允许用来兜住异步动作的状态属性。 */
const STATE_PROPS = ['loading=', 'disabled='];

/**
 * 递归列出指定目录下的源码文件；目录不存在时返回空数组。
 *
 * @param relativePath - 相对仓库根的目录。
 * @returns 相对仓库根的 `.tsx` 文件路径列表。
 */
function listSources(relativePath: string): string[] {
  const absolute = join(process.cwd(), relativePath);

  if (!existsSync(absolute)) {
    return [];
  }

  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = join(relativePath, entry.name);

    if (entry.isDirectory()) {
      return listSources(child);
    }

    return entry.name.endsWith('.tsx') ? [child] : [];
  });
}

/**
 * 提取源码里每个 `<Button>` / `<IconButton>` 的属性文本。
 *
 * 逐个字符扫描并跟踪括号深度，避免 `onPress={() => ...}` 里的 `=>` 被误判成标签结束。
 *
 * @param source - 文件内容。
 * @returns 属性文本列表。
 */
function listButtonProps(source: string): string[] {
  const elements: string[] = [];
  const openingTag = /<(?:Button|IconButton)\b/gu;

  for (const match of source.matchAll(openingTag)) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 0;
    let cursor = start;

    for (; cursor < source.length; cursor += 1) {
      const char = source[cursor];

      if ('{(['.includes(char)) {
        depth += 1;
      } else if ('})]'.includes(char)) {
        depth -= 1;
      } else if (char === '>' && depth <= 0) {
        break;
      }
    }

    elements.push(source.slice(start, cursor));
  }

  return elements;
}

/**
 * 判断属性文本是否包含任一标记。
 *
 * @param props - 属性文本。
 * @param markers - 待匹配的标记。
 * @returns 是否命中。
 */
function containsAny(props: string, markers: string[]): boolean {
  return markers.some((marker) => props.includes(marker));
}

describe('rn button action state boundary', () => {
  it('should let the Button primitive derive disabled from loading', () => {
    const source = readFileSync(join(process.cwd(), BUTTON_SOURCE), 'utf8');

    expect(source).toContain('loading?:');
    expect(source).toMatch(/disabled\s*\|\|\s*loading/u);
    expect(source).toContain('disabled={isDisabled}');
    expect(source).toContain('busy: loading');
    expect(source).toContain('loadingLabel ?? label');
  });

  it('should require loading or disabled on buttons that trigger async work', () => {
    const files = SCAN_ROOTS.flatMap((directory) => listSources(directory))
      .filter((file) => file !== BUTTON_SOURCE)
      .filter((file) => !file.startsWith('src/test/'));

    const violations = files.flatMap((file) => {
      const source = readFileSync(join(process.cwd(), file), 'utf8');

      return listButtonProps(source).flatMap((props) =>
        containsAny(props, ASYNC_MARKERS) && !containsAny(props, STATE_PROPS)
          ? [`${file}: 异步按钮缺少 loading 或 disabled，重复点击会重复提交`]
          : [],
      );
    });

    expect(violations).toEqual([]);
  });

  it('should keep the guard scanning at least one real button usage', () => {
    const usageCount = SCAN_ROOTS.flatMap((directory) => listSources(directory))
      .filter((file) => file !== BUTTON_SOURCE && !file.startsWith('src/test/'))
      .reduce((total, file) => total + listButtonProps(readFileSync(join(process.cwd(), file), 'utf8')).length, 0);

    expect(usageCount).toBeGreaterThan(0);
  });
});
