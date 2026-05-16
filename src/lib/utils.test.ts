import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resolves tailwind conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'inactive')).toBe('base active');
  });

  it('handles falsy values', () => {
    expect(cn('a', null, undefined, false, 'b')).toBe('a b');
  });

  it('merges array classes', () => {
    expect(cn(['x', 'y'], 'z')).toBe('x y z');
  });
});
