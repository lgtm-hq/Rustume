import { describe, expect, it, beforeEach } from "vitest";
import {
  getStoredHomeLayout,
  HOME_LAYOUT_STORAGE_KEY,
  HomeLayout,
  setStoredHomeLayout,
} from "../homeLayout";

describe("homeLayout preference", () => {
  beforeEach(() => {
    localStorage.removeItem(HOME_LAYOUT_STORAGE_KEY);
  });

  it("defaults to list", () => {
    expect(getStoredHomeLayout()).toBe(HomeLayout.List);
  });

  it("round-trips grid", () => {
    setStoredHomeLayout(HomeLayout.Grid);
    expect(getStoredHomeLayout()).toBe(HomeLayout.Grid);
    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe("grid");
  });

  it("migrates classic to list", () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, "classic");
    expect(getStoredHomeLayout()).toBe(HomeLayout.List);
    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe("list");
  });

  it("migrates workspace to grid", () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, "workspace");
    expect(getStoredHomeLayout()).toBe(HomeLayout.Grid);
    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe("grid");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, "dashboard");
    expect(getStoredHomeLayout()).toBe(HomeLayout.List);
  });
});
