# monorepo

- 生成目录：`<target>`，根包名 `<id>`，应用包名 `<id>-<app>`。
- 子应用格式：`类型:名称`，类型限 `spa` / `ssr` / `rn`，名称 kebab-case 且唯一。
- 共享包固定 `packages/types`、`packages/tools`、`packages/ui`，初始化不增删。
- 应用一律按纯前端初始化；后端绑定在应用内单独完成。
- 检查入口：`pnpm check`（workspace 校验 + typecheck + lint + hygiene + test + format）。
- 生成的 `.agents/architecture-source.json` 记录仓库、tag、commit。
