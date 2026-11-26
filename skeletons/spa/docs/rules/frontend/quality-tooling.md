# Quality Tooling

> 标准 flat-config ESLint + Prettier + commitlint + husky + lint-staged 按行业标准生成。

新建前端项目默认 `pnpm`；生成脚本、lockfile 预期和脚手架下一步输出必须用 pnpm 命令。已有项目保持现有包管理器,除非用户明确批准迁移。

## 工具链版本(Node / pnpm)

Node 与 pnpm 的版本各自只有一个权威来源,不允许在 CI 里再写一份:

| 项   | 权威来源                                        | 取值                          |
| ---- | ----------------------------------------------- | ----------------------------- |
| Node | 仓库根 `.nvmrc` + `package.json` `engines.node` | 24(engines 写 `>=24.0.0 <25`) |
| pnpm | `package.json` `packageManager`                 | `pnpm@12.4.1`                 |

落地要求:

- 新机器、服务器、CI 一律通过 `bash scripts/install-toolchain.sh` 获取 pnpm；只校验版本用 `--check`。脚本从 `.nvmrc` 与 `packageManager` 读版本，装完再断言一次，版本不符就非零退出。
- 禁止 `npm i -g pnpm`、`npm i -g pnpm@latest`、`corepack prepare pnpm@latest` 这类不带精确版本的安装：npm 的 `latest` tag 会漂，2026-11 在测试服务器上实测装出过 pnpm 7。pnpm 7 不认识 `packageManager` 字段、也读不了新版锁文件，装错不会当场报错，而是等到构建或产物阶段才炸。
- 症状对照：锁文件版本/格式报错、依赖解析结果异常、`pnpm install` 行为与 CI 不一致时，先跑 `bash scripts/install-toolchain.sh --check` 排除版本问题，再查别的。
- CI 用 `actions/setup-node` 的 `node-version-file: .nvmrc` 读取版本,不得写死 `node-version: 24`。
- CI 用 `pnpm/action-setup` 的 `package_json_file`(monorepo 多应用时)或根 `packageManager` 读取 pnpm 版本,不得写死 `version:`。
- GitHub Action 自身必须跑在 node24 运行时: `actions/checkout`、`actions/setup-node` 不低于 `v5`,`pnpm/action-setup` 不低于 `v5`。低于该 major 会被 GitHub 强制降级并刷 Node 20 弃用告警。
- 升级 Node 或 pnpm 时,`.nvmrc`、`engines.node`、`packageManager` 三处同步改;任一处漂移都会被门禁拦下。
- monorepo 的 `.nvmrc` 只在 workspace 根保留,应用内不得留副本;应用 `engines.node` 必须与根 `.nvmrc` 主版本一致。

`node scripts/verify-gates.mjs` 会校验以上声明与 CI 配置一致,`node tools/check-toolchain.mjs` 在骨架仓库内一次校验全部变体与 workflow。

## Single App Versus Monorepo(配置放置策略)

工具链配置的放置位置是本文唯一的项目专属决策:

- 单应用项目把质量工具链配置放在应用根目录,直接服务当前 app。
- Monorepo 项目把基础配置放在 workspace 根目录,`apps/*` 与 `packages/*` 继承根配置后按框架、runtime、测试环境或发布目标扩展。
- 新建 monorepo 时,根目录应提供 ESLint、Prettier、Commitlint、EditorConfig、lint-staged、Husky、TypeScript base config 和聚合 `check` 脚本。
- `apps/*` 不应复制一套完全独立的 ESLint/Prettier/Commitlint/EditorConfig；如果目标 app 必须偏离根配置,应在 app 级配置中只覆盖差异,并在 handoff 中说明原因。
- 可以按需要增加 `packages/eslint-config`、`packages/tsconfig` 或 `configs/*` 承载共享配置；不要为了目录完整创建空配置包。
- Monorepo 的根 `check` 应聚合 lint、typecheck、format check 和必要 contract check；每个 app/package 仍应保留可单独执行的窄验证命令。
- 若引入 Turbo,handoff 必须说明为何需要 Turbo 以及哪些 task 被缓存。

