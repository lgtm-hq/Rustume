import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_HOME_SIDEBAR_OPEN,
  getStoredHomeSidebarOpen,
  HOME_SIDEBAR_STORAGE_KEY,
  setStoredHomeSidebarOpen,
} from "../homeSidebar";

describe("homeSidebar preference", () => {
  beforeEach(() => {
    localStorage.removeItem(HOME_SIDEBAR_STORAGE_KEY);
  });

  it("defaults to collapsed", () => {
    expect(DEFAULT_HOME_SIDEBAR_OPEN).toBe(false);
    expect(getStoredHomeSidebarOpen()).toBe(false);
  });

  it("round-trips the open state", () => {
    setStoredHomeSidebarOpen(true);
    expect(localStorage.getItem(HOME_SIDEBAR_STORAGE_KEY)).toBe("open");
    expect(getStoredHomeSidebarOpen()).toBe(true);
  });

  it("round-trips the collapsed state", () => {
    setStoredHomeSidebarOpen(false);
    expect(localStorage.getItem(HOME_SIDEBAR_STORAGE_KEY)).toBe("collapsed");
    expect(getStoredHomeSidebarOpen()).toBe(false);
  });

  it("falls back to collapsed for unknown stored values", () => {
    localStorage.setItem(HOME_SIDEBAR_STORAGE_KEY, "expanded");
    expect(getStoredHomeSidebarOpen()).toBe(false);
  });
});
