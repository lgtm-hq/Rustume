import { createRoot } from "solid-js";
import { createStore } from "solid-js/store";
import {
  type AuthProbeResult,
  type AuthUser,
  login,
  logout,
  probeAuth,
  userDisplayName,
} from "../api/auth";

interface AuthState {
  loading: boolean;
  cloudEnabled: boolean;
  requireAuth: boolean;
  billingEnabled: boolean;
  user: AuthUser | null;
  /** When true, show the pre-WorkOS sign-in confirm dialog (policy consent). */
  signInDialogOpen: boolean;
}

function createAuthStore() {
  const [state, setState] = createStore<AuthState>({
    loading: true,
    cloudEnabled: false,
    requireAuth: false,
    billingEnabled: false,
    user: null,
    signInDialogOpen: false,
  });

  function applyProbe(result: AuthProbeResult) {
    if (result.mode === "self-hosted") {
      setState({
        cloudEnabled: false,
        requireAuth: false,
        billingEnabled: false,
        user: null,
        loading: false,
      });
      return;
    }

    setState({
      cloudEnabled: true,
      requireAuth: result.requireAuth,
      billingEnabled: result.billingEnabled,
      user: result.user,
      loading: false,
    });
  }

  async function refresh() {
    setState("loading", true);
    try {
      applyProbe(await probeAuth());
    } catch (error) {
      console.error("Failed to probe auth:", error);
      setState({
        cloudEnabled: false,
        requireAuth: false,
        billingEnabled: false,
        user: null,
        loading: false,
      });
    }
  }

  /**
   * Re-probe `/auth/me` without disturbing the current view: no loading
   * spinner and no state reset on a transient failure. Used after events that
   * change the signed-in user server-side (e.g. Paddle checkout completed).
   */
  async function refreshUser() {
    try {
      applyProbe(await probeAuth());
    } catch (error) {
      console.error("Failed to refresh auth state:", error);
    }
  }

  async function signOut() {
    if (!state.cloudEnabled) return;
    try {
      await logout();
    } finally {
      setState("user", null);
    }
  }

  function displayName(user: AuthUser): string {
    return userDisplayName(user);
  }

  function clearUser() {
    setState("user", null);
  }

  /** Open the confirm dialog (policy consent) before redirecting to WorkOS. */
  function requestSignIn() {
    if (!state.cloudEnabled) return;
    setState("signInDialogOpen", true);
  }

  function closeSignInDialog() {
    setState("signInDialogOpen", false);
  }

  /** Confirm consent and redirect to `/auth/login`. */
  function confirmSignIn() {
    setState("signInDialogOpen", false);
    login();
  }

  return {
    get state() {
      return state;
    },
    refresh,
    refreshUser,
    /** Opens the sign-in confirm dialog; use {@link confirmSignIn} to redirect. */
    signIn: requestSignIn,
    closeSignInDialog,
    confirmSignIn,
    signOut,
    clearUser,
    displayName,
  };
}

export const authStore = createRoot(createAuthStore);
