import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * 读取 --root 指定的项目目录。
 *
 * @returns {string|null} 绝对路径；未指定时返回 null。
 */
function readRootArgument() {
  const index = process.argv.indexOf('--root');
  return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : null;
}

const ROOT_DIRECTORY = resolve(readRootArgument() ?? process.cwd());
const PLACEHOLDER_PROJECT_ID = 'spa-app';
const PLACEHOLDER_APP_NAME = `${PLACEHOLDER_PROJECT_ID}-web`;
const RUNTIME_IDENTITY_FILES = [
  '.env.example',
  '.env.mock',
  '.env.dev.example',
  '.env.test.example',
  '.env.prod.example',
  '.github/workflows/check.yml',
  'index.html',
  'mocks/openapi.yaml',
  'package.json',
  'src/locale/en-US.json',
  'src/locale/zh-CN.json',
  'src/shared/config/app-env.ts',
  'src/shared/runtime/frontend-version-watcher.tsx',
  'src/shared/store/session-store.ts',
];

/**
 * 将命令行输入规范化为不带 -web 后缀的基础项目 ID。
 *
 * @param {string} value - 用户提供的项目名。
 * @returns {string} 合法的 kebab-case 项目 ID。
 */
function normalizeProjectId(value) {
  const normalizedValue = value.trim().replace(/-web$/u, '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(normalizedValue) || normalizedValue === PLACEHOLDER_PROJECT_ID) {
    throw new Error('项目名必须是非 spa-app 的小写 kebab-case 基础项目名。');
  }

  return normalizedValue;
}

/**
 * 校验并规范化仓库相对路径。
 *
 * @param {string} value - 用户提供的相对路径。
 * @param {string} optionName - 参数名。
 * @returns {string} 规范化后的 POSIX 相对路径。
 */
function normalizeRelativePath(value, optionName) {
  const normalizedValue = value.trim().replaceAll('\\', '/');
  if (normalizedValue.length === 0 || normalizedValue.startsWith('/') || /^[A-Za-z]:\//u.test(normalizedValue)) {
    throw new Error(`${optionName} 必须是非空仓库相对路径，不能使用个人绝对路径。`);
  }

  return normalizedValue;
}

/**
 * 解析初始化命令，要求一个项目名和明确的后端关系。
 *
 * @returns {{ dryRun: boolean, projectId: string, backendRoot: string }} 初始化参数。
 */
function parseArguments() {
  const argumentsList = process.argv.slice(2);
  let dryRun = false;
  let backendRoot;
  let noBackend = false;
  let packageName;
  const projectArguments = [];

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--root') {
      index += 1;
    } else if (argument === '--dry-run') {
      dryRun = true;
    } else if (argument === '--no-backend') {
      noBackend = true;
    } else if (argument === '--backend-root') {
      const value = argumentsList[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--backend-root 必须提供相对于前端仓库的路径。');
      }
      backendRoot = normalizeRelativePath(value, '--backend-root');
      index += 1;
    } else if (argument === '--package-name') {
      const value = argumentsList[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--package-name 必须提供 kebab-case 包名。');
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) {
        throw new Error(`--package-name 必须是 kebab-case: ${value}`);
      }
      packageName = value;
      index += 1;
    } else if (argument.startsWith('--')) {
      throw new Error(`未知参数: ${argument}`);
    } else {
      projectArguments.push(argument);
    }
  }

  if (projectArguments.length !== 1) {
    throw new Error(
      '用法: node tools/init/spa.mjs [--dry-run] [--root <dir>] [--package-name <name>] (--backend-root <path>|--no-backend) <project-id>',
    );
  }
  if (Boolean(backendRoot) === noBackend) {
    throw new Error('必须且只能选择 --backend-root <path> 或 --no-backend。');
  }

  return {
    dryRun,
    projectId: normalizeProjectId(projectArguments[0]),
    backendRoot: backendRoot ?? 'N/A',
    packageName,
  };
}

/**
 * 派生 SPA 运行时和部署文档使用的项目标识。
 *
 * @param {string} projectId - 基础项目 ID。
 * @param {string} backendRoot - 配套后端相对路径或 N/A。
 * @returns {Record<string, string>} 所有派生值。
 */
