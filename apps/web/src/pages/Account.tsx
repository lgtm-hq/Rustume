import { Show, createEffect, createSignal } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { deleteAccount } from "../api/account";
import { downloadResumesJson, downloadResumesPdf } from "../api/export";
import { listCloudResumesPage } from "../api/resumes";
import { authStore } from "../stores/auth";
import { Button, Input, LanguageSelector, Modal, Spinner, toast } from "../components/ui";
import { useI18n } from "../i18n";

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

function ComingSoonRow(props: { title: string; description: string; badge: string }) {
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
        {props.badge}
      </span>
    </div>
  );
}

export default function Account() {
  const { t } = useI18n();
  const { state, signIn, signOut, clearUser, displayName } = authStore;
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
      toast.success(t("account.toasts.signedOut"));
      navigate("/");
    } catch (error) {
      console.error("Sign out failed:", error);
      toast.error(t("account.toasts.signOutFailed"));
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
      toast.success(t("account.export.jsonSuccess"));
    } catch (error) {
      console.error("JSON export failed:", error);
      toast.error(error instanceof Error ? error.message : t("account.export.jsonFailed"));
    } finally {
      setExportingJson(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await downloadResumesPdf();
      toast.success(t("account.export.pdfSuccess"));
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error(error instanceof Error ? error.message : t("account.export.pdfFailed"));
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
      toast.success(t("account.toasts.accountDeleted"));
      navigate("/");
    } catch (error) {
      console.error("Account deletion failed:", error);
      toast.error(error instanceof Error ? error.message : t("account.toasts.deleteFailed"));
    } finally {
      setDeletingAccount(false);
    }
  };

  const deleteConfirmed = () => deleteConfirmation() === "DELETE";

  const resumeCountLabel = () => {
    const count = resumeCount();
    if (count === null) {
      return t("account.deleteModal.items.allResumes");
    }
    const label =
      count === 1 ? t("account.deleteModal.items.resume") : t("account.deleteModal.items.resumes");
    return t("account.deleteModal.items.resumeCount", { count, label });
  };

  return (
    <div class="min-h-[calc(100vh-3.5rem)] bg-paper">
      <div class="max-w-2xl mx-auto px-4 py-12">
        <Show
          when={!state.loading}
          fallback={
            <div class="flex justify-center py-16">
              <Spinner class="w-6 h-6 text-accent" ariaLabel={t("account.loadingAria")} />
            </div>
          }
        >
          <Show
            when={state.cloudEnabled}
            fallback={
              <div class="text-center py-16">
                <h1 class="font-display text-2xl font-semibold text-ink mb-3">
                  {t("account.title")}
                </h1>
                <p class="text-stone">{t("account.cloudDisabled")}</p>
              </div>
            }
          >
            <Show
              when={state.user}
              fallback={
                <div class="text-center py-16 border border-border rounded-2xl bg-surface/40 px-6">
                  <h1 class="font-display text-2xl font-semibold text-ink mb-3">
                    {t("account.signIn.title")}
                  </h1>
                  <p class="text-stone text-sm max-w-md mx-auto mb-6">
                    {state.requireAuth
                      ? t("account.signIn.requiredDescription")
                      : t("account.signIn.optionalDescription")}
                  </p>
                  <Button onClick={handleSignIn} loading={signingIn()}>
                    {t("common.actions.signIn")}
                  </Button>
                  <Show when={!state.requireAuth}>
                    <p class="mt-4 text-xs text-stone">
                      {t("account.signIn.localOnly")}{" "}
                      <A href="/" class="text-accent hover:underline">
                        {t("account.signIn.continueWithoutSignIn")}
                      </A>
                    </p>
                  </Show>
                </div>
              }
            >
              {(user) => (
                <div class="space-y-8">
                  <div>
                    <h1 class="font-display text-3xl font-semibold text-ink mb-2">
                      {t("account.title")}
                    </h1>
                    <p class="text-stone text-sm">{t("account.profile.description")}</p>
                  </div>

                  <section class="rounded-2xl border border-border bg-paper p-6 shadow-card">
                    <div class="flex items-center gap-4">
                      <ProfileAvatar label={displayName(user())} />
                      <div class="min-w-0">
                        <h2 class="font-display text-xl font-semibold text-ink truncate">
                          {displayName(user())}
                        </h2>
                        <Show when={user().email}>
                          {(email) => <p class="text-sm text-stone truncate mt-1">{email()}</p>}
                        </Show>
                        <p class="text-xs font-mono text-stone mt-2 uppercase tracking-wide">
                          {t("common.labels.plan", { plan: user().plan })}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section class="rounded-2xl border border-border bg-paper p-6 shadow-card">
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">
                      {t("account.language.title")}
                    </h2>
                    <p class="text-sm text-stone mb-4">{t("account.language.description")}</p>
                    <LanguageSelector />
                  </section>

                  <section class="rounded-2xl border border-border bg-paper p-6 shadow-card">
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">
                      {t("account.cloudSync.title")}
                    </h2>
                    <p class="text-sm text-stone">{t("account.cloudSync.description")}</p>
                  </section>

                  <section class="rounded-2xl border border-border bg-paper p-6 shadow-card">
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">
                      {t("account.privacy.title")}
                    </h2>
                    <p class="text-sm text-stone">
                      {t("account.privacy.descriptionBefore")}{" "}
                      <a
                        href="https://workos.com/docs/user-management/authkit"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-accent hover:underline"
                      >
                        {t("account.privacy.workosLink")}
                      </a>{" "}
                      {t("account.privacy.descriptionAfter")}
                    </p>
                  </section>

                  <section
                    id="export"
                    class="rounded-2xl border border-border bg-paper p-6 shadow-card"
                  >
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">
                      {t("account.export.title")}
                    </h2>
                    <p class="text-sm text-stone mb-4">{t("account.export.description")}</p>
                    <div class="flex flex-wrap gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => void handleExportJson()}
                        loading={exportingJson()}
                      >
                        {t("account.export.json")}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void handleExportPdf()}
                        loading={exportingPdf()}
                      >
                        {t("account.export.pdf")}
                      </Button>
                    </div>
                  </section>

                  <section class="rounded-2xl border border-border bg-paper px-6 py-2 shadow-card">
                    <ComingSoonRow
                      title={t("account.comingSoon.billing.title")}
                      description={t("account.comingSoon.billing.description")}
                      badge={t("common.status.comingSoon")}
                    />
                    <ComingSoonRow
                      title={t("account.comingSoon.e2e.title")}
                      description={t("account.comingSoon.e2e.description")}
                      badge={t("common.status.comingSoon")}
                    />
                  </section>

                  <section class="rounded-2xl border border-red-200 bg-red-50/40 p-6 shadow-card">
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">
                      {t("account.dangerZone.title")}
                    </h2>
                    <p class="text-sm text-stone mb-4">{t("account.dangerZone.description")}</p>
                    <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                      {t("account.dangerZone.deleteAccount")}
                    </Button>
                  </section>

                  <div class="flex justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => void handleSignOut()}
                      loading={signingOut()}
                    >
                      {t("common.actions.signOut")}
                    </Button>
                  </div>

                  <Modal
                    open={deleteModalOpen()}
                    onOpenChange={setDeleteModalOpen}
                    title={t("account.deleteModal.title")}
                    description={t("account.deleteModal.description")}
                    size="lg"
                  >
                    <div class="space-y-4">
                      <p class="text-sm text-stone">{t("account.deleteModal.intro")}</p>
                      <ul class="list-disc ps-5 text-sm text-stone space-y-1">
                        <li>{t("account.deleteModal.items.profile")}</li>
                        <li>
                          <Show
                            when={!loadingResumeCount() && resumeCount() !== null}
                            fallback={t("account.deleteModal.items.allResumes")}
                          >
                            {resumeCountLabel()}
                          </Show>
                        </li>
                        <li>{t("account.deleteModal.items.history")}</li>
                        <li>{t("account.deleteModal.items.subscription")}</li>
                      </ul>

                      <p class="text-sm text-stone">{t("account.deleteModal.exportReminder")}</p>

                      <Input
                        label={t("account.deleteModal.confirmLabel")}
                        value={deleteConfirmation()}
                        onInput={setDeleteConfirmation}
                        placeholder={t("account.deleteModal.confirmPlaceholder")}
                      />

                      <div class="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
                          {t("common.actions.cancel")}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => void handleDeleteAccount()}
                          loading={deletingAccount()}
                          disabled={!deleteConfirmed()}
                        >
                          {t("account.deleteModal.deletePermanently")}
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
