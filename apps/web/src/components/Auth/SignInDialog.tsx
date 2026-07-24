import { createSignal, Show } from "solid-js";
import { authStore } from "../../stores/auth";
import { Button, Modal } from "../ui";
import { PolicyConsent } from "./PolicyConsent";

/** Pre-WorkOS confirm step: explains sync and shows policy browsewrap consent. */
export function SignInDialog() {
  const { state, closeSignInDialog, confirmSignIn } = authStore;
  const [confirming, setConfirming] = createSignal(false);

  const handleConfirm = () => {
    setConfirming(true);
    confirmSignIn();
  };

  return (
    <Show when={state.cloudEnabled}>
      <Modal
        open={state.signInDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeSignInDialog();
        }}
        title="Sign in to Rustume Cloud"
        description="Sync resumes across devices. Local copies on this device stay here until you import them."
        size="sm"
      >
        <div class="space-y-4" data-testid="sign-in-dialog">
          <PolicyConsent />
          <div class="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => closeSignInDialog()} disabled={confirming()}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} loading={confirming()} data-testid="sign-in-confirm">
              Continue to sign in
            </Button>
          </div>
        </div>
      </Modal>
    </Show>
  );
}