function deriveProjectValues(projectId, backendRoot, packageName) {
  return {
    projectId,
    appName: packageName ?? `${projectId}-web`,
    backendRoot,
    deliveryDocRoot: backendRoot === 'N/A' ? '.' : backendRoot,
    basePath: `/${projectId}/`,
    initializationDate: formatLocalDate(new Date()),
    staticRoot: `/var/www/${projectId}`,
    versionChannel: `${projectId}-frontend-version`,
    versionStorageKey: `${projectId}:last-refreshed-version`,
    sessionStorageKey: `${projectId}:session.v1`,
  };
}

/**
 * 将日期格式化为本地时区的 YYYY-MM-DD。
 *
 * @param {Date} date - 需要格式化的日期。
 * @returns {string} 本地日期。
 */
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 校验当前仓库仍是未经初始化的 SPA 骨架。
 *
 * @returns {void}
 */
function assertPristineSkeleton() {
  const packageJson = JSON.parse(readFileSync(join(ROOT_DIRECTORY, 'package.json'), 'utf8'));
  const exampleEnv = readFileSync(join(ROOT_DIRECTORY, '.env.example'), 'utf8');
  const mockEnv = readFileSync(join(ROOT_DIRECTORY, '.env.mock'), 'utf8');
  if (
    packageJson.name !== PLACEHOLDER_APP_NAME ||
    !exampleEnv.includes('VITE_APP_TITLE=SPA Application') ||
    !mockEnv.includes('VITE_APP_TITLE=SPA Application')
  ) {
    throw new Error('当前仓库不是可直接初始化的 SPA 骨架，或已经完成/部分完成初始化。');
  }
}

/**
 * 收集文件更新；dry-run 只记录变化，实际模式才写入磁盘。
 *
 * @param {string} relativePath - 项目根目录下的文件路径。
 * @param {string} updated - 目标文件内容。
 * @param {boolean} dryRun - 是否只预览。
 * @param {string[]} changedFiles - 已变更文件清单。
 * @returns {void}
 */
function applyFileUpdate(relativePath, updated, dryRun, changedFiles) {
  const filePath = join(ROOT_DIRECTORY, relativePath);
  const source = readFileSync(filePath, 'utf8');
  if (updated === source) {
    return;
  }

  changedFiles.push(relativePath);
  if (!dryRun) {
    writeFileSync(filePath, updated);
  }
}

/**
 * 执行必须命中的文本替换；骨架结构漂移时停止，避免部分初始化。
 *
 * @param {string} source - 原始文件内容。
 * @param {string} expected - 必须存在的骨架文本。
 * @param {string} replacement - 正式项目文本。
 * @param {string} relativePath - 用于错误提示的文件路径。
 * @returns {string} 替换后的文件内容。
 */
function replaceRequired(source, expected, replacement, relativePath) {
  if (!source.includes(expected)) {
    throw new Error(`初始化目标结构已变化: ${relativePath}`);
  }

  return source.replace(expected, replacement);
}

/**
 * 替换运行时代码、环境示例和契约标题中的 SPA 占位身份。
 *
 * @param {Record<string, string>} values - 派生项目值。
 * @param {boolean} dryRun - 是否只预览。
 * @returns {string[]} 发生变化的相对路径。
 */
function replaceRuntimeIdentity(values, dryRun) {
  const changedFiles = [];
  const replacements = [
    ['React SPA Application Skeleton', values.appName],
    ['React SPA 应用骨架', values.appName],
    ['SPA Application', values.appName],
    ['spa-app-web', values.appName],
    ['spa-app-frontend-version', values.versionChannel],
    ['spa-app:last-refreshed-version', values.versionStorageKey],
    ['spa-app:session.v1', values.sessionStorageKey],
  ];

  for (const relativePath of RUNTIME_IDENTITY_FILES) {
    const filePath = join(ROOT_DIRECTORY, relativePath);
    const source = readFileSync(filePath, 'utf8');
    let updated = replacements.reduce((content, [from, to]) => content.replaceAll(from, to), source);

    if (relativePath.startsWith('.env.')) {
      updated = replaceRequired(updated, 'VITE_APP_BASE_PATH=/', `VITE_APP_BASE_PATH=${values.basePath}`, relativePath);
    }
    if (relativePath.startsWith('.github/workflows/')) {
      updated = replaceRequired(
        updated,
        'VITE_APP_BASE_PATH=/spa-app/',
        `VITE_APP_BASE_PATH=${values.basePath}`,
        relativePath,
      );
    }

    applyFileUpdate(relativePath, updated, dryRun, changedFiles);
  }

  return changedFiles;
}

