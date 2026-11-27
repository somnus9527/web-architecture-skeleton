'use client';

import { Button as AntdButton } from 'antd';

import { useThemeMode } from '@/shared/theme/theme-mode-context';
import { toggleExplicitTheme } from '@/shared/theme/theme-mode';

import { Moon, Sun } from './icons';

/**
 * 主题切换控件参数。
 */
export interface IThemeToggleProps {
  /** 无障碍名称；由调用方按当前语言传入，shared 层不依赖 i18n。 */
  label: string;
}

/**
 * 明暗主题切换按钮：点击后在 light / dark 间切换，并保留 system 的当前解析结果。
 *
 * @param props - 无障碍名称。
 * @returns 图标按钮。
 */
export function ThemeToggle({ label }: IThemeToggleProps) {
  const { resolved, setMode } = useThemeMode();
  const next = toggleExplicitTheme(resolved);

  return (
    <AntdButton
      aria-label={label}
      icon={resolved === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      type="text"
      onClick={() => setMode(next)}
    />
  );
}
