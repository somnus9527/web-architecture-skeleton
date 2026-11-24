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
 * 解析初始化命令，要求一个项目名，并按后端模式校验配套 Java 后端关系。
 *
 * @returns {{ dryRun: boolean, projectId: string, backendMode: 'bff-only' | 'next-backend', backendRoot: string }} 初始化参数。
 */
function parseArguments() {
  const argumentsList = process.argv.slice(2);
  let dryRun = false;
  let backendMode = 'bff-only';
  let backendRoot;
  let noBackend = false;
  const projectArguments = [];

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--dry-run') {
      dryRun = true;
    } else if (argument === '--backend-mode') {
      const value = argumentsList[index + 1];
      if (value !== 'bff-only' && value !== 'next-backend') {
        throw new Error('--backend-mode 必须是 bff-only 或 next-backend。');
      }
      backendMode = value;
      index += 1;
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
      '用法: node initialize-ssr-project.mjs [--dry-run] [--backend-mode bff-only] (--backend-root <path>|--no-backend) <project-id>\n' +
        '   或: node initialize-ssr-project.mjs [--dry-run] --backend-mode next-backend <project-id>',
    );
  }
  if (backendMode === 'next-backend' && (backendRoot || noBackend)) {
    throw new Error('next-backend 模式不得同时使用 --backend-root 或 --no-backend。');
  }
  if (backendMode === 'bff-only' && Boolean(backendRoot) === noBackend) {
    throw new Error('必须且只能选择 --backend-root <path> 或 --no-backend。');
  }

  return {
    dryRun,
    projectId: normalizeProjectId(projectArguments[0]),
    backendMode,
    backendRoot: backendMode === 'next-backend' ? 'N/A' : (backendRoot ?? 'N/A'),
  };
}

/**
 * 将项目 ID 派生为初始化所需的应用、路径、cookie 和版本标识。
 *
 * @param {string} projectId - 不带 -web 后缀的基础项目 ID。
 * @param {'bff-only' | 'next-backend'} backendMode - 项目后端模式。
 * @param {string} backendRoot - 配套 Java 后端相对路径或 N/A。
 * @returns {Record<string, string>} 所有受控替换值。
 */
