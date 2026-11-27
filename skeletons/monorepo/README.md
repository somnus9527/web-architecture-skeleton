# Monorepo 骨架

pnpm workspace 组织骨架：只提供目录布局、catalog、根工具链与包边界校验，不含业务实现。

monorepo 是**多应用组织方式**，不是项目类型。`apps/*` 下的每个应用各自按类型取骨架
（`skeletons/spa`、`skeletons/ssr`、`skeletons/rn`）与对应规范；`packages/*` 只放真正跨应用复用的
代码，默认不预建空包。

## 布局

```text
apps/
  example-app/        可运行夹具：验证 workspace 边界，初始化时删除
packages/
  types/              纯类型与契约（空包，只有 exports 与 tsconfig）
  tools/              运行时工具（空包，按需补 src/shared、src/client）
  ui/                 跨应用 UI（空包，按需补 src/client 组件）
scripts/
  check-workspace.mjs 包边界、catalog、配置继承与聚合脚本校验
```

## 配置继承

工具链配置只在 workspace 根维护，应用内不保留副本：

| 配置                                     | 位置 | 应用侧                                |
| ---------------------------------------- | ---- | ------------------------------------- |
| `tsconfig.base.json`                     | 根   | `extends: '../../tsconfig.base.json'` |
| `.prettierrc.json` / `.prettierignore`   | 根   | 不保留，Prettier 自动向上查找         |
| `.editorconfig`                          | 根   | 不保留                                |
| `commitlint.config.cjs` / `.husky/`      | 根   | 不保留                                |
| `eslint.config.mjs`                      | 根   | 应用 `import` 后只追加自己的插件规则  |
| `pnpm-lock.yaml` / `pnpm-workspace.yaml` | 根   | 应用不保留                            |

`check:workspace` 会校验应用里没有根级配置副本、`tsconfig.json` 指向根基线、且 ESLint 配置确实
`import` 了根 `eslint.config.mjs`。

## 命令

```bash
pnpm install
pnpm dev              # 并行启动所有应用
pnpm build
pnpm check            # workspace + typecheck + lint + hygiene + test + format
pnpm check:workspace  # 只跑边界与继承校验
pnpm --filter @repo/tools typecheck   # 单包窄验证
```

## 边界

| 来源             | 允许依赖                                 | 禁止                                |
| ---------------- | ---------------------------------------- | ----------------------------------- |
| `apps/*`         | `@repo/types`、`@repo/tools`、`@repo/ui` | 相对路径跨包导入                    |
| `packages/ui`    | `@repo/types`                            | 依赖 app、调用 API、读 env          |
| `packages/tools` | `@repo/types`                            | 依赖 `@repo/ui` 或任何 app          |
| `packages/types` | 无 workspace 依赖                        | 运行时代码、React、Node-only helper |

## 新建真实 monorepo

在骨架仓库里运行组合初始化，不要手工复制：

```bash
node tools/scaffold.mjs --type monorepo --name acme --target ../acme --apps spa:web,ssr:site
```

它会复制本骨架、逐个把变体骨架装进 `apps/<name>`、剥离应用内的根级配置、按 catalog 改写依赖，
最后可选跑一次 `pnpm install`。
