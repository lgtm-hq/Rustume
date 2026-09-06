import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { axeConfig } from "../../test/a11y";
import { Route, Router } from "@solidjs/router";
import Account from "../Account";
import { ApiError } from "../../api/client";
import { toast } from "../../components/ui";

interface MockUser {
  id: string;
  plan: string;
  email?: string;
  username: string;
}

// A real Solid store so the page re-renders when the (mocked) auth store
// changes, exactly as it does in production; tests assert rendered output.
const {
  mockAuthState,
  setAuth,
  signInMock,
  signOutMock,
  refreshMock,
  updateLocalUsernameMock,
  updateUsernameMock,
  deleteAccountMock,
} = await vi.hoisted(async () => {
  const { createStore } = await import("solid-js/store");
  const [authState, setAuthState] = createStore<{
    loading: boolean;
    cloudEnabled: boolean;
    requireAuth: boolean;
    user: MockUser | null;
  }>({
    loading: false,
    cloudEnabled: true,
    requireAuth: false,
    user: null,
  });
  return {
    mockAuthState: authState,
    setAuth: setAuthState,
    signInMock: vi.fn(),
    signOutMock: vi.fn(),
    refreshMock: vi.fn().mockResolvedValue(undefined),
    updateLocalUsernameMock: vi.fn(),
    updateUsernameMock: vi.fn(),
    deleteAccountMock: vi.fn(),
  };
});

vi.mock("../../stores/auth", async () => {
  // The real display-name rule, so the heading assertions below are meaningful.
  const { userDisplayName } =
    await vi.importActual<typeof import("../../api/auth")>("../../api/auth");
  return {
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
          setAuth("user", "username", username);
        }
      },
      displayName: userDisplayName,
    },
  };
});

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
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("requireAuth", false);
    setAuth("user", null);

    renderAccount();

    expect(screen.getByText("Sign in to Rustume Cloud")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to sync" })).toBeInTheDocument();
    expect(screen.queryByText(/Continue without signing in/i)).not.toBeInTheDocument();
  });

  it("shows sign-in-required copy regardless of the require-auth flag", () => {
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("requireAuth", true);
    setAuth("user", null);

    renderAccount();

    expect(
      screen.getByText(/Sign in is required to use Rustume Cloud on this deployment/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Continue without signing in/i)).not.toBeInTheDocument();
  });

  it("shows profile details when signed in", () => {
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("user", {
      id: "user-1",
      plan: "free",
      email: "dev@example.com",
      username: "swift-otter-4821",
    });

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
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("user", {
      id: "user-1",
      plan: "free",
      email: "dev@example.com",
      username: "swift-otter-4821",
    });
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
    expect(screen.getByRole("heading", { level: 2, name: "calm-finch-1234" })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Username updated");
    // Focus returns to the recreated trigger so keyboard users are not dropped.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit username" })).toHaveFocus(),
    );
  });

  it("moves focus into the editor and back to the trigger on cancel", async () => {
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("user", { id: "user-1", plan: "free", username: "swift-otter-4821" });

    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    await waitFor(() => expect(screen.getByLabelText("Username")).toHaveFocus());
    expect(screen.getByLabelText("Username")).toHaveValue("swift-otter-4821");

    fireEvent.input(screen.getByLabelText("Username"), { target: { value: "something-else" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Username")).toBeNull();
    expect(updateUsernameMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 2, name: "swift-otter-4821" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit username" })).toHaveFocus(),
    );
  });

  it("treats saving the current username (after normalisation) as a no-op", async () => {
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("user", { id: "user-1", plan: "free", username: "swift-otter-4821" });

    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.input(screen.getByLabelText("Username"), {
      target: { value: "  Swift-Otter-4821 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));

    expect(updateUsernameMock).not.toHaveBeenCalled();
    expect(updateLocalUsernameMock).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Username")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "swift-otter-4821" })).toBeInTheDocument();
  });

  it("keeps focus on the input when validation fails so the error is announced", async () => {
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("user", { id: "user-1", plan: "free", username: "swift-otter-4821" });

    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.input(screen.getByLabelText("Username"), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));

    await waitFor(() => expect(screen.getByText("Username is reserved")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText("Username")).toHaveFocus());
    expect(screen.getByLabelText("Username")).toHaveAccessibleDescription(/reserved/i);
  });

  it("rejects reserved and malformed usernames client-side without calling the API", async () => {
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("user", {
      id: "user-1",
      plan: "free",
      username: "swift-otter-4821",
    });

    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));

    for (const [input, message] of [
      ["admin", "Username is reserved"],
      ["swift--otter", "Username cannot start, end, or contain consecutive hyphens"],
      ["Bad_Name", "Username may only contain lowercase letters, digits, and hyphens"],
      ["ab", "Username must be 3-32 characters"],
      ["   ", "Username must be 3-32 characters"],
    ] as const) {
      fireEvent.input(screen.getByLabelText("Username"), { target: { value: input } });
      fireEvent.click(screen.getByRole("button", { name: "Save username" }));
      await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
    }

    expect(updateUsernameMock).not.toHaveBeenCalled();
  });

  it("surfaces a taken-username error", async () => {
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("user", {
      id: "user-1",
      plan: "free",
      username: "swift-otter-4821",
    });
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

  it.each([
    ["a 500 ApiError", new ApiError(500, "internal server error")],
    ["a network TypeError", new TypeError("Failed to fetch")],
  ])("keeps the editor open and the handle unchanged on %s", async (_label, failure) => {
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("user", { id: "user-1", plan: "free", username: "swift-otter-4821" });
    updateUsernameMock.mockRejectedValue(failure);

    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.input(screen.getByLabelText("Username"), { target: { value: "calm-finch-1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Save username" }));

    await waitFor(() => expect(screen.getByText(failure.message)).toBeInTheDocument());
    // Editor stays open with the draft, nothing was applied locally, no 409 toast.
    expect(screen.getByLabelText("Username")).toHaveValue("calm-finch-1234");
    expect(updateLocalUsernameMock).not.toHaveBeenCalled();
    expect(mockAuthState.user?.username).toBe("swift-otter-4821");
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save username" })).not.toBeDisabled(),
    );
  });

  it("opens the delete confirmation modal", () => {
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("user", {
      id: "user-1",
      plan: "free",
      email: "dev@example.com",
      username: "swift-otter-4821",
    });

    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(screen.getByText("Type DELETE to confirm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete permanently" })).toBeDisabled();
  });
});

describe("Account accessibility", () => {
  it("has no axe violations when signed out", async () => {
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("requireAuth", false);
    setAuth("user", null);

    const { container } = renderAccount();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });

  it("has no axe violations when signed in", async () => {
    setAuth("loading", false);
    setAuth("cloudEnabled", true);
    setAuth("user", {
      id: "user-1",
      plan: "free",
      email: "dev@example.com",
      username: "swift-otter-4821",
    });

    const { container } = renderAccount();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
