import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { ApiKeysSection, resetPendingCreatedKeyForTests } from "../ApiKeysSection";

const { listApiKeysMock, createApiKeyMock, revokeApiKeyMock, toastSuccessMock, toastErrorMock } =
  vi.hoisted(() => ({
    listApiKeysMock: vi.fn(),
    createApiKeyMock: vi.fn(),
    revokeApiKeyMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }));

vi.mock("../../../api/apiKeys", () => ({
  API_KEY_NAME_MAX_LENGTH: 100,
  listApiKeys: listApiKeysMock,
  createApiKey: createApiKeyMock,
  revokeApiKey: revokeApiKeyMock,
}));

vi.mock("../../ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../ui")>();
  return {
    ...actual,
    toast: {
      ...actual.toast,
      success: toastSuccessMock,
      error: toastErrorMock,
    },
  };
});

const sampleKeys = [
  {
    id: "key-1",
    name: "CI deploy",
    prefix: "abcd1234",
    last_used_at: null,
    created_at: "2026-06-15T12:00:00Z",
  },
  {
    id: "key-2",
    name: "Local dev",
    prefix: "efgh5678",
    last_used_at: "2026-06-20T08:30:00Z",
    created_at: "2026-06-10T12:00:00Z",
  },
];

describe("ApiKeysSection", () => {
  beforeEach(() => {
    listApiKeysMock.mockResolvedValue(sampleKeys);
    createApiKeyMock.mockReset();
    revokeApiKeyMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetPendingCreatedKeyForTests();
  });

  it("renders the API key list", async () => {
    render(() => <ApiKeysSection />);

    expect(await screen.findByText("CI deploy")).toBeInTheDocument();
    expect(screen.getByText("Local dev")).toBeInTheDocument();
    expect(screen.getByText("rk_abcd1234…")).toBeInTheDocument();
    expect(screen.getByText(/Last used Never/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Revoke" })).toHaveLength(2);
  });

  it("shows empty state when no keys exist", async () => {
    listApiKeysMock.mockResolvedValue([]);

    render(() => <ApiKeysSection />);

    expect(await screen.findByText(/No API keys yet/i)).toBeInTheDocument();
  });

  it("reveals the created key once in the create flow", async () => {
    createApiKeyMock.mockResolvedValue({
      id: "key-3",
      name: "Automation",
      prefix: "zzzz9999",
      key: "rk_plaintext_once",
    });
    listApiKeysMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: "key-3",
        name: "Automation",
        prefix: "zzzz9999",
        last_used_at: null,
        created_at: "2026-06-21T12:00:00Z",
      },
    ]);

    render(() => <ApiKeysSection />);
    await screen.findByText(/No API keys yet/i);

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "Automation" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create key" }));

    expect(await screen.findByText("rk_plaintext_once")).toBeInTheDocument();
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument();
    expect(createApiKeyMock).toHaveBeenCalledWith("Automation");
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("API key created");
    });
  });

  it("copies the created key to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    createApiKeyMock.mockResolvedValue({
      id: "key-3",
      name: "Automation",
      prefix: "zzzz9999",
      key: "rk_plaintext_once",
    });
    listApiKeysMock.mockResolvedValue([]);

    render(() => <ApiKeysSection />);
    await screen.findByText(/No API keys yet/i);

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "Automation" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create key" }));
    await screen.findByText("rk_plaintext_once");

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("rk_plaintext_once");
      expect(toastSuccessMock).toHaveBeenCalledWith("API key copied to clipboard");
    });
  });

  it("keeps the one-time key visible until Done is clicked", async () => {
    createApiKeyMock.mockResolvedValue({
      id: "key-3",
      name: "Automation",
      prefix: "zzzz9999",
      key: "rk_plaintext_once",
    });
    listApiKeysMock.mockResolvedValue([]);

    render(() => <ApiKeysSection />);
    await screen.findByText(/No API keys yet/i);

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "Automation" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create key" }));
    await screen.findByText("rk_plaintext_once");

    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();

    fireEvent.keyDown(createDialog, { key: "Escape" });
    expect(screen.getByText("rk_plaintext_once")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(screen.queryByText("rk_plaintext_once")).not.toBeInTheDocument();
    });
  });

  it("shows an error state with retry instead of the empty state when listing fails", async () => {
    listApiKeysMock
      .mockRejectedValueOnce(new Error("Not authenticated"))
      .mockResolvedValueOnce(sampleKeys);

    render(() => <ApiKeysSection />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Couldn't load your API keys/i);
    expect(alert).toHaveTextContent("Not authenticated");
    expect(screen.queryByText(/No API keys yet/i)).not.toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith("Not authenticated");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("CI deploy")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ignores a stale list response that resolves after a newer one", async () => {
    let resolveInitial: (keys: typeof sampleKeys) => void = () => {};
    const initialList = new Promise<typeof sampleKeys>((resolve) => {
      resolveInitial = resolve;
    });
    const createdSummary = {
      id: "key-3",
      name: "Automation",
      prefix: "zzzz9999",
      last_used_at: null,
      created_at: "2026-06-21T12:00:00Z",
    };
    listApiKeysMock.mockReturnValueOnce(initialList).mockResolvedValueOnce([createdSummary]);
    createApiKeyMock.mockResolvedValue({
      id: "key-3",
      name: "Automation",
      prefix: "zzzz9999",
      key: "rk_plaintext_once",
    });

    render(() => <ApiKeysSection />);

    // Create while the initial list is still in flight.
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "Automation" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create key" }));
    await screen.findByText("rk_plaintext_once");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(await screen.findByText("Automation")).toBeInTheDocument();

    // The slow initial request finally resolves with a list that predates the create.
    resolveInitial([]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText("Automation")).toBeInTheDocument();
    expect(screen.queryByText(/No API keys yet/i)).not.toBeInTheDocument();
  });

  it("cannot be dismissed while the create request is in flight", async () => {
    let resolveCreate: (key: {
      id: string;
      name: string;
      prefix: string;
      key: string;
    }) => void = () => {};
    createApiKeyMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    listApiKeysMock.mockResolvedValue([]);

    render(() => <ApiKeysSection />);
    await screen.findByText(/No API keys yet/i);

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "Automation" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create key" }));

    // Escape, backdrop, and Cancel are all inert while the POST is pending.
    fireEvent.keyDown(createDialog, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    expect(within(createDialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    resolveCreate({ id: "key-3", name: "Automation", prefix: "zzzz9999", key: "rk_once" });

    expect(await screen.findByText("rk_once")).toBeInTheDocument();
  });

  it("opens a fresh name form after a previous key was revealed and dismissed", async () => {
    createApiKeyMock.mockResolvedValue({
      id: "key-3",
      name: "Automation",
      prefix: "zzzz9999",
      key: "rk_once",
    });
    listApiKeysMock.mockResolvedValue([]);

    render(() => <ApiKeysSection />);
    await screen.findByText(/No API keys yet/i);

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    let createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "Automation" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create key" }));
    await screen.findByText("rk_once");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    createDialog = await screen.findByRole("dialog");
    expect(within(createDialog).getByLabelText("Key name")).toHaveValue("");
    expect(screen.queryByText("rk_once")).not.toBeInTheDocument();
  });

  it("shows an error toast and keeps the form when creation fails", async () => {
    createApiKeyMock.mockRejectedValue(new Error("Maximum of 20 active API keys reached"));
    listApiKeysMock.mockResolvedValue(sampleKeys);

    render(() => <ApiKeysSection />);
    await screen.findByText("CI deploy");

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "One too many" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create key" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Maximum of 20 active API keys reached");
    });
    expect(within(createDialog).getByLabelText("Key name")).toHaveValue("One too many");
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("caps the key name input at the server limit", async () => {
    render(() => <ApiKeysSection />);
    await screen.findByText("CI deploy");

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");

    expect(within(createDialog).getByLabelText("Key name")).toHaveAttribute("maxlength", "100");
  });

  it("keeps Create key disabled for empty and whitespace-only names", async () => {
    render(() => <ApiKeysSection />);
    await screen.findByText("CI deploy");

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    const submit = within(createDialog).getByRole("button", { name: "Create key" });
    const input = within(createDialog).getByLabelText("Key name");

    expect(submit).toBeDisabled();
    fireEvent.input(input, { target: { value: "   " } });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(createApiKeyMock).not.toHaveBeenCalled();

    fireEvent.input(input, { target: { value: "  CI  " } });
    expect(submit).toBeEnabled();
  });

  it("renders a formatted last-used date for keys that have been used", async () => {
    render(() => <ApiKeysSection />);

    const localDev = (await screen.findByRole("heading", { name: "Local dev" })).closest("li");
    expect(localDev).not.toBeNull();
    const expected = new Date("2026-06-20T08:30:00Z").toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    expect(localDev).toHaveTextContent(`Last used ${expected}`);
  });

  it("refuses to submit a name over the server limit even if the input is bypassed", async () => {
    render(() => <ApiKeysSection />);
    await screen.findByText("CI deploy");

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "x".repeat(101) },
    });

    const submit = within(createDialog).getByRole("button", { name: "Create key" });
    expect(submit).toBeDisabled();
    expect(within(createDialog).getByText(/limited to 100 characters/i)).toBeInTheDocument();
    fireEvent.click(submit);
    expect(createApiKeyMock).not.toHaveBeenCalled();
  });

  it("shows an error toast when the clipboard write is rejected", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    createApiKeyMock.mockResolvedValue({
      id: "key-3",
      name: "Automation",
      prefix: "zzzz9999",
      key: "rk_plaintext_once",
    });
    listApiKeysMock.mockResolvedValue([]);

    render(() => <ApiKeysSection />);
    await screen.findByText(/No API keys yet/i);

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "Automation" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create key" }));
    await screen.findByText("rk_plaintext_once");

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to copy API key");
    });
    // The key stays visible so the user can copy it manually.
    expect(screen.getByText("rk_plaintext_once")).toBeInTheDocument();
  });

  it("shows an error toast and keeps the key when revocation fails", async () => {
    revokeApiKeyMock.mockRejectedValue(new Error("Forbidden"));

    render(() => <ApiKeysSection />);
    await screen.findByText("CI deploy");

    fireEvent.click(screen.getAllByRole("button", { name: "Revoke" })[0]);
    const revokeDialog = await screen.findByRole("dialog", { name: "Revoke API key" });
    fireEvent.click(within(revokeDialog).getByRole("button", { name: "Revoke key" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Forbidden");
    });
    expect(screen.getByRole("heading", { name: "CI deploy" })).toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("restores the one-time key reveal after the section is unmounted and remounted", async () => {
    createApiKeyMock.mockResolvedValue({
      id: "key-3",
      name: "Automation",
      prefix: "zzzz9999",
      key: "rk_survives_remount",
    });
    listApiKeysMock.mockResolvedValue([]);

    const first = render(() => <ApiKeysSection />);
    await screen.findByText(/No API keys yet/i);
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "Automation" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create key" }));
    await screen.findByText("rk_survives_remount");

    // Simulate a route change away from /account and back.
    first.unmount();
    expect(screen.queryByText("rk_survives_remount")).not.toBeInTheDocument();
    render(() => <ApiKeysSection />);

    expect(await screen.findByText("rk_survives_remount")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "API key created" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(screen.queryByText("rk_survives_remount")).not.toBeInTheDocument();
    });
  });

  it("reveals a key whose create request resolves after an unmount and remount", async () => {
    let resolveCreate: (key: {
      id: string;
      name: string;
      prefix: string;
      key: string;
    }) => void = () => {};
    createApiKeyMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    listApiKeysMock.mockResolvedValue([]);

    const first = render(() => <ApiKeysSection />);
    await screen.findByText(/No API keys yet/i);
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "Automation" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create key" }));

    // Navigate away while the POST is still in flight, then come back.
    first.unmount();
    render(() => <ApiKeysSection />);
    await screen.findByText(/No API keys yet/i);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    resolveCreate({ id: "key-3", name: "Automation", prefix: "zzzz9999", key: "rk_late" });

    expect(await screen.findByText("rk_late")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "API key created" })).toBeInTheDocument();
  });

  it("warns before unload only while a one-time key is on screen", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    createApiKeyMock.mockResolvedValue({
      id: "key-3",
      name: "Automation",
      prefix: "zzzz9999",
      key: "rk_guarded",
    });
    listApiKeysMock.mockResolvedValue([]);

    render(() => <ApiKeysSection />);
    await screen.findByText(/No API keys yet/i);
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));

    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.input(within(createDialog).getByLabelText("Key name"), {
      target: { value: "Automation" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Create key" }));
    await screen.findByText("rk_guarded");
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("asks for confirmation before revoking a key", async () => {
    revokeApiKeyMock.mockResolvedValue(undefined);

    render(() => <ApiKeysSection />);
    await screen.findByText("CI deploy");

    fireEvent.click(screen.getAllByRole("button", { name: "Revoke" })[0]);
    const revokeDialog = await screen.findByRole("dialog", { name: "Revoke API key" });
    expect(revokeDialog).toHaveTextContent(/Revoke CI deploy/i);

    fireEvent.click(within(revokeDialog).getByRole("button", { name: "Revoke key" }));

    await waitFor(() => {
      expect(revokeApiKeyMock).toHaveBeenCalledWith("key-1");
      expect(toastSuccessMock).toHaveBeenCalledWith("API key revoked");
    });
    expect(screen.queryByText("CI deploy")).not.toBeInTheDocument();
    expect(screen.getByText("Local dev")).toBeInTheDocument();
  });
});
