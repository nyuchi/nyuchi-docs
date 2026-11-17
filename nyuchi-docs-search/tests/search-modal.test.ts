import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSearchModal,
  initDocsSearch,
  type SearchModalController,
} from "../src/lib/search-modal.js";
import type { AiClient, StreamEvent } from "../src/lib/ai-client.js";
import type { PagefindClient, SearchHit } from "../src/lib/pagefind.js";

const hits: SearchHit[] = [
  {
    id: "1",
    url: "/platform/quickstart",
    title: "Platform quickstart",
    breadcrumb: "Platform",
    snippet: "Get started in five minutes.",
  },
  {
    id: "2",
    url: "/analytics/connect-data",
    title: "Connect data",
    breadcrumb: "Analytics",
    snippet: "Wire data sources.",
  },
  {
    id: "3",
    url: "/api/overview",
    title: "API overview",
    breadcrumb: "Api",
    snippet: "One gateway.",
  },
];

const pagefind: PagefindClient = {
  search: vi.fn(async (q: string) => (q === "none" ? [] : hits)),
};

const flush = () => new Promise((r) => setTimeout(r, 0));

function key(target: EventTarget, k: string, init: KeyboardEventInit = {}) {
  const ev = new KeyboardEvent("keydown", {
    key: k,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(ev);
  return ev;
}

async function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
}

const q = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const options = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));

let trigger: HTMLButtonElement;
let modal: SearchModalController;
const navigate = vi.fn();

function mount(extra: Parameters<typeof createSearchModal>[0] = {}) {
  modal = createSearchModal({ trigger, pagefind, navigate, ...extra });
}

beforeEach(() => {
  document.body.innerHTML =
    '<button id="t" type="button">Search</button><button id="other">x</button>';
  trigger = document.getElementById("t") as HTMLButtonElement;
  navigate.mockClear();
});
afterEach(() => modal?.destroy());

describe("open and close", () => {
  it("opens on Ctrl+K and Cmd+K, toggles, and Escape closes", () => {
    mount();
    expect(document.querySelector(".nds-overlay")).toBeNull();
    key(document, "k", { ctrlKey: true });
    expect(modal.isOpen()).toBe(true);
    expect(q<HTMLElement>(".nds-overlay").hidden).toBe(false);
    key(document, "k", { metaKey: true });
    expect(modal.isOpen()).toBe(false);
    key(document, "K", { ctrlKey: true });
    expect(modal.isOpen()).toBe(true);
    const esc = key(document, "Escape");
    expect(esc.defaultPrevented).toBe(true);
    expect(modal.isOpen()).toBe(false);
    expect(q<HTMLElement>(".nds-overlay").hidden).toBe(true);
  });

  it("opens from the trigger and reflects it in aria-expanded", () => {
    mount();
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    modal.close();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("exposes dialog semantics and focuses the input", () => {
    mount();
    modal.open();
    const dialog = q('[role="dialog"]');
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Search documentation");
    expect(document.activeElement).toBe(q(".nds-input"));
    expect(q(".nds-input").getAttribute("role")).toBe("combobox");
  });

  it("returns focus to the element that had it, and to the trigger otherwise", () => {
    mount();
    const other = document.getElementById("other")!;
    other.focus();
    modal.open();
    key(document, "Escape");
    expect(document.activeElement).toBe(other);

    other.remove();
    modal.open();
    modal.close();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when the backdrop is clicked but not when the modal is", () => {
    mount();
    modal.open();
    q(".nds-modal").dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true }),
    );
    expect(modal.isOpen()).toBe(true);
    q(".nds-overlay").dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true }),
    );
    expect(modal.isOpen()).toBe(false);
  });

  it("removes its listeners and DOM on destroy", () => {
    mount();
    modal.open();
    modal.destroy();
    expect(document.querySelector(".nds-overlay")).toBeNull();
    key(document, "k", { ctrlKey: true });
    expect(document.querySelector(".nds-overlay")).toBeNull();
  });
});

