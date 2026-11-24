# 性能与渲染规则

## 目的

本文件描述 React Native 项目的渲染性能、`React.memo` / `useMemo` / `useCallback` 使用边界、FlatList 引用稳定、动画选型与冷启动优化。

## 执行边界

性能优化必须以可读性和可观测信号为前提。只在引用稳定性跨过 React 边界、列表项重复渲染或动画确实进入帧预算时优化；不为了"看起来更专业"添加无收益的 memo、callback 或复杂比较函数。

### Do

| 做法                                                                             | 门禁   | 原因                                                     |
| -------------------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| 长列表 item 组件满足纯展示、props 稳定、父组件频繁 re-render 时使用 `React.memo` | review | 避免列表滚动或局部 loading 状态变化时重复渲染所有 item。 |
| `FlatList` 的 `renderItem`、`keyExtractor` 用 `useCallback` 或组件外函数保持稳定 | review | 避免 FlatList 每次父 render 都重新接收函数引用。         |
| 传给 memo 子组件的 handler、对象 prop 用 `useCallback` / `useMemo` 稳定          | review | memo 只有在 props 引用稳定时才有实际收益。               |
| 固定高度列表项补 `getItemLayout`                                                 | review | 跳过 measurement，提升滚动与定位性能。                   |
| 性能改造后记录 re-render 次数、滚动抽样或 profile 证据                           | review | 防止用主观感受替代验证。                                 |

### Don't

| 做法                                                  | 门禁   | 原因                                                       |
| ----------------------------------------------------- | ------ | ---------------------------------------------------------- |
| 在 JSX 中给长列表 item 传行内匿名函数                 | review | 每次 render 都创建新函数，破坏 memo 与 FlatList 引用稳定。 |
| 在 JSX 中创建 ≥3 个字段的 token-derived 大 style 对象 | review | 每次 render 都创建新对象，长列表内成本会放大。             |
| 为简单标量派生值使用 `useMemo`                        | review | memo cache 与依赖比较成本可能高于计算本身。                |
| 对 props 不稳定的组件直接套 `React.memo`              | review | 多一次 props compare，仍无法阻止 re-render。               |
| 用 `setState` 驱动高频动画                            | review | 高频 state 更新会触发 React render，无法稳定保持 60 fps。  |

### Lint 与 Review

- lint 强制：`react-hooks/exhaustive-deps` 必须启用；故意省略依赖时写明原因。
- review 强制：`React.memo` 使用边界、FlatList 引用稳定、行内大对象 / 函数、样式 token 消费模式、动画选型与性能证据。
- 测试强制：触达长列表或 memo pilot 时，至少提供 focused test；涉及性能主张时补 re-render 计数、滚动抽样或 profile 记录。

## React.memo

### 何时使用

仅在以下条件**同时满足**时使用 `React.memo`：

1. 组件是**纯展示**（无内部异步动作，无 ref imperative）。
2. props 已经稳定化（hook 调用方使用 `useMemo` / `useCallback`）。
3. 组件出现在长列表 `renderItem` 中，或父组件频繁 re-render。

```tsx
interface IListItemCardProps {
  item: IListItem;
  onPrimaryAction: (item: IListItem) => void;
  onSecondaryAction: (item: IListItem) => void;
  isBusy: boolean;
}

function ListItemCardImpl(props: IListItemCardProps) { ... }

export const ListItemCard = React.memo(ListItemCardImpl, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.isBusy === next.isBusy &&
    prev.onPrimaryAction === next.onPrimaryAction &&
    prev.onSecondaryAction === next.onSecondaryAction
  );
});
```

项目如引入 memo pilot，应在本地测试或 profile 记录中证明父 screen 同状态 rerender 后列表项 render 次数没有增加。

### 何时不使用

- 顶层 screen / 业务区块：父组件本身就 stable。
- 组件接受复杂 props 而调用方没稳定化：memo 形同虚设。
- props 没有引用稳定保证：每次 re-render 仍重新渲染，多了一次 props compare 反而更慢。

### Why-Did-You-Render

可选启用 `@welldone-software/why-did-you-render` 在 dev 模式辅助识别不必要 re-render（仅 dev 环境）。

## useMemo / useCallback

### 何时使用

仅在**引用稳定性会跨 React 边界**时使用：

- 传给 `React.memo` 子组件的 prop（对象 / 函数）。
- `useEffect` 依赖数组中的对象 / 函数。
- `FlatList` 的 `renderItem` / `keyExtractor`。
- `useQuery({ queryKey, queryFn })` 内的 queryFn（避免每次新引用）。

