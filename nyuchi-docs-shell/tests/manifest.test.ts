// Verifies the manifest of nyuchi-docs-shell and that what it exports exists.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };

// Vitest runs with the package directory as the working directory.
const root = `${resolve(process.cwd())}/`;
const FRAMEWORKS = /svelte|react|vue|preact|solid|lit|alpine|jquery/i;

describe("package manifest", () => {
  it("is the private, workspace-only shell package", () => {
    expect(pkg.name).toBe("@nyuchi/nyuchi-docs-shell");
    expect(pkg.private).toBe(true);
    expect(pkg.type).toBe("module");
  });

  it("exports the plugin and the four components and the stylesheet", () => {
    expect(pkg.exports["./plugin"]).toMatchObject({
      import: "./dist/plugin.js",
    });
    for (const name of [
      "Header",
      "Sidebar",
      "Footer",
      "PageFrame",
      "MobileMenuToggle",
    ]) {
      expect(pkg.exports[`./${name}.astro` as keyof typeof pkg.exports]).toBe(
        `./dist/${name}.astro`,
      );
    }
    expect(pkg.exports["./shell.css"]).toBe("./dist/shell.css");
  });

  it("builds every file it exports from a source file", () => {
    for (const [key, value] of Object.entries(pkg.exports)) {
      if (typeof value !== "string") continue;
      const source = value.replace("./dist/", "src/");
      expect(existsSync(`${root}${source}`), `${key} -> ${source}`).toBe(true);
    }
    // The build script copies exactly the non-TypeScript sources.
    for (const file of [
      "Header.astro",
      "Sidebar.astro",
      "Footer.astro",
      "PageFrame.astro",
      "MobileMenuToggle.astro",
      "shell.css",
    ]) {
      expect(pkg.scripts.build).toContain(`src/${file}`);
    }
  });

  it("depends on Starlight only, as a peer, with no runtime dependencies", () => {
    expect(Object.keys(pkg.peerDependencies)).toEqual(["@astrojs/starlight"]);
    expect(
      Object.keys((pkg as { dependencies?: object }).dependencies ?? {}),
    ).toHaveLength(0);
  });

  it("carries no UI framework: no field, export, dependency or toolchain", () => {
    expect(JSON.stringify(pkg)).not.toMatch(FRAMEWORKS);
  });

  it("imports no UI framework in any source file", () => {
    for (const file of [
      "Header.astro",
      "Sidebar.astro",
      "Footer.astro",
      "PageFrame.astro",
      "lib/nav.ts",
      "lib/scroll-state.ts",
      "plugin.ts",
      "options.ts",
    ]) {
      const text = readFileSync(`${root}src/${file}`, "utf8");
      const imports = [
        ...text.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g),
      ].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(FRAMEWORKS);
      }
    }
  });
});
