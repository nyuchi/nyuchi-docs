import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCENT,
  DEFAULT_TAGLINE,
  MAX_FOOTER_COLUMNS,
  MAX_NAV_LINKS,
  ShellOptionsError,
  isSafeHref,
  resolveShellOptions,
} from "../src/options.js";

const link = (label: string, href: string) => ({ label, href });

describe("resolveShellOptions: defaults", () => {
  it("fills in sensible defaults for no options", () => {
    expect(resolveShellOptions()).toEqual({
      navLinks: [],
      footerColumns: [],
      tagline: DEFAULT_TAGLINE,
      legal: "",
      accent: DEFAULT_ACCENT,
    });
    expect(resolveShellOptions(undefined)).toEqual(resolveShellOptions({}));
    expect(resolveShellOptions(null)).toEqual(resolveShellOptions({}));
  });

  it("defaults the tagline to the Ubuntu line and the accent to Starlight's", () => {
    expect(DEFAULT_TAGLINE).toBe("I am because we are.");
    expect(DEFAULT_ACCENT).toBe("var(--sl-color-accent)");
  });

  it("keeps valid options and trims text", () => {
    const out = resolveShellOptions({
      navLinks: [link(" API Docs ", "/api/")],
      footerColumns: [
        {
          title: "Ecosystem",
          links: [
            { label: "Website", href: "https://nyuchi.com", external: true },
          ],
        },
      ],
      tagline: " Hello. ",
      legal: "© 2026 Nyuchi Africa (Pvt) Ltd · Part of the Bundu Foundation",
      accent: "var(--color-gold)",
    });
    expect(out.navLinks).toEqual([link("API Docs", "/api/")]);
    expect(out.footerColumns[0].links[0]).toEqual({
      label: "Website",
      href: "https://nyuchi.com",
      external: true,
    });
    expect(out.tagline).toBe("Hello.");
    expect(out.accent).toBe("var(--color-gold)");
  });
});

describe("resolveShellOptions: rejects bad input", () => {
  const bad = (input: unknown, message: RegExp) => {
    expect(() => resolveShellOptions(input)).toThrow(ShellOptionsError);
    expect(() => resolveShellOptions(input)).toThrow(message);
  };

  it("names the option in every error", () => {
    bad({ navLink: [] }, /unknown option "navLink"/);
    bad("nope", /options must be an object/);
    bad([], /options must be an object/);
    bad({ navLinks: "x" }, /navLinks must be an array/);
    bad({ navLinks: [{ label: "", href: "/a/" }] }, /navLinks\[0\]\.label/);
    bad({ navLinks: [{ label: "A" }] }, /navLinks\[0\]\.href/);
    bad(
      { navLinks: [{ label: "A", href: "/a/", icon: "x" }] },
      /unknown key "icon"/,
    );
    bad(
      { navLinks: [{ label: "A", href: "/a/", external: "yes" }] },
      /external must be a boolean/,
    );
    bad({ footerColumns: [{ title: "T", links: [] }] }, /must not be empty/);
    bad({ footerColumns: [{ links: [link("A", "/a/")] }] }, /title/);
    bad({ tagline: "" }, /tagline must be a non-empty string/);
    bad({ legal: 3 }, /legal must be a non-empty string/);
    bad({ tagline: "x".repeat(121) }, /at most 120 characters/);
  });

  it("rejects unsafe hrefs", () => {
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,x",
      "//evil.example/",
      "mailto:a@b.c",
      "api/overview",
      "/has space",
      "/back\\slash",
      "",
    ]) {
      expect(() =>
        resolveShellOptions({ navLinks: [link("A", href)] }),
      ).toThrow(ShellOptionsError);
    }
    expect(isSafeHref("/api/")).toBe(true);
    expect(isSafeHref("https://nyuchi.com")).toBe(true);
    expect(isSafeHref("http://localhost:4321/")).toBe(true);
    expect(isSafeHref("ftp://x.example")).toBe(false);
  });

  it("rejects a literal colour or arbitrary CSS as the accent", () => {
    for (const accent of [
      "#ffd740",
      "rgb(255 215 64)",
      "gold",
      "red; background: url(x)",
      "var(--a); color: red",
      "var(--sl-color-accent) !important",
      "var(sl-color-accent)",
    ]) {
      expect(() => resolveShellOptions({ accent })).toThrow(/accent/);
    }
    expect(resolveShellOptions({ accent: "var(--color-gold)" }).accent).toBe(
      "var(--color-gold)",
    );
    expect(
      resolveShellOptions({ accent: "var(--brand, var(--color-gold))" }).accent,
    ).toBe("var(--brand, var(--color-gold))");
  });

  it("enforces the size limits and uniqueness", () => {
    const many = Array.from({ length: MAX_NAV_LINKS + 1 }, (_, i) =>
      link(`L${i}`, `/l${i}/`),
    );
    bad({ navLinks: many }, /at most 6 entries/);
    bad(
      { navLinks: [link("A", "/a/"), link("B", "/a/")] },
      /navLinks repeats "\/a\/"/,
    );
    const cols = Array.from({ length: MAX_FOOTER_COLUMNS + 1 }, (_, i) => ({
      title: `C${i}`,
      links: [link("A", "/a/")],
    }));
    bad({ footerColumns: cols }, /at most 4 entries/);
    bad(
      {
        footerColumns: [
          { title: "Docs", links: [link("A", "/a/")] },
          { title: "Docs", links: [link("B", "/b/")] },
        ],
      },
      /footerColumns repeats "Docs"/,
    );
    bad(
      {
        footerColumns: [
          {
            title: "Docs",
            links: Array.from({ length: 9 }, (_, i) =>
              link(`L${i}`, `/l${i}/`),
            ),
          },
        ],
      },
      /at most 8 entries/,
    );
  });
});
