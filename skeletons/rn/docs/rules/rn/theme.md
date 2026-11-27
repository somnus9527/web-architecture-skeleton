# 主题与样式规则

## 目的

本文件描述 React Native 项目的设计 token 系统、样式与 token 消费模式、亮暗色与品牌主题切换规则。

## Token 系统

### 位置

- Token 定义：`src/theme/theme-tokens.ts`
- Provider：`src/components/providers/paper-theme-provider.tsx`（Paper provider 挂载）+ `src/theme/theme-provider.tsx`（项目 token provider）
- Paper theme 映射：`src/theme/paper-theme.ts`

### Token 类别

```ts
export interface IThemeTokens {
  resolvedTheme: 'light' | 'dark';
  colors: IThemeColors;
  spacing: IThemeSpacing;
  radius: IThemeRadius;
  typography: IThemeTypography;
  shadows: IThemeShadows;
}
```

具体字段见模版 `docs/rules/rn/templates/theme-tokens.md`。

### 命名原则

- **语义化**而非外观化：`surfaceMuted`（弱化背景）而非 `gray100`；`textPrimary` 而非 `black`。
- **跨主题保持名字稳定**：亮色与暗色的 `surface` 都叫 `surface`，值不同。
- **同义新增 token 必须经评审**：避免出现 `surface`、`surfaceBg`、`background` 等同义重复 token。

## Token 消费

### 使用 hook 读取

```tsx
import { useThemeTokens } from '@theme/theme-provider';

function MyCard() {
  const tokens = useThemeTokens();
  return <View style={{ backgroundColor: tokens.colors.surface }} />;
}
```

### 样式与 token 合成模式

**结构样式**使用 `StyleSheet.create` 静态对象（layout / border-width / size）；**主题相关**通过数组合并（color / fontSize / spacing / radius）：

```tsx
function FeatureCard({ ... }) {
  const tokens = useThemeTokens();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.colors.surfaceMuted,
          borderColor: tokens.colors.border,
          borderRadius: tokens.radius.sm,
          padding: tokens.spacing.md,
        },
      ]}
    >
      ...
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
```

### 禁止：行内大对象样式

不允许整段 inline `style={{ ... }}` 大对象（≥ 3 个 token-derived 字段且在 list renderItem 内）：

```tsx
// 禁止：每次 re-render 创建新对象，影响 memo 与 FlatList 性能
<View style={{
  backgroundColor: tokens.colors.surfaceMuted,
  borderColor: tokens.colors.border,
  borderRadius: tokens.radius.sm,
  padding: tokens.spacing.md,
  ...
}} />
```

### 禁止：硬编码颜色

```tsx
// 禁止
<View style={{ backgroundColor: '#123456' }} />
<Text style={{ color: 'rgba(0,0,0,0.6)' }} />

// 推荐
<View style={{ backgroundColor: tokens.colors.brandPrimary }} />
<Text style={{ color: tokens.colors.textMuted }} />
```

例外：

- `'transparent'` 字面量允许。
- `StyleSheet.create` 内的零值（`borderWidth: 1`）允许。
- 测试与 stub 文件可硬编码。

## 主题切换

### 三种模式

`ThemePreference = 'light' | 'dark' | 'system'`

- `light`：固定亮色。
- `dark`：固定暗色。
- `system`：跟随系统（通过 `useColorScheme()`）。

### 切换入口

通过 `useAppTheme().setThemePreference(preference)`，由设置页调用。

```tsx
const { themePreference, setThemePreference } = useAppTheme();

<PaperRadio value="light" selected={themePreference === 'light'} onPress={() => setThemePreference('light')} />;
```

### Provider 嵌套顺序

主题相关 Provider 必须按以下顺序嵌套（在 `app-providers.tsx` 内）：

```
ThemeProvider (项目 token)
  └─ PaperThemeProvider (Paper provider)
      └─ ... 业务 Provider
```

## Paper Theme 映射

`src/theme/paper-theme.ts` 将项目 token 映射到 Paper MD3 theme：

```ts
import { MD3LightTheme, MD3DarkTheme, type MD3Theme } from 'react-native-paper';

export function getPaperTheme(tokens: IThemeTokens): MD3Theme {
  const base = tokens.resolvedTheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: tokens.colors.brandPrimary,
      surface: tokens.colors.surface,
      // ...
    },
  };
}
```

- UI 业务代码消费项目 token，不消费 Paper theme 内部结构。
- Paper wrapper（`paper-controls.tsx`）使用 Paper theme 是 OK 的。

## 新增 Token

### 何时新增

- 颜色 / 间距 / 圆角 / 字号在两处以上使用 → 沉淀为 token。
- 一次性视觉漂移 → 不要新增 token，使用现有近似 token。
- 与品牌系统对齐的新色板 → 与设计同步后再加。

### 命名格式

- `colors.<surface|text|brand|status>.<variant>`：`colors.surfaceMuted`、`colors.textPrimary`、`colors.brandPrimaryStrong`、`colors.statusSuccess`。
- `spacing.<size>`：`spacing.xs / sm / md / lg / xl / 2xl`。
- `radius.<size>`：`radius.sm / md / lg / pill`。
- `typography.<role>`：`typography.caption / body / title / display`。
- `shadows.<level>`：`shadows.card / modal / popover`。

### 新增 token checklist

- 亮色与暗色双值都给出。
- 与最近的现有 token 对照，确保不是同义重复。
- 至少有 2 处实际使用场景。
- 单测覆盖 `getThemeTokens('light' | 'dark')` 返回值含新 token。

## Dark Mode 注意

- 亮色 token 在暗色下不必"反相"；按设计语义重新指定。
- `brandPrimary` 在暗色可能需要饱和度调整，避免炫光。
- 阴影在暗色下通常不可见或弱化；使用 `border` 区分层级。
- 大面积深色背景上的文字测试对比度 ≥ 4.5:1（详见 `docs/rules/rn/accessibility.md`）。

## 测试

- Token 测试：`src/test/theme/theme-tokens.test.ts` 断言关键 token 值。
- 主题切换测试：覆盖 light / dark / system 三种模式下组件渲染。
- 修改 token 时跑相关组件 snapshot 或 visual test（如启用）。

## 完成检查

- 不出现硬编码颜色 / 字号 / 间距（test、stub、零值常量除外）。
- 结构样式走 `StyleSheet.create`，主题样式通过数组合并。
- 新增 token 同时给出亮 / 暗双值。
- Provider 嵌套顺序：Theme → PaperTheme → 业务 Provider。
- UI 业务代码不消费 Paper theme 内部结构。

## 主题偏好持久化

主题偏好是**非敏感**数据，按 `storage.md` 规则走 AsyncStorage，且只能经 `src/storage/*` 访问：

- 存储模块：`src/storage/theme-preference.ts`，键 `app-theme-preference`，读写都吞掉异常并回落到 `system`。
- Provider：`src/theme/theme-provider.tsx` 默认 `system`，启动后异步水合上次选择；显式传 `initialPreference`
  时跳过水合（测试 / 演示用）。
- 切换顺序：`light → dark → system → light`，每次切换立即持久化。
- 入口：`src/components/ui/theme-toggle.tsx`（UI primitive），首页头部挂载；无障碍名称由调用方传入，primitive 不依赖 i18n。
- 测试：`src/test/theme/*` 覆盖水合、持久化、非法值回落与写入失败；`src/test/components/theme-toggle.test.tsx` 覆盖循环与
  `accessibilityLabel`。
