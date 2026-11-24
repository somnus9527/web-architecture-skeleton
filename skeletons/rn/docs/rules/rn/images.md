# 图片规则

## 目的

本文件描述 React Native 应用中图片资源的选用、加载、缓存、性能与可访问性规则。

## 依赖选择

### 默认使用 `expo-image`

业务图片**必须使用 `expo-image`**（最新稳定版），不再使用 RN 原生 `Image`：

| 能力              | RN `Image` | `expo-image`                            |
| ----------------- | ---------- | --------------------------------------- |
| 缓存策略          | 简单内存   | 内存 + 磁盘双层，可配 policy            |
| placeholder       | 无内置     | 内置（`blurhash` / `thumbhash` / 静态） |
| 渐进加载          | 无         | 内置                                    |
| transition        | 无         | 内置（淡入等）                          |
| GIF / WebP / AVIF | 部分支持   | 全支持                                  |
| 优先级控制        | 无         | 有                                      |
| 长列表性能        | 一般       | 显著更好                                |

### 例外保留 RN `Image`

- 国旗 emoji 与极小静态装饰图（≤ 50×50，无缓存收益）。
- SVG 渲染（用 `react-native-svg` 替代）。

### 封装层

业务代码通过 `@components/ui/image.tsx` 接入，统一默认值：

```tsx
// src/components/ui/image.tsx
import { Image as ExpoImage, type ImageProps } from 'expo-image';

interface IAppImageProps extends Omit<ImageProps, 'source'> {
  source: string | { uri: string };
  width: number; // 必填，避免 layout shift
  height: number; // 必填
  alt: string; // 必填，a11y label
  placeholder?: string; // blurhash / thumbhash
  priority?: 'low' | 'normal' | 'high';
}

export function AppImage(props: IAppImageProps) {
  const { source, width, height, alt, placeholder, priority = 'normal', ...rest } = props;
  return (
    <ExpoImage
      source={typeof source === 'string' ? { uri: source } : source}
      style={[{ width, height }, rest.style]}
      placeholder={placeholder ? { blurhash: placeholder } : undefined}
      contentFit="cover"
      transition={200}
      priority={priority}
      cachePolicy="memory-disk"
      accessibilityLabel={alt}
      accessibilityRole="image"
    />
  );
}
```

## 尺寸必填

### 显式 width / height

所有图片必须显式指定 `width` 与 `height`，避免 layout shift：

```tsx
// 推荐
<AppImage source={url} width={120} height={120} alt={t('image.alt')} />

// 禁止：无尺寸，加载后撑开容器
<AppImage source={url} alt="..." />
```

### 响应式尺寸

通过外层 View 控制响应式尺寸，AppImage 接收实际像素：

```tsx
const { width: screenWidth } = useWindowDimensions();
const imageWidth = Math.min(screenWidth - 32, 480);
const imageHeight = imageWidth * 0.5625; // 16:9

<AppImage source={url} width={imageWidth} height={imageHeight} alt={...} />
```

## 缓存策略

### Cache Policy

- **默认 `memory-disk`**：业务图片 + 列表头像。
- `memory`：临时图（用完即弃，如 modal 中的预览）。
- `disk`：超大图片避免内存压力。
- `none`：每次重新下载（不推荐）。

### 缓存清理

- `expo-image` 默认按 LRU 策略管理缓存。
- 用户主动 "清除缓存" 入口调 `Image.clearMemoryCache()` + `Image.clearDiskCache()`。
- 不在业务流程中频繁清缓存（损失缓存收益）。

## Placeholder

### Blurhash / Thumbhash

后端 API 在响应中带上 blurhash 字符串：

```ts
interface IPlanImage {
  url: string;
  blurhash: string; // 后端生成
}
```

使用：

```tsx
<AppImage source={plan.image.url} placeholder={plan.image.blurhash} width={120} height={120} alt={plan.name} />
```

### 静态占位

无 blurhash 时使用静态占位图：

```tsx
<AppImage
  source={url}
  placeholder={require('@/assets/placeholder.png')}
  ...
/>
```

