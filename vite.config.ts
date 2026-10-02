// Vite+ configuration: the org's standard check, lint and format settings.
// See nyuchi/.github/.github/workflows/reusable-vite-plus.yml.
import { defineConfig } from "vite-plus";

export default defineConfig({
  // `vp check` reads ONLY this block, not .oxfmtrc.json. These values mirror
  // nyuchi/.github/.oxfmtrc.json, which the org-required `vite-plus / fmt`
  // job uses on Markdown and JSON. Keep the two identical: two formatters
  // with different settings on one file can never both pass.
  fmt: {
    printWidth: 80,
    proseWrap: "preserve",
    tabWidth: 2,
    useTabs: false,
    endOfLine: "lf",
    trailingComma: "all",
    sortPackageJson: false,
    overrides: [
      {
        files: ["*.md", "*.mdx"],
        options: { embeddedLanguageFormatting: "off" },
      },
    ],
  },
  // No `lint` block here, deliberately. vite-plus 0.3 applies the workspace
  // root's lint options to every package, which would switch typeCheck on in
  // nyuchi-docs-search (a Svelte package that keeps it off; see its config).
  // Type checking is on in each of the other packages' own vite.config.ts.
});
