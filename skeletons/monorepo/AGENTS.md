# Monorepo AGENTS

## Always-on

- 门禁默认 Full：`pnpm check && pnpm build`。允许临时降档到 `pnpm verify:push`（Fast）或 `pnpm verify:push:changed`（Changed）；**只要本次实施降过档，交付前必须手动跑一次 `pnpm check && pnpm build` 并确认通过**。
- 本仓库是 pnpm workspace 组织骨架，不是业务应用本身。
- monorepo 只是多应用的组织方式：`apps/*` 下每个应用各自按类型遵守对应骨架的规范，workspace 层不覆盖应用变体规则。
- `packages/*` 只放真正跨应用复用的代码；没有第二个使用方前不要拆包。
- 工具链配置（`.editorconfig`、`.prettierrc.json`、`commitlint.config.cjs`、`.husky/`、`tsconfig.base.json`、`pnpm-lock.yaml`）只在仓库根维护，应用内不得保留副本。
- 跨包导入必须使用包名与 exports 子路径，禁止相对路径跨包。
- 核心依赖版本统一放 `pnpm-workspace.yaml` 的 `catalog`，应用内用 `catalog:` 引用。
- 构建、发布和验证统一使用 pnpm，不得引入 `package-lock.json`。
- `monorepo-app` 是待替换占位名。

## Routing

- 新增应用前，先确认应用类型（spa / ssr / rn），从骨架仓库取对应骨架，不要手工拼装。
- 修改 workspace 布局、catalog 或包边界前，读取 `docs/rules/frontend/monorepo-workspace.md`。
- 修改应用内配置前，先确认该项是否属于必须上提到根的配置（见 README「配置继承」）。
- 用户要求同步上游规范时，使用已安装的 `sync-architecture-rules` 技能；workspace 层同步只更新 `docs/rules/`，不会改动应用代码。

## Rule references

- 规范来源：`.agents/architecture-source.json`
- Workspace 规则：`docs/rules/frontend/monorepo-workspace.md`
- 共享规则：`docs/rules/shared/`
- 包边界校验：`scripts/check-workspace.mjs`
