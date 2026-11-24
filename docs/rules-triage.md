# 规则归因表（步骤 3）

- 日期：2026-11-24
- 输入：`skeletons/spa/docs/rules/**`、`skeletons/ssr/docs/rules/**`（已剔除 backend / next-backend）
- 输出：`rules/<layer>/**` 单源，供 `tools/materialize.mjs` 生成各 skeleton 的 `docs/rules/`

## 0. 盘点

| 项                 | 数量 |
| ------------------ | ---- |
| 两个 skeleton 共有 | 25   |
| 其中完全一致       | 7    |
| 其中分叉           | 18   |
| 仅 SPA             | 2    |
| 仅 SSR             | 15   |

18 个分叉中，**8 个只是 `mocks/` 与 `mock/` 的目录名差**（归一化后差异 ≤3 行）。真实内容差异集中在 4 份文档。

## 1. 归因结论

四类处置：

- **common**：合并成一份，进 `rules/shared/` 或 `rules/frontend/`。
- **common + 补段**：通用正文进 common，变体额外要求进 `rules/<variant>/<topic>-variant.md`，物化时追加到正文末尾。
- **variant**：整份只属于一个变体，进 `rules/spa/` 或 `rules/ssr/`。
- **generated**：索引类文件由物化脚本按层生成，不手写。

### 1.1 完全一致（7）

| 文件                                     | 处置                     |
| ---------------------------------------- | ------------------------ |
| `frontend/frontend-architecture.md`      | common                   |
| `frontend/i18n.md`                       | common                   |
| `frontend/quality-tooling.md`            | common（后续补门禁清单） |
| `frontend/responsive-and-breakpoints.md` | common                   |
| `frontend/tailwind-v4-system.md`         | common                   |
| `shared/comments.md`                     | common                   |
| `shared/typescript.md`                   | common                   |

### 1.2 分叉（18）

| 文件                                   | 归一化后差异 | 处置          | 说明                                                        |
| -------------------------------------- | ------------ | ------------- | ----------------------------------------------------------- |
| `shared/module-documentation.md`       | 0            | common + 占位 | 仅 `{{mockDir}}`                                            |
| `shared/project-rule-capture.md`       | 2            | common        | 「React SPA」→「React SPA / SSR」                           |
| `shared/team-collaboration.md`         | 3            | common        | 补 BFF owner 行                                             |
| `frontend/animation.md`                | 5            | common + 补段 | SPA 版为基；SSR 的 `ssr-cache-and-performance` 链接入补段   |
| `frontend/store.md`                    | 6            | common        | 取 SPA 版（含完整凭证存储条款，SSR 版是旧文案）             |
| `frontend/ui-style-and-components.md`  | 6            | common        | 取 SSR 版，去掉产品词（离职/兑换中）                        |
| `frontend/frontend-react.md`           | 9            | common        | pnpm 条款与 Snackbar 细节取 SSR 版                          |
| `frontend/monorepo-workspace.md`       | 9            | common + 占位 | `{{mockDir}}`；SSR/BFF 措辞合并                             |
| `shared/intake-and-delivery.md`        | 16           | common + 占位 | `{{mockDir}}`                                               |
| `frontend/delivery-verification.md`    | 23           | common + 补段 | 进程清理条款通用；环境/认证条款入双变体                     |
| `frontend/mock-and-integration.md`     | 25           | common + 补段 | Vite 取值入 SPA 补段；gateway 指针入 SSR 补段               |
| `frontend/api-contracts.md`            | 34           | common + 补段 | 保留 demo 端点豁免；BFF 路由前缀入 SSR 补段                 |
| `frontend/frontend-security.md`        | 146          | 拆分          | 通用红线 common；SSR/BFF 攻击面与 SPA 发布安全分入变体      |
| `frontend/environments-and-build.md`   | 199          | 拆分          | 环境模型与 fail-fast 通用；`### 3.1/3.2` 与构建产物分入变体 |
| `frontend/frontend-release-refresh.md` | 262          | 拆分          | 目标/状态机/发布边界通用；Next 与 Vite 实现分入变体         |
| `shared/project-naming.md`             | 107          | 拆分          | 命名与占位符规则通用；派生值表分入变体                      |
| `README.md`（rules 索引）              | 91           | generated     | 按 manifest 的层列表生成                                    |
| `frontend/README.md`（索引）           | 46           | generated     | 同上                                                        |

### 1.3 仅 SPA（2）

`frontend/spa-project-baseline.md`、`frontend/spa-verification.md` → `rules/spa/`。

### 1.4 仅 SSR（15）

13 份 `ssr-*.md` + `seo.md` + `next-app-router-mui-provider.md` → `rules/ssr/`。

## 2. 已产出

| 层                | 文件数 | 内容                                                                                                                                       |
| ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `rules/shared/`   | 7      | comments、typescript、module-documentation、project-rule-capture、team-collaboration、intake-and-delivery、project-naming                  |
| `rules/frontend/` | 16     | 7 份一致 + 9 份合并（animation、store、ui-style、frontend-react、monorepo、api-contracts、mock-and-integration、delivery-verification 等） |
| `rules/spa/`      | 8      | 2 份变体专属 + 6 份变体补段                                                                                                                |
| `rules/ssr/`      | 22     | 15 份变体专属 + 7 份变体补段                                                                                                               |

两条内容修正：

- `frontend-security.md` 原 SSR 版末尾的「本工程现状与待办」属于项目状态，不属于规则，已删除。
- `project-naming` 仍保留 `--backend-root` 与 `initialize-backend-project` 的描述。按 D7 已不再分发
  backend 规则，这些表述需要在技能上提时一并清理（**待办**）。

## 3. 物化机制

`tools/materialize.mjs` 对每个变体做三件事：

1. **拼接**：`rules/<shared-layer>/<topic>.md` + `rules/<variant>/<topic>-variant.md`（若存在）→
   `skeletons/<variant>/docs/rules/<layer>/<topic>.md`，补段加固定标题 `## <variant> 变体要求`。
2. **占位替换**：`{{mockDir}}` → `mocks`（spa）/ `mock`（ssr）。
3. **生成索引**：`docs/rules/README.md` 与 `docs/rules/frontend/README.md` 由 manifest 的层列表生成，
   标题与顺序固定，不手写。

这样「一份正文 + 每变体一段补遗」既避免了整份复制，也避免了在正文中间做切分手术。

## 4. 执行顺序

1. 建立 `rules/{shared,frontend,spa,ssr}/`，先落 7 份一致文件与 17 份变体专属文件。
2. 合并 9 份小差异（1.2 前 9 行）。
3. 拆分 4 份大差异。
4. 写 `tools/materialize.mjs`，生成索引与占位替换。
5. 用物化结果覆盖 `skeletons/*/docs/rules/`，跑门禁确认无回归。

第 5 步之前，`skeletons/*/docs/rules/` 保持原样，避免迁移中间态无法构建。
