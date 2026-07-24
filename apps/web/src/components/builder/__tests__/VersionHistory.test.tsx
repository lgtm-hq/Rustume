import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createDefaultResume } from "../../../wasm/defaults";
import type { ResumeData } from "../../../wasm/types";
import { VersionHistory } from "../VersionHistory";
import { resumeStore } from "../../../stores/resume";
import { uiStore } from "../../../stores/ui";
import { ResumeVersionConflictError } from "../../../api/resumes";

const renderPreviewMock = vi.fn();
const listSnapshotsMock = vi.fn();
const getSnapshotMock = vi.fn();
const listResumeVersionsMock = vi.fn();
const getResumeVersionMock = vi.fn();
const restoreResumeVersionMock = vi.fn();
const isCloudAuthenticatedMock = vi.fn();
const getCloudResumeVersionMock = vi.fn();
const setCloudResumeVersionMock = vi.fn();
const showResumeVersionConflictToastMock = vi.fn();
const recordUndoMock = vi.fn();
const confirmMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const toastWarningMock = vi.fn();
const toastInfoMock = vi.fn();

vi.mock("../../../api/render", () => ({
  renderPreview: (...args: unknown[]) => renderPreviewMock(...args),
}));

vi.mock("../../../stores/versionHistory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../stores/versionHistory")>();
  return {
    ...actual,
    listSnapshots: (...args: unknown[]) => listSnapshotsMock(...args),
    getSnapshot: (...args: unknown[]) => getSnapshotMock(...args),
  };
});

vi.mock("../../../api/resumes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../api/resumes")>();
  return {
    ...actual,
    listResumeVersions: (...args: unknown[]) => listResumeVersionsMock(...args),
    getResumeVersion: (...args: unknown[]) => getResumeVersionMock(...args),
    restoreResumeVersion: (...args: unknown[]) => restoreResumeVersionMock(...args),
  };
});

vi.mock("../../../stores/cloudStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../stores/cloudStorage")>();
  return {
    ...actual,
    isCloudAuthenticated: () => isCloudAuthenticatedMock(),
    getCloudResumeVersion: (...args: unknown[]) => getCloudResumeVersionMock(...args),
    setCloudResumeVersion: (...args: unknown[]) => setCloudResumeVersionMock(...args),
    showResumeVersionConflictToast: (...args: unknown[]) =>
      showResumeVersionConflictToastMock(...args),
  };
});

vi.mock("../../../stores/editorUndo", () => ({
  recordUndo: (...args: unknown[]) => recordUndoMock(...args),
  setUndoRecorder: vi.fn(),
}));

vi.mock("../../../components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../components/ui")>();
  return {
    ...actual,
    toast: {
      ...actual.toast,
      success: (...args: unknown[]) => toastSuccessMock(...args),
      error: (...args: unknown[]) => toastErrorMock(...args),
      warning: (...args: unknown[]) => toastWarningMock(...args),
      info: (...args: unknown[]) => toastInfoMock(...args),
    },
  };
});

function resumeWithName(name: string): ResumeData {
  const resume = createDefaultResume();
  resume.basics.name = name;
  return resume;
}

