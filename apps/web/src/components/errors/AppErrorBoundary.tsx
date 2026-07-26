import { ErrorBoundary, type ParentComponent } from "solid-js";
import { AppErrorFallback } from "./AppErrorFallback";

/** Catches render errors in the app tree and shows a friendly fallback instead of a blank page. */
export const AppErrorBoundary: ParentComponent = (props) => (
  <ErrorBoundary fallback={(error, reset) => <AppErrorFallback error={error} onRetry={reset} />}>
    {props.children}
  </ErrorBoundary>
);
