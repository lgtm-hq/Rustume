import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { axeConfig } from "../../test/a11y";
import { Route, Router } from "@solidjs/router";
import Account from "../Account";
import { ACCOUNT_EXPORT_CONTENTS, downloadAccountExport } from "../../api/account";
import { ApiError } from "../../api/client";

const { mockAuthState, signInMock, signOutMock } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    requireAuth: false,
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
    // Mirrors userDisplayName — vi.mock hoisting prevents importing the real function.
    displayName: (user: { email?: string; first_name?: string; last_name?: string }) => {
      const parts = [user.first_name, user.last_name].filter(Boolean);
      if (parts.length > 0) return parts.join(" ");
      return user.email ?? "Account";
    },
  },
}));

// Only the network calls are mocked; ACCOUNT_EXPORT_CONTENTS is the real
// constant so the copy assertions below test what production renders.
vi.mock("../../api/account", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/account")>();
  return {
    ...actual,
    deleteAccount: vi.fn(),
    downloadAccountExport: vi.fn().mockResolvedValue(undefined),
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
  beforeEach(async () => {
    vi.mocked(downloadAccountExport).mockClear();
    vi.mocked(downloadAccountExport).mockResolvedValue(undefined);
    const { toast } = await import("../../components/ui");
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
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
    expect(screen.getByText("End-to-end encryption")).toBeInTheDocument();
    expect(screen.getAllByText("Coming soon").length).toBeGreaterThan(0);
    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export account data" })).toBeInTheDocument();
  });

  it("triggers account data export", async () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = {
      id: "user-1",
      plan: "free",
      email: "dev@example.com",
    };

    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Export account data" }));

    expect(downloadAccountExport).toHaveBeenCalledTimes(1);
    const { toast } = await import("../../components/ui");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Account data downloaded"));
  });

  it("ignores a second click while an export is already running", async () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = { id: "user-1", plan: "free", email: "dev@example.com" };
    let finish: (() => void) | undefined;
    vi.mocked(downloadAccountExport).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );

    renderAccount();
    const button = screen.getByRole("button", { name: "Export account data" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(downloadAccountExport).toHaveBeenCalledTimes(1);
    finish?.();
    const { toast } = await import("../../components/ui");
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
  });

  it("describes exactly what the account export contains and omits", () => {
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = { id: "user-1", plan: "free", email: "dev@example.com" };

    renderAccount();

    // The page renders from ACCOUNT_EXPORT_CONTENTS, which mirrors the server's
    // AccountDataExport allow-list; assert every entry reaches the user, and
    // that the list itself still names the documented exclusions.
    const copy =
      screen.getByText(/Download a JSON archive of the account data Rustume stores/).textContent ??
      "";
    for (const item of [...ACCOUNT_EXPORT_CONTENTS.included, ...ACCOUNT_EXPORT_CONTENTS.excluded]) {
      expect(copy).toContain(item);
    }
    expect(ACCOUNT_EXPORT_CONTENTS.excluded).toEqual(
      expect.arrayContaining([
        "sessions",
        "the WorkOS user id",
        "the Paddle customer id",
        "share password hashes",
      ]),
    );
    expect(ACCOUNT_EXPORT_CONTENTS.included.join(" ")).toMatch(/audit trail/);
    expect(ACCOUNT_EXPORT_CONTENTS.included.join(" ")).toMatch(/version snapshots/);
  });

  // The page never branches on status or retry_after; it shows the server's
  // error message as-is. Two real server messages, one behaviour.
  it.each([
    [429, "Too many requests. Please try again shortly."],
    [503, "Too many account exports are running right now. Please try again shortly."],
  ])(
    "passes the server's error message through when export fails (status %i)",
    async (status, message) => {
      mockAuthState.loading = false;
      mockAuthState.cloudEnabled = true;
      mockAuthState.user = {
        id: "user-1",
        plan: "free",
        email: "dev@example.com",
      };
      // The real client surfaces the server's JSON `error` string as ApiError.
      vi.mocked(downloadAccountExport).mockRejectedValueOnce(
        new ApiError(status, message, JSON.stringify({ error: message, retry_after: 30 })),
      );

      renderAccount();

      const button = screen.getByRole("button", { name: "Export account data" });
      fireEvent.click(button);

      const { toast } = await import("../../components/ui");
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
      // The button must recover so the user can retry.
      await waitFor(() => expect(button).not.toBeDisabled());
    },
  );

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
