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
  /** True when the server API is used for resume storage (local or cloud mode). */
  cloudEnabled: boolean;
  /** True in self-hosted local mode: server storage without auth UI. */
  localMode: boolean;
  requireAuth: boolean;
  user: AuthUser | null;
}

function createAuthStore() {
  const [state, setState] = createStore<AuthState>({
    loading: true,
    cloudEnabled: false,
    localMode: false,
    requireAuth: false,
    user: null,
  });

  function applyProbe(result: AuthProbeResult) {
    if (result.mode === "self-hosted") {
      setState({
        cloudEnabled: false,
        localMode: false,
        requireAuth: false,
        user: null,
        loading: false,
      });
      return;
    }

    if (result.mode === "local") {
      setState({
        cloudEnabled: true,
        localMode: true,
        requireAuth: false,
        user: result.user,
        loading: false,
      });
      return;
    }

    setState({
      cloudEnabled: true,
      localMode: false,
      requireAuth: result.requireAuth,
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
        localMode: false,
        requireAuth: false,
        user: null,
        loading: false,
      });
    }
  }

  async function signOut() {
    // Local mode has no session to sign out of.
    if (!state.cloudEnabled || state.localMode) return;
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

  return {
    get state() {
      return state;
    },
    refresh,
    signIn: login,
    signOut,
    clearUser,
    displayName,
  };
}

export const authStore = createRoot(createAuthStore);
