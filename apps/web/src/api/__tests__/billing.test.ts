import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiValidationError } from "../client";
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
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
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
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ url: "https://customer-portal.paddle.com/example" }),
    });

    const url = await fetchPortalUrl();

    expect(fetchMock).toHaveBeenCalledWith("/api/billing/portal", {
      method: "GET",
      credentials: "include",
      headers: {},
    });
    expect(url).toBe("https://customer-portal.paddle.com/example");
  });

  it("fetchCheckoutSettings surfaces server error messages", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({ error: "Account email is required before starting checkout" }),
    });

    const error = await fetchCheckoutSettings().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toBe("Account email is required before starting checkout");
  });

  it("fetchCheckoutSettings rejects malformed responses", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        client_token: "test_live_token",
        price_id: "pri_test",
        email: "dev@example.com",
        custom_data: {},
        environment: "staging",
      }),
    });

    await expect(fetchCheckoutSettings()).rejects.toThrow(ApiValidationError);
  });

  it("fetchPortalUrl surfaces the unlinked-customer conflict", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({ error: "No billing account linked yet — complete checkout first" }),
    });

    const error = await fetchPortalUrl().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).message).toBe(
      "No billing account linked yet — complete checkout first",
    );
  });

  it("fetchPortalUrl rejects responses without a valid https URL", async () => {
    for (const url of [
      "not a url",
      "http://customer-portal.paddle.com/example",
      "javascript:alert(1)",
    ]) {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ url }),
      });

      await expect(fetchPortalUrl(), url).rejects.toThrow(ApiValidationError);
    }
  });

  it("billing responses reject unexpected fields", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ url: "https://customer-portal.paddle.com/example", extra: 1 }),
    });

    await expect(fetchPortalUrl()).rejects.toThrow(ApiValidationError);
  });

  it("surfaces 401 and 404 from the billing endpoints as ApiError", async () => {
    for (const [status, message] of [
      [401, "Authentication required"],
      [404, "Route not found"],
    ] as const) {
      fetchMock.mockResolvedValue({
        ok: false,
        status,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({ error: message }),
      });

      const error = await fetchPortalUrl().catch((err: unknown) => err);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(status);
      expect((error as ApiError).message).toBe(message);
    }
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
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
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

  it("openCheckout invokes onComplete for checkout.completed only", async () => {
    const open = vi.fn();
    vi.stubGlobal("window", {
      ...globalThis.window,
      Paddle: { Initialize: vi.fn(), Checkout: { open } },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        client_token: "test_live_token",
        price_id: "pri_test",
        email: "dev@example.com",
        custom_data: { user_id: "user-1", sig: "abc" },
        environment: "sandbox",
      }),
    });
    const onComplete = vi.fn();

    await openCheckout(onComplete);

    const options = open.mock.calls[0]?.[0] as {
      eventCallback: (event: { name?: string }) => void;
    };
    options.eventCallback({ name: "checkout.loaded" });
    options.eventCallback({});
    expect(onComplete).not.toHaveBeenCalled();
    options.eventCallback({ name: "checkout.completed" });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("openCheckout initialises Paddle once for repeat opens with unchanged settings", async () => {
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
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        client_token: "test_live_token",
        price_id: "pri_test",
        email: "dev@example.com",
        custom_data: { user_id: "user-1" },
        environment: "sandbox",
      }),
    });

    await openCheckout();
    await openCheckout();

    // Environment.set is a pre-Initialize call in Paddle.js: never repeated
    // after initialisation with unchanged settings.
    expect(setEnvironment).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("openCheckout refetches Paddle.js when a load defined no window.Paddle", async () => {
    const initialize = vi.fn();
    const open = vi.fn();
    vi.stubGlobal("window", { ...globalThis.window, Paddle: undefined });

    const originalAppendChild = document.head.appendChild.bind(document.head);
    const appendChild = vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      const inserted = originalAppendChild(node);
      if (node instanceof HTMLScriptElement) {
        if (appendChild.mock.calls.length === 1) {
          // First response "loads" but is not Paddle (e.g. a CDN error page).
          queueMicrotask(() => node.onload?.(new Event("load")));
        } else {
          queueMicrotask(() => {
            window.Paddle = { Initialize: initialize, Checkout: { open } };
            node.onload?.(new Event("load"));
          });
        }
      }
      return inserted;
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        client_token: "test_live_token",
        price_id: "pri_test",
        email: "dev@example.com",
        custom_data: { user_id: "user-1" },
        environment: "sandbox",
      }),
    });

    await expect(openCheckout()).rejects.toThrow("Paddle.js loaded without defining window.Paddle");
    expect(
      document.querySelector('script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]'),
    ).toBeNull();

    // The next click must fetch the script again rather than reuse the stale load.
    await openCheckout();

    expect(appendChild).toHaveBeenCalledTimes(2);
    appendChild.mockRestore();
    expect(initialize).toHaveBeenCalledWith({ token: "test_live_token" });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("openCheckout reloads Paddle when checkout settings change", async () => {
    const initialize = vi.fn();
    const open = vi.fn();
    const setEnvironment = vi.fn();
    let paddleInstance = {
      Environment: { set: setEnvironment },
      Initialize: initialize,
      Checkout: { open },
    };

    const appendChild = vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        queueMicrotask(() => {
          window.Paddle = paddleInstance;
          node.onload?.(new Event("load"));
        });
      }
      return node;
    });

    vi.stubGlobal("window", {
      ...globalThis.window,
      get Paddle() {
        return paddleInstance;
      },
      set Paddle(value) {
        paddleInstance = value as typeof paddleInstance;
      },
    });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
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
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
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

    appendChild.mockRestore();

    expect(initialize).toHaveBeenCalledTimes(2);
    expect(initialize).toHaveBeenNthCalledWith(1, { token: "first_token" });
    expect(initialize).toHaveBeenNthCalledWith(2, { token: "second_token" });
    expect(setEnvironment).toHaveBeenCalledWith("sandbox");
    expect(setEnvironment).toHaveBeenLastCalledWith("production");
  });

  it("loadPaddleScript retries after a failed script load", async () => {
    const initialize = vi.fn();
    const open = vi.fn();

    vi.stubGlobal("window", {
      ...globalThis.window,
      Paddle: undefined,
    });

    const originalAppendChild = document.head.appendChild.bind(document.head);
    const appendChild = vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      const inserted = originalAppendChild(node);
      if (node instanceof HTMLScriptElement) {
        if (appendChild.mock.calls.length === 1) {
          queueMicrotask(() => node.onerror?.(new Event("error")));
        } else {
          queueMicrotask(() => {
            window.Paddle = {
              Initialize: initialize,
              Checkout: { open },
            };
            node.onload?.(new Event("load"));
          });
        }
      }
      return inserted;
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        client_token: "test_live_token",
        price_id: "pri_test",
        email: "dev@example.com",
        custom_data: { user_id: "user-1" },
        environment: "sandbox",
      }),
    });

    await expect(openCheckout()).rejects.toThrow("Failed to load Paddle.js");
    expect(
      document.querySelector('script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]'),
    ).toBeNull();

    await openCheckout();

    appendChild.mockRestore();
    expect(initialize).toHaveBeenCalledWith({ token: "test_live_token" });
  });

  it("redirectToPortal navigates to the returned URL", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      ...globalThis.window,
      location: { assign },
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ url: "https://customer-portal.paddle.com/example" }),
    });

    await redirectToPortal();

    expect(assign).toHaveBeenCalledWith("https://customer-portal.paddle.com/example");
  });
});
