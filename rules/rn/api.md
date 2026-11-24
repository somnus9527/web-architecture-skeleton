# API 与契约规则

## 目的

本文件描述 React Native 项目的 API client、endpoint wrapper、契约 DTO、错误处理与 mock 流程。

## API 层职责

`src/api/*` 是唯一允许：

- 调用 `fetch` 的位置。
- 拼接 API base URL 的位置。
- 抛 `ApiError` 的位置。

`src/api/*` 不允许：

- `import 'react-native'` 视图组件、`import 'react-native-paper'`。
- `import @components/*`。
- 读取 SecureStore / AsyncStorage（auth token 由 domain 层显式传入）。
- 含 UI fallback、含业务转换。

由 `src/test/architecture/layer-boundary.test.ts` 守护。

## 目录结构

```
src/api/
  client.ts           # requestJson / getJson / postJson / patchJson 等底层
  config.ts           # 读取 EXPO_PUBLIC_* 配置
  errors.ts           # ApiError 类
  logger.ts           # API 日志 + 敏感字段 redaction
  endpoints/
    <resource>.ts     # 每个 resource 一组 endpoint wrapper
```

## API Client

### 标准能力

`@api/client` 必须提供：

- `getJson<TResponse>(path, options?)`
- `postJson<TResponse>(path, body, options?)`
- `patchJson<TResponse>(path, body, options?)`
- `requestJson<TResponse>(path, { method, ...options })`（通用 helper）

模版见 `docs/rules/rn/templates/api-client.md`。

### 核心特性

- **text-first JSON 解析**：先 `response.text()` 再 `JSON.parse()`，避免空 body 触发解析异常；非法 JSON 抛 `ApiError`。
- **auth token 显式传入**：`options.authToken` 由调用方提供，API client 不读 storage。
- **统一 base URL**：从 `readApiConfig().apiBaseUrl` 读取，可被 `options.baseUrl` 覆盖（测试场景）。
- **fetch 可注入**：`options.fetchImpl` 用于测试；默认 `globalThis.fetch`。
- **错误归一**：所有错误（HTTP 非 2xx、网络、JSON 解析）统一抛 `ApiError`。
- **dev 日志**：通过 `@api/logger` 模块统一打印；详见 `docs/rules/rn/observability.md`。

### ApiError

```ts
export class ApiError extends Error {
  readonly status: number;        // HTTP 状态码；网络错误使用 0
  readonly data: ApiErrorData;    // 后端响应体或网络层诊断
  constructor(message: string, status: number, data?: ApiErrorData) { ... }
}
```

- 业务代码通过 `error instanceof ApiError` + `error.status` 区分处理。
- 4xx 客户端错误通常展示给用户；5xx 服务端错误归类为"请稍后重试"。

## Endpoint Wrapper

### 一个 API operation 一个 wrapper

每个后端 operation 对应一个 wrapper 函数，位于 `src/api/endpoints/<resource>.ts`：

```ts
// src/api/endpoints/<resource>.ts
import { getJson, type ApiHelperOptions } from '@api/client';
import { ApiError } from '@api/errors';
import type { ItemDetailResponse } from '@domain/contracts/<resource>';

export type ResourceEndpointOptions = ApiHelperOptions;

const ITEM_DETAIL_PATH = '/api/items';

/**
 * 读取条目详情。
 */
export async function getItemDetail(id: string, options: ResourceEndpointOptions = {}): Promise<ItemDetailResponse> {
  const envelope = await getJson<JavaApiEnvelope<ItemDetailResponse>>(`${ITEM_DETAIL_PATH}/${id}`, options);
  return unwrapEnvelope(envelope);
}
```

模版见 `docs/rules/rn/templates/endpoint-wrapper.md`。

### Envelope 处理

如果后端使用统一 envelope（`{ code, message, data }`），在 endpoint wrapper 中解包并处理 code 失败：

```ts
function unwrapEnvelope<TData>(envelope: JavaApiEnvelope<TData>): TData {
  if (envelope.code !== '0') {
    throw new ApiError(envelope.message, 200, envelope);
  }
  return envelope.data;
}
```

### Query 字段类型

endpoint wrapper 的 query 字段（locale、currency、filter 等）使用明确 type：

```ts
export type ItemListQuery = {
  locale?: string;
  keyword?: string;
  page?: number;
};
```

### Endpoint 测试

每个 endpoint 必须在 `src/test/api/endpoints/*` 中有 smoke 测试：

- 验证 path 拼接正确。
- 验证 envelope 解包逻辑。
- 验证错误归一（4xx / 5xx / 网络 / JSON 错误）。

## 契约 DTO

### 位置

后端 response shape 放在 `src/domain/contracts/<resource>.ts`：

```ts
// src/domain/contracts/<resource>.ts
export type ItemDetailResponse = {
  id: string;
  name: string;
  // ...
};
```

DTO 可使用 `type` 描述（这是 TypeScript 风格的豁免，详见 `docs/rules/rn/typescript.md`）。

### Adapter

后端 DTO 与前端业务模型之间的转换在 `src/domain/<area>.ts` 中：

```ts
// src/domain/<feature>.ts
export function buildItemDetailModel(
  payload: ItemDetailResponse,
  context: { locale: string },
): IItemDetailModel { ... }
```

- 前端业务模型使用 `interface I*`。
- Adapter 函数完成 fallback、本地化映射、价格转换等。

## 环境与配置

### Public 环境变量

仅 `EXPO_PUBLIC_*` 前缀的变量进入客户端 bundle；secrets 不允许使用此前缀。

必填变量：

- `EXPO_PUBLIC_APP_ENV`：`development` / `staging` / `test` / `production` / `mock`。
- `EXPO_PUBLIC_API_BASE_URL`：完整 URL。

可选变量：

- `EXPO_PUBLIC_ANALYTICS_ENABLED`：`1` / `true` / `yes` / `on` 视为 true，其他为 false。

### 配置读取

`@api/config` 的 `readApiConfig()` 是唯一允许读取 `process.env.EXPO_PUBLIC_*` 的位置；其他模块从 `readApiConfig()` 返回值消费。

- `EXPO_PUBLIC_APP_ENV` 或 `EXPO_PUBLIC_API_BASE_URL` 缺失时 throw，不使用源码 fallback。
- mock 环境的 base URL 也通过 `EXPO_PUBLIC_API_BASE_URL` 注入，不维护第二套 base URL。

详见 `docs/rules/rn/release.md`。

## Mock 流程

### Prism + OpenAPI

- `mock/openapi.yaml` 是 API operation 覆盖源。
- 每个由 endpoint 承接的 operation 必须在 `src/test/api/endpoints/*` 有聚焦 smoke 断言。
- 不承接或 backend gap 的 operation 必须在 parity map 中保留明确 reason。

### 本地启动

- 单跑 mock server：`pnpm run mock`（Prism 监听 127.0.0.1:8789）。
- App 连接本地 mock 验证：`pnpm run dev:mock`（脚本同时拉起 Prism 与 Expo，并把 `__LAN_IP__` 替换为本机 LAN IP，使物理设备可访问）。

## 完成检查

- API client 不读 storage；auth token 由调用方传入。
- 所有错误统一抛 `ApiError`。
- 每个 endpoint 一个 wrapper，path 集中常量；query 字段 type 明确。
- DTO 在 `src/domain/contracts/*`，adapter 在 `src/domain/<area>.ts`。
- 必填环境变量缺失时立即 throw，不使用源码 fallback。
- 业务代码与 UI 代码不出现 `fetch(` 或 `EXPO_PUBLIC_API_BASE_URL` 字面量。