/**
 * 将 README 从骨架说明转换为正式 SPA 项目说明。
 *
 * @param {string} source - 骨架 README。
 * @param {Record<string, string>} values - 派生项目值。
 * @returns {string} 正式项目 README。
 */
function updateReadme(source, values) {
  let updated = replaceRequired(source, '# React SPA Application Skeleton', `# ${values.appName}`, 'README.md');
  updated = replaceRequired(
    updated,
    '这是一个可复制的 React SPA 项目骨架，不是正式业务应用，也不以任何业务服务作为后续规则来源。',
    `这是一个基于通用骨架初始化的 Vite React SPA 应用，项目 ID 为 \`${values.projectId}\`。`,
    'README.md',
  );
  updated = replaceRequired(updated, '骨架默认提供：', '项目基线提供：', 'README.md');

  const rulesSyncStart = updated.indexOf('## 同步架构规范');
  const identityStart = updated.indexOf('## 复制后的第一步');
  if (rulesSyncStart < 0 || identityStart < 0 || rulesSyncStart <= identityStart) {
    throw new Error('初始化目标结构已变化: README.md');
  }

  const bindingSection = `## 项目绑定

- 前端根：当前仓库。
- 后端根与交付文档根：${
    values.backendRoot === 'N/A'
      ? '无配套后端，后端根为 `N/A`，交付文档根为当前仓库 `。'
      : `\`${values.backendRoot}\`。`
  }
- 仓库关系只记录相对路径，不得写个人绝对路径。

`;

  const identitySection = `## 项目身份

\`\`\`text
project-id       = ${values.projectId}
package / title  = ${values.appName}
browser base path = ${values.basePath}
version endpoint = ${values.basePath}version.json
static root      = ${values.staticRoot}
\`\`\`

`;

  return `${updated.slice(0, identityStart)}${identitySection}${bindingSection}${updated.slice(rulesSyncStart)}`;
}

/**
 * 将 AGENTS 的骨架状态改为正式 SPA 项目状态，并移除一次性初始化路由。
 *
 * @param {string} source - 骨架 AGENTS。
 * @param {Record<string, string>} values - 派生项目值。
 * @returns {string} 正式项目 AGENTS。
 */
function updateAgents(source, values) {
  const skeletonState = `- 本仓库是可复制的 React SPA 项目骨架，不是正式业务应用。
- 本仓库承载前端与共享规则；Java 后端规则不随前端骨架分发。
- 新应用复制后，必须先完成项目变量绑定和 SPA 初始化清单。`;
  const projectState = `- 当前项目是基于 React SPA 骨架初始化的正式应用。
- 项目 ID 为 \`${values.projectId}\`，package 与应用标题为 \`${values.appName}\`。
- 本仓库承载共享、前端和通用 Java 后端规则。
- 配套后端仓库为 \`${values.backendRoot}\`，交付文档根为 \`${values.deliveryDocRoot}\`。`;
  let updated = replaceRequired(source, skeletonState, projectState, 'AGENTS.md');
  updated = replaceRequired(
    updated,
    '- `spa-app`、`spa-app-web` 和 `SPA Application` 都是待替换占位值。',
    `- 当前项目使用 \`${values.basePath}\` 作为 Vite base、Router basename 和 Nginx location。`,
    'AGENTS.md',
  );

  return updated;
}

/**
 * 生成正式 SPA 项目的绑定记录。
 *
 * @param {Record<string, string>} values - 派生项目值。
 * @returns {string} 项目绑定 Markdown。
 */
