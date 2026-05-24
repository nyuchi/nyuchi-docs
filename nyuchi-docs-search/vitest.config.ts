import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte({
      hot: false,
      compilerOptions: { dev: false },
      // Skip @sveltejs/vite-plugin-svelte's default preprocess (which calls
      // vite's CSS preprocessor and breaks under vitest's environment shim).
      preprocess: [],
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    server: {
      deps: {
        inline: [/^svelte/, '@testing-library/svelte'],
      },
    },
  },
  resolve: {
    conditions: ['browser'],
  },
});
