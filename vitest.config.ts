import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test-setup.ts',
        'src/**/*.d.ts',
        'src/app/**',
        'src/components/**',
        'src/data/**',
        'src/hooks/**',
        'src/proxy.ts',
        'src/lib/auth*',
        'src/lib/db*',
        'src/lib/env*',
        'src/lib/logger*',
        'src/lib/sse*',
        'src/lib/storage*',
        'src/lib/redis*',
        'src/lib/mongodb*',
        'src/lib/csrf*',
        'src/lib/yookassa*',
        'src/lib/webhook*',
        'src/lib/courseImage*',
        'src/lib/promo*',
        'src/lib/notification*',
        'src/lib/*-validation*',
        'src/lib/store*',
        'src/lib/constants*',
      ],
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
