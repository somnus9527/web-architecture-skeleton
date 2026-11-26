import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 组件文件超过该行数必须立即拆分，不允许继续叠加业务（`docs/rules/rn/frontend.md`）。
 */
const SPLIT_HARD_LIMIT = 500;

/**
 * 达到该行数即进入「必须登记」区间：未登记 owner 与拆分计划时架构测试失败。
 */
const DEBT_REGISTRATION_LIMIT = 451;

/** 参与行数门禁的组件目录。 */
const COMPONENT_ROOTS = ['app', 'src/components'];

/** 债务登记清单，格式见 `src/test/architecture/architecture-debts.json`。 */
const DEBT_FILE = 'src/test/architecture/architecture-debts.json';

interface IDebtEntry {
  /** 相对仓库根的文件路径。 */
  path: string;
  /** 负责人。 */
  owner: string;
  /** 拆分计划与目标日期。 */
  plan: string;
}

interface IDebtFile {
  /** 登记说明，避免后来者误解字段含义。 */
  note?: string;
  /** 债务条目。 */
  debts: IDebtEntry[];
}

/**
 * 递归列出指定目录下的组件文件；目录不存在时返回空数组。
 *
 * @param relativePath - 相对仓库根的目录。
 * @returns 相对仓库根的 `.tsx` 文件路径列表。
 */
function listComponentFiles(relativePath: string): string[] {
  const absolute = join(process.cwd(), relativePath);

  if (!existsSync(absolute)) {
    return [];
  }

  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = join(relativePath, entry.name);

    if (entry.isDirectory()) {
      return listComponentFiles(child);
    }

    return entry.name.endsWith('.tsx') ? [child] : [];
  });
}

/**
 * 读取债务登记清单；文件不存在时视为没有债务。
 *
 * @returns 以文件路径为键的债务表。
 */
function readDebts(): Map<string, IDebtEntry> {
  const absolute = join(process.cwd(), DEBT_FILE);

  if (!existsSync(absolute)) {
    return new Map();
  }

  const content = JSON.parse(readFileSync(absolute, 'utf8')) as IDebtFile;

  return new Map((content.debts ?? []).map((entry) => [entry.path, entry]));
}

/**
 * 统计文件行数。
 *
 * @param file - 相对仓库根的文件路径。
 * @returns 行数。
 */
function countLines(file: string): number {
  return readFileSync(join(process.cwd(), file), 'utf8').split('\n').length;
}

const componentFiles = COMPONENT_ROOTS.flatMap((directory) => listComponentFiles(directory));

describe('rn file split boundary', () => {
  it('should keep every component under the hard limit', () => {
    const violations = componentFiles.flatMap((file) => {
      const lines = countLines(file);

      return lines > SPLIT_HARD_LIMIT ? [`${file}: ${lines} 行超过组件硬限 ${SPLIT_HARD_LIMIT}`] : [];
    });

    expect(violations).toEqual([]);
  });

  it('should require a registered debt entry for components in the registration range', () => {
    const debts = readDebts();
    const violations = componentFiles.flatMap((file) => {
      const lines = countLines(file);

      if (lines < DEBT_REGISTRATION_LIMIT || lines > SPLIT_HARD_LIMIT) {
        return [];
      }

      return debts.has(file)
        ? []
        : [`${file}: ${lines} 行已进入 ${DEBT_REGISTRATION_LIMIT}+ 区间，需登记到 ${DEBT_FILE}`];
    });

    expect(violations).toEqual([]);
  });

  it('should keep every debt entry real and actionable', () => {
    const violations = [...readDebts().values()].flatMap((entry) => {
      if (!existsSync(join(process.cwd(), entry.path))) {
        return [`${entry.path}: 债务条目指向的文件不存在，请删除死条目`];
      }

      if (countLines(entry.path) < DEBT_REGISTRATION_LIMIT) {
        return [`${entry.path}: 行数已低于 ${DEBT_REGISTRATION_LIMIT}，请删除已收敛的条目`];
      }

      return entry.owner.trim().length > 0 && entry.plan.trim().length > 0
        ? []
        : [`${entry.path}: owner 与 plan 不得为空`];
    });

    expect(violations).toEqual([]);
  });
});
