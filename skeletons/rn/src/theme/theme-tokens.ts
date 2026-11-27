/**
 * 主题偏好。`system` 跟随设备的亮暗色设置。
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * 受支持的主题偏好全集；用于校验持久化里读出来的值。
 */
const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/**
 * 把任意字符串收敛为受支持的 ThemePreference。
 *
 * @param value - 存储或外部传入的原始值。
 * @returns 合法偏好；非法值返回 null。
 */
export function parseThemePreference(value: string | null | undefined): ThemePreference | null {
  return value && (THEME_PREFERENCES as readonly string[]).includes(value) ? (value as ThemePreference) : null;
}

/**
 * 颜色 token。语义化命名，跨亮暗色名字保持稳定。
 */
export interface IThemeColors {
  /** 主背景面。 */
  surface: string;
  /** 弱化背景面。 */
  surfaceMuted: string;
  /** 浮层背景面。 */
  surfaceElevated: string;
  /** 强调背景面。 */
  surfaceStrong: string;
  /** 高亮背景面。 */
  surfaceHighlight: string;
  /** 柔和背景面。 */
  surfaceSoft: string;
  /** 玻璃拟态半透明背景。 */
  surfaceFrost: string;
  /** 主要文字。 */
  textPrimary: string;
  /** 次级文字。 */
  textSecondary: string;
  /** 弱提示文字。 */
  textMuted: string;
  /** 深色 CTA 上的反白文字。 */
  textContrast: string;
  /** 边框基准色。 */
  border: string;
  /** 浮层遮罩。 */
  scrim: string;
  /** 品牌主色。 */
  brandPrimary: string;
  /** 品牌强调色。 */
  brandPrimaryStrong: string;
  /** 深色品牌色。 */
  brandDeep: string;
  /** 柔和品牌色。 */
  brandSoft: string;
  /** 成功状态色。 */
  statusSuccess: string;
  /** 警告状态色。 */
  statusWarning: string;
  /** 危险状态色。 */
  statusDanger: string;
  /** 信息状态色。 */
  statusInfo: string;
}

/**
 * 间距 token，单位为逻辑像素。
 */
export interface IThemeSpacing {
  /** 4。 */
  xs: number;
  /** 8。 */
  sm: number;
  /** 12。 */
  md: number;
  /** 16。 */
  lg: number;
  /** 24。 */
  xl: number;
  /** 32。 */
  xxl: number;
}

/**
 * 圆角 token，单位为逻辑像素。
 */
export interface IThemeRadius {
  /** 6。 */
  sm: number;
  /** 10。 */
  md: number;
  /** 16。 */
  lg: number;
  /** 999，用于胶囊形状。 */
  pill: number;
}

/**
 * 字号 token，单位为逻辑像素。
 */
export interface IThemeTypography {
  /** 12。 */
  caption: number;
  /** 14。 */
  body: number;
  /** 18。 */
  title: number;
  /** 24。 */
  display: number;
}

/**
 * 阴影 token。RN 0.76+ 支持 boxShadow 字符串语法。
 */
export interface IThemeShadows {
  /** 卡片阴影。 */
  card: string;
  /** 模态阴影。 */
  modal: string;
  /** 浮层阴影。 */
  popover: string;
}

/**
 * 主题 token 完整集。
 */
export interface IThemeTokens {
  /** 解析后的主题。 */
  resolvedTheme: 'light' | 'dark';
  /** 颜色。 */
  colors: IThemeColors;
  /** 间距。 */
  spacing: IThemeSpacing;
  /** 圆角。 */
  radius: IThemeRadius;
  /** 字号。 */
  typography: IThemeTypography;
  /** 阴影。 */
  shadows: IThemeShadows;
}

/**
 * 亮色 token。
 */
const lightTokens: IThemeTokens = {
  resolvedTheme: 'light',
  colors: {
    surface: '#FFFFFF',
    surfaceMuted: '#F5F6F8',
    surfaceElevated: '#FFFFFF',
    surfaceStrong: '#DBEAFE',
    surfaceHighlight: '#EFF6FF',
    surfaceSoft: '#EAF3FF',
    surfaceFrost: 'rgba(255, 255, 255, 0.7)',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    textContrast: '#FFFFFF',
    border: '#E2E8F0',
    scrim: 'rgba(0, 0, 0, 0.4)',
    brandPrimary: '#2563EB',
    brandPrimaryStrong: '#1D4ED8',
    brandDeep: '#1E3A8A',
    brandSoft: '#BFDBFE',
    statusSuccess: '#16A34A',
    statusWarning: '#F59E0B',
    statusDanger: '#DC2626',
    statusInfo: '#0EA5E9',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 10, lg: 16, pill: 999 },
  typography: { caption: 12, body: 14, title: 18, display: 24 },
  shadows: {
    card: '0 2px 8px rgba(0,0,0,0.08)',
    modal: '0 8px 24px rgba(0,0,0,0.16)',
    popover: '0 4px 12px rgba(0,0,0,0.10)',
  },
};

/**
 * 暗色 token。值按设计语义重新指定，不是亮色的反相。
 */
const darkTokens: IThemeTokens = {
  resolvedTheme: 'dark',
  colors: {
    surface: '#0F1116',
    surfaceMuted: '#1A1D24',
    surfaceElevated: '#1F232C',
    surfaceStrong: '#1E3A8A',
    surfaceHighlight: '#172554',
    surfaceSoft: '#1A2538',
    surfaceFrost: 'rgba(31, 35, 44, 0.7)',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
    textMuted: '#888888',
    textContrast: '#0F1116',
    border: '#2A2E37',
    scrim: 'rgba(0, 0, 0, 0.6)',
    brandPrimary: '#60A5FA',
    brandPrimaryStrong: '#3B82F6',
    brandDeep: '#93C5FD',
    brandSoft: '#1E3A8A',
    statusSuccess: '#22C55E',
    statusWarning: '#FACC15',
    statusDanger: '#EF4444',
    statusInfo: '#38BDF8',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 10, lg: 16, pill: 999 },
  typography: { caption: 12, body: 14, title: 18, display: 24 },
  shadows: {
    card: '0 2px 8px rgba(0,0,0,0.4)',
    modal: '0 8px 24px rgba(0,0,0,0.6)',
    popover: '0 4px 12px rgba(0,0,0,0.5)',
  },
};

/**
 * 按解析后的主题返回 token 集合。
 *
 * @param preference - 解析后的亮 / 暗主题。
 * @returns 对应主题的 token。
 */
export function getThemeTokens(preference: 'light' | 'dark'): IThemeTokens {
  return preference === 'dark' ? darkTokens : lightTokens;
}