describe("VersionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock.mockReturnValue(true);
    vi.stubGlobal("confirm", confirmMock);
    uiStore.openModal("versionHistory");
    resumeStore.createNewResume("resume-history-test");
    isCloudAuthenticatedMock.mockReturnValue(false);
    renderPreviewMock.mockResolvedValue({
      url: "blob:preview-url",
      totalPages: 1,
    });
  });

  afterEach(() => {
    uiStore.closeModal();
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lists local snapshots newest-first and previews the first entry", async () => {
    const older = {
      key: "resume-history-test_v1000",
      resumeId: "resume-history-test",
      timestamp: 1000,
    };
    const newer = {
      key: "resume-history-test_v2000",
      resumeId: "resume-history-test",
      timestamp: 2000,
    };
    listSnapshotsMock.mockResolvedValue([newer, older]);
    getSnapshotMock.mockResolvedValue(resumeWithName("Newer Name"));

    render(() => <VersionHistory />);

    await waitFor(() => {
      expect(screen.getByText("Snapshots")).toBeInTheDocument();
    });

    expect(listSnapshotsMock).toHaveBeenCalledWith("resume-history-test");
    await waitFor(() => {
      expect(renderPreviewMock).toHaveBeenCalledWith(
        expect.objectContaining({ basics: expect.objectContaining({ name: "Newer Name" }) }),
        0,
      );
      expect(screen.getByAltText("Read-only snapshot preview")).toHaveAttribute(
        "src",
        "blob:preview-url",
      );
    });
  });

  it("reverts a local snapshot after confirmation and marks the store dirty", async () => {
    const snapshot = resumeWithName("Restored Name");
    listSnapshotsMock.mockResolvedValue([
      { key: "resume-history-test_v2000", resumeId: "resume-history-test", timestamp: 2000 },
    ]);
    getSnapshotMock.mockResolvedValue(snapshot);

    render(() => <VersionHistory />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Revert to this version" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Revert to this version" }));

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled();
      expect(resumeStore.store.resume?.basics.name).toBe("Restored Name");
      expect(resumeStore.store.isDirty).toBe(true);
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Reverted to selected version",
        undefined,
        expect.objectContaining({ label: "Undo" }),
      );
    });
  });

  it("does not revert when the confirmation dialog is cancelled", async () => {
    confirmMock.mockReturnValue(false);
    const originalName = resumeStore.store.resume?.basics.name;
    listSnapshotsMock.mockResolvedValue([
      { key: "resume-history-test_v2000", resumeId: "resume-history-test", timestamp: 2000 },
    ]);
    getSnapshotMock.mockResolvedValue(resumeWithName("Restored Name"));

    render(() => <VersionHistory />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Revert to this version" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Revert to this version" }));

    expect(resumeStore.store.resume?.basics.name).toBe(originalName);
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("lists cloud versions with version numbers and restores via API reload", async () => {
    isCloudAuthenticatedMock.mockReturnValue(true);
    getCloudResumeVersionMock.mockReturnValue(4);
    listResumeVersionsMock.mockResolvedValue([
      { version: 3, created_at: "2026-01-02T00:00:00.000Z" },
      { version: 2, created_at: "2026-01-01T00:00:00.000Z" },
    ]);
    getResumeVersionMock.mockResolvedValue({
      id: "snap-1",
      resume_id: "resume-history-test",
      version: 3,
      data: resumeWithName("Cloud Snapshot"),
      created_at: "2026-01-02T00:00:00.000Z",
    });
    const restored = resumeWithName("Reloaded Cloud");
    restoreResumeVersionMock.mockResolvedValue({
      id: "resume-history-test",
      title: "Test",
      updated_at: "2026-01-03T00:00:00.000Z",
      user_id: "user-1",
      data: restored,
      is_public: false,
      public_slug: null,
      version: 5,
      created_at: "2026-01-01T00:00:00.000Z",
    });

    const applyRestoredSpy = vi.spyOn(resumeStore, "applyRestoredResume");

    render(() => <VersionHistory />);

    await waitFor(() => {
      expect(screen.getByText("v3")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Revert to this version" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Revert to this version" }));

    await waitFor(() => {
      expect(restoreResumeVersionMock).toHaveBeenCalledWith("resume-history-test", 3, 4);
      expect(setCloudResumeVersionMock).toHaveBeenCalledWith("resume-history-test", 5);
      expect(applyRestoredSpy).toHaveBeenCalledWith(restored);
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Reverted to selected version",
        undefined,
        expect.objectContaining({ label: "Undo" }),
      );
      expect(recordUndoMock).toHaveBeenCalled();
      expect(recordUndoMock.mock.invocationCallOrder[0]).toBeLessThan(
        applyRestoredSpy.mock.invocationCallOrder[0],
      );
    });

    applyRestoredSpy.mockRestore();
  });

  it("routes cloud restore conflicts through the shared conflict toast", async () => {
    isCloudAuthenticatedMock.mockReturnValue(true);
    getCloudResumeVersionMock.mockReturnValue(4);
    listResumeVersionsMock.mockResolvedValue([
      { version: 3, created_at: "2026-01-02T00:00:00.000Z" },
    ]);
    getResumeVersionMock.mockResolvedValue({
      id: "snap-1",
      resume_id: "resume-history-test",
      version: 3,
      data: resumeWithName("Cloud Snapshot"),
      created_at: "2026-01-02T00:00:00.000Z",
    });
    restoreResumeVersionMock.mockRejectedValue(
      new ResumeVersionConflictError("Resume was modified by another session", 5),
    );

    render(() => <VersionHistory />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Revert to this version" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Revert to this version" }));

    await waitFor(() => {
      expect(showResumeVersionConflictToastMock).toHaveBeenCalledWith("resume-history-test");
      expect(toastErrorMock).not.toHaveBeenCalled();
    });
  });
});
