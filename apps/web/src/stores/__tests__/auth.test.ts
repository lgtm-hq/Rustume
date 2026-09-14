import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { probeAuthMock } = vi.hoisted(() => ({ probeAuthMock: vi.fn() }));

vi.mock("../../api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/auth")>();
  return {
    ...actual,
    probeAuth: () => probeAuthMock(),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  };
});

import { authStore } from "../auth";

describe("authStore.updateLocalUsername", () => {
  beforeEach(() => {
    probeAuthMock.mockReset();
  });

  afterEach(() => {
    authStore.clearUser();
  });

  it("rewrites the signed-in user's username in place", async () => {
    probeAuthMock.mockResolvedValue({
      mode: "cloud",
      requireAuth: true,
      user: { id: "user-1", plan: "free", email: "dev@example.com", username: "swift-otter-4821" },
    });
    await authStore.refresh();
    expect(authStore.state.user?.username).toBe("swift-otter-4821");

    authStore.updateLocalUsername("calm-finch-1234");

    expect(authStore.state.user?.username).toBe("calm-finch-1234");
    // Only the handle changes; the rest of the profile is untouched.
    expect(authStore.state.user?.email).toBe("dev@example.com");
    expect(authStore.displayName(authStore.state.user!)).toBe("calm-finch-1234");
  });

  it("is a no-op when nobody is signed in", async () => {
    probeAuthMock.mockResolvedValue({ mode: "cloud", requireAuth: true, user: null });
    await authStore.refresh();

    authStore.updateLocalUsername("calm-finch-1234");

    expect(authStore.state.user).toBeNull();
  });
});