```tsx
const renderItem = useCallback(
  (info: ListRenderItemInfo<IActiveEsimListItem>) => (
    <ActiveEsimCard
      item={info.item}
      onPrimaryAction={handlePrimaryAction}
      onSecondaryAction={handleSecondaryAction}
      isBusy={busyItemId === info.item.id}
    />
  ),
  [handlePrimaryAction, handleSecondaryAction, busyItemId],
);
```

### 何时不使用

- 简单标量 prop（string / number / boolean）。
- 不会作为 effect 依赖的本地变量。
- 函数体内只调用一次的 derived 值。

过度使用 `useMemo` 会：

1. 增加 memo cache 内存。
2. 增加 dep array 比较开销。
3. 让代码难读。

### exhaustive-deps

ESLint `react-hooks/exhaustive-deps` 必须启用（详见 `docs/rules/rn/testing.md`）；依赖数组遗漏会通过 lint 拦截。

- 故意省略依赖时显式 `// eslint-disable-next-line react-hooks/exhaustive-deps` + 注释原因。

## FlatList 引用稳定

### renderItem 稳定

```tsx
// 推荐：useCallback 稳定
const renderItem = useCallback((info) => <Card item={info.item} />, []);

// 或：component 外部定义
function renderItem({ item }: ListRenderItemInfo<Item>) {
  return <Card item={item} />;
}

// 禁止：行内匿名函数
<FlatList renderItem={({ item }) => <Card item={item} />} />;
```

### keyExtractor 稳定

```tsx
const keyExtractor = useCallback((item: Item) => item.id, []);

// 或外部定义
function keyExtractor(item: Item): string {
  return item.id;
}
```

### getItemLayout（固定高度场景）

固定高度卡片可配 `getItemLayout`，跳过 measurement 提升滚动性能：

```tsx
const ITEM_HEIGHT = 96;
const getItemLayout = (_: unknown, index: number) => ({
  length: ITEM_HEIGHT,
  offset: ITEM_HEIGHT * index,
  index,
});

<FlatList getItemLayout={getItemLayout} ... />
```

## 样式与 Token 消费

### 推荐模式

- 结构样式（`flex`、`borderWidth`、`lineHeight`、`fontWeight`、固定尺寸、静态 margin）优先放入模块底部的 `StyleSheet.create`。
- 主题相关样式（颜色、主题字号、主题间距、主题圆角）通过数组合并到静态样式上：`style={[styles.card, tokenStyles.card]}`。
- 同一组件内如果出现 ≥3 个 token-derived 字段的 style 对象，使用 `useMemo` 或同目录 hook 缓存成命名 style 集合，避免在 JSX render 树中反复创建大对象。
- 长列表 item 或被 `React.memo` 包裹的子组件，必须保证传入的 style / handler / object prop 引用稳定，否则 memo 对比没有收益。

### 示例

```tsx
const cardStyles = useFeatureCardStyles();

return <View style={cardStyles.section} />;
```

默认不引入全局 `useStylesWithTokens` helper。局部 hook 更容易保留组件语义；当两个以上 feature 出现相同缓存模式时，再抽到 `src/theme/*` 或 `src/components/ui/*`。

## 行内对象 / 函数

### 禁止：JSX 中创建大对象

```tsx
// 禁止：每次 re-render 创建新对象，长列表内尤其昂贵
<View style={{
  backgroundColor: tokens.colors.surface,
  borderRadius: tokens.radius.md,
  padding: tokens.spacing.md,
  ...moreFields,
}} />

// 推荐：StyleSheet + 数组合并
<View style={[styles.container, { backgroundColor: tokens.colors.surface }]} />
```

### 禁止：data prop 行内构造数组

```tsx
// 禁止
<FlatList data={items.filter(x => x.active)} ... />

// 推荐
const activeItems = useMemo(() => items.filter(x => x.active), [items]);
<FlatList data={activeItems} ... />
```

## 动画选型

### 决策矩阵

