/**
 * Vite+ (Rolldown) builds this Worker, per the ecosystem rule: Astro on top,
 * Rust or TypeScript underneath, Vite+ under both.
 *
 * `@cloudflare/vite-plugin` reads wrangler.toml directly, so the entry, the
 * bindings and the routes stay declared in exactly one place. Nothing is
 * duplicated here on purpose.
 *
 * Vite+ replaces the BUNDLER, not the deploy path — Cloudflare Workers Builds
 * still deploys this repo, and `deploy` points wrangler at the config Vite+
 * generates rather than the source one. Deploying the source config would
 * re-bundle with wrangler's own esbuild and silently ignore this file.
 */
import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare()],
  // Type checking is OPT-IN in Vite+. Without these two lines `vp check` runs
  // oxlint only and reports "pass" on `const x: number = "nope"` — verified
  // against tsc, which flags TS2322 on that exact line. Adopting the unified
  // command without this block would delete the type gate while looking greener.
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
