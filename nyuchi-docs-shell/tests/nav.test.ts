import { describe, expect, it } from "vitest";
import { isActivePath } from "../src/lib/nav.js";

describe("isActivePath", () => {
  it("marks the section root and everything under it", () => {
    expect(isActivePath("/api/", "/api/")).toBe(true);
    expect(isActivePath("/api", "/api/")).toBe(true);
    expect(isActivePath("/api/overview/", "/api/")).toBe(true);
    expect(isActivePath("/api/overview/#top", "/api/")).toBe(true);
  });

  it("does not match a sibling that merely shares a prefix", () => {
    expect(isActivePath("/api-keys/", "/api/")).toBe(false);
    expect(isActivePath("/playbooks/", "/platform/")).toBe(false);
  });

  it("matches the home link only on the home page", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/api/", "/")).toBe(false);
  });

  it("never marks an external link", () => {
    expect(isActivePath("/", "https://nyuchi.com")).toBe(false);
  });
});