function deriveProjectValues(projectId, backendMode, backendRoot) {
  const projectSnake = projectId.replace(/-/gu, '_');
  const appName = `${projectId}-web`;

  return {
    projectId,
    projectSnake,
    appName,
    backendMode,
    backendRoot,
    deliveryDocRoot: backendRoot === 'N/A' ? '.' : backendRoot,
    backendImplementationRoot: backendMode === 'next-backend' ? '.' : backendRoot,
    capabilityMatrix:
      backendMode === 'next-backend'
        ? `backendMode: next-backend
database: enabled-unbound
webAuthentication: enabled
applicationAuthorization: enabled
redis: disabled
distributedLock: disabled
backgroundWorker: disabled
messageQueue: disabled
scheduledJobs: disabled`
        : `backendMode: bff-only
database: disabled
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
    ['BACKEND_MODE=bff-only', `BACKEND_MODE=${values.backendMode}`],
    ['PM2_SAVE_AFTER_HEALTH=true', `PM2_SAVE_AFTER_HEALTH=${values.backendMode === 'next-backend' ? 'false' : 'true'}`],
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
- Backend mode: \`${values.backendMode}\`
- Backend implementation root: \`${values.backendImplementationRoot}\`
- PM2 app name: \`${values.appName}\`
- Log directory: \`${values.logDirectory}\`
- OpenAPI / Prism entry: \`mock/openapi.yaml\`
- Paired Java backend repository: \`${values.backendRoot}\`
- Delivery document root: \`${values.deliveryDocRoot}\`

## Backend Capabilities

\`\`\`yaml
${values.capabilityMatrix}
\`\`\`

通用规则文件保留在当前仓库，但只启用与 \`${values.backendMode}\` 匹配的规则范围。后端地址、正式
域名、密钥和图片白名单由对应环境与发布平台配置。仓库关系只记录相对路径，不得写个人绝对路径。
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
- \`<backend-mode>\`: \`${values.backendMode}\`
- \`<backend-implementation-root>\`: \`${values.backendImplementationRoot}\`
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
- Backend mode: \`${values.backendMode}\`
- Backend implementation root: \`${values.backendImplementationRoot}\`

## 默认决策

- Framework: Next.js 16 App Router + React 19
- Middleware: \`src/proxy.ts\`
- Locale route: 不使用；cookie + refresh
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

${
  values.backendMode === 'next-backend'
    ? `本项目允许 Next.js 承载受控后端能力。所有 Web 业务必须经过 \`src/bff/**\`，本地实现只能通过
\`src/server/application\` 公开入口进入；数据库和中间件只能位于 \`src/server/infrastructure/**\`。
数据库技术、迁移和连接池完成绑定前，\`database: enabled-unbound\` 不得进入真实数据实现。`
    : `本项目使用 BFF-only 模式，不在当前 Next.js 仓库内实现数据库、Redis、MQ、worker 或完整领域能力。`
}

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
  updated = replaceRequired(
    updated,
    '- 可选 `next-backend` 受控后端模式，保持 BFF 边界并支持后续绑定数据库能力\n',
    values.backendMode === 'next-backend'
      ? '- 当前项目启用 `next-backend` 受控后端模式，所有本地后端能力保持 BFF 边界\n'
      : '',
    'README.md',
  );
  updated = replaceRequired(
    updated,
    'src/server/     next-backend 模式的 application、domain、infrastructure、config 和 composition\n',
    values.backendMode === 'next-backend'
      ? 'src/server/     application、domain、infrastructure、config 和 composition\n'
      : '',
    'README.md',
  );
  const genericDataFlow = `RSC / Route Handler / Server Action
  -> bff/routes|actions
  -> services
     -> gateway -> backend / Prism
     -> server/application -> server/domain -> server/infrastructure
  -> adapter -> view model`;
  const projectDataFlow =
    values.backendMode === 'next-backend'
      ? `RSC / Route Handler / Server Action
  -> bff/routes|actions
  -> services
     -> gateway -> remote backend / Prism
     -> server/application -> server/domain -> server/infrastructure
  -> adapter -> view model`
      : `RSC / Route Handler / Server Action
  -> bff/routes|actions
  -> services
  -> gateway -> backend / Prism
  -> adapter -> view model`;
  updated = replaceRequired(updated, genericDataFlow, projectDataFlow, 'README.md');
  updated = replaceRequired(
    updated,
    '`gateway` 是唯一 HTTP 出站边界，`adapter` 是 DTO/application result 到 view model 的唯一映射边界，\nClient Component 不消费 raw DTO。`next-backend` 模式的数据库和中间件不得穿透 BFF。',
    values.backendMode === 'next-backend'
      ? '`gateway` 是唯一 HTTP 出站边界，`adapter` 是 DTO/application result 到 view model 的唯一映射边界，\nClient Component 不消费 raw DTO。数据库和中间件不得穿透 BFF。'
      : '`gateway` 是唯一 HTTP 出站边界，`adapter` 是 DTO 到 view model 的唯一映射边界，Client Component\n不消费 raw DTO。当前仓库不得创建或启用本地 Application、Domain 或 Infrastructure 后端实现。',
    'README.md',
  );

  const backendSectionStart = updated.indexOf('## 项目绑定');
  const rulesSyncStart = updated.indexOf('## 同步架构规范');
  if (backendSectionStart < 0 || rulesSyncStart <= backendSectionStart) {
    throw new Error('初始化目标结构已变化: README.md 项目绑定');
  }

  const backendBinding =
    values.backendMode === 'next-backend'
      ? `当前项目使用 \`next-backend\`，后端实现根和交付文档根均为当前仓库 \`.\`。所有 Web 业务
仍须经过 BFF，本地后端能力按项目 ADR 与能力开关表管理。`
      : values.backendRoot === 'N/A'
        ? `当前项目使用 \`bff-only\`，没有配套、由当前项目维护的 Java 后端仓库，后端仓库为
\`N/A\`，交付文档根为当前仓库 \`.\`。SSR 自身 BFF 和外部 API 仍按已确认契约管理。`
        : `当前项目使用 \`bff-only\`，配套 Java 后端仓库和默认交付文档根为
\`${values.backendRoot}\`。后端仓库必须使用自己的 \`$initialize-backend-project\` 完成初始化，并
反向绑定当前前端路径。`;
  const activeRules =
    values.backendMode === 'next-backend'
      ? `当前项目启用 \`docs/rules/shared/**\`、\`frontend/**\` 和 \`next-backend/**\`；Java
后端规则不生效。`
      : `当前项目启用 \`docs/rules/shared/**\` 和 \`frontend/**\`；\`next-backend/**\` 不生效。`;
  const backendSection = `## 后端与规则关系

${activeRules}

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
backend mode        = ${values.backendMode}
backend impl root   = ${values.backendImplementationRoot}
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
- 本仓库承载前端、共享与 Next 后端规则；Java 后端规则不随前端骨架分发。
- 没有配套 Java 后端仓库的 SSR 项目仍可使用自身 BFF 或外部 API，不需要创建占位后端仓库。
- 初始化时必须选择 \`bff-only\` 或 \`next-backend\`；初始化 CLI 未传模式时仅为兼容旧命令回退到
  \`bff-only\`，正式运行时仍必须显式配置 \`BACKEND_MODE\`。
- \`next-backend\` 允许当前 Next 应用承载受控后端能力，但所有 Web 业务仍必须经过 \`src/bff/**\`，
  数据库和中间件不得穿透 BFF。
- 新应用复制后，必须先完成 \`docs/rules/shared/project-naming.md\` 的项目变量绑定。
- 未完成项目变量绑定，不得开始业务功能开发或接入真实后端。`;
  const backendModeState =
    values.backendMode === 'next-backend'
      ? `- 当前项目使用 \`next-backend\`；所有 Web 业务必须经过 \`src/bff/**\`，本地后端实现只能由 BFF service
  通过 \`src/server/application\` 公开入口调用，数据库和中间件只能位于 \`src/server/infrastructure/**\`。`
      : `- 当前项目使用 \`bff-only\`；当前 Next.js 仓库不实现数据库、Redis、MQ、worker 或完整领域能力。`;
  const projectRuleState =
    values.backendMode === 'next-backend'
      ? `- 当前项目启用共享、前端和 Next 后端规则；Java 后端规则不生效。
- 后端模式为 \`next-backend\`，后端实现根和交付文档根为 \`.\`。`
      : `- 当前项目启用共享和前端规则；Next 后端规则不生效。
- 后端模式为 \`bff-only\`，后端实现根为 \`${values.backendImplementationRoot}\`。
- 配套 Java 后端仓库为 \`${values.backendRoot}\`，交付文档根为 \`${values.deliveryDocRoot}\`。`;
  const projectState = `- 当前项目是基于 SSR/BFF 骨架初始化的正式应用。
- 项目 ID 为 \`${values.projectId}\`，package、service 与 PM2 名称为 \`${values.appName}\`。
${projectRuleState}
- BFF Route Handler 使用 \`${values.bffPrefix}/**\`，不得直接占用 \`/api/**\`。
${backendModeState}`;
  let updated = replaceRequired(source, skeletonState, projectState, 'AGENTS.md');
  const genericDataFlow = `- 所有 Web 数据流先进入 \`bff/routes|actions -> services\`；远程能力经 \`gateway\`，本地
  \`next-backend\` 能力经 \`server/application -> domain -> infrastructure\`，结果统一由 \`adapter\`
  映射为 view model。
- \`gateway\` 是唯一 HTTP 出站边界，\`adapter\` 是 DTO 或 application result 到 view model 的唯一映射边界。`;
  const projectDataFlow =
    values.backendMode === 'next-backend'
      ? `- 所有 Web 数据流先进入 \`bff/routes|actions -> services\`；远程能力经 \`gateway\`，本地能力经
  \`server/application -> domain -> infrastructure\`，结果统一由 \`adapter\` 映射为 view model。
- \`gateway\` 是唯一 HTTP 出站边界，\`adapter\` 是 DTO 或 application result 到 view model 的唯一映射边界。`
      : `- 所有 Web 数据流统一为 \`bff/routes|actions -> services -> gateway -> backend / Prism -> adapter\`。
- \`gateway\` 是唯一 HTTP 出站边界，\`adapter\` 是 DTO 到 view model 的唯一映射边界。`;
  updated = replaceRequired(updated, genericDataFlow, projectDataFlow, 'AGENTS.md');
  updated = replaceRequired(
    updated,
    '- 当前骨架的 `ssr-app`、`ssr-app-web`、`ssr_app_auth` 和 `/ssr-app-api` 都是待替换占位值。',
    `- 当前项目使用 \`${values.projectSnake}_auth\` 认证 cookie 和 \`${values.logDirectory}\` PM2 日志目录。`,
    'AGENTS.md',
  );
  return updated.replace(
    `- 用户要求初始化复制后的 SSR 骨架并提供一个 kebab-case 项目名时，使用
  \`.agents/skills/initialize-ssr-project/SKILL.md\`，并确认 \`--backend-mode\` 及适用的后端关系参数，
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
  const { dryRun, projectId, backendMode, backendRoot } = parseArguments();
  const values = deriveProjectValues(projectId, backendMode, backendRoot);
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
      `backend-mode: ${values.backendMode}\n` +
      `backend-root: ${values.backendRoot}\n` +
      `backend-implementation-root: ${values.backendImplementationRoot}\n` +
      `delivery-doc-root: ${values.deliveryDocRoot}\n` +
      `bff-prefix: ${values.bffPrefix}\n` +
      `log-directory: ${values.logDirectory}\n` +
      `route-directory: ${routeDirectory}\n` +
      `changed-files: ${changedFiles.length}\n` +
      changedFiles.map((filePath) => `- ${filePath}\n`).join(''),
  );
}

initializeProject();
