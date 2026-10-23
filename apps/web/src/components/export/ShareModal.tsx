import { createSignal, onMount, Show } from "solid-js";
import { Button, Input, Modal, Switch, toast } from "../ui";
import { uiStore } from "../../stores/ui";
import { getCloudResume } from "../../api/resumes";
import { updateSharing } from "../../api/sharing";

export interface ShareModalProps {
  resumeId: string;
}

export function ShareModal(props: ShareModalProps) {
  const { store: ui, closeModal } = uiStore;

  const [isPublic, setIsPublic] = createSignal(false);
  const [publicSlug, setPublicSlug] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [isUpdating, setIsUpdating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const isOpen = () => ui.modal === "share";

  const publicUrl = () => {
    const slug = publicSlug();
    return slug ? `${window.location.origin}/r/${slug}` : null;
  };

  onMount(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const row = await getCloudResume(props.resumeId);
      setIsPublic(row.is_public);
      setPublicSlug(row.public_slug);
    } catch (e) {
      console.error("Failed to load sharing settings:", e);
      const message = e instanceof Error ? e.message : "Failed to load sharing settings";
      setError(message);
      toast.error("Failed to load sharing settings");
    } finally {
      setIsLoading(false);
    }
  });

  const handleSharingChange = async (nextPublic: boolean) => {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await updateSharing(props.resumeId, nextPublic);
      setIsPublic(response.is_public);
      setPublicSlug(response.public_slug);
      toast.success(nextPublic ? "Resume published" : "Resume unpublished");
    } catch (e) {
      console.error("Failed to update sharing:", e);
      const message = e instanceof Error ? e.message : "Failed to update sharing";
      setError(message);
      toast.error("Failed to update sharing");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyUrl = async () => {
    const url = publicUrl();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch (e) {
      console.error("Failed to copy URL:", e);
      toast.error("Failed to copy link");
    }
  };

  return (
    <Modal
      open={isOpen()}
      onOpenChange={(open) => !open && closeModal()}
      title="Share Resume"
      description="Publish a read-only link anyone can view"
      size="md"
    >
      <Show
        when={!isLoading()}
        fallback={
          <div class="flex min-h-[120px] items-center justify-center text-sm text-stone">
            Loading sharing settings…
          </div>
        }
      >
        <div class="space-y-5">
          <Switch
            label="Publish to web"
            description={
              isPublic() ? "Anyone with the link can view this resume" : "Keep this resume private"
            }
            checked={isPublic()}
            disabled={isUpdating()}
            onChange={handleSharingChange}
          />

          <Show when={isPublic() && publicUrl()}>
            {(url) => (
              <div class="space-y-2">
                <label class="text-sm font-medium text-ink" for="share-url">
                  Public link
                </label>
                <div class="flex gap-2">
                  <Input id="share-url" value={url()} readOnly class="font-mono text-xs" />
                  <Button variant="secondary" onClick={handleCopyUrl}>
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </Show>

          <Show when={!isPublic() && publicSlug()}>
            <p class="text-xs text-stone">
              Unpublishing hides the public page. The same link will work again if you re-publish.
            </p>
          </Show>

          <Show when={error()}>
            <div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error()}
            </div>
          </Show>
        </div>
      </Show>

      <div class="mt-6 flex justify-end gap-2 border-t border-border pt-4">
        <Show when={isPublic()}>
          <Button
            variant="ghost"
            disabled={isUpdating()}
            onClick={() => handleSharingChange(false)}
          >
            Unpublish
          </Button>
        </Show>
        <Button variant="ghost" onClick={closeModal}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
