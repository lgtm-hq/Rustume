import { onCleanup, onMount, createSignal, Show, type ParentComponent } from "solid-js";
import { useLocation } from "@solidjs/router";
import { AppErrorBoundary } from "./components/errors/AppErrorBoundary";
import { AppShell } from "./components/layout/AppShell";
import { CloudImportPrompt } from "./components/Auth/CloudImportPrompt";
import { RequireAuthGuard } from "./components/Auth/RequireAuthGuard";
import { SubscriptionBanner } from "./components/Auth/SubscriptionBanner";
import { Button, ToastRegion } from "./components/ui";
import { authStore } from "./stores/auth";
import { handleAuthQueryParams } from "./lib/authFeedback";
import { initWasm } from "./wasm";

const WASM_NOTICE_KEY = "wasmNoticeDismissed";

function isDesignLabPath(pathname: string): boolean {
  return pathname === "/design-lab" || pathname.startsWith("/design-lab/");
}

const App: ParentComponent = (props) => {
  const location = useLocation();
  const [wasmError, setWasmError] = createSignal<string | null>(null);
  const [showWasmNotice, setShowWasmNotice] = createSignal(
    localStorage.getItem(WASM_NOTICE_KEY) !== "true",
  );

  const dismissNotice = () => {
    setShowWasmNotice(false);
    localStorage.setItem(WASM_NOTICE_KEY, "true");
  };

  const inDesignLab = () => isDesignLabPath(location.pathname);

  onMount(async () => {
    try {
      await authStore.refresh();
    } catch (error) {
      console.error("Failed to refresh auth state:", error);
    }
    handleAuthQueryParams();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        authStore.refresh().catch((err: unknown) => {
          console.error("Failed to refresh auth on page restore:", err);
        });
      }
    };
    window.addEventListener("pageshow", onPageShow);
    onCleanup(() => window.removeEventListener("pageshow", onPageShow));

    try {
      await initWasm();
      window.dispatchEvent(new CustomEvent("rustume:wasm-ready"));
    } catch (e) {
      console.error("Failed to initialize WASM:", e);
      setWasmError(e instanceof Error ? e.message : "Failed to load");
      // Still notify listeners so the resume list can fall back to localStorage.
      window.dispatchEvent(new CustomEvent("rustume:wasm-ready"));
    }
  });

  return (
    <AppErrorBoundary>
      <div class={wasmError() && showWasmNotice() && !inDesignLab() ? "pt-16" : ""}>
        <Show when={wasmError() && showWasmNotice() && !inDesignLab()}>
          <div class="fixed top-0 left-0 right-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-950 shadow-soft">
            <div class="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <p>
                Browser import features are using the server fallback because the WASM module did
                not load. Run <code class="font-mono">make setup</code> in development, or continue
                if you are using the hosted app.
              </p>
              <Button variant="ghost" size="sm" onClick={dismissNotice}>
                Dismiss
              </Button>
            </div>
          </div>
        </Show>
        <Show
          when={inDesignLab()}
          fallback={
            <RequireAuthGuard>
              <SubscriptionBanner />
              <AppShell>{props.children}</AppShell>
            </RequireAuthGuard>
          }
        >
          {props.children}
        </Show>
        <Show when={!inDesignLab()}>
          <CloudImportPrompt />
        </Show>
        <ToastRegion />
      </div>
    </AppErrorBoundary>
  );
};

export default App;
