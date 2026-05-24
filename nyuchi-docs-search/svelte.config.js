// Minimal svelte.config.js for @sveltejs/package. Preprocess is left empty to
// keep the package free of postcss / typescript-in-style requirements.
/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [],
  // Also publish .astro files alongside .svelte / .ts so the Starlight
  // component override can reference nyuchi-docs-search/Search.astro.
  kit: undefined,
};

export default config;
