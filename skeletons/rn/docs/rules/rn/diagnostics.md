# 本地诊断与日志上传规则

## 目的

在未引入 APM SDK（Sentry / Bugsnag 等）的阶段，本规则定义"用户报告问题时如何拿到现场信息"的最小可用方案：本地日志持久化 + 用户主动触发上传到后端。

## 适用范围

- 应用未接入 APM SDK 期间作为兜底诊断手段。
- APM SDK 接入后，本地诊断可保留作为补充（用户主动反馈、APM 未捕获的非崩溃问题）。

## 总体设计

```
business code
  └─ logger.warn / logger.error        →  控制台输出（已有，详见 docs/rules/rn/observability.md）
                                          ↓ buffer
                                          ↓ throttled flush
                                          本地日志文件（rotating, FileSystem）

settings → "发送诊断信息"
  └─ 用户填问题描述
       ↓
       collect: 日志文件 + breadcrumb + device info
       ↓
       上传到后端 endpoint
       ↓
       询问用户是否清空本地日志
```

## 依赖

- `expo-file-system`（最新稳定版）：跨平台读写本地文件。
- `expo-application`（最新稳定版）：读取 app version、build number。
- `expo-device`（最新稳定版）：读取 device model、OS version。

业务代码不直接 import 这三个包；通过 `@domain/diagnostics/*` 暴露的能力消费。

## 模块组织

```
src/domain/diagnostics/
  log-file.ts                # 日志文件读写 + rotation
  breadcrumbs.ts             # screen 切换、API 调用、用户操作 breadcrumb
  device-info.ts             # 收集 platform / version / locale 等
  diagnostics-store.ts       # zustand store：当前 breadcrumb 队列、上传状态
  upload.ts                  # 调 endpoint 上传
  types.ts
```

## 本地日志文件

### 文件位置

```ts
import * as FileSystem from 'expo-file-system';

const LOG_DIR = `${FileSystem.documentDirectory}diagnostics/`;
const LOG_FILE_PRIMARY = `${LOG_DIR}app.log`;
const LOG_FILE_ROTATED_PREFIX = `${LOG_DIR}app.log.`; // .1 / .2
```

### 文件格式

JSONL（每行一个 JSON 对象）：

```jsonl
{"ts":"2026-06-05T12:34:56.789Z","level":"warn","event":"api_error","payload":{"method":"GET","url":"...","status":500}}
{"ts":"2026-06-05T12:34:57.123Z","level":"info","event":"screen_view","payload":{"name":"feature-detail"}}
```

- 字段：`ts`（ISO 时间）、`level`（debug/info/warn/error）、`event`（事件名）、`payload`（已 redact）。
- 一行一个 entry，便于流式解析与 `tail -f` 调试。

### Rotation 策略

- 单文件上限 **1 MB**；超出后 rename 为 `app.log.1`，新建 `app.log`。
- 历史文件最多保留 **2 份**（`app.log.1` + `app.log.2`）；新轮转时删除最旧。
- 总占用上限约 **3 MB**。
- 上传时打包 `app.log` + `app.log.1` + `app.log.2`。

### 写入策略

- 内存 buffer（数组），每 **50 条** 或 **5 秒** 触发一次 flush 写文件。
- `logger.error` 立即 flush（不等 buffer 满）。
- 写入失败（磁盘满、权限）不 throw，记录一次内存 marker 然后忽略。

### Redaction

日志写文件前**复用 `@api/logger` 的 redaction 链路**，确保 token / 邮箱 / 密码等敏感字段被替换。详见 `docs/rules/rn/observability.md`。

## Breadcrumbs

### 类别

| 类别        | 来源                       | 示例                                                                              |
| ----------- | -------------------------- | --------------------------------------------------------------------------------- |
| `nav`       | route change               | `{ type: 'nav', path: '/<feature>/items' }`                                       |
| `api`       | API client request         | `{ type: 'api', method: 'GET', url: '/api/items', status: 200, durationMs: 234 }` |
| `action`    | 用户关键交互               | `{ type: 'action', name: 'primary_action', payload: { ... } }`                    |
| `error`     | catch 到的异常             | `{ type: 'error', message: '...', source: '...' }`                                |
| `lifecycle` | 启动 / 进入后台 / 网络切换 | `{ type: 'lifecycle', state: 'background' }`                                      |

### 存储

- 内存环形 buffer：最多保留 **100 条**。
- 不持久化到文件（除非配合日志一起上传时）。
- 应用关闭后清空。

### 集成点

