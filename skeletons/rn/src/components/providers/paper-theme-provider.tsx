import type { ReactNode } from 'react';
import { PaperProvider } from 'react-native-paper';

import { getPaperTheme } from '@theme/paper-theme';
import { useThemeTokens } from '@theme/theme-provider';

interface IPaperThemeProviderProps {
  /** 子树。 */
  children: ReactNode;
}

/**
 * 挂载 React Native Paper 的 Provider，主题取自项目 token。
 *
 * @param props - 子树。
 * @returns Paper Provider。
 */
export function PaperThemeProvider({ children }: IPaperThemeProviderProps) {
  const tokens = useThemeTokens();

  return <PaperProvider theme={getPaperTheme(tokens)}>{children}</PaperProvider>;
}
