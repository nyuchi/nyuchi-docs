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
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare()],
});
