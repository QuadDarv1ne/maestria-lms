import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    testTimeout: 15000,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    css: false,
    server: {
      deps: {
        inline: ['@tailwindcss/postcss'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test-setup.ts',
        'src/**/*.d.ts',
        'src/generated/**',
        // Non-API app tree stays out of scope for now: pages/layouts are
        // rendered as React components, which the current suite does not
        // exercise. API routes below are measured on purpose.
        'src/app/error.tsx',
        'src/app/global-error.tsx',
        'src/app/layout.tsx',
        'src/app/not-found.tsx',
        'src/app/sitemap.ts',
        'src/app/(main)/**',
        'src/app/admin/**',
        'src/app/age-rating/**',
        'src/app/cookies/**',
        'src/app/course-editor/**',
        'src/app/edu-info/**',
        'src/app/fonts/**',
        'src/app/forbidden/**',
        'src/app/internal-error/**',
        'src/app/lesson/**',
        'src/app/license/**',
        'src/app/maintenance/**',
        'src/app/offer/**',
        'src/app/payment/**',
        'src/app/personal-data/**',
        'src/app/privacy/**',
        'src/app/refund/**',
        'src/app/reset-password/**',
        'src/app/robots/**',
        'src/app/rules/**',
        'src/app/status/**',
        'src/app/teacher/**',
        'src/app/terms/**',
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
      // Measured 2026-09-27 after src/app/api was brought into scope.
      // Area gates carry the real signal; the aggregate numbers are a
      // floor for the newly measured API surface (65 route files, of which
      // the auth/payment/enrolment paths are covered by route-level tests).
      thresholds: {
        // Aggregate floor across every measured file.
        lines: 24,
        statements: 24,
        branches: 60,
        functions: 60,
        // Shared library modules.
        'src/lib/**': { lines: 75, statements: 75, branches: 75, functions: 80 },
        // API routes: critical paths only, raised as tests are added.
        'src/app/api/**': { lines: 10, statements: 10, branches: 45, functions: 18 },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
