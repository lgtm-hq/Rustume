import { useLocation } from "@solidjs/router";
import { Show, type ParentComponent } from "solid-js";
import CloudEntry from "../../pages/CloudEntry";
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

  if (pathname === "/design-lab" || pathname.startsWith("/design-lab/")) {
    return false;
  }

  const normalizedPathname = pathname.replace(/\/$/, "") || "/";
  if (PUBLIC_POLICY_PATHS.has(normalizedPathname)) {
    return false;
  }

  return true;
}

/**
 * Block protected routes with the Cloud entry page whenever a hosted deployment
 * has no signed-in user.
 *
 * Deliberately does NOT key on `state.requireAuth`: anonymous use of Rustume
 * Cloud is not supported, so the flag would only ever weaken the gate.
 * Self-hosted deployments (`cloudEnabled === false`) are never blocked — they
 * have no accounts at all.
 */
export const RequireAuthGuard: ParentComponent = (props) => {
  const location = useLocation();
  const { state } = authStore;

  const shouldBlock = () =>
    !state.loading && state.cloudEnabled && !state.user && isProtectedPath(location.pathname);

  return (
    <Show
      when={!state.loading}
      fallback={
        <div class="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <Spinner class="h-6 w-6 text-accent" ariaLabel="Loading authentication" />
        </div>
      }
    >
      <Show when={!shouldBlock()} fallback={<CloudEntry />}>
        {props.children}
      </Show>
    </Show>
  );
};
