import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { Route, Router } from "@solidjs/router";
import { SignInDialog } from "../SignInDialog";

const { mockAuthState, closeSignInDialogMock, confirmSignInMock } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: true,
    requireAuth: false,
    user: null as { id: string; plan: string } | null,
    signInDialogOpen: true,
  },
  closeSignInDialogMock: vi.fn(),
  confirmSignInMock: vi.fn(),
}));

vi.mock("../../../stores/auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
    closeSignInDialog: closeSignInDialogMock,
    confirmSignIn: confirmSignInMock,
  },
}));

function renderDialog() {
  return render(() => (
    <Router>
      <Route path="/" component={SignInDialog} />
    </Router>
  ));
}

describe("SignInDialog", () => {
  it("shows policy consent and confirms into WorkOS redirect", () => {
    mockAuthState.cloudEnabled = true;
    mockAuthState.signInDialogOpen = true;
    confirmSignInMock.mockClear();

    renderDialog();

    expect(screen.getByTestId("sign-in-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("policy-consent")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );

    fireEvent.click(screen.getByTestId("sign-in-confirm"));
    expect(confirmSignInMock).toHaveBeenCalledTimes(1);
  });

  it("closes without confirming when Cancel is clicked", () => {
    mockAuthState.cloudEnabled = true;
    mockAuthState.signInDialogOpen = true;
    closeSignInDialogMock.mockClear();
    confirmSignInMock.mockClear();

    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(closeSignInDialogMock).toHaveBeenCalledTimes(1);
    expect(confirmSignInMock).not.toHaveBeenCalled();
  });

  it("renders nothing when cloud mode is disabled", () => {
    mockAuthState.cloudEnabled = false;
    mockAuthState.signInDialogOpen = true;

    renderDialog();

    expect(screen.queryByTestId("sign-in-dialog")).not.toBeInTheDocument();
  });
});