- **API client**：在 `requestJson` 内调 `breadcrumbs.push({ type: 'api', ... })`。
- **Navigation**：在 `app/_layout.tsx` 的 router listener 中（或 `expo-router` 的 navigation event）。
- **关键 action**：业务侧手动调（如 `primary_action`、`form_submit`、`external_handoff`）。
- **Lifecycle**：在 `AppState` listener 中。

## Device Info

```ts
export interface IDeviceInfo {
  platform: 'ios' | 'android' | 'web';
  osVersion: string;
  deviceModel: string;
  appVersion: string; // 1.2.3
  buildNumber: string; // 12
  locale: string;
  timezone: string;
  freeDiskMb?: number;
  totalMemoryMb?: number;
  isConnected: boolean;
  networkType: 'wifi' | 'cellular' | 'none' | 'unknown';
}
```

通过 `@domain/diagnostics/device-info.ts` 一次性收集。

## 上传流程

### 用户入口

设置页 → "发送诊断信息"：

1. 解释收集内容（本次操作前一段时间的日志、breadcrumb、设备信息）。
2. 用户填写"问题描述"文本框（必填）。
3. "可选：联系邮箱"输入框。
4. 显示"将上传以下文件大小：X MB"。
5. 用户勾选"我同意上传"复选框后 "发送" 按钮可点击。
6. 上传中显示 loading；成功后 toast "已发送，感谢反馈"。
7. 询问"是否清空本地日志？"（默认 No，避免影响后续问题）。

### Endpoint 契约

```
POST /api/diagnostics/upload
Content-Type: multipart/form-data

fields:
  description: string (用户问题描述)
  contactEmail?: string
  deviceInfo: JSON string
  breadcrumbs: JSON string
  appVersion: string
  buildNumber: string
  uploadedAt: ISO timestamp

files:
  logs: 一个或多个 .log 文件
```

返回：

```json
{
  "code": "0",
  "data": {
    "ticketId": "diag-2026-xxx" // 给用户展示 ticket 号便于沟通
  }
}
```

### 隐私

- 上传是**用户主动 opt-in**；不自动上传。
- 上传内容包含已 redact 的日志；敏感字段不应出现。
- 用户登录账号关联到 ticket（便于支持团队溯源）；匿名用户使用临时 ID。
- 隐私政策中明确"诊断上传"的内容与用途。

### 上传失败处理

- 网络失败 → toast 提示重试。
- 后端返回 4xx → toast 显示错误文案。
- 不重试自动上传；用户自行决定再次发送。

## 何时触发自动收集

以下场景**自动添加 breadcrumb**（不上传）：

- 应用启动。
- 应用进入后台 / 前台。
- 网络状态变化。
- ErrorBoundary 捕获崩溃。
- API 请求 4xx / 5xx / 网络失败。
- 关键业务动作（primary action、form submit、external handoff）。

以下场景**不自动收集**：

- 敏感操作（输入密码、读取剪贴板内容）—— 这些可能含敏感字段，不收集。
- 高频低价值事件（鼠标 / 触摸坐标、每次 scroll）。

## 调试场景

### Dev 环境

dev 模式下可通过 hidden gesture（如左上角连点 5 下）打开诊断面板：

- 实时查看 breadcrumb 队列。
- 查看当前日志文件大小。
- 一键导出日志到剪贴板或分享面板。

### 测试

- `log-file.test.ts`：覆盖 rotation、buffer flush、redaction 复用。
- `breadcrumbs.test.ts`：覆盖环形 buffer、最大长度、不同类别。
- `upload.test.ts`：覆盖 multipart 构造、4xx / 网络失败处理、成功后清空。

## 与 APM SDK 衔接（未来）

接入 APM SDK 后：

- 本地诊断**保留**：用户主动反馈仍走本地上传通道。
- breadcrumb 同时派发到 APM SDK（如 Sentry `addBreadcrumb`）。
- `logger.error` 同时上报 APM（已通过 `setErrorReporter` 实现，详见 `docs/rules/rn/observability.md`）。
- 不重复实现：APM 自动捕获崩溃；本地 ErrorBoundary 也调 APM `captureException`。

## 完成检查

- `@api/logger` 集成本地文件写入；`warn` / `error` 同时进 console、本地文件、APM reporter（如有）。
- 日志文件按 1 MB × 3 份轮转；总占用 ≤ 3 MB。
- Breadcrumb 环形 buffer ≤ 100 条；不持久化。
- 设置页有"发送诊断信息"入口；用户主动 opt-in。
- 上传内容已 redact；不含 token / 邮箱 / 密码。
- 上传 endpoint 契约与后端对齐。
- 隐私政策中描述"诊断上传"的内容与用途。
