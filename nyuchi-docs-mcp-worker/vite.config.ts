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

// @ts-expect-error TS2321: comparing this config against vite-plus's UserConfig
// exceeds TS's structural-comparison depth. Root cause: cloudflare() returns
// Plugin[] typed against the raw `vite` package, while vite-plus vendors its
// own independently-declared (structurally near-identical, nominally distinct)
// Plugin type via @voidzero-dev/vite-plus-core — comparing two large, deeply
// generic hook interfaces from different packages is exactly what exceeds
// TS's depth limit. Confirmed harmless at runtime: vite-plus's plugin
// pipeline accepts real vite.Plugin objects regardless of which package
// declared the type. Revisit if vite-plus's vendored core types converge with
// vite 8's Plugin shape.
export default defineConfig({
  // Spread, not nest: cloudflare() already returns Plugin[]; nesting it as
  // `[cloudflare()]` would produce Plugin[][] on top of the issue above.
  plugins: [...cloudflare()],
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
