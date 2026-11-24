---
name: initialize-rn-project
description: 初始化当前仓库的 Expo React Native 项目骨架。用户提供 kebab-case 项目名时使用；初始化器同步应用名、slug、URL scheme、i18n 标题、项目绑定与 AGENTS 状态。
metadata:
  short-description: 初始化 RN 项目身份
---

# RN 项目初始化

## 适用场景

仅用于从本仓库复制出来、尚未开始业务开发的 Expo RN 骨架。用户提供一个小写 kebab-case 项目名：

```text
帮我初始化这个 RN 项目，项目名称是 supply-chain
```

项目名不需要包含 `-app` 后缀，也不允许大写、空格、斜杠或下划线。

## 执行方式

1. 从用户输入中提取唯一项目名，拒绝空值、路径、空格、非 kebab-case 值。
2. 先执行 dry-run，确认仍是未初始化的 RN 骨架：

   ```bash
   node .agents/skills/initialize-rn-project/scripts/initialize-rn-project.mjs --dry-run <project-id>
   ```

3. dry-run 通过后执行实际模式：

   ```bash
   node .agents/skills/initialize-rn-project/scripts/initialize-rn-project.mjs <project-id>
   ```

4. 初始化完成后运行：

   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm format:check
   ```

5. 汇报项目名、派生值、修改文件与验证结果。不要伪造 API 地址、证书、签名或应用商店信息。

## 派生规则

输入为 `<project-id>` 时：

```text
package.json name = <project-id>
Expo name         = <Title Case>
Expo slug         = <project-id>
URL scheme        = <project-id 去掉连字符>
i18n app.title    = <Title Case>
```

## 边界

- 只在 `package.json` 仍为 `rn-app`、`app.json` 的 slug 仍为 `rn-app` 时执行。
- 已经初始化、部分初始化或输入不合法时停止并说明原因。
- 不修改 `EXPO_PUBLIC_*` 取值、依赖版本、`app.json` 的 version、证书与原生工程目录。
- 不使用全仓库无差别字符串替换；替换由脚本的明确文件清单完成。
