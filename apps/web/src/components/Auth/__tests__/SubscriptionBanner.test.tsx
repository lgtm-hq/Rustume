import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { SubscriptionBanner } from "../SubscriptionBanner";

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    requireAuth: false,
    user: null as {
      id: string;
      plan: string;
      subscription?: { status: string; expires_at?: string };
    } | null,
  },
}));

vi.mock("../../../stores/auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
  },
}));

describe("SubscriptionBanner", () => {
  it("shows grace period countdown for canceled subscriptions", () => {
    const expiresAt = "2099-06-01T00:00:00Z";
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "pro",
      subscription: { status: "canceled", expires_at: expiresAt },
    };

    render(() => <SubscriptionBanner />);

    expect(screen.getByRole("status")).toHaveTextContent(/subscription ends on/i);
    expect(screen.getByRole("link", { name: "Export data" })).toHaveAttribute(
      "href",
      "/account#export",
    );
  });

  it("hides when subscription is active", () => {
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = { id: "user-1", plan: "pro" };

    render(() => <SubscriptionBanner />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
