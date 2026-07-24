import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { ApiKeysSection } from "../ApiKeysSection";

const { listApiKeysMock, createApiKeyMock, revokeApiKeyMock, toastSuccessMock, toastErrorMock } =
  vi.hoisted(() => ({
    listApiKeysMock: vi.fn(),
    createApiKeyMock: vi.fn(),
    revokeApiKeyMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }));

vi.mock("../../../api/apiKeys", () => ({
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
