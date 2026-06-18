import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, type ParentComponent } from "solid-js";
import { authStore } from "../../stores/auth";

const AUTH_PATH_PREFIX = "/auth/";

function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith(AUTH_PATH_PREFIX)) {
    return false;
  }

  if (pathname === "/account") {
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

  return props.children;
};
