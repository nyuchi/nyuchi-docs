// Framework-free search modal. Plain DOM, runs only in the browser.
//
// Behaviour (kept from the Svelte version it replaces):
//   - Cmd/Ctrl+K toggles a cmdk-style modal; Escape closes it.
//   - "Search" tab: Pagefind results, ArrowUp/ArrowDown/Enter to navigate.
//   - "Ask AI" tab: streams answers from the Ask-AI Worker with citations.
//   - role=dialog + aria-modal, a focus trap, and focus returns to whatever
//     had it before the modal opened.
//
// Every string from the index or the Worker goes in through `textContent`,
// never `innerHTML`, so a hostile excerpt cannot inject markup.

import {
  createAiClient,
  type AiClient,
  type AiClientOptions,
  type ChatMessage,
  type Citation,
} from "./ai-client.js";
import {
  createPagefindClient,
  type PagefindClient,
  type SearchHit,
} from "./pagefind.js";

export type DocsSource = "nyuchi" | "bundu";
export type SearchTab = "search" | "ai";

export interface SearchModalOptions {
  /** Base URL of the Ask-AI Worker. Without it the Ask AI tab is not offered. */
  aiUrl?: string;
  /** Docs source filter passed to the Worker. */
  source?: DocsSource;
  /** Force the Ask AI tab on or off. Defaults to `Boolean(aiUrl)`. */
  enableAskAi?: boolean;
  /** Element focus returns to when nothing better is known (the trigger). */
  trigger?: HTMLElement | null;
  /** Pagefind client. Defaults to the one over `/pagefind/pagefind.js`. */
  pagefind?: PagefindClient;
  /** Ask-AI client factory. Defaults to `createAiClient`. */
  createAi?: (options: AiClientOptions) => AiClient;
  /** Called with a result URL on Enter. Defaults to `location.assign`. */
  navigate?: (url: string) => void;
  /** Document to build into. Defaults to the global one. */
  document?: Document;
}

export interface SearchModalController {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  /** Remove the modal and its listeners. */
  destroy(): void;
}

let instanceCount = 0;

const SVG_NS = "http://www.w3.org/2000/svg";
const SEARCH_ICON_PATH =
  "M11 19a8 8 0 1 1 5.3-14.02A8 8 0 0 1 11 19zm10 2-4.35-4.35";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function h<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function searchIcon(doc: Document, size: number): SVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = doc.createElementNS(SVG_NS, "path");
  path.setAttribute("d", SEARCH_ICON_PATH);
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);
  return svg;
}