| 场景                                                          | 默认方案                                            | 原因                                                                                                      | 项目预设                                                 |
| ------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 手势驱动动画（拖拽、滑动关闭、可交互 sheet）                  | Reanimated worklet + `react-native-gesture-handler` | 手势事件需要在 UI 线程内连续响应，避免通过 React state 往返触发 render。                                  | 交互式 sheet、滑动操作优先用 Reanimated。                |
| 滚动驱动动画（parallax、吸顶联动、滚动进度）                  | Reanimated worklet                                  | 滚动事件高频触发，`Animated.event` + `useNativeDriver: false` 在 RN New Architecture 下不可作为性能基线。 | hero 压缩、tab 吸顶联动优先用 Reanimated。               |
| 帧驱动或持续动画（加载条、骨架闪烁、进度环）                  | Reanimated worklet                                  | 持续动画需要稳定帧预算，不应由 `setState` 驱动。                                                          | 上传进度、安装进度等连续动画优先用 Reanimated。          |
| 简单状态切换（淡入、短距离 slide、一次性提示）                | RN `Animated`                                       | 动画短、频率低、无手势依赖，RN `Animated` 足够且代码更轻。                                                | Toast、banner、局部 empty state 入场可用 RN `Animated`。 |
| 无动画收益的状态切换（表单错误、按钮 disabled、内容展开很短） | 直接切换 UI 状态                                    | 避免为低价值场景引入额外状态机和测试成本。                                                                | 表单错误和离线禁用提示默认不加动画。                     |
| 持久 transition（跨路由共享元素、复杂页面切换）               | 先评估平台方案，再决策 Reanimated                   | 这类动画影响导航栈、可访问性与回退手势，不能在业务组件内局部硬做。                                        | 共享元素跳转先补独立设计与验证记录。                     |

`react-native-reanimated` 是否保留在依赖中由项目需求决定；没有典型场景时不强行引入运行时代码。

### Reanimated worklet

适用：

- 手势驱动（拖拽、滑动手势）：与 `react-native-gesture-handler` 配合使用 `useAnimatedGestureHandler`。
- 滚动驱动（视差、parallax）：`useAnimatedScrollHandler`。
- 60+ fps 持续动画（loading spinner、加载条）。

```tsx
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';

const offset = useSharedValue(0);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: offset.value }],
}));

offset.value = withSpring(100);
```

### RN Animated

适用：

- 状态切换短动画（淡入淡出、滑动指示器）。
- 简单 timing 动画。
- 一次性 transition。

```tsx
import { Animated } from 'react-native';

const opacity = useRef(new Animated.Value(0)).current;
Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
```

### 不使用 `setState` 驱动动画

- 高频动画使用 setState 会触发整个组件重渲染；用 Animated / Reanimated 的共享值。

### Fabric / New Architecture 注意事项

- RN New Architecture / Fabric 下不要依赖旧 bridge 延迟来掩盖低效 render；列表 item、样式对象和 handler 引用仍需稳定。
- 禁止 `Animated.event` 与 `useNativeDriver: false` 组合用于滚动或手势驱动动画；这类场景改用 Reanimated worklet。
- 需要读布局尺寸时优先使用稳定的 `onLayout` 状态更新边界；不要在高频动画帧中同步触发 React state。

## 冷启动优化

### Splash 隐藏时机

详见 `docs/rules/rn/startup.md`。

### Provider 嵌套层数

- Provider 嵌套深度 ≤ 8 层；超过时需要拆分 bridge 或重新评估 provider 归属。
- 不在 Provider 树中做重计算或同步 IO。
- Provider context value 用 `useMemo` 稳定，避免上层 re-render 触发整树。

### 首屏 Query 预取

可选：在 `AppProviders` mount 时 `queryClient.prefetchQuery` 首屏关键数据，避免用户进入首屏看 loading。

## 包体优化

### 动态 import

- Expo Router 已自动按路由 code splitting。
- 大型可选模块（如富文本编辑器）可用 `Suspense + React.lazy`。

### 资源压缩

- 图片在 build 时压缩；不在运行时下载未压缩资源。
- 字体只引入实际使用的字重。
- 不在客户端打包大型 JSON 数据（< 1 MB OK，更大走 API）。

## 测试

- 性能改造必须有可观测信号：FlatList 滚动流畅性测试，或具体 re-render 计数。
- 长列表性能预算测试在 `src/test/architecture/long-list-performance-budget.test.ts`（如启用）。
- 不接受"看起来更快"作为完成证据。

## 完成检查

- `React.memo` 仅在子组件为纯展示 + 列表项 + props 已稳定时使用。
- `useMemo` / `useCallback` 仅在跨 React 边界且依赖稳定时使用。
- FlatList `renderItem` + `keyExtractor` 引用稳定。
- 禁止 JSX 行内大对象 prop 与匿名函数 prop（长列表内尤其）。
- 手势动画走 Reanimated，简单 transition 走 RN Animated。
- ESLint `exhaustive-deps` 启用。
