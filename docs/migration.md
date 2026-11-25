# 迁移记录

- 日期：2026-11-24
- 来源仓库：`/Users/somnuszyy9527/workspace/dealkeys/web-architecture-skeleton`（原前端骨架仓库）
- 目标仓库：本仓库
- 方式：`git archive <branch> | tar -x`，只取文件树，不迁移 git 历史；原仓库保留为只读归档

## 已导入

| 变体            | 来源分支               | 来源 commit                  | 导入文件数    | 剔除                                                         |
| --------------- | ---------------------- | ---------------------------- | ------------- | ------------------------------------------------------------ |
| `skeletons/spa` | `feature/spa-skeleton` | `096517f43379`（2026-10-12） | 140 → **120** | `docs/rules/backend/`（20 文件）                             |
| `skeletons/ssr` | `feature/ssr-skeleton` | `b8b26c660f00`（2026-10-13） | 190 → **162** | `docs/rules/backend/`（20）+ `docs/rules/next-backend/`（8） |

剔除依据：`next-backend` 是 SSR 应用的运行期开关而非独立工程；`rules/backend` 无有效消费方。
两者均不再分发。

## 可复制性验证

在临时目录对导入结果做全新安装并跑门禁，不依赖原仓库的 `node_modules`（原仓库的依赖已残缺，缺 `vite` 等）。

| 变体  | 安装                                 | typecheck | lint | mock:check | test | format:check |
| ----- | ------------------------------------ | --------- | ---- | ---------- | ---- | ------------ |
| `spa` | 通过（pnpm，48s）                    | 通过      | 通过 | 通过       | 通过 | 通过         |
| `ssr` | 通过（pnpm `--ignore-scripts`，84s） | 通过      | 通过 | 通过       | 通过 | 通过         |

`ssr` 首次安装时 Next.js 的 postinstall 会长时间无输出，改用 `--ignore-scripts` 后 84 秒完成；
静态门禁不依赖 postinstall 产物，因此不影响上述结论。真实构建仍需一次带脚本的完整安装。

## 治理批次完成情况

| 批次 | 内容                                                                                           | 状态 |
| ---- | ---------------------------------------------------------------------------------------------- | ---- |
| 1    | 卫生门禁：`check:hygiene`、`check:gates`、`env:init`、pre-commit 与 CI                         | 完成 |
| 2    | 共享 hook：`useRequest`、`useAsyncAction`、`useDebouncedValue`、`useDisclosure`                | 完成 |
| 3    | 共享 UI：7 个原语 + design-tokens，SSR 的 `shared/ui` 已并入 `components/ui` 与 `shared/theme` | 完成 |
| 4    | 架构测试：文件分级、shared 独立、feature 隔离、hook 重复、清单一致性、例外清单                 | 完成 |
| 5    | 文档收口：ADR-001、索引必读分组、共享文档物化                                                  | 完成 |

最终验收：`spa` 变体在全新安装下通过完整 `pnpm quality:check`（含 `build:prod`）。

## 已知遗留

1. **RN 原生工程未生成**：`android/` 与 `ios/` 需要在上架或原生定制时再 `expo prebuild`。
2. **RN 规则与骨架正在对齐**：alias、Paper 边界、API 层、env 初始化与架构测试按 `rules/rn/` 补齐；
   未完成的项在 RN README 的待办中列出。
3. **CI 分两层**：`skeleton.yml` 跑 materialize、文档链接、初始化冒烟与 monorepo 边界；
   `quality.yml` 对三个 skeleton 安装依赖并跑完整 `quality:check`。
4. **SPA 演示会话使用 Bearer + localStorage**：这是 `frontend-security.md` Bearer 例外的演示实现，
   正式项目应优先 HttpOnly cookie 并在 ADR 记录取舍。

已完成：规则抽取为单源、技能上提、RN 骨架建立、`docs/rules/backend` 与 `next-backend` 移除、
物化索引恢复必读分组。
