// Renders nothing itself: parses the HTML that `astro build` wrote to dist/
// and asserts the markup of the standard Mzizi shell (@bundu/ui/starlight) in
// it: landmarks, the active item, the link lists, the strips. This is the
// markup a visitor and a crawler actually get. Moved here from the retired
// nyuchi-docs-shell package; the shell's own unit tests live with it in
// mzizi-dev/packages-npm.
//
// It needs `pnpm --filter site build` first. CI runs `pnpm -r build` before
// `pnpm -r test`. With no build present the suite is skipped, loudly.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dist = resolve(process.cwd(), "dist");
const built = existsSync(resolve(dist, "platform/quickstart/index.html"));
if (!built) {
  console.warn(
    "[site] dist not found: skipping rendered-site tests. Run `pnpm --filter site build` first.",
  );
}

function load(path: string): Document {
  const html = readFileSync(resolve(dist, path, "index.html"), "utf8");
  return new DOMParser().parseFromString(html, "text/html");
}
const texts = (nodes: Iterable<Element>) =>
  [...nodes].map((n) => n.textContent?.replace(/\s+/g, " ").trim() ?? "");

const NAV = ["Platform", "API Docs", "Integrations", "Playbooks", "Identity"];

describe.skipIf(!built)("rendered shell: /platform/quickstart/", () => {
  const doc = load("platform/quickstart");

  it("has one banner header, one main nav, one main and one contentinfo footer", () => {
    expect(doc.querySelectorAll("body > .page > header.header")).toHaveLength(
      1,
    );
    expect(doc.querySelectorAll('nav[aria-label="Main"]')).toHaveLength(1);
    expect(doc.querySelectorAll("main")).toHaveLength(1);
    const footers = doc.querySelectorAll("footer[data-slot='mzizi-footer']");
    expect(footers).toHaveLength(1);
    // A direct child of <body>, so it is the page's contentinfo landmark.
    expect(footers[0].parentElement?.tagName).toBe("BODY");
    expect(
      doc.querySelector("main footer[data-slot='mzizi-footer']"),
    ).toBeNull();
  });

  it("header: the section links are the configured sections, in order", () => {
    const links = doc.querySelectorAll(
      '[data-slot="mzizi-header"] nav[aria-label="Sections"] a',
    );
    expect(texts(links)).toEqual(NAV);
    expect([...links].map((a) => a.getAttribute("href"))).toEqual([
      "/platform/",
      "/api/",
      "/integrations/",
      "/playbooks/",
      "/identity/",
    ]);
  });

  it("header: marks the current section and only that one", () => {
    const current = doc.querySelectorAll(
      '[data-slot="header-nav"] a[aria-current]',
    );
    expect(texts(current)).toEqual(["Platform"]);
  });

  it("header: menu button first, then brand, nav, then one action group", () => {
    const header = doc.querySelector('[data-slot="mzizi-header"]')!;
    const order = [
      ...header.querySelectorAll(
        'button[popovertarget], a.site-title, nav[aria-label="Sections"], [data-slot="pill-actions"]',
      ),
    ].map(
      (el) =>
        el.getAttribute("data-slot") ??
        el.className.split(" ")[0] ??
        el.tagName,
    );
    expect(order[0]).toBe("menu-trigger");
    expect(order.length).toBe(4);
    const menu = header.querySelector('[data-slot="menu-trigger"]')!;
    expect(menu.getAttribute("popovertarget")).toBe("starlight__sidebar");
    expect(doc.getElementById("starlight__sidebar")).not.toBeNull();
    expect(menu.textContent).toMatch(/menu/i); // an accessible name
  });

  it("header: one pill group holding the search trigger, GitHub and the theme select", () => {
    const pill = doc.querySelector('[data-slot="pill-actions"]')!;
    expect(pill.getAttribute("role")).toBe("toolbar");
    expect(pill.getAttribute("aria-label")).toBe("Site actions");
    expect(pill.querySelectorAll("button[data-nds-trigger]")).toHaveLength(1);
    expect(
      pill
        .querySelector("button[data-nds-trigger]")
        ?.getAttribute("aria-keyshortcuts"),
    ).toMatch(/Control\+K/);
    expect(pill.querySelectorAll("select")).toHaveLength(1);
    expect(
      pill.querySelectorAll('a[href="https://github.com/nyuchi"]'),
    ).toHaveLength(1);
    // The search modal has exactly one trigger in the header, never two.
    expect(doc.querySelectorAll("[data-nds-trigger]")).toHaveLength(1);
  });

  it("header: uses the site's accent token, not a literal colour", () => {
    const html = doc.documentElement.outerHTML;
    expect(html).not.toContain("--mzizi-brand-accent:");
    const header = doc.querySelector('[data-slot="mzizi-header"]')!;
    expect(header.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // The only inline styles are Starlight's own size variables for its icons
    // and select; the shell writes none, and none sets a colour.
    for (const el of header.querySelectorAll("[style]")) {
      expect(el.getAttribute("style")).toMatch(
        /^--sl-(?:icon-size|select-width):\s*[\d.]+(?:rem|em);?$/,
      );
    }
  });

  it("sidebar: strip, then logo header, then separator, then the groups", () => {
    const sidebar = doc.querySelector('[data-slot="mzizi-sidebar"]')!;
    const kids = [...sidebar.children];
    expect(kids[0].getAttribute("data-slot")).toBe("mineral-strip");
    expect(kids[0].getAttribute("aria-hidden")).toBe("true");
    expect(kids[1].className).toContain("mzizi-sidebar__brand");
    expect(kids[1].querySelector("a.site-title")).not.toBeNull();
    expect(kids[2].tagName).toBe("HR");
    expect(sidebar.querySelector("ul.top-level")).not.toBeNull();
  });

  it("sidebar: exactly one aria-current=page, the current page", () => {
    const current = doc.querySelectorAll(
      '[data-slot="mzizi-sidebar"] a[aria-current="page"]',
    );
    expect(texts(current)).toEqual(["Quickstart"]);
    expect(current[0].getAttribute("href")).toBe("/platform/quickstart/");
  });

  it("sidebar: opens the group that holds the current page and keeps every section", () => {
    const groups = [
      ...doc.querySelectorAll(
        '[data-slot="mzizi-sidebar"] ul.top-level > li > details > summary .large',
      ),
    ].map((n) => n.textContent?.trim());
    // Content links are untouched: every section is still listed, the three
    // internal-access groups included.
    for (const label of [
      "Platform",
      "API Docs",
      "Analytics",
      "Integrations",
      "Playbooks",
      "Mukoko Weather",
      "Mukoko Kweli",
      "Identity",
      "Tools",
      "Mzizi Tools",
      "Deployment",
    ]) {
      expect(groups, label).toContain(label);
    }
    const platform = doc.querySelector(
      '[data-slot="mzizi-sidebar"] ul.top-level > li > details',
    ) as HTMLDetailsElement;
    expect(platform.hasAttribute("open")).toBe(true);
    const topLinks = texts(
      doc.querySelectorAll('[data-slot="mzizi-sidebar"] ul.top-level > li > a'),
    );
    expect(topLinks).toEqual(["Console", "Conventions"]);
  });

  it("footer: strip, brand column with the tagline, three link columns, legal line", () => {
    const footer = doc.querySelector("footer[data-slot='mzizi-footer']")!;
    const strip = footer.querySelector('[data-slot="mineral-strip"]')!;
    expect(strip.className).toContain("mzizi-strip--footer");
    expect(strip.getAttribute("aria-hidden")).toBe("true");
    expect(
      footer.querySelector(".mzizi-footer__brand a.site-title"),
    ).not.toBeNull();
    expect(footer.querySelector(".mzizi-footer__tagline")?.textContent).toBe(
      "I am because we are.",
    );
    const columns = footer.querySelectorAll("nav.mzizi-footer__column");
    expect([...columns].map((c) => c.getAttribute("aria-label"))).toEqual([
      "Docs",
      "Products",
      "Ecosystem",
    ]);
    expect([...columns].map((c) => c.querySelector("h2")?.textContent)).toEqual(
      ["Docs", "Products", "Ecosystem"],
    );
    expect(texts(columns[0].querySelectorAll("a"))).toEqual([
      "Platform",
      "API Docs",
      "Analytics",
      "Integrations",
      "Playbooks",
      "Engineering",
    ]);
    expect(texts(columns[1].querySelectorAll("a"))).toEqual([
      "Mukoko Weather",
      "Mukoko Kweli",
      "Identity",
      "Console",
    ]);
    expect(
      [...columns[2].querySelectorAll("a")].map((a) => a.getAttribute("href")),
    ).toEqual([
      "https://nyuchi.com",
      "https://platform.nyuchi.com",
      "https://docs.bundu.org",
      "https://github.com/nyuchi",
    ]);
    expect(
      footer.querySelector(".mzizi-footer__legal")?.textContent?.trim(),
    ).toBe("© 2026 Nyuchi Africa (Pvt) Ltd · Part of the Bundu Foundation");
  });

  it("footer: external links open safely and say so", () => {
    for (const a of doc.querySelectorAll(
      "footer[data-slot='mzizi-footer'] a[href^='https://']",
    )) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
      expect(a.querySelector(".sr-only")?.textContent).toMatch(/new tab/);
    }
    for (const a of doc.querySelectorAll(
      "footer[data-slot='mzizi-footer'] a[href^='/']",
    )) {
      expect(a.getAttribute("target")).toBeNull();
    }
  });

  it("footer: no two links share a name but not a destination", () => {
    const byName = new Map<string, Set<string>>();
    for (const a of doc.querySelectorAll(
      "footer[data-slot='mzizi-footer'] nav a",
    )) {
      const name = a.textContent!.replace(/\(opens in a new tab\)/, "").trim();
      byName.set(
        name,
        (byName.get(name) ?? new Set()).add(a.getAttribute("href")!),
      );
    }
    for (const [name, hrefs] of byName) {
      expect(hrefs.size, `"${name}" goes to ${[...hrefs].join(" and ")}`).toBe(
        1,
      );
    }
  });

  it("keeps the site's own page-edge strip as well as the two shell strips", () => {
    expect(doc.querySelectorAll('[data-slot="mineral-stripe"]')).toHaveLength(
      1,
    );
    expect(doc.querySelectorAll('[data-slot="mineral-strip"]')).toHaveLength(2);
  });
});

