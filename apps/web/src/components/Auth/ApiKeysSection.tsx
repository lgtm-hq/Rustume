import { For, Show, createSignal, onMount } from "solid-js";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKeySummary,
  type CreatedApiKey,
} from "../../api/apiKeys";
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

/** Account settings section for creating, listing, and revoking API keys. */
export function ApiKeysSection() {
  const [keys, setKeys] = createSignal<ApiKeySummary[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [createModalOpen, setCreateModalOpen] = createSignal(false);
  const [createName, setCreateName] = createSignal("");
  const [creating, setCreating] = createSignal(false);
  const [createdKey, setCreatedKey] = createSignal<CreatedApiKey | null>(null);
  const [revokeModalOpen, setRevokeModalOpen] = createSignal(false);
  const [keyToRevoke, setKeyToRevoke] = createSignal<ApiKeySummary | null>(null);
  const [revoking, setRevoking] = createSignal(false);

  const loadKeys = async () => {
    setLoading(true);
    try {
      setKeys(await listApiKeys());
    } catch (error) {
      console.error("Failed to load API keys:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void loadKeys();
  });

  const resetCreateModal = () => {
    setCreateName("");
    setCreatedKey(null);
    setCreating(false);
  };

  const handleCreateModalChange = (open: boolean) => {
    // Keep the one-time key visible until the user explicitly clicks Done.
    if (!open && createdKey()) {
      return;
    }
    setCreateModalOpen(open);
    if (!open) {
      resetCreateModal();
    }
  };

  const dismissCreatedKey = () => {
    setCreateModalOpen(false);
    resetCreateModal();
  };

  const handleCreateKey = async () => {
    const name = createName().trim();
    if (!name) {
      return;
    }

    setCreating(true);
    try {
      const key = await createApiKey(name);
      setCreatedKey(key);
      await loadKeys();
      toast.success("API key created");
    } catch (error) {
      console.error("API key creation failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create API key");
    } finally {
      setCreating(false);
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
            Create keys for programmatic access to the Rustume Cloud API. Keys authenticate requests
            with <code class="font-mono text-xs">Authorization: Bearer rk_…</code>.
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>Create key</Button>
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
        dismissible={!createdKey()}
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
                description="1–100 characters"
              />
              <div class="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => handleCreateModalChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleCreateKey()}
                  loading={creating()}
                  disabled={!createName().trim()}
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
