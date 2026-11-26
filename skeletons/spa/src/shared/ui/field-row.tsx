import type { ReactNode } from 'react';

/**
 * 只读字段行参数。
 */
export interface IFieldRowProps {
  /**
   * 字段名。
   */
  label: ReactNode;
  /**
   * 字段值。
   */
  value: ReactNode;
  /**
   * 字段说明。
   */
  hint?: ReactNode;
}

/**
 * 详情页与表单里的只读字段行：左侧名称、右侧值。
 *
 * @param props - 字段行参数。
 * @returns 字段行节点。
 */
export function FieldRow({ label, value, hint }: IFieldRowProps) {
  return (
    <div className="aui-field-row">
      <span className="aui-field-row__label">{label}</span>
      <span className="aui-field-row__value">
        {value}
        {hint ? <span className="aui-field-row__hint">{hint}</span> : null}
      </span>
    </div>
  );
}
