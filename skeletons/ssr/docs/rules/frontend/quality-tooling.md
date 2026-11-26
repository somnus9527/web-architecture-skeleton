# Quality Tooling

> 标准 flat-config ESLint + Prettier + commitlint + husky + lint-staged 按行业标准生成。

新建前端项目默认 `pnpm`；生成脚本、lockfile 预期和脚手架下一步输出必须用 pnpm 命令。已有项目保持现有包管理器,除非用户明确批准迁移。

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