describe.skipIf(!built)("rendered shell: home page", () => {
  const doc = load(".");

  it("shows the sidebar and the shell on the home page", () => {
    expect(doc.documentElement.hasAttribute("data-has-sidebar")).toBe(true);
    expect(doc.querySelector('[data-slot="mzizi-sidebar"]')).not.toBeNull();
    expect(doc.querySelector('[data-slot="mzizi-footer"]')).not.toBeNull();
    expect(doc.querySelector('[data-slot="mzizi-header"]')).not.toBeNull();
  });

  it("marks no header link and no sidebar item as current on the home page", () => {
    expect(
      doc.querySelectorAll('[data-slot="header-nav"] a[aria-current]'),
    ).toHaveLength(0);
    expect(
      doc.querySelectorAll('[data-slot="mzizi-sidebar"] a[aria-current]'),
    ).toHaveLength(0);
  });
});

describe.skipIf(!built)("rendered shell: every built page", () => {
  it("carries the header, the sidebar and the footer exactly once", () => {
    const pages: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = resolve(dir, name);
        if (statSync(full).isDirectory()) {
          if (name !== "_astro" && name !== "pagefind") walk(full);
        } else if (name === "index.html") pages.push(full);
      }
    };
    walk(dist);
    expect(pages.length).toBeGreaterThan(50);
    for (const page of pages) {
      const html = readFileSync(page, "utf8");
      if (!html.includes('class="page ')) continue; // a redirect stub
      for (const slot of ["mzizi-header", "mzizi-sidebar", "mzizi-footer"]) {
        const count = html.split(`data-slot="${slot}"`).length - 1;
        expect(count, `${page} ${slot}`).toBe(1);
      }
    }
  });
});
