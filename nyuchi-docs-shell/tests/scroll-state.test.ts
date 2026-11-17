import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SCROLLED_ATTRIBUTE,
  SCROLL_THRESHOLD_PX,
  initScrollState,
} from "../src/lib/scroll-state.js";

function frames() {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  return () => queue.splice(0).forEach((cb) => cb(0));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute(SCROLLED_ATTRIBUTE);
});

describe("initScrollState", () => {
  it("sets the attribute once the page has scrolled and clears it at the top", () => {
    const flush = frames();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    const stop = initScrollState(window);
    const root = document.documentElement;
    expect(root.hasAttribute(SCROLLED_ATTRIBUTE)).toBe(false);

    Object.defineProperty(window, "scrollY", {
      value: SCROLL_THRESHOLD_PX + 1,
      configurable: true,
    });
    window.dispatchEvent(new Event("scroll"));
    flush();
    expect(root.hasAttribute(SCROLLED_ATTRIBUTE)).toBe(true);

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    window.dispatchEvent(new Event("scroll"));
    flush();
    expect(root.hasAttribute(SCROLLED_ATTRIBUTE)).toBe(false);
    stop();
  });

  it("applies the state immediately (a restored scroll position)", () => {
    frames();
    Object.defineProperty(window, "scrollY", {
      value: 300,
      configurable: true,
    });
    const stop = initScrollState(window);
    expect(document.documentElement.hasAttribute(SCROLLED_ATTRIBUTE)).toBe(
      true,
    );
    stop();
  });

  it("coalesces a burst of scroll events into one frame", () => {
    const flush = frames();
    const raf = vi.fn((cb: FrameRequestCallback) => {
      void cb;
      return 1;
    });
    vi.stubGlobal("requestAnimationFrame", raf);
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    const stop = initScrollState(window);
    for (let i = 0; i < 10; i++) window.dispatchEvent(new Event("scroll"));
    expect(raf).toHaveBeenCalledTimes(1);
    flush();
    stop();
  });

  it("stops listening after cleanup", () => {
    const flush = frames();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    const stop = initScrollState(window);
    stop();
    Object.defineProperty(window, "scrollY", {
      value: 500,
      configurable: true,
    });
    window.dispatchEvent(new Event("scroll"));
    flush();
    expect(document.documentElement.hasAttribute(SCROLLED_ATTRIBUTE)).toBe(
      false,
    );
  });
});