function buildProjectBinding(values) {
  return `# SPA Project

## Always-on

- 当前项目是基于 React SPA 骨架初始化的正式应用。
- 项目 ID 为 \`${values.projectId}\`，package 与应用标题为 \`${values.appName}\`。
- 配套后端仓库为 \`${values.backendRoot}\`，交付文档根为 \`${values.deliveryDocRoot}\`。
- 路由使用 Vite base 与 React Router basename 的同一部署路径 \`${values.basePath}\`。
- 应用运行时只包含浏览器代码，不新增 BFF 或服务端业务层。
- feature 内按 pages、components、hooks、services、types 和 store 拆分。
- shared 只放跨 feature 稳定复用能力。

## Routing

- 新增 feature 或调整目录前，读取 \`docs/rules/frontend/frontend-architecture.md\`。
- 修改组件和 hook 前，读取 \`docs/rules/frontend/frontend-react.md\`。
- 修改 API 与 mock 前，读取 \`docs/rules/frontend/api-contracts.md\` 和
  \`docs/rules/frontend/mock-and-integration.md\`。
- 修改环境、base path 和发布能力前，读取 \`docs/rules/frontend/environments-and-build.md\`。
- 修改跨端契约或交付文档前，读取 \`docs/rules/shared/\`。

## Rule references

- SPA baseline: \`docs/rules/frontend/spa-project-baseline.md\`
- Architecture: \`docs/rules/frontend/frontend-architecture.md\`
- React: \`docs/rules/frontend/frontend-react.md\`
- Environment and build: \`docs/rules/frontend/environments-and-build.md\`
- Release: \`docs/deployment/online-release.md\`
- Shared rules: \`docs/rules/shared/\`
`;
}

/**
 * 生成正式项目的命名事实源。
 *
 * @param {Record<string, string>} values - 派生项目值。
 * @returns {string} 项目命名 Markdown。
 */
function buildProjectNaming(values) {
  return `# SPA Project Naming

本文是当前应用的项目身份事实源。

## Current Binding

- \`<project-name>\`: \`${values.appName}\`
- \`<project-id>\`: \`${values.projectId}\`
- \`<frontend-package-name>\`: \`${values.appName}\`
- \`<app-base-path>\`: \`${values.basePath}\`
- \`<static-root>\`: \`${values.staticRoot}\`
- \`<api-upstream>\`: \`未绑定\`
- \`<backend-root>\`: \`${values.backendRoot}\`
- \`<delivery-doc-root>\`: \`${values.deliveryDocRoot}\`

## Derived Values

- Package name: \`${values.appName}\`
- Application title: \`${values.appName}\`
- Base path: \`${values.basePath}\`
- Version endpoint: \`${values.basePath}version.json\`
- Version channel: \`${values.versionChannel}\`
- Version storage key: \`${values.versionStorageKey}\`
- Session storage key: \`${values.sessionStorageKey}\`
- Static root: \`${values.staticRoot}\`

API base URL、Nginx upstream 和正式域名由对应环境与发布平台配置。

## Hard Rules

- Vite base、React Router basename、版本文件路径和 Nginx location 必须一致。
- 业务展示名需要区别于 \`${values.appName}\` 时，在 locale、HTML title 和 ADR 中显式记录。
- 不得把 token、真实凭证或未确认的后端地址写入仓库。
- 配套仓库和文档根只记录相对路径,不得写个人机器绝对路径。
`;
}

/**
 * 生成已接受 SPA 默认策略的项目 ADR。
 *
 * @param {Record<string, string>} values - 派生项目值。
 * @returns {string} ADR Markdown。
 */
function buildProjectAdr(values) {
  return `# ADR-000：React SPA 项目基线

- 状态：Accepted
- 日期：${values.initializationDate}

## 项目身份

- Project ID: \`${values.projectId}\`
- App name: \`${values.appName}\`
- Base path: \`${values.basePath}\`
- Static root: \`${values.staticRoot}\`

## 决策

当前 SPA 应用采用 Vite、React、TypeScript、React Router、Ant Design 6、原生 CSS + CSS 变量、i18next、
OpenAPI/Prism 和 Vitest。

应用使用 history 路由。构建期 base path、React Router basename 和 Nginx location 必须使用
同一项目路径。

生产制品由 Vite 直接输出到 \`dist/\`，由 Nginx 托管静态文件并提供 history fallback。
发布平台负责部署完整 \`dist/\`，\`deploy.sh\` 只负责校验 Nginx 配置并执行 reload。

## 会话鉴权

- SPA 与 SSR 统一只接受 HttpOnly + Secure + SameSite=Lax 的会话 cookie；不提供 Bearer、
  localStorage、sessionStorage 或 JS 可读 cookie 的回退方案。
- 网关与页面不同域时，由 Nginx 把 /api/ 同源反代到网关；浏览器不直连网关域名。
- 登录响应与 /auth/session 只返回最小用户标识，不返回 token；刷新后由 /auth/session 水合。
- API upstream、正式域名和 Nginx server name 由发布环境另行绑定。

## 约束

- \`version.json\` 和 \`index.html\` 不得缓存
- hash assets 应长期缓存
- 业务页面不得绕过统一 API client
- 前端不得读取、持久化或注入会话 token
`;
}

