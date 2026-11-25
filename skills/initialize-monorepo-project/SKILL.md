---
name: initialize-monorepo-project
description: 在骨架仓库内生成一个 pnpm workspace 项目，并按类型把 spa/ssr/rn 应用骨架装进 apps/<name>。用户要求新建 monorepo、或在 monorepo 里增加一个 SPA/SSR/RN 应用时使用。
metadata:
  short-description: 生成 monorepo 与其中各类型应用
---

# Monorepo 初始化

## 适用场景

- 用户要从零建一个 pnpm workspace，并明确里面有哪些应用及各自类型。
- 用户已有 monorepo，要再加一个应用（本技能只负责从零生成；追加应用见「边界」）。

monorepo 是多应用的组织方式，不是项目类型：每个应用仍是 `spa` / `ssr` / `rn` 之一，遵守该变体自己的规范。

## 执行方式

本技能**在骨架仓库内运行**，因为需要同时读取 `skeletons/monorepo` 与 `skeletons/<variant>`。

1. 先干跑确认参数：

   ```bash
   node skills/initialize-monorepo-project/scripts/initialize-monorepo-project.mjs \
     --id <project-id> --target <目标目录> --app spa:web --app ssr:site --dry-run
   ```

2. 正式生成（默认会执行 `pnpm install` 生成锁文件；加 `--no-install` 可跳过）：

   ```bash
   node skills/initialize-monorepo-project/scripts/initialize-monorepo-project.mjs \
     --id <project-id> --target <目标目录> --app spa:web --app ssr:site
   ```

3. 在目标目录验证：

   ```bash
   cd <目标目录>
   pnpm install
   pnpm check
   ```

## 生成结果

- 根：`pnpm-workspace.yaml`（含 catalog）、`package.json`、`tsconfig.base.json`、`eslint.config.mjs`、
  `.prettierrc.json`、`.prettierignore`、`.editorconfig`、`commitlint.config.cjs`、`.husky/`、CI、
  `scripts/check-workspace.mjs`、`docs/rules/`、`.agents/`。
- 每个 `--app <variant>:<name>`：`apps/<name>` 内是该变体的完整应用，包名与应用 ID 为
  `<project-id>-<name>`；`.github`、`.husky`、prettier/editorconfig、lockfile、README/AGENTS 等根级配置
  被剥离，`tsconfig*.json` 改为继承 `tsconfig.base.json`。
- `apps/example-app` 夹具被删除。

## 边界

- 只从零生成，不修改已存在的目录（目标非空即报错）。
- 不追加应用到已有 monorepo；追加时手工复制 `skeletons/<variant>` 到 `apps/<name>`，再跑该应用的
  `initialize-<variant>-project`，最后跑 `pnpm check:workspace` 确认继承与边界。
- 不猜测配套后端；应用一律以 `--no-backend` 初始化，后端绑定在应用内单独完成。
- 不自动拆分 `packages/*`：默认保留模板的 `types` / `tools` / `ui` 三个包，等真有第二个使用方再拆。
