import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      // typeCheck stays OFF here, unlike every other package in this repo.
      //
      // This is a Svelte package, and tsgolint cannot resolve `.svelte`
      // modules: enabling it produces 13 "Cannot find module
      // './SearchModal.svelte'" errors that say nothing about the code. The
      // correct type checker for this package is `svelte-check`, which
      // understands the component compiler.
      //
      // svelte-check currently reports 2 pre-existing errors here (a test
      // asserting `dependencies` on a package.json that only has
      // devDependencies, and a `hot` option vitest.config passes that Vitest 4
      // no longer accepts). Those are real and tracked separately — wiring
      // svelte-check into `check` before they are fixed would just move a red
      // build from one command to another.
      typeCheck: false,
    },
  },
});
