# 前端骨架仓库

多技术栈前端骨架 + 规则单源 + 代码模板。取代原「每变体一个 git 分支」的做法：**变体由目录承载，
初始化不需要切分支，也不需要指定分支。**

## 结构

```text
skeletons/      工程级模板：复制一个目录即得到完整项目
  spa/          Vite + React SPA
  ssr/          Next.js SSR（BACKEND_MODE=bff-only）
rules/          规则单源，物化进各 skeleton 的 docs/rules/
  shared/       跨端共用
  frontend/     SPA / SSR 通用
  spa/ ssr/     变体专属与变体补段
  rn/           RN 规则，模板同层放在 rules/rn/templates/
templates/      文件级模板：单文件 / 单模块骨架（当前仅 frontend）
skills/         initialize-*、sync-architecture-rules、audit-derived-repo
tools/          check-repo-hygiene、verify-gates、materialize、audit
manifests/      每个变体消费的规则层、技能与门禁
docs/           本仓库自身的说明、迁移记录、ADR
```

`rules/`、`templates/`、`skills/`、`tools/`、`manifests/` 是源，只在这里编辑；RN 的代码模板刻意放在
`rules/rn/templates/`：规则里有 45 处引用它们，必须与规则一起交付，不能留在仓库级 `templates/`；
`skeletons/<variant>/docs/rules/` 与 `.agents/skills/` 是物化产物，由脚本生成，CI 校验一致。

## 使用方式

```bash
git clone <this-repo> skeleton
cp -R skeleton/skeletons/spa ../my-app
cd ../my-app
rm -rf .git
# 在本项目内运行 initialize-spa-project，完成身份绑定与门禁自检
```

## 迁移状态

| 项                                              | 状态                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `skeletons/spa`                                 | 已导入（120 文件），已通过 typecheck / lint / mock:check / test / format:check |
| `skeletons/ssr`                                 | 已导入（162 文件）                                                             |
| `skeletons/rn`                                  | 待建，种子为原 RN 规则与模板                                                   |
| `rules/` 抽取                                   | 未开始，当前规则仍是每个 skeleton 内的副本                                     |
| `templates/`                                    | 未开始                                                                         |
| `docs/rules/backend`、`docs/rules/next-backend` | 已按决策剔除，不再分发                                                         |

`skeletons/*/docs/rules/` 现在是物化产物，不要手改；改规则请改 `rules/` 后运行 `node tools/materialize.mjs`。

## 自检

仓库自身有两条检查，CI 会跑：

```bash
node tools/materialize.mjs && git diff --exit-code   # 物化产物与源一致
node tools/check-init-smoke.mjs                      # 两个变体能初始化且无死链
```

第一条防止有人手改 `skeletons/*/docs/rules`；第二条防止改文档时破坏初始化脚本的替换锚点——
这是改 AGENTS/README 时最容易踩的坑。
