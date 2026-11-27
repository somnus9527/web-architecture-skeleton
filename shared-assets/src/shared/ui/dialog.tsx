'use client';

import { Modal } from 'antd';
import type { ReactNode } from 'react';

/**
 * 弹窗参数：只封装通用外壳，内容与动作区由调用方注入。
 */
export interface IDialogProps {
  /**
   * 是否打开。
   */
  open: boolean;
  /**
   * 标题，同时作为可访问名称。
   */
  title: ReactNode;
  /**
   * 弹窗内容。
   */
  children: ReactNode;
  /**
   * 关闭回调，供 ESC、遮罩关闭与右上角关闭按钮共用。
   */
  onClose: () => void;
  /**
   * 底部动作区；默认不渲染，由调用方传 Button 组合。
   */
  footer?: ReactNode;
  /**
   * 宽度。
   */
  width?: number | string;
  /**
   * 附加类名。
   */
  className?: string;
  /**
   * 是否允许点遮罩关闭，默认关闭以避免误丢表单。
   */
  maskClosable?: boolean;
  /**
   * 关闭后是否销毁内容，默认销毁以重置表单状态。
   */
  destroyOnHidden?: boolean;
}

/**
 * 统一弹窗外壳：焦点陷阱、ESC、aria-modal 由 antd Modal 提供，这里只收敛默认行为。
 *
 * @param props - 弹窗参数。
 * @returns antd Modal 节点。
 */
export function Dialog({
  open,
  title,
  children,
  onClose,
  footer,
  width,
  className,
  maskClosable = false,
  destroyOnHidden = true,
}: IDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      footer={footer ?? null}
      width={width}
      className={className}
      onCancel={onClose}
      mask={{ closable: maskClosable }}
      destroyOnHidden={destroyOnHidden}
      centered
    >
      {children}
    </Modal>
  );
}
