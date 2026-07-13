import { Show, createEffect, createSignal } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { deleteAccount, updateUsername, validateUsername } from "../api/account";
import { downloadResumesJson, downloadResumesPdf } from "../api/export";
import { listCloudResumesPage } from "../api/resumes";
import { authStore } from "../stores/auth";
import { Button, Input, Modal, Spinner, toast } from "../components/ui";

function ProfileAvatar(props: { label: string }) {
  return (
    <div
      class="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center
        font-display text-2xl font-semibold uppercase"
      aria-hidden="true"
    >
      {props.label.slice(0, 1)}
    </div>
  );
}

function ComingSoonRow(props: { title: string; description: string }) {
  return (
    <div class="flex items-start justify-between gap-4 py-4 border-b border-border last:border-b-0">
      <div>
        <h3 class="font-medium text-ink">{props.title}</h3>
        <p class="text-sm text-stone mt-1">{props.description}</p>
      </div>
      <span
        class="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-xs font-mono
          text-stone border border-border flex-shrink-0"
      >
        Coming soon
      </span>
    </div>
  );
}

export default function Account() {
  const { state, signIn, signOut, clearUser, displayName, refresh } = authStore;
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = createSignal(false);
  const [signingIn, setSigningIn] = createSignal(false);
  const [deleteModalOpen, setDeleteModalOpen] = createSignal(false);
  const [deleteConfirmation, setDeleteConfirmation] = createSignal("");
  const [resumeCount, setResumeCount] = createSignal<number | null>(null);
  const [loadingResumeCount, setLoadingResumeCount] = createSignal(false);
  const [deletingAccount, setDeletingAccount] = createSignal(false);
  const [exportingJson, setExportingJson] = createSignal(false);
  const [exportingPdf, setExportingPdf] = createSignal(false);
  const [editingUsername, setEditingUsername] = createSignal(false);
  const [usernameDraft, setUsernameDraft] = createSignal("");
  const [usernameError, setUsernameError] = createSignal<string | null>(null);
  const [savingUsername, setSavingUsername] = createSignal(false);

  createEffect(() => {
    if (!deleteModalOpen()) {
      setDeleteConfirmation("");
      setResumeCount(null);
      return;
    }

    setLoadingResumeCount(true);
    void listCloudResumesPage(1, 1)
      .then((page) => setResumeCount(page.total))
      .catch((error) => {
        console.error("Failed to load resume count:", error);
        setResumeCount(null);
      })
      .finally(() => setLoadingResumeCount(false));
  });

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      toast.success("Signed out");
      navigate("/");
    } catch (error) {
      console.error("Sign out failed:", error);
      toast.error("Failed to sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const handleSignIn = () => {
    setSigningIn(true);
    signIn();
  };

  const handleExportJson = async () => {
    setExportingJson(true);
    try {
      await downloadResumesJson();
      toast.success("Resume export downloaded");
    } catch (error) {
      console.error("JSON export failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export resumes");
    } finally {
      setExportingJson(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await downloadResumesPdf();
      toast.success("PDF export downloaded");
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export PDFs");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount(deleteConfirmation());
      clearUser();
      setDeleteModalOpen(false);
      toast.success("Account deleted");
      navigate("/");
    } catch (error) {
      console.error("Account deletion failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete account. Please try again.",
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const deleteConfirmed = () => deleteConfirmation() === "DELETE";

  const startEditingUsername = (currentUsername: string) => {
    setUsernameDraft(currentUsername);
    setUsernameError(null);
    setEditingUsername(true);
  };

  const cancelEditingUsername = () => {
    setEditingUsername(false);
    setUsernameDraft("");
    setUsernameError(null);
  };

  const handleSaveUsername = async (currentUsername: string) => {
    const validationError = validateUsername(usernameDraft());
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    const normalized = usernameDraft().trim().toLowerCase();
    if (normalized === currentUsername) {
      cancelEditingUsername();
      return;
    }

    setSavingUsername(true);
    setUsernameError(null);
    try {
      await updateUsername(normalized);
      try {
        await refresh();
      } catch (refreshError) {
        console.error("Username saved but auth refresh failed:", refreshError);
        cancelEditingUsername();
        toast.success("Username updated");
        return;
      }
      cancelEditingUsername();
      toast.success("Username updated");
    } catch (error) {
      console.error("Username update failed:", error);
      const message =
        error instanceof Error ? error.message : "Failed to update username. Please try again.";
      setUsernameError(message);
      if (message.includes("already taken")) {
        toast.error("That username is already taken");
      }
    } finally {
      setSavingUsername(false);
    }
  };

  return (
    <div class="min-h-[calc(100vh-3.5rem)] bg-paper">
      <div class="max-w-2xl mx-auto px-4 py-12">
        <Show
          when={!state.loading}
          fallback={
            <div class="flex justify-center py-16">
              <Spinner class="w-6 h-6 text-accent" ariaLabel="Loading account information" />
            </div>
          }
        >
          <Show
            when={state.cloudEnabled}
            fallback={
              <div class="text-center py-16">
                <h1 class="font-display text-2xl font-semibold text-ink mb-3">Account</h1>
                <p class="text-stone">
                  Cloud accounts are only available on Rustume Cloud deployments.
                </p>
              </div>
            }
          >
            <Show
              when={state.user}
              fallback={
                <div class="text-center py-16 border border-border rounded-2xl bg-surface/40 px-6">
                  <h1 class="font-display text-2xl font-semibold text-ink mb-3">
                    Sign in to Rustume Cloud
                  </h1>
                  <p class="text-stone text-sm max-w-md mx-auto mb-6">
                    {state.requireAuth
                      ? "Sign in is required to use Rustume Cloud on this deployment."
                      : "Sync resumes across devices with your Rustume Cloud account. Your local copies stay on this device until you choose to import them."}
                  </p>
                  <Button onClick={handleSignIn} loading={signingIn()}>
                    Sign in to sync
                  </Button>
                  <Show when={!state.requireAuth}>
                    <p class="mt-4 text-xs text-stone">
                      Prefer local-only?{" "}
                      <A href="/" class="text-accent hover:underline">
                        Continue without signing in
                      </A>
                    </p>
                  </Show>
                </div>
              }
            >
              {(user) => (
                <div class="space-y-8">
                  <div>
                    <h1 class="font-display text-3xl font-semibold text-ink mb-2">Account</h1>
                    <p class="text-stone text-sm">
                      Manage your Rustume Cloud profile and sync settings.
                    </p>
                  </div>

                  <section class="rounded-2xl border border-border bg-paper p-6 shadow-card">
                    <div class="flex items-center gap-4">
                      <ProfileAvatar label={displayName(user())} />
                      <div class="min-w-0 flex-1">
                        <Show
                          when={!editingUsername()}
                          fallback={
                            <div class="space-y-3">
                              <Input
                                label="Username"
                                value={usernameDraft()}
                                onInput={(value) => {
                                  setUsernameDraft(value);
                                  setUsernameError(null);
                                }}
                                placeholder="swift-otter-4821"
                                error={usernameError() ?? undefined}
                              />
                              <div class="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => void handleSaveUsername(user().username)}
                                  loading={savingUsername()}
                                >
                                  Save username
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={cancelEditingUsername}
                                  disabled={savingUsername()}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          }
                        >
                          <h2 class="font-display text-xl font-semibold text-ink truncate">
                            {displayName(user())}
                          </h2>
                          <button
                            type="button"
                            class="mt-1 text-sm text-accent hover:underline"
                            onClick={() => startEditingUsername(user().username)}
                          >
                            Edit username
                          </button>
                        </Show>
                        <Show when={user().email}>
                          {(email) => <p class="text-sm text-stone truncate mt-1">{email()}</p>}
                        </Show>
                        <p class="text-xs font-mono text-stone mt-2 uppercase tracking-wide">
                          Plan: {user().plan}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section class="rounded-2xl border border-border bg-paper p-6 shadow-card">
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">Cloud sync</h2>
                    <p class="text-sm text-stone">
                      Resumes saved to your Rustume Cloud account are available on any signed-in
                      device. Edits sync automatically while you're online.
                    </p>
                  </section>

                  <section class="rounded-2xl border border-border bg-paper p-6 shadow-card">
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">
                      Privacy and data
                    </h2>
                    <p class="text-sm text-stone">
                      Rustume Cloud uses{" "}
                      <a
                        href="https://workos.com/docs/user-management/authkit"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-accent hover:underline"
                      >
                        WorkOS AuthKit
                      </a>{" "}
                      for authentication. Your email is stored by both WorkOS and Rustume to
                      identify your account. Rustume assigns a friendly username for display; your
                      legal name stays with your identity provider.
                    </p>
                  </section>

                  <section
                    id="export"
                    class="rounded-2xl border border-border bg-paper p-6 shadow-card"
                  >
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">Export data</h2>
                    <p class="text-sm text-stone mb-4">
                      Download all cloud resumes for backup or migration to self-hosted Rustume.
                    </p>
                    <div class="flex flex-wrap gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => void handleExportJson()}
                        loading={exportingJson()}
                      >
                        Download as JSON
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void handleExportPdf()}
                        loading={exportingPdf()}
                      >
                        Download as PDF (ZIP)
                      </Button>
                    </div>
                  </section>

                  <section class="rounded-2xl border border-border bg-paper px-6 py-2 shadow-card">
                    <ComingSoonRow
                      title="Billing"
                      description="Manage your subscription and payment details."
                    />
                    <ComingSoonRow
                      title="End-to-end encryption"
                      description="Optional client-side encryption for resume content."
                    />
                  </section>

                  <section class="rounded-2xl border border-red-200 bg-red-50/40 p-6 shadow-card">
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">Danger zone</h2>
                    <p class="text-sm text-stone mb-4">
                      Permanently delete your account, all cloud resumes, and version history. This
                      action cannot be undone.
                    </p>
                    <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                      Delete my account
                    </Button>
                  </section>

                  <div class="flex justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => void handleSignOut()}
                      loading={signingOut()}
                    >
                      Sign out
                    </Button>
                  </div>

                  <Modal
                    open={deleteModalOpen()}
                    onOpenChange={setDeleteModalOpen}
                    title="Delete account"
                    description="This permanently removes your Rustume Cloud account and data."
                    size="lg"
                  >
                    <div class="space-y-4">
                      <p class="text-sm text-stone">This will permanently delete:</p>
                      <ul class="list-disc pl-5 text-sm text-stone space-y-1">
                        <li>Your account and profile</li>
                        <li>
                          <Show
                            when={!loadingResumeCount() && resumeCount() !== null}
                            fallback="All cloud resumes"
                          >
                            All {resumeCount()} {resumeCount() === 1 ? "resume" : "resumes"}
                          </Show>
                        </li>
                        <li>All version history</li>
                        <li>Your subscription (if active)</li>
                      </ul>

                      <p class="text-sm text-stone">
                        Export your resumes from the account page before deleting if you need local
                        copies.
                      </p>

                      <Input
                        label="Type DELETE to confirm"
                        value={deleteConfirmation()}
                        onInput={setDeleteConfirmation}
                        placeholder="DELETE"
                      />

                      <div class="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => void handleDeleteAccount()}
                          loading={deletingAccount()}
                          disabled={!deleteConfirmed()}
                        >
                          Delete permanently
                        </Button>
                      </div>
                    </div>
                  </Modal>
                </div>
              )}
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}
