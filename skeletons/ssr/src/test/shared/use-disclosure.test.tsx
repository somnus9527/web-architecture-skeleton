import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDisclosure } from '@/shared/hooks/use-disclosure';

describe('useDisclosure', () => {
  it('should start closed and support open / close / toggle', () => {
    const { result } = renderHook(() => useDisclosure());

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('should accept an initial open state', () => {
    const { result } = renderHook(() => useDisclosure(true));

    expect(result.current.isOpen).toBe(true);
  });

  it('should expose setOpen for controlled flows', () => {
    const { result } = renderHook(() => useDisclosure());

    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.setOpen(false);
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('should keep callbacks stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useDisclosure());
    const firstRender = result.current;

    act(() => {
      firstRender.open();
    });
    rerender();

    expect(result.current.open).toBe(firstRender.open);
    expect(result.current.close).toBe(firstRender.close);
    expect(result.current.toggle).toBe(firstRender.toggle);
  });
});
