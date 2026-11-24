# Frontend Release Refresh

## 目标

- 同一发布包使用一个不可变 `releaseId`
- 旧标签页只在确认新版本稳定后整页刷新
- 页面隐藏时停止检查
- 多标签页同步已确认的新版本
- 请求失败或版本抖动时不刷新

## 构建契约

构建入口在 Vite build 前取得一次 release ID。Vite 将同一值：

- 注入 `import.meta.env.VITE_DEPLOYMENT_VERSION`
- 写入 `dist/version.json`

版本文件同时保存规范化后的 `basePath`。打包脚本必须校验两个字段存在。

## 客户端状态机

```text
当前 bundle releaseId
  -> 页面可见时每 60 秒请求 version.json
  -> 新版本则等待 4 秒
  -> 再次请求并确认相同 releaseId
  -> sessionStorage 记录目标版本
  -> BroadcastChannel 广播
  -> window.location.reload()
```

规则：

- 只在 production 挂载一个 VersionWatcher
- 使用递归 `setTimeout`，不使用重叠 `setInterval`
- 请求设置超时，组件卸载时取消
- `version.json` 必须 `no-store`
- 同一标签页对同一目标版本最多刷新一次
- 不支持 `BroadcastChannel` 时退化为各标签页独立检查

## 发布边界

`dist/index.html`、`version.json` 和 hash assets 必须来自同一次构建。
发布平台应整体部署 `dist/`，然后执行 `scripts/deploy.sh`。如果只能覆盖固定目录，
二次确认只能降低
新旧资源混合概率，不能宣称原子发布。

缓存：

- `index.html`：`no-store`
- `version.json`：`no-store`
- `assets/**`：一年 `immutable`

## 验证

- 单测覆盖版本请求与检测周期
- 构建日志输出 release ID
- `dist/version.json` 与 bundle 来自同一构建
- 公网 version 响应不缓存
- 保留旧标签页验证自动刷新
- 多标签页验证广播刷新
- 网络失败和版本变化中不产生刷新循环