describe("search tab", () => {
  it("prompts before typing and reports no results", async () => {
    mount();
    modal.open();
    expect(q(".nds-empty").textContent).toMatch(/ask ai or search docs/i);
    await type(q<HTMLInputElement>(".nds-input"), "none");
    expect(q(".nds-empty").textContent).toBe('No results for "none"');
  });

  it("renders hits with title, breadcrumb and snippet, first one selected", async () => {
    mount();
    modal.open();
    await type(q<HTMLInputElement>(".nds-input"), "plat");
    const items = options();
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("Platform quickstart");
    expect(items[0].textContent).toContain("Platform");
    expect(items[0].textContent).toContain("Get started in five minutes.");
    expect(items.map((i) => i.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(q(".nds-input").getAttribute("aria-activedescendant")).toBe(
      items[0].id,
    );
    expect(q(".nds-input").getAttribute("aria-expanded")).toBe("true");
  });

  it("never turns a hostile title or snippet into markup", async () => {
    const evil: PagefindClient = {
      search: async () => [
        {
          id: "x",
          url: "/x",
          title: "<img src=x onerror=alert(1)>",
          breadcrumb: "B",
          snippet: "<script>1</script>",
        },
      ],
    };
    mount({ pagefind: evil });
    modal.open();
    await type(q<HTMLInputElement>(".nds-input"), "x");
    expect(
      document.querySelector(".nds-result img, .nds-result script"),
    ).toBeNull();
    expect(options()[0].textContent).toContain("<img src=x");
  });

  it("moves with ArrowDown/ArrowUp and stops at both ends", async () => {
    mount();
    modal.open();
    const input = q<HTMLInputElement>(".nds-input");
    await type(input, "a");
    const sel = () =>
      options().findIndex((o) => o.getAttribute("aria-selected") === "true");
    key(input, "ArrowDown");
    expect(sel()).toBe(1);
    key(input, "ArrowDown");
    key(input, "ArrowDown");
    expect(sel()).toBe(2);
    key(input, "ArrowUp");
    expect(sel()).toBe(1);
    key(input, "ArrowUp");
    key(input, "ArrowUp");
    expect(sel()).toBe(0);
    expect(q(".nds-input").getAttribute("aria-activedescendant")).toBe(
      options()[0].id,
    );
  });

  it("navigates to the selected result on Enter and closes the modal", async () => {
    mount();
    modal.open();
    const input = q<HTMLInputElement>(".nds-input");
    await type(input, "a");
    key(input, "ArrowDown");
    const ev = key(input, "Enter");
    expect(ev.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/analytics/connect-data");
    expect(modal.isOpen()).toBe(false);
  });

  it("does nothing on Enter with no results", async () => {
    mount();
    modal.open();
    key(q(".nds-input"), "Enter");
    expect(navigate).not.toHaveBeenCalled();
    expect(modal.isOpen()).toBe(true);
  });

  it("ignores a slow earlier search that resolves after a newer one", async () => {
    let release!: (h: SearchHit[]) => void;
    const slow = new Promise<SearchHit[]>((r) => (release = r));
    const racing: PagefindClient = {
      search: vi
        .fn()
        .mockReturnValueOnce(slow)
        .mockResolvedValueOnce([hits[2]]),
    };
    mount({ pagefind: racing });
    modal.open();
    const input = q<HTMLInputElement>(".nds-input");
    await type(input, "a");
    await type(input, "ab");
    release(hits);
    await flush();
    expect(options().map((o) => o.textContent)).toHaveLength(1);
    expect(options()[0].textContent).toContain("API overview");
  });

  it("survives the search backend throwing", async () => {
    mount({
      pagefind: {
        search: async () => {
          throw new Error("boom");
        },
      },
    });
    modal.open();
    await type(q<HTMLInputElement>(".nds-input"), "a");
    expect(q(".nds-empty").textContent).toMatch(/no results/i);
  });
});

describe("focus trap", () => {
  it("wraps Tab and Shift+Tab inside the modal", () => {
    mount({ aiUrl: "https://ai.example", createAi: aiClient([]).create });
    modal.open();
    const input = q<HTMLInputElement>(".nds-input");
    // Tab order on the Search tab: the input, then the active tab.
    const activeTab = q<HTMLElement>('[role="tab"][aria-selected="true"]');
    activeTab.focus();
    const forward = key(activeTab, "Tab");
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
    const back = key(input, "Tab", { shiftKey: true });
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(activeTab);
  });

  it("pulls focus back in if it ever sits outside the modal", () => {
    mount();
    modal.open();
    document.getElementById("other")!.focus();
    const ev = key(document, "Tab");
    expect(ev.defaultPrevented).toBe(true);
    expect(q(".nds-modal").contains(document.activeElement)).toBe(true);
  });
});

function aiClient(events: StreamEvent[] | (() => AsyncGenerator<StreamEvent>)) {
  const chat = vi.fn((_messages) =>
    typeof events === "function"
      ? events()
      : (async function* () {
          for (const e of events) yield e;
        })(),
  );
  const create = vi.fn(
    () => ({ chat, health: async () => ({ ok: true }) }) as unknown as AiClient,
  );
  return { chat, create };
}

describe("Ask AI tab", () => {
  it("is only offered when an Ask-AI URL is configured", () => {
    mount();
    modal.open();
    expect(document.querySelector('[role="tablist"]')).toBeNull();
    modal.destroy();
    mount({ aiUrl: "https://ai.example" });
    modal.open();
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(2);
  });

  it("switches tabs with aria-selected and swaps the placeholder", () => {
    mount({ aiUrl: "https://ai.example", createAi: aiClient([]).create });
    modal.open();
    const [searchTab, aiTab] = Array.from(
      document.querySelectorAll<HTMLElement>('[role="tab"]'),
    );
    expect(searchTab.getAttribute("aria-selected")).toBe("true");
    aiTab.click();
    expect(aiTab.getAttribute("aria-selected")).toBe("true");
    expect(searchTab.getAttribute("aria-selected")).toBe("false");
    expect(q<HTMLInputElement>(".nds-input").placeholder).toMatch(/ask ai/i);
    expect(
      q<HTMLElement>("#" + aiTab.getAttribute("aria-controls")).hidden,
    ).toBe(false);
    key(aiTab, "ArrowLeft");
    expect(searchTab.getAttribute("aria-selected")).toBe("true");
  });

  it("streams tokens into one answer and attaches citations", async () => {
    const { create, chat } = aiClient([
      { type: "token", text: "Hello " },
      { type: "token", text: "world" },
      {
        type: "citations",
        citations: [
          {
            index: 1,
            url: "/platform/quickstart",
            title: "Quickstart",
            breadcrumb: "Platform",
          },
        ],
      },
      { type: "done" },
    ]);
    mount({ aiUrl: "https://ai.example", source: "nyuchi", createAi: create });
    modal.open();
    document.querySelectorAll<HTMLElement>('[role="tab"]')[1].click();
    const composer = q<HTMLTextAreaElement>(".nds-composer-input");
    composer.value = "how do I start?";
    composer.dispatchEvent(new Event("input"));
    const ev = key(composer, "Enter");
    expect(ev.defaultPrevented).toBe(true);
    await flush();
    await flush();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://ai.example",
        source: "nyuchi",
      }),
    );
    expect(chat).toHaveBeenCalledWith([
      { role: "user", content: "how do I start?" },
    ]);
    const msgs = document.querySelectorAll(".nds-msg");
    expect(msgs).toHaveLength(2);
    expect(msgs[1].querySelector(".nds-content")!.textContent).toBe(
      "Hello world",
    );
    const cite = msgs[1].querySelector<HTMLAnchorElement>(
      '[data-testid="citation"]',
    )!;
    expect(cite.getAttribute("href")).toBe("/platform/quickstart");
    expect(cite.textContent).toContain("Quickstart");
    expect(document.querySelector(".nds-caret")).toBeNull();
    expect(composer.disabled).toBe(false);
  });

  it("sends the question typed in the main input when switching to Ask AI", async () => {
    const { create, chat } = aiClient([
      { type: "token", text: "ok" },
      { type: "done" },
    ]);
    mount({ aiUrl: "https://ai.example", createAi: create });
    modal.open();
    await type(q<HTMLInputElement>(".nds-input"), "what is mzizi");
    document.querySelectorAll<HTMLElement>('[role="tab"]')[1].click();
    await flush();
    await flush();
    expect(chat).toHaveBeenCalledWith([
      { role: "user", content: "what is mzizi" },
    ]);
    expect(q<HTMLInputElement>(".nds-input").value).toBe("");
  });

  it("shows an error state, keeps the history clean, and lets the reader retry", async () => {
    const { create, chat } = aiClient([{ type: "error", error: "HTTP 503" }]);
    mount({ aiUrl: "https://ai.example", createAi: create });
    modal.open();
    document.querySelectorAll<HTMLElement>('[role="tab"]')[1].click();
    const composer = q<HTMLTextAreaElement>(".nds-composer-input");
    composer.value = "hi";
    composer.dispatchEvent(new Event("input"));
    q<HTMLButtonElement>(".nds-send").click();
    await flush();
    await flush();
    const err = q<HTMLElement>(".nds-error");
    expect(err.getAttribute("role")).toBe("alert");
    expect(err.hidden).toBe(false);
    expect(err.textContent).toContain("HTTP 503");
    expect(document.querySelectorAll(".nds-msg-assistant")).toHaveLength(0);
    composer.value = "again";
    composer.dispatchEvent(new Event("input"));
    q<HTMLButtonElement>(".nds-send").click();
    await flush();
    await flush();
    expect(chat).toHaveBeenLastCalledWith([{ role: "user", content: "again" }]);
  });

  it("reports a network failure thrown by the client", async () => {
    const { create } = aiClient(() => {
      throw new Error("Failed to fetch");
    });
    mount({ aiUrl: "https://ai.example", createAi: create });
    modal.open();
    document.querySelectorAll<HTMLElement>('[role="tab"]')[1].click();
    const composer = q<HTMLTextAreaElement>(".nds-composer-input");
    composer.value = "hi";
    q<HTMLButtonElement>(".nds-send").disabled = false;
    q<HTMLButtonElement>(".nds-send").click();
    await flush();
    await flush();
    expect(q(".nds-error").textContent).toContain("Failed to fetch");
  });

  it("Stop aborts the stream without showing an error", async () => {
    let signal!: AbortSignal;
    const create = vi.fn((o: { signal?: AbortSignal }) => {
      signal = o.signal!;
      return {
        health: async () => ({ ok: true }),
        chat: async function* (): AsyncGenerator<StreamEvent> {
          yield { type: "token", text: "partial" };
          await new Promise<void>((r) =>
            signal.addEventListener("abort", () => r()),
          );
          yield { type: "error", error: "aborted" };
        },
      } as unknown as AiClient;
    });
    mount({ aiUrl: "https://ai.example", createAi: create });
    modal.open();
    document.querySelectorAll<HTMLElement>('[role="tab"]')[1].click();
    const composer = q<HTMLTextAreaElement>(".nds-composer-input");
    composer.value = "hi";
    composer.dispatchEvent(new Event("input"));
    q<HTMLButtonElement>(".nds-send").click();
    await flush();
    const send = q<HTMLButtonElement>(".nds-send");
    expect(send.textContent).toBe("Stop");
    expect(composer.disabled).toBe(true);
    send.click();
    await flush();
    await flush();
    expect(signal.aborted).toBe(true);
    expect(q<HTMLElement>(".nds-error").hidden).toBe(true);
    expect(q(".nds-send").textContent).toBe("Send");
    expect(
      document.querySelector(".nds-msg-assistant .nds-content")!.textContent,
    ).toBe("partial");
  });

  it("Shift+Enter does not send", async () => {
    const { create, chat } = aiClient([{ type: "done" }]);
    mount({ aiUrl: "https://ai.example", createAi: create });
    modal.open();
    document.querySelectorAll<HTMLElement>('[role="tab"]')[1].click();
    const composer = q<HTMLTextAreaElement>(".nds-composer-input");
    composer.value = "hi";
    key(composer, "Enter", { shiftKey: true });
    await flush();
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("initDocsSearch", () => {
  it("returns null when the page has no trigger", () => {
    document.body.innerHTML = "";
    expect(initDocsSearch()).toBeNull();
  });

  it("reads the Ask-AI URL and source from the trigger and opens from it", () => {
    document.body.innerHTML =
      '<button data-nds-trigger data-ai-url="https://ai.example" data-source="bundu"><kbd>⌘K</kbd></button>';
    modal = initDocsSearch()!;
    document.querySelector<HTMLElement>("[data-nds-trigger]")!.click();
    expect(modal.isOpen()).toBe(true);
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(2);
  });

  it("leaves Ask AI off when no URL is set", () => {
    document.body.innerHTML =
      '<button data-nds-trigger data-ai-url="" data-source=""></button>';
    modal = initDocsSearch()!;
    modal.open();
    expect(document.querySelector('[role="tablist"]')).toBeNull();
  });
});
