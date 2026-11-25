# 前端骨架仓库

多技术栈前端骨架 + 规则单源 + 代码模板。取代原「每变体一个 git 分支」的做法：**变体由目录承载，
初始化不需要切分支，也不需要指定分支。**

## 结构

```text
skeletons/      工程级模板：复制一个目录即得到完整项目
  spa/          Vite + React SPA
  ssr/          Next.js SSR/BFF（固定 BFF-only）
  rn/           Expo + expo-router 最小可运行工程
rules/          规则单源，物化进各 skeleton 的 docs/rules/
  shared/       跨端共用
  frontend/     SPA / SSR 通用
  spa/ ssr/     变体专属与变体补段
  rn/           RN 规则，模板同层放在 rules/rn/templates/
templates/      文件级模板：单文件 / 单模块骨架
  frontend/     业务模块参考模板
  monorepo/     pnpm workspace 架构骨架（含边界校验）
skills/         initialize-{spa,ssr,rn}-project、sync-architecture-rules
tools/          materialize、check-init-smoke、check-doc-links、project/
manifests/      每个变体消费的规则层、技能与门禁
docs/           本仓库自身的迁移记录、规则归因与审计
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

## 当前状态

| 项                     | 状态                                                      |
| ---------------------- | --------------------------------------------------------- |
| `skeletons/spa`        | 完整可运行，初始化后通过 `quality:check`                  |
| `skeletons/ssr`        | 完整可运行，固定 BFF-only，不提供 `next-backend`          |
| `skeletons/rn`         | 完整可运行，规则与骨架对齐中                              |
| `rules/`               | 已经抽取为单源，54 份共用/变体规则 + RN 30 份 + 19 份模板 |
| `templates/`           | `frontend/` 与 `monorepo/` 已落地                         |
| backend / next-backend | 不再分发；文档不再引用仓库外文件                          |

`skeletons/*/docs/rules/` 是物化产物，不要手改；改规则请改 `rules/` 后运行 `node tools/materialize.mjs`。

## 自检

仓库自身有三条纯 Node 检查，`.github/workflows/skeleton.yml` 会跑；
`.github/workflows/quality.yml` 另外对三个 skeleton 跑完整 `pnpm quality:check`：

```bash
node tools/materialize.mjs && git diff --exit-code   # 物化产物与源一致
node tools/check-doc-links.mjs                       # 文档不引用仓库外/不存在的文件
node tools/check-init-smoke.mjs                      # 三个变体能初始化且通过门禁自检
```

第一条防止有人手改 `skeletons/*/docs/rules`；第二条防止跨仓库/跨变体死链；第三条防止改文档时破坏
初始化脚本的替换锚点，这是改 AGENTS/README 时最容易踩的坑。质量矩阵会安装依赖、生成生产 env
并执行 `check:gates → typecheck → lint → hygiene → test → format → build`。
