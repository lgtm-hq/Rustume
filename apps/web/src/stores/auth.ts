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
  user: AuthUser | null;
}

function createAuthStore() {
  const [state, setState] = createStore<AuthState>({
    loading: true,
    cloudEnabled: false,
    requireAuth: false,
    user: null,
  });

  function applyProbe(result: AuthProbeResult) {
    if (result.mode === "self-hosted") {
      setState({ cloudEnabled: false, requireAuth: false, user: null, loading: false });
      return;
    }

    setState({
      cloudEnabled: true,
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
      setState({ cloudEnabled: false, requireAuth: false, user: null, loading: false });
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

  function updateLocalUsername(username: string) {
    if (state.user) {
      setState("user", "username", username);
    }
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
    updateLocalUsername,
  };
}

export const authStore = createRoot(createAuthStore);
