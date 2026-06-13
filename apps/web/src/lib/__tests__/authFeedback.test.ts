import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { authErrorMessage, handleAuthQueryParams } from "../../lib/authFeedback";

const { toastMock } = vi.hoisted(() => ({
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../components/ui", () => ({
  toast: toastMock,
}));

describe("handleAuthQueryParams", () => {
  beforeEach(() => {
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("shows a success toast and removes signed_in from the URL", () => {
    window.history.replaceState({}, "", "/?signed_in=1");

    handleAuthQueryParams();

    expect(toastMock.success).toHaveBeenCalledWith("You're signed in to Rustume Cloud.");
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
  });

  it("maps auth_error codes to user-facing toasts", () => {
    window.history.replaceState({}, "", "/?auth_error=invalid_state");

    handleAuthQueryParams();

    expect(toastMock.error).toHaveBeenCalledWith("Sign-in was interrupted. Please try again.");
    expect(window.location.search).toBe("");
  });

  it("uses a safe fallback message for unknown auth_error codes", () => {
    window.history.replaceState({}, "", "/?auth_error=workos_raw_failure");

    handleAuthQueryParams();

    expect(toastMock.error).toHaveBeenCalledWith("Sign-in failed. Please try again.");
  });
});

describe("authErrorMessage", () => {
  it("returns known OAuth error copy", () => {
    expect(authErrorMessage("authentication_failed")).toBe(
      "We couldn't sign you in. Please try again.",
    );
  });
});
