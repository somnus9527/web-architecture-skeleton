# 注释规则

## 目的

本文件描述 React Native 项目手写代码的注释规则。

## 适用范围

适用于：

- `ts`、`tsx`、`js`、`mjs` 和脚本。
- 运行时接线、provider、store、请求 wrapper、生成器和工具代码。
- TSX 中的业务区块、条件区块、循环区块和关键交互节点。

通常不适用于：

- 第三方依赖代码。
- lock 文件、二进制资源、大多数 JSON / YAML 等纯数据文件。
- 当前不可控的生成产物。

如果生成器可控，应优先更新生成器，而不是反复手改生成结果。

## 语言

项目手写代码中的注释必须使用**简体中文**。

## 通用规则

- 函数、方法、class、类型和字段优先使用多行注释（JSDoc 风格），便于编辑器 hover 展示。
- 不得因为代码很短就省略应有注释。
- 注释必须解释**职责、业务含义、边界、输入输出或约束**。不要写"处理数据""设置值"这类低信息量注释。

## 函数与方法

每个函数和方法都应有注释。

### 简单函数

简要说明职责、返回结果或副作用：

```ts
/**
 * 规范化 base URL，避免后续拼接 endpoint path 时出现重复斜杠。
 *
 * @param value - 环境变量提供的 base URL。
 * @returns 去除末尾斜杠后的 base URL。
 */
function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}
```

### 复杂函数

更完整地说明功能、关键流程、参数、返回值，以及重要副作用或异常：

```ts
/**
 * 发起 JSON API 请求。该函数统一处理 base URL、JSON header、auth header、text-first
 * 解析、HTTP 错误和网络错误，是 endpoint wrapper 唯一应直接依赖的底层请求能力。
 *
 * @param path - endpoint path，通常来自后端 OpenAPI path。
 * @param options - 请求方法、鉴权 token 和测试注入项。
 * @returns 解析后的响应 JSON；空 body 返回 undefined。
 * @throws ApiError 当 HTTP 状态非 2xx 或网络层失败时。
 */
export async function requestJson<TResponse = unknown>(...): Promise<TResponse> { ... }
```

共享 hook、store、请求 wrapper、运行时接线、生成器、脚本和工具函数集合默认按复杂能力处理。

## 类型

interface、type alias、枚举型联合类型和类型字段在导出、共享、业务关键或不直观时应补充注释。

```ts
/**
 * API 错误响应数据，保留后端返回体或网络层诊断对象给上层判断。
 */
export type ApiErrorData = unknown;

/**
 * Feature store 状态和操作。
 */
export interface IFeatureStoreState {
  /**
   * 当前业务条目列表。
   */
  items: IFeatureItem[];
  /**
   * 是否已经尝试从 AsyncStorage 恢复过业务草稿。
   */
  hasHydrated: boolean;
}
```

- 字段注释应说明业务含义、格式、单位、默认值、允许值或可选条件。
- 不要只重复字段名。

## TSX 区块

以下位置上方应增加简短注释：

- 业务区块。
- 条件区块。
- 循环区块。
- 关键交互入口。
- 特殊 fallback、empty、loading 或 error 区域。

```tsx
{
  /* 列表标题复用 SectionHeader，和其它子页保持统一节奏。 */
}
<SectionHeader title={t('feature.title')} />;

{
  /* loading 期间替换按钮文案，避免用户误以为提交没有响应。 */
}
<Text>{loading ? loadingLabel : label}</Text>;
```

纯装饰性 wrapper 或显而易见的小片段不要滥加注释。

## 分支与兼容逻辑

以下逻辑需要补充注释：

- 状态机。
- 复杂条件。
- 平台兼容（`Platform.OS === 'ios'` 等分支）。
- 错误 fallback。
- locale fallback。
- API response 归一化。
- storage 或 analytics 边界行为。

## 不要写的注释

- 重复代码名称：`// 设置 name`、`// 调用 fetch`。
- 临时记录：`// TODO 待修`（无 owner、无 issue 链接）。
- 显而易见的注释：`// 返回 true`、`// 加 1`。
- 描述代码"做什么"而非"为什么"（功能由名字表达，注释说明意图）。

## 完成检查

交付前检查本次变更的手写文件：

- 函数 / 方法 / class 是否都有注释。
- 导出 / 共享 / 业务关键类型是否都有注释。
- 复杂分支是否有解释。
- 难以扫描的 TSX 业务区块是否有注释。
- 注释是否说明了真实业务含义，而不是只翻译代码名称。
