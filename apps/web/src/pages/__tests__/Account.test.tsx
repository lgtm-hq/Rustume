import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { axeConfig } from "../../test/a11y";
import { Route, Router } from "@solidjs/router";
import Account from "../Account";
import { ApiError } from "../../api/client";
import { toast } from "../../components/ui";

const {
  mockAuthState,
  signInMock,
  signOutMock,
  refreshMock,
  updateLocalUsernameMock,
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
  updateLocalUsernameMock: vi.fn(),
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
    // Mirrors the real store: the page re-renders from the updated user.
    updateLocalUsername: (username: string) => {
      updateLocalUsernameMock(username);
      if (mockAuthState.user) {
        mockAuthState.user = { ...mockAuthState.user, username };
      }
    },
    displayName: (user: { username: string }) => user.username || "Account",
  },
}));

// Only the network call is mocked; validateUsername is the real client-side
// validator so the page tests exercise the shared rules.
vi.mock("../../api/account", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/account")>();
  return {
    ...actual,
    deleteAccount: deleteAccountMock,
    updateUsername: updateUsernameMock,
  };
});

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
    updateLocalUsernameMock.mockReset();
    refreshMock.mockClear();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  // Previously asserted a "Continue without signing in" link. That link pointed at
  // "/", which the auth guard now blocks on any cloud deployment — it was a
  // dead-end loop back to the entry page (#589).
  it("shows a sign-in CTA with no anonymous escape when signed out on cloud", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;

    renderAccount();

    expect(screen.getByText("Sign in to Rustume Cloud")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to sync" })).toBeInTheDocument();
    expect(screen.queryByText(/Continue without signing in/i)).not.toBeInTheDocument();
  });

  it("shows sign-in-required copy regardless of the require-auth flag", () => {
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
      expect(updateLocalUsernameMock).toHaveBeenCalledWith("calm-finch-1234");
    });
    // The store update, not just the mock call, is what the user sees.
    expect(mockAuthState.user?.username).toBe("calm-finch-1234");
    expect(screen.queryByLabelText("Username")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("Username updated");
  });

  it("rejects reserved and malformed usernames client-side without calling the API", async () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "free",
      username: "swift-otter-4821",
    };

    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));

    for (const [input, message] of [
      ["admin", "Username is reserved"],
      ["swift--otter", "Username cannot start, end, or contain consecutive hyphens"],
      ["Bad_Name", "Username may only contain lowercase letters, digits, and hyphens"],
    ] as const) {
      fireEvent.input(screen.getByLabelText("Username"), { target: { value: input } });
      fireEvent.click(screen.getByRole("button", { name: "Save username" }));
      await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
    }

    expect(updateUsernameMock).not.toHaveBeenCalled();
  });

  it("surfaces a taken-username error", async () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "free",
      username: "swift-otter-4821",
    };
    updateUsernameMock.mockRejectedValue(new ApiError(409, "username already taken"));

    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.input(screen.getByLabelText("Username"), {
      target: { value: "taken-handle" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));

    await waitFor(() => {
      expect(screen.getByText("username already taken")).toBeInTheDocument();
    });
    // The toast keys off the 409 status, not the prose of the message.
    expect(toast.error).toHaveBeenCalledWith("That username is already taken");
    expect(mockAuthState.user?.username).toBe("swift-otter-4821");
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
