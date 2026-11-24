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

## 已知遗留

1. **规则尚未抽取**：`skeletons/*/docs/rules/` 仍是各自副本，两变体间的 44 处分叉尚未合并。抽取后
   `docs/rules/` 将由 `rules/` 物化生成。
2. **断链待修**：以下文件仍引用已删除的 `docs/rules/backend` 或 `docs/rules/next-backend`：
   `AGENTS.md`、`README.md`、`docs/rules/README.md`、`docs/initialization/*.md`、`docs/deployment/*.md`、
   `.agents/architecture-rules-lock.json`、`.agents/skills/initialize-*/scripts/*.mjs`。
   规则抽取与技能上提时一并修复。
3. **技能仍在 skeleton 内**：`initialize-spa-project`、`initialize-ssr-project`、`sync-architecture-rules`
   尚未上提到仓库根的 `skills/`。
4. **RN 骨架不存在**：本机无 RN / Expo 工程，`skeletons/rn` 需按原 RN 规则与模板新建。
