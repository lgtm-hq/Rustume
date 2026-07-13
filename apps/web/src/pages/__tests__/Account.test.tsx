import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { axeConfig } from "../../test/a11y";
import { Route, Router } from "@solidjs/router";
import Account from "../Account";

const {
  mockAuthState,
  signInMock,
  signOutMock,
  refreshMock,
  updateUsernameMock,
  deleteAccountMock,
} = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    requireAuth: false,
    user: null as {
      id: string;
      plan: string;
      email?: string;
      username: string;
    } | null,
  },
  signInMock: vi.fn(),
  signOutMock: vi.fn(),
  refreshMock: vi.fn().mockResolvedValue(undefined),
  updateUsernameMock: vi.fn(),
  deleteAccountMock: vi.fn(),
}));

vi.mock("../../stores/auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
    signIn: signInMock,
    signOut: signOutMock,
    clearUser: vi.fn(),
    refresh: refreshMock,
    displayName: (user: { username: string }) => user.username || "Account",
  },
}));

vi.mock("../../api/account", () => ({
  deleteAccount: deleteAccountMock,
  updateUsername: updateUsernameMock,
  validateUsername: (username: string) => {
    const normalized = username.trim().toLowerCase();
    if (normalized.length < 3 || normalized.length > 32) {
      return "Username must be 3-32 characters";
    }
    if (!/^[a-z0-9-]+$/.test(normalized)) {
      return "Username may only contain lowercase letters, digits, and hyphens";
    }
    return null;
  },
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
    updateUsernameMock.mockReset();
    refreshMock.mockClear();
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
      username: "swift-otter-4821",
    };

    renderAccount();

    expect(screen.getByText("swift-otter-4821")).toBeInTheDocument();
    expect(screen.getByText("dev@example.com")).toBeInTheDocument();
    expect(screen.getByText("Plan: free")).toBeInTheDocument();
    expect(screen.getByText(/Resumes saved to your Rustume Cloud account/i)).toBeInTheDocument();
    expect(screen.getByText(/WorkOS AuthKit/i)).toBeInTheDocument();
    expect(screen.getByText(/legal name stays with your identity provider/i)).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("End-to-end encryption")).toBeInTheDocument();
    expect(screen.getAllByText("Coming soon").length).toBeGreaterThan(0);
    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeInTheDocument();
  });

  it("saves an edited username", async () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "free",
      email: "dev@example.com",
      username: "swift-otter-4821",
    };
    updateUsernameMock.mockResolvedValue({ username: "calm-finch-1234" });

    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.input(screen.getByLabelText("Username"), {
      target: { value: "calm-finch-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));

    await waitFor(() => {
      expect(updateUsernameMock).toHaveBeenCalledWith("calm-finch-1234");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("surfaces a taken-username error", async () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "free",
      username: "swift-otter-4821",
    };
    updateUsernameMock.mockRejectedValue(new Error("username already taken"));

    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.input(screen.getByLabelText("Username"), {
      target: { value: "taken-handle" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));

    await waitFor(() => {
      expect(screen.getByText("username already taken")).toBeInTheDocument();
    });
  });

  it("opens the delete confirmation modal", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "free",
      email: "dev@example.com",
      username: "swift-otter-4821",
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
      username: "swift-otter-4821",
    };

    const { container } = renderAccount();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
