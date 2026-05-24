import { describe, it, expect } from 'vitest';
import { cn, parsePagination, formatDate, formatNumber, getInitials } from '@/lib/utils';

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

describe('formatDate', () => {
  it('formats a date string in Russian by default', () => {
    const result = formatDate('2024-01-15');
    expect(result).toContain('2024');
  });

  it('formats in English locale', () => {
    const result = formatDate('2024-01-15', 'en');
    expect(result).toContain('2024');
  });

  it('formats in Chinese locale', () => {
    const result = formatDate('2024-01-15', 'zh');
    expect(result).toContain('2024');
  });

  it('accepts Date object', () => {
    const date = new Date('2024-06-15');
    const result = formatDate(date);
    expect(result).toContain('2024');
  });
});

describe('formatNumber', () => {
  it('formats number in Russian locale', () => {
    expect(formatNumber(1000000, 'ru')).toBe('1\u00a0000\u00a0000');
  });

  it('formats number in English locale', () => {
    expect(formatNumber(1000000, 'en')).toBe('1,000,000');
  });

  it('formats number in Chinese locale', () => {
    expect(formatNumber(1000000, 'zh')).toBe('1,000,000');
  });
});

describe('getInitials', () => {
  it('extracts initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns single letter for single name', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('returns uppercase for lowercase input', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('limits to 2 characters', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });

  it('returns fallback for empty/null/undefined', () => {
    expect(getInitials('')).toBe('?');
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
  });

  it('allows custom fallback', () => {
    expect(getInitials('', 'N/A')).toBe('N/A');
  });
});
