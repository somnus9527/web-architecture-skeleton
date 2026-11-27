# Repo AGENTS

## Always-on

- 本仓库是前端骨架仓库自身：`skeletons/` 是交付物，`rules/`、`templates/`、`skills/`、`tools/`、
  `manifests/` 是源。生成的派生项目独立演进，改动不回写本仓库。
- 只改源：`skeletons/<变体>/docs/rules/` 与 `skeletons/<变体>/scripts/` 是 `tools/materialize.mjs`
  的产物，改了源必须重新物化；CI 用 `materialize` 后 `git diff --exit-code` 断言产物与源一致。
- 变体由目录承载，不用 git 分支；初始化只认语义化 tag，没有 tag 直接失败，不回退 `main`。
- 技能只有 `initialize-project` 与 `sync-architecture-rules`，源是仓库根 `skills/<name>/SKILL.md`；
  `skeletons/**` 里不放技能副本。
- 工具链单源：Node 24 写在各 skeleton 的 `.nvmrc`，pnpm 12.4.1 写在各 skeleton `package.json` 的
  `packageManager`；升级时 `.nvmrc`、`engines`/`packageManager` 与 `tools/check-toolchain.mjs` 的
  策略常量三处同步。
- 门禁脚本（`check-*.mjs`、`build.sh`、`deploy.sh`）的源在 `tools/project/scripts/`，不要直接改
  `skeletons/*/scripts/`——下一次物化会覆盖回去。
- 交付前跑完下面四条自检，并确认 `git status` 只剩预期改动。
- 文档只写当前约束与可复现的事实；某台机器、某次排查的一次性事故不写进 README 或规则。

## Routing

- 改架构规则：改 `rules/**`，再 `node tools/materialize.mjs`；规则清单见 `rules/README.md`。
- 改门禁脚本或发布脚本：改 `tools/project/scripts/**`，再物化。
- 改初始化交互、身份绑定或 tag 拉取：改 `tools/scaffold.mjs` 与 `tools/init/*.mjs`。
- 改技能：改 `skills/<name>/SKILL.md` 与其 `references/`；安装方式见 README「使用方式」。
- 改变体消费的规则层或门禁集合：改 `manifests/<变体>.json`，再物化。
- 改 CI：`.github/workflows/skeleton.yml` 跑仓库自检，`.github/workflows/quality.yml` 跑四变体
  质量矩阵。
- 记录一次性改造：`docs/plans/`；规则一致性与归因审计：`docs/audit/`。

## 自检

```bash
node tools/materialize.mjs && git diff --exit-code   # 物化产物与源一致
node tools/check-doc-links.mjs                       # 文档不引用仓库外/不存在的文件
node tools/check-toolchain.mjs                       # Node/pnpm 版本与 Action 运行时一致
node tools/check-init-smoke.mjs                      # 四个变体能初始化且通过门禁自检
```

## Rule references

- 仓库结构与当前状态：[README.md](./README.md)
- 规则单源：[rules/README.md](./rules/README.md)
- 质量工具链口径：[rules/frontend/quality-tooling.md](./rules/frontend/quality-tooling.md)
- 技能安装与脚手架改造：[docs/plans/2026-11-27-skill-install-and-scaffold.md](./docs/plans/2026-11-27-skill-install-and-scaffold.md)
- 迁移记录与已知遗留：[docs/migration.md](./docs/migration.md)
