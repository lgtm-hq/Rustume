import { createRoot } from "solid-js";
import { createStore } from "solid-js/store";
import { type AuthProbeResult, type AuthUser, login, logout, probeAuth } from "../api/auth";

interface AuthState {
  loading: boolean;
  cloudEnabled: boolean;
  user: AuthUser | null;
}

function createAuthStore() {
  const [state, setState] = createStore<AuthState>({
    loading: true,
    cloudEnabled: false,
    user: null,
  });

  function applyProbe(result: AuthProbeResult) {
    if (result.mode === "self-hosted") {
      setState({ cloudEnabled: false, user: null, loading: false });
      return;
    }

    setState({ cloudEnabled: true, user: result.user, loading: false });
  }

  async function refresh() {
    setState("loading", true);
    try {
      applyProbe(await probeAuth());
    } catch (error) {
      console.error("Failed to probe auth:", error);
      setState("loading", false);
    }
  }

  async function signOut() {
    if (!state.cloudEnabled) return;
    await logout();
    setState("user", null);
  }

  return {
    get state() {
      return state;
    },
    refresh,
    signIn: login,
    signOut,
  };
}

export const authStore = createRoot(createAuthStore);
