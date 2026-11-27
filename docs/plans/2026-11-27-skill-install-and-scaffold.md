# 技能安装与脚手架改造

- 日期：2026-11-27
- 状态：已实施
- 范围：`skills/`、`tools/scaffold.mjs`、`tools/init/`、`manifests/`、`skeletons/*`、`tools/check-init-smoke.mjs`

## 1. 目标

把初始化从“克隆整个仓库后就地改名”改成“装一个技能，从远程 tag 生成新项目”，并让仓库只暴露两个技能。

## 2. 关键决策

| 项         | 决定                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| 暴露技能   | 只有 `initialize-project`（spa/ssr/rn/monorepo 统一入口）与 `sync-architecture-rules`                      |
| 模板来源   | 远程仓库最新语义化 tag；无 tag 直接失败，不回退 main                                                       |
| 安装方式   | `ov skills add <repo> --skill initialize-project --skill sync-architecture-rules`；不引入自定义 npx 安装器 |
| 单应用后端 | 初始化不问，默认 `--no-backend`；后端绑定是后续独立动作                                                    |
| monorepo   | 先问子应用数量（1–6），再按 `类型:名称` 结构化填写；共享包固定 `types` / `tools` / `ui`                    |
| 目标目录   | 默认 `./<name>`，允许绝对路径；必须不存在或为空                                                            |
| 检查失败   | 初始化成功与检查失败分开：退出码 2 表示项目已生成但 `quality:check` 未通过                                 |
| 失败处理   | 保留目标目录供排查；临时目录与半成品目录清理                                                               |

## 3. 最终结构

```text
skills/
  initialize-project/SKILL.md + references/{spa,ssr,rn,monorepo}.md
  sync-architecture-rules/SKILL.md
tools/
  scaffold.mjs        # 取 tag、clone、复制、绑定、git init、install、全量检查
  init/{spa,ssr,rn,monorepo}.mjs   # 身份绑定，支持 --root
  sync-rules.mjs      # 规则同步，支持 --root
```

生成的项目里不再有 `.agents/skills/`；技能由用户单独安装，不在项目里存副本。

## 4. 使用

```bash
# 安装两个技能
ov skills add <repo> --skill initialize-project --skill sync-architecture-rules

# 技能内部执行（也可直接调用）
git clone --depth 1 --branch <tag> <repo> /tmp/wa
node /tmp/wa/tools/scaffold.mjs --type monorepo --name acme --target ../acme \
  --apps spa:web,ssr:site --source /tmp/wa --repo <repo> --ref <tag>
```

维护者本地调试用 `--source <本仓库>`，跳过远程拉取。

## 5. 本次移除

- 4 个旧技能目录（`initialize-{spa,ssr,rn,monorepo}-project`）。
- `skeletons/*/.agents/skills/` 全部副本。
- `manifests/*.json` 的 `skills` 字段。
- 初始化脚本里“移除 AGENTS 初始化指引”的逻辑（指引本身已删）。

## 6. 验证

- `node tools/check-init-smoke.mjs`：spa / ssr / rn / monorepo 四端通过，并断言生成物不再带 `.agents/skills`。
- 在 `/tmp/e2e-app` 实跑 `scaffold --type spa`：`pnpm install` + `pnpm quality:check` 全绿。
- 远程模式需仓库存在 tag；首个 tag 为 `v1.0.0`。

## 7. 注意

- 已生成的派生项目不会自动变干净，旧技能副本留在各自仓库里，本次不回填。
- `sync-architecture-rules` 依赖项目 `.agents/architecture-source.json`；缺失时停止并要求显式 `--repo`/`--ref`。
