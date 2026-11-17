// Verifies the public manifest shape of nyuchi-docs-search.
import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };

describe("package manifest", () => {
  it("declares the expected entry exports", () => {
    expect(pkg.name).toBe("@nyuchi/nyuchi-docs-search");
    expect(pkg.exports["."]).toMatchObject({
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    });
    expect(pkg.exports["./plugin"]).toMatchObject({
      import: "./dist/plugin.js",
    });
    expect(pkg.exports["./Search.astro"]).toBe("./dist/Search.astro");
  });

  it("declares Starlight as the only peer dependency", () => {
    expect(pkg.peerDependencies["@astrojs/starlight"]).toMatch(/0\.39/);
    expect(Object.keys(pkg.peerDependencies)).toEqual(["@astrojs/starlight"]);
  });

  it("declares no runtime dependencies", () => {
    expect(
      Object.keys((pkg as { dependencies?: object }).dependencies ?? {}),
    ).toHaveLength(0);
  });

  it("carries no Svelte: no field, export, dependency or toolchain", () => {
    const text = JSON.stringify(pkg).toLowerCase();
    expect(text).not.toContain("svelte");
    expect(pkg).not.toHaveProperty("svelte");
  });
});
