import { readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const ROOT_DIRECTORY = resolve(SCRIPT_DIRECTORY, '../../../..');
const PLACEHOLDER_PROJECT_ID = 'ssr-app';
const PLACEHOLDER_APP_NAME = `${PLACEHOLDER_PROJECT_ID}-web`;
const ROUTE_DIRECTORY = join('src', 'app', `${PLACEHOLDER_PROJECT_ID}-api`);
const RUNTIME_IDENTITY_FILES = [
  '.agents/verification.md',
  '.env.example',
  '.env.mock',
  '.env.dev.example',
  '.env.test.example',
  '.env.prod.example',
  'ecosystem.config.cjs',
  'mock/openapi.yaml',
  'package.json',
  'scripts/deploy.sh',
  'src/app/manifest.ts',
  'src/app/opengraph-image.tsx',
  'src/app/robots.ts',
  `${ROUTE_DIRECTORY}/health/route.ts`,
  'src/bff/shared/logger/server-logger.ts',
  'src/bff/shared/server-config.ts',
  'src/i18n/locale-config.ts',
  'src/locale/en-US.json',
  'src/shared/runtime/frontend-version-watcher.tsx',
  'src/test/app/frontend-version-route.test.ts',
  'src/test/architecture/route-prefix-boundary.test.ts',
  'src/test/architecture/seo-boundary.test.ts',
  'src/test/bff/server-config.test.ts',
  'src/test/shared/frontend-version-watcher.test.tsx',
];

/**
 * 将命令行参数规范化为基础项目 ID；输入已带 -web 时只移除末尾后缀。
 *
 * @param {string} value - 用户提供的项目名。
 * @returns {string} 不带 -web 后缀的基础项目 ID。
 */
function normalizeProjectId(value) {
  const normalizedValue = value.trim().replace(/-web$/u, '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(normalizedValue) || normalizedValue === PLACEHOLDER_PROJECT_ID) {
    throw new Error('项目名必须是非 ssr-app 的小写 kebab-case 基础项目名。');
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
 * 解析初始化命令，要求一个项目名，并校验配套 Java 后端关系。
 *
 * @returns {{ dryRun: boolean, projectId: string, backendRoot: string }} 初始化参数。
 */
function parseArguments() {
  const argumentsList = process.argv.slice(2);
  let dryRun = false;
  let backendRoot;
  let noBackend = false;
  const projectArguments = [];

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--dry-run') {
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
    } else if (argument.startsWith('--')) {
      throw new Error(`未知参数: ${argument}`);
    } else {
      projectArguments.push(argument);
    }
  }

  if (projectArguments.length !== 1) {
    throw new Error(
      '用法: node initialize-ssr-project.mjs [--dry-run] (--backend-root <path>|--no-backend) <project-id>',
    );
  }
  if (Boolean(backendRoot) === noBackend) {
    throw new Error('必须且只能选择 --backend-root <path> 或 --no-backend。');
  }

  return {
    dryRun,
    projectId: normalizeProjectId(projectArguments[0]),
    backendRoot: backendRoot ?? 'N/A',
  };
}

/**
 * 将项目 ID 派生为初始化所需的应用、路径、cookie 和版本标识。
 *
 * @param {string} projectId - 不带 -web 后缀的基础项目 ID。
 * @param {string} backendRoot - 配套 Java 后端相对路径或 N/A。
 * @returns {Record<string, string>} 所有受控替换值。
 */
function deriveProjectValues(projectId, backendRoot) {
  const projectSnake = projectId.replace(/-/gu, '_');
  const appName = `${projectId}-web`;

  return {
    projectId,
    projectSnake,
    appName,
    backendRoot,
    deliveryDocRoot: backendRoot === 'N/A' ? '.' : backendRoot,
    capabilityMatrix: `database: disabled
webAuthentication: enabled
applicationAuthorization: disabled
redis: disabled
distributedLock: disabled
backgroundWorker: disabled
messageQueue: disabled
scheduledJobs: disabled`,
    bffPrefix: `/${projectId}-api`,
    logDirectory: `/data/logs/${appName}`,
    versionChannel: `${projectId}-frontend-version`,
    versionStorageKey: `${projectId}:last-refreshed-version`,
  };
}

/**
 * 校验当前仓库仍是未经初始化的 SSR 骨架，避免覆盖正式代码或半成品。
 *
 * @returns {void}
 */
function assertPristineSkeleton() {
  const packageJson = JSON.parse(readFileSync(join(ROOT_DIRECTORY, 'package.json'), 'utf8'));
  const routeDirectory = join(ROOT_DIRECTORY, ROUTE_DIRECTORY);
  if (packageJson.name !== PLACEHOLDER_APP_NAME || !statSync(routeDirectory, { throwIfNoEntry: false })) {
    throw new Error('当前仓库不是可直接初始化的 SSR 骨架，或已经完成/部分完成初始化。');
  }
}

/**
 * 执行必须命中的文本替换；骨架结构漂移时立即停止，避免生成半初始化文档。
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
 * 替换运行时代码、环境示例和测试中的 SSR 项目标识。
 *
 * @param {Record<string, string>} values - 派生项目值。
 * @param {boolean} dryRun - 是否只输出计划而不写文件。
 * @returns {string[]} 发生变化的相对路径列表。
 */
function replaceRuntimeIdentity(values, dryRun) {
  const replacements = [
    ['SSR Application Skeleton', values.appName],
    ['SSR Application', values.appName],
    ['SSR App', values.appName],
    ['ssr-app-web', values.appName],
    ['/ssr-app-api', values.bffPrefix],
    ['ssr-app-api', values.bffPrefix.slice(1)],
    ['ssr_app', values.projectSnake],
    ['ssr-app', values.projectId],
  ];
  const changedFiles = [];

  for (const relativePath of RUNTIME_IDENTITY_FILES) {
    const filePath = join(ROOT_DIRECTORY, relativePath);
    const source = readFileSync(filePath, 'utf8');
    const updated = replacements.reduce((content, [from, to]) => content.replaceAll(from, to), source);
    applyFileUpdate(relativePath, updated, dryRun, changedFiles);
  }

  return changedFiles;
}

/**
 * 生成正式项目的绑定记录，替代骨架占位说明。
 *
 * @param {Record<string, string>} values - 派生项目值。
 * @returns {string} 项目绑定 Markdown。
 */
function buildProjectBinding(values) {
  return `# SSR Project Binding

当前项目已通过 SSR 骨架初始化器完成身份绑定。

- Project name: \`${values.appName}\`
- Project ID: \`${values.projectId}\`
- Package name: \`${values.appName}\`
- Auth cookie: \`${values.projectSnake}_auth\`
- Locale cookie: \`${values.projectSnake}_locale\`
- Next BFF prefix: \`${values.bffPrefix}\`
- PM2 app name: \`${values.appName}\`
- Log directory: \`${values.logDirectory}\`
- OpenAPI / Prism entry: \`mock/openapi.yaml\`
- Paired Java backend repository: \`${values.backendRoot}\`
- Delivery document root: \`${values.deliveryDocRoot}\`

## Backend Capabilities

\`\`\`yaml
${values.capabilityMatrix}
\`\`\`

通用规则文件保留在当前仓库；SSR 骨架固定 BFF-only，只启用 \`docs/rules/shared/**\` 与
\`docs/rules/frontend/**\` 规则范围。后端地址、正式域名、密钥和图片白名单由对应环境与发布平台配置。
仓库关系只记录相对路径，不得写个人绝对路径。
`;
}

/**
 * 生成正式项目的命名事实源；所有可派生标识均由基础项目 ID 计算。
 *
 * @param {Record<string, string>} values - 派生项目值。
 * @returns {string} 项目命名 Markdown。
 */
function buildProjectNaming(values) {
  return `# Project Naming

本文是当前应用的项目身份事实源。

## Current Binding

- \`<project-name>\`: \`${values.appName}\`
- \`<project-id>\`: \`${values.projectId}\`
- \`<project-snake>\`: \`${values.projectSnake}\`
- \`<frontend-package-name>\`: \`${values.appName}\`
- \`<frontend-bff-prefix>\`: \`${values.projectId}-api\`
- \`<frontend-root>\`: \`.\`
- \`<backend-root>\`: \`${values.backendRoot}\`
- \`<delivery-doc-root>\`: \`${values.deliveryDocRoot}\`

## Derived Values

- Package name: \`${values.appName}\`
- Service name: \`${values.appName}\`
- PM2 app name: \`${values.appName}\`
- Auth cookie: \`${values.projectSnake}_auth\`
- Locale cookie: \`${values.projectSnake}_locale\`
- CSRF cookie: \`${values.projectSnake}_csrf\`
- BFF URL: \`${values.bffPrefix}\`
- Log directory: \`${values.logDirectory}\`
- SEO site name: \`${values.appName}\`

## Backend Capabilities

\`\`\`yaml
${values.capabilityMatrix}
\`\`\`

PM2 应用名可用 \`PM2_APP_NAME\` 覆盖，日志目录可用 \`PM2_LOG_DIRECTORY\` 覆盖。
覆盖任一值时必须同步部署交接记录。

## Hard Rules

- URL、cookie、service、PM2 和日志名称统一使用当前绑定的机器可读 ID。
- 业务展示名需要区别于 \`${values.appName}\` 时，在 locale、metadata 和 ADR 中显式记录。
- 规范正文不得写入具体 token、cookie value、后端凭证或部署账号。
- 配套仓库和文档根只记录相对路径，不得写个人机器绝对路径。
`;
}

/**
 * 生成已接受骨架默认策略的 ADR。
 *
 * @param {Record<string, string>} values - 派生项目值。
 * @returns {string} ADR Markdown。
 */
function buildProjectAdr(values) {
  return `# ADR-000 SSR Project Baseline

## 状态

已确认。

## 项目身份

- Project ID: \`${values.projectId}\`
- App name: \`${values.appName}\`
- BFF prefix: \`${values.bffPrefix}\`

## 默认决策

- Framework: Next.js 16 App Router + React 19
- Middleware: \`src/proxy.ts\`
- Locale route: 公开区 app/[locale]，非公开区 cookie + refresh
- Auth cookie: \`${values.projectSnake}_auth\`
- Locale cookie: \`${values.projectSnake}_locale\`
- Build: Next standalone
- Deployment: PM2 或平台等价方式
- Release refresh: production 启用，development 禁用
- Package manager: pnpm

## 后端能力

\`\`\`yaml
${values.capabilityMatrix}
\`\`\`

本项目固定 BFF-only：所有 Web 业务必须经过 \`src/bff/**\`，当前 Next.js 仓库不实现数据库、Redis、
MQ、worker 或完整领域能力。

## 例外

暂无。后续偏离上述默认策略时在本 ADR 中补充原因和影响。

后端 URL、mock URL、端口、日志级别、SEO 描述、图片域名和密钥属于环境或发布配置。
`;
}

/**
 * 将 README 从骨架说明转换为正式项目说明，保留开发、架构和发布章节。
 *
 * @param {string} source - 骨架 README。
 * @param {Record<string, string>} values - 派生项目值。
 * @returns {string} 正式项目 README。
 */
function updateReadme(source, values) {
  let updated = replaceRequired(source, '# SSR Application Skeleton', `# ${values.appName}`, 'README.md');
  updated = replaceRequired(
    updated,
    '这是一个可复制的 Next.js SSR/BFF 项目骨架，不是正式业务应用，也不以任何业务服务作为后续规则来源。',
    `这是一个基于通用骨架初始化的 Next.js SSR/BFF 应用，项目 ID 为 \`${values.projectId}\`。`,
    'README.md',
  );
  updated = replaceRequired(updated, '骨架默认提供：', '项目基线提供：', 'README.md');

  const backendSectionStart = updated.indexOf('## 项目绑定');
  const rulesSyncStart = updated.indexOf('## 同步架构规范');
  if (backendSectionStart < 0 || rulesSyncStart <= backendSectionStart) {
    throw new Error('初始化目标结构已变化: README.md 项目绑定');
  }

  const backendBinding =
    values.backendRoot === 'N/A'
      ? `没有配套、由当前项目维护的 Java 后端仓库，后端仓库为 \`N/A\`，交付文档根为当前仓库
\`.\`。SSR 自身 BFF 和外部 API 仍按已确认契约管理。`
      : `配套 Java 后端仓库和默认交付文档根为 \`${values.backendRoot}\`。后端仓库必须使用自己的
\`$initialize-backend-project\` 完成初始化，并反向绑定当前前端路径。`;
  const backendSection = `## 后端与规则关系

当前项目启用 \`docs/rules/shared/**\` 和 \`docs/rules/frontend/**\`；Next.js 侧固定 BFF-only，
不承担数据库、中间件或领域实现。

${backendBinding}
所有仓库关系只记录相对路径，不得沿用模板仓库名或写个人绝对路径。

`;
  const identityStart = updated.indexOf('## 复制后的第一步');
  if (identityStart < 0 || rulesSyncStart <= identityStart) {
    throw new Error('初始化目标结构已变化: README.md');
  }

  const identitySection = `## 项目身份

\`\`\`text
project-id          = ${values.projectId}
package/service/PM2 = ${values.appName}
auth cookie         = ${values.projectSnake}_auth
locale cookie       = ${values.projectSnake}_locale
BFF prefix          = ${values.bffPrefix}
log directory       = ${values.logDirectory}
\`\`\`

`;
  return `${updated.slice(0, identityStart)}${identitySection}${backendSection}${updated.slice(rulesSyncStart)}`;
}

/**
 * 将 AGENTS 的骨架状态改为正式项目状态，并移除一次性初始化路由。
 *
 * @param {string} source - 骨架 AGENTS。
 * @param {Record<string, string>} values - 派生项目值。
 * @returns {string} 正式项目 AGENTS。
 */
function updateAgents(source, values) {
  const skeletonState = `- 本仓库是可复制的 SSR/BFF 项目骨架，不是正式业务应用。
- 本仓库承载前端、共享与 Next 前端规则；Java 后端规则不随前端骨架分发。
- 没有配套 Java 后端仓库的 SSR 项目仍可使用自身 BFF 或外部 API，不需要创建占位后端仓库。
- SSR 骨架固定 BFF-only：Next.js 只承担 Web、SSR 和 BFF，不实现数据库、Redis、MQ、worker 或
  完整领域能力。
- 新应用复制后，必须先完成 \`docs/rules/shared/project-naming.md\` 的项目变量绑定。
- 未完成项目变量绑定，不得开始业务功能开发或接入真实后端。`;
  const projectState = `- 当前项目是基于 SSR/BFF 骨架初始化的正式应用。
- 项目 ID 为 \`${values.projectId}\`，package、service 与 PM2 名称为 \`${values.appName}\`。
- 当前项目启用共享和前端规则；Java 后端规则不生效。
- 当前项目固定 BFF-only：所有 Web 业务必须经过 \`src/bff/**\`，当前 Next.js 仓库不实现数据库、
  Redis、MQ、worker 或完整领域能力。
- 配套 Java 后端仓库为 \`${values.backendRoot}\`，交付文档根为 \`${values.deliveryDocRoot}\`。`;
  let updated = replaceRequired(source, skeletonState, projectState, 'AGENTS.md');
  updated = replaceRequired(
    updated,
    '- BFF Route Handler 默认使用 `/<project-id>-api/**`，不得直接占用 `/api/**`。',
    `- BFF Route Handler 使用 \`${values.bffPrefix}/**\`，不得直接占用 \`/api/**\`。`,
    'AGENTS.md',
  );
  updated = replaceRequired(
    updated,
    '- 当前骨架的 `ssr-app`、`ssr-app-web`、`ssr_app_auth` 和 `/ssr-app-api` 都是待替换占位值。',
    `- 当前项目使用 \`${values.projectSnake}_auth\` 认证 cookie 和 \`${values.logDirectory}\` PM2 日志目录。`,
    'AGENTS.md',
  );
  return updated.replace(
    `- 用户要求初始化复制后的 SSR 骨架并提供一个 kebab-case 项目名时，使用
  \`.agents/skills/initialize-ssr-project/SKILL.md\`，并确认 \`--backend-root\` 或 \`--no-backend\`，
  不要手工进行全仓库替换。
`,
    '',
  );
}

/**
 * 更新项目文档；通用 SSR 规则不参与实际项目身份替换。
 *
 * @param {Record<string, string>} values - 派生项目值。
 * @param {boolean} dryRun - 是否只预览。
 * @returns {string[]} 发生变化的相对路径列表。
 */
function updateProjectDocuments(values, dryRun) {
  const changedFiles = [];

  /**
   * 读取项目根目录下的目标文档。
   *
   * @param {string} relativePath - 项目相对路径。
   * @returns {string} 文档原始内容。
   */
  const read = (relativePath) => readFileSync(join(ROOT_DIRECTORY, relativePath), 'utf8');
  applyFileUpdate('README.md', updateReadme(read('README.md'), values), dryRun, changedFiles);
  applyFileUpdate('AGENTS.md', updateAgents(read('AGENTS.md'), values), dryRun, changedFiles);
  applyFileUpdate('.agents/ssr-project.md', buildProjectBinding(values), dryRun, changedFiles);
  applyFileUpdate('docs/rules/shared/project-naming.md', buildProjectNaming(values), dryRun, changedFiles);
  applyFileUpdate('docs/decisions/adr-000-ssr-project-baseline.md', buildProjectAdr(values), dryRun, changedFiles);

  return changedFiles;
}

/**
 * 校验并返回正式 BFF Route Handler 目录。
 *
 * @param {string} projectId - 基础项目 ID。
 * @returns {string} 新 Route Handler 目录相对路径。
 */
function getBffRouteDirectory(projectId) {
  const targetDirectory = join('src', 'app', `${projectId}-api`);
  if (statSync(join(ROOT_DIRECTORY, targetDirectory), { throwIfNoEntry: false })) {
    throw new Error(`目标 BFF 路由目录已存在: ${targetDirectory}`);
  }

  return targetDirectory;
}

/**
 * 确认运行时代码和环境示例中不再残留骨架身份。
 *
 * @returns {void}
 */
function assertNoRuntimePlaceholders() {
  const leftovers = RUNTIME_IDENTITY_FILES.filter((relativePath) => {
    const source = readFileSync(join(ROOT_DIRECTORY, relativePath), 'utf8');
    return (
      source.includes(PLACEHOLDER_APP_NAME) ||
      source.includes('/ssr-app-api') ||
      source.includes('ssr_app') ||
      source.includes('SSR Application Skeleton')
    );
  });
  if (leftovers.length > 0) {
    throw new Error(`初始化后仍有运行时占位值: ${leftovers.join(', ')}`);
  }
}

/**
 * 执行一次 SSR 项目初始化或 dry-run 预览。
 *
 * @returns {void}
 */
function initializeProject() {
  const { dryRun, projectId, backendRoot } = parseArguments();
  const values = deriveProjectValues(projectId, backendRoot);
  assertPristineSkeleton();
  const routeDirectory = getBffRouteDirectory(projectId);
  const changedFiles = [...replaceRuntimeIdentity(values, dryRun), ...updateProjectDocuments(values, dryRun)];

  if (!dryRun) {
    assertNoRuntimePlaceholders();
    renameSync(join(ROOT_DIRECTORY, ROUTE_DIRECTORY), join(ROOT_DIRECTORY, routeDirectory));
  }

  process.stdout.write(
    `${dryRun ? '[dry-run] ' : ''}SSR 项目初始化${dryRun ? '计划' : '完成'}\n` +
      `project-id: ${values.projectId}\n` +
      `app-name: ${values.appName}\n` +
      `backend-root: ${values.backendRoot}\n` +
      `delivery-doc-root: ${values.deliveryDocRoot}\n` +
      `bff-prefix: ${values.bffPrefix}\n` +
      `log-directory: ${values.logDirectory}\n` +
      `route-directory: ${routeDirectory}\n` +
      `changed-files: ${changedFiles.length}\n` +
      changedFiles.map((filePath) => `- ${filePath}\n`).join(''),
  );
}

initializeProject();
