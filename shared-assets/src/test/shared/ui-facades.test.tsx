import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox, Dialog, Table, TextArea } from '@/shared/ui';

describe('ui facades', () => {
  it('should render TextArea and accept input', () => {
    render(<TextArea aria-label="备注" />);

    const field = screen.getByRole('textbox', { name: '备注' });
    fireEvent.change(field, { target: { value: 'hello' } });

    expect(field).toHaveValue('hello');
  });

  it('should toggle Checkbox', () => {
    render(<Checkbox>同意</Checkbox>);

    const box = screen.getByRole('checkbox', { name: '同意' });
    fireEvent.click(box);

    expect(box).toBeChecked();
  });

  it('should render Dialog content and close through the close button', () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="示例弹窗" onClose={onClose}>
        弹窗内容
      </Dialog>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('弹窗内容')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should render Table rows', () => {
    render(
      <Table
        columns={[{ title: '名称', dataIndex: 'name' }]}
        dataSource={[{ key: '1', name: '示例行' }]}
        pagination={false}
      />,
    );

    expect(screen.getByText('示例行')).toBeInTheDocument();
  });
});
