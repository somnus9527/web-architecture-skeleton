# 路由与导航规则

## 目的

本文件描述 Expo Router 路由文件组织、导航跳转类型安全与 deep link 处理规则。

## 文件组织

- 路由文件位于 `app/`，遵循 Expo Router 约定：`_layout.tsx`、`+not-found.tsx`、`[id].tsx`、`(group)/...`。
- Tabs、auth、static pages、modals 使用路由分组：`app/(tabs)`、`app/(auth)`、`app/(static)`、`app/(modals)`。
- 共享 shell 行为放在 `src/components/navigation/*`。
- 路由文件保持极短、稳定、可预测。

## 路由文件职责

`app/**/*.tsx` 路由文件**只能做**：

1. 读取 `useLocalSearchParams` 路由参数。
2. 渲染对应 screen 组件（`<XxxScreen ... />`）。
3. 透传路由参数。
4. 在 `_layout.tsx` 中声明 `<Stack.Screen>` 与 `options`。

```tsx
// app/<feature>/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { ItemDetailScreen } from '@components/<feature>/item-detail-screen';

export default function ItemDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ItemDetailScreen id={id} />;
}
```

**禁止**在路由文件中：

- 直接调用 `fetch` 或 API。
- 拼接 API URL。
- 含业务计算、格式化、状态管理。
- `import @api/*` / `@storage/*`。

由 `src/test/architecture/layer-boundary.test.ts` 守护。

## 跳转类型安全

### 禁止 `as Href` 字符串拼接

```tsx
// 禁止
router.push(`/(auth)/login?${params.toString()}` as Href);
router.push('/<feature>' as Href);
router.push(entry.route as Href);
```

### 静态路径使用对象语法

```tsx
// 推荐
router.push({ pathname: '/(auth)/login', params: { redirectTo } });
router.push({ pathname: '/<feature>' });
router.push({ pathname: '/<feature>/[id]', params: { id: item.id } });
```

### 动态 / 外部数据来源使用 `safe-navigate`

来源于 query response、静态 config 表或用户输入的字符串路径，必须通过 `@components/navigation/safe-navigate` 校验：

```ts
// src/components/navigation/safe-navigate.ts 模版见 docs/rules/rn/templates/navigation-helper.md
import { pushPath } from '@components/navigation/safe-navigate';

pushPath(article.cta.href); // 内部走 isAllowedPath + 白名单
```

### Typed routes

项目必须在 `app.json` 启用 `experiments.typedRoutes: true`，`tsconfig.json` 必须保留 `.expo/types/**/*.ts` 与 `expo-env.d.ts` 的 include，`.gitignore` 必须保留 `expo-env.d.ts`。Expo CLI 在启动 dev server 时生成这些类型；生成文件不提交。

typed routes 只负责静态路由与对象 href 的编译期校验，不替代运行时白名单。静态路径继续使用对象语法，动态 / 外部来源路径继续走 `@components/navigation/safe-navigate`。

## 路由分组规则

| 分组       | 用途                               | 含 tab bar | header 行为               |
| ---------- | ---------------------------------- | ---------- | ------------------------- |
| `(tabs)`   | 主体 tab 页面                      | 是         | 通常 `headerShown: false` |
| `(auth)`   | 登录、注册、找回密码               | 否         | 自定义返回按钮            |
| `(modals)` | 模态页面（搜索、设置、设备兼容性） | 否         | `presentation: 'modal'`   |
| `(static)` | 静态页（条款、隐私、关于、guides） | 视情况     | 标准 stack header         |

## Deep Link

- `app.json` 配置 `scheme`（自定义 app scheme）+ `intentFilters`（Android）+ `associatedDomains`（iOS）。
- Deep link 入口必须校验白名单：协议 ∈ `{https, mailto, tel, <app-scheme>}`，host 在白名单内。
- 校验逻辑统一在 `@domain/safe-url` helper 中实现；详见 `docs/rules/rn/security.md` 与 `docs/rules/rn/templates/safe-url.md`。
- 外部系统回跳 deep link 是发布关键路径，必须保留约定的 path 形态；具体路径由业务方决定，并记录在项目发布清单。

## Header 与导航 chrome

- 标准 header 通过 Stack.Screen options 配置；不在 screen 内重复实现返回按钮。
- 自定义复杂 header（如搜索、通知、偏好入口）放在 `src/components/navigation/*`，并通过 `headerShown: false` + 自渲染挂载。
- 导航 chrome 内可见文案必须 i18n，不允许硬编码。

## Back 行为

- iOS：默认 swipe back；不允许在 form 提交中途随意禁用。
- Android：硬件 back 按钮必须可关闭 modal、退出登录流程；form 中途要 confirm dialog。
- Modal `presentation: 'modal'` 下，关闭手势必须可用；如禁用需在 PR 说明原因。
- Headerless 二级详情页的自定义返回按钮默认应等价于系统 back：优先 `router.canGoBack()` + `router.back()`；没有历史栈（例如 deep link 直达）时再 `replace` 到业务 fallback。不要用 `push` 实现返回，否则会在栈上创建重复页面。项目内复用 `@components/navigation/safe-navigate` 的 `backOrReplacePath`。

## 跳转参数

- 参数走 `params` 对象，而非字符串拼接：`router.push({ pathname, params: { id, redirectTo } })`。
- 参数序列化由 Expo Router 处理；不要 `JSON.stringify` 一个对象塞进 query string。
- 跨页传递大型对象时，使用 store（Zustand）或 query cache，而非 query string。

## redirectTo / 登录守卫

- 需要登录的 screen 检测匿名态后跳转 `/(auth)/login`，并带上 `redirectTo` 参数（**目标路径**）。
- 登录成功后 `router.replace(redirectTo)`；replace 而非 push，避免 back 回到 login。
- `redirectTo` 来自外部时必须经过 safe-navigate 校验。

## 完成检查

- 路由文件 ≤ 30 行；只做参数读取 + screen 渲染。
- 无 `as Href`；无字符串拼接路径。
- 跳转使用对象语法 `{ pathname, params }`。
- 外部来源路径走 `safe-navigate.pushPath`。
- 登录守卫使用 `redirectTo` 而非全局跳转 home。
