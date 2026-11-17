import { describe, expect, it, vi } from "vitest";
import {
  COMPONENTS,
  OPTIONS_MODULE_ID,
  SHELL_CSS,
  starlightMziziShell,
} from "../src/plugin.js";
import { ShellOptionsError } from "../src/options.js";

function run(options: unknown, config: Record<string, unknown> = {}) {
  const plugin = starlightMziziShell(options as never);
  const updateConfig = vi.fn();
  const logger = { info: vi.fn(), warn: vi.fn() };
  let viteSetup: ((arg: unknown) => void) | undefined;
  const addIntegration = vi.fn((integration) => {
    viteSetup = integration.hooks["astro:config:setup"];
  });
  plugin.hooks["config:setup"]({
    updateConfig,
    addIntegration,
    config,
    logger,
  });
  const updateAstro = vi.fn();
  viteSetup?.({ updateConfig: updateAstro });
  return { plugin, updateConfig, addIntegration, updateAstro, logger };
}

describe("starlightMziziShell", () => {
  it("is a named Starlight plugin", () => {
    expect(starlightMziziShell().name).toBe("nyuchi-docs-shell");
  });

  it("validates options when called, so a bad config fails at load", () => {
    expect(() => starlightMziziShell({ accent: "#fff" } as never)).toThrow(
      ShellOptionsError,
    );
    expect(() => starlightMziziShell({ nope: 1 } as never)).toThrow(
      /unknown option/,
    );
  });

  it("registers Header, Sidebar, PageFrame and a blank MobileMenuToggle", () => {
    const { updateConfig } = run({});
    const { components } = updateConfig.mock.calls[0][0];
    expect(components).toEqual({ ...COMPONENTS });
    expect(Object.keys(components).sort()).toEqual([
      "Header",
      "MobileMenuToggle",
      "PageFrame",
      "Sidebar",
    ]);
  });

  it("keeps the other overrides, the search among them", () => {
    const { updateConfig } = run(
      {},
      { components: { Search: "@nyuchi/nyuchi-docs-search/Search.astro" } },
    );
    expect(updateConfig.mock.calls[0][0].components.Search).toBe(
      "@nyuchi/nyuchi-docs-search/Search.astro",
    );
  });

  it("never replaces a component the site already overrides", () => {
    const { updateConfig, logger } = run(
      {},
      { components: { PageFrame: "./src/components/PageFrame.astro" } },
    );
    const { components } = updateConfig.mock.calls[0][0];
    expect(components.PageFrame).toBe("./src/components/PageFrame.astro");
    expect(components.Header).toBe(COMPONENTS.Header);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("PageFrame is already overridden"),
    );
  });

  it("adds the shell CSS before the site's own CSS", () => {
    const { updateConfig } = run({}, { customCss: ["./src/styles/theme.css"] });
    expect(updateConfig.mock.calls[0][0].customCss).toEqual([
      SHELL_CSS,
      "./src/styles/theme.css",
    ]);
  });

  it("serves the resolved options as a virtual module", () => {
    const { updateAstro } = run({
      navLinks: [{ label: "API", href: "/api/" }],
      legal: "© 2026",
    });
    const vitePlugin = updateAstro.mock.calls[0][0].vite.plugins[0];
    const resolved = vitePlugin.resolveId(OPTIONS_MODULE_ID);
    expect(resolved).toBe(`\0${OPTIONS_MODULE_ID}`);
    expect(vitePlugin.resolveId("some-other-module")).toBeUndefined();
    expect(vitePlugin.load("some-other-module")).toBeUndefined();
    const source: string = vitePlugin.load(resolved);
    const body = JSON.parse(
      source.replace(/^export default /, "").replace(/;$/, ""),
    );
    expect(body.navLinks).toEqual([{ label: "API", href: "/api/" }]);
    expect(body.legal).toBe("© 2026");
    expect(body.tagline).toBe("I am because we are.");
    expect(body.accent).toBe("var(--sl-color-accent)");
  });
});
