# Monorepo Template

pnpm workspace 架构骨架：只提供目录布局、catalog、根工具链与包边界校验，不含业务实现。

## 布局

```text
apps/
  example-app/        可运行应用（Vite + React），演示如何组合三个共享包
packages/
  types/              纯类型与契约：DTO、view model、状态联合类型
  tools/              运行时工具：src/shared 纯函数 + src/client 浏览器能力
  ui/                 跨应用 UI：src/client 组件，文案由 app 注入
scripts/
  check-workspace.mjs 包边界、catalog、聚合脚本校验
```

三个共享包是按规则的最小集合，不建空包。需要第四个包时，先在 README 说明为什么放不进
`types` / `tools` / `ui`。

## 命令

```bash
pnpm install
pnpm dev              # 启动 example-app
pnpm build            # 构建 example-app
pnpm check            # 聚合门禁：workspace + typecheck + lint + test + format
pnpm check:workspace  # 只跑边界校验
pnpm --filter @repo/tools typecheck   # 单包窄验证
```

## 边界

| 来源             | 允许依赖                                 | 禁止                                |
| ---------------- | ---------------------------------------- | ----------------------------------- |
| `apps/*`         | `@repo/types`、`@repo/tools`、`@repo/ui` | 相对路径跨包导入                    |
| `packages/ui`    | `@repo/types`                            | 依赖 app、调用 API、读 env          |
| `packages/tools` | `@repo/types`                            | 依赖 `@repo/ui` 或任何 app          |
| `packages/types` | 无 workspace 依赖                        | 运行时代码、React、Node-only helper |

`scripts/check-workspace.mjs` 会强制这些边界，并检查 catalog 是否被绕过。跨包导入必须写成
`@repo/<pkg>/<subpath>`，`no-restricted-imports` 会拦截 `../packages/*`。

## 版本策略

核心依赖（React、Vite、TypeScript、Vitest）统一放 `pnpm-workspace.yaml` 的 `catalog`，各包用
`catalog:` 引用。新增共享依赖先进 catalog，再在包里引用，否则 `check:workspace` 会报错。

## 版本钉住

`typescript-eslint` 固定在 `8.73.0`。更新的版本发布不足 24 小时，会被 pnpm 的供应链策略
（`minimumReleaseAge`）拒绝，导致 `pnpm install --frozen-lockfile` 报
「Lockfile failed supply-chain policy check」。等新版本满足时长后再放开。

## 不引入 Turbo

规则要求「两个以上信号才引入 Turbo」。当前模板只有 1 app + 3 package，`pnpm -r` 已足够；
真实项目达到多 app + 缓存需求时再引入，并同时补 `turbo.json` 与 CI 缓存策略。

## 复制方式

这是**参考模板**，不随 `skeletons/` 交付。新建 monorepo 时复制 `templates/monorepo/` 到新仓库根，
执行 `pnpm install`，再按真实业务新增 app 与共享包；`example-app` 用完后删除。
