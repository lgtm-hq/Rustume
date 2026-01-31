import { Suspense, onMount, createSignal, type ParentComponent } from "solid-js";
import { AppShell } from "./components/layout/AppShell";
import { initWasm } from "./wasm";

function LoadingFallback() {
  return (
    <div class="flex h-screen items-center justify-center bg-paper">
      <div class="text-center">
        <div class="font-display text-2xl text-ink animate-pulse-subtle">Rustume</div>
        <div class="mt-2 text-sm text-stone">Loading...</div>
      </div>
    </div>
  );
}

const App: ParentComponent = (props) => {
  const [wasmReady, setWasmReady] = createSignal(false);
  const [wasmError, setWasmError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      await initWasm();
      setWasmReady(true);
    } catch (e) {
      console.error("Failed to initialize WASM:", e);
      setWasmError(e instanceof Error ? e.message : "Failed to load");
      // Continue anyway - server API can still work
      setWasmReady(true);
    }
  });

  return (
    <Suspense fallback={<LoadingFallback />}>
      {wasmError() && (
        <div class="fixed top-0 left-0 right-0 bg-offline/10 px-4 py-2 text-center text-sm text-stone z-50">
          Offline features unavailable: {wasmError()}
        </div>
      )}
      <AppShell>{props.children}</AppShell>
    </Suspense>
  );
};

export default App;
