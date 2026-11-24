# TypeScript 规则

## 目的

本文件描述 React Native 项目使用的 TypeScript 命名、类型、import 与导出规则。

## 类型声明：interface vs type

### 默认使用 `interface I*`

适用：组件 props、hook 入参 / 返回值、UI 配置 shape、API client 请求选项、Store state、Provider context value 等所有**对象 shape**。

```ts
// 推荐
interface IButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
}
```

### 仅在以下场景使用 `type`

1. **Union 类型**：`type OrderStatus = 'paid' | 'pending' | 'cancelled'`
2. **Function 类型别名**：`type ApiFetch = (url: string, init: ApiFetchInit) => Promise<ApiFetchResponse>`
3. **派生类型**：`type FeatureItem = ReturnType<typeof buildFeatureItem>`、`type PartialUser = Pick<IUser, 'id' | 'name'>`、`type WithoutId<T> = Omit<T, 'id'>`
4. **字面量元组**：`type Coordinates = readonly [number, number]`
5. **Mapped types**：`type AsyncMap<T> = { [K in keyof T]: Promise<T[K]> }`

### 例外豁免

- **`src/domain/contracts/*` 中的 DTO**：贴近 OpenAPI response shape，集中维护，可保留 `type` 描述对象 shape，无需 `I` 前缀。

### 推荐 / 禁止例子

```ts
// 推荐：对象 shape 使用 interface I*。
interface IApiRequestOptions {
  method?: ApiMethod;
  token?: string;
}

// 禁止：普通对象 shape 不使用 type。
type ApiRequestOptions = {
  method?: ApiMethod;
  token?: string;
};
```

```ts
// 推荐：union 使用 type，且名称表达业务状态。
type OrderStatus = 'paid' | 'pending' | 'cancelled';

// 禁止：不为了前缀一致性给 union 加 I。
interface IOrderStatus {
  value: 'paid' | 'pending' | 'cancelled';
}
```

```ts
// 推荐：function type alias 保持 type。
type ApiFetch = (url: string, init: IApiFetchInit) => Promise<IApiFetchResponse>;

// 禁止：不把函数签名包装成只有一个方法的 interface。
interface IApiFetch {
  fetch(url: string, init: IApiFetchInit): Promise<IApiFetchResponse>;
}
```

## 命名规则

### Interface

- 必须使用 `I` 前缀 + 语义化 PascalCase 名称。
- 允许：`IEntitySummary`、`IFormSectionProps`、`IApiRequestOptions`、`IThemeTokens`。
- 避免弱语义名：`IData`、`IInfo`、`IProps`（无业务上下文）。

### Type alias

- 不强制 `T` 前缀；使用语义化 PascalCase 名称。
- 允许：`ApiMethod`、`FeatureItem`、`LocaleCode`、`EntityStatus`、`ExternalChannel`。

### 泛型参数

- 仅在角色明显时使用约定短名：`TResponse`、`TValue`、`TItem`、`TKey`。
- 多泛型时给出语义名：`<TResponse, TRequest>`、`<TItem, TKey extends string>`。

### 业务状态 / 编码 alias

- 状态、枚举型联合类型使用业务名而非通用前缀：`EntityStatus`、`ExternalChannel`、`AuditResult`、`KycLevel`。

### Field 命名

- camelCase；公开字段必须承载业务含义；导出类型与业务关键类型的字段需要注释说明含义、格式、单位、默认值。

## Import 规则

### 跨目录使用 alias

跨目录 import 必须使用 `tsconfig.json` 中声明的 path alias，禁止 `../../`：

| Alias           | 路径               |
| --------------- | ------------------ |
| `@app/*`        | `app/*`            |
| `@api/*`        | `src/api/*`        |
| `@components/*` | `src/components/*` |
| `@domain/*`     | `src/domain/*`     |
| `@storage/*`    | `src/storage/*`    |
| `@theme/*`      | `src/theme/*`      |
| `@test/*`       | `src/test/*`       |

```ts
// 推荐
import { useThemeTokens } from '@theme/theme-provider';
import { getJson } from '@api/client';

// 禁止
import { useThemeTokens } from '../../theme/theme-provider';
import { getJson } from '@/api/client';
```

### 同目录使用相对 import

同目录 import 必须使用 `./xxx`：

```ts
// 推荐
import { ItemDetailSection } from './item-detail-section';

// 禁止
import { ItemDetailSection } from '@components/<feature>/item-detail-section';
```

### 不允许冗余 alias

`tsconfig.json` 不允许同时声明 `@components/*` 与 `@/components/*` 两种风格。统一使用无斜杠版本 `@components/*`、`@api/*` 等；`@/*` 作为 `src/*` 的兜底入口可保留。

### Import type

类型导入使用 `import type` 或行内 `type`：

```ts
// 推荐
import type { IThemeTokens } from '@theme/theme-tokens';
import { useThemeTokens, type IThemeContextValue } from '@theme/theme-provider';
```

### Import 排序

ESLint `import/order` 规则强制：node 内置 → 第三方包 → `@xxx/*` → `./xxx`，组之间空行。

## 类型放置位置

- **组件私有 props interface**：放在组件文件顶部。
- **跨组件共享但限 feature 内**：放在 `<feature>/<screen>-screen.types.ts`。
- **共享 API / domain 类型**：放在 `src/api/*` / `src/domain/*` / `src/domain/contracts/*`。
- **测试 helper 类型**：放在 `src/test/*`，除非本身是生产契约。
- 大段类型声明不要长期堆在 screen 文件中；能迁移到同目录 `types.ts` 或 domain contract 时应迁移。

## 严格模式

- `tsconfig.json` 必须 `"strict": true`。
- 禁止 `any`（特殊场景如三方库类型缺失时局部 `// eslint-disable-next-line` + 注释原因）。
- 优先使用 `unknown` + 类型守卫替代 `any`。
- 禁止 `as` 类型断言绕过类型系统（特别是 `as Href`、`as never`、`as any`）；详见 `docs/rules/rn/routing.md`。

## 完成检查

交付前扫描本次变更的手写 TS / TSX / script 文件，确认：

- `interface` 没有漏掉 `I` 前缀。
- `type` 仅用于 union / function / 派生 / 字面量元组 / mapped types（DTO 豁免）。
- 没有弱语义名（`Data`、`Info`、`Props` 单独使用）。
- 跨目录 import 都使用 alias，同目录使用 `./`。
- 没有 `as` 强转绕过类型检查。
