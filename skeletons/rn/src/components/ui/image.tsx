import { Image as ExpoImage, type ImageProps } from 'expo-image';
import { type StyleProp, type ImageStyle } from 'react-native';

interface IAppImageProps extends Omit<ImageProps, 'source' | 'style'> {
  /** 图片地址或 expo-image source。 */
  source: string | { uri: string };
  /** 显示宽度，必填以避免 layout shift。 */
  width: number;
  /** 显示高度，必填以避免 layout shift。 */
  height: number;
  /** 无障碍文案。 */
  alt: string;
  /** blurhash / thumbhash 占位。 */
  placeholder?: string;
  /** 加载优先级。 */
  priority?: 'low' | 'normal' | 'high';
  /** 额外样式。 */
  style?: StyleProp<ImageStyle>;
}

/**
 * 业务图片统一入口：固定 expo-image 默认值，业务代码不直接 import expo-image。
 *
 * @param props - 图片属性。
 * @returns 图片节点。
 */
export function AppImage(props: IAppImageProps) {
  const { source, width, height, alt, placeholder, priority = 'normal', style, ...rest } = props;
  const resolvedSource = typeof source === 'string' ? { uri: source } : source;

  return (
    <ExpoImage
      {...rest}
      accessibilityLabel={alt}
      accessibilityRole="image"
      cachePolicy="memory-disk"
      contentFit="cover"
      placeholder={placeholder === undefined ? undefined : { blurhash: placeholder }}
      priority={priority}
      source={resolvedSource}
      style={[{ width, height }, style]}
      transition={200}
    />
  );
}
