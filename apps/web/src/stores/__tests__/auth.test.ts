import { beforeEach, describe, expect, it, vi } from "vitest";

const { probeAuthMock, logoutMock } = vi.hoisted(() => ({
  probeAuthMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock("../../api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/auth")>();
  return {
    ...actual,
    probeAuth: probeAuthMock,
    logout: logoutMock,
  };
});

import { authStore } from "../auth";

const localUser = {
  id: "00000000-0000-0000-0000-000000000001",
  plan: "self-hosted",
};

describe("authStore", () => {
  beforeEach(() => {
    probeAuthMock.mockReset();
    logoutMock.mockReset();
  });

  it("enables server storage without auth UI in local mode", async () => {
    probeAuthMock.mockResolvedValue({ mode: "local", user: localUser });

    await authStore.refresh();

    expect(authStore.state.localMode).toBe(true);
    expect(authStore.state.cloudEnabled).toBe(true);
    expect(authStore.state.requireAuth).toBe(false);
    expect(authStore.state.user).toEqual(localUser);
    expect(authStore.state.loading).toBe(false);
  });

  it("treats signOut as a no-op in local mode", async () => {
    probeAuthMock.mockResolvedValue({ mode: "local", user: localUser });
    await authStore.refresh();

    await authStore.signOut();

    expect(logoutMock).not.toHaveBeenCalled();
    expect(authStore.state.user).toEqual(localUser);
  });

  it("clears localMode when a cloud probe follows", async () => {
    probeAuthMock.mockResolvedValue({ mode: "local", user: localUser });
    await authStore.refresh();

    probeAuthMock.mockResolvedValue({ mode: "cloud", user: null, requireAuth: true });
    await authStore.refresh();

    expect(authStore.state.localMode).toBe(false);
    expect(authStore.state.cloudEnabled).toBe(true);
    expect(authStore.state.requireAuth).toBe(true);
    expect(authStore.state.user).toBeNull();
  });

  it("disables server storage in stateless self-hosted mode", async () => {
    probeAuthMock.mockResolvedValue({ mode: "self-hosted" });

    await authStore.refresh();

    expect(authStore.state.localMode).toBe(false);
    expect(authStore.state.cloudEnabled).toBe(false);
    expect(authStore.state.user).toBeNull();
  });
});
