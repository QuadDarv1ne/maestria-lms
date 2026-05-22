import { describe, it, expect } from 'vitest';
import { cn, parsePagination } from '@/lib/utils';

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

describe('parsePagination', () => {
  it('returns defaults when no params provided', () => {
    const params = new URLSearchParams();
    expect(parsePagination(params)).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('parses custom page and limit', () => {
    const params = new URLSearchParams({ page: '3', limit: '10' });
    expect(parsePagination(params)).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('respects maxLimit constraint', () => {
    const params = new URLSearchParams({ limit: '200' });
    expect(parsePagination(params, { maxLimit: 50 })).toEqual({ page: 1, limit: 50, skip: 0 });
  });

  it('enforces minimum limit of 1', () => {
    const params = new URLSearchParams({ limit: '-5' });
    expect(parsePagination(params)).toEqual({ page: 1, limit: 1, skip: 0 });
  });

  it('enforces minimum page of 1', () => {
    const params = new URLSearchParams({ page: '-2' });
    expect(parsePagination(params)).toEqual({ page: 1, limit: 20, skip: 0 });
  });
});