/**
 * 更新项目文档，通用 SPA 规则和 Nginx 占位模板保持不变。
 *
 * @param {Record<string, string>} values - 派生项目值。
 * @param {boolean} dryRun - 是否只预览。
 * @returns {string[]} 发生变化的相对路径。
 */
function updateProjectDocuments(values, dryRun) {
  const changedFiles = [];

  /**
   * 读取项目根目录下的目标文档。
   *
   * @param {string} relativePath - 项目相对路径。
   * @returns {string} 文件内容。
   */
  const read = (relativePath) => readFileSync(join(ROOT_DIRECTORY, relativePath), 'utf8');

  applyFileUpdate('README.md', updateReadme(read('README.md'), values), dryRun, changedFiles);
  applyFileUpdate('AGENTS.md', updateAgents(read('AGENTS.md'), values), dryRun, changedFiles);
  applyFileUpdate('.agents/spa-project.md', buildProjectBinding(values), dryRun, changedFiles);
  applyFileUpdate('docs/rules/shared/project-naming.md', buildProjectNaming(values), dryRun, changedFiles);
  applyFileUpdate('docs/decisions/adr-000-spa-project-baseline.md', buildProjectAdr(values), dryRun, changedFiles);

  const releasePath = 'docs/deployment/online-release.md';
  const release = read(releasePath)
    .replace('VITE_APP_TITLE="SPA Application"', `VITE_APP_TITLE="${values.appName}"`)
    .replace('VITE_APP_BASE_PATH=/spa-app/', `VITE_APP_BASE_PATH=${values.basePath}`);
  applyFileUpdate(releasePath, release, dryRun, changedFiles);

  return changedFiles;
}

/**
 * 确认运行时代码和环境示例中不再残留 SPA 骨架身份。
 *
 * @returns {void}
 */
function assertNoRuntimePlaceholders() {
  const leftovers = RUNTIME_IDENTITY_FILES.filter((relativePath) => {
    const source = readFileSync(join(ROOT_DIRECTORY, relativePath), 'utf8');
    return (
      source.includes(PLACEHOLDER_APP_NAME) ||
      source.includes('SPA Application') ||
      source.includes('spa-app-frontend-version') ||
      source.includes('spa-app:last-refreshed-version') ||
      source.includes('spa-app:session.v1')
    );
  });
  if (leftovers.length > 0) {
    throw new Error(`初始化后仍有运行时占位值: ${leftovers.join(', ')}`);
  }
}

/**
 * 执行一次 SPA 项目初始化或 dry-run 预览。
 *
 * @returns {void}
 */
function initializeProject() {
  const { dryRun, projectId, backendRoot, packageName } = parseArguments();
  const values = deriveProjectValues(projectId, backendRoot, packageName);
  assertPristineSkeleton();
  const changedFiles = [...replaceRuntimeIdentity(values, dryRun), ...updateProjectDocuments(values, dryRun)];

  if (!dryRun) {
    assertNoRuntimePlaceholders();
  }

  process.stdout.write(
    `${dryRun ? '[dry-run] ' : ''}SPA 项目初始化${dryRun ? '计划' : '完成'}\n` +
      `project-id: ${values.projectId}\n` +
      `app-name: ${values.appName}\n` +
      `backend-root: ${values.backendRoot}\n` +
      `delivery-doc-root: ${values.deliveryDocRoot}\n` +
      `base-path: ${values.basePath}\n` +
      `static-root: ${values.staticRoot}\n` +
      `changed-files: ${changedFiles.length}\n` +
      changedFiles.map((filePath) => `- ${filePath}\n`).join(''),
  );
}

initializeProject();
