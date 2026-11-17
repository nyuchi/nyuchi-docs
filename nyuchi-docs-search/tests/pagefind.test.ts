import { afterEach, describe, expect, it, vi } from "vitest";

// The runtime is cached at module level, so each test gets a fresh module.
async function clientFor(runtimeSource: string) {
  vi.resetModules();
  const { createPagefindClient } = await import("../src/lib/pagefind.js");
  const url = `data:text/javascript,${encodeURIComponent(runtimeSource)}`;
  return createPagefindClient({ baseUrl: url });
}

afterEach(() => vi.resetModules());

describe("createPagefindClient", () => {
  it("returns nothing for a blank query without loading the index", async () => {
    const client = await clientFor('throw new Error("must not load")');
    expect(await client.search("   ")).toEqual([]);
  });

  it("returns nothing when the index cannot be loaded", async () => {
    const client = await clientFor('throw new Error("no index")');
    expect(await client.search("quickstart")).toEqual([]);
  });

  it("maps results to hits with title, breadcrumb and a tag-free snippet", async () => {
    const client = await clientFor(`
      export async function search() {
        return { results: [
          { id: 'a', data: async () => ({
              url: '/analytics/dashboards/create-dashboard/',
              meta: { title: 'Create a dashboard' },
              excerpt: 'Build a <mark>dashboard</mark> from data.' }) },
          { id: 'b', data: async () => ({ url: '/', meta: {}, excerpt: '' }) },
        ] };
      }`);
    const hits = await client.search("dashboard");
    expect(hits).toEqual([
      {
        id: "a",
        url: "/analytics/dashboards/create-dashboard/",
        title: "Create a dashboard",
        breadcrumb: "Analytics / Dashboards",
        snippet: "Build a dashboard from data.",
      },
      { id: "b", url: "/", title: "/", breadcrumb: "Home", snippet: "" },
    ]);
  });

  it("keeps only the top ten results", async () => {
    const client = await clientFor(`
      export async function search() {
        return { results: Array.from({ length: 25 }, (_, i) => ({
          id: String(i),
          data: async () => ({ url: '/p/' + i, meta: { title: 'T' + i }, excerpt: '' }),
        })) };
      }`);
    expect(await client.search("t")).toHaveLength(10);
  });
});