## Architecture Boundaries

> 架构边界(`packages/*` 不依赖 `apps/*`、client 不依赖 server、shared 不引 runtime-only、跨包用包名 + `exports`、SSR/BFF server-only 不泄漏到浏览器入口)的权威定义见 [`./monorepo-workspace.md`](./monorepo-workspace.md),本文不重复。ESLint 在可行处用 import boundary 规则落地这些约束。

## Existing Projects

已有项目已有工具链时优先兼容。若 Husky、Commitlint、EditorConfig 或架构边界缺失,按改动范围决定直接补齐还是请用户批准更大范围的工具链迁移。

## 仓库门禁

骨架内置以下可执行门禁，派生项目不得删除：

| 命令                              | 作用                                                                            | 失败条件   |
| --------------------------------- | ------------------------------------------------------------------------------- | ---------- |
| `pnpm check:gates`                | 门禁自检：脚本、CI、husky、ESLint、架构测试、规则目录是否齐全                   | 缺任一项   |
| `pnpm check:hygiene`              | 仓库卫生：env 文件、变量白名单、私钥、二进制、体积、包管理器混用、疑似密钥      | 命中任一项 |
| `pnpm check:security`             | 安全：凭证存储（含 `userInfo.token` 等深层字段）、XSS sink、外链/消息、公开 env | 命中任一项 |
| `pnpm check:architecture`         | 架构测试：feature 隔离、shared 依赖、文件行数、hook 重复、UI 契约               | 命中任一项 |
| `pnpm check:changed`              | pre-push 增量检查：只跑本次变更影响到的 lint/架构测试/安全扫描                  | 命中任一项 |
| `pnpm env:init <dev\|test\|prod>` | 从 `.env.<env>.example` 生成本地 env                                            | 模板缺失   |

`quality:check` 已串联 `check:gates`、`check:hygiene`、`check:security` 与 `check:architecture`。
本地提交前由 pre-commit 运行 `check-staged.mjs --staged`（卫生 + 安全 + 后续 UI 分片）；commit-msg
先跑 commitlint，再按 staged 文件要求 `Security-Review` / `UI-Catalog` / `Dependency` 证据；pre-push
只跑 `check:changed.mjs` 的增量影响检查，不跑全量架构测试。CI 运行 `--tracked` 全量检查，是最终权威。

卫生阈值与白名单集中在项目根的 `.repo-hygiene.json`，按实际素材规模调整；`.env.example` 是公开配置契约，
新增变量先改契约再改本地文件。

## 测试覆盖率

覆盖率只卡**共享层**，不卡页面、路由壳与编排代码：那些位置卡比例只会逼出为了凑数的假测试，
而共享层是「一次写好、所有派生项目复用」的部分，约束收益最高。

| 变体    | 统计范围                                                              | 基线（statements / branches / functions / lines） |
| ------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| SPA/SSR | `src/shared/**/*.{ts,tsx}`                                            | 72 / 57 / 66 / 72（SSR 为 65 / 52 / 58 / 65）     |
| RN      | `src/api/**`、`src/domain/**`、`src/theme/**`、`src/components/ui/**` | 77 / 52 / 75 / 77                                 |

- 阈值取「实测值下浮 2 个点」：现状必过，新增共享代码不补测试就会先掉红；提高覆盖率后再同步抬高阈值。
- 执行入口是 `pnpm test:coverage`，已接进 `quality:check` 与 CI 的 Test 步骤；pre-push 的增量检查不带覆盖率，
  避免每次推送都多跑一遍全量统计。
- 覆盖率只证明「这行被执行过」，不证明断言有效；它不能替代 `check:architecture` 的静态边界检查。
