import { useLocation } from "@solidjs/router";
import { Show, type ParentComponent } from "solid-js";
import Unauthorized from "../../pages/Unauthorized";
import { authStore } from "../../stores/auth";
import { Spinner } from "../ui";

const AUTH_PATH_PREFIX = "/auth/";
const PUBLIC_POLICY_PATHS = new Set(["/terms", "/privacy"]);

function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith(AUTH_PATH_PREFIX)) {
    return false;
  }

  if (pathname === "/account" || pathname.startsWith("/account/")) {
    return false;
  }

  if (PUBLIC_POLICY_PATHS.has(pathname)) {
    return false;
  }

  return true;
}

/** Block protected routes with a sign-in page when hosted require-auth mode is active. */
export const RequireAuthGuard: ParentComponent = (props) => {
  const location = useLocation();
  const { state } = authStore;

  const shouldBlock = () =>
    !state.loading &&
    state.cloudEnabled &&
    state.requireAuth &&
    !state.user &&
    isProtectedPath(location.pathname);

  return (
    <Show
      when={!state.loading}
      fallback={
        <div class="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <Spinner class="h-6 w-6 text-accent" ariaLabel="Loading authentication" />
        </div>
      }
    >
      <Show when={!shouldBlock()} fallback={<Unauthorized />}>
        {props.children}
      </Show>
    </Show>
  );
};
