import {
  For,
  Show,
  createEffect,
  createRoot,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";
import {
  API_KEY_NAME_MAX_LENGTH,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKeySummary,
  type CreatedApiKey,
} from "../../api/apiKeys";
import { authStore } from "../../stores/auth";
import { Button, Input, Modal, Spinner, toast } from "../ui";

function formatTimestamp(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatLastUsed(lastUsedAt: string | null): string {
  if (!lastUsedAt) {
    return "Never";
  }
  return formatTimestamp(lastUsedAt);
}

/**
 * The one-time plaintext key is held outside the component so that an unmount
 * (route change, auth refresh re-rendering the account page) cannot discard the
 * only copy the UI will ever show. It lives in memory only, never in storage,
 * and is cleared when the user clicks Done.
 */
interface PendingCreatedKey {
  key: CreatedApiKey;
  /** Id of the signed-in user the key was issued to. */
  ownerId: string;
}

const [pendingCreated, setPendingCreated] = createSignal<PendingCreatedKey | null>(null);

const currentUserId = (): string | null => authStore.state.user?.id ?? null;

/**
 * The pending secret is bound to the principal it was issued to. If the
 * signed-in user changes or signs out, drop it immediately so a later mount
 * (possibly by someone else on the same browser session) can never reveal it.
 */
createRoot(() => {
  createEffect(() => {
    const userId = currentUserId();
    const pending = pendingCreated();
    if (pending && pending.ownerId !== userId) {
      setPendingCreated(null);
    }
  });
});

/** The pending key, only while the same user is still signed in. */
const pendingCreatedKey = (): CreatedApiKey | null => {
  const pending = pendingCreated();
  return pending && pending.ownerId === currentUserId() ? pending.key : null;
};

/**
 * Store a freshly issued key for the user it was issued to. `ownerId` is the
 * identity captured when the request was submitted, not whoever is signed in
 * when it completes, so an identity change mid-flight leaves nothing behind.
 */
const storePendingCreatedKey = (key: CreatedApiKey, ownerId: string): void => {
  if (ownerId !== currentUserId()) {
    return;
  }
  setPendingCreated({ key, ownerId });
};

const clearPendingCreatedKey = (): void => {
  setPendingCreated(null);
};

/**
 * Whether a create request is in flight. Module-scoped for the same reason as
 * the pending key: a remounted section must not offer a second submit that
 * could overwrite a one-time secret the first request is about to return.
 */
const [createInFlight, setCreateInFlight] = createSignal(false);

/** Test-only escape hatch to reset module state between renders. */
export function resetPendingCreatedKeyForTests(): void {
  setPendingCreated(null);
  setCreateInFlight(false);
}

function warnBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
  // Legacy browsers require returnValue to be set to show the prompt.
  event.returnValue = "";
}

/** Account settings section for creating, listing, and revoking API keys. */
export function ApiKeysSection() {
  const [keys, setKeys] = createSignal<ApiKeySummary[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  // The dialog is open whenever the user asked for it OR a one-time key is
  // pending, so a create that resolves after an unmount/remount still reveals
  // the key instead of silently parking it in module state.
  const [createModalRequested, setCreateModalRequested] = createSignal(false);
  const createModalOpen = () => createModalRequested() || pendingCreatedKey() !== null;
  const [createName, setCreateName] = createSignal("");
  const creating = createInFlight;
  const createdKey = pendingCreatedKey;

  // While a one-time key is on screen, warn before the tab is closed or reloaded.
  createEffect(() => {
    if (!createdKey()) return;
    window.addEventListener("beforeunload", warnBeforeUnload);
    onCleanup(() => window.removeEventListener("beforeunload", warnBeforeUnload));
  });
  const [revokeModalOpen, setRevokeModalOpen] = createSignal(false);
  const [keyToRevoke, setKeyToRevoke] = createSignal<ApiKeySummary | null>(null);
  const [revoking, setRevoking] = createSignal(false);

  // Monotonic counter so a slow, superseded list request cannot overwrite the
  // result of a newer one (for example the reload that follows a create).
  let loadGeneration = 0;

  const loadKeys = async () => {
    const generation = ++loadGeneration;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listApiKeys();
      if (generation !== loadGeneration) return;
      setKeys(result);
    } catch (error) {
      if (generation !== loadGeneration) return;
      console.error("Failed to load API keys:", error);
      const message = error instanceof Error ? error.message : "Failed to load API keys";
      setLoadError(message);
      toast.error(message);
    } finally {
      if (generation === loadGeneration) {
        setLoading(false);
      }
    }
  };

  onMount(() => {
    void loadKeys();
  });

  const resetCreateModal = () => {
    setCreateName("");
    clearPendingCreatedKey();
  };

  // Whichever instance is mounted when a key lands refreshes the list, so a
  // create that completes after a remount is reflected in the new section.
  createEffect(
    on(
      createdKey,
      (key) => {
        if (key) void loadKeys();
      },
      { defer: true },
    ),
  );

  const openCreateModal = () => {
    resetCreateModal();
    setCreateModalRequested(true);
  };

  const handleCreateModalChange = (open: boolean) => {
    // Keep the dialog open while the create request is in flight (so the
    // one-time key cannot be lost) and until the user explicitly clicks Done.
    if (!open && (createdKey() || creating())) {
      return;
    }
    setCreateModalRequested(open);
    if (!open) {
      resetCreateModal();
    }
  };

  const dismissCreatedKey = () => {
    setCreateModalRequested(false);
    resetCreateModal();
  };

  const nameTooLong = () => createName().trim().length > API_KEY_NAME_MAX_LENGTH;
  const canSubmitName = () => createName().trim().length > 0 && !nameTooLong();

  const handleCreateKey = async () => {
    const name = createName().trim();
    // One create at a time across mounts: a second submit while the first is
    // in flight could overwrite a one-time secret before it is ever shown.
    const ownerId = currentUserId();
    if (!canSubmitName() || createInFlight() || createdKey() || !ownerId) {
      return;
    }

    setCreateInFlight(true);
    try {
      const key = await createApiKey(name);
      storePendingCreatedKey(key, ownerId);
      if (ownerId === currentUserId()) {
        toast.success("API key created");
      }
    } catch (error) {
      console.error("API key creation failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create API key");
    } finally {
      setCreateInFlight(false);
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success("API key copied to clipboard");
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error("Failed to copy API key");
    }
  };

  const openRevokeModal = (key: ApiKeySummary) => {
    setKeyToRevoke(key);
    setRevokeModalOpen(true);
  };

  const handleRevokeModalChange = (open: boolean) => {
    setRevokeModalOpen(open);
    if (!open) {
      setKeyToRevoke(null);
    }
  };

  const handleRevokeKey = async () => {
    const key = keyToRevoke();
    if (!key) {
      return;
    }

    setRevoking(true);
    try {
      await revokeApiKey(key.id);
      setKeys((current) => current.filter((item) => item.id !== key.id));
      setRevokeModalOpen(false);
      setKeyToRevoke(null);
      toast.success("API key revoked");
    } catch (error) {
      console.error("API key revocation failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to revoke API key");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <section class="rounded-2xl border border-border bg-paper p-6 shadow-card">
      <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h2 class="font-display text-lg font-semibold text-ink mb-2">API keys</h2>
          <p class="text-sm text-stone">
            Create keys for programmatic access to the Rustume Cloud API. A key acts as your account
            (except for key management and account deletion) and authenticates requests with{" "}
            <code class="font-mono text-xs">Authorization: Bearer rk_…</code>.
          </p>
        </div>
        <Button onClick={openCreateModal} disabled={creating()}>
          Create key
        </Button>
      </div>

      <Show
        when={!loading()}
        fallback={
          <div class="flex justify-center py-8">
            <Spinner class="w-5 h-5 text-accent" ariaLabel="Loading API keys" />
          </div>
        }
      >
        <Show
          when={!loadError()}
          fallback={
            <div class="flex flex-wrap items-center justify-between gap-3 py-2">
              <p class="text-sm text-stone" role="alert">
                Couldn't load your API keys. {loadError()}
              </p>
              <Button variant="secondary" size="sm" onClick={() => void loadKeys()}>
                Retry
              </Button>
            </div>
          }
        >
          <Show
            when={keys().length > 0}
            fallback={
              <p class="text-sm text-stone py-2">
                No API keys yet. Create one to access resumes and other cloud data from scripts, CI
                pipelines, or integrations.
              </p>
            }
          >
            <ul class="divide-y divide-border">
              <For each={keys()}>
                {(key) => (
                  <li class="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div class="min-w-0">
                      <h3 class="font-medium text-ink">{key.name}</h3>
                      <p class="mt-1 font-mono text-sm text-stone">rk_{key.prefix}…</p>
                      <p class="mt-2 text-xs text-stone">
                        Created {formatTimestamp(key.created_at)} · Last used{" "}
                        {formatLastUsed(key.last_used_at)}
                      </p>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => openRevokeModal(key)}>
                      Revoke
                    </Button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </Show>

      <Modal
        open={createModalOpen()}
        onOpenChange={handleCreateModalChange}
        title={createdKey() ? "API key created" : "Create API key"}
        description={
          createdKey()
            ? "Copy this key now — it will not be shown again."
            : "Give your key a name so you can identify it later."
        }
        size="md"
        dismissible={!createdKey() && !creating()}
      >
        <Show
          when={createdKey()}
          fallback={
            <div class="space-y-4">
              <Input
                label="Key name"
                value={createName()}
                onInput={setCreateName}
                placeholder="CI deploy"
                description={`1–${API_KEY_NAME_MAX_LENGTH} characters`}
                error={
                  nameTooLong()
                    ? `Key names are limited to ${API_KEY_NAME_MAX_LENGTH} characters`
                    : undefined
                }
                maxLength={API_KEY_NAME_MAX_LENGTH}
              />
              <div class="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => handleCreateModalChange(false)}
                  disabled={creating()}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleCreateKey()}
                  loading={creating()}
                  disabled={!canSubmitName()}
                >
                  Create key
                </Button>
              </div>
            </div>
          }
        >
          {(key) => (
            <div class="space-y-4">
              <p class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                This key is shown only once — store it securely.
              </p>
              <pre class="overflow-x-auto rounded-lg border border-border bg-surface px-4 py-3 font-mono text-sm text-ink break-all whitespace-pre-wrap">
                {key().key}
              </pre>
              <div class="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => void handleCopyKey(key().key)}>
                  Copy
                </Button>
                <Button onClick={dismissCreatedKey}>Done</Button>
              </div>
            </div>
          )}
        </Show>
      </Modal>

      <Modal
        open={revokeModalOpen()}
        onOpenChange={handleRevokeModalChange}
        title="Revoke API key"
        description="This key will stop working immediately."
        size="sm"
      >
        <Show when={keyToRevoke()}>
          {(key) => (
            <div class="space-y-4">
              <p class="text-sm text-stone">
                Revoke <span class="font-medium text-ink">{key().name}</span> (
                <span class="font-mono">rk_{key().prefix}…</span>)? Any clients using this key will
                lose access.
              </p>
              <div class="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => handleRevokeModalChange(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void handleRevokeKey()}
                  loading={revoking()}
                >
                  Revoke key
                </Button>
              </div>
            </div>
          )}
        </Show>
      </Modal>
    </section>
  );
}
