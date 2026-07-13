import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  fetchCheckoutSettings,
  fetchPortalUrl,
  openCheckout,
  redirectToPortal,
  resetPaddleClientForTests,
} from "../billing";

describe("billing api", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetPaddleClientForTests();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("fetchCheckoutSettings posts to the checkout endpoint", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        client_token: "test_live_token",
        price_id: "pri_test",
        email: "dev@example.com",
        custom_data: { user_id: "user-1" },
        environment: "sandbox",
      }),
    });

    const settings = await fetchCheckoutSettings();

    expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(settings.price_id).toBe("pri_test");
    expect(settings.environment).toBe("sandbox");
  });

  it("fetchPortalUrl returns the portal overview URL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://customer-portal.paddle.com/example" }),
    });

    const url = await fetchPortalUrl();

    expect(fetchMock).toHaveBeenCalledWith("/api/billing/portal", {
      method: "GET",
      credentials: "include",
    });
    expect(url).toBe("https://customer-portal.paddle.com/example");
  });

  it("openCheckout loads Paddle.js and opens the overlay", async () => {
    const initialize = vi.fn();
    const open = vi.fn();
    const setEnvironment = vi.fn();

    vi.stubGlobal("window", {
      ...globalThis.window,
      Paddle: {
        Environment: { set: setEnvironment },
        Initialize: initialize,
        Checkout: { open },
      },
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        client_token: "test_live_token",
        price_id: "pri_test",
        email: "dev@example.com",
        custom_data: { user_id: "user-1" },
        environment: "sandbox",
      }),
    });

    await openCheckout();

    expect(setEnvironment).toHaveBeenCalledWith("sandbox");
    expect(initialize).toHaveBeenCalledWith({ token: "test_live_token" });
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ priceId: "pri_test", quantity: 1 }],
        customer: { email: "dev@example.com" },
        customData: { user_id: "user-1" },
      }),
    );
  });

  it("openCheckout reinitializes Paddle when the client token changes", async () => {
    const initialize = vi.fn();
    const open = vi.fn();
    const setEnvironment = vi.fn();

    vi.stubGlobal("window", {
      ...globalThis.window,
      Paddle: {
        Environment: { set: setEnvironment },
        Initialize: initialize,
        Checkout: { open },
      },
    });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          client_token: "first_token",
          price_id: "pri_test",
          email: "dev@example.com",
          custom_data: { user_id: "user-1" },
          environment: "sandbox",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          client_token: "second_token",
          price_id: "pri_test",
          email: "dev@example.com",
          custom_data: { user_id: "user-1" },
          environment: "production",
        }),
      });

    await openCheckout();
    await openCheckout();

    expect(initialize).toHaveBeenCalledTimes(2);
    expect(initialize).toHaveBeenNthCalledWith(1, { token: "first_token" });
    expect(initialize).toHaveBeenNthCalledWith(2, { token: "second_token" });
  });

  it("redirectToPortal navigates to the returned URL", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      ...globalThis.window,
      location: { assign },
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://customer-portal.paddle.com/example" }),
    });

    await redirectToPortal();

    expect(assign).toHaveBeenCalledWith("https://customer-portal.paddle.com/example");
  });
});
