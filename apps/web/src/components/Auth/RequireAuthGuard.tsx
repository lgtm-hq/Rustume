import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, Show, type ParentComponent } from "solid-js";
import { authStore } from "../../stores/auth";
import { Spinner } from "../ui";

const AUTH_PATH_PREFIX = "/auth/";

function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith(AUTH_PATH_PREFIX)) {
    return false;
  }

  if (pathname === "/account" || pathname.startsWith("/account/")) {
    return false;
  }

  return true;
}

/** Redirect signed-out users to login when hosted require-auth mode is active. */
export const RequireAuthGuard: ParentComponent = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = authStore;

  createEffect(() => {
    if (state.loading) {
      return;
    }

    if (!state.cloudEnabled || !state.requireAuth || state.user) {
      return;
    }

    if (!isProtectedPath(location.pathname)) {
      return;
    }

    navigate("/auth/login", { replace: true });
  });

  return (
    <Show when={!state.loading} fallback={<Spinner class="w-6 h-6 text-accent mx-auto mt-24" />}>
      {props.children}
    </Show>
  );
};
