import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  package: {
    exports: (filepath) => {
      // Only expose top-level files (.svelte, .ts, .js) from src/
      return /^(index\.(ts|js)|plugin\.(ts|js)|.*\.svelte|style\.css|lib\/.*\.(ts|js))$/.test(
        filepath
      );
    },
  },
};

export default config;
