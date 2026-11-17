// Starlight plugin that replaces the stock chrome with the standard Mzizi
// shell: header, sidebar and footer.
//
// Usage in astro.config.mjs:
//   starlight({
//     plugins: [
//       starlightMziziShell({
//         navLinks: [{ label: "API", href: "/api/" }],
//         footerColumns: [{ title: "Docs", links: [{ label: "API", href: "/api/" }] }],
//         legal: "© 2026 Example",
//       }),
//     ],
//   })
//
// Components it registers: Header, Sidebar, PageFrame and a blank
// MobileMenuToggle (the header carries the menu button itself). The footer is
// mounted by PageFrame, not by Starlight's Footer slot, because Starlight
// renders Footer inside the narrow article column and the standard footer is
// full width with its own top-level landmark. A site that already overrides
// PageFrame keeps its own and wraps `@nyuchi/nyuchi-docs-shell/PageFrame.astro`.

import { resolveShellOptions } from "./options.js";
import type { MziziShellOptions } from "./options.js";

// Starlight's plugin contract is loosely typed across versions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StarlightPlugin = any;

export const OPTIONS_MODULE_ID = "virtual:nyuchi-docs-shell/options";
const RESOLVED_ID = `\0${OPTIONS_MODULE_ID}`;
export const SHELL_CSS = "@nyuchi/nyuchi-docs-shell/shell.css";

export const COMPONENTS = {
  Header: "@nyuchi/nyuchi-docs-shell/Header.astro",
  Sidebar: "@nyuchi/nyuchi-docs-shell/Sidebar.astro",
  PageFrame: "@nyuchi/nyuchi-docs-shell/PageFrame.astro",
  // Blanked: the header renders its own menu button (see Header.astro).
  MobileMenuToggle: "@nyuchi/nyuchi-docs-shell/MobileMenuToggle.astro",
} as const;

export function starlightMziziShell(
  options: MziziShellOptions = {},
): StarlightPlugin {
  // Validate at call time so a bad option fails the config load, not a render.
  const resolved = resolveShellOptions(options);

  return {
    name: "nyuchi-docs-shell",
    hooks: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "config:setup"({ updateConfig, addIntegration, config, logger }: any) {
        const existing: Record<string, string> = config?.components ?? {};
        const components: Record<string, string> = { ...existing };
        for (const [name, path] of Object.entries(COMPONENTS)) {
          if (existing[name]) {
            logger?.info?.(
              `${name} is already overridden by the site; leaving it. Compose ${path} inside it to get the Mzizi shell.`,
            );
          } else {
            components[name] = path;
          }
        }

        updateConfig({
          components,
          // Ours first, so the site's own theme can still refine it.
          customCss: [SHELL_CSS, ...(config?.customCss ?? [])],
        });

        addIntegration({
          name: "nyuchi-docs-shell-options",
          hooks: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "astro:config:setup": ({ updateConfig: updateAstro }: any) => {
              updateAstro({
                vite: {
                  plugins: [
                    {
                      name: "vite-plugin-nyuchi-docs-shell-options",
                      resolveId(id: string) {
                        return id === OPTIONS_MODULE_ID
                          ? RESOLVED_ID
                          : undefined;
                      },
                      load(id: string) {
                        return id === RESOLVED_ID
                          ? `export default ${JSON.stringify(resolved)};`
                          : undefined;
                      },
                    },
                  ],
                },
              });
            },
          },
        });
      },
    },
  };
}

export default starlightMziziShell;
