import MuiButton from '@mui/material/Button';
import type { ButtonProps as IMuiButtonProps } from '@mui/material/Button';
import type { ReactNode } from 'react';

/**
 * 按钮语义色调。
 */
export type ButtonTone = 'primary' | 'danger' | 'ghost';

/**
 * 按钮参数。
 */
export interface IButtonProps extends Omit<IMuiButtonProps, 'variant' | 'color' | 'children'> {
  /**
   * 语义色调：主操作、危险操作、次要操作。
   */
  tone?: ButtonTone;
  /**
   * 是否进行中；为 true 时禁用并设置 aria-busy。
   */
  isPending?: boolean;
  /**
   * 进行中的文案，由调用方提供 i18n 文案。
   */
  pendingLabel?: ReactNode;
  /**
   * 按钮文案。
   */
  children: ReactNode;
}

const TONE_PROPS = {
  primary: { variant: 'contained', color: 'primary' },
  danger: { variant: 'outlined', color: 'error' },
  ghost: { variant: 'text', color: 'inherit' },
} as const;

/**
 * 统一 pending 语义的按钮，避免每个页面重复写 disabled + aria-busy + 文案切换。
 *
 * @param props - 按钮参数。
 * @returns 按钮节点。
 */
export function Button({
  tone = 'primary',
  isPending = false,
  pendingLabel,
  children,
  disabled,
  ...rest
}: IButtonProps) {
  return (
    <MuiButton {...TONE_PROPS[tone]} {...rest} disabled={isPending || disabled} aria-busy={isPending || undefined}>
      {isPending ? (pendingLabel ?? children) : children}
    </MuiButton>
  );
}
