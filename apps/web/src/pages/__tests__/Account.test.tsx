import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { axeConfig } from "../../test/a11y";
import { Route, Router } from "@solidjs/router";
import Account from "../Account";

const { mockAuthState, signInMock, signOutMock } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    requireAuth: false,
    billingEnabled: false,
    user: null as {
      id: string;
      plan: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    } | null,
  },
  signInMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("../../stores/auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
    signIn: signInMock,
    signOut: signOutMock,
    clearUser: vi.fn(),
    refresh: vi.fn(),
    // Mirrors userDisplayName — vi.mock hoisting prevents importing the real function.
    displayName: (user: { email?: string; first_name?: string; last_name?: string }) => {
      const parts = [user.first_name, user.last_name].filter(Boolean);
      if (parts.length > 0) return parts.join(" ");
      return user.email ?? "Account";
    },
  },
}));

vi.mock("../../api/account", () => ({
  deleteAccount: vi.fn(),
}));

vi.mock("../../api/billing", () => ({
  openCheckout: vi.fn(),
  redirectToPortal: vi.fn(),
}));

vi.mock("../../api/resumes", () => ({
  listCloudResumesPage: vi.fn().mockResolvedValue({ total: 2, items: [], page: 1, per_page: 100 }),
}));

vi.mock("../../components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../components/ui")>();
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

function renderAccount() {
  return render(() => (
    <Router>
      <Route path="/" component={Account} />
    </Router>
  ));
}

describe("Account page", () => {
  beforeEach(() => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = false;
    mockAuthState.billingEnabled = false;
    mockAuthState.user = null;
    signInMock.mockReset();
    signOutMock.mockReset();
  });

  it("shows a sign-in CTA when cloud is enabled and the user is signed out", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;

    renderAccount();

    expect(screen.getByText("Sign in to Rustume Cloud")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to sync" })).toBeInTheDocument();
    expect(screen.getByText(/Continue without signing in/i)).toBeInTheDocument();
  });

  it("shows required-auth copy and hides local-only link when require-auth mode is active", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = true;
    mockAuthState.user = null;

    renderAccount();

    expect(
      screen.getByText(/Sign in is required to use Rustume Cloud on this deployment/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Continue without signing in/i)).not.toBeInTheDocument();
  });

  it("shows profile details when signed in", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "free",
      email: "dev@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
    };

    renderAccount();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("dev@example.com")).toBeInTheDocument();
    expect(screen.getByText("Plan: free")).toBeInTheDocument();
    expect(screen.getByText(/Resumes saved to your Rustume Cloud account/i)).toBeInTheDocument();
    expect(screen.getByText(/WorkOS AuthKit/i)).toBeInTheDocument();
    expect(
      screen.getByText(/email and name are stored by both WorkOS and Rustume/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(
      screen.getByText(/Hosted billing is not configured on this deployment/i),
    ).toBeInTheDocument();
    expect(screen.getByText("End-to-end encryption")).toBeInTheDocument();
    expect(screen.getAllByText("Coming soon").length).toBe(1);
    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeInTheDocument();
  });

  it("shows subscribe when billing is enabled for free users", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.billingEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "free",
      email: "dev@example.com",
    };

    renderAccount();

    expect(screen.getByRole("button", { name: "Subscribe to Rustume Cloud" })).toBeInTheDocument();
  });

  it("shows manage subscription when billing is enabled and the user has a paid plan", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.billingEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "pro",
      email: "dev@example.com",
    };

    renderAccount();

    expect(screen.getByRole("button", { name: "Manage subscription" })).toBeInTheDocument();
  });

  it("opens the delete confirmation modal", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "free",
      email: "dev@example.com",
    };

    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(screen.getByText("Type DELETE to confirm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete permanently" })).toBeDisabled();
  });
});

describe("Account accessibility", () => {
  it("has no axe violations when signed out", async () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;

    const { container } = renderAccount();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });

  it("has no axe violations when signed in", async () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "free",
      email: "dev@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
    };

    const { container } = renderAccount();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