export function createSearchModal(
  options: SearchModalOptions = {},
): SearchModalController {
  const doc = options.document ?? document;
  const win = doc.defaultView ?? window;
  const id = `nds-${++instanceCount}`;
  const enableAskAi = options.enableAskAi ?? Boolean(options.aiUrl);
  const pagefind = options.pagefind ?? createPagefindClient();
  const makeAi = options.createAi ?? createAiClient;
  const navigate =
    options.navigate ?? ((url: string) => win.location.assign(url));

  // State
  let isOpen = false;
  let tab: SearchTab = "search";
  let query = "";
  let results: SearchHit[] = [];
  let selected = 0;
  let loading = false;
  let searchToken = 0;
  let returnFocus: HTMLElement | null = null;

  let streaming = false;
  let abort: AbortController | null = null;
  const messages: ChatMessage[] = [];

  // DOM (built on first open)
  let overlay: HTMLDivElement | null = null;
  let input!: HTMLInputElement;
  let searchPanel!: HTMLDivElement;
  let aiPanel!: HTMLDivElement;
  let listHost!: HTMLDivElement;
  let thread!: HTMLDivElement;
  let composer!: HTMLTextAreaElement;
  let sendButton!: HTMLButtonElement;
  let errorBox!: HTMLParagraphElement;
  let tabButtons: Record<SearchTab, HTMLButtonElement> | null = null;

  const optionId = (i: number) => `${id}-option-${i}`;

  // ---- Search tab ----------------------------------------------------------

  function renderResults(): void {
    listHost.textContent = "";
    const message = (text: string) => {
      listHost.appendChild(
        h(doc, "p", { class: "nds-empty", role: "status" }, text),
      );
    };
    input.removeAttribute("aria-activedescendant");
    input.setAttribute("aria-expanded", "false");

    if (loading && results.length === 0) return message("Searching…");
    if (!query.trim()) return message("Ask AI or search docs…");
    if (results.length === 0) return message(`No results for "${query}"`);

    const list = h(doc, "ul", {
      class: "nds-list",
      role: "listbox",
      id: `${id}-listbox`,
      "aria-label": "Search results",
    });
    results.forEach((r, i) => {
      const li = h(doc, "li", { role: "presentation" });
      const a = h(doc, "a", {
        href: r.url,
        class: "nds-result",
        role: "option",
        id: optionId(i),
        "data-testid": "search-result",
        tabindex: "-1",
      });
      const head = h(doc, "div", { class: "nds-result-head" });
      head.appendChild(h(doc, "span", { class: "nds-result-title" }, r.title));
      head.appendChild(
        h(doc, "span", { class: "nds-result-crumb" }, r.breadcrumb),
      );
      a.appendChild(head);
      a.appendChild(h(doc, "p", { class: "nds-result-snippet" }, r.snippet));
      a.addEventListener("mousemove", () => {
        if (selected !== i) {
          selected = i;
          updateSelection(false);
        }
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    listHost.appendChild(list);
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-controls", `${id}-listbox`);
    updateSelection(false);
  }

  function updateSelection(scroll: boolean): void {
    const items = listHost.querySelectorAll<HTMLElement>('[role="option"]');
    items.forEach((node, i) => {
      const on = i === selected;
      node.setAttribute("aria-selected", String(on));
      node.classList.toggle("selected", on);
      if (on) {
        input.setAttribute("aria-activedescendant", node.id);
        if (scroll) node.scrollIntoView?.({ block: "nearest" });
      }
    });
  }

  async function runSearch(q: string): Promise<void> {
    const token = ++searchToken;
    if (!q.trim()) {
      results = [];
      loading = false;
      renderResults();
      return;
    }
    loading = true;
    renderResults();
    try {
      const hits = await pagefind.search(q);
      if (token === searchToken) {
        results = hits;
        selected = 0;
      }
    } catch {
      if (token === searchToken) results = [];
    } finally {
      if (token === searchToken) {
        loading = false;
        renderResults();
      }
    }
  }

  // ---- Ask AI tab ----------------------------------------------------------

  function messageNode(
    role: "user" | "assistant",
    content: string,
  ): {
    root: HTMLDivElement;
    content: HTMLDivElement;
  } {
    const root = h(doc, "div", { class: `nds-msg nds-msg-${role}` });
    root.appendChild(
      h(
        doc,
        "div",
        { class: "nds-role" },
        role === "user" ? "You" : "Assistant",
      ),
    );
    const body = h(doc, "div", { class: "nds-content" }, content);
    root.appendChild(body);
    thread.appendChild(root);
    return { root, content: body };
  }

  function citationsNode(citations: Citation[]): HTMLDivElement {
    const wrap = h(doc, "div", { class: "nds-citations" });
    for (const c of citations) {
      const a = h(doc, "a", {
        class: "nds-citation",
        href: c.url,
        title: c.title,
        "data-testid": "citation",
      });
      a.appendChild(h(doc, "sup", {}, String(c.index)));
      a.appendChild(h(doc, "span", { class: "nds-citation-title" }, c.title));
      if (c.breadcrumb) {
        a.appendChild(
          h(doc, "span", { class: "nds-citation-crumb" }, c.breadcrumb),
        );
      }
      wrap.appendChild(a);
    }
    return wrap;
  }

  function setStreaming(on: boolean): void {
    streaming = on;
    composer.disabled = on;
    sendButton.textContent = on ? "Stop" : "Send";
    sendButton.disabled = !on && !composer.value.trim();
    thread.setAttribute("aria-busy", String(on));
  }

  async function send(raw: string): Promise<void> {
    const text = raw.trim();
    if (!text || streaming || !options.aiUrl) return;
    composer.value = "";
    errorBox.hidden = true;
    errorBox.textContent = "";
    messages.push({ role: "user", content: text });
    messageNode("user", text);

    const live = messageNode("assistant", "");
    const caret = h(
      doc,
      "span",
      { class: "nds-caret", "aria-hidden": "true" },
      "▍",
    );
    live.content.appendChild(caret);
    const answer = doc.createTextNode("");
    live.content.insertBefore(answer, caret);

    abort = new AbortController();
    setStreaming(true);
    let acc = "";
    let citations: Citation[] = [];
    let error: string | null = null;
    try {
      const client = makeAi({
        baseUrl: options.aiUrl,
        source: options.source,
        signal: abort.signal,
      });
      for await (const ev of client.chat([...messages])) {
        if (ev.type === "token") {
          acc += ev.text;
          answer.data = acc;
        } else if (ev.type === "citations") {
          citations = ev.citations;
        } else if (ev.type === "error") {
          error = ev.error;
          break;
        } else if (ev.type === "done") {
          break;
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "network error";
    } finally {
      caret.remove();
      abort = null;
      setStreaming(false);
    }

    if (acc) {
      messages.push({ role: "assistant", content: acc });
      if (citations.length > 0) live.root.appendChild(citationsNode(citations));
    } else {
      live.root.remove();
      // Keep the history well-formed: drop the unanswered question.
      messages.pop();
    }
    if (error && error !== "aborted") {
      errorBox.textContent = `Ask AI could not answer (${error}). Try again in a moment.`;
      errorBox.hidden = false;
    }
    thread.scrollTop = thread.scrollHeight;
    if (isOpen && tab === "ai") composer.focus();
  }

  // ---- Shell ---------------------------------------------------------------

  function setTab(next: SearchTab): void {
    if (next === "ai" && !enableAskAi) return;
    tab = next;
    searchPanel.hidden = next !== "search";
    aiPanel.hidden = next !== "ai";
    input.placeholder =
      next === "ai" ? "Ask AI about the docs..." : "Search docs...";
    if (tabButtons) {
      (Object.keys(tabButtons) as SearchTab[]).forEach((t) => {
        const on = t === next;
        tabButtons![t].setAttribute("aria-selected", String(on));
        tabButtons![t].setAttribute("tabindex", on ? "0" : "-1");
        tabButtons![t].classList.toggle("active", on);
      });
    }
    if (next === "ai") {
      input.removeAttribute("aria-controls");
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      if (messages.length === 0 && query.trim()) {
        const q = query.trim();
        input.value = "";
        query = "";
        void send(q);
      } else {
        composer.focus();
      }
    } else {
      void runSearch(query);
      input.focus();
    }
  }

  function build(): void {
    overlay = h(doc, "div", { class: "nds-overlay", hidden: "" });
    const modal = h(doc, "div", {
      class: "nds-modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Search documentation",
    });

    const row = h(doc, "div", { class: "nds-input-row" });
    row.appendChild(searchIcon(doc, 18));
    input = h(doc, "input", {
      class: "nds-input",
      type: "search",
      role: "combobox",
      placeholder: "Search docs...",
      "aria-label": "Search documentation",
      "aria-autocomplete": "list",
      "aria-expanded": "false",
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false",
    });
    row.appendChild(input);
    row.appendChild(
      h(doc, "kbd", { class: "nds-esc", "aria-hidden": "true" }, "esc"),
    );
    modal.appendChild(row);

    if (enableAskAi) {
      const tabs = h(doc, "div", {
        class: "nds-tabs",
        role: "tablist",
        "aria-label": "Search mode",
      });
      const mk = (t: SearchTab, label: string) => {
        const b = h(
          doc,
          "button",
          {
            type: "button",
            role: "tab",
            class: "nds-tab",
            id: `${id}-tab-${t}`,
            "aria-controls": `${id}-panel-${t}`,
            "aria-selected": "false",
          },
          label,
        );
        b.addEventListener("click", () => setTab(t));
        return b;
      };
      tabButtons = { search: mk("search", "Search"), ai: mk("ai", "Ask AI") };
      tabs.appendChild(tabButtons.search);
      tabs.appendChild(tabButtons.ai);
      tabs.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const next: SearchTab = tab === "search" ? "ai" : "search";
        setTab(next);
        tabButtons![next].focus();
      });
      modal.appendChild(tabs);
    }

    const body = h(doc, "div", { class: "nds-body" });
    searchPanel = h(doc, "div", {
      class: "nds-panel",
      role: enableAskAi ? "tabpanel" : "region",
      id: `${id}-panel-search`,
      "aria-label": "Search results",
    });
    if (enableAskAi)
      searchPanel.setAttribute("aria-labelledby", `${id}-tab-search`);
    listHost = h(doc, "div", { class: "nds-results" });
    searchPanel.appendChild(listHost);
    body.appendChild(searchPanel);

    aiPanel = h(doc, "div", {
      class: "nds-panel",
      role: "tabpanel",
      id: `${id}-panel-ai`,
      hidden: "",
    });
    if (enableAskAi) {
      aiPanel.setAttribute("aria-labelledby", `${id}-tab-ai`);
      const chat = h(doc, "div", {
        class: "nds-chat",
        "data-testid": "ai-chat",
      });
      thread = h(doc, "div", {
        class: "nds-thread",
        role: "log",
        "aria-live": "polite",
        "aria-label": "Conversation",
      });
      chat.appendChild(thread);
      errorBox = h(doc, "p", { class: "nds-error", role: "alert" });
      errorBox.hidden = true;
      chat.appendChild(errorBox);
      const box = h(doc, "div", { class: "nds-composer" });
      composer = h(doc, "textarea", {
        class: "nds-composer-input",
        rows: "2",
        placeholder: "Ask anything about the docs…",
        "aria-label": "Question for Ask AI",
      });
      sendButton = h(
        doc,
        "button",
        { type: "button", class: "nds-send" },
        "Send",
      );
      sendButton.disabled = true;
      composer.addEventListener("input", () => {
        if (!streaming) sendButton.disabled = !composer.value.trim();
      });
      composer.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          void send(composer.value);
        }
      });
      sendButton.addEventListener("click", () => {
        if (streaming) abort?.abort();
        else void send(composer.value);
      });
      box.appendChild(composer);
      box.appendChild(sendButton);
      chat.appendChild(box);
      aiPanel.appendChild(chat);
    }
    body.appendChild(aiPanel);
    modal.appendChild(body);
    overlay.appendChild(modal);
    doc.body.appendChild(overlay);

    input.addEventListener("input", () => {
      query = input.value;
      if (tab === "search") void runSearch(query);
    });
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });
    renderResults();
  }

  function onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      toggle();
      return;
    }
    if (!isOpen || !overlay) return;

    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }

    if (e.key === "Tab") {
      const nodes = Array.from(
        overlay.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((n) => n.tabIndex >= 0 && !n.closest("[hidden]"));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = doc.activeElement;
      if (!overlay.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }

    if (tab !== "search" || e.target !== input) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selected = Math.min(selected + 1, results.length - 1);
      updateSelection(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
      updateSelection(true);
    } else if (e.key === "Enter" && results[selected]) {
      e.preventDefault();
      const url = results[selected].url;
      close();
      navigate(url);
    }
  }

  function open(): void {
    if (isOpen) return;
    if (!overlay) build();
    returnFocus =
      doc.activeElement instanceof win.HTMLElement &&
      doc.activeElement !== doc.body
        ? doc.activeElement
        : null;
    isOpen = true;
    overlay!.hidden = false;
    options.trigger?.setAttribute("aria-expanded", "true");
    setTab(tab);
    if (tab === "search") {
      input.focus();
      input.select();
    }
  }

  function close(): void {
    if (!isOpen || !overlay) return;
    isOpen = false;
    overlay.hidden = true;
    abort?.abort();
    options.trigger?.setAttribute("aria-expanded", "false");
    const target =
      returnFocus && returnFocus.isConnected ? returnFocus : options.trigger;
    returnFocus = null;
    target?.focus();
  }

  function toggle(): void {
    if (isOpen) close();
    else open();
  }

  doc.addEventListener("keydown", onKeydown);
  const onTriggerClick = () => open();
  options.trigger?.addEventListener("click", onTriggerClick);

  return {
    open,
    close,
    toggle,
    isOpen: () => isOpen,
    destroy() {
      abort?.abort();
      doc.removeEventListener("keydown", onKeydown);
      options.trigger?.removeEventListener("click", onTriggerClick);
      overlay?.remove();
      overlay = null;
      isOpen = false;
    },
  };
}

/**
 * Wire every `[data-nds-trigger]` on the page to one modal. Configuration is
 * read from the trigger's `data-ai-url` and `data-source` attributes, which
 * `Search.astro` fills from PUBLIC_ environment variables.
 */
export function initDocsSearch(
  doc: Document = document,
): SearchModalController | null {
  const triggers = Array.from(
    doc.querySelectorAll<HTMLElement>("[data-nds-trigger]"),
  );
  const first = triggers[0];
  if (!first) return null;
  const source = first.dataset.source;
  const controller = createSearchModal({
    document: doc,
    trigger: first,
    aiUrl: first.dataset.aiUrl || undefined,
    source: source === "nyuchi" || source === "bundu" ? source : undefined,
  });
  for (const extra of triggers.slice(1)) {
    extra.addEventListener("click", () => controller.open());
  }
  const mac = /mac|iphone|ipad/i.test(
    doc.defaultView?.navigator.platform ?? "",
  );
  if (!mac) {
    doc
      .querySelectorAll<HTMLElement>("[data-nds-trigger] kbd")
      .forEach((k) => (k.textContent = "Ctrl K"));
  }
  return controller;
}