## 优先级控制

长列表中的首屏图片可设 `priority="high"`，屏幕外 / 滚动出来的图片 `priority="normal"`：

```tsx
function renderItem({ item, index }: ListRenderItemInfo<IItem>) {
  return (
    <AppImage
      source={item.imageUrl}
      width={120}
      height={120}
      alt={item.name}
      priority={index < 4 ? 'high' : 'normal'}
    />
  );
}
```

## 长列表中的图片

- 必须使用 `AppImage`（即 `expo-image`），不使用 RN `Image`。
- FlatList `removeClippedSubviews` 与 `windowSize` 配合裁剪不可见图片。
- 大尺寸图片在长列表中考虑 lazy loading（首屏只渲染必要图片）。
- `keyExtractor` 稳定，避免 image source 切换触发重下载。

## 远程图片来源

### 域名白名单

远程图片 URL 应来自项目 CDN 白名单 host；通过 `@domain/safe-url.isAllowedUrl` 校验：

```tsx
function SafeImage({ url, ...rest }: ISafeImageProps) {
  if (!isAllowedImageUrl(url)) {
    return <AppImage source={require('@/assets/placeholder.png')} {...rest} />;
  }
  return <AppImage source={url} {...rest} />;
}
```

### HTTPS 必填

- 不允许 HTTP 图片（iOS ATS 也会拒绝）。
- 后端 API 返回的图片 URL 必须 HTTPS；旧数据 fallback 时升级到 HTTPS。

## 本地资源

### 静态导入

```tsx
import logoImage from '@/assets/logo.png';

<AppImage source={logoImage} width={120} height={120} alt={t('common.logoAlt')} />;
```

### 多分辨率

- iOS：`@2x` / `@3x` 后缀。
- Android：`drawable-mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi/` 目录。
- Expo 项目通常用 `@2x` / `@3x` 即可；Metro 自动选取。

### 不放业务数据

- `assets/` 只放静态资源（icon、splash、placeholder、品牌图）。
- 业务图片走 CDN，不打包进 App。

## 图标 / SVG

- 业务图标使用 `lucide-react-native`（最新稳定版）：tree-shake 友好，无运行时 fetch。
- 复杂矢量插画使用 `react-native-svg`（最新稳定版）。
- 不要把 SVG 转 PNG 再用 `AppImage`（损失矢量优势）。

## 可访问性

- 所有 `AppImage` 必填 `alt`（即 `accessibilityLabel`）。
- 装饰性图片用空 alt：`alt=""` + `accessibilityElementsHidden`。
- 不在 alt 中重复"图片"二字（屏幕阅读器会自动加 role 提示）。

## 性能预算

### 单图大小

| 类型                | 上限（参考）                       |
| ------------------- | ---------------------------------- |
| App icon / launcher | 1024×1024，PNG                     |
| Splash              | 由设计提供多分辨率                 |
| 业务图片（CDN）     | 单图 ≤ 500 KB；列表缩略图 ≤ 100 KB |
| 本地静态图片        | 单图 ≤ 50 KB                       |

### 后端 / CDN 协作

- 列表缩略图与详情大图分两个 URL；前端按场景选 URL。
- 后端支持 query 调整尺寸：`?w=240` / `?w=480`。
- WebP / AVIF 走 CDN content negotiation。

## 测试

- 测试中 mock `expo-image`；不真实下载。
- 测试 `AppImage` 接收正确 props（source / width / height / alt）。
- a11y 测试：`accessibilityLabel` 与 `alt` 匹配。

## 完成检查

- 业务图片走 `AppImage`（`expo-image`），不直接 import RN `Image`。
- 所有 `AppImage` 必填 `width` / `height` / `alt`。
- 列表中首屏图片 `priority="high"`。
- 远程 URL 走白名单校验。
- 后端响应包含 blurhash 时使用。
- 图标用 `lucide-react-native` 或 SVG；不用 PNG 替代。
- 本地静态资源 ≤ 50 KB；业务图片走 CDN。
